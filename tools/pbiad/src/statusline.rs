use crate::agents::{AgentKind, InstallScope};
use crate::util::{ensure_dir, home_dir, shell_quote};
use anyhow::{anyhow, Context, Result};
use clap::ValueEnum;
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

const STATUSLINE_SOURCE_RELATIVE: &str = "useful-stuff/status-lines";
const MANAGED_STATUSLINE_DIR: &str = "pbiad-statusline";
const CONFIG_FILE_NAME: &str = "statusline.config.sh";

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash, Serialize, ValueEnum)]
#[serde(rename_all = "kebab-case")]
pub enum StatusLineComponent {
    Time,
    Folder,
    Branch,
    Commits,
    Pulls,
    TrackedFiles,
    LocChanges,
    Model,
    ModelVersion,
    Effort,
    Context,
    FiveHourLimit,
    WeeklyLimit,
}

impl StatusLineComponent {
    pub const ALL: [StatusLineComponent; 13] = [
        StatusLineComponent::Time,
        StatusLineComponent::Folder,
        StatusLineComponent::Branch,
        StatusLineComponent::Commits,
        StatusLineComponent::Pulls,
        StatusLineComponent::TrackedFiles,
        StatusLineComponent::LocChanges,
        StatusLineComponent::Model,
        StatusLineComponent::ModelVersion,
        StatusLineComponent::Effort,
        StatusLineComponent::Context,
        StatusLineComponent::FiveHourLimit,
        StatusLineComponent::WeeklyLimit,
    ];

    pub fn label(self) -> &'static str {
        match self {
            StatusLineComponent::Time => "time",
            StatusLineComponent::Folder => "folder",
            StatusLineComponent::Branch => "branch",
            StatusLineComponent::Commits => "unpushed commits",
            StatusLineComponent::Pulls => "pulls waiting",
            StatusLineComponent::TrackedFiles => "tracked files",
            StatusLineComponent::LocChanges => "LOC changes",
            StatusLineComponent::Model => "model",
            StatusLineComponent::ModelVersion => "model version",
            StatusLineComponent::Effort => "effort",
            StatusLineComponent::Context => "session context window",
            StatusLineComponent::FiveHourLimit => "5h limit",
            StatusLineComponent::WeeklyLimit => "weekly limit",
        }
    }

    pub fn hint(self) -> &'static str {
        match self {
            StatusLineComponent::Time => "HH:MM",
            StatusLineComponent::Folder => "current directory with repo glyph",
            StatusLineComponent::Branch => "current git branch",
            StatusLineComponent::Commits => "local commits not pushed yet",
            StatusLineComponent::Pulls => "upstream commits available to pull",
            StatusLineComponent::TrackedFiles => "changed file counts",
            StatusLineComponent::LocChanges => "insertions/deletions versus HEAD",
            StatusLineComponent::Model => "Claude model family",
            StatusLineComponent::ModelVersion => "version suffix, for example 4.7",
            StatusLineComponent::Effort => "thinking effort dots",
            StatusLineComponent::Context => "context window percentage",
            StatusLineComponent::FiveHourLimit => "rolling 5-hour usage window",
            StatusLineComponent::WeeklyLimit => "rolling weekly usage window",
        }
    }

    fn env_var(self) -> &'static str {
        match self {
            StatusLineComponent::Time => "ENABLE_TIME",
            StatusLineComponent::Folder => "ENABLE_FOLDER",
            StatusLineComponent::Branch => "ENABLE_BRANCH",
            StatusLineComponent::Commits => "ENABLE_COMMITS",
            StatusLineComponent::Pulls => "ENABLE_PULLS",
            StatusLineComponent::TrackedFiles => "ENABLE_FILE_CHANGES",
            StatusLineComponent::LocChanges => "ENABLE_LOC_CHANGES",
            StatusLineComponent::Model => "ENABLE_MODEL",
            StatusLineComponent::ModelVersion => "ENABLE_MODEL_VERSION",
            StatusLineComponent::Effort => "ENABLE_EFFORT",
            StatusLineComponent::Context => "ENABLE_CONTEXT",
            StatusLineComponent::FiveHourLimit => "ENABLE_LIMIT_5H",
            StatusLineComponent::WeeklyLimit => "ENABLE_LIMIT_WEEKLY",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, ValueEnum)]
#[serde(rename_all = "kebab-case")]
pub enum StatusLineMeterStyle {
    #[value(alias = "percent")]
    Label,
    #[value(alias = "bar")]
    Steps,
    FullBar,
    #[value(alias = "compact")]
    ThinBar,
}

