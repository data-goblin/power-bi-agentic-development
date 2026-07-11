use crate::agents::{AgentKind, AgentStatus, InstallScope};
use crate::config;
use crate::detect::EnvironmentSignals;
use crate::install::{
    self, InstallRequest, SkillPlacement, SkillPlacementTarget, SkillSyncRequest,
};
use crate::inventory::Inventory;
use crate::memory::{MemoryEntry, MemoryInventory, MemoryKind, MemoryScope};
use crate::recommend::{recommend, Recommendation};
use crate::registry::{is_deprecated_skill, Registry};
use crate::source::{resolve_registry_root, RegistrySource, SourceOptions};
use crate::statusline::{
    self, StatusLineComponent, StatusLineContextStyle, StatusLineInstallRequest,
    StatusLineMeterStyle, StatusLineOptions,
};
use anyhow::{anyhow, Result};
use clap::{Args, Parser, Subcommand, ValueEnum};
use console::{measure_text_width, style, Key, Term};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fs;
use std::io::{BufRead, IsTerminal};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime};
use walkdir::WalkDir;

const WARNING_SYMBOL: &str = "!";
const MAX_USAGE_HISTORY_FILES: usize = 20;
const MAX_USAGE_HISTORY_BYTES: u64 = 2 * 1024 * 1024;
const MAX_USAGE_HISTORY_FILE_BYTES: u64 = 512 * 1024;

#[derive(Parser)]
#[command(
    name = "pbiad",
    version,
    about = "Power BI agentic development installer and recommender",
    disable_help_subcommand = true
)]
pub struct Cli {
    #[command(flatten)]
    pub global: GlobalArgs,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Args, Clone, Debug)]
pub struct GlobalArgs {
    /// Registry source root. Defaults to the nearest local marketplace, then the cached GitHub repo.
    #[arg(long, global = true)]
    pub repo: Option<PathBuf>,

    /// Registry source strategy.
    #[arg(long, global = true, value_enum, default_value = "auto")]
    pub source: RegistrySource,

    /// Git ref to fetch when using --source latest or auto fallback.
    #[arg(long = "ref", global = true, default_value = "main")]
    pub git_ref: String,

    /// Refresh the cached GitHub registry checkout.
    #[arg(long, global = true)]
    pub refresh: bool,

    /// Output format.
    #[arg(short = 'o', long, global = true, value_enum, default_value = "text")]
    pub output: OutputFormat,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub enum OutputFormat {
    Text,
    Json,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Manage skills, hooks, and subagents for coding agents.
    Skills {
        #[command(subcommand)]
        command: SkillsCommand,
    },

    /// Manage plugin bundles for coding agents.
    #[cfg(feature = "plugins")]
    Plugins {
        #[command(subcommand)]
        command: PluginsCommand,
    },

    /// Save default agents for setup and audit flows.
    Agents(AgentsArgs),

    /// Configure a Claude Code statusline.
    Statusline {
        #[command(subcommand)]
        command: StatusLineCommand,
    },

    /// Check agent/tool availability.
    Doctor(DoctorArgs),

    /// Show memory, rules, instruction, and prompt files with approximate token counts.
    Memory(MemoryArgs),
}

#[derive(Subcommand)]
pub enum SkillsCommand {
    /// List installed skills across selected agents.
    List(ListArgs),

    /// Recommend skills from the current project and installed tools.
    Recommend(RecommendArgs),

    /// Set up Power BI Agentic Development repo skills.
    Setup(SetupArgs),

    /// Manage any already-installed skills across agents.
    Manage(ManageArgs),

    /// Add skills to one or more agents.
    Add(AddArgs),

    /// Open a skill file.
    Open(OpenSkillArgs),

    /// Check agent/tool availability.
    Doctor(DoctorArgs),
}

#[cfg(feature = "plugins")]
#[derive(Subcommand)]
pub enum PluginsCommand {
    /// List marketplace plugin bundles and included resources.
    List(ListArgs),

    /// Prompt-driven plugin setup flow.
    Setup(SetupArgs),

    /// Add plugin bundles to one or more agents.
    Add(AddArgs),
}

#[derive(Subcommand)]
pub enum StatusLineCommand {
    /// Interactive Claude Code statusline setup.
    Setup(StatusLineSetupArgs),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub enum StatusLineAgent {
    #[value(name = "claude-code", alias = "claude")]
    Claude,
}

impl StatusLineAgent {
    fn agent_kind(self) -> AgentKind {
        match self {
            StatusLineAgent::Claude => AgentKind::Claude,
        }
    }

    fn display_name(self) -> &'static str {
        self.agent_kind().display_name()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash)]
enum StatusLineInteraction {
    OpenPath,
    OpenLazygit,
    ResetDatetime,
}

#[derive(Args)]
pub struct ListArgs {
    /// Show descriptions and installation counts.
    #[arg(short = 'v', long, alias = "long")]
    pub verbose: bool,

    /// Agent skills to inspect. Repeatable. If omitted, detected agents are used.
    #[arg(long = "agent", value_enum)]
    pub agents: Vec<AgentKind>,
}

#[derive(Args)]
pub struct RecommendArgs {
    /// Directory to inspect.
    #[arg(default_value = ".")]
    pub path: PathBuf,
}

#[derive(Args)]
pub struct SetupArgs {
    /// Agent to configure. Repeatable. If omitted, detected agents are preselected.
    #[arg(long = "agent", value_enum)]
    pub agents: Vec<AgentKind>,

    /// Install into user-level config instead of the current project.
    #[arg(long, conflicts_with = "project")]
    pub user: bool,

    /// Install into the current project. This is the default.
    #[arg(long)]
    pub project: bool,

    /// Accept detected defaults and skip prompts.
    #[arg(short = 'y', long)]
    pub yes: bool,

    /// Use project/tool recommendations as initial selections.
    #[arg(long)]
    pub recommend: bool,

    /// Skills setup only: install skills detected on one selected agent for every selected agent.
    #[arg(long)]
    pub install_detected: bool,

    /// Preview actions without changing files or invoking agent CLIs.
    #[arg(long)]
    pub dry_run: bool,

    /// Execute native plugin CLI commands for Claude/Copilot. Without this, commands are printed.
    #[arg(long)]
    pub execute_native: bool,

    /// Place these skills at project level without opening the interactive selector.
    #[arg(long = "set-project", value_name = "SKILL")]
    pub set_project: Vec<String>,

    /// Place these skills at user level without opening the interactive selector.
    #[arg(long = "set-user", value_name = "SKILL")]
    pub set_user: Vec<String>,

    /// Uninstall these skills without opening the interactive selector.
    #[arg(long = "uninstall", value_name = "SKILL")]
    pub uninstall: Vec<String>,

    /// Move these installed skills into the pbiad deactivation cache.
    #[arg(long = "deactivate", value_name = "SKILL")]
    pub deactivate: Vec<String>,

    /// Keep these skills unchanged without opening the interactive selector.
    #[arg(long = "keep", value_name = "SKILL")]
    pub keep: Vec<String>,
}

#[derive(Args)]
pub struct ManageArgs {
    /// Agent skills to manage. Repeatable. If omitted, saved agents or detected agents are used.
    #[arg(long = "agent", value_enum)]
    pub agents: Vec<AgentKind>,

    /// Accept detected defaults and skip prompts.
    #[arg(short = 'y', long)]
    pub yes: bool,

    /// Preview actions without changing files.
    #[arg(long)]
    pub dry_run: bool,

    /// Place these skills at project level without opening the interactive selector.
    #[arg(long = "set-project", value_name = "SKILL")]
    pub set_project: Vec<String>,

    /// Place these skills at user level without opening the interactive selector.
    #[arg(long = "set-user", value_name = "SKILL")]
    pub set_user: Vec<String>,

    /// Uninstall these skills without opening the interactive selector.
    #[arg(long = "uninstall", value_name = "SKILL")]
    pub uninstall: Vec<String>,

    /// Move these installed skills into the pbiad deactivation cache.
    #[arg(long = "deactivate", value_name = "SKILL")]
    pub deactivate: Vec<String>,

    /// Keep these skills unchanged without opening the interactive selector.
    #[arg(long = "keep", value_name = "SKILL")]
    pub keep: Vec<String>,
}

#[derive(Args)]
pub struct AgentsArgs {
    /// Add an agent to the saved default agent list.
    #[arg(long = "add", value_enum)]
    pub add: Vec<AgentKind>,

    /// Remove an agent from the saved default agent list.
    #[arg(long = "remove", value_enum)]
    pub remove: Vec<AgentKind>,

    /// Clear saved agents and return setup flows to dynamic detection.
    #[arg(long)]
    pub clear: bool,
}

#[derive(Args)]
pub struct StatusLineSetupArgs {
    /// Agent to configure. Only Claude Code is supported for statuslines today.
    #[arg(long = "agent", value_enum)]
    pub agent: Option<StatusLineAgent>,

    /// Configure the user-level Claude Code settings file.
    #[arg(long, conflicts_with = "project")]
    pub user: bool,

    /// Configure the current project's .claude/settings.json.
    #[arg(long)]
    pub project: bool,

    /// Include a statusline component. Repeatable. If omitted, an interactive picker is shown.
    #[arg(long = "component", value_enum)]
    pub components: Vec<StatusLineComponent>,

    /// Usage-window visualization.
    #[arg(long = "meter-style", value_enum)]
    pub meter_style: Option<StatusLineMeterStyle>,

    /// Session context-window visualization.
    #[arg(long = "context-style", value_enum)]
    pub context_style: Option<StatusLineContextStyle>,

    /// Claude Code statusline refresh interval in seconds.
    #[arg(long = "refresh-interval")]
    pub refresh_interval: Option<u64>,

    /// Disable click-to-show reset details on 5h/weekly usage meters.
    #[arg(long = "no-clickable-resets")]
    pub no_clickable_resets: bool,

    /// Accept defaults and skip prompts.
    #[arg(short = 'y', long)]
    pub yes: bool,

    /// Preview actions without changing files.
    #[arg(long)]
    pub dry_run: bool,
}

#[derive(Args)]
pub struct AddArgs {
    /// Skill or plugin names to install, depending on the command group.
    pub names: Vec<String>,

    /// Agent to configure. Repeatable.
    #[arg(long = "agent", value_enum)]
    pub agents: Vec<AgentKind>,

    /// Install into user-level config instead of the current project.
    #[arg(long, conflicts_with = "project")]
    pub user: bool,

    /// Install into the current project. This is the default.
    #[arg(long)]
    pub project: bool,

    /// Preview actions without changing files or invoking agent CLIs.
    #[arg(long)]
    pub dry_run: bool,

    /// Execute native plugin CLI commands for Claude/Copilot. Without this, commands are printed.
    #[arg(long)]
    pub execute_native: bool,
}

#[derive(Args)]
pub struct OpenSkillArgs {
    /// Skill name to open. If omitted, a picker is shown in interactive terminals.
    pub name: Option<String>,
}

#[derive(Args, Clone)]
pub struct DoctorArgs {
    /// Directory to inspect.
    #[arg(default_value = ".")]
    pub path: PathBuf,

    /// Show every supported agent, including missing agents.
    #[arg(long)]
    pub all_agents: bool,
}

#[derive(Args, Clone)]
pub struct MemoryArgs {
    /// Directory to inspect.
    #[arg(default_value = ".")]
    pub path: PathBuf,

    /// Agent memory/rules to show. Repeatable. Shared files are included with selected agents.
    #[arg(long = "agent", value_enum)]
    pub agents: Vec<AgentKind>,

    /// Only include project-level files, not user-level memory and rules.
    #[arg(long)]
    pub project_only: bool,

