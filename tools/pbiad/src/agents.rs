use anyhow::{anyhow, Context, Result};
use clap::ValueEnum;
use serde::ser::Serializer;
use serde::Serialize;
use std::env;
use std::fmt;
use std::path::{Path, PathBuf};
use which::which;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash, ValueEnum)]
pub enum AgentKind {
    #[value(name = "claude-code", alias = "claude")]
    Claude,
    #[value(name = "codex")]
    Codex,
    #[value(name = "github-copilot", alias = "copilot")]
    Copilot,
    #[value(name = "cursor")]
    Cursor,
    #[value(name = "windsurf")]
    Windsurf,
    #[value(name = "opencode")]
    Opencode,
    #[value(name = "junie", alias = "jetbrains")]
    Junie,
    #[value(name = "zed")]
    Zed,
    #[value(name = "antigravity-cli")]
    AntigravityCli,
    #[value(name = "pi")]
    Pi,
    #[value(name = "openclaw")]
    Openclaw,
    #[value(name = "hermes-agent")]
    HermesAgent,
    #[value(name = "cline")]
    Cline,
    #[value(name = "aider", alias = "aider-cli")]
    Aider,
    #[value(skip)]
    AiderDesk,
    #[value(name = "amp")]
    Amp,
    #[value(name = "replit")]
    Replit,
    #[value(skip)]
    Universal,
    #[value(skip)]
    Antigravity,
    #[value(skip)]
    Astrbot,
    #[value(skip)]
    AutohandCode,
    #[value(skip)]
    Augment,
    #[value(skip)]
    Bob,
    #[value(skip)]
    Dexto,
    #[value(skip)]
    KimiCodeCli,
    #[value(skip)]
    Loaf,
    #[value(skip)]
    Warp,
    #[value(skip)]
    CodeartsAgent,
    #[value(skip)]
    Codebuddy,
    #[value(skip)]
    Codemaker,
    #[value(skip)]
    Codestudio,
    #[value(skip)]
    CommandCode,
    #[value(skip)]
    Continue,
    #[value(skip)]
    Cortex,
    #[value(skip)]
    Crush,
    #[value(skip)]
    Deepagents,
    #[value(skip)]
    Devin,
    #[value(skip)]
    Droid,
    #[value(skip)]
    Eve,
    #[value(skip)]
    Firebender,
    #[value(skip)]
    Forgecode,
    #[value(skip)]
    Goose,
    #[value(skip)]
    InferenceSh,
    #[value(skip)]
    Jazz,
    #[value(skip)]
    IflowCli,
    #[value(skip)]
    Kilo,
    #[value(skip)]
    Kiro,
    #[value(skip)]
    Kode,
    #[value(skip)]
    Lingma,
    #[value(skip)]
    Mcpjam,
    #[value(skip)]
    MistralVibe,
    #[value(skip)]
    Moxby,
    #[value(skip)]
    Mux,
    #[value(skip)]
    Openhands,
    #[value(skip)]
    Ona,
    #[value(skip)]
    Qoder,
    #[value(skip)]
    QoderCn,
    #[value(skip)]
    QwenCode,
    #[value(skip)]
    Reasonix,
    #[value(skip)]
    Rovodev,
    #[value(skip)]
    Roo,
    #[value(skip)]
    TabnineCli,
    #[value(skip)]
    Terramind,
    #[value(skip)]
    Tinycloud,
    #[value(skip)]
    Trae,
    #[value(skip)]
    TraeCn,
    #[value(skip)]
    Zencoder,
    #[value(skip)]
    Zenflow,
    #[value(skip)]
    Neovate,
    #[value(skip)]
    Pochi,
    #[value(skip)]
    Promptscript,
    #[value(skip)]
    Adal,
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum InstallScope {
    Project,
    User,
}

#[derive(Clone, Debug, Serialize)]
pub struct AgentStatus {
    pub agent: AgentKind,
    pub command: Option<&'static str>,
    pub installed: bool,
    pub configured: bool,
    pub skills: SupportLevel,
    pub hooks: SupportLevel,
    pub subagents: SupportLevel,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SupportLevel {
    NativePlugin,
    NativeDirectory,
    Converted,
    PlannedTranslator,
    Unsupported,
}

#[derive(Clone, Copy, Debug)]
pub struct AgentSpec {
    pub kind: AgentKind,
    pub slug: &'static str,
    pub display_name: &'static str,
    pub commands: &'static [&'static str],
    pub project_skill_root: &'static str,
    pub user_skill_root: Option<&'static str>,
    pub project_skill_fallbacks: &'static [&'static str],
    pub user_skill_fallbacks: &'static [&'static str],
    pub project_subagent_roots: &'static [&'static str],
    pub user_subagent_roots: &'static [&'static str],
    pub project_markers: &'static [&'static str],
    pub user_markers: &'static [&'static str],
}