impl StatusLineMeterStyle {
    pub fn label(self) -> &'static str {
        match self {
            StatusLineMeterStyle::Label => "label only",
            StatusLineMeterStyle::Steps => "label and bars (20% increments)",
            StatusLineMeterStyle::FullBar => "label and bars (to 100%)",
            StatusLineMeterStyle::ThinBar => "label and thin bar (to 100%)",
        }
    }

    fn shell_value(self) -> &'static str {
        match self {
            StatusLineMeterStyle::Label => "label",
            StatusLineMeterStyle::Steps => "steps",
            StatusLineMeterStyle::FullBar => "bar",
            StatusLineMeterStyle::ThinBar => "thin",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, ValueEnum)]
#[serde(rename_all = "kebab-case")]
pub enum StatusLineContextStyle {
    Percent,
    Bar,
}

impl StatusLineContextStyle {
    pub fn label(self) -> &'static str {
        match self {
            StatusLineContextStyle::Percent => "percent only",
            StatusLineContextStyle::Bar => "data bar",
        }
    }

    fn shell_value(self) -> &'static str {
        match self {
            StatusLineContextStyle::Percent => "percent",
            StatusLineContextStyle::Bar => "bar",
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct StatusLineOptions {
    pub meter_style: StatusLineMeterStyle,
    pub context_style: StatusLineContextStyle,
    pub refresh_interval: u64,
    pub clickable_resets: bool,
    pub click_open_paths: bool,
    pub click_open_lazygit: bool,
}

impl Default for StatusLineOptions {
    fn default() -> Self {
        Self {
            meter_style: StatusLineMeterStyle::Steps,
            context_style: StatusLineContextStyle::Percent,
            refresh_interval: 60,
            clickable_resets: true,
            click_open_paths: true,
            click_open_lazygit: false,
        }
    }
}

#[derive(Clone, Debug)]
pub struct StatusLineInstallRequest {
    pub registry_root: PathBuf,
    pub project_root: PathBuf,
    pub agent: AgentKind,
    pub scope: InstallScope,
    pub components: Vec<StatusLineComponent>,
    pub options: StatusLineOptions,
    pub dry_run: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct StatusLineInstallReport {
    pub agent: AgentKind,
    pub scope: InstallScope,
    pub dry_run: bool,
    pub settings_path: PathBuf,
    pub statusline_dir: PathBuf,
    pub script_path: PathBuf,
    pub config_path: PathBuf,
    pub command: String,
    pub components: Vec<StatusLineComponent>,
    pub options: StatusLineOptions,
    pub files_copied: usize,
}

pub fn default_components() -> Vec<StatusLineComponent> {
    StatusLineComponent::ALL.to_vec()
}

pub fn install_statusline(request: &StatusLineInstallRequest) -> Result<StatusLineInstallReport> {
    if request.agent != AgentKind::Claude {
        return Err(anyhow!(
            "statusline setup currently supports Claude Code only"
        ));
    }

    let source_dir = statusline_source_dir(&request.registry_root)?;
    let target = statusline_target(&request.project_root, request.scope)?;
    let script_path = target.statusline_dir.join("statusline.sh");
    let config_path = target.statusline_dir.join(CONFIG_FILE_NAME);
    let command = format!("bash {}", shell_quote(&script_path));

    let files_copied = if !request.dry_run {
        let files_copied = copy_statusline_assets(&source_dir, &target.statusline_dir)?;
        write_statusline_config(&config_path, &request.components, &request.options)?;
        update_claude_settings(
            &target.settings_path,
            &command,
            request.options.refresh_interval,
        )?;
        files_copied
    } else {
        count_statusline_files(&source_dir)?
    };

    Ok(StatusLineInstallReport {
        agent: request.agent,
        scope: request.scope,
        dry_run: request.dry_run,
        settings_path: target.settings_path,
        statusline_dir: target.statusline_dir,
        script_path,
        config_path,
        command,
        components: normalize_components(&request.components),
        options: request.options.clone(),
        files_copied,
    })
}

pub fn config_content(components: &[StatusLineComponent], options: &StatusLineOptions) -> String {
    let selected = components.iter().copied().collect::<BTreeSet<_>>();
    let mut content = String::new();
    content.push_str("# Generated by pbiad statusline setup. Edit via `pbiad statusline setup`.\n");
    content.push_str("# This file is sourced by statusline.sh.\n\n");

    for component in StatusLineComponent::ALL {
        let value = if selected.contains(&component) {
            "TRUE"
        } else {
            "FALSE"
        };
        content.push_str(component.env_var());
        content.push('=');
        content.push_str(value);
        content.push('\n');
    }
    content.push_str("ENABLE_PR=FALSE\n");
    content.push_str("ENABLE_WORKTREE=FALSE\n");
    content.push_str("ENABLE_COST=TRUE\n");
    content.push_str("ENABLE_VERSION=FALSE\n");
    content.push_str("ENABLE_VIM=FALSE\n");
    content.push_str(&format!(
        "STATUSLINE_METER_STYLE={}\n",
        options.meter_style.shell_value()
    ));
    content.push_str(&format!(
        "STATUSLINE_CONTEXT_STYLE={}\n",
        options.context_style.shell_value()
    ));
    content.push_str(&format!(
        "STATUSLINE_CLICKABLE_RESETS={}\n",
        if options.clickable_resets {
            "TRUE"
        } else {
            "FALSE"
        }
    ));
    content.push_str(&format!(
        "STATUSLINE_CLICK_OPEN_PATHS={}\n",
        if options.click_open_paths {
            "TRUE"
        } else {
            "FALSE"
        }
    ));
    content.push_str(&format!(
        "STATUSLINE_CLICK_OPEN_LAZYGIT={}\n",
        if options.click_open_lazygit {
            "TRUE"
        } else {
            "FALSE"
        }
    ));
    content.push_str("STATUSLINE_CLICK_BRANCH_COLLAPSE=FALSE\n");
    content
}

pub fn validate_refresh_interval(refresh_interval: u64) -> Result<()> {
    if refresh_interval == 0 {
        return Err(anyhow!("refresh interval must be at least 1 second"));
    }
    Ok(())
}

fn normalize_components(components: &[StatusLineComponent]) -> Vec<StatusLineComponent> {
    components
        .iter()
        .copied()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn statusline_source_dir(registry_root: &Path) -> Result<PathBuf> {
    let source_dir = registry_root.join(STATUSLINE_SOURCE_RELATIVE);
    if !source_dir.join("statusline.sh").is_file() {
        return Err(anyhow!(
            "{} does not contain the bundled Claude Code statusline",
            source_dir.display()
        ));
    }
    Ok(source_dir)
}

struct StatusLineTarget {
    settings_path: PathBuf,
    statusline_dir: PathBuf,
}

fn statusline_target(project_root: &Path, scope: InstallScope) -> Result<StatusLineTarget> {
    let base = match scope {
        InstallScope::User => home_dir()?.join(".claude"),
        InstallScope::Project => project_root.join(".claude"),
    };
    Ok(StatusLineTarget {
        settings_path: base.join("settings.json"),
        statusline_dir: base.join(MANAGED_STATUSLINE_DIR),
    })
}

fn copy_statusline_assets(source_dir: &Path, target_dir: &Path) -> Result<usize> {
    ensure_dir(target_dir)?;
    let mut copied = 0usize;
    for entry in WalkDir::new(source_dir).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        let relative = path
            .strip_prefix(source_dir)
            .with_context(|| format!("strip {}", source_dir.display()))?;
        if relative.as_os_str().is_empty() {
            continue;
        }
        let target = target_dir.join(relative);
        if entry.file_type().is_dir() {
            ensure_dir(&target)?;
            continue;
        }
        if entry.file_type().is_file() {
            if let Some(parent) = target.parent() {
                ensure_dir(parent)?;
            }
            fs::copy(path, &target)
                .with_context(|| format!("copy {} to {}", path.display(), target.display()))?;
            make_executable_if_script(&target)?;
            copied += 1;
        }
    }
    Ok(copied)
}

fn count_statusline_files(source_dir: &Path) -> Result<usize> {
    let mut count = 0usize;
    for entry in WalkDir::new(source_dir) {
        let entry = entry.with_context(|| format!("walk {}", source_dir.display()))?;
        if entry.file_type().is_file() {
            count += 1;
        }
    }
    Ok(count)
}

fn make_executable_if_script(path: &Path) -> Result<()> {
    if path.extension().and_then(|ext| ext.to_str()) != Some("sh") {
        return Ok(());
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = fs::metadata(path)
            .with_context(|| format!("inspect {}", path.display()))?
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(path, permissions)
            .with_context(|| format!("chmod +x {}", path.display()))?;
    }

    Ok(())
}

fn write_statusline_config(
    config_path: &Path,
    components: &[StatusLineComponent],
    options: &StatusLineOptions,
) -> Result<()> {
    if let Some(parent) = config_path.parent() {
        ensure_dir(parent)?;
    }
    fs::write(config_path, config_content(components, options))
        .with_context(|| format!("write {}", config_path.display()))
}

fn update_claude_settings(
    settings_path: &Path,
    command: &str,
    refresh_interval: u64,
) -> Result<()> {
    validate_refresh_interval(refresh_interval)?;

    let mut root = if settings_path.is_file() {
        let content = fs::read_to_string(settings_path)
            .with_context(|| format!("read {}", settings_path.display()))?;
        serde_json::from_str::<Value>(&content)
            .with_context(|| format!("parse {}", settings_path.display()))?
    } else {
        Value::Object(Map::new())
    };

    let object = root.as_object_mut().ok_or_else(|| {
        anyhow!(
            "{} must contain a JSON object to configure statusLine",
            settings_path.display()
        )
    })?;

    let mut status_line = Map::new();
    status_line.insert("type".to_string(), Value::String("command".to_string()));
    status_line.insert("command".to_string(), Value::String(command.to_string()));
    status_line.insert(
        "refreshInterval".to_string(),
        Value::Number(refresh_interval.into()),
    );
    status_line.insert("hideVimModeIndicator".to_string(), Value::Bool(true));
    object.insert("statusLine".to_string(), Value::Object(status_line));

    if let Some(parent) = settings_path.parent() {
        ensure_dir(parent)?;
    }
    let content = serde_json::to_string_pretty(&root).context("serialize Claude settings")?;
    fs::write(settings_path, format!("{content}\n"))
        .with_context(|| format!("write {}", settings_path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn config_content_maps_components_to_flags() {
        let content = config_content(
            &[
                StatusLineComponent::Time,
                StatusLineComponent::Model,
                StatusLineComponent::ModelVersion,
                StatusLineComponent::FiveHourLimit,
            ],
            &StatusLineOptions {
                meter_style: StatusLineMeterStyle::Label,
                context_style: StatusLineContextStyle::Bar,
                refresh_interval: 15,
                clickable_resets: false,
                click_open_paths: false,
                click_open_lazygit: true,
            },
        );

        assert!(content.contains("ENABLE_TIME=TRUE\n"));
        assert!(content.contains("ENABLE_FOLDER=FALSE\n"));
        assert!(content.contains("ENABLE_MODEL=TRUE\n"));
        assert!(content.contains("ENABLE_MODEL_VERSION=TRUE\n"));
        assert!(content.contains("ENABLE_LIMIT_5H=TRUE\n"));
        assert!(content.contains("ENABLE_LIMIT_WEEKLY=FALSE\n"));
        assert!(content.contains("STATUSLINE_METER_STYLE=label\n"));
        assert!(content.contains("STATUSLINE_CONTEXT_STYLE=bar\n"));
        assert!(content.contains("STATUSLINE_CLICKABLE_RESETS=FALSE\n"));
        assert!(content.contains("STATUSLINE_CLICK_OPEN_PATHS=FALSE\n"));
        assert!(content.contains("STATUSLINE_CLICK_OPEN_LAZYGIT=TRUE\n"));
    }

    #[test]
    fn install_project_statusline_writes_settings_and_config() -> Result<()> {
        let registry = TempDir::new()?;
        let source = registry.path().join(STATUSLINE_SOURCE_RELATIVE);
        fs::create_dir_all(source.join("statusline.d"))?;
        fs::write(source.join("statusline.sh"), "#!/bin/bash\n")?;
        fs::write(source.join("statusline-click.sh"), "#!/bin/bash\n")?;
        fs::write(source.join("statusline.d/05-time.sh"), "seg time\n")?;

        let project = TempDir::new()?;
        fs::create_dir_all(project.path().join(".claude"))?;
        fs::write(
            project.path().join(".claude/settings.json"),
            "{\n  \"existing\": true\n}\n",
        )?;

        let report = install_statusline(&StatusLineInstallRequest {
            registry_root: registry.path().to_path_buf(),
            project_root: project.path().to_path_buf(),
            agent: AgentKind::Claude,
            scope: InstallScope::Project,
            components: vec![StatusLineComponent::Time],
            options: StatusLineOptions {
                refresh_interval: 5,
                ..StatusLineOptions::default()
            },
            dry_run: false,
        })?;

        assert_eq!(report.scope, InstallScope::Project);
        assert_eq!(report.files_copied, 3);
        assert!(report.script_path.is_file());
        assert!(report.config_path.is_file());

        let settings = fs::read_to_string(project.path().join(".claude/settings.json"))?;
        assert!(settings.contains("\"existing\": true"));
        assert!(settings.contains("\"statusLine\""));
        assert!(settings.contains("\"refreshInterval\": 5"));
        assert!(settings.contains("pbiad-statusline/statusline.sh"));

        let config = fs::read_to_string(report.config_path)?;
        assert!(config.contains("ENABLE_TIME=TRUE\n"));
        assert!(config.contains("ENABLE_MODEL=FALSE\n"));
        Ok(())
    }
}