    /// Pick a detected memory/rules file and open it in $VISUAL, $EDITOR, or the OS opener.
    #[arg(long)]
    pub open: bool,
}

pub fn skills_list(global: &GlobalArgs, args: ListArgs) -> Result<()> {
    let registry = load_registry(global)?;
    let cwd = std::env::current_dir()?;
    let inventory = detect_inventory(&cwd, global.output == OutputFormat::Text);
    let agents = selected_list_agents(&inventory, &args.agents, &cwd)?;

    if global.output == OutputFormat::Json {
        print_json(&skill_list_output(&registry, &inventory, &agents))?;
        return Ok(());
    }

    if args.verbose {
        print_verbose_skill_list(&registry, &inventory, &agents);
    } else {
        let (items, rows) = with_spinner(
            global.output == OutputFormat::Text,
            "Detecting installed skills and usage",
            "Detected installed skills and usage",
            || skill_manage_tree_items(&registry, &inventory, &agents, true),
        );
        print_skill_tree(&items, &rows, &agents);
    }
    Ok(())
}

fn print_skill_tree(items: &[SkillTreeItem], rows: &[SkillTreeRow], agents: &[AgentKind]) {
    println!("{}", style("Skills").bold());
    if items.is_empty() {
        println!("\n{}", style("No installed skills detected.").dim());
        return;
    }

    let layout = skill_list_layout(items, rows);
    let mut current_scope = None;
    for row in rows {
        match row {
            SkillTreeRow::Header {
                key,
                label,
                summary,
                other,
                level,
            } => {
                if key == "scope:User" {
                    current_scope = Some(InstallScope::User);
                    println!();
                } else if key == "scope:Project" {
                    current_scope = Some(InstallScope::Project);
                    println!();
                }
                let indent = "  ".repeat(*level);
                let label = if *other {
                    style(label).dim().to_string()
                } else {
                    style(label).yellow().bold().to_string()
                };
                let summary = if summary.is_empty() {
                    String::new()
                } else {
                    format!(" {}", style(summary).dim())
                };
                println!("{indent}{label}{summary}");
            }
            SkillTreeRow::Skill { item, last, level } => {
                let Some(scope) = current_scope else {
                    continue;
                };
                let skill = &items[*item];
                let name = pad_text(&skill.name, layout.name_width);
                let coverage = format!(
                    "{:<width$}",
                    list_skill_coverage(skill, scope),
                    width = layout.coverage_width
                );
                let files = format!(
                    "{:<width$}",
                    file_count_label(skill.file_count),
                    width = layout.files_width
                );
                println!(
                    "  {} {} {}  {}  {}  {}",
                    timeline_glyph(&skill_tree_skill_branch(*level, *last)),
                    list_skill_marker(skill, scope),
                    name,
                    style(coverage).dim(),
                    style(files).dim(),
                    style(last_used_label(skill.last_used)).dim()
                );
            }
        }
    }

    if agents.is_empty() {
        println!(
            "\n{}",
            style("Pass --agent to show installed status for a specific agent.").dim()
        );
    }
}

#[derive(Clone, Copy)]
struct SkillListLayout {
    name_width: usize,
    coverage_width: usize,
    files_width: usize,
}

fn skill_list_layout(items: &[SkillTreeItem], rows: &[SkillTreeRow]) -> SkillListLayout {
    let mut name_width = 0usize;
    let mut coverage_width = 0usize;
    let mut files_width = 0usize;
    let mut current_scope = None;
    for row in rows {
        match row {
            SkillTreeRow::Header { key, .. } if key == "scope:User" => {
                current_scope = Some(InstallScope::User);
            }
            SkillTreeRow::Header { key, .. } if key == "scope:Project" => {
                current_scope = Some(InstallScope::Project);
            }
            SkillTreeRow::Skill { item, .. } => {
                let Some(scope) = current_scope else {
                    continue;
                };
                let skill = &items[*item];
                name_width = name_width.max(measure_text_width(&skill.name));
                coverage_width =
                    coverage_width.max(measure_text_width(&list_skill_coverage(skill, scope)));
                files_width =
                    files_width.max(measure_text_width(&file_count_label(skill.file_count)));
            }
            _ => {}
        }
    }
    SkillListLayout {
        name_width,
        coverage_width,
        files_width,
    }
}

fn list_skill_marker(skill: &SkillTreeItem, scope: InstallScope) -> String {
    let installed = match scope {
        InstallScope::Project => skill.project_installed,
        InstallScope::User => skill.user_installed,
    };
    let deactivated = match scope {
        InstallScope::Project => skill.project_deactivated,
        InstallScope::User => skill.user_deactivated,
    };
    if installed >= skill.agent_count && skill.agent_count > 0 {
        match scope {
            InstallScope::Project => style("●").green().bold().to_string(),
            InstallScope::User => style("◆").green().bold().to_string(),
        }
    } else if installed > 0 {
        match scope {
            InstallScope::Project => style("●").yellow().bold().to_string(),
            InstallScope::User => style("◆").yellow().bold().to_string(),
        }
    } else if deactivated > 0 {
        style("◌").blue().bold().to_string()
    } else {
        style("○").dim().to_string()
    }
}

fn list_skill_coverage(skill: &SkillTreeItem, scope: InstallScope) -> String {
    let installed = match scope {
        InstallScope::Project => skill.project_installed,
        InstallScope::User => skill.user_installed,
    };
    let deactivated = match scope {
        InstallScope::Project => skill.project_deactivated,
        InstallScope::User => skill.user_deactivated,
    };
    if installed > 0 {
        format!("({}/{})", installed, skill.agent_count)
    } else if deactivated > 0 {
        format!("(deactivated {}/{})", deactivated, skill.agent_count)
    } else {
        String::new()
    }
}

fn file_count_label(files: usize) -> String {
    if files == 1 {
        "1 file".to_string()
    } else {
        format!("{files} files")
    }
}

fn pad_text(text: &str, width: usize) -> String {
    let padding = width.saturating_sub(measure_text_width(text));
    format!("{text}{}", " ".repeat(padding))
}

fn print_verbose_skill_list(registry: &Registry, inventory: &Inventory, agents: &[AgentKind]) {
    let plugins = detected_skill_plugins(registry, inventory, agents);
    let mut entries = installed_skill_entries(inventory, agents);
    entries.sort_by(|left, right| {
        left.scope
            .cmp(&right.scope)
            .then_with(|| {
                list_entry_plugin(&plugins, left.resource.name.as_str())
                    .cmp(&list_entry_plugin(&plugins, right.resource.name.as_str()))
            })
            .then_with(|| left.resource.name.cmp(&right.resource.name))
            .then_with(|| left.agent.cmp(&right.agent))
    });

    println!("{}", style("Skills").bold());
    if entries.is_empty() {
        println!("\n{}", style("No installed skills detected.").dim());
        return;
    }

    for entry in entries {
        let plugin = list_entry_plugin(&plugins, &entry.resource.name);
        let state = if entry.deactivated {
            style("deactivated").blue().to_string()
        } else {
            style("installed").green().to_string()
        };
        println!(
            "\n{} {} {} {}",
            style(&entry.resource.name).yellow(),
            style(format!("({plugin})")).dim(),
            style(format!("[{} {}]", entry.scope, entry.agent.display_name())).dim(),
            state
        );
        println!("  {}", entry.resource.path.display());
    }
}

#[cfg(feature = "plugins")]
pub fn plugins_list(global: &GlobalArgs, args: ListArgs) -> Result<()> {
    let registry = load_registry(global)?;
    if global.output == OutputFormat::Json {
        print_json(&plugin_list_output(&registry))?;
        return Ok(());
    }

    println!(
        "{} {}{}",
        style("Marketplace").bold(),
        registry.name,
        registry
            .version
            .as_ref()
            .map(|version| format!(" ({version})"))
            .unwrap_or_default()
    );
    for plugin in &registry.plugins {
        println!(
            "\n{} - {}",
            style(&plugin.name).cyan(),
            plugin.description.trim()
        );
        println!("  {}", plugin.component_summary());
        if args.verbose {
            for skill in plugin
                .skills
                .iter()
                .filter(|skill| !is_deprecated_skill(&skill.name))
            {
                println!("  skill     {:<28} {}", skill.name, skill.description);
            }
            for agent in &plugin.agents {
                println!("  subagent  {:<28} {}", agent.name, agent.description);
            }
            if let Some(hooks) = &plugin.hooks {
                println!("  hooks     {}", hooks.display());
            }
        }
    }
    Ok(())
}

pub fn skills_recommend(global: &GlobalArgs, args: RecommendArgs) -> Result<()> {
    let registry = load_registry(global)?;
    let signals = EnvironmentSignals::detect(&args.path);
    let recs = recommend(&registry, &signals);

    if global.output == OutputFormat::Json {
        print_json(&RecommendOutput {
            signals,
            recommendations: recs,
        })?;
        return Ok(());
    }

    print_recommendations(&recs);
    Ok(())
}

pub fn skills_setup(global: &GlobalArgs, args: SetupArgs) -> Result<()> {
    let registry = load_registry(global)?;
    let placement_overrides = setup_placement_overrides(&args)?;
    validate_setup_placement_overrides(&registry, &placement_overrides)?;
    let has_placement_overrides = !placement_overrides.is_empty();
    let cwd = std::env::current_dir()?;
    let signals = EnvironmentSignals::detect(&cwd);
    let recs = if args.recommend {
        recommend(&registry, &signals)
    } else {
        Vec::new()
    };
    let inventory = detect_inventory(&cwd, !args.yes && global.output == OutputFormat::Text);
    let default_scope = detect_scope(args.user, args.project, &signals, &inventory);

    let agents = selected_setup_agents(&inventory, &args.agents, &cwd, args.yes)?;
    if agents.is_empty() {
        return Err(anyhow!("no agents selected"));
    }

    let mut selection = if args.yes || has_placement_overrides {
        default_skill_setup_selection(
            &registry,
            &recs,
            &inventory,
            &agents,
            default_scope,
            args.install_detected,
        )
    } else {
        prompt_skills(
            &registry,
            &recs,
            &inventory,
            &agents,
            default_scope,
            args.install_detected,
        )?
    };
    if has_placement_overrides {
        let override_names = placement_overrides
            .iter()
            .map(|placement| placement.name.as_str())
            .collect::<BTreeSet<_>>();
        selection.preserve_skills = registry_skill_names(&registry)
            .into_iter()
            .filter(|name| !override_names.contains(name.as_str()))
            .collect();
        apply_placement_overrides(&mut selection.placements, placement_overrides);
    }
    let changes = skill_change_counts(
        &registry,
        &inventory,
        &agents,
        &selection.placements,
        &selection.preserve_skills,
    );
    if changes.is_empty() {
        println!("No skill changes selected.");
        return Ok(());
    }

    if !args.yes && !has_placement_overrides {
        let prompt = format!(
            "Apply skill changes for {} agent(s)? install {}, remove {}",
            agents.len(),
            changes.install,
            changes.remove
        );
        if !cliclack::confirm(&prompt).initial_value(true).interact()? {
            return Ok(());
        }
    }

    let request = SkillSyncRequest {
        agents,
        placements: selection.placements,
        preserve_skills: selection.preserve_skills,
        dry_run: args.dry_run,
    };
    let report = install::sync_skills(&registry, &request)?;
    output_install_report(global, &report)
}

pub fn skills_manage(global: &GlobalArgs, args: ManageArgs) -> Result<()> {
    let registry = load_registry(global)?;
    let placement_overrides = manage_placement_overrides(&args)?;
    let has_placement_overrides = !placement_overrides.is_empty();
    let cwd = std::env::current_dir()?;
    let inventory = detect_inventory(&cwd, !args.yes && global.output == OutputFormat::Text);
    let agents = selected_setup_agents(&inventory, &args.agents, &cwd, args.yes)?;
    if agents.is_empty() {
        return Err(anyhow!("no agents selected"));
    }

    let (items, plugins) = with_spinner(
        !args.yes && global.output == OutputFormat::Text,
        "Detecting installed skills and usage",
        "Detected installed skills and usage",
        || skill_manage_items(&registry, &inventory, &agents, !args.yes),
    );
    if items.is_empty() {
        println!("No installed skills detected.");
        return Ok(());
    }
    validate_manage_placement_overrides(&registry, &inventory, &agents, &placement_overrides)?;

    if !args.yes && !has_placement_overrides && std::io::stderr().is_terminal() {
        let partial_count = items
            .iter()
            .filter(|item| item.installed_on_one_agent())
            .count();
        let note = if partial_count == 0 {
            style("No skills are installed on only one agent.")
                .dim()
                .to_string()
        } else {
            warning_text(&format!(
                "{} skills are installed on only one agent",
                partial_count
            ))
        };
        cliclack::note(format!("Detected {} skills.", items.len()), note)?;
    }

    let defaults = items
        .iter()
        .map(|item| SkillPlacement {
            name: item.name.clone(),
            target: SkillPlacementTarget::Keep,
        })
        .collect::<Vec<_>>();
    let mut selection = if args.yes || has_placement_overrides {
        SkillTreeSelection {
            placements: defaults,
        }
    } else {
        let initial = defaults
            .iter()
            .map(|placement| (placement.name.clone(), placement.target))
            .collect::<BTreeMap<_, _>>();
        let rows = manage_tree_rows(&items, &plugins, &initial);
        prompt_skill_tree(
            &items,
            &rows,
            &defaults,
            SkillTreePromptMode::Manage,
            Some(&plugins),
        )?
    };
    if has_placement_overrides {
        apply_placement_overrides(&mut selection.placements, placement_overrides);
    }
    let changes = skill_change_counts(&registry, &inventory, &agents, &selection.placements, &[]);
    if changes.is_empty() {
        println!("No skill changes selected.");
        return Ok(());
    }

    if !args.yes && !has_placement_overrides {
        let prompt = format!(
            "Apply skill changes for {} agent(s)? install {}, remove {}",
            agents.len(),
            changes.install,
            changes.remove
        );
        if !cliclack::confirm(&prompt).initial_value(true).interact()? {
            return Ok(());
        }
    }

    let request = SkillSyncRequest {
        agents,
        placements: selection.placements,
        preserve_skills: Vec::new(),
        dry_run: args.dry_run,
    };
    let report = install::sync_skills(&registry, &request)?;
    output_install_report(global, &report)
}

#[cfg(feature = "plugins")]
pub fn plugins_setup(global: &GlobalArgs, args: SetupArgs) -> Result<()> {
    if args.install_detected {
        return Err(anyhow!(
            "--install-detected is only supported by `pbiad skills setup`"
        ));
    }
    if setup_has_placement_overrides(&args) {
        return Err(anyhow!(
            "skill placement flags are only supported by `pbiad skills setup`"
        ));
    }

    let registry = load_registry(global)?;
    let cwd = std::env::current_dir()?;
    let signals = EnvironmentSignals::detect(&cwd);
    let recs = if args.recommend {
        recommend(&registry, &signals)
    } else {
        Vec::new()
    };
    let inventory = detect_inventory(&cwd, !args.yes && global.output == OutputFormat::Text);
    let install_scope = detect_scope(args.user, args.project, &signals, &inventory);

    let agents = selected_setup_agents(&inventory, &args.agents, &cwd, args.yes)?;
    if agents.is_empty() {
        return Err(anyhow!("no agents selected"));
    }

    let plugin_names = if args.yes {
        recs.iter()
            .map(|rec| rec.plugin.clone())
            .collect::<Vec<_>>()
    } else {
        prompt_plugins(&registry, &recs, &inventory, &agents, install_scope)?
    };
    if plugin_names.is_empty() {
        println!("No plugin changes selected.");
        return Ok(());
    }

    if !args.yes {
        let prompt = format!(
            "Install {} plugin bundle(s) for {} agent(s)?",
            plugin_names.len(),
            agents.len()
        );
        if !cliclack::confirm(&prompt).initial_value(true).interact()? {
            return Ok(());
        }
    }

    let request = InstallRequest {
        agents,
        plugin_names,
        scope: install_scope,
        dry_run: args.dry_run,
        execute_native: args.execute_native,
    };
    install::preflight_dirs(&request)?;
    let report = install::install(&registry, &request)?;
    output_install_report(global, &report)
}

pub fn skills_add(global: &GlobalArgs, args: AddArgs) -> Result<()> {
    if args.names.is_empty() {
        return Err(anyhow!("provide at least one plugin or skill name"));
    }
    let registry = load_registry(global)?;
    validate_skill_names(&registry, &args.names)?;
    let cwd = std::env::current_dir()?;
    let signals = EnvironmentSignals::detect(&cwd);
    let inventory = detect_inventory(&cwd, global.output == OutputFormat::Text);
    let agents = if args.agents.is_empty() {
        detected_agents(&cwd)
    } else {
        args.agents
    };
    if agents.is_empty() {
        return Err(anyhow!(
            "no agents selected or detected; pass --agent codex, --agent claude, etc."
        ));
    }

    let request = InstallRequest {
        agents,
        plugin_names: args.names,
        scope: detect_scope(args.user, args.project, &signals, &inventory),
        dry_run: args.dry_run,
        execute_native: args.execute_native,
    };
    install::preflight_dirs(&request)?;
    let report = install::install_skills(&registry, &request)?;
    output_install_report(global, &report)
}

pub fn skills_open(global: &GlobalArgs, args: OpenSkillArgs) -> Result<()> {
    let registry = load_registry(global)?;
    let skill = if let Some(name) = args.name {
        if is_deprecated_skill(&name) {
            return Err(anyhow!("{} is deprecated; use `te-cli` instead", name));
        }
        registry
            .skill(&name)
            .ok_or_else(|| anyhow!("unknown skill: {}", name))?
            .1
    } else {
        if !std::io::stderr().is_terminal() {
            return Err(anyhow!(
                "provide a skill name when not running interactively"
            ));
        }
        let skills = registry
            .skills()
            .filter(|(_, skill)| !is_deprecated_skill(&skill.name))
            .collect::<Vec<_>>();
        let mut prompt = cliclack::select("Open which skill?")
            .filter_mode()
            .max_rows(14);
        for (idx, (plugin, skill)) in skills.iter().enumerate() {
            prompt = prompt.item(idx, &skill.name, &plugin.name);
        }
        let idx = prompt.interact()?;
        skills[idx].1
    };

    open_file(&skill.path)
}

#[cfg(feature = "plugins")]
pub fn plugins_add(global: &GlobalArgs, args: AddArgs) -> Result<()> {
    if args.names.is_empty() {
        return Err(anyhow!("provide at least one plugin bundle name"));
    }
    let registry = load_registry(global)?;
    validate_plugin_names(&registry, &args.names)?;
    let cwd = std::env::current_dir()?;
    let signals = EnvironmentSignals::detect(&cwd);
    let inventory = detect_inventory(&cwd, global.output == OutputFormat::Text);
    let agents = if args.agents.is_empty() {
        detected_agents(&cwd)
    } else {
        args.agents
    };
    if agents.is_empty() {
        return Err(anyhow!(
            "no agents selected or detected; pass --agent codex, --agent claude, etc."
        ));
    }

    let request = InstallRequest {
        agents,
        plugin_names: args.names,
        scope: detect_scope(args.user, args.project, &signals, &inventory),
        dry_run: args.dry_run,
        execute_native: args.execute_native,
    };
    install::preflight_dirs(&request)?;
    let report = install::install(&registry, &request)?;
    output_install_report(global, &report)
}

pub fn skills_doctor(global: &GlobalArgs, args: DoctorArgs) -> Result<()> {
    let signals = EnvironmentSignals::detect(&args.path);
    let inventory = detect_inventory(&args.path, global.output == OutputFormat::Text);
    let memory = detect_memory_inventory(&args.path, true, global.output == OutputFormat::Text)?;
    let statuses = AgentKind::ALL
        .into_iter()
        .map(|agent| agent.status_at(&args.path))
        .collect::<Vec<_>>();

    if global.output == OutputFormat::Json {
        print_json(&DoctorOutput {
            agents: statuses,
            signals,
            inventory,
            memory,
        })?;
        return Ok(());
    }

    println!("{}", style("Agents").bold());
    for agent_inventory in inventory.visible_agents(args.all_agents) {
        let status = &agent_inventory.status;
        println!(
            "  {:<22} {:<10} project={:>2} skills/{:>2} subagents  user={:>2} skills/{:>2} subagents  hooks={:?}",
            status.agent.display_name(),
            if status.installed {
                "found"
            } else if status.configured {
                "configured"
            } else {
                "missing"
            },
            agent_inventory.skill_count(InstallScope::Project),
            agent_inventory.subagent_count(InstallScope::Project),
            agent_inventory.skill_count(InstallScope::User),
            agent_inventory.subagent_count(InstallScope::User),
            status.hooks
        );
    }
    if !args.all_agents {
        println!(
            "  {}",
            style("Use --all-agents to show missing supported agents.").dim()
        );
    }

    println!("\n{}", style("Project").bold());
    println!(
        "  .pbip={} .Report={} .SemanticModel={} .tmdl={} .rdl={} notebooks={}",
        signals.project.pbip_files,
        signals.project.report_dirs,
        signals.project.semantic_model_dirs,
        signals.project.tmdl_files,
        signals.project.rdl_files,
        signals.project.notebook_files
    );

    println!("\n{}", style("Tools").bold());
    println!(
        "  pbir={} te={} fab={} az={} sqlcmd={} pwsh={}",
        yes_no(signals.tools.pbir),
        yes_no(signals.tools.te),
        yes_no(signals.tools.fab),
        yes_no(signals.tools.az),
        yes_no(signals.tools.sqlcmd),
        yes_no(signals.tools.pwsh)
    );

    print_memory_summary(&memory);

    Ok(())
}

pub fn memory(global: &GlobalArgs, args: MemoryArgs) -> Result<()> {
    let inventory = detect_memory_inventory(
        &args.path,
        !args.project_only,
        global.output == OutputFormat::Text,
    )?;
    let agents = selected_memory_agents(&inventory, &args.agents)?;
    let entries = filter_memory_entries(&inventory.entries, &agents);
    let filtered = MemoryInventory {
        total_approx_tokens: entries.iter().map(|entry| entry.approx_tokens).sum(),
        entries,
    };

    if global.output == OutputFormat::Json {
        print_json(&filtered)?;
        return Ok(());
    }

    print_memory_inventory(&filtered, &args.path);
    if args.open {
        open_memory_entry(&filtered)?;
    }
    Ok(())
}

fn load_registry(global: &GlobalArgs) -> Result<Registry> {
    let cwd = std::env::current_dir()?;
    let root = resolve_registry_root(
        &cwd,
        &SourceOptions {
            repo: global.repo.clone(),
            source: global.source,
            git_ref: global.git_ref.clone(),
            refresh: global.refresh,
        },
    )?;
    Registry::load(root)
}

fn detect_inventory(project_root: &Path, show_spinner: bool) -> Inventory {
    if show_spinner && std::io::stderr().is_terminal() {
        let spinner = cliclack::spinner();
        spinner.start("Detecting installed agents and plugins");
        let inventory = Inventory::detect(project_root);
        spinner.clear();
        print_detected_inventory_agents(&inventory);
        inventory
    } else {
        Inventory::detect(project_root)
    }
}

fn detect_memory_inventory(
    project_root: &Path,
    include_user: bool,
    show_spinner: bool,
) -> Result<MemoryInventory> {
    with_spinner(
        show_spinner,
        "Detecting memory and rules",
        "Detected memory and rules",
        || MemoryInventory::detect(project_root, include_user),
    )
}

fn with_spinner<T>(show_spinner: bool, start: &str, done: &str, f: impl FnOnce() -> T) -> T {
    if show_spinner && std::io::stderr().is_terminal() {
        let spinner = cliclack::spinner();
        spinner.start(start);
        let value = f();
        spinner.stop(done);
        value
    } else {
        f()
    }
}

fn print_detected_inventory_agents(inventory: &Inventory) {
    let agents = inventory
        .visible_agents(false)
        .into_iter()
        .filter(|agent_inventory| agent_is_found(agent_inventory))
        .map(|agent_inventory| agent_inventory.status.agent.display_name())
        .collect::<Vec<_>>();

    eprintln!("{}  Detected installed agents", timeline_symbol("◇"));
    if agents.is_empty() {
        eprintln!(
            "{}  {}",
            timeline_symbol("│"),
            style("No installed agents detected").dim()
        );
    } else {
        for agent in agents {
            eprintln!("{}  {}", timeline_symbol("│"), style(agent).dim());
        }
    }
    eprintln!("{}", timeline_symbol("│"));
}

fn detect_scope(
    user: bool,
    project: bool,
    signals: &EnvironmentSignals,
    inventory: &Inventory,
) -> InstallScope {
    if user {
        return InstallScope::User;
    }
    if project {
        return InstallScope::Project;
    }
    let in_git_repo = std::env::current_dir()
        .map(|cwd| cwd.join(".git").exists())
        .unwrap_or(false);
    let has_project_agent_resources = inventory
        .agents
        .iter()
        .any(|agent_inventory| agent_inventory.has_project_resources());
    if signals.project.has_pbip() || in_git_repo || has_project_agent_resources {
        InstallScope::Project
    } else {
        InstallScope::User
    }
}

fn detected_agents(project_root: &Path) -> Vec<AgentKind> {
    AgentKind::POPULAR
        .into_iter()
        .filter(|agent| agent.is_detected_at(project_root))
        .collect()
}

fn selected_list_agents(
    inventory: &Inventory,
    requested: &[AgentKind],
    project_root: &Path,
) -> Result<Vec<AgentKind>> {
    if !requested.is_empty() {
        return Ok(requested.to_vec());
    }
    if let Some(agents) = config::configured_agents()? {
        return Ok(agents);
    }
    if std::io::stderr().is_terminal() {
        return prompt_agents(inventory, requested);
    }
    Ok(detected_agents(project_root))
}

fn selected_setup_agents(
    inventory: &Inventory,
    requested: &[AgentKind],
    project_root: &Path,
    yes: bool,
) -> Result<Vec<AgentKind>> {
    if !requested.is_empty() {
        return Ok(requested.to_vec());
    }
    if let Some(agents) = config::configured_agents()? {
        return Ok(agents);
    }
    if yes {
        return Ok(detected_agents(project_root));
    }
    prompt_agents(inventory, requested)
}

pub fn agents(args: AgentsArgs) -> Result<()> {
    if args.clear {
        let path = config::clear_agents()?;
        println!("Cleared saved agents at {}.", path.display());
        return Ok(());
    }

    let interactive_save = args.add.is_empty() && args.remove.is_empty();
    let mut agents = config::configured_agents()?.unwrap_or_default();
    for agent in args.add {
        if !agents.contains(&agent) {
            agents.push(agent);
        }
    }
    for agent in args.remove {
        agents.retain(|existing| *existing != agent);
    }

    if interactive_save && std::io::stderr().is_terminal() {
        let cwd = std::env::current_dir()?;
        let inventory = detect_inventory(&cwd, true);
        agents = prompt_agents(&inventory, &agents)?;
    }

    if agents.is_empty() {
        let path = config::clear_agents()?;
        println!(
            "No agents saved. Dynamic detection remains enabled at {}.",
            path.display()
        );
        return Ok(());
    }

    agents.sort();
    let path = config::save_agents(&agents)?;
    println!(
        "Saved {} agent(s) to {}: {}",
        agents.len(),
        path.display(),
        agents
            .iter()
            .map(|agent| agent.display_name())
            .collect::<Vec<_>>()
            .join(", ")
    );
    Ok(())
}

pub fn statusline_setup(global: &GlobalArgs, args: StatusLineSetupArgs) -> Result<()> {
    let cwd = std::env::current_dir()?;
    let registry_root = resolve_statusline_registry_root(global, &cwd)?;
    let interactive = !args.yes && std::io::stderr().is_terminal();

    let agent = selected_statusline_agent(args.agent, interactive)?;
    let scope = selected_statusline_scope(args.user, args.project, interactive)?;
    let components = selected_statusline_components(&args.components, interactive)?;
    if components.is_empty() {
        println!("No statusline components selected.");
        return Ok(());
    }
    let options = selected_statusline_options(&args, &components, interactive)?;

    let request = StatusLineInstallRequest {
        registry_root,
        project_root: cwd,
        agent,
        scope,
        components,
        options,
        dry_run: args.dry_run,
    };
    let report = statusline::install_statusline(&request)?;

    if global.output == OutputFormat::Json {
        print_json(&report)?;
    } else {
        print_statusline_report(&report);
    }
    Ok(())
}

fn resolve_statusline_registry_root(global: &GlobalArgs, cwd: &Path) -> Result<PathBuf> {
    resolve_registry_root(
        cwd,
        &SourceOptions {
            repo: global.repo.clone(),
            source: global.source,
            git_ref: global.git_ref.clone(),
            refresh: global.refresh,
        },
    )
}

fn selected_statusline_agent(
    requested: Option<StatusLineAgent>,
    interactive: bool,
) -> Result<AgentKind> {
    if let Some(agent) = requested {
        return Ok(agent.agent_kind());
    }

    if !interactive {
        return Ok(AgentKind::Claude);
    }

    let agent = cliclack::select("Which agent should use this statusline?")
        .item(
            StatusLineAgent::Claude,
            StatusLineAgent::Claude.display_name(),
            "enabled",
        )
        .interact()?;
    Ok(agent.agent_kind())
}

fn selected_statusline_scope(user: bool, project: bool, interactive: bool) -> Result<InstallScope> {
    if user {
        return Ok(InstallScope::User);
    }
    if project {
        return Ok(InstallScope::Project);
    }
    if !interactive {
        return Ok(InstallScope::User);
    }

    Ok(
        cliclack::select("Where should Claude Code read this statusline from?")
            .item(
                InstallScope::User,
                "User settings",
                "~/.claude/settings.json",
            )
            .item(
                InstallScope::Project,
                "Project settings",
                ".claude/settings.json in this repo",
            )
            .interact()?,
    )
}

fn selected_statusline_components(
    requested: &[StatusLineComponent],
    interactive: bool,
) -> Result<Vec<StatusLineComponent>> {
    if !requested.is_empty() {
        return Ok(normalize_statusline_components(requested));
    }
    let defaults = statusline::default_components();
    if !interactive {
        return Ok(defaults);
    }

    let mut components = Vec::new();
    if cliclack::confirm("Do you want to show the time?")
        .initial_value(true)
        .interact()?
    {
        components.push(StatusLineComponent::Time);
    }
    if cliclack::confirm("Do you want to show the current folder?")
        .initial_value(true)
        .interact()?
    {
        components.push(StatusLineComponent::Folder);
    }

    let git_defaults = vec![
        StatusLineComponent::Branch,
        StatusLineComponent::Commits,
        StatusLineComponent::Pulls,
        StatusLineComponent::TrackedFiles,
        StatusLineComponent::LocChanges,
    ];
    let mut git_prompt = cliclack::multiselect("What Git metrics are important for you?")
        .required(false)
        .max_rows(8);
    for component in git_defaults.iter().copied() {
        git_prompt = git_prompt.item(component, component.label(), component.hint());
    }
    components.extend(git_prompt.initial_values(git_defaults).interact()?);

    let model_defaults = vec![
        StatusLineComponent::Model,
        StatusLineComponent::ModelVersion,
        StatusLineComponent::Effort,
    ];
    let mut model_prompt = cliclack::multiselect("Do you want to see what model you're using?")
        .required(false)
        .max_rows(6);
    for component in model_defaults.iter().copied() {
        model_prompt = model_prompt.item(component, component.label(), component.hint());
    }
    let mut model_components = model_prompt.initial_values(model_defaults).interact()?;
    if model_components.contains(&StatusLineComponent::ModelVersion)
        && !model_components.contains(&StatusLineComponent::Model)
    {
        model_components.push(StatusLineComponent::Model);
    }
    components.extend(model_components);

    let usage_defaults = vec![
        StatusLineComponent::Context,
        StatusLineComponent::FiveHourLimit,
        StatusLineComponent::WeeklyLimit,
    ];
    let mut usage_prompt = cliclack::multiselect("Do you want to see usage limits?")
        .required(false)
        .max_rows(6);
    for component in usage_defaults.iter().copied() {
        usage_prompt = usage_prompt.item(component, component.label(), component.hint());
    }
    components.extend(usage_prompt.initial_values(usage_defaults).interact()?);

    Ok(normalize_statusline_components(&components))
}

fn selected_statusline_options(
    args: &StatusLineSetupArgs,
    components: &[StatusLineComponent],
    interactive: bool,
) -> Result<StatusLineOptions> {
    let mut options = StatusLineOptions::default();
    if let Some(style) = args.meter_style {
        options.meter_style = style;
    }
    if let Some(style) = args.context_style {
        options.context_style = style;
    }
    if let Some(refresh_interval) = args.refresh_interval {
        statusline::validate_refresh_interval(refresh_interval)?;
        options.refresh_interval = refresh_interval;
    }
    if args.no_clickable_resets {
        options.clickable_resets = false;
    }

    let has_limits = components.contains(&StatusLineComponent::FiveHourLimit)
        || components.contains(&StatusLineComponent::WeeklyLimit)
        || components.contains(&StatusLineComponent::Context);

    if args.context_style.is_none() && has_limits {
        options.context_style = match options.meter_style {
            StatusLineMeterStyle::Label => StatusLineContextStyle::Percent,
            _ => StatusLineContextStyle::Bar,
        };
    }

    if interactive {
        if has_limits && args.meter_style.is_none() {
            options.meter_style = prompt_statusline_meter_style()?;
            options.context_style = match options.meter_style {
                StatusLineMeterStyle::Label => StatusLineContextStyle::Percent,
                _ => StatusLineContextStyle::Bar,
            };
        }
        if args.refresh_interval.is_none() {
            options.refresh_interval = prompt_statusline_refresh_interval()?;
        }
        let interactions = prompt_statusline_interactions(has_limits)?;
        options.click_open_paths = interactions.contains(&StatusLineInteraction::OpenPath);
        options.click_open_lazygit = interactions.contains(&StatusLineInteraction::OpenLazygit);
        options.clickable_resets = interactions.contains(&StatusLineInteraction::ResetDatetime)
            && !args.no_clickable_resets;
        if !has_limits {
            options.clickable_resets = false;
        }
    } else if !has_limits {
        options.clickable_resets = false;
    }

    Ok(options)
}

fn prompt_statusline_meter_style() -> Result<StatusLineMeterStyle> {
    Ok(cliclack::select("How do you want to visualize limits?")
        .item(
            StatusLineMeterStyle::Steps,
            "Label and bars",
            "20% increment bands",
        )
        .item(
            StatusLineMeterStyle::FullBar,
            "Label and bars",
            "fills continuously to 100%",
        )
        .item(
            StatusLineMeterStyle::ThinBar,
            "Label and thin bar",
            "thin fill to 100%",
        )
        .item(
            StatusLineMeterStyle::Label,
            "Label only",
            "no bar visualization",
        )
        .interact()?)
}

fn prompt_statusline_refresh_interval() -> Result<u64> {
    Ok(
        cliclack::select("How often should Claude refresh the statusline?")
            .item(60, "60 seconds", "quiet default")
            .item(15, "15 seconds", "more current git and usage state")
            .item(5, "5 seconds", "responsive without constant redraws")
            .item(1, "1 second", "best for clickable reset toggles")
            .interact()?,
    )
}

fn prompt_statusline_interactions(has_limits: bool) -> Result<BTreeSet<StatusLineInteraction>> {
    let mut defaults = vec![StatusLineInteraction::OpenPath];
    if has_limits {
        defaults.push(StatusLineInteraction::ResetDatetime);
    }
    let mut prompt = cliclack::multiselect("Do you want interactions (OSC 8)?")
        .required(false)
        .max_rows(6)
        .item(
            StatusLineInteraction::OpenPath,
            "Click to open filepath",
            "cwd/file links use your terminal handler",
        )
        .item(
            StatusLineInteraction::OpenLazygit,
            "Click to open lazygit",
            "branch opens lazygit for the repo",
        );
    if has_limits {
        prompt = prompt.item(
            StatusLineInteraction::ResetDatetime,
            "Click for reset datetime",
            "5h and weekly limits reveal reset time",
        );
    }
    Ok(prompt
        .initial_values(defaults)
        .interact()?
        .into_iter()
        .collect())
}

fn normalize_statusline_components(components: &[StatusLineComponent]) -> Vec<StatusLineComponent> {
    components
        .iter()
        .copied()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn print_statusline_report(report: &statusline::StatusLineInstallReport) {
    let action = if report.dry_run {
        "Would configure"
    } else {
        "Configured"
    };
    println!(
        "{} {} statusline for {}.",
        action,
        report.scope,
        report.agent.display_name()
    );
    println!("  Settings: {}", report.settings_path.display());
    println!("  Script:   {}", report.script_path.display());
    println!("  Config:   {}", report.config_path.display());
    println!("  Command:  {}", report.command);
    println!(
        "  Components: {}",
        report
            .components
            .iter()
            .map(|component| component.label())
            .collect::<Vec<_>>()
            .join(", ")
    );
    println!(
        "  Options: {}, context {}, refresh {}s, path links {}, lazygit links {}, reset links {}",
        report.options.meter_style.label(),
        report.options.context_style.label(),
        report.options.refresh_interval,
        yes_no(report.options.click_open_paths),
        yes_no(report.options.click_open_lazygit),
        yes_no(report.options.clickable_resets)
    );
    if report.dry_run {
        println!("  Files planned: {}", report.files_copied);
    } else {
        println!("  Files copied: {}", report.files_copied);
        println!("Reload Claude Code for the new statusline to take effect.");
    }
}

fn short_words(value: &str, max_words: usize) -> String {
    let words = value.split_whitespace().take(max_words).collect::<Vec<_>>();
    let mut summary = words.join(" ");
    if value.split_whitespace().count() > max_words {
        summary.push_str("...");
    }
    summary
}

fn warning_text(message: &str) -> String {
    format!(
        "{} {}",
        style(WARNING_SYMBOL).red().bold(),
        style(message).red()
    )
}

fn warning_list_item(message: &str) -> String {
    format!(
        "{} {}",
        style(WARNING_SYMBOL).red().bold(),
        style(message).dim()
    )
}

fn timeline_symbol(symbol: &str) -> String {
    style(symbol).cyan().to_string()
}

fn timeline_glyph(glyph: &str) -> String {
    glyph.to_string()
}

fn cursor_glyph() -> String {
    style(">").white().bold().to_string()
}

#[derive(Clone, Debug, Default)]
struct SkillUsageIndex {
    last_used: BTreeMap<String, SkillUsage>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct SkillUsage {
    last_used: SystemTime,
    kind: SkillUsageKind,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
enum SkillUsageKind {
    Structured,
    DirectInvocation,
}

impl SkillUsageIndex {
    fn detect(skill_names: &BTreeSet<String>) -> Self {
        if skill_names.is_empty() {
            return Self::default();
        }

        let mut index = Self::default();
        let mut candidates = Vec::new();
        for root in jsonl_history_roots() {
            if !root.path.is_dir() {
                continue;
            }
            for entry in WalkDir::new(&root.path)
                .max_depth(root.max_depth)
                .follow_links(false)
                .into_iter()
                .take(MAX_USAGE_HISTORY_FILES * 20)
                .filter_map(Result::ok)
                .filter(|entry| {
                    entry.file_type().is_file()
                        && entry.path().extension().and_then(|ext| ext.to_str()) == Some("jsonl")
                })
            {
                let path = entry.path();
                let Ok(metadata) = fs::metadata(path) else {
                    continue;
                };
                if metadata.len() > MAX_USAGE_HISTORY_FILE_BYTES {
                    continue;
                }
                let Ok(modified) = metadata.modified() else {
                    continue;
                };
                candidates.push((modified, metadata.len(), path.to_path_buf()));
            }
        }

        candidates.sort_by(|left, right| right.0.cmp(&left.0));
        let mut scanned_files = 0usize;
        let mut scanned_bytes = 0u64;

        for (modified, bytes, path) in candidates {
            if scanned_files >= MAX_USAGE_HISTORY_FILES || scanned_bytes >= MAX_USAGE_HISTORY_BYTES
            {
                break;
            }
            scanned_files += 1;
            scanned_bytes += bytes;

            let Ok(file) = fs::File::open(path) else {
                continue;
            };
            let reader = std::io::BufReader::new(file);
            for line in reader.lines().map_while(|line| line.ok()) {
                for (name, usage) in detect_line_skill_usages(&line, skill_names, modified) {
                    index.record_usage(name, usage);
                }
            }
        }
        index
    }

    fn record_usage(&mut self, skill_name: String, usage: SkillUsage) {
        let should_update = self
            .last_used
            .get(&skill_name)
            .map(|current| {
                usage.last_used > current.last_used
                    || (usage.last_used == current.last_used && usage.kind > current.kind)
            })
            .unwrap_or(true);
        if should_update {
            self.last_used.insert(skill_name, usage);
        }
    }

    fn last_used(&self, skill_name: &str) -> Option<SkillUsage> {
        self.last_used.get(skill_name).copied()
    }
}

fn detect_line_skill_usages(
    line: &str,
    skill_names: &BTreeSet<String>,
    fallback_time: SystemTime,
) -> Vec<(String, SkillUsage)> {
    let parsed = serde_json::from_str::<serde_json::Value>(line).ok();
    let event_time = parsed
        .as_ref()
        .and_then(json_event_time)
        .unwrap_or(fallback_time);
    let mut matches = Vec::new();

    for skill_name in skill_names {
        let kind = if let Some(value) = parsed.as_ref() {
            json_value_skill_usage_kind(value, skill_name)
        } else {
            line_skill_usage_kind(line, skill_name)
        };
        if let Some(kind) = kind {
            matches.push((
                skill_name.clone(),
                SkillUsage {
                    last_used: event_time,
                    kind,
                },
            ));
        }
    }

    matches
}

fn json_value_skill_usage_kind(
    value: &serde_json::Value,
    skill_name: &str,
) -> Option<SkillUsageKind> {
    match value {
        serde_json::Value::Object(map) => {
            let mut best = None;
            for (key, value) in map {
                if let serde_json::Value::String(text) = value {
                    best = best.max(json_string_skill_usage_kind(key, text, skill_name));
                }
                best = best.max(json_value_skill_usage_kind(value, skill_name));
            }
            if json_object_role_is_user(map) {
                best = best.max(json_user_content_skill_usage_kind(map, skill_name));
            }
            best
        }
        serde_json::Value::Array(items) => items
            .iter()
            .filter_map(|item| json_value_skill_usage_kind(item, skill_name))
            .max(),
        serde_json::Value::String(_) => None,
        _ => None,
    }
}

fn json_object_role_is_user(map: &serde_json::Map<String, serde_json::Value>) -> bool {
    map.get("role")
        .and_then(serde_json::Value::as_str)
        .map(|role| role == "user")
        .unwrap_or(false)
}

fn json_user_content_skill_usage_kind(
    map: &serde_json::Map<String, serde_json::Value>,
    skill_name: &str,
) -> Option<SkillUsageKind> {
    ["content", "text", "input"]
        .into_iter()
        .filter_map(|key| map.get(key))
        .filter_map(|value| json_content_direct_skill_usage_kind(value, skill_name))
        .max()
}

fn json_content_direct_skill_usage_kind(
    value: &serde_json::Value,
    skill_name: &str,
) -> Option<SkillUsageKind> {
    match value {
        serde_json::Value::String(text) => text_has_direct_skill_invocation(text, skill_name)
            .then_some(SkillUsageKind::DirectInvocation),
        serde_json::Value::Array(items) => items
            .iter()
            .filter_map(|item| json_content_direct_skill_usage_kind(item, skill_name))
            .max(),
        serde_json::Value::Object(map) => ["content", "text", "input"]
            .into_iter()
            .filter_map(|key| map.get(key))
            .filter_map(|value| json_content_direct_skill_usage_kind(value, skill_name))
            .max(),
        _ => None,
    }
}

fn json_string_skill_usage_kind(key: &str, text: &str, skill_name: &str) -> Option<SkillUsageKind> {
    let normalized_key = key.replace(['-', '_'], "").to_ascii_lowercase();
    if matches!(
        normalized_key.as_str(),
        "skill" | "skillname" | "selectedskill"
    ) && text.trim().trim_start_matches('/') == skill_name
    {
        return Some(SkillUsageKind::Structured);
    }
    if matches!(normalized_key.as_str(), "command" | "slashcommand")
        && text_has_direct_skill_invocation(text, skill_name)
    {
        return Some(SkillUsageKind::DirectInvocation);
    }
    None
}

fn line_skill_usage_kind(line: &str, skill_name: &str) -> Option<SkillUsageKind> {
    if text_has_direct_skill_invocation(line, skill_name) {
        return Some(SkillUsageKind::DirectInvocation);
    }

    let compact_patterns = [
        format!("\"skill\":\"{skill_name}\""),
        format!("\"skill_name\":\"{skill_name}\""),
        format!("\"skillName\":\"{skill_name}\""),
        format!("\"selected_skill\":\"{skill_name}\""),
    ];
    if compact_patterns
        .iter()
        .any(|pattern| line.contains(pattern))
    {
        return Some(SkillUsageKind::Structured);
    }

    let spaced_patterns = [
        format!("\"skill\": \"{skill_name}\""),
        format!("\"skill_name\": \"{skill_name}\""),
        format!("\"skillName\": \"{skill_name}\""),
        format!("\"selected_skill\": \"{skill_name}\""),
    ];
    spaced_patterns
        .iter()
        .any(|pattern| line.contains(pattern))
        .then_some(SkillUsageKind::Structured)
}

fn text_has_direct_skill_invocation(text: &str, skill_name: &str) -> bool {
    text_has_prefixed_skill_invocation(text, '/', skill_name)
        || text_has_prefixed_skill_invocation(text, '$', skill_name)
}

fn text_has_prefixed_skill_invocation(text: &str, prefix: char, skill_name: &str) -> bool {
    let needle = format!("{prefix}{skill_name}");
    let mut offset = 0usize;

    while let Some(found) = text[offset..].find(&needle) {
        let start = offset + found;
        let end = start + needle.len();
        let before = text[..start].chars().next_back();
        let after = text[end..].chars().next();

        if direct_skill_boundary_before(before) && direct_skill_boundary_after(after) {
            return true;
        }
        offset = end;
    }

    false
}

fn direct_skill_boundary_before(value: Option<char>) -> bool {
    match value {
        None => true,
        Some(ch) => ch.is_whitespace() || matches!(ch, '"' | '\'' | '`' | '(' | '[' | '{' | ':'),
    }
}

fn direct_skill_boundary_after(value: Option<char>) -> bool {
    match value {
        None => true,
        Some(ch) => {
            ch.is_whitespace()
                || matches!(
                    ch,
                    '"' | '\'' | '`' | ')' | ']' | '}' | ':' | ',' | '.' | ';'
                )
        }
    }
}

fn json_event_time(value: &serde_json::Value) -> Option<SystemTime> {
    let object = value.as_object()?;
    for key in ["timestamp", "created_at", "createdAt", "time"] {
        if let Some(time) = object.get(key).and_then(value_to_system_time) {
            return Some(time);
        }
    }
    object
        .get("payload")
        .and_then(|payload| payload.as_object())
        .and_then(|payload| payload.get("timestamp"))
        .and_then(value_to_system_time)
}

fn value_to_system_time(value: &serde_json::Value) -> Option<SystemTime> {
    match value {
        serde_json::Value::String(text) => parse_rfc3339_utc(text),
        serde_json::Value::Number(number) => {
            if let Some(value) = number.as_u64() {
                if value > 1_000_000_000_000 {
                    return Some(SystemTime::UNIX_EPOCH + Duration::from_millis(value));
                }
                return Some(SystemTime::UNIX_EPOCH + Duration::from_secs(value));
            }
            None
        }
        _ => None,
    }
}

fn parse_rfc3339_utc(value: &str) -> Option<SystemTime> {
    let value = value.trim();
    let value = value
        .strip_suffix('Z')
        .or_else(|| value.strip_suffix("+00:00"))
        .unwrap_or(value);
    let (date, time) = value.split_once('T')?;
    let mut date_parts = date.split('-');
    let year = date_parts.next()?.parse::<i32>().ok()?;
    let month = date_parts.next()?.parse::<u32>().ok()?;
    let day = date_parts.next()?.parse::<u32>().ok()?;
    if date_parts.next().is_some() {
        return None;
    }

    let mut time_parts = time.split(':');
    let hour = time_parts.next()?.parse::<u32>().ok()?;
    let minute = time_parts.next()?.parse::<u32>().ok()?;
    let second_part = time_parts.next()?;
    if time_parts.next().is_some() {
        return None;
    }
    let (second, millis) = if let Some((second, fraction)) = second_part.split_once('.') {
        let millis = fraction
            .chars()
            .take(3)
            .collect::<String>()
            .parse::<u32>()
            .ok()
            .unwrap_or(0);
        (second.parse::<u32>().ok()?, millis)
    } else {
        (second_part.parse::<u32>().ok()?, 0)
    };

    if !(1..=12).contains(&month)
        || !(1..=31).contains(&day)
        || hour > 23
        || minute > 59
        || second > 60
    {
        return None;
    }

    let days = days_from_civil(year, month, day);
    let seconds = days
        .checked_mul(86_400)?
        .checked_add((hour as i64) * 3_600 + (minute as i64) * 60 + second as i64)?;
    if seconds >= 0 {
        Some(
            SystemTime::UNIX_EPOCH
                + Duration::from_secs(seconds as u64)
                + Duration::from_millis(millis as u64),
        )
    } else {
        Some(SystemTime::UNIX_EPOCH - Duration::from_secs(seconds.unsigned_abs()))
    }
}

fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let year = year - (month <= 2) as i32;
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let yoe = year - era * 400;
    let month = month as i32;
    let day = day as i32;
    let doy = (153 * (month + if month > 2 { -3 } else { 9 }) + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    (era * 146_097 + doe - 719_468) as i64
}

struct JsonlHistoryRoot {
    path: PathBuf,
    max_depth: usize,
}

fn jsonl_history_roots() -> Vec<JsonlHistoryRoot> {
    let Ok(home) = crate::util::home_dir() else {
        return Vec::new();
    };
    [
        (".claude/projects", 3),
        (".codex/sessions", 6),
        (".config/opencode", 5),
        (".local/share/opencode", 5),
        (".config/agents", 5),
    ]
    .into_iter()
    .map(|(relative, max_depth)| JsonlHistoryRoot {
        path: home.join(relative),
        max_depth,
    })
    .collect()
}

fn last_used_label(usage: Option<SkillUsage>) -> String {
    let Some(usage) = usage else {
        return "no direct use found".to_string();
    };
    let Ok(elapsed) = SystemTime::now().duration_since(usage.last_used) else {
        return "used recently".to_string();
    };
    let days = elapsed.as_secs() / 86_400;
    let age = match days {
        0 => "used today".to_string(),
        1 => "used 1d ago".to_string(),
        _ if days < 30 => format!("used {days}d ago"),
        _ => format!("used {}mo ago", days / 30),
    };
    match usage.kind {
        SkillUsageKind::DirectInvocation => age,
        SkillUsageKind::Structured => format!("{age} (recorded)"),
    }
}

fn skill_list_output(
    registry: &Registry,
    inventory: &Inventory,
    agents: &[AgentKind],
) -> SkillListOutput {
    let plugins = detected_skill_plugins(registry, inventory, agents);
    let mut entries = installed_skill_entries(inventory, agents);
    entries.sort_by(|left, right| {
        left.scope
            .cmp(&right.scope)
            .then_with(|| {
                list_entry_plugin(&plugins, left.resource.name.as_str())
                    .cmp(&list_entry_plugin(&plugins, right.resource.name.as_str()))
            })
            .then_with(|| left.resource.name.cmp(&right.resource.name))
            .then_with(|| left.agent.cmp(&right.agent))
    });
    let skills = entries
        .into_iter()
        .map(|entry| SkillListItem {
            name: entry.resource.name.clone(),
            plugin: list_entry_plugin(&plugins, &entry.resource.name),
            scope: entry.scope,
            agent: entry.agent,
            deactivated: entry.deactivated,
            path: entry.resource.path.display().to_string(),
        })
        .collect();

    SkillListOutput {
        agents: agents.to_vec(),
        skills,
    }
}

#[cfg(feature = "plugins")]
fn plugin_list_output(registry: &Registry) -> PluginListOutput {
    let plugins = registry
        .plugins
        .iter()
        .map(|plugin| PluginListItem {
            name: plugin.name.clone(),
            description: plugin.description.clone(),
            version: plugin.version.clone(),
            path: plugin.path.display().to_string(),
            skills: plugin
                .skills
                .iter()
                .filter(|skill| !is_deprecated_skill(&skill.name))
                .map(|skill| skill.name.clone())
                .collect(),
            subagents: plugin
                .agents
                .iter()
                .map(|agent| agent.name.clone())
                .collect(),
            hooks: plugin.hooks.as_ref().map(|path| path.display().to_string()),
        })
        .collect();

    PluginListOutput {
        name: registry.name.clone(),
        version: registry.version.clone(),
        plugins,
    }
}

fn prompt_agents(inventory: &Inventory, preselected: &[AgentKind]) -> Result<Vec<AgentKind>> {
    let detected = inventory
        .agents
        .iter()
        .filter(|agent_inventory| agent_is_found(agent_inventory))
        .map(|agent_inventory| agent_inventory.status.agent)
        .collect::<BTreeSet<_>>();
    let preselected = preselected.iter().copied().collect::<BTreeSet<_>>();

    let candidates = sorted_agent_candidates(&detected);
    let candidate_set = candidates.iter().copied().collect::<BTreeSet<_>>();
    let detected = detected
        .into_iter()
        .filter(|agent| candidate_set.contains(agent))
        .collect::<BTreeSet<_>>();
    let defaults = candidates
        .iter()
        .copied()
        .filter(|agent| detected.contains(agent) || preselected.contains(agent))
        .collect::<Vec<_>>();

    let title = format!("Which agents ({} found)?", detected.len());
    let mut prompt = cliclack::multiselect(title)
        .required(true)
        .max_rows(12)
        .filter_mode();
    for agent in candidates {
        prompt = prompt.item(
            agent,
            agent_label(&detected, agent),
            agent_hint(inventory, agent),
        );
    }
    let selected = prompt.initial_values(defaults).interact()?;
    Ok(selected)
}

fn sorted_agent_candidates(detected: &BTreeSet<AgentKind>) -> Vec<AgentKind> {
    AgentKind::POPULAR
        .into_iter()
        .filter(|agent| detected.contains(agent))
        .chain(
            AgentKind::POPULAR
                .into_iter()
                .filter(|agent| !detected.contains(agent)),
        )
        .collect()
}

fn agent_is_found(agent_inventory: &crate::inventory::AgentInventory) -> bool {
    agent_inventory.status.installed || agent_inventory.has_project_resources()
}

fn agent_label(detected: &BTreeSet<AgentKind>, agent: AgentKind) -> String {
    if detected.contains(&agent) {
        agent.display_name().to_string()
    } else {
        style(agent.display_name()).dim().to_string()
    }
}

#[cfg(feature = "plugins")]
fn prompt_plugins(
    registry: &Registry,
    recs: &[Recommendation],
    inventory: &Inventory,
    agents: &[AgentKind],
    scope: InstallScope,
) -> Result<Vec<String>> {
    let recommended = recs
        .iter()
        .map(|rec| rec.plugin.as_str())
        .collect::<BTreeSet<_>>();
    let defaults = registry
        .plugins
        .iter()
        .filter_map(|plugin| {
            let coverage = inventory.coverage_for(registry, plugin, agents, scope);
            (recommended.contains(plugin.name.as_str()) && !coverage.is_complete())
                .then_some(plugin.name.clone())
        })
        .collect::<Vec<_>>();

    let mut prompt = cliclack::multiselect("Which plugins should be installed?")
        .required(false)
        .max_rows(12)
        .filter_mode();
    for plugin in &registry.plugins {
        let coverage = inventory.coverage_for(registry, plugin, agents, scope);
        let hint = plugin_hint(plugin.component_summary(), &coverage.label_hint());
        prompt = prompt.item(plugin.name.clone(), &plugin.name, hint);
    }
    let selected = prompt.initial_values(defaults).interact()?;
    Ok(selected)
}

fn prompt_skills(
    registry: &Registry,
    recs: &[Recommendation],
    inventory: &Inventory,
    agents: &[AgentKind],
    default_scope: InstallScope,
    install_detected: bool,
) -> Result<SkillSetupSelection> {
    let mut defaults = default_skill_placements(registry, recs, inventory, agents, default_scope);
    let selected_defaults = defaults
        .iter()
        .map(|placement| placement.name.as_str())
        .collect::<BTreeSet<_>>();
    let actionable_partials = partial_skill_installs(registry, inventory, agents)
        .into_iter()
        .filter(|partial| !selected_defaults.contains(partial.name.as_str()))
        .collect::<Vec<_>>();

    if install_detected {
        for partial in &actionable_partials {
            defaults.push(SkillPlacement {
                name: partial.name.clone(),
                target: partial.target,
            });
        }
    } else {
        for partial in &actionable_partials {
            defaults.push(SkillPlacement {
                name: partial.name.clone(),
                target: SkillPlacementTarget::Keep,
            });
        }
    }

    if !std::io::stderr().is_terminal() {
        return Ok(SkillSetupSelection {
            placements: defaults,
            preserve_skills: Vec::new(),
        });
    }

    let (items, rows) = skill_tree_items(registry, inventory, agents);
    let dual_conflicts = items
        .iter()
        .filter(|item| item.has_dual_scope_conflict())
        .cloned()
        .collect::<Vec<_>>();
    if !dual_conflicts.is_empty() {
        cliclack::note(
            warning_text("Skills installed in both user and project scopes"),
            dual_scope_conflict_note(&dual_conflicts),
        )?;
    }
    let selection = prompt_skill_tree(&items, &rows, &defaults, SkillTreePromptMode::Setup, None)?;
    Ok(SkillSetupSelection {
        placements: selection.placements,
        preserve_skills: Vec::new(),
    })
}

#[derive(Clone, Debug)]
struct SkillSetupSelection {
    placements: Vec<SkillPlacement>,
    preserve_skills: Vec<String>,
}

#[derive(Clone, Debug)]
struct SkillTreeSelection {
    placements: Vec<SkillPlacement>,
}

#[cfg_attr(not(feature = "plugins"), allow(dead_code))]
fn setup_has_placement_overrides(args: &SetupArgs) -> bool {
    !args.set_project.is_empty()
        || !args.set_user.is_empty()
        || !args.uninstall.is_empty()
        || !args.deactivate.is_empty()
        || !args.keep.is_empty()
}

fn setup_placement_overrides(args: &SetupArgs) -> Result<Vec<SkillPlacement>> {
    skill_placement_overrides(
        &args.set_project,
        &args.set_user,
        &args.uninstall,
        &args.deactivate,
        &args.keep,
    )
}

fn manage_placement_overrides(args: &ManageArgs) -> Result<Vec<SkillPlacement>> {
    skill_placement_overrides(
        &args.set_project,
        &args.set_user,
        &args.uninstall,
        &args.deactivate,
        &args.keep,
    )
}

fn skill_placement_overrides(
    set_project: &[String],
    set_user: &[String],
    uninstall: &[String],
    deactivate: &[String],
    keep: &[String],
) -> Result<Vec<SkillPlacement>> {
    let mut placements = BTreeMap::new();
    insert_placement_overrides(
        &mut placements,
        set_project,
        SkillPlacementTarget::Project,
        "--set-project",
    )?;
    insert_placement_overrides(
        &mut placements,
        set_user,
        SkillPlacementTarget::User,
        "--set-user",
    )?;
    insert_placement_overrides(
        &mut placements,
        uninstall,
        SkillPlacementTarget::None,
        "--uninstall",
    )?;
    insert_placement_overrides(
        &mut placements,
        deactivate,
        SkillPlacementTarget::Deactivate,
        "--deactivate",
    )?;
    insert_placement_overrides(&mut placements, keep, SkillPlacementTarget::Keep, "--keep")?;

    Ok(placements
        .into_iter()
        .map(|(name, target)| SkillPlacement { name, target })
        .collect())
}

fn insert_placement_overrides(
    placements: &mut BTreeMap<String, SkillPlacementTarget>,
    names: &[String],
    target: SkillPlacementTarget,
    flag: &str,
) -> Result<()> {
    for raw_name in names {
        let name = raw_name.trim();
        if name.is_empty() {
            return Err(anyhow!("{flag} requires a non-empty skill name"));
        }
        match placements.insert(name.to_string(), target) {
            Some(existing) if existing != target => {
                return Err(anyhow!(
                    "{} was provided with multiple placement targets",
                    name
                ));
            }
            _ => {}
        }
    }
    Ok(())
}

fn apply_placement_overrides(placements: &mut Vec<SkillPlacement>, overrides: Vec<SkillPlacement>) {
    let mut merged = placements
        .drain(..)
        .map(|placement| (placement.name, placement.target))
        .collect::<BTreeMap<_, _>>();
    for placement in overrides {
        merged.insert(placement.name, placement.target);
    }
    *placements = merged
        .into_iter()
        .map(|(name, target)| SkillPlacement { name, target })
        .collect();
}

fn validate_setup_placement_overrides(
    registry: &Registry,
    placements: &[SkillPlacement],
) -> Result<()> {
    for placement in placements {
        validate_registry_skill_name(registry, &placement.name)?;
    }
    Ok(())
}

fn validate_manage_placement_overrides(
    registry: &Registry,
    inventory: &Inventory,
    agents: &[AgentKind],
    placements: &[SkillPlacement],
) -> Result<()> {
    let present = installed_or_cached_skill_names(inventory, agents);
    for placement in placements {
        if registry.skill(&placement.name).is_some() {
            continue;
        }
        if present.contains(&placement.name) {
            continue;
        }
        if registry.plugin(&placement.name).is_some() {
            return Err(anyhow!(
                "{} is a plugin bundle; manage skills by individual skill name",
                placement.name
            ));
        }
        return Err(anyhow!(
            "{} is not installed or cached for the selected agents",
            placement.name
        ));
    }
    Ok(())
}

fn installed_or_cached_skill_names(
    inventory: &Inventory,
    agents: &[AgentKind],
) -> BTreeSet<String> {
    let mut names = BTreeSet::new();
    for agent in agents {
        let Some(agent_inventory) = inventory.for_agent(*agent) else {
            continue;
        };
        names.extend(
            agent_inventory
                .skill_names(InstallScope::Project)
                .into_iter()
                .map(ToOwned::to_owned),
        );
        names.extend(
            agent_inventory
                .skill_names(InstallScope::User)
                .into_iter()
                .map(ToOwned::to_owned),
        );
        names.extend(
            agent_inventory
                .deactivated_skill_names(InstallScope::Project)
                .into_iter()
                .map(ToOwned::to_owned),
        );
        names.extend(
            agent_inventory
                .deactivated_skill_names(InstallScope::User)
                .into_iter()
                .map(ToOwned::to_owned),
        );
    }
    names
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum SkillTreePromptMode {
    Setup,
    Manage,
}

#[derive(Clone, Debug)]
struct PartialSkillInstall {
    name: String,
    target: SkillPlacementTarget,
}

#[derive(Clone, Debug)]
struct SkillTreeItem {
    name: String,
    other: bool,
    project_installed: usize,
    user_installed: usize,
    project_deactivated: usize,
    user_deactivated: usize,
    installed_agents: usize,
    dual_scope_agents: usize,
    agent_count: usize,
    version: Option<String>,
    show_usage: bool,
    last_used: Option<SkillUsage>,
    file_count: usize,
}

impl SkillTreeItem {
    fn installed(&self) -> usize {
        self.project_installed + self.user_installed
    }

    fn deactivated(&self) -> usize {
        self.project_deactivated + self.user_deactivated
    }

    fn present(&self) -> usize {
        self.installed() + self.deactivated()
    }

    fn can_deactivate(&self) -> bool {
        self.present() > 0 && !self.has_dual_scope_conflict()
    }

    fn has_dual_scope_conflict(&self) -> bool {
        self.dual_scope_agents > 0
    }

    fn installed_on_one_agent(&self) -> bool {
        self.agent_count > 1 && self.installed_agents == 1
    }
}

#[derive(Clone, Debug)]
struct SkillPluginInfo {
    name: String,
    other: bool,
}

impl SkillPluginInfo {
    fn registry(name: String) -> Self {
        Self { name, other: false }
    }

    fn detected(name: String) -> Self {
        Self { name, other: false }
    }
}

#[derive(Clone, Debug)]
enum SkillTreeRow {
    Header {
        key: String,
        label: String,
        summary: String,
        other: bool,
        level: usize,
    },
    Skill {
        item: usize,
        last: bool,
        level: usize,
    },
}

fn skill_tree_items(
    registry: &Registry,
    inventory: &Inventory,
    agents: &[AgentKind],
) -> (Vec<SkillTreeItem>, Vec<SkillTreeRow>) {
    let mut items = Vec::new();
    let mut rows = Vec::new();

    let mut plugins = registry.plugins.iter().collect::<Vec<_>>();
    plugins.sort_by(|left, right| left.name.cmp(&right.name));
    for plugin in plugins {
        let mut skills = plugin
            .skills
            .iter()
            .filter(|skill| !is_deprecated_skill(&skill.name))
            .collect::<Vec<_>>();
        skills.sort_by(|left, right| left.name.cmp(&right.name));
        if skills.is_empty() {
            continue;
        }

        rows.push(SkillTreeRow::Header {
            key: format!("plugin:{}", plugin.name),
            label: plugin.name.clone(),
            summary: short_words(&plugin.description, 12),
            other: false,
            level: 0,
        });
        for (idx, skill) in skills.iter().enumerate() {
            let item = items.len();
            items.push(SkillTreeItem {
                name: skill.name.clone(),
                other: false,
                project_installed: installed_skill_count(
                    inventory,
                    agents,
                    InstallScope::Project,
                    &skill.name,
                ),
                user_installed: installed_skill_count(
                    inventory,
                    agents,
                    InstallScope::User,
                    &skill.name,
                ),
                project_deactivated: deactivated_skill_count(
                    inventory,
                    agents,
                    InstallScope::Project,
                    &skill.name,
                ),
                user_deactivated: deactivated_skill_count(
                    inventory,
                    agents,
                    InstallScope::User,
                    &skill.name,
                ),
                installed_agents: installed_skill_agent_count(inventory, agents, &skill.name),
                dual_scope_agents: dual_scope_skill_agent_count(inventory, agents, &skill.name),
                agent_count: agents.len(),
                version: plugin.version.clone().or_else(|| registry.version.clone()),
                show_usage: false,
                last_used: None,
                file_count: skill_file_count(&skill.path),
            });
            rows.push(SkillTreeRow::Skill {
                item,
                last: idx + 1 == skills.len(),
                level: 1,
            });
        }
    }

    (items, rows)
}

fn skill_manage_items(
    registry: &Registry,
    inventory: &Inventory,
    agents: &[AgentKind],
    show_usage: bool,
) -> (Vec<SkillTreeItem>, BTreeMap<String, SkillPluginInfo>) {
    let known = registry_skill_names(registry);
    let plugins = detected_skill_plugins(registry, inventory, agents);
    let mut names = BTreeSet::new();

    for agent in agents {
        let Some(agent_inventory) = inventory.for_agent(*agent) else {
            continue;
        };
        names.extend(
            agent_inventory
                .skill_names(InstallScope::Project)
                .into_iter()
                .map(ToOwned::to_owned),
        );
        names.extend(
            agent_inventory
                .skill_names(InstallScope::User)
                .into_iter()
                .map(ToOwned::to_owned),
        );
        names.extend(
            agent_inventory
                .deactivated_skill_names(InstallScope::Project)
                .into_iter()
                .map(ToOwned::to_owned),
        );
        names.extend(
            agent_inventory
                .deactivated_skill_names(InstallScope::User)
                .into_iter()
                .map(ToOwned::to_owned),
        );
    }

    let file_counts = installed_skill_file_counts(inventory, agents);
    let usage = if show_usage {
        SkillUsageIndex::detect(&names)
    } else {
        SkillUsageIndex::default()
    };
    let mut items = names
        .into_iter()
        .map(|name| SkillTreeItem {
            other: plugins
                .get(&name)
                .map(|plugin| plugin.other)
                .unwrap_or_else(|| !known.contains(&name)),
            project_installed: installed_skill_count(
                inventory,
                agents,
                InstallScope::Project,
                &name,
            ),
            user_installed: installed_skill_count(inventory, agents, InstallScope::User, &name),
            project_deactivated: deactivated_skill_count(
                inventory,
                agents,
                InstallScope::Project,
                &name,
            ),
            user_deactivated: deactivated_skill_count(inventory, agents, InstallScope::User, &name),
            installed_agents: installed_skill_agent_count(inventory, agents, &name),
            dual_scope_agents: dual_scope_skill_agent_count(inventory, agents, &name),
            agent_count: agents.len(),
            version: None,
            show_usage,
            last_used: usage.last_used(&name),
            file_count: file_counts.get(&name).copied().unwrap_or(1),
            name,
        })
        .collect::<Vec<_>>();
    items.sort_by(|a, b| a.name.cmp(&b.name));

    (items, plugins)
}

fn skill_manage_tree_items(
    registry: &Registry,
    inventory: &Inventory,
    agents: &[AgentKind],
    show_usage: bool,
) -> (Vec<SkillTreeItem>, Vec<SkillTreeRow>) {
    let (items, plugins) = skill_manage_items(registry, inventory, agents, show_usage);

    let item_by_name = items
        .iter()
        .enumerate()
        .map(|(idx, item)| (item.name.clone(), idx))
        .collect::<BTreeMap<_, _>>();
    let mut rows = Vec::new();
    append_manage_scope_rows(
        "User",
        "◆",
        InstallScope::User,
        inventory,
        agents,
        &plugins,
        &item_by_name,
        &mut rows,
    );
    append_manage_scope_rows(
        "Project",
        "●",
        InstallScope::Project,
        inventory,
        agents,
        &plugins,
        &item_by_name,
        &mut rows,
    );

    (items, rows)
}

fn manage_tree_rows(
    items: &[SkillTreeItem],
    plugins: &BTreeMap<String, SkillPluginInfo>,
    placements: &BTreeMap<String, SkillPlacementTarget>,
) -> Vec<SkillTreeRow> {
    let mut rows = Vec::new();
    append_manage_target_rows("User", "◆", InstallScope::User, items, plugins, placements, &mut rows);
    append_manage_target_rows(
        "Project",
        "●",
        InstallScope::Project,
        items,
        plugins,
        placements,
        &mut rows,
    );
    rows
}

fn item_in_scope_section(
    item: &SkillTreeItem,
    target: SkillPlacementTarget,
    scope: InstallScope,
) -> bool {
    match target {
        SkillPlacementTarget::Project => scope == InstallScope::Project,
        SkillPlacementTarget::User => scope == InstallScope::User,
        SkillPlacementTarget::Keep
        | SkillPlacementTarget::Deactivate
        | SkillPlacementTarget::None => match scope {
            InstallScope::Project => item.project_installed > 0 || item.project_deactivated > 0,
            InstallScope::User => item.user_installed > 0 || item.user_deactivated > 0,
        },
    }
}

fn present_in_other_scope(item: &SkillTreeItem, target_scope: InstallScope) -> bool {
    match target_scope {
        InstallScope::Project => item.user_installed > 0 || item.user_deactivated > 0,
        InstallScope::User => item.project_installed > 0 || item.project_deactivated > 0,
    }
}

fn append_manage_target_rows(
    label: &str,
    symbol: &str,
    scope: InstallScope,
    items: &[SkillTreeItem],
    plugins: &BTreeMap<String, SkillPluginInfo>,
    placements: &BTreeMap<String, SkillPlacementTarget>,
    rows: &mut Vec<SkillTreeRow>,
) {
    let mut groups = BTreeMap::<String, Vec<usize>>::new();
    for (idx, item) in items.iter().enumerate() {
        let target = skill_placement(placements, &item.name);
        if !item_in_scope_section(item, target, scope) {
            continue;
        }
        let plugin = plugins
            .get(&item.name)
            .map(|plugin| plugin.name.clone())
            .unwrap_or_else(|| "no plugin".to_string());
        groups.entry(plugin).or_default().push(idx);
    }

    if groups.is_empty() {
        return;
    }

    let total = groups.values().map(Vec::len).sum::<usize>();
    rows.push(SkillTreeRow::Header {
        key: format!("scope:{label}"),
        label: format!("{symbol} {label}"),
        summary: format!("{total} skills"),
        other: false,
        level: 0,
    });

    let mut groups = groups.into_iter().collect::<Vec<_>>();
    groups.sort_by(|(left, _), (right, _)| {
        plugin_group_sort_key(left).cmp(&plugin_group_sort_key(right))
    });
    for (plugin, mut item_indexes) in groups {
        item_indexes.sort_unstable();
        let count = item_indexes.len();
        rows.push(SkillTreeRow::Header {
            key: format!("scope:{label}/plugin:{plugin}"),
            label: plugin.clone(),
            summary: format!("{count} skills"),
            other: plugin == "no plugin",
            level: 1,
        });
        for (idx, item) in item_indexes.into_iter().enumerate() {
            rows.push(SkillTreeRow::Skill {
                item,
                last: idx + 1 == count,
                level: 2,
            });
        }
    }
}

fn append_manage_scope_rows(
    label: &str,
    symbol: &str,
    scope: InstallScope,
    inventory: &Inventory,
    agents: &[AgentKind],
    plugins: &BTreeMap<String, SkillPluginInfo>,
    item_by_name: &BTreeMap<String, usize>,
    rows: &mut Vec<SkillTreeRow>,
) {
    let scoped_names = scoped_skill_names(inventory, agents, scope);
    if scoped_names.is_empty() {
        return;
    }

    let mut groups = BTreeMap::<String, Vec<usize>>::new();
    for name in scoped_names {
        let Some(item) = item_by_name.get(&name).copied() else {
            continue;
        };
        let plugin = plugins
            .get(&name)
            .map(|plugin| plugin.name.clone())
            .unwrap_or_else(|| "no plugin".to_string());
        groups.entry(plugin).or_default().push(item);
    }

    let total = groups.values().map(Vec::len).sum::<usize>();
    rows.push(SkillTreeRow::Header {
        key: format!("scope:{label}"),
        label: format!("{symbol} {label}"),
        summary: format!("{total} skills"),
        other: false,
        level: 0,
    });

    let mut groups = groups.into_iter().collect::<Vec<_>>();
    groups.sort_by(|(left, _), (right, _)| {
        plugin_group_sort_key(left).cmp(&plugin_group_sort_key(right))
    });
    for (plugin, mut item_indexes) in groups {
        item_indexes.sort_unstable();
        let count = item_indexes.len();
        rows.push(SkillTreeRow::Header {
            key: format!("scope:{label}/plugin:{plugin}"),
            label: plugin.clone(),
            summary: format!("{count} skills"),
            other: plugin == "no plugin",
            level: 1,
        });
        for (idx, item) in item_indexes.into_iter().enumerate() {
            rows.push(SkillTreeRow::Skill {
                item,
                last: idx + 1 == count,
                level: 2,
            });
        }
    }
}

fn plugin_group_sort_key(plugin: &str) -> (bool, String) {
    (plugin == "no plugin", plugin.to_string())
}

fn scoped_skill_names(
    inventory: &Inventory,
    agents: &[AgentKind],
    scope: InstallScope,
) -> BTreeSet<String> {
    let mut names = BTreeSet::new();
    for agent in agents {
        let Some(agent_inventory) = inventory.for_agent(*agent) else {
            continue;
        };
        names.extend(
            agent_inventory
                .skill_names(scope)
                .into_iter()
                .map(ToOwned::to_owned),
        );
        names.extend(
            agent_inventory
                .deactivated_skill_names(scope)
                .into_iter()
                .map(ToOwned::to_owned),
        );
    }
    names
}

fn prompt_skill_tree(
    items: &[SkillTreeItem],
    rows: &[SkillTreeRow],
    defaults: &[SkillPlacement],
    mode: SkillTreePromptMode,
    manage_plugins: Option<&BTreeMap<String, SkillPluginInfo>>,
) -> Result<SkillTreeSelection> {
    if items.is_empty() {
        return Ok(SkillTreeSelection {
            placements: Vec::new(),
        });
    }

    let term = Term::stderr();
    let mut placements = defaults
        .iter()
        .map(|placement| (placement.name.clone(), placement.target))
        .collect::<BTreeMap<_, _>>();
    let mut collapsed = BTreeSet::new();
    let mut search = String::new();
    let mut search_active = true;
    let mut all_rows = rows.to_vec();
    let mut visible_rows = visible_skill_tree_rows(items, &all_rows, &collapsed, &search);
    let mut cursor = 0usize;
    let mut start = 0usize;
    let max_rows = 14usize;
    let mut rendered_lines = 0usize;
    let mut touched = BTreeSet::new();

    seed_skill_tree_placements(items, &mut placements);
    if let Some(plugins) = manage_plugins {
        all_rows = manage_tree_rows(items, plugins, &placements);
        visible_rows = visible_skill_tree_rows(items, &all_rows, &collapsed, &search);
    }

    term.hide_cursor()?;
    loop {
        if visible_rows.is_empty() {
            cursor = 0;
            start = 0;
        }
        if !visible_rows.is_empty() {
            cursor = cursor.min(visible_rows.len() - 1);
        }
        start = adjust_visible_skill_tree_start(cursor, start, max_rows);
        rendered_lines = render_skill_tree_prompt(
            &term,
            items,
            &visible_rows,
            &collapsed,
            &placements,
            &touched,
            &search,
            search_active,
            mode,
            cursor,
            start,
            max_rows,
            rendered_lines,
        )?;

        let key = term.read_key()?;
        match key {
            Key::Char('/') if !search_active => {
                search_active = true;
                continue;
            }
            Key::Char(' ') if search_active && search.is_empty() => {}
            Key::Char(c) if search_active && !c.is_control() => {
                search.push(c);
                visible_rows = visible_skill_tree_rows(items, &all_rows, &collapsed, &search);
                cursor = 0;
                start = 0;
                continue;
            }
            Key::Backspace if search_active => {
                search.pop();
                visible_rows = visible_skill_tree_rows(items, &all_rows, &collapsed, &search);
                cursor = 0;
                start = 0;
                continue;
            }
            Key::Escape if search_active && !search.is_empty() => {
                search.clear();
                visible_rows = visible_skill_tree_rows(items, &all_rows, &collapsed, &search);
                cursor = 0;
                start = 0;
                continue;
            }
            Key::Escape if search_active => {
                search_active = false;
                continue;
            }
            _ => {}
        }

        if visible_rows.is_empty() && !matches!(key, Key::Escape | Key::CtrlC) {
            continue;
        }

        match key {
            Key::ArrowUp => {
                cursor = cursor.saturating_sub(1);
            }
            Key::ArrowDown => {
                if cursor + 1 < visible_rows.len() {
                    cursor += 1;
                }
            }
            Key::PageUp => {
                cursor = cursor.saturating_sub(max_rows);
            }
            Key::PageDown => {
                cursor = (cursor + max_rows).min(visible_rows.len() - 1);
            }
            Key::Home => {
                cursor = 0;
            }
            Key::End => {
                cursor = visible_rows.len() - 1;
            }
            Key::ArrowLeft => {
                update_skill_tree_row_left(
                    &visible_rows[cursor],
                    items,
                    &mut placements,
                    &mut collapsed,
                    &mut touched,
                );
                if let Some(plugins) = manage_plugins {
                    all_rows = manage_tree_rows(items, plugins, &placements);
                }
                visible_rows = visible_skill_tree_rows(items, &all_rows, &collapsed, &search);
            }
            Key::ArrowRight => {
                update_skill_tree_row_right(
                    &visible_rows[cursor],
                    items,
                    &mut placements,
                    &mut collapsed,
                    &mut touched,
                );
                if let Some(plugins) = manage_plugins {
                    all_rows = manage_tree_rows(items, plugins, &placements);
                }
                visible_rows = visible_skill_tree_rows(items, &all_rows, &collapsed, &search);
            }
            Key::BackTab => {
                apply_active_skill_target_to_plugin(
                    &visible_rows[cursor],
                    &all_rows,
                    items,
                    &mut placements,
                    &mut touched,
                );
                if let Some(plugins) = manage_plugins {
                    all_rows = manage_tree_rows(items, plugins, &placements);
                    visible_rows = visible_skill_tree_rows(items, &all_rows, &collapsed, &search);
                }
            }
            Key::Char(' ') => {
                if let SkillTreeRow::Header { key, .. } = &visible_rows[cursor] {
                    toggle_collapsed_header(&mut collapsed, key);
                    visible_rows = visible_skill_tree_rows(items, &all_rows, &collapsed, &search);
                }
            }
            Key::Enter => {
                if let Some(conflicts) = unresolved_dual_scope_conflicts(items, &placements) {
                    term.clear_last_lines(rendered_lines)?;
                    cliclack::note(
                        warning_text("Skills installed in both scopes"),
                        dual_scope_conflict_note(&conflicts),
                    )?;
                    rendered_lines = 0;
                    search_active = true;
                    continue;
                }
                term.clear_last_lines(rendered_lines)?;
                render_skill_tree_submit(&term, items, &placements, mode)?;
                term.show_cursor()?;
                return Ok(SkillTreeSelection {
                    placements: skill_placements_from_state(items, &placements),
                });
            }
            Key::Escape | Key::CtrlC => {
                term.clear_last_lines(rendered_lines).ok();
                term.show_cursor().ok();
                return Err(anyhow!("skill selection cancelled"));
            }
            _ => {}
        }
    }
}

fn visible_skill_tree_rows(
    items: &[SkillTreeItem],
    rows: &[SkillTreeRow],
    collapsed: &BTreeSet<String>,
    search: &str,
) -> Vec<SkillTreeRow> {
    let query = search.trim().to_lowercase();
    if !query.is_empty() {
        return filtered_skill_tree_rows(items, rows, &query);
    }

    let mut visible = Vec::new();
    let mut collapsed_levels = Vec::new();

    for row in rows {
        match row {
            SkillTreeRow::Header { key, level, .. } => {
                collapsed_levels.retain(|collapsed_level| *collapsed_level < *level);
                let hidden = collapsed_levels
                    .iter()
                    .any(|collapsed_level| *collapsed_level < *level);
                if !hidden {
                    visible.push(row.clone());
                    if collapsed.contains(key) {
                        collapsed_levels.push(*level);
                    }
                }
            }
            SkillTreeRow::Skill { level, .. } => {
                let hidden = collapsed_levels
                    .iter()
                    .any(|collapsed_level| *collapsed_level < *level);
                if !hidden {
                    visible.push(row.clone());
                }
            }
        }
    }
    visible
}

fn filtered_skill_tree_rows(
    items: &[SkillTreeItem],
    rows: &[SkillTreeRow],
    query: &str,
) -> Vec<SkillTreeRow> {
    let mut visible = Vec::new();
    let mut ancestors = Vec::<SkillTreeRow>::new();
    let mut emitted_headers = BTreeSet::new();

    for row in rows {
        match row {
            SkillTreeRow::Header { level, .. } => {
                ancestors.retain(|ancestor| skill_tree_row_level(ancestor) < *level);
                ancestors.push(row.clone());
            }
            SkillTreeRow::Skill { item, .. } => {
                if items[*item].name.to_lowercase().contains(query) {
                    emit_skill_tree_ancestors(&ancestors, &mut visible, &mut emitted_headers);
                    visible.push(row.clone());
                }
            }
        }
    }

    refresh_skill_tree_last_flags(visible)
}

fn skill_tree_row_level(row: &SkillTreeRow) -> usize {
    match row {
        SkillTreeRow::Header { level, .. } | SkillTreeRow::Skill { level, .. } => *level,
    }
}

fn emit_skill_tree_ancestors(
    ancestors: &[SkillTreeRow],
    visible: &mut Vec<SkillTreeRow>,
    emitted_headers: &mut BTreeSet<String>,
) {
    for ancestor in ancestors {
        let SkillTreeRow::Header { key, .. } = ancestor else {
            continue;
        };
        if emitted_headers.insert(key.clone()) {
            visible.push(ancestor.clone());
        }
    }
}

fn refresh_skill_tree_last_flags(mut rows: Vec<SkillTreeRow>) -> Vec<SkillTreeRow> {
    for index in 0..rows.len() {
        let SkillTreeRow::Skill { level, .. } = &rows[index] else {
            continue;
        };
        let mut last = true;
        for next in rows.iter().skip(index + 1) {
            match next {
                SkillTreeRow::Header {
                    level: next_level, ..
                } if *next_level < *level => break,
                SkillTreeRow::Header {
                    level: next_level, ..
                } if *next_level == *level => break,
                SkillTreeRow::Skill {
                    level: next_level, ..
                } if *next_level == *level => {
                    last = false;
                    break;
                }
                _ => {}
            }
        }
        if let SkillTreeRow::Skill { last: row_last, .. } = &mut rows[index] {
            *row_last = last;
        }
    }
    rows
}

fn adjust_visible_skill_tree_start(cursor: usize, start: usize, max_rows: usize) -> usize {
    if cursor < start {
        cursor
    } else if cursor >= start + max_rows {
        cursor + 1 - max_rows
    } else {
        start
    }
}

fn update_skill_tree_row_left(
    row: &SkillTreeRow,
    items: &[SkillTreeItem],
    placements: &mut BTreeMap<String, SkillPlacementTarget>,
    collapsed: &mut BTreeSet<String>,
    touched: &mut BTreeSet<String>,
) {
    match row {
        SkillTreeRow::Header { key, .. } => {
            collapsed.insert(key.clone());
        }
        SkillTreeRow::Skill { item, .. } => {
            let skill = &items[*item];
            let target = previous_skill_target(skill, skill_placement(placements, &skill.name));
            set_skill_placement(placements, &skill.name, target);
            touched.insert(skill.name.clone());
        }
    }
}

fn update_skill_tree_row_right(
    row: &SkillTreeRow,
    items: &[SkillTreeItem],
    placements: &mut BTreeMap<String, SkillPlacementTarget>,
    collapsed: &mut BTreeSet<String>,
    touched: &mut BTreeSet<String>,
) {
    match row {
        SkillTreeRow::Header { key, .. } => {
            collapsed.remove(key);
        }
        SkillTreeRow::Skill { item, .. } => {
            let skill = &items[*item];
            let target = next_skill_target(skill, skill_placement(placements, &skill.name));
            set_skill_placement(placements, &skill.name, target);
            touched.insert(skill.name.clone());
        }
    }
}

fn apply_active_skill_target_to_plugin(
    row: &SkillTreeRow,
    rows: &[SkillTreeRow],
    items: &[SkillTreeItem],
    placements: &mut BTreeMap<String, SkillPlacementTarget>,
    touched: &mut BTreeSet<String>,
) {
    let SkillTreeRow::Skill { item, .. } = row else {
        return;
    };
    let target = skill_placement(placements, &items[*item].name);
    for item in skill_tree_current_plugin_items(rows, *item) {
        let skill = &items[item];
        let target = if target == SkillPlacementTarget::Deactivate && !skill.can_deactivate() {
            SkillPlacementTarget::Keep
        } else {
            target
        };
        set_skill_placement(placements, &skill.name, target);
        touched.insert(skill.name.clone());
    }
}

fn skill_tree_current_plugin_items(rows: &[SkillTreeRow], active_item: usize) -> Vec<usize> {
    let mut current_plugin = None::<(String, usize)>;
    let mut active_plugin = None::<String>;
    let mut plugin_items = BTreeMap::<String, BTreeSet<usize>>::new();

    for row in rows {
        match row {
            SkillTreeRow::Header { key, level, .. } => {
                if let Some((_, plugin_level)) = &current_plugin {
                    if *level <= *plugin_level {
                        current_plugin = None;
                    }
                }
                if skill_tree_header_is_plugin(key) {
                    current_plugin = Some((key.clone(), *level));
                }
            }
            SkillTreeRow::Skill { item, level, .. } => {
                let Some((plugin, plugin_level)) = &current_plugin else {
                    continue;
                };
                if *level <= *plugin_level {
                    continue;
                }
                plugin_items
                    .entry(plugin.clone())
                    .or_default()
                    .insert(*item);
                if *item == active_item && active_plugin.is_none() {
                    active_plugin = Some(plugin.clone());
                }
            }
        }
    }

    active_plugin
        .and_then(|plugin| plugin_items.remove(&plugin))
        .map(|items| items.into_iter().collect())
        .unwrap_or_else(|| vec![active_item])
}

fn skill_tree_header_is_plugin(key: &str) -> bool {
    key.starts_with("plugin:") || key.contains("/plugin:")
}

fn toggle_collapsed_header(collapsed: &mut BTreeSet<String>, key: &str) {
    if !collapsed.remove(key) {
        collapsed.insert(key.to_string());
    }
}

fn skill_placement(
    placements: &BTreeMap<String, SkillPlacementTarget>,
    name: &str,
) -> SkillPlacementTarget {
    placements
        .get(name)
        .copied()
        .unwrap_or(SkillPlacementTarget::None)
}

fn set_skill_placement(
    placements: &mut BTreeMap<String, SkillPlacementTarget>,
    name: &str,
    target: SkillPlacementTarget,
) {
    if target == SkillPlacementTarget::None {
        placements.remove(name);
    } else {
        placements.insert(name.to_string(), target);
    }
}

fn seed_skill_tree_placements(
    items: &[SkillTreeItem],
    placements: &mut BTreeMap<String, SkillPlacementTarget>,
) {
    for item in items {
        if item.has_dual_scope_conflict() {
            placements.insert(item.name.clone(), SkillPlacementTarget::Keep);
        } else if item.deactivated() > 0 && item.installed() == 0 {
            placements
                .entry(item.name.clone())
                .or_insert(SkillPlacementTarget::Deactivate);
        } else if item.other && item.present() > 0 {
            placements
                .entry(item.name.clone())
                .or_insert(SkillPlacementTarget::Keep);
        }
    }
}

fn next_skill_target(skill: &SkillTreeItem, target: SkillPlacementTarget) -> SkillPlacementTarget {
    if skill.has_dual_scope_conflict() {
        match target {
            SkillPlacementTarget::Keep => SkillPlacementTarget::Project,
            SkillPlacementTarget::Project => SkillPlacementTarget::User,
            SkillPlacementTarget::User => SkillPlacementTarget::None,
            SkillPlacementTarget::None => SkillPlacementTarget::Keep,
            SkillPlacementTarget::Deactivate => SkillPlacementTarget::Project,
        }
    } else if skill.installed_on_one_agent() || skill.other {
        match target {
            SkillPlacementTarget::Keep => SkillPlacementTarget::Project,
            SkillPlacementTarget::Project => SkillPlacementTarget::User,
            SkillPlacementTarget::User if skill.can_deactivate() => {
                SkillPlacementTarget::Deactivate
            }
            SkillPlacementTarget::User => SkillPlacementTarget::None,
            SkillPlacementTarget::Deactivate => SkillPlacementTarget::None,
            SkillPlacementTarget::None => SkillPlacementTarget::Keep,
        }
    } else {
        match target {
            SkillPlacementTarget::Keep | SkillPlacementTarget::None => {
                SkillPlacementTarget::Project
            }
            SkillPlacementTarget::Project => SkillPlacementTarget::User,
            SkillPlacementTarget::User if skill.can_deactivate() => {
                SkillPlacementTarget::Deactivate
            }
            SkillPlacementTarget::User => SkillPlacementTarget::None,
            SkillPlacementTarget::Deactivate => SkillPlacementTarget::None,
        }
    }
}

fn previous_skill_target(
    skill: &SkillTreeItem,
    target: SkillPlacementTarget,
) -> SkillPlacementTarget {
    if skill.has_dual_scope_conflict() {
        match target {
            SkillPlacementTarget::Keep => SkillPlacementTarget::None,
            SkillPlacementTarget::None => SkillPlacementTarget::User,
            SkillPlacementTarget::User => SkillPlacementTarget::Project,
            SkillPlacementTarget::Project => SkillPlacementTarget::Keep,
            SkillPlacementTarget::Deactivate => SkillPlacementTarget::None,
        }
    } else if skill.installed_on_one_agent() || skill.other {
        match target {
            SkillPlacementTarget::Keep => SkillPlacementTarget::None,
            SkillPlacementTarget::None if skill.can_deactivate() => {
                SkillPlacementTarget::Deactivate
            }
            SkillPlacementTarget::None => SkillPlacementTarget::User,
            SkillPlacementTarget::Deactivate => SkillPlacementTarget::User,
            SkillPlacementTarget::User => SkillPlacementTarget::Project,
            SkillPlacementTarget::Project => SkillPlacementTarget::Keep,
        }
    } else {
        match target {
            SkillPlacementTarget::Keep | SkillPlacementTarget::None => SkillPlacementTarget::User,
            SkillPlacementTarget::User => SkillPlacementTarget::Project,
            SkillPlacementTarget::Project => SkillPlacementTarget::None,
            SkillPlacementTarget::Deactivate => SkillPlacementTarget::User,
        }
    }
}

fn skill_placements_from_state(
    items: &[SkillTreeItem],
    placements: &BTreeMap<String, SkillPlacementTarget>,
) -> Vec<SkillPlacement> {
    items
        .iter()
        .filter_map(|item| {
            let target = skill_placement(placements, &item.name);
            (target != SkillPlacementTarget::None || (item.other && item.present() > 0)).then(
                || SkillPlacement {
                    name: item.name.clone(),
                    target,
                },
            )
        })
        .collect()
}

#[derive(Clone, Debug, Default)]
struct SkillTreePromptLayout {
    header_label_widths: BTreeMap<usize, usize>,
    skill_name_widths: BTreeMap<usize, usize>,
}

impl SkillTreePromptLayout {
    fn header_label_width(&self, level: usize) -> usize {
        self.header_label_widths
            .get(&level)
            .copied()
            .unwrap_or_default()
    }

    fn skill_name_width(&self, level: usize) -> usize {
        self.skill_name_widths
            .get(&level)
            .copied()
            .unwrap_or_default()
    }
}

fn skill_tree_prompt_layout(
    items: &[SkillTreeItem],
    rows: &[SkillTreeRow],
) -> SkillTreePromptLayout {
    let mut layout = SkillTreePromptLayout::default();

    for row in rows {
        match row {
            SkillTreeRow::Header { label, level, .. } => {
                let width = skill_tree_header_label_width(*level, label);
                let entry = layout.header_label_widths.entry(*level).or_default();
                *entry = (*entry).max(width);
            }
            SkillTreeRow::Skill { item, level, .. } => {
                let width = measure_text_width(&items[*item].name);
                let entry = layout.skill_name_widths.entry(*level).or_default();
                *entry = (*entry).max(width);
            }
        }
    }

    layout
}

fn skill_tree_header_label_width(level: usize, label: &str) -> usize {
    measure_text_width(&format!("{}▾ {label}", skill_tree_header_indent(level)))
}

fn render_skill_tree_prompt(
    term: &Term,
    items: &[SkillTreeItem],
    rows: &[SkillTreeRow],
    collapsed: &BTreeSet<String>,
    placements: &BTreeMap<String, SkillPlacementTarget>,
    touched: &BTreeSet<String>,
    search: &str,
    search_active: bool,
    mode: SkillTreePromptMode,
    cursor: usize,
    start: usize,
    max_rows: usize,
    rendered_lines: usize,
) -> Result<usize> {
    if rendered_lines > 0 {
        term.clear_last_lines(rendered_lines)?;
    }

    let end = (start + max_rows).min(rows.len());
    let layout = skill_tree_prompt_layout(items, rows);
    let mut lines = Vec::new();
    let title = match mode {
        SkillTreePromptMode::Setup => {
            "Which Power BI Agentic Development skills should be enabled?"
        }
        SkillTreePromptMode::Manage => "Which installed skills should be managed?",
    };
    lines.push(format!("{}  {}", timeline_symbol("◆"), title));
    lines.push(format!("{}  {}", timeline_symbol("│"), skill_tree_legend()));
    if search_active || !search.is_empty() {
        let query = if search.is_empty() {
            style("type to filter").dim().to_string()
        } else {
            style(search).cyan().to_string()
        };
        lines.push(format!(
            "{}  {} {}",
            timeline_symbol("│"),
            style("search").dim(),
            query
        ));
    }
    lines.push(format!("{}   ", timeline_symbol("│")));
    if start > 0 {
        lines.push(format!(
            "{}  {}",
            timeline_symbol("│"),
            style("↑ more").dim()
        ));
    }

    for (row_offset, row) in rows[start..end].iter().enumerate() {
        let active = start + row_offset == cursor;
        match row {
            SkillTreeRow::Header {
                key,
                label,
                summary,
                other,
                level,
            } => {
                let cursor_marker = if active {
                    cursor_glyph()
                } else {
                    " ".to_string()
                };
                let caret = if collapsed.contains(key) {
                    "▸"
                } else {
                    "▾"
                };
                let indent = skill_tree_header_indent(*level);
                let label_text = if *other {
                    let label = style(label).dim().to_string();
                    if active {
                        style(label).bold().to_string()
                    } else {
                        label
                    }
                } else if active {
                    style(label).yellow().bold().to_string()
                } else {
                    style(label).yellow().to_string()
                };
                let raw_label_width = skill_tree_header_label_width(*level, label);
                let summary_padding = layout
                    .header_label_width(*level)
                    .saturating_sub(raw_label_width)
                    + 1;
                let summary = if summary.is_empty() {
                    String::new()
                } else {
                    format!("{}{}", " ".repeat(summary_padding), style(summary).dim())
                };
                lines.push(format!(
                    "{}  {} {}{}",
                    timeline_symbol("│"),
                    cursor_marker,
                    format!("{indent}{} {label_text}", timeline_glyph(caret)),
                    summary
                ));
            }
            SkillTreeRow::Skill { item, last, level } => {
                let skill = &items[*item];
                let branch = skill_tree_skill_branch(*level, *last);
                let cursor_marker = if active {
                    cursor_glyph()
                } else {
                    " ".to_string()
                };
                let suffix_padding = layout
                    .skill_name_width(*level)
                    .saturating_sub(measure_text_width(&skill.name))
                    + 1;
                lines.push(format!(
                    "{}  {}  {} {} {}{}",
                    timeline_symbol("│"),
                    cursor_marker,
                    timeline_glyph(&branch),
                    skill_tree_marker(skill_placement(placements, &skill.name), active, skill),
                    skill_tree_name(skill, active),
                    skill_tree_suffix(skill, placements, touched, suffix_padding, mode)
                ));
            }
        }
    }

    if rows.is_empty() {
        lines.push(format!(
            "{}  {}",
            timeline_symbol("│"),
            style("No skills match the current search.").dim()
        ));
    }

    if end < rows.len() {
        lines.push(format!(
            "{}  {}",
            timeline_symbol("│"),
            style("↓ more").dim()
        ));
    }
    lines.push(format!(
        "{}  {}",
        timeline_symbol("└"),
        style(skill_tree_footer_hint(search, search_active)).dim()
    ));

    for line in &lines {
        term.write_line(line)?;
    }
    term.flush()?;
    Ok(lines.len())
}

fn skill_tree_footer_hint(search: &str, search_active: bool) -> &'static str {
    if search_active && search.is_empty() {
        "type to filter, ↑/↓ move, ←/→ placement, Shift+Tab apply to plugin, space fold, Esc stop search, enter apply"
    } else if search_active {
        "type to filter, Backspace edit, Esc clear search, ↑/↓ move, ←/→ placement, Shift+Tab apply to plugin, enter apply"
    } else {
        "↑/↓ move, ←/→ placement, Shift+Tab apply to plugin, type or / search, space fold, enter apply"
    }
}

fn skill_tree_legend() -> String {
    format!(
        "{} {}  {} {}  {} {}  {} {}  {} {}",
        style("●").yellow().bold(),
        style("project").dim(),
        style("◆").yellow().bold(),
        style("user").dim(),
        style("○").red().bold(),
        style("uninstall").dim(),
        style("◌").dim(),
        style("do nothing").dim(),
        style("◌").blue().bold(),
        style("deactivate").dim()
    )
}

fn skill_tree_header_indent(level: usize) -> String {
    "  ".repeat(level)
}

fn skill_tree_skill_branch(level: usize, last: bool) -> String {
    let branch = if last { "└─" } else { "├─" };
    format!("{}{}", "  ".repeat(level.saturating_sub(1)), branch)
}

fn render_skill_tree_submit(
    term: &Term,
    items: &[SkillTreeItem],
    placements: &BTreeMap<String, SkillPlacementTarget>,
    mode: SkillTreePromptMode,
) -> Result<()> {
    let project = items
        .iter()
        .filter(|item| skill_placement(placements, &item.name) == SkillPlacementTarget::Project)
        .count();
    let user = items
        .iter()
        .filter(|item| skill_placement(placements, &item.name) == SkillPlacementTarget::User)
        .count();
    let keep = items
        .iter()
        .filter(|item| skill_placement(placements, &item.name) == SkillPlacementTarget::Keep)
        .count();
    let deactivate = items
        .iter()
        .filter(|item| skill_placement(placements, &item.name) == SkillPlacementTarget::Deactivate)
        .count();
    let label = if project == 0 && user == 0 && keep == 0 && deactivate == 0 {
        "all skills set to none".to_string()
    } else {
        format!("{project} project, {user} user, {keep} keep, {deactivate} deactivate")
    };
    term.write_line(&format!(
        "{}  {}",
        timeline_symbol("◇"),
        match mode {
            SkillTreePromptMode::Setup =>
                "Which Power BI Agentic Development skills should be enabled?",
            SkillTreePromptMode::Manage => "Which installed skills should be managed?",
        }
    ))?;
    term.write_line(&format!("{}  {}", timeline_symbol("│"), label))?;
    term.write_line(&timeline_symbol("│"))?;
    term.flush()?;
    Ok(())
}

fn skill_tree_marker(target: SkillPlacementTarget, active: bool, skill: &SkillTreeItem) -> String {
    match target {
        SkillPlacementTarget::Keep if skill.has_dual_scope_conflict() => {
            style("✕").red().bold().to_string()
        }
        SkillPlacementTarget::Keep if active => style("◌").yellow().to_string(),
        SkillPlacementTarget::Keep => style("◌").dim().to_string(),
        SkillPlacementTarget::Project if skill_fully_installed(skill, InstallScope::Project) => {
            style("●").green().bold().to_string()
        }
        SkillPlacementTarget::Project => style("●").yellow().bold().to_string(),
        SkillPlacementTarget::User if skill_fully_installed(skill, InstallScope::User) => {
            style("◆").green().bold().to_string()
        }
        SkillPlacementTarget::User => style("◆").yellow().bold().to_string(),
        SkillPlacementTarget::Deactivate => style("◌").blue().bold().to_string(),
        SkillPlacementTarget::None if skill.present() > 0 => style("○").red().bold().to_string(),
        SkillPlacementTarget::None if active => style("○").yellow().to_string(),
        SkillPlacementTarget::None => style("○").dim().to_string(),
    }
}

fn skill_tree_name(skill: &SkillTreeItem, active: bool) -> String {
    if skill.other {
        let label = style(&skill.name).dim().to_string();
        if active {
            style(label).bold().to_string()
        } else {
            label
        }
    } else if active {
        style(&skill.name).bold().to_string()
    } else {
        skill.name.clone()
    }
}

fn skill_tree_suffix(
    skill: &SkillTreeItem,
    placements: &BTreeMap<String, SkillPlacementTarget>,
    touched: &BTreeSet<String>,
    padding: usize,
    mode: SkillTreePromptMode,
) -> String {
    let mut parts = Vec::new();
    let target = skill_placement(placements, &skill.name);
    let was_touched = touched.contains(&skill.name);
    let label = match mode {
        SkillTreePromptMode::Manage => manage_action_label(skill, target),
        SkillTreePromptMode::Setup => skill_action_label(skill, target, was_touched),
    };
    if let Some(label) = label {
        parts.push(label);
    }
    if skill.show_usage {
        parts.push(style(last_used_label(skill.last_used)).dim().to_string());
    } else if let Some(version) = &skill.version {
        parts.push(style(version).dim().to_string());
    }
    if let Some(warning) = redundant_skill_warning(&skill.name, placements) {
        parts.push(warning_text(&warning));
    }
    if parts.is_empty() {
        String::new()
    } else {
        format!("{}{}", " ".repeat(padding.max(1)), parts.join(" "))
    }
}

fn skill_action_label(
    skill: &SkillTreeItem,
    target: SkillPlacementTarget,
    touched: bool,
) -> Option<String> {
    if touched {
        return match target {
            SkillPlacementTarget::Keep => Some(keep_label(skill)),
            SkillPlacementTarget::Project => Some(style("(project)").yellow().to_string()),
            SkillPlacementTarget::User => Some(style("(user)").yellow().to_string()),
            SkillPlacementTarget::Deactivate if skill.present() > 0 => {
                Some(style("(deactivate)").blue().bold().to_string())
            }
            SkillPlacementTarget::Deactivate => None,
            SkillPlacementTarget::None if skill.installed() > 0 => {
                Some(style("(uninstall)").red().bold().to_string())
            }
            SkillPlacementTarget::None if skill.deactivated() > 0 => {
                Some(style("(uninstall)").red().bold().to_string())
            }
            SkillPlacementTarget::None => None,
        };
    }

    match target {
        SkillPlacementTarget::Keep => Some(keep_label(skill)),
        SkillPlacementTarget::Project if skill_fully_installed(skill, InstallScope::Project) => {
            Some(style("(installed: project)").green().bold().to_string())
        }
        SkillPlacementTarget::User if skill_fully_installed(skill, InstallScope::User) => {
            Some(style("(installed: user)").green().bold().to_string())
        }
        SkillPlacementTarget::Project => Some(style("(project)").yellow().to_string()),
        SkillPlacementTarget::User => Some(style("(user)").yellow().to_string()),
        SkillPlacementTarget::Deactivate if skill.deactivated() > 0 && skill.installed() == 0 => {
            Some(style("(deactivated)").blue().bold().to_string())
        }
        SkillPlacementTarget::Deactivate => Some(style("(deactivate)").blue().bold().to_string()),
        SkillPlacementTarget::None => {
            let installed = installed_scope_label(skill);
            let deactivated = deactivated_scope_label(skill);
            if installed.is_empty() && deactivated.is_empty() {
                None
            } else if skill_fully_installed_any_scope(skill) {
                Some(
                    style(format!("(installed: {installed})"))
                        .green()
                        .bold()
                        .to_string(),
                )
            } else if installed.is_empty() {
                Some(
                    style(format!("(deactivated: {deactivated})"))
                        .blue()
                        .to_string(),
                )
            } else {
                Some(warning_text(&format!("(installed: {installed})")))
            }
        }
    }
}

fn manage_action_label(skill: &SkillTreeItem, target: SkillPlacementTarget) -> Option<String> {
    match target {
        SkillPlacementTarget::Keep if skill.has_dual_scope_conflict() => Some(warning_text(
            &format!("(project+user {}/{})", skill.dual_scope_agents, skill.agent_count),
        )),
        SkillPlacementTarget::Keep if skill.deactivated() > 0 && skill.installed() == 0 => {
            Some(style("(deactivated)").blue().to_string())
        }
        SkillPlacementTarget::Keep => Some(style("(keep)").dim().to_string()),
        SkillPlacementTarget::Project => Some(manage_scope_label(skill, InstallScope::Project)),
        SkillPlacementTarget::User => Some(manage_scope_label(skill, InstallScope::User)),
        SkillPlacementTarget::Deactivate if skill.present() > 0 => {
            Some(style("(deactivate)").blue().bold().to_string())
        }
        SkillPlacementTarget::Deactivate => None,
        SkillPlacementTarget::None if skill.present() > 0 => {
            Some(style("(uninstall)").red().bold().to_string())
        }
        SkillPlacementTarget::None => None,
    }
}

fn manage_scope_label(skill: &SkillTreeItem, scope: InstallScope) -> String {
    if skill_fully_installed(skill, scope) && !present_in_other_scope(skill, scope) {
        style("(installed)").green().bold().to_string()
    } else if present_in_other_scope(skill, scope) {
        style("(move)").yellow().to_string()
    } else {
        style("(install)").yellow().to_string()
    }
}

fn keep_label(skill: &SkillTreeItem) -> String {
    if skill.has_dual_scope_conflict() {
        return warning_text(&format!(
            "(installed: project+user {}/{})",
            skill.dual_scope_agents, skill.agent_count
        ));
    }
    let installed = installed_scope_label(skill);
    let deactivated = deactivated_scope_label(skill);
    if installed.is_empty() && deactivated.is_empty() {
        style("(keep)").dim().to_string()
    } else if installed.is_empty() {
        style(format!("(keep: deactivated {deactivated})"))
            .blue()
            .to_string()
    } else {
        style(format!("(keep: {installed})")).dim().to_string()
    }
}

fn skill_fully_installed(skill: &SkillTreeItem, scope: InstallScope) -> bool {
    skill.agent_count > 0
        && match scope {
            InstallScope::Project => skill.project_installed >= skill.agent_count,
            InstallScope::User => skill.user_installed >= skill.agent_count,
        }
}

fn skill_fully_installed_any_scope(skill: &SkillTreeItem) -> bool {
    skill_fully_installed(skill, InstallScope::Project)
        || skill_fully_installed(skill, InstallScope::User)
}

fn installed_scope_label(skill: &SkillTreeItem) -> String {
    let mut parts = Vec::new();
    if skill.project_installed > 0 {
        parts.push(scope_count_label(
            "project",
            skill.project_installed,
            skill.agent_count,
        ));
    }
    if skill.user_installed > 0 {
        parts.push(scope_count_label(
            "user",
            skill.user_installed,
            skill.agent_count,
        ));
    }
    parts.join("+")
}

fn deactivated_scope_label(skill: &SkillTreeItem) -> String {
    let mut parts = Vec::new();
    if skill.project_deactivated > 0 {
        parts.push(scope_count_label(
            "project",
            skill.project_deactivated,
            skill.agent_count,
        ));
    }
    if skill.user_deactivated > 0 {
        parts.push(scope_count_label(
            "user",
            skill.user_deactivated,
            skill.agent_count,
        ));
    }
    parts.join("+")
}

fn scope_count_label(scope: &str, installed: usize, agents: usize) -> String {
    if agents > 1 && installed < agents {
        format!("{scope} {installed}/{agents}")
    } else {
        scope.to_string()
    }
}

fn redundant_skill_warning(
    name: &str,
    placements: &BTreeMap<String, SkillPlacementTarget>,
) -> Option<String> {
    if !skill_target_enabled(skill_placement(placements, name)) {
        return None;
    }

    let counterpart = match name {
        "te-cli" if skill_target_enabled(skill_placement(placements, "connect-pbid")) => {
            Some("connect-pbid")
        }
        "connect-pbid" if skill_target_enabled(skill_placement(placements, "te-cli")) => {
            Some("te-cli")
        }
        "pbir-cli" if skill_target_enabled(skill_placement(placements, "pbir-format")) => {
            Some("pbir-format")
        }
        "pbir-format" if skill_target_enabled(skill_placement(placements, "pbir-cli")) => {
            Some("pbir-cli")
        }
        _ => None,
    }?;

    Some(format!(
        "overlaps with {counterpart}; choose one unless both are needed"
    ))
}

fn skill_target_enabled(target: SkillPlacementTarget) -> bool {
    matches!(
        target,
        SkillPlacementTarget::Project | SkillPlacementTarget::User
    )
}

fn default_skill_placements(
    registry: &Registry,
    recs: &[Recommendation],
    inventory: &Inventory,
    agents: &[AgentKind],
    default_scope: InstallScope,
) -> Vec<SkillPlacement> {
    let mut placements = BTreeMap::new();

    for (_, skill) in registry.skills() {
        if is_deprecated_skill(&skill.name) {
            continue;
        }
        let project = installed_skill_count(inventory, agents, InstallScope::Project, &skill.name);
        let user = installed_skill_count(inventory, agents, InstallScope::User, &skill.name);
        let installed_agents = installed_skill_agent_count(inventory, agents, &skill.name);
        if !agents.is_empty() && installed_agents >= agents.len() {
            if project >= user && project > 0 {
                placements.insert(skill.name.clone(), SkillPlacementTarget::Project);
            } else if user > 0 {
                placements.insert(skill.name.clone(), SkillPlacementTarget::User);
            }
        }
    }

    let recommended_target = skill_target_from_scope(default_scope);
    for rec in recs {
        if let Some(plugin) = registry.plugin(&rec.plugin) {
            for skill in &plugin.skills {
                if !is_deprecated_skill(&skill.name) {
                    placements
                        .entry(skill.name.clone())
                        .or_insert(recommended_target);
                }
            }
        }
    }

    placements
        .into_iter()
        .map(|(name, target)| SkillPlacement { name, target })
        .collect()
}

fn default_skill_setup_selection(
    registry: &Registry,
    recs: &[Recommendation],
    inventory: &Inventory,
    agents: &[AgentKind],
    default_scope: InstallScope,
    install_detected: bool,
) -> SkillSetupSelection {
    let mut placements = default_skill_placements(registry, recs, inventory, agents, default_scope);
    let selected = placements
        .iter()
        .map(|placement| placement.name.clone())
        .collect::<BTreeSet<_>>();
    for partial in partial_skill_installs(registry, inventory, agents)
        .into_iter()
        .filter(|partial| !selected.contains(&partial.name))
    {
        placements.push(SkillPlacement {
            name: partial.name,
            target: if install_detected {
                partial.target
            } else {
                SkillPlacementTarget::Keep
            },
        });
    }

    SkillSetupSelection {
        placements,
        preserve_skills: Vec::new(),
    }
}

fn skill_target_from_scope(scope: InstallScope) -> SkillPlacementTarget {
    match scope {
        InstallScope::Project => SkillPlacementTarget::Project,
        InstallScope::User => SkillPlacementTarget::User,
    }
}

fn installed_skill_count(
    inventory: &Inventory,
    agents: &[AgentKind],
    scope: InstallScope,
    skill_name: &str,
) -> usize {
    agents
        .iter()
        .filter(|agent| {
            inventory
                .for_agent(**agent)
                .map(|agent_inventory| agent_inventory.skill_names(scope).contains(skill_name))
                .unwrap_or(false)
        })
        .count()
}

fn installed_skill_agent_count(
    inventory: &Inventory,
    agents: &[AgentKind],
    skill_name: &str,
) -> usize {
    agents
        .iter()
        .filter(|agent| {
            inventory
                .for_agent(**agent)
                .map(|agent_inventory| {
                    agent_inventory
                        .skill_names(InstallScope::Project)
                        .contains(skill_name)
                        || agent_inventory
                            .skill_names(InstallScope::User)
                            .contains(skill_name)
                })
                .unwrap_or(false)
        })
        .count()
}

fn deactivated_skill_count(
    inventory: &Inventory,
    agents: &[AgentKind],
    scope: InstallScope,
    skill_name: &str,
) -> usize {
    agents
        .iter()
        .filter(|agent| {
            inventory
                .for_agent(**agent)
                .map(|agent_inventory| {
                    agent_inventory
                        .deactivated_skill_names(scope)
                        .contains(skill_name)
                })
                .unwrap_or(false)
        })
        .count()
}

fn dual_scope_skill_agent_count(
    inventory: &Inventory,
    agents: &[AgentKind],
    skill_name: &str,
) -> usize {
    agents
        .iter()
        .filter(|agent| {
            inventory
                .for_agent(**agent)
                .map(|agent_inventory| {
                    agent_inventory
                        .skill_names(InstallScope::Project)
                        .contains(skill_name)
                        && agent_inventory
                            .skill_names(InstallScope::User)
                            .contains(skill_name)
                })
                .unwrap_or(false)
        })
        .count()
}

fn registry_skill_names(registry: &Registry) -> BTreeSet<String> {
    registry
        .skills()
        .filter(|(_, skill)| !is_deprecated_skill(&skill.name))
        .map(|(_, skill)| skill.name.clone())
        .collect()
}

fn registry_skill_plugins(registry: &Registry) -> BTreeMap<String, SkillPluginInfo> {
    registry
        .skills()
        .filter(|(_, skill)| !is_deprecated_skill(&skill.name))
        .map(|(plugin, skill)| {
            (
                skill.name.clone(),
                SkillPluginInfo::registry(plugin.name.clone()),
            )
        })
        .collect()
}

fn detected_skill_plugins(
    registry: &Registry,
    inventory: &Inventory,
    agents: &[AgentKind],
) -> BTreeMap<String, SkillPluginInfo> {
    let mut plugins = registry_skill_plugins(registry);
    for resource in installed_skill_resources(inventory, agents) {
        if plugins.contains_key(&resource.name) {
            continue;
        }
        if let Some(plugin) = plugin_from_installed_skill_path(&resource.path) {
            plugins.insert(resource.name.clone(), SkillPluginInfo::detected(plugin));
        }
    }
    plugins
}

fn installed_skill_resources<'a>(
    inventory: &'a Inventory,
    agents: &[AgentKind],
) -> Vec<&'a crate::inventory::InstalledResource> {
    let mut resources = Vec::new();
    for agent in agents {
        let Some(agent_inventory) = inventory.for_agent(*agent) else {
            continue;
        };
        resources.extend(agent_inventory.project_skills.iter());
        resources.extend(agent_inventory.user_skills.iter());
        resources.extend(agent_inventory.project_deactivated_skills.iter());
        resources.extend(agent_inventory.user_deactivated_skills.iter());
    }
    resources
}

fn installed_skill_file_counts(
    inventory: &Inventory,
    agents: &[AgentKind],
) -> BTreeMap<String, usize> {
    let mut counts = BTreeMap::<String, usize>::new();
    for resource in installed_skill_resources(inventory, agents) {
        let count = skill_file_count(&resource.path);
        counts
            .entry(resource.name.clone())
            .and_modify(|existing| *existing = (*existing).max(count))
            .or_insert(count);
    }
    counts
}

fn skill_file_count(path: &Path) -> usize {
    if path.file_name().and_then(|name| name.to_str()) != Some("SKILL.md") {
        return 1;
    }
    let Some(root) = path.parent() else {
        return 1;
    };
    let count = WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .count();
    count.max(1)
}

#[derive(Clone, Copy)]
struct InstalledSkillEntry<'a> {
    agent: AgentKind,
    scope: InstallScope,
    deactivated: bool,
    resource: &'a crate::inventory::InstalledResource,
}

fn installed_skill_entries<'a>(
    inventory: &'a Inventory,
    agents: &[AgentKind],
) -> Vec<InstalledSkillEntry<'a>> {
    let mut entries = Vec::new();
    for agent in agents {
        let Some(agent_inventory) = inventory.for_agent(*agent) else {
            continue;
        };
        entries.extend(
            agent_inventory
                .project_skills
                .iter()
                .map(|resource| InstalledSkillEntry {
                    agent: *agent,
                    scope: InstallScope::Project,
                    deactivated: false,
                    resource,
                }),
        );
        entries.extend(
            agent_inventory
                .user_skills
                .iter()
                .map(|resource| InstalledSkillEntry {
                    agent: *agent,
                    scope: InstallScope::User,
                    deactivated: false,
                    resource,
                }),
        );
        entries.extend(
            agent_inventory
                .project_deactivated_skills
                .iter()
                .map(|resource| InstalledSkillEntry {
                    agent: *agent,
                    scope: InstallScope::Project,
                    deactivated: true,
                    resource,
                }),
        );
        entries.extend(
            agent_inventory
                .user_deactivated_skills
                .iter()
                .map(|resource| InstalledSkillEntry {
                    agent: *agent,
                    scope: InstallScope::User,
                    deactivated: true,
                    resource,
                }),
        );
    }
    entries
}