impl AgentKind {
    pub const ALL: [AgentKind; 71] = [
        AgentKind::Claude,
        AgentKind::Codex,
        AgentKind::Copilot,
        AgentKind::Opencode,
        AgentKind::AntigravityCli,
        AgentKind::HermesAgent,
        AgentKind::Cursor,
        AgentKind::Windsurf,
        AgentKind::Cline,
        AgentKind::Amp,
        AgentKind::Openclaw,
        AgentKind::Aider,
        AgentKind::AiderDesk,
        AgentKind::Replit,
        AgentKind::Universal,
        AgentKind::Astrbot,
        AgentKind::AutohandCode,
        AgentKind::Augment,
        AgentKind::Bob,
        AgentKind::Dexto,
        AgentKind::KimiCodeCli,
        AgentKind::Loaf,
        AgentKind::Warp,
        AgentKind::Zed,
        AgentKind::CodeartsAgent,
        AgentKind::Codebuddy,
        AgentKind::Codemaker,
        AgentKind::Codestudio,
        AgentKind::CommandCode,
        AgentKind::Continue,
        AgentKind::Cortex,
        AgentKind::Crush,
        AgentKind::Deepagents,
        AgentKind::Devin,
        AgentKind::Droid,
        AgentKind::Eve,
        AgentKind::Firebender,
        AgentKind::Forgecode,
        AgentKind::Goose,
        AgentKind::InferenceSh,
        AgentKind::Jazz,
        AgentKind::Junie,
        AgentKind::IflowCli,
        AgentKind::Kilo,
        AgentKind::Kiro,
        AgentKind::Kode,
        AgentKind::Lingma,
        AgentKind::Mcpjam,
        AgentKind::MistralVibe,
        AgentKind::Moxby,
        AgentKind::Mux,
        AgentKind::Openhands,
        AgentKind::Ona,
        AgentKind::Pi,
        AgentKind::Qoder,
        AgentKind::QoderCn,
        AgentKind::QwenCode,
        AgentKind::Reasonix,
        AgentKind::Rovodev,
        AgentKind::Roo,
        AgentKind::TabnineCli,
        AgentKind::Terramind,
        AgentKind::Tinycloud,
        AgentKind::Trae,
        AgentKind::TraeCn,
        AgentKind::Zencoder,
        AgentKind::Zenflow,
        AgentKind::Neovate,
        AgentKind::Pochi,
        AgentKind::Promptscript,
        AgentKind::Adal,
    ];

    pub const POPULAR: [AgentKind; 16] = [
        AgentKind::Claude,
        AgentKind::Codex,
        AgentKind::Copilot,
        AgentKind::Cursor,
        AgentKind::Windsurf,
        AgentKind::Opencode,
        AgentKind::Junie,
        AgentKind::Zed,
        AgentKind::AntigravityCli,
        AgentKind::Pi,
        AgentKind::Openclaw,
        AgentKind::HermesAgent,
        AgentKind::Cline,
        AgentKind::Amp,
        AgentKind::Aider,
        AgentKind::Replit,
    ];

