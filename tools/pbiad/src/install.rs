use crate::agents::{AgentKind, InstallScope};
use crate::registry::{
    is_deprecated_skill, AgentDefinition, Plugin, Registry, ResourceSelection, Skill,
};
use crate::util::{
    ensure_dir, quote_toml_multiline, read_to_string, remove_symlink_dir, shell_quote, symlink_dir,
    write_string, DEACTIVATED_SKILL_CACHE_DIR,
};
use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Clone, Debug)]
pub struct InstallRequest {
    pub agents: Vec<AgentKind>,
    pub plugin_names: Vec<String>,
    pub scope: InstallScope,
    pub dry_run: bool,
    #[cfg_attr(not(feature = "plugins"), allow(dead_code))]
    pub execute_native: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SkillPlacementTarget {
    Keep,
    None,
    Project,
    User,
    Deactivate,
}

#[derive(Clone, Debug)]
pub struct SkillPlacement {
    pub name: String,
    pub target: SkillPlacementTarget,
}

#[derive(Clone, Debug)]
pub struct SkillSyncRequest {
    pub agents: Vec<AgentKind>,
    pub placements: Vec<SkillPlacement>,
    pub preserve_skills: Vec<String>,
    pub dry_run: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct InstallReport {
    pub actions: Vec<InstallAction>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct InstallAction {
    pub agent: AgentKind,
    pub plugin: String,
    pub kind: ActionKind,
    pub source: PathBuf,
    pub destination: Option<PathBuf>,
    pub command: Option<String>,
    pub executed: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ActionKind {
    #[cfg_attr(not(feature = "plugins"), allow(dead_code))]
    NativePluginCommand,
    SkillSymlink,
    SkillWrite,
    SkillUnlink,
    SkillDeactivate,
    SkillReactivate,
    SkillMove,
    #[cfg_attr(not(feature = "plugins"), allow(dead_code))]
    SubagentConvert,
    #[cfg_attr(not(feature = "plugins"), allow(dead_code))]
    HookSkipped,
}

const MANAGED_SKILL_MARKER: &str = "<!-- pbiad-managed-skill -->";

#[cfg_attr(not(feature = "plugins"), allow(dead_code))]
pub fn install(registry: &Registry, request: &InstallRequest) -> Result<InstallReport> {
    let mut report = InstallReport {
        actions: Vec::new(),
        warnings: Vec::new(),
    };

    for name in &request.plugin_names {
        let selection = registry
            .resolve_selection(name)
            .ok_or_else(|| anyhow!("unknown plugin or skill: {}", name))?;

        for agent in &request.agents {
            match selection {
                ResourceSelection::Plugin(plugin) if agent.uses_native_plugin_commands() => {
                    install_native_plugin(registry, plugin, *agent, request, &mut report)?;
                }
                ResourceSelection::Plugin(plugin) if *agent == AgentKind::Codex => {
                    install_codex_plugin(plugin, request, &mut report)?;
                }
                ResourceSelection::Plugin(plugin) if *agent == AgentKind::Opencode => {
                    install_opencode_plugin(plugin, request, &mut report)?;
                }
                ResourceSelection::Plugin(plugin) => {
                    install_directory_plugin(plugin, *agent, request, &mut report)?;
                }
                ResourceSelection::Skill { plugin, skill } => {
                    install_single_skill(plugin, skill, *agent, request, &mut report)?;
                }
            }
        }
    }

    Ok(report)
}

pub fn install_skills(registry: &Registry, request: &InstallRequest) -> Result<InstallReport> {
    let mut report = InstallReport {
        actions: Vec::new(),
        warnings: Vec::new(),
    };

    for name in &request.plugin_names {
        let (plugin, skill) = registry
            .skill(name)
            .ok_or_else(|| anyhow!("unknown skill: {}", name))?;

        for agent in &request.agents {
            install_single_skill(plugin, skill, *agent, request, &mut report)?;
        }
    }

    Ok(report)
}

pub fn sync_skills(registry: &Registry, request: &SkillSyncRequest) -> Result<InstallReport> {
    let mut report = InstallReport {
        actions: Vec::new(),
        warnings: Vec::new(),
    };

    let placements = request
        .placements
        .iter()
        .map(|placement| (placement.name.as_str(), placement.target))
        .collect::<BTreeMap<_, _>>();
    let preserve = request
        .preserve_skills
        .iter()
        .map(String::as_str)
        .collect::<BTreeSet<_>>();
    let cwd = std::env::current_dir().context("current directory")?;

    for agent in &request.agents {
        let project_roots = agent.skill_roots_at(&cwd, InstallScope::Project)?;
        let user_roots = agent.skill_roots_at(&cwd, InstallScope::User)?;
        let mut handled = BTreeSet::new();
        for (plugin, skill) in registry.skills() {
            if preserve.contains(skill.name.as_str())
                && !placements.contains_key(skill.name.as_str())
            {
                continue;
            }
            let target = placements
                .get(skill.name.as_str())
                .copied()
                .unwrap_or(SkillPlacementTarget::None);
            handled.insert(skill.name.as_str());
            sync_skill_placement(
                Some((plugin, skill)),
                &skill.name,
                *agent,
                &project_roots,
                &user_roots,
                target,
                request.dry_run,
                &mut report,
            )?;
        }

        for placement in &request.placements {
            if handled.contains(placement.name.as_str()) {
                continue;
            }
            sync_skill_placement(
                None,
                &placement.name,
                *agent,
                &project_roots,
                &user_roots,
                placement.target,
                request.dry_run,
                &mut report,
            )?;
        }
    }

    Ok(report)
}

fn sync_skill_placement(
    known: Option<(&Plugin, &Skill)>,
    skill_name: &str,
    agent: AgentKind,
    project_roots: &[PathBuf],
    user_roots: &[PathBuf],
    target: SkillPlacementTarget,
    dry_run: bool,
    report: &mut InstallReport,
) -> Result<()> {
    let project_dirs = installed_skill_paths(agent, project_roots, skill_name);
    let user_dirs = installed_skill_paths(agent, user_roots, skill_name);
    let project_cached = deactivated_skill_paths(agent, project_roots, skill_name);
    let user_cached = deactivated_skill_paths(agent, user_roots, skill_name);
    let allow_unmanaged = known.is_none();

    match target {
        SkillPlacementTarget::Keep => {}
        SkillPlacementTarget::Deactivate => {
            for dest in &project_dirs {
                deactivate_skill_path(agent, project_roots, skill_name, dest, dry_run, report)?;
            }
            for dest in &user_dirs {
                deactivate_skill_path(agent, user_roots, skill_name, dest, dry_run, report)?;
            }
        }
        SkillPlacementTarget::Project => {
            ensure_skill_in_scope(
                known,
                skill_name,
                agent,
                InstallScope::Project,
                project_roots,
                &project_dirs,
                &project_cached,
                &user_dirs,
                &user_cached,
                dry_run,
                report,
            )?;
            for dest in project_cached {
                uninstall_skill_path(
                    agent,
                    skill_name,
                    known.map(|(_, skill)| skill.path.as_path()),
                    &dest,
                    dry_run,
                    allow_unmanaged,
                    report,
                )?;
            }
            for dest in user_dirs.into_iter().chain(user_cached) {
                uninstall_skill_path(
                    agent,
                    skill_name,
                    known.map(|(_, skill)| skill.path.as_path()),
                    &dest,
                    dry_run,
                    allow_unmanaged,
                    report,
                )?;
            }
        }
        SkillPlacementTarget::User => {
            ensure_skill_in_scope(
                known,
                skill_name,
                agent,
                InstallScope::User,
                user_roots,
                &user_dirs,
                &user_cached,
                &project_dirs,
                &project_cached,
                dry_run,
                report,
            )?;
            for dest in user_cached {
                uninstall_skill_path(
                    agent,
                    skill_name,
                    known.map(|(_, skill)| skill.path.as_path()),
                    &dest,
                    dry_run,
                    allow_unmanaged,
                    report,
                )?;
            }
            for dest in project_dirs.into_iter().chain(project_cached) {
                uninstall_skill_path(
                    agent,
                    skill_name,
                    known.map(|(_, skill)| skill.path.as_path()),
                    &dest,
                    dry_run,
                    allow_unmanaged,
                    report,
                )?;
            }
        }
        SkillPlacementTarget::None => {
            for dest in project_dirs
                .into_iter()
                .chain(user_dirs)
                .chain(project_cached)
                .chain(user_cached)
            {
                uninstall_skill_path(
                    agent,
                    skill_name,
                    known.map(|(_, skill)| skill.path.as_path()),
                    &dest,
                    dry_run,
                    allow_unmanaged,
                    report,
                )?;
            }
        }
    }

    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn ensure_skill_in_scope(
    known: Option<(&Plugin, &Skill)>,
    skill_name: &str,
    agent: AgentKind,
    scope: InstallScope,
    target_roots: &[PathBuf],
    target_dirs: &[PathBuf],
    target_cached: &[PathBuf],
    opposite_dirs: &[PathBuf],
    opposite_cached: &[PathBuf],
    dry_run: bool,
    report: &mut InstallReport,
) -> Result<()> {
    if !target_dirs.is_empty() {
        return Ok(());
    }

    if let Some(source) = target_cached.first() {
        return reactivate_skill_path(
            agent,
            target_roots,
            skill_name,
            source,
            ActionKind::SkillReactivate,
            dry_run,
            report,
        );
    }
    if let Some(source) = opposite_dirs.first() {
        return reactivate_skill_path(
            agent,
            target_roots,
            skill_name,
            source,
            ActionKind::SkillMove,
            dry_run,
            report,
        );
    }
    if let Some(source) = opposite_cached.first() {
        return reactivate_skill_path(
            agent,
            target_roots,
            skill_name,
            source,
            ActionKind::SkillReactivate,
            dry_run,
            report,
        );
    }

    if let Some((plugin, skill)) = known {
        let install_request = InstallRequest {
            agents: vec![agent],
            plugin_names: vec![skill.name.clone()],
            scope,
            dry_run,
            execute_native: false,
        };
        install_single_skill(plugin, skill, agent, &install_request, report)?;
    } else {
        report.warnings.push(format!(
            "{}: cannot move {}; no installed source was found",
            agent.display_name(),
            skill_name
        ));
    }

    Ok(())
}

#[cfg_attr(not(feature = "plugins"), allow(dead_code))]
fn install_native_plugin(
    registry: &Registry,
    plugin: &Plugin,
    agent: AgentKind,
    request: &InstallRequest,
    report: &mut InstallReport,
) -> Result<()> {
    let deprecated = plugin
        .skills
        .iter()
        .filter(|skill| is_deprecated_skill(&skill.name))
        .map(|skill| skill.name.clone())
        .collect::<Vec<_>>();
    if !deprecated.is_empty() {
        report.warnings.push(format!(
            "{} contains deprecated skill(s) {}; native plugin installs cannot filter bundle contents",
            plugin.name,
            deprecated.join(", ")
        ));
    }
    let command = agent
        .command()
        .ok_or_else(|| anyhow!("{} has no native CLI command", agent.display_name()))?;
    let marketplace_cmd = format!(
        "{} plugin marketplace add {}",
        command,
        shell_quote(&registry.root)
    );
    let install_cmd = format!(
        "{} plugin install {}@{}",
        command, plugin.name, registry.name
    );

    if request.execute_native && !request.dry_run {
        let status = Command::new(command)
            .args(["plugin", "marketplace", "add"])
            .arg(&registry.root)
            .status()
            .with_context(|| format!("run {}", marketplace_cmd))?;
        if !status.success() {
            return Err(anyhow!("{} failed with status {}", marketplace_cmd, status));
        }

        let status = Command::new(command)
            .args(["plugin", "install"])
            .arg(format!("{}@{}", plugin.name, registry.name))
            .status()
            .with_context(|| format!("run {}", install_cmd))?;
        if !status.success() {
            return Err(anyhow!("{} failed with status {}", install_cmd, status));
        }
    }

    report.actions.push(InstallAction {
        agent,
        plugin: plugin.name.clone(),
        kind: ActionKind::NativePluginCommand,
        source: plugin.path.clone(),
        destination: None,
        command: Some(format!("{} && {}", marketplace_cmd, install_cmd)),
        executed: request.execute_native && !request.dry_run,
    });
    Ok(())
}

fn install_single_skill(
    _plugin: &Plugin,
    skill: &Skill,
    agent: AgentKind,
    request: &InstallRequest,
    report: &mut InstallReport,
) -> Result<()> {
    if is_deprecated_skill(&skill.name) {
        report.warnings.push(format!(
            "skipped deprecated skill {}; use te-cli instead",
            skill.name
        ));
        return Ok(());
    }
    if agent == AgentKind::AntigravityCli {
        install_antigravity_cli_skill(skill, agent, request, report)?;
        return Ok(());
    }
    let skill_dir = skill
        .path
        .parent()
        .ok_or_else(|| anyhow!("skill has no parent: {}", skill.path.display()))?;
    let dest = agent.skill_root(request.scope)?.join(&skill.name);
    symlink_dir(skill_dir, &dest, request.dry_run)?;
    report.actions.push(InstallAction {
        agent,
        plugin: skill.name.clone(),
        kind: ActionKind::SkillSymlink,
        source: skill_dir.to_path_buf(),
        destination: Some(dest),
        command: None,
        executed: !request.dry_run,
    });
    Ok(())
}

fn install_antigravity_cli_skill(
    skill: &Skill,
    agent: AgentKind,
    request: &InstallRequest,
    report: &mut InstallReport,
) -> Result<()> {
    let root = agent.skill_root(request.scope)?;
    let dest = root.join(format!("{}.md", skill.name));
    let content = render_antigravity_cli_skill(skill)?;
    if !request.dry_run {
        if dest.exists() {
            let current = read_to_string(&dest)?;
            if !current.contains(MANAGED_SKILL_MARKER) {
                return Err(anyhow!(
                    "destination already exists and is not managed by pbiad: {}",
                    dest.display()
                ));
            }
        }
        write_string(&dest, &content)?;
    }
    report.actions.push(InstallAction {
        agent,
        plugin: skill.name.clone(),
        kind: ActionKind::SkillWrite,
        source: skill.path.clone(),
        destination: Some(dest),
        command: None,
        executed: !request.dry_run,
    });
    Ok(())
}

fn render_antigravity_cli_skill(skill: &Skill) -> Result<String> {
    let content = read_to_string(&skill.path)?;
    Ok(format!("{content}\n\n{MANAGED_SKILL_MARKER}\n"))
}

fn uninstall_skill_path(
    agent: AgentKind,
    skill_name: &str,
    source: Option<&Path>,
    dest: &Path,
    dry_run: bool,
    allow_unmanaged: bool,
    report: &mut InstallReport,
) -> Result<()> {
    let removed = if allow_unmanaged {
        remove_any_skill_path(dest, dry_run)
    } else {
        remove_skill_path(agent, dest, dry_run)
    };

    match removed {
        Ok(true) => {
            report.actions.push(InstallAction {
                agent,
                plugin: skill_name.to_string(),
                kind: ActionKind::SkillUnlink,
                source: source.unwrap_or(dest).to_path_buf(),
                destination: Some(dest.to_path_buf()),
                command: None,
                executed: !dry_run,
            });
        }
        Ok(false) => {}
        Err(err) => report.warnings.push(format!(
            "{}: skipped removing {} at {}: {}",
            agent.display_name(),
            skill_name,
            dest.display(),
            err
        )),
    }

    Ok(())
}

fn installed_skill_paths(agent: AgentKind, roots: &[PathBuf], skill_name: &str) -> Vec<PathBuf> {
    roots
        .iter()
        .flat_map(|root| skill_path_candidates(agent, root, skill_name))
        .filter(|path| skill_path_exists(agent, path))
        .collect()
}

fn deactivated_skill_paths(agent: AgentKind, roots: &[PathBuf], skill_name: &str) -> Vec<PathBuf> {
    roots
        .iter()
        .map(|root| root.join(DEACTIVATED_SKILL_CACHE_DIR))
        .flat_map(|root| skill_path_candidates(agent, &root, skill_name))
        .filter(|path| skill_path_exists(agent, path))
        .collect()
}

fn skill_path_candidates(agent: AgentKind, root: &Path, skill_name: &str) -> Vec<PathBuf> {
    if agent == AgentKind::AntigravityCli {
        vec![root.join(format!("{skill_name}.md")), root.join(skill_name)]
    } else {
        vec![root.join(skill_name)]
    }
}

fn skill_path_exists(agent: AgentKind, path: &Path) -> bool {
    if agent == AgentKind::AntigravityCli
        && path.extension().and_then(|ext| ext.to_str()) == Some("md")
    {
        return std::fs::symlink_metadata(path).is_ok();
    }
    skill_dir_exists(path)
}

fn remove_skill_path(agent: AgentKind, path: &Path, dry_run: bool) -> Result<bool> {
    if agent == AgentKind::AntigravityCli
        && path.extension().and_then(|ext| ext.to_str()) == Some("md")
    {
        let content = match read_to_string(path) {
            Ok(content) => content,
            Err(_) if !path.exists() => return Ok(false),
            Err(err) => return Err(err),
        };
        if !content.contains(MANAGED_SKILL_MARKER) {
            return Err(anyhow!(
                "refusing to remove unmanaged Antigravity CLI skill file: {}",
                path.display()
            ));
        }
        if dry_run {
            return Ok(true);
        }
        std::fs::remove_file(path)
            .with_context(|| format!("remove managed skill file {}", path.display()))?;
        return Ok(true);
    }

    remove_symlink_dir(path, dry_run)
}

fn remove_any_skill_path(path: &Path, dry_run: bool) -> Result<bool> {
    let meta = match fs::symlink_metadata(path) {
        Ok(meta) => meta,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(err) => return Err(err).with_context(|| format!("inspect {}", path.display())),
    };

    if dry_run {
        return Ok(true);
    }

    if meta.file_type().is_symlink() || meta.is_file() {
        fs::remove_file(path).with_context(|| format!("remove {}", path.display()))?;
    } else if meta.is_dir() {
        fs::remove_dir_all(path).with_context(|| format!("remove directory {}", path.display()))?;
    } else {
        return Err(anyhow!("unsupported skill path type: {}", path.display()));
    }
    Ok(true)
}

fn deactivate_skill_path(
    agent: AgentKind,
    roots: &[PathBuf],
    skill_name: &str,
    source: &Path,
    dry_run: bool,
    report: &mut InstallReport,
) -> Result<()> {
    let Some(destination) = cache_destination_for(agent, roots, source, skill_name) else {
        report.warnings.push(format!(
            "{}: cannot deactivate {}; no cache path for {}",
            agent.display_name(),
            skill_name,
            source.display()
        ));
        return Ok(());
    };
    move_skill_path(
        agent,
        skill_name,
        source,
        &destination,
        ActionKind::SkillDeactivate,
        dry_run,
        report,
    )
}

fn reactivate_skill_path(
    agent: AgentKind,
    roots: &[PathBuf],
    skill_name: &str,
    source: &Path,
    kind: ActionKind,
    dry_run: bool,
    report: &mut InstallReport,
) -> Result<()> {
    let Some(destination) = active_destination_for(agent, roots, source, skill_name) else {
        report.warnings.push(format!(
            "{}: cannot restore {}; no skill root is available",
            agent.display_name(),
            skill_name
        ));
        return Ok(());
    };
    move_skill_path(
        agent,
        skill_name,
        source,
        &destination,
        kind,
        dry_run,
        report,
    )
}

fn move_skill_path(
    agent: AgentKind,
    skill_name: &str,
    source: &Path,
    destination: &Path,
    kind: ActionKind,
    dry_run: bool,
    report: &mut InstallReport,
) -> Result<()> {
    if source == destination {
        return Ok(());
    }
    if !skill_path_exists(agent, source) {
        return Ok(());
    }
    if fs::symlink_metadata(destination).is_ok() {
        report.warnings.push(format!(
            "{}: skipped moving {}; destination already exists at {}",
            agent.display_name(),
            skill_name,
            destination.display()
        ));
        return Ok(());
    }

    if !dry_run {
        if let Some(parent) = destination.parent() {
            ensure_dir(parent)?;
        }
        fs::rename(source, destination).with_context(|| {
            format!(
                "move skill {} from {} to {}",
                skill_name,
                source.display(),
                destination.display()
            )
        })?;
    }

    report.actions.push(InstallAction {
        agent,
        plugin: skill_name.to_string(),
        kind,
        source: source.to_path_buf(),
        destination: Some(destination.to_path_buf()),
        command: None,
        executed: !dry_run,
    });
    Ok(())
}

fn cache_destination_for(
    agent: AgentKind,
    roots: &[PathBuf],
    source: &Path,
    skill_name: &str,
) -> Option<PathBuf> {
    for root in roots {
        for candidate in skill_path_candidates(agent, root, skill_name) {
            if candidate == source {
                let file_name = candidate.file_name()?;
                return Some(root.join(DEACTIVATED_SKILL_CACHE_DIR).join(file_name));
            }
        }
    }
    let root = roots.first()?;
    let file_name = source.file_name()?;
    Some(root.join(DEACTIVATED_SKILL_CACHE_DIR).join(file_name))
}

fn active_destination_for(
    agent: AgentKind,
    roots: &[PathBuf],
    source: &Path,
    skill_name: &str,
) -> Option<PathBuf> {
    let root = roots.first()?;
    if agent == AgentKind::AntigravityCli
        && source.extension().and_then(|ext| ext.to_str()) == Some("md")
    {
        return Some(root.join(format!("{skill_name}.md")));
    }
    Some(root.join(skill_name))
}

#[cfg_attr(not(feature = "plugins"), allow(dead_code))]
fn install_directory_plugin(
    plugin: &Plugin,
    agent: AgentKind,
    request: &InstallRequest,
    report: &mut InstallReport,
) -> Result<()> {
    for skill in &plugin.skills {
        install_single_skill(plugin, skill, agent, request, report)?;
    }

    if !plugin.agents.is_empty() {
        report.warnings.push(format!(
            "{} subagent translation is not enabled yet for {}; skipped {} subagent(s)",
            agent.display_name(),
            plugin.name,
            plugin.agents.len()
        ));
    }

    if let Some(hooks) = &plugin.hooks {
        report.warnings.push(format!(
            "{} hook translation is not enabled yet for {}; skipped {}",
            agent.display_name(),
            plugin.name,
            hooks.display()
        ));
        report.actions.push(InstallAction {
            agent,
            plugin: plugin.name.clone(),
            kind: ActionKind::HookSkipped,
            source: hooks.clone(),
            destination: None,
            command: None,
            executed: false,
        });
    }

    Ok(())
}

#[cfg_attr(not(feature = "plugins"), allow(dead_code))]
fn install_codex_plugin(
    plugin: &Plugin,
    request: &InstallRequest,
    report: &mut InstallReport,
) -> Result<()> {
    let root = codex_root(request.scope)?;
    for skill in &plugin.skills {
        install_single_skill(plugin, skill, AgentKind::Codex, request, report)?;
    }

    let agents_root = root.join(".codex/agents");
    for agent_def in &plugin.agents {
        let dest = agents_root.join(format!("{}-{}.toml", plugin.name, agent_def.name));
        let content = render_codex_agent(plugin, agent_def);
        if !request.dry_run {
            write_string(&dest, &content)?;
        }
        report.actions.push(InstallAction {
            agent: AgentKind::Codex,
            plugin: plugin.name.clone(),
            kind: ActionKind::SubagentConvert,
            source: agent_def.path.clone(),
            destination: Some(dest),
            command: None,
            executed: !request.dry_run,
        });
    }

    if let Some(hooks) = &plugin.hooks {
        report.warnings.push(format!(
            "Codex hook translation is not enabled yet for {}; skipped {}",
            plugin.name,
            hooks.display()
        ));
        report.actions.push(InstallAction {
            agent: AgentKind::Codex,
            plugin: plugin.name.clone(),
            kind: ActionKind::HookSkipped,
            source: hooks.clone(),
            destination: None,
            command: None,
            executed: false,
        });
    }

    Ok(())
}

#[cfg_attr(not(feature = "plugins"), allow(dead_code))]
fn install_opencode_plugin(
    plugin: &Plugin,
    request: &InstallRequest,
    report: &mut InstallReport,
) -> Result<()> {
    let root = opencode_root(request.scope)?;
    for skill in &plugin.skills {
        install_single_skill(plugin, skill, AgentKind::Opencode, request, report)?;
    }

    let agents_root = match request.scope {
        InstallScope::Project => root.join(".opencode/agents"),
        InstallScope::User => root.join("agents"),
    };
    for agent_def in &plugin.agents {
        let dest = agents_root.join(format!("{}-{}.md", plugin.name, agent_def.name));
        let content = render_opencode_agent(plugin, agent_def);
        if !request.dry_run {
            write_string(&dest, &content)?;
        }
        report.actions.push(InstallAction {
            agent: AgentKind::Opencode,
            plugin: plugin.name.clone(),
            kind: ActionKind::SubagentConvert,
            source: agent_def.path.clone(),
            destination: Some(dest),
            command: None,
            executed: !request.dry_run,
        });
    }

    if let Some(hooks) = &plugin.hooks {
        report.warnings.push(format!(
            "OpenCode hook translation is not enabled yet for {}; skipped {}",
            plugin.name,
            hooks.display()
        ));
        report.actions.push(InstallAction {
            agent: AgentKind::Opencode,
            plugin: plugin.name.clone(),
            kind: ActionKind::HookSkipped,
            source: hooks.clone(),
            destination: None,
            command: None,
            executed: false,
        });
    }

    Ok(())
}

fn codex_root(scope: InstallScope) -> Result<PathBuf> {
    match scope {
        InstallScope::Project => std::env::current_dir().context("current directory"),
        InstallScope::User => Ok(crate::util::home_dir()?),
    }
}

fn opencode_root(scope: InstallScope) -> Result<PathBuf> {
    match scope {
        InstallScope::Project => std::env::current_dir().context("current directory"),
        InstallScope::User => Ok(crate::util::home_dir()?.join(".config/opencode")),
    }
}

#[cfg_attr(not(feature = "plugins"), allow(dead_code))]
fn render_codex_agent(plugin: &Plugin, agent: &AgentDefinition) -> String {
    let name = format!("{}-{}", plugin.name, agent.name);
    format!(
        "name = {:?}\ndescription = {:?}\ndeveloper_instructions = {}\n",
        name,
        agent.description,
        quote_toml_multiline(&agent.body)
    )
}

#[cfg_attr(not(feature = "plugins"), allow(dead_code))]
fn render_opencode_agent(plugin: &Plugin, agent: &AgentDefinition) -> String {
    let name = format!("{}-{}", plugin.name, agent.name);
    let mut content = String::new();
    content.push_str("---\n");
    content.push_str(&format!("description: {:?}\n", agent.description));
    content.push_str("mode: subagent\n");
    if let Some(color) = &agent.color {
        content.push_str(&format!("color: {:?}\n", color));
    }
    content.push_str("metadata:\n");
    content.push_str(&format!("  pbiad-plugin: {:?}\n", plugin.name));
    content.push_str(&format!("  pbiad-source-agent: {:?}\n", agent.name));
    content.push_str("---\n\n");
    content.push_str(&format!("<!-- Installed by pbiad as {}. -->\n\n", name));
    content.push_str(agent.body.trim());
    content.push('\n');
    content
}

pub fn print_text_report(report: &InstallReport) {
    for action in &report.actions {
        match action.kind {
            ActionKind::NativePluginCommand => {
                println!(
                    "{}: {} plugin command{}",
                    action.agent.display_name(),
                    action.plugin,
                    if action.executed {
                        " executed"
                    } else {
                        " planned"
                    }
                );
                if let Some(command) = &action.command {
                    println!("  {command}");
                }
            }
            ActionKind::SkillSymlink => {
                if let Some(dest) = &action.destination {
                    println!(
                        "{}: {} {} skill -> {}",
                        action.agent.display_name(),
                        if action.executed {
                            "linked"
                        } else {
                            "would link"
                        },
                        action.plugin,
                        dest.display()
                    );
                }
            }
            ActionKind::SkillWrite => {
                if let Some(dest) = &action.destination {
                    println!(
                        "{}: {} {} skill -> {}",
                        action.agent.display_name(),
                        if action.executed {
                            "installed"
                        } else {
                            "would install"
                        },
                        action.plugin,
                        dest.display()
                    );
                }
            }
            ActionKind::SkillUnlink => {
                if let Some(dest) = &action.destination {
                    println!(
                        "{}: {} {} skill -> {}",
                        action.agent.display_name(),
                        if action.executed {
                            "removed"
                        } else {
                            "would remove"
                        },
                        action.plugin,
                        dest.display()
                    );
                }
            }
            ActionKind::SkillDeactivate => {
                if let Some(dest) = &action.destination {
                    println!(
                        "{}: {} {} skill -> {}",
                        action.agent.display_name(),
                        if action.executed {
                            "deactivated"
                        } else {
                            "would deactivate"
                        },
                        action.plugin,
                        dest.display()
                    );
                }
            }
            ActionKind::SkillReactivate => {
                if let Some(dest) = &action.destination {
                    println!(
                        "{}: {} {} skill -> {}",
                        action.agent.display_name(),
                        if action.executed {
                            "reactivated"
                        } else {
                            "would reactivate"
                        },
                        action.plugin,
                        dest.display()
                    );
                }
            }
            ActionKind::SkillMove => {
                if let Some(dest) = &action.destination {
                    println!(
                        "{}: {} {} skill -> {}",
                        action.agent.display_name(),
                        if action.executed {
                            "moved"
                        } else {
                            "would move"
                        },
                        action.plugin,
                        dest.display()
                    );
                }
            }
            ActionKind::SubagentConvert => {
                if let Some(dest) = &action.destination {
                    println!(
                        "{}: {} {} subagent -> {}",
                        action.agent.display_name(),
                        if action.executed {
                            "converted"
                        } else {
                            "would convert"
                        },
                        action.plugin,
                        dest.display()
                    );
                }
            }
            ActionKind::HookSkipped => {
                println!(
                    "{}: skipped {} hooks; translator not enabled yet",
                    action.agent.display_name(),
                    action.plugin
                );
            }
        }
    }

    for warning in &report.warnings {
        eprintln!("Warning: {warning}");
    }
}

fn skill_dir_exists(path: &Path) -> bool {
    path.join("SKILL.md").is_file() || std::fs::symlink_metadata(path).is_ok()
}

pub fn preflight_dirs(request: &InstallRequest) -> Result<()> {
    if request.dry_run {
        return Ok(());
    }
    for agent in &request.agents {
        match agent {
            AgentKind::Codex => {
                let root = codex_root(request.scope)?;
                ensure_dir(&root.join(".agents/skills"))?;
                ensure_dir(&root.join(".codex/agents"))?;
            }
            AgentKind::Opencode => {
                let root = opencode_root(request.scope)?;
                match request.scope {
                    InstallScope::Project => {
                        ensure_dir(&root.join(".opencode/skills"))?;
                        ensure_dir(&root.join(".opencode/agents"))?;
                    }
                    InstallScope::User => {
                        ensure_dir(&root.join("skills"))?;
                        ensure_dir(&root.join("agents"))?;
                    }
                }
            }
            _ => {
                ensure_dir(&agent.skill_root(request.scope)?)?;
            }
        }
    }
    Ok(())
}

#[allow(dead_code)]
fn _assert_path(_: &Path) {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::inventory::Inventory;
    use crate::registry::Registry;
    use crate::util::TEST_ENV_LOCK;
    use std::env;
    use std::ffi::OsString;
    use tempfile::TempDir;

    const EXPECTED_AGENTS: [AgentKind; 4] = [
        AgentKind::Claude,
        AgentKind::Codex,
        AgentKind::Cursor,
        AgentKind::Copilot,
    ];

    struct ProcessEnvGuard {
        cwd: PathBuf,
        home: Option<OsString>,
        xdg_config_home: Option<OsString>,
        copilot_home: Option<OsString>,
    }

    impl ProcessEnvGuard {
        fn enter(project: &Path, home: &Path) -> Result<Self> {
            let guard = Self {
                cwd: env::current_dir().context("current directory")?,
                home: env::var_os("HOME"),
                xdg_config_home: env::var_os("XDG_CONFIG_HOME"),
                copilot_home: env::var_os("COPILOT_HOME"),
            };
            env::set_var("HOME", home);
            env::set_var("XDG_CONFIG_HOME", home.join(".config"));
            env::remove_var("COPILOT_HOME");
            env::set_current_dir(project).with_context(|| format!("cd {}", project.display()))?;
            Ok(guard)
        }
    }

    impl Drop for ProcessEnvGuard {
        fn drop(&mut self) {
            restore_env_var("HOME", self.home.as_ref());
            restore_env_var("XDG_CONFIG_HOME", self.xdg_config_home.as_ref());
            restore_env_var("COPILOT_HOME", self.copilot_home.as_ref());
            let _ = env::set_current_dir(&self.cwd);
        }
    }

    fn restore_env_var(name: &str, value: Option<&OsString>) {
        match value {
            Some(value) => env::set_var(name, value),
            None => env::remove_var(name),
        }
    }

    fn repo_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .and_then(Path::parent)
            .expect("repo root")
            .to_path_buf()
    }

    fn isolated_context() -> Result<(TempDir, PathBuf, PathBuf, ProcessEnvGuard)> {
        let temp = TempDir::new()?;
        let project = temp.path().join("project");
        let home = temp.path().join("home");
        fs::create_dir_all(&project)?;
        fs::create_dir_all(&home)?;
        let guard = ProcessEnvGuard::enter(&project, &home)?;
        Ok((temp, project, home, guard))
    }

    fn skill_paths(
        agent: AgentKind,
        project: &Path,
        scope: InstallScope,
        name: &str,
    ) -> Result<Vec<PathBuf>> {
        Ok(agent
            .skill_roots_at(project, scope)?
            .into_iter()
            .map(|root| root.join(name))
            .collect())
    }

    fn skill_cache_paths(
        agent: AgentKind,
        project: &Path,
        scope: InstallScope,
        name: &str,
    ) -> Result<Vec<PathBuf>> {
        Ok(agent
            .skill_roots_at(project, scope)?
            .into_iter()
            .map(|root| root.join(DEACTIVATED_SKILL_CACHE_DIR).join(name))
            .collect())
    }

    fn assert_skill_present(
        agent: AgentKind,
        project: &Path,
        scope: InstallScope,
        name: &str,
    ) -> Result<()> {
        let paths = skill_paths(agent, project, scope, name)?;
        assert!(
            paths.iter().any(|path| skill_dir_exists(path)),
            "{} {scope} skill {name} missing from {:?}",
            agent.display_name(),
            paths
        );
        Ok(())
    }

    fn assert_skill_absent(
        agent: AgentKind,
        project: &Path,
        scope: InstallScope,
        name: &str,
    ) -> Result<()> {
        let paths = skill_paths(agent, project, scope, name)?;
        assert!(
            paths.iter().all(|path| !skill_dir_exists(path)),
            "{} {scope} skill {name} unexpectedly present in {:?}",
            agent.display_name(),
            paths
        );
        Ok(())
    }

    fn assert_cache_present(
        agent: AgentKind,
        project: &Path,
        scope: InstallScope,
        name: &str,
    ) -> Result<()> {
        let paths = skill_cache_paths(agent, project, scope, name)?;
        assert!(
            paths.iter().any(|path| skill_dir_exists(path)),
            "{} {scope} cached skill {name} missing from {:?}",
            agent.display_name(),
            paths
        );
        Ok(())
    }

    fn assert_cache_absent(
        agent: AgentKind,
        project: &Path,
        scope: InstallScope,
        name: &str,
    ) -> Result<()> {
        let paths = skill_cache_paths(agent, project, scope, name)?;
        assert!(
            paths.iter().all(|path| !skill_dir_exists(path)),
            "{} {scope} cached skill {name} unexpectedly present in {:?}",
            agent.display_name(),
            paths
        );
        Ok(())
    }

    fn write_unmanaged_user_skill(agent: AgentKind, project: &Path, name: &str) -> Result<()> {
        let root = agent
            .skill_root_at(project, InstallScope::User)?
            .ok_or_else(|| anyhow!("{} has no user skill root", agent.display_name()))?;
        let dir = root.join(name);
        fs::create_dir_all(&dir)?;
        fs::write(
            dir.join("SKILL.md"),
            format!("---\nname: {name}\ndescription: Test skill\n---\n"),
        )?;
        Ok(())
    }

    #[test]
    fn registry_skills_install_and_uninstall_across_expected_agents() -> Result<()> {
        let _lock = TEST_ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let (_temp, project, _home, _guard) = isolated_context()?;
        let registry = Registry::load(repo_root())?;
        let agents = EXPECTED_AGENTS.to_vec();

        let request = InstallRequest {
            agents: agents.clone(),
            plugin_names: vec![
                "pbir-cli".to_string(),
                "fabric-cli".to_string(),
                "create-pbi-report".to_string(),
            ],
            scope: InstallScope::Project,
            dry_run: false,
            execute_native: false,
        };
        preflight_dirs(&request)?;
        let report = install_skills(&registry, &request)?;
        assert!(report.warnings.is_empty());

        for agent in EXPECTED_AGENTS {
            assert_skill_present(agent, &project, InstallScope::Project, "pbir-cli")?;
            assert_skill_present(agent, &project, InstallScope::Project, "fabric-cli")?;
            assert_skill_present(agent, &project, InstallScope::Project, "create-pbi-report")?;
        }
        let inventory = Inventory::detect(&project);
        for agent in EXPECTED_AGENTS {
            let agent_inventory = inventory.for_agent(agent).expect("agent inventory");
            assert!(
                agent_inventory
                    .skill_names(InstallScope::Project)
                    .contains("pbir-cli"),
                "{} inventory did not see pbir-cli",
                agent.display_name()
            );
            assert!(
                agent_inventory
                    .skill_names(InstallScope::Project)
                    .contains("fabric-cli"),
                "{} inventory did not see fabric-cli",
                agent.display_name()
            );
        }

        let report = sync_skills(
            &registry,
            &SkillSyncRequest {
                agents,
                placements: vec![
                    SkillPlacement {
                        name: "pbir-cli".to_string(),
                        target: SkillPlacementTarget::Keep,
                    },
                    SkillPlacement {
                        name: "fabric-cli".to_string(),
                        target: SkillPlacementTarget::Keep,
                    },
                    SkillPlacement {
                        name: "create-pbi-report".to_string(),
                        target: SkillPlacementTarget::None,
                    },
                ],
                preserve_skills: Vec::new(),
                dry_run: false,
            },
        )?;
        assert!(report.warnings.is_empty());
        assert!(report.actions.iter().any(|action| {
            action.kind == ActionKind::SkillUnlink && action.plugin == "create-pbi-report"
        }));

        for agent in EXPECTED_AGENTS {
            assert_skill_present(agent, &project, InstallScope::Project, "pbir-cli")?;
            assert_skill_present(agent, &project, InstallScope::Project, "fabric-cli")?;
            assert_skill_absent(agent, &project, InstallScope::Project, "create-pbi-report")?;
        }

        Ok(())
    }

    #[test]
    fn unmanaged_skill_deactivate_reinstall_user_and_move_project() -> Result<()> {
        let _lock = TEST_ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let (_temp, project, _home, _guard) = isolated_context()?;
        let registry = Registry::load(repo_root())?;
        let agents = EXPECTED_AGENTS.to_vec();

        for agent in EXPECTED_AGENTS {
            write_unmanaged_user_skill(agent, &project, "ado")?;
            assert_skill_present(agent, &project, InstallScope::User, "ado")?;
        }

        let report = sync_skills(
            &registry,
            &SkillSyncRequest {
                agents: agents.clone(),
                placements: vec![SkillPlacement {
                    name: "ado".to_string(),
                    target: SkillPlacementTarget::Deactivate,
                }],
                preserve_skills: Vec::new(),
                dry_run: false,
            },
        )?;
        assert!(report.warnings.is_empty());
        assert!(report
            .actions
            .iter()
            .any(|action| action.kind == ActionKind::SkillDeactivate && action.plugin == "ado"));

        for agent in EXPECTED_AGENTS {
            assert_skill_absent(agent, &project, InstallScope::User, "ado")?;
            assert_cache_present(agent, &project, InstallScope::User, "ado")?;
        }

        let report = sync_skills(
            &registry,
            &SkillSyncRequest {
                agents: agents.clone(),
                placements: vec![SkillPlacement {
                    name: "ado".to_string(),
                    target: SkillPlacementTarget::User,
                }],
                preserve_skills: Vec::new(),
                dry_run: false,
            },
        )?;
        assert!(report.warnings.is_empty());

        for agent in EXPECTED_AGENTS {
            assert_skill_present(agent, &project, InstallScope::User, "ado")?;
            assert_skill_absent(agent, &project, InstallScope::Project, "ado")?;
            assert_cache_absent(agent, &project, InstallScope::User, "ado")?;
        }

        let report = sync_skills(
            &registry,
            &SkillSyncRequest {
                agents,
                placements: vec![SkillPlacement {
                    name: "ado".to_string(),
                    target: SkillPlacementTarget::Project,
                }],
                preserve_skills: Vec::new(),
                dry_run: false,
            },
        )?;
        assert!(report.warnings.is_empty());

        for agent in EXPECTED_AGENTS {
            assert_skill_present(agent, &project, InstallScope::Project, "ado")?;
            assert_skill_absent(agent, &project, InstallScope::User, "ado")?;
            assert_cache_absent(agent, &project, InstallScope::Project, "ado")?;
            assert_cache_absent(agent, &project, InstallScope::User, "ado")?;
        }

        Ok(())
    }
}