fn list_entry_plugin(plugins: &BTreeMap<String, SkillPluginInfo>, skill_name: &str) -> String {
    plugins
        .get(skill_name)
        .map(|plugin| plugin.name.clone())
        .unwrap_or_else(|| "no plugin".to_string())
}

fn plugin_from_installed_skill_path(path: &Path) -> Option<String> {
    let components = path
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .collect::<Vec<_>>();
    for window in components.windows(6) {
        if window[0] == "plugins" && window[1] == "cache" && window[5] == "skills" {
            return Some(window[3].to_string());
        }
    }
    None
}

fn partial_skill_installs(
    registry: &Registry,
    inventory: &Inventory,
    agents: &[AgentKind],
) -> Vec<PartialSkillInstall> {
    if agents.len() <= 1 {
        return Vec::new();
    }

    registry
        .skills()
        .filter(|(_, skill)| !is_deprecated_skill(&skill.name))
        .filter_map(|(_, skill)| {
            let installed_agents = installed_skill_agent_count(inventory, agents, &skill.name);
            (installed_agents == 1).then(|| {
                let project =
                    installed_skill_count(inventory, agents, InstallScope::Project, &skill.name);
                let user =
                    installed_skill_count(inventory, agents, InstallScope::User, &skill.name);
                let target = if user > project {
                    SkillPlacementTarget::User
                } else {
                    SkillPlacementTarget::Project
                };
                PartialSkillInstall {
                    name: skill.name.clone(),
                    target,
                }
            })
        })
        .collect()
}