    pub fn spec(self) -> &'static AgentSpec {
        AGENT_SPECS
            .iter()
            .find(|spec| spec.kind == self)
            .expect("all AgentKind variants must have an AgentSpec")
    }

    pub fn slug(self) -> &'static str {
        self.spec().slug
    }

    pub fn command(self) -> Option<&'static str> {
        self.spec().commands.first().copied()
    }

    pub fn display_name(self) -> &'static str {
        self.spec().display_name
    }

    pub fn is_popular(self) -> bool {
        Self::POPULAR.contains(&self)
    }

    #[cfg_attr(not(feature = "plugins"), allow(dead_code))]
    pub fn uses_native_plugin_commands(self) -> bool {
        matches!(self, AgentKind::Claude | AgentKind::Copilot)
    }

    pub fn status_at(self, project_root: &Path) -> AgentStatus {
        let installed = self
            .spec()
            .commands
            .iter()
            .any(|command| which(command).is_ok());
        let configured = self.has_project_presence(project_root) || self.has_user_presence();
        AgentStatus {
            agent: self,
            command: self.command(),
            installed,
            configured,
            skills: SupportLevel::NativeDirectory,
            hooks: match self {
                AgentKind::Claude | AgentKind::Copilot => SupportLevel::NativePlugin,
                AgentKind::Codex | AgentKind::Opencode => SupportLevel::PlannedTranslator,
                AgentKind::Cline | AgentKind::Kiro => SupportLevel::NativeDirectory,
                _ => SupportLevel::Unsupported,
            },
            subagents: match self {
                AgentKind::Claude | AgentKind::Copilot => SupportLevel::NativePlugin,
                AgentKind::Codex | AgentKind::Opencode => SupportLevel::Converted,
                AgentKind::Kiro => SupportLevel::NativeDirectory,
                _ => SupportLevel::Unsupported,
            },
        }
    }

    pub fn is_detected_at(self, project_root: &Path) -> bool {
        let status = self.status_at(project_root);
        status.installed || self.has_project_presence(project_root)
    }

    pub fn skill_root(self, scope: InstallScope) -> Result<PathBuf> {
        let cwd = std::env::current_dir().context("current directory")?;
        self.skill_root_at(&cwd, scope)?
            .ok_or_else(|| anyhow!("{} has no {} skill root", self.display_name(), scope))
    }

    pub fn skill_root_at(
        self,
        project_root: &Path,
        scope: InstallScope,
    ) -> Result<Option<PathBuf>> {
        let spec = self.spec();
        Ok(match scope {
            InstallScope::Project => Some(project_root.join(spec.project_skill_root)),
            InstallScope::User => spec
                .user_skill_root
                .map(|path| user_path_for(self, path))
                .transpose()?,
        })
    }

    pub fn skill_roots_at(self, project_root: &Path, scope: InstallScope) -> Result<Vec<PathBuf>> {
        let spec = self.spec();
        let mut paths = Vec::new();
        if let Some(path) = self.skill_root_at(project_root, scope)? {
            paths.push(path);
        }
        let fallbacks = match scope {
            InstallScope::Project => spec.project_skill_fallbacks,
            InstallScope::User => spec.user_skill_fallbacks,
        };
        for fallback in fallbacks {
            let path = match scope {
                InstallScope::Project => project_root.join(fallback),
                InstallScope::User => user_path_for(self, fallback)?,
            };
            if !paths.iter().any(|existing| existing == &path) {
                paths.push(path);
            }
        }
        Ok(paths)
    }

    pub fn subagent_roots_at(
        self,
        project_root: &Path,
        scope: InstallScope,
    ) -> Result<Vec<PathBuf>> {
        let roots = match scope {
            InstallScope::Project => self.spec().project_subagent_roots,
            InstallScope::User => self.spec().user_subagent_roots,
        };
        roots
            .iter()
            .map(|root| match scope {
                InstallScope::Project => Ok(project_root.join(root)),
                InstallScope::User => user_path_for(self, root),
            })
            .collect()
    }

    pub fn marker_paths_at(self, project_root: &Path, scope: InstallScope) -> Result<Vec<PathBuf>> {
        let markers = match scope {
            InstallScope::Project => self.spec().project_markers,
            InstallScope::User => self.spec().user_markers,
        };
        markers
            .iter()
            .map(|marker| match scope {
                InstallScope::Project => Ok(project_root.join(marker)),
                InstallScope::User => user_path_for(self, marker),
            })
            .collect()
    }

    fn has_project_presence(self, project_root: &Path) -> bool {
        self.skill_roots_at(project_root, InstallScope::Project)
            .unwrap_or_default()
            .into_iter()
            .chain(
                self.subagent_roots_at(project_root, InstallScope::Project)
                    .unwrap_or_default(),
            )
            .chain(
                self.marker_paths_at(project_root, InstallScope::Project)
                    .unwrap_or_default(),
            )
            .any(|path| path.exists())
    }

    fn has_user_presence(self) -> bool {
        let project_root = Path::new(".");
        self.skill_roots_at(project_root, InstallScope::User)
            .unwrap_or_default()
            .into_iter()
            .chain(
                self.subagent_roots_at(project_root, InstallScope::User)
                    .unwrap_or_default(),
            )
            .chain(
                self.marker_paths_at(project_root, InstallScope::User)
                    .unwrap_or_default(),
            )
            .any(|path| path.exists())
    }
}