fn unresolved_dual_scope_conflicts(
    items: &[SkillTreeItem],
    placements: &BTreeMap<String, SkillPlacementTarget>,
) -> Option<Vec<SkillTreeItem>> {
    let conflicts = items
        .iter()
        .filter(|item| {
            item.has_dual_scope_conflict()
                && matches!(
                    skill_placement(placements, &item.name),
                    SkillPlacementTarget::Keep | SkillPlacementTarget::Deactivate
                )
        })
        .cloned()
        .collect::<Vec<_>>();

    (!conflicts.is_empty()).then_some(conflicts)
}

fn dual_scope_conflict_note(conflicts: &[SkillTreeItem]) -> String {
    conflicts
        .iter()
        .take(12)
        .map(|skill| {
            warning_list_item(&format!(
                "{} is installed at project and user level ({}/{})",
                skill.name, skill.dual_scope_agents, skill.agent_count
            ))
        })
        .chain(
            (conflicts.len() > 12)
                .then(|| warning_list_item(&format!("{} more", conflicts.len() - 12))),
        )
        .collect::<Vec<_>>()
        .join("\n")
}

#[derive(Clone, Copy, Debug, Default)]
struct SkillChangeCounts {
    install: usize,
    remove: usize,
}

impl SkillChangeCounts {
    fn is_empty(self) -> bool {
        self.install == 0 && self.remove == 0
    }
}

fn skill_change_counts(
    registry: &Registry,
    inventory: &Inventory,
    agents: &[AgentKind],
    placements: &[SkillPlacement],
    preserve_skills: &[String],
) -> SkillChangeCounts {
    let targets = placements
        .iter()
        .map(|placement| (placement.name.as_str(), placement.target))
        .collect::<BTreeMap<_, _>>();
    let preserve = preserve_skills
        .iter()
        .map(String::as_str)
        .collect::<BTreeSet<_>>();
    let mut counts = SkillChangeCounts::default();

    for agent in agents {
        let project = inventory
            .for_agent(*agent)
            .map(|agent_inventory| agent_inventory.skill_names(InstallScope::Project))
            .unwrap_or_default();
        let user = inventory
            .for_agent(*agent)
            .map(|agent_inventory| agent_inventory.skill_names(InstallScope::User))
            .unwrap_or_default();
        let deactivated_project = inventory
            .for_agent(*agent)
            .map(|agent_inventory| agent_inventory.deactivated_skill_names(InstallScope::Project))
            .unwrap_or_default();
        let deactivated_user = inventory
            .for_agent(*agent)
            .map(|agent_inventory| agent_inventory.deactivated_skill_names(InstallScope::User))
            .unwrap_or_default();
        let registry_names = registry
            .skills()
            .filter(|(_, skill)| !is_deprecated_skill(&skill.name))
            .map(|(_, skill)| skill.name.as_str())
            .collect::<BTreeSet<_>>();
        for (_, skill) in registry.skills() {
            if preserve.contains(skill.name.as_str()) && !targets.contains_key(skill.name.as_str())
            {
                continue;
            }
            let is_project = project.contains(skill.name.as_str());
            let is_user = user.contains(skill.name.as_str());
            let is_deactivated_project = deactivated_project.contains(skill.name.as_str());
            let is_deactivated_user = deactivated_user.contains(skill.name.as_str());
            match targets
                .get(skill.name.as_str())
                .copied()
                .unwrap_or(SkillPlacementTarget::None)
            {
                SkillPlacementTarget::Keep => {}
                SkillPlacementTarget::Project => {
                    if !is_project {
                        counts.install += 1;
                    }
                    if is_user || is_deactivated_user {
                        counts.remove += 1;
                    }
                }
                SkillPlacementTarget::User => {
                    if !is_user {
                        counts.install += 1;
                    }
                    if is_project || is_deactivated_project {
                        counts.remove += 1;
                    }
                }
                SkillPlacementTarget::Deactivate => {
                    if is_project || is_user {
                        counts.remove += 1;
                    }
                }
                SkillPlacementTarget::None => {
                    if is_project || is_deactivated_project {
                        counts.remove += 1;
                    }
                    if is_user || is_deactivated_user {
                        counts.remove += 1;
                    }
                }
            }
        }

        for (name, target) in targets
            .iter()
            .filter(|(name, _)| !registry_names.contains(**name))
        {
            let is_project = project.contains(*name);
            let is_user = user.contains(*name);
            let is_deactivated_project = deactivated_project.contains(*name);
            let is_deactivated_user = deactivated_user.contains(*name);
            match target {
                SkillPlacementTarget::Keep => {}
                SkillPlacementTarget::Project => {
                    if !is_project && (is_user || is_deactivated_project || is_deactivated_user) {
                        counts.install += 1;
                    }
                    if is_user || is_deactivated_user {
                        counts.remove += 1;
                    }
                }
                SkillPlacementTarget::User => {
                    if !is_user && (is_project || is_deactivated_project || is_deactivated_user) {
                        counts.install += 1;
                    }
                    if is_project || is_deactivated_project {
                        counts.remove += 1;
                    }
                }
                SkillPlacementTarget::Deactivate => {
                    if is_project || is_user {
                        counts.remove += 1;
                    }
                }
                SkillPlacementTarget::None => {
                    if is_project || is_deactivated_project {
                        counts.remove += 1;
                    }
                    if is_user || is_deactivated_user {
                        counts.remove += 1;
                    }
                }
            }
        }
    }

    counts
}