impl fmt::Display for AgentKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.slug())
    }
}

impl Serialize for AgentKind {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.slug())
    }
}

impl fmt::Display for InstallScope {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            InstallScope::Project => "project",
            InstallScope::User => "user",
        })
    }
}

impl fmt::Display for AgentStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let state = if self.installed {
            "found"
        } else if self.configured {
            "configured"
        } else {
            "not found"
        };
        write!(f, "{} ({})", self.agent.display_name(), state)
    }
}

fn user_path(relative: &str) -> Result<PathBuf> {
    Ok(crate::util::home_dir()?.join(relative))
}

fn user_path_for(agent: AgentKind, relative: &str) -> Result<PathBuf> {
    if agent == AgentKind::Copilot {
        if let Some(copilot_relative) = relative
            .strip_prefix(".copilot/")
            .or_else(|| (relative == ".copilot").then_some(""))
        {
            if let Some(home) = env::var_os("COPILOT_HOME") {
                let home = PathBuf::from(home);
                if !home.as_os_str().is_empty() {
                    return Ok(home.join(copilot_relative));
                }
            }
        }
    }
    user_path(relative)
}

const fn spec(
    kind: AgentKind,
    slug: &'static str,
    display_name: &'static str,
    commands: &'static [&'static str],
    project_skill_root: &'static str,
    user_skill_root: Option<&'static str>,
    project_skill_fallbacks: &'static [&'static str],
    user_skill_fallbacks: &'static [&'static str],
    project_subagent_roots: &'static [&'static str],
    user_subagent_roots: &'static [&'static str],
    project_markers: &'static [&'static str],
    user_markers: &'static [&'static str],
) -> AgentSpec {
    AgentSpec {
        kind,
        slug,
        display_name,
        commands,
        project_skill_root,
        user_skill_root,
        project_skill_fallbacks,
        user_skill_fallbacks,
        project_subagent_roots,
        user_subagent_roots,
        project_markers,
        user_markers,
    }
}