fn agent_hint(inventory: &Inventory, agent: AgentKind) -> String {
    let Some(agent_inventory) = inventory.for_agent(agent) else {
        return String::new();
    };
    let project_skills = agent_inventory.skill_count(InstallScope::Project);
    let project_subagents = agent_inventory.subagent_count(InstallScope::Project);
    let mut parts = Vec::new();
    if project_skills > 0 {
        parts.push(format!("{project_skills} project skills"));
    }
    if project_subagents > 0 {
        parts.push(format!("{project_subagents} project subagents"));
    }
    parts.join(" · ")
}

#[cfg(feature = "plugins")]
fn plugin_hint(summary: String, coverage: &str) -> String {
    if coverage.is_empty() {
        summary
    } else {
        format!("{summary} · installed {coverage}")
    }
}

fn validate_skill_names(registry: &Registry, names: &[String]) -> Result<()> {
    for name in names {
        validate_registry_skill_name(registry, name)?;
    }
    Ok(())
}

fn validate_registry_skill_name(registry: &Registry, name: &str) -> Result<()> {
    if is_deprecated_skill(name) {
        return Err(anyhow!("{} is deprecated; use `te-cli` instead", name));
    }
    if registry.skill(name).is_none() {
        if registry.plugin(name).is_some() {
            return Err(anyhow!(
                "{} is a plugin bundle; use `pbiad plugins add {}`",
                name,
                name
            ));
        }
        return Err(anyhow!("unknown skill: {}", name));
    }
    Ok(())
}

#[cfg(feature = "plugins")]
fn validate_plugin_names(registry: &Registry, names: &[String]) -> Result<()> {
    for name in names {
        if registry.plugin(name).is_none() {
            if registry.skill(name).is_some() {
                return Err(anyhow!(
                    "{} is an individual skill; use `pbiad skills add {}`",
                    name,
                    name
                ));
            }
            return Err(anyhow!("unknown plugin bundle: {}", name));
        }
    }
    Ok(())
}

fn print_memory_summary(memory: &MemoryInventory) {
    let lines = memory
        .entries
        .iter()
        .map(|entry| entry.lines)
        .sum::<usize>();
    println!("\n{}", style("Memory & rules").bold());
    println!(
        "  {} file(s), {} lines, ~{} tokens",
        memory.entries.len(),
        format_count(lines),
        format_count(memory.total_approx_tokens)
    );
}

fn selected_memory_agents(
    memory: &MemoryInventory,
    requested: &[AgentKind],
) -> Result<Vec<AgentKind>> {
    if !requested.is_empty() {
        return Ok(requested.to_vec());
    }
    if !std::io::stderr().is_terminal() {
        return Ok(Vec::new());
    }

    let mut candidates = memory
        .entries
        .iter()
        .filter_map(|entry| entry.agent)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    if candidates.is_empty() {
        return Ok(Vec::new());
    }
    candidates.sort();

    let mut prompt = cliclack::multiselect("Which agents' memory should be shown?")
        .required(false)
        .max_rows(12);
    for agent in &candidates {
        let files = memory
            .entries
            .iter()
            .filter(|entry| entry.agent == Some(*agent))
            .count();
        let tokens = memory
            .entries
            .iter()
            .filter(|entry| entry.agent == Some(*agent))
            .map(|entry| entry.approx_tokens)
            .sum::<usize>();
        let lines = memory
            .entries
            .iter()
            .filter(|entry| entry.agent == Some(*agent))
            .map(|entry| entry.lines)
            .sum::<usize>();
        prompt = prompt.item(
            *agent,
            agent.display_name(),
            format!(
                "{files} files · {} lines · ~{} tokens",
                format_count(lines),
                format_count(tokens)
            ),
        );
    }
    Ok(prompt.initial_values(candidates).interact()?)
}