pub const AGENT_SPECS: &[AgentSpec] = &[
    spec(
        AgentKind::Aider,
        "aider",
        "Aider",
        &["aider"],
        ".aider/skills",
        Some(".aider/skills"),
        &[],
        &[],
        &[],
        &[],
        &["CONVENTIONS.md", ".aider.conf.yml", ".aider"],
        &[".aider/CONVENTIONS.md", ".aider.conf.yml"],
    ),
    spec(
        AgentKind::AiderDesk,
        "aider-desk",
        "AiderDesk",
        &["aider-desk"],
        ".aider-desk/skills",
        Some(".aider-desk/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".aider-desk"],
        &[".aider-desk"],
    ),
    spec(
        AgentKind::Amp,
        "amp",
        "Amp",
        &["amp"],
        ".agents/skills",
        Some(".config/agents/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".agents"],
        &[".config/agents"],
    ),
    spec(
        AgentKind::Replit,
        "replit",
        "Replit",
        &["replit"],
        ".agents/skills",
        Some(".config/agents/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".agents"],
        &[".config/agents"],
    ),
    spec(
        AgentKind::Universal,
        "universal",
        "Universal",
        &[],
        ".agents/skills",
        Some(".config/agents/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".agents"],
        &[".config/agents"],
    ),
    spec(
        AgentKind::Antigravity,
        "antigravity",
        "Antigravity",
        &["antigravity"],
        ".agents/skills",
        Some(".gemini/antigravity/skills"),
        &[".agent/skills"],
        &[],
        &[],
        &[],
        &[".agents", ".agent"],
        &[".gemini/antigravity"],
    ),
    spec(
        AgentKind::AntigravityCli,
        "antigravity-cli",
        "Antigravity CLI",
        &["agy", "antigravity-cli", "antigravity"],
        ".agents/skills",
        Some(".gemini/antigravity-cli/skills"),
        &[".gemini/skills"],
        &[".gemini/skills"],
        &[],
        &[],
        &[".agents", "AGENTS.md", "GEMINI.md"],
        &[".gemini/antigravity-cli", ".gemini/GEMINI.md"],
    ),
    spec(
        AgentKind::Astrbot,
        "astrbot",
        "AstrBot",
        &["astrbot"],
        "data/skills",
        Some(".astrbot/data/skills"),
        &[],
        &[],
        &[],
        &[],
        &["data/skills"],
        &[".astrbot"],
    ),
    spec(
        AgentKind::AutohandCode,
        "autohand-code",
        "Autohand Code CLI",
        &["autohand-code", "autohand"],
        ".autohand/skills",
        Some(".autohand/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".autohand"],
        &[".autohand"],
    ),
    spec(
        AgentKind::Augment,
        "augment",
        "Augment",
        &["augment"],
        ".augment/skills",
        Some(".augment/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".augment"],
        &[".augment"],
    ),
    spec(
        AgentKind::Bob,
        "bob",
        "IBM Bob",
        &["bob"],
        ".bob/skills",
        Some(".bob/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".bob"],
        &[".bob"],
    ),
    spec(
        AgentKind::Claude,
        "claude-code",
        "Claude Code",
        &["claude"],
        ".claude/skills",
        Some(".claude/skills"),
        &[],
        &[],
        &[".claude/agents"],
        &[".claude/agents"],
        &["CLAUDE.md", ".claude"],
        &[".claude/CLAUDE.md", ".claude/settings.json"],
    ),
    spec(
        AgentKind::Openclaw,
        "openclaw",
        "OpenClaw",
        &["openclaw"],
        "skills",
        Some(".openclaw/skills"),
        &[],
        &[],
        &[],
        &[],
        &["skills"],
        &[".openclaw"],
    ),
    spec(
        AgentKind::Cline,
        "cline",
        "Cline",
        &["cline"],
        ".agents/skills",
        Some(".agents/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".clinerules", ".clinerules/", "memory-bank"],
        &[".cline", ".clinerules"],
    ),
    spec(
        AgentKind::Dexto,
        "dexto",
        "Dexto",
        &["dexto"],
        ".agents/skills",
        Some(".agents/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".agents"],
        &[".agents"],
    ),
    spec(
        AgentKind::KimiCodeCli,
        "kimi-code-cli",
        "Kimi Code CLI",
        &["kimi", "kimi-code"],
        ".agents/skills",
        Some(".agents/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".agents"],
        &[".agents"],
    ),
    spec(
        AgentKind::Loaf,
        "loaf",
        "Loaf",
        &["loaf"],
        ".agents/skills",
        Some(".agents/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".agents"],
        &[".agents"],
    ),
    spec(
        AgentKind::Warp,
        "warp",
        "Warp",
        &["warp"],
        ".agents/skills",
        Some(".agents/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".agents"],
        &[".agents"],
    ),
    spec(
        AgentKind::Zed,
        "zed",
        "Zed",
        &["zed"],
        ".agents/skills",
        Some(".agents/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".zed", ".agents"],
        &[".zed", ".agents"],
    ),
    spec(
        AgentKind::CodeartsAgent,
        "codearts-agent",
        "CodeArts Agent",
        &["codearts-agent"],
        ".codeartsdoer/skills",
        Some(".codeartsdoer/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".codeartsdoer"],
        &[".codeartsdoer"],
    ),
    spec(
        AgentKind::Codebuddy,
        "codebuddy",
        "CodeBuddy",
        &["codebuddy"],
        ".codebuddy/skills",
        Some(".codebuddy/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".codebuddy"],
        &[".codebuddy"],
    ),
    spec(
        AgentKind::Codemaker,
        "codemaker",
        "Codemaker",
        &["codemaker"],
        ".codemaker/skills",
        Some(".codemaker/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".codemaker"],
        &[".codemaker"],
    ),
    spec(
        AgentKind::Codestudio,
        "codestudio",
        "Code Studio",
        &["codestudio"],
        ".codestudio/skills",
        Some(".codestudio/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".codestudio"],
        &[".codestudio"],
    ),
    spec(
        AgentKind::Codex,
        "codex",
        "Codex",
        &["codex"],
        ".agents/skills",
        Some(".agents/skills"),
        &[".codex/skills"],
        &[".codex/skills"],
        &[".codex/agents"],
        &[".codex/agents"],
        &["AGENTS.md", ".codex", ".agents"],
        &[".codex/AGENTS.md", ".codex/config.toml", ".agents"],
    ),
    spec(
        AgentKind::CommandCode,
        "command-code",
        "Command Code",
        &["command-code", "commandcode"],
        ".commandcode/skills",
        Some(".commandcode/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".commandcode"],
        &[".commandcode"],
    ),
    spec(
        AgentKind::Continue,
        "continue",
        "Continue",
        &["continue"],
        ".continue/skills",
        Some(".continue/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".continue"],
        &[".continue"],
    ),
    spec(
        AgentKind::Cortex,
        "cortex",
        "Cortex Code",
        &["cortex"],
        ".cortex/skills",
        Some(".snowflake/cortex/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".cortex"],
        &[".snowflake/cortex"],
    ),
    spec(
        AgentKind::Crush,
        "crush",
        "Crush",
        &["crush"],
        ".crush/skills",
        Some(".config/crush/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".crush"],
        &[".config/crush"],
    ),
    spec(
        AgentKind::Cursor,
        "cursor",
        "Cursor",
        &["cursor"],
        ".agents/skills",
        Some(".cursor/skills"),
        &[".cursor/skills"],
        &[],
        &[],
        &[],
        &[".cursor", ".cursorrules", ".agents"],
        &[".cursor"],
    ),
    spec(
        AgentKind::Deepagents,
        "deepagents",
        "Deep Agents",
        &["deepagents"],
        ".agents/skills",
        Some(".deepagents/agent/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".agents"],
        &[".deepagents"],
    ),
    spec(
        AgentKind::Devin,
        "devin",
        "Devin for Terminal",
        &["devin"],
        ".devin/skills",
        Some(".config/devin/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".devin"],
        &[".config/devin"],
    ),
    spec(
        AgentKind::Droid,
        "droid",
        "Droid",
        &["droid"],
        ".factory/skills",
        Some(".factory/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".factory"],
        &[".factory"],
    ),
    spec(
        AgentKind::Eve,
        "eve",
        "Eve",
        &["eve"],
        "agent/skills",
        None,
        &[],
        &[],
        &[],
        &[],
        &["agent/skills"],
        &[],
    ),
    spec(
        AgentKind::Firebender,
        "firebender",
        "Firebender",
        &["firebender"],
        ".agents/skills",
        Some(".firebender/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".agents"],
        &[".firebender"],
    ),
    spec(
        AgentKind::Forgecode,
        "forgecode",
        "ForgeCode",
        &["forgecode", "forge"],
        ".forge/skills",
        Some(".forge/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".forge"],
        &[".forge"],
    ),
    spec(
        AgentKind::Copilot,
        "github-copilot",
        "GitHub Copilot",
        &["copilot"],
        ".github/skills",
        Some(".copilot/skills"),
        &[".claude/skills", ".agents/skills"],
        &[".agents/skills"],
        &[".github/agents"],
        &[".copilot/agents"],
        &[
            ".github/copilot-instructions.md",
            ".github/instructions",
            ".github/skills",
        ],
        &[".copilot/copilot-instructions.md", ".copilot"],
    ),
    spec(
        AgentKind::Goose,
        "goose",
        "Goose",
        &["goose"],
        ".goose/skills",
        Some(".config/goose/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".goose"],
        &[".config/goose"],
    ),
    spec(
        AgentKind::HermesAgent,
        "hermes-agent",
        "Hermes Agent",
        &["hermes-agent"],
        ".hermes/skills",
        Some(".hermes/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".hermes"],
        &[".hermes"],
    ),
    spec(
        AgentKind::InferenceSh,
        "inference-sh",
        "inference.sh",
        &["inference-sh", "inferencesh"],
        ".inferencesh/skills",
        Some(".inferencesh/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".inferencesh"],
        &[".inferencesh"],
    ),
    spec(
        AgentKind::Jazz,
        "jazz",
        "Jazz",
        &["jazz"],
        ".jazz/skills",
        Some(".jazz/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".jazz"],
        &[".jazz"],
    ),
    spec(
        AgentKind::Junie,
        "junie",
        "JetBrains Junie",
        &["junie"],
        ".junie/skills",
        Some(".junie/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".junie"],
        &[".junie"],
    ),
    spec(
        AgentKind::IflowCli,
        "iflow-cli",
        "iFlow CLI",
        &["iflow-cli", "iflow"],
        ".iflow/skills",
        Some(".iflow/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".iflow"],
        &[".iflow"],
    ),
    spec(
        AgentKind::Kilo,
        "kilo",
        "Kilo Code",
        &["kilo", "kilocode"],
        ".kilocode/skills",
        Some(".kilocode/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".kilocode"],
        &[".kilocode"],
    ),
    spec(
        AgentKind::Kiro,
        "kiro-cli",
        "Kiro CLI",
        &["kiro"],
        ".kiro/skills",
        Some(".kiro/skills"),
        &[],
        &[],
        &[".kiro/agents"],
        &[".kiro/agents"],
        &[".kiro"],
        &[".kiro"],
    ),
    spec(
        AgentKind::Kode,
        "kode",
        "Kode",
        &["kode"],
        ".kode/skills",
        Some(".kode/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".kode"],
        &[".kode"],
    ),
    spec(
        AgentKind::Lingma,
        "lingma",
        "Lingma",
        &["lingma"],
        ".lingma/skills",
        Some(".lingma/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".lingma"],
        &[".lingma"],
    ),
    spec(
        AgentKind::Mcpjam,
        "mcpjam",
        "MCPJam",
        &["mcpjam"],
        ".mcpjam/skills",
        Some(".mcpjam/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".mcpjam"],
        &[".mcpjam"],
    ),
    spec(
        AgentKind::MistralVibe,
        "mistral-vibe",
        "Mistral Vibe",
        &["mistral-vibe"],
        ".vibe/skills",
        Some(".vibe/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".vibe"],
        &[".vibe"],
    ),
    spec(
        AgentKind::Moxby,
        "moxby",
        "Moxby",
        &["moxby"],
        ".moxby/skills",
        Some(".moxby/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".moxby"],
        &[".moxby"],
    ),
    spec(
        AgentKind::Mux,
        "mux",
        "Mux",
        &["mux"],
        ".mux/skills",
        Some(".mux/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".mux"],
        &[".mux"],
    ),
    spec(
        AgentKind::Opencode,
        "opencode",
        "OpenCode",
        &["opencode"],
        ".opencode/skills",
        Some(".config/opencode/skills"),
        &[".agents/skills"],
        &[".agents/skills"],
        &[".opencode/agents"],
        &[".config/opencode/agents"],
        &["AGENTS.md", ".opencode", ".agents"],
        &[".config/opencode/AGENTS.md", ".config/opencode"],
    ),
    spec(
        AgentKind::Openhands,
        "openhands",
        "OpenHands",
        &["openhands"],
        ".openhands/skills",
        Some(".openhands/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".openhands"],
        &[".openhands"],
    ),
    spec(
        AgentKind::Ona,
        "ona",
        "Ona",
        &["ona"],
        ".ona/skills",
        Some(".ona/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".ona"],
        &[".ona"],
    ),
    spec(
        AgentKind::Pi,
        "pi",
        "Pi",
        &["pi"],
        ".pi/skills",
        Some(".pi/agent/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".pi"],
        &[".pi"],
    ),
    spec(
        AgentKind::Qoder,
        "qoder",
        "Qoder",
        &["qoder"],
        ".qoder/skills",
        Some(".qoder/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".qoder"],
        &[".qoder"],
    ),
    spec(
        AgentKind::QoderCn,
        "qoder-cn",
        "Qoder CN",
        &["qoder-cn", "qoder"],
        ".qoder/skills",
        Some(".qoder-cn/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".qoder"],
        &[".qoder-cn"],
    ),
    spec(
        AgentKind::QwenCode,
        "qwen-code",
        "Qwen Code",
        &["qwen", "qwen-code"],
        ".qwen/skills",
        Some(".qwen/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".qwen"],
        &[".qwen"],
    ),
    spec(
        AgentKind::Reasonix,
        "reasonix",
        "Reasonix",
        &["reasonix"],
        ".reasonix/skills",
        Some(".reasonix/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".reasonix"],
        &[".reasonix"],
    ),
    spec(
        AgentKind::Rovodev,
        "rovodev",
        "Rovo Dev",
        &["rovodev"],
        ".rovodev/skills",
        Some(".rovodev/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".rovodev"],
        &[".rovodev"],
    ),
    spec(
        AgentKind::Roo,
        "roo",
        "Roo Code",
        &["roo"],
        ".roo/skills",
        Some(".roo/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".roo", ".roomodes", ".roorules"],
        &[".roo"],
    ),
    spec(
        AgentKind::TabnineCli,
        "tabnine-cli",
        "Tabnine CLI",
        &["tabnine"],
        ".tabnine/agent/skills",
        Some(".tabnine/agent/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".tabnine"],
        &[".tabnine"],
    ),
    spec(
        AgentKind::Terramind,
        "terramind",
        "Terramind",
        &["terramind"],
        ".terramind/skills",
        Some(".terramind/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".terramind"],
        &[".terramind"],
    ),
    spec(
        AgentKind::Tinycloud,
        "tinycloud",
        "Tinycloud",
        &["tinycloud"],
        ".tinycloud/skills",
        Some(".tinycloud/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".tinycloud"],
        &[".tinycloud"],
    ),
    spec(
        AgentKind::Trae,
        "trae",
        "Trae",
        &["trae"],
        ".trae/skills",
        Some(".trae/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".trae"],
        &[".trae"],
    ),
    spec(
        AgentKind::TraeCn,
        "trae-cn",
        "Trae CN",
        &["trae-cn", "trae"],
        ".trae/skills",
        Some(".trae-cn/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".trae"],
        &[".trae-cn"],
    ),
    spec(
        AgentKind::Windsurf,
        "windsurf",
        "Windsurf",
        &["windsurf"],
        ".windsurf/skills",
        Some(".codeium/windsurf/skills"),
        &[".agents/skills"],
        &[],
        &[],
        &[],
        &[".windsurf", ".windsurfrules"],
        &[".codeium/windsurf"],
    ),
    spec(
        AgentKind::Zencoder,
        "zencoder",
        "Zencoder",
        &["zencoder"],
        ".zencoder/skills",
        Some(".zencoder/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".zencoder"],
        &[".zencoder"],
    ),
    spec(
        AgentKind::Zenflow,
        "zenflow",
        "Zenflow",
        &["zenflow"],
        ".zencoder/skills",
        Some(".zencoder/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".zencoder"],
        &[".zencoder"],
    ),
    spec(
        AgentKind::Neovate,
        "neovate",
        "Neovate",
        &["neovate"],
        ".neovate/skills",
        Some(".neovate/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".neovate"],
        &[".neovate"],
    ),
    spec(
        AgentKind::Pochi,
        "pochi",
        "Pochi",
        &["pochi"],
        ".pochi/skills",
        Some(".pochi/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".pochi"],
        &[".pochi"],
    ),
    spec(
        AgentKind::Promptscript,
        "promptscript",
        "PromptScript",
        &["promptscript"],
        ".agents/skills",
        None,
        &[],
        &[],
        &[],
        &[],
        &[".agents"],
        &[],
    ),
    spec(
        AgentKind::Adal,
        "adal",
        "AdaL",
        &["adal"],
        ".adal/skills",
        Some(".adal/skills"),
        &[],
        &[],
        &[],
        &[],
        &[".adal"],
        &[".adal"],
    ),
];

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn copilot_user_paths_honor_copilot_home() -> Result<()> {
        let _lock = crate::util::TEST_ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let home = TempDir::new()?;
        let previous = env::var_os("COPILOT_HOME");
        env::set_var("COPILOT_HOME", home.path());

        let skill_root = AgentKind::Copilot
            .skill_root_at(Path::new("."), InstallScope::User)?
            .expect("copilot user skill root");
        let agent_roots =
            AgentKind::Copilot.subagent_roots_at(Path::new("."), InstallScope::User)?;
        let markers = AgentKind::Copilot.marker_paths_at(Path::new("."), InstallScope::User)?;

        assert_eq!(skill_root, home.path().join("skills"));
        assert_eq!(agent_roots, vec![home.path().join("agents")]);
        assert!(markers.contains(&home.path().join("copilot-instructions.md")));
        assert!(markers.contains(&home.path().to_path_buf()));

        match previous {
            Some(value) => env::set_var("COPILOT_HOME", value),
            None => env::remove_var("COPILOT_HOME"),
        }
        Ok(())
    }

    #[test]
    fn copilot_project_skill_roots_match_cli_docs() -> Result<()> {
        let project = TempDir::new()?;
        let roots = AgentKind::Copilot.skill_roots_at(project.path(), InstallScope::Project)?;

        assert_eq!(
            roots,
            vec![
                project.path().join(".github/skills"),
                project.path().join(".claude/skills"),
                project.path().join(".agents/skills"),
            ]
        );
        Ok(())
    }
}