fn filter_memory_entries(entries: &[MemoryEntry], agents: &[AgentKind]) -> Vec<MemoryEntry> {
    if agents.is_empty() {
        return entries.to_vec();
    }
    let selected = agents.iter().copied().collect::<BTreeSet<_>>();
    entries
        .iter()
        .filter(|entry| {
            entry
                .agent
                .map(|agent| selected.contains(&agent))
                .unwrap_or(true)
        })
        .cloned()
        .collect()
}

fn print_memory_inventory(memory: &MemoryInventory, project_root: &Path) {
    println!("{}", style("Memory & rules").bold());
    if memory.entries.is_empty() {
        println!("  No memory, rules, instruction, or prompt files detected.");
        return;
    }
    print_memory_scope(memory, MemoryScope::User, None);
    print_memory_scope(memory, MemoryScope::Project, Some(project_root));
    println!(
        "\n{}",
        style(format!(
            "Total: {} lines · ~{} tokens across {} file(s) · {} of 1M context",
            format_count(total_memory_lines(memory)),
            format_count(memory.total_approx_tokens),
            memory.entries.len(),
            context_percent(memory.total_approx_tokens)
        ))
        .dim()
    );
}

fn print_memory_scope(memory: &MemoryInventory, scope: MemoryScope, project_root: Option<&Path>) {
    let scoped = memory
        .entries
        .iter()
        .filter(|entry| entry.scope == scope)
        .collect::<Vec<_>>();
    if scoped.is_empty() {
        return;
    }

    let path = match scope {
        MemoryScope::User => common_parent(scoped.iter().map(|entry| entry.path.as_path())),
        MemoryScope::Project => project_root
            .map(|path| path.canonicalize().unwrap_or_else(|_| path.to_path_buf()))
            .or_else(|| common_parent(scoped.iter().map(|entry| entry.path.as_path()))),
    };
    let marker = match scope {
        MemoryScope::User => "◆",
        MemoryScope::Project => "●",
    };
    let label = match scope {
        MemoryScope::User => "User",
        MemoryScope::Project => "Project",
    };
    let tokens = scoped
        .iter()
        .map(|entry| entry.approx_tokens)
        .sum::<usize>();
    let lines = scoped.iter().map(|entry| entry.lines).sum::<usize>();
    println!();
    println!(
        "{} {} {} {}",
        style(marker).yellow().bold(),
        style(label).yellow().bold(),
        path.as_ref()
            .map(|path| style(path.display()).dim().to_string())
            .unwrap_or_default(),
        style(format!(
            "{} lines · ~{} tokens · {}",
            format_count(lines),
            format_count(tokens),
            context_percent(tokens)
        ))
        .dim()
    );

    for kind in [
        MemoryKind::Rules,
        MemoryKind::Memory,
        MemoryKind::Instructions,
        MemoryKind::Prompt,
    ] {
        print_memory_kind_tree(&scoped, kind);
    }
}

fn print_memory_kind_tree(entries: &[&MemoryEntry], kind: MemoryKind) {
    let kind_entries = entries
        .iter()
        .copied()
        .filter(|entry| entry.kind == kind)
        .collect::<Vec<_>>();
    if kind_entries.is_empty() {
        return;
    }
    let tokens = kind_entries
        .iter()
        .map(|entry| entry.approx_tokens)
        .sum::<usize>();
    let lines = kind_entries.iter().map(|entry| entry.lines).sum::<usize>();
    println!(
        "  {} {}",
        style(kind.to_string()).yellow().bold(),
        style(format!(
            "{} lines · ~{} tokens · {}",
            format_count(lines),
            format_count(tokens),
            context_percent(tokens)
        ))
        .dim()
    );

    let children = memory_children_by_parent(&kind_entries);
    let top_level = memory_top_level_entries(&kind_entries);
    let layout = memory_tree_layout(&kind_entries);
    for (idx, entry) in top_level.iter().enumerate() {
        print_memory_tree_entry(entry, &children, "", idx + 1 == top_level.len(), layout);
    }
}

fn memory_children_by_parent(entries: &[&MemoryEntry]) -> BTreeMap<PathBuf, Vec<MemoryEntry>> {
    let mut children = BTreeMap::<PathBuf, Vec<MemoryEntry>>::new();
    for entry in entries {
        if let Some(parent) = &entry.included_by {
            children
                .entry(parent.clone())
                .or_default()
                .push((*entry).clone());
        }
    }
    for entries in children.values_mut() {
        entries.sort_by(|a, b| {
            b.approx_tokens
                .cmp(&a.approx_tokens)
                .then_with(|| a.path.cmp(&b.path))
        });
    }
    children
}

fn memory_top_level_entries(entries: &[&MemoryEntry]) -> Vec<MemoryEntry> {
    let paths = entries
        .iter()
        .map(|entry| entry.path.clone())
        .collect::<BTreeSet<_>>();
    let mut top_level = entries
        .iter()
        .filter(|entry| {
            entry
                .included_by
                .as_ref()
                .map(|parent| !paths.contains(parent))
                .unwrap_or(true)
        })
        .map(|entry| (*entry).clone())
        .collect::<Vec<_>>();
    top_level.sort_by(|a, b| {
        b.approx_tokens
            .cmp(&a.approx_tokens)
            .then_with(|| a.path.cmp(&b.path))
    });
    top_level
}

#[derive(Clone, Copy)]
struct MemoryTreeLayout {
    name: usize,
    lines: usize,
    tokens: usize,
}

fn memory_tree_layout(entries: &[&MemoryEntry]) -> MemoryTreeLayout {
    MemoryTreeLayout {
        name: entries
            .iter()
            .map(|entry| {
                measure_text_width(&memory_file_name(&entry.path)) + entry.include_depth * 3
            })
            .max()
            .unwrap_or(12)
            .max(12),
        lines: entries
            .iter()
            .map(|entry| format_count(entry.lines).len())
            .max()
            .unwrap_or(1)
            .max(5),
        tokens: entries
            .iter()
            .map(|entry| format_count(entry.approx_tokens).len())
            .max()
            .unwrap_or(1)
            .max(6),
    }
}

fn print_memory_tree_entry(
    entry: &MemoryEntry,
    children: &BTreeMap<PathBuf, Vec<MemoryEntry>>,
    prefix: &str,
    last: bool,
    layout: MemoryTreeLayout,
) {
    let branch = if last { "└─" } else { "├─" };
    let child_prefix = if last { "   " } else { "│  " };
    let name = memory_file_name(&entry.path);
    let raw_name = format!("{prefix}{branch} {name}");
    let styled_name = format!(
        "{} {}",
        timeline_glyph(&format!("{prefix}{branch}")),
        style(name).white()
    );
    let name_padding = " ".repeat((layout.name + 3).saturating_sub(measure_text_width(&raw_name)));
    println!(
        "  {}{} {:>lines_width$} lines  ~{:>tokens_width$} tokens  {:>7}",
        styled_name,
        name_padding,
        style(format_count(entry.lines)).dim(),
        style(format_count(entry.approx_tokens)).dim(),
        style(context_percent(entry.approx_tokens)).dim(),
        lines_width = layout.lines,
        tokens_width = layout.tokens
    );
    if let Some(nested) = children.get(&entry.path) {
        let next_prefix = format!("{prefix}{child_prefix}");
        for (idx, child) in nested.iter().enumerate() {
            print_memory_tree_entry(
                child,
                children,
                &next_prefix,
                idx + 1 == nested.len(),
                layout,
            );
        }
    }
}

fn total_memory_lines(memory: &MemoryInventory) -> usize {
    memory.entries.iter().map(|entry| entry.lines).sum()
}

fn memory_file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_else(|| path.to_str().unwrap_or("memory"))
        .to_string()
}

fn common_parent<'a>(paths: impl Iterator<Item = &'a Path>) -> Option<PathBuf> {
    let mut paths = paths.peekable();
    let first = paths.next()?;
    let mut components = first
        .parent()
        .unwrap_or(first)
        .components()
        .map(|component| component.as_os_str().to_os_string())
        .collect::<Vec<_>>();
    for path in paths {
        let next = path
            .parent()
            .unwrap_or(path)
            .components()
            .map(|component| component.as_os_str().to_os_string())
            .collect::<Vec<_>>();
        let shared = components
            .iter()
            .zip(next.iter())
            .take_while(|(left, right)| left == right)
            .count();
        components.truncate(shared);
    }
    if components.is_empty() {
        return None;
    }
    let mut path = PathBuf::new();
    for component in components {
        path.push(component);
    }
    Some(path)
}

fn context_percent(tokens: usize) -> String {
    format!("{:.3}%", (tokens as f64 / 1_000_000f64) * 100f64)
}

fn open_memory_entry(memory: &MemoryInventory) -> Result<()> {
    if memory.entries.is_empty() {
        return Ok(());
    }
    let mut prompt = cliclack::select("Open which file?")
        .filter_mode()
        .max_rows(14);
    for (idx, entry) in memory.entries.iter().enumerate() {
        let agent = entry
            .agent
            .map(|agent| agent.display_name())
            .unwrap_or("shared");
        let label = format!(
            "{} · {} · ~{} tokens",
            entry.kind,
            agent,
            format_count(entry.approx_tokens)
        );
        prompt = prompt.item(idx, label, entry.path.display());
    }
    let idx = prompt.interact()?;
    open_file(&memory.entries[idx].path)
}

fn open_file(path: &Path) -> Result<()> {
    if let Ok(editor) = env::var("VISUAL").or_else(|_| env::var("EDITOR")) {
        let mut parts = editor.split_whitespace();
        let Some(command) = parts.next() else {
            return Err(anyhow!("editor command is empty"));
        };
        let status = Command::new(command).args(parts).arg(path).status()?;
        if !status.success() {
            return Err(anyhow!("editor exited with status {}", status));
        }
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(target_os = "linux")]
    let mut command = Command::new("xdg-open");
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", ""]);
        command
    };

    let status = command.arg(path).status()?;
    if !status.success() {
        return Err(anyhow!("open command exited with status {}", status));
    }
    Ok(())
}

fn format_count(value: usize) -> String {
    let raw = value.to_string();
    let mut out = String::new();
    for (idx, ch) in raw.chars().rev().enumerate() {
        if idx > 0 && idx % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    out.chars().rev().collect()
}

fn print_recommendations(recs: &[Recommendation]) {
    if recs.is_empty() {
        println!("No project-specific recommendations found.");
        return;
    }
    println!("{}", style("Recommended plugins").bold());
    for rec in recs {
        println!("\n{} - {}", style(&rec.plugin).green(), rec.description);
        for reason in &rec.reasons {
            println!("  - {reason}");
        }
    }
}

fn output_install_report(global: &GlobalArgs, report: &install::InstallReport) -> Result<()> {
    if global.output == OutputFormat::Json {
        print_json(report)
    } else {
        install::print_text_report(report);
        Ok(())
    }
}

fn print_json<T: Serialize>(value: &T) -> Result<()> {
    println!("{}", serde_json::to_string_pretty(value)?);
    Ok(())
}

fn yes_no(value: bool) -> &'static str {
    if value {
        "yes"
    } else {
        "no"
    }
}

#[derive(Serialize)]
struct SkillListOutput {
    agents: Vec<AgentKind>,
    skills: Vec<SkillListItem>,
}

#[derive(Serialize)]
struct SkillListItem {
    name: String,
    plugin: String,
    scope: InstallScope,
    agent: AgentKind,
    deactivated: bool,
    path: String,
}

#[cfg(feature = "plugins")]
#[derive(Serialize)]
struct PluginListOutput {
    name: String,
    version: Option<String>,
    plugins: Vec<PluginListItem>,
}

#[cfg(feature = "plugins")]
#[derive(Serialize)]
struct PluginListItem {
    name: String,
    description: String,
    version: Option<String>,
    path: String,
    skills: Vec<String>,
    subagents: Vec<String>,
    hooks: Option<String>,
}

#[derive(Serialize)]
struct RecommendOutput {
    signals: EnvironmentSignals,
    recommendations: Vec<Recommendation>,
}

#[derive(Serialize)]
struct DoctorOutput {
    agents: Vec<AgentStatus>,
    signals: EnvironmentSignals,
    inventory: Inventory,
    memory: MemoryInventory,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn placement_map(placements: Vec<SkillPlacement>) -> BTreeMap<String, SkillPlacementTarget> {
        placements
            .into_iter()
            .map(|placement| (placement.name, placement.target))
            .collect()
    }

    fn tree_item(name: &str, project_installed: usize, user_installed: usize) -> SkillTreeItem {
        SkillTreeItem {
            name: name.to_string(),
            other: false,
            project_installed,
            user_installed,
            project_deactivated: 0,
            user_deactivated: 0,
            installed_agents: (project_installed + user_installed).min(1),
            dual_scope_agents: if project_installed > 0 && user_installed > 0 {
                1
            } else {
                0
            },
            agent_count: 1,
            version: None,
            show_usage: false,
            last_used: None,
            file_count: 1,
        }
    }

    fn section_names(rows: &[SkillTreeRow], items: &[SkillTreeItem], label: &str) -> Vec<String> {
        let mut names = Vec::new();
        let mut in_section = false;
        for row in rows {
            match row {
                SkillTreeRow::Header { key, level: 0, .. } => {
                    in_section = key == &format!("scope:{label}");
                }
                SkillTreeRow::Skill { item, .. } if in_section => {
                    names.push(items[*item].name.clone());
                }
                _ => {}
            }
        }
        names
    }

    #[test]
    fn manage_rows_keep_scopes_separate() {
        let items = vec![tree_item("user-only", 0, 1), tree_item("project-only", 1, 0)];
        let plugins = BTreeMap::new();
        let placements = BTreeMap::from([
            ("user-only".to_string(), SkillPlacementTarget::Keep),
            ("project-only".to_string(), SkillPlacementTarget::Keep),
        ]);

        let rows = manage_tree_rows(&items, &plugins, &placements);

        assert_eq!(section_names(&rows, &items, "User"), vec!["user-only"]);
        assert_eq!(section_names(&rows, &items, "Project"), vec!["project-only"]);
    }

    #[test]
    fn manage_rows_move_hops_section() {
        let items = vec![tree_item("mover", 0, 1)];
        let plugins = BTreeMap::new();
        let placements =
            BTreeMap::from([("mover".to_string(), SkillPlacementTarget::Project)]);

        let rows = manage_tree_rows(&items, &plugins, &placements);

        assert!(section_names(&rows, &items, "User").is_empty());
        assert_eq!(section_names(&rows, &items, "Project"), vec!["mover"]);
    }

    #[test]
    fn manage_labels_omit_scope_words() {
        let installed = tree_item("stay", 0, 1);
        assert_eq!(
            manage_action_label(&installed, SkillPlacementTarget::User),
            Some(console::style("(installed)").green().bold().to_string())
        );
        let mover = tree_item("mover", 0, 1);
        assert_eq!(
            manage_action_label(&mover, SkillPlacementTarget::Project),
            Some(console::style("(move)").yellow().to_string())
        );
    }

    #[test]
    fn skill_placement_overrides_map_flags_to_targets() -> Result<()> {
        let placements = placement_map(skill_placement_overrides(
            &["pbir-cli".to_string()],
            &["fabric-cli".to_string()],
            &["create-pbi-report".to_string()],
            &["ado".to_string()],
            &["review-report".to_string()],
        )?);

        assert_eq!(
            placements.get("pbir-cli"),
            Some(&SkillPlacementTarget::Project)
        );
        assert_eq!(
            placements.get("fabric-cli"),
            Some(&SkillPlacementTarget::User)
        );
        assert_eq!(
            placements.get("create-pbi-report"),
            Some(&SkillPlacementTarget::None)
        );
        assert_eq!(
            placements.get("ado"),
            Some(&SkillPlacementTarget::Deactivate)
        );
        assert_eq!(
            placements.get("review-report"),
            Some(&SkillPlacementTarget::Keep)
        );
        Ok(())
    }

    #[test]
    fn skill_placement_overrides_reject_conflicting_targets() {
        let err = skill_placement_overrides(
            &["fabric-cli".to_string()],
            &[],
            &["fabric-cli".to_string()],
            &[],
            &[],
        )
        .expect_err("conflicting targets should fail");

        assert!(err.to_string().contains("multiple placement targets"));
    }

    #[test]
    fn apply_placement_overrides_preserves_unspecified_skills() {
        let mut placements = vec![
            SkillPlacement {
                name: "pbir-cli".to_string(),
                target: SkillPlacementTarget::Project,
            },
            SkillPlacement {
                name: "fabric-cli".to_string(),
                target: SkillPlacementTarget::Keep,
            },
        ];

        apply_placement_overrides(
            &mut placements,
            vec![SkillPlacement {
                name: "fabric-cli".to_string(),
                target: SkillPlacementTarget::User,
            }],
        );

        let placements = placement_map(placements);
        assert_eq!(
            placements.get("pbir-cli"),
            Some(&SkillPlacementTarget::Project)
        );
        assert_eq!(
            placements.get("fabric-cli"),
            Some(&SkillPlacementTarget::User)
        );
    }

    #[test]
    fn usage_detection_finds_direct_slash_commands_in_json_text() {
        let skills = BTreeSet::from(["fabric-cli".to_string()]);
        let line = r#"{"timestamp":"2026-05-22T06:59:00.001Z","message":{"role":"user","content":"please run /fabric-cli against this workspace"}}"#;

        let matches = detect_line_skill_usages(line, &skills, SystemTime::UNIX_EPOCH);

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].0, "fabric-cli");
        assert_eq!(matches[0].1.kind, SkillUsageKind::DirectInvocation);
        assert!(matches[0].1.last_used > SystemTime::UNIX_EPOCH);
    }

    #[test]
    fn usage_detection_ignores_skill_paths() {
        let skills = BTreeSet::from(["fabric-cli".to_string()]);
        let line = r#"{"message":{"role":"assistant","content":"Installed .claude/skills/fabric-cli/SKILL.md"}}"#;

        let matches = detect_line_skill_usages(line, &skills, SystemTime::UNIX_EPOCH);

        assert!(matches.is_empty());
    }

    #[test]
    fn usage_detection_ignores_attachment_command_lists() {
        let skills = BTreeSet::from(["figma-use".to_string()]);
        let line = r#"{"timestamp":"2026-07-07T06:30:03.727Z","attachment":{"content":" /figma-use ","addedBlocks":[" /figma-use "]}}"#;

        let matches = detect_line_skill_usages(line, &skills, SystemTime::UNIX_EPOCH);

        assert!(matches.is_empty());
    }

    #[test]
    fn usage_detection_finds_dollar_skill_invocations() {
        let skills = BTreeSet::from(["fabric-cli".to_string()]);
        let line = r#"{"payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"use $fabric-cli for this"}]}}"#;

        let matches = detect_line_skill_usages(line, &skills, SystemTime::UNIX_EPOCH);

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].1.kind, SkillUsageKind::DirectInvocation);
    }

    #[test]
    fn usage_detection_reads_structured_skill_fields() {
        let skills = BTreeSet::from(["fabric-cli".to_string()]);
        let line = r#"{"timestamp":1770000000,"skill_name":"fabric-cli"}"#;

        let matches = detect_line_skill_usages(line, &skills, SystemTime::UNIX_EPOCH);

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].1.kind, SkillUsageKind::Structured);
    }
}
