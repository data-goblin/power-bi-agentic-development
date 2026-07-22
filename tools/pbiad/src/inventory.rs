use crate::agents::{AgentKind, AgentStatus, InstallScope};
#[cfg(feature = "plugins")]
use crate::registry::{is_deprecated_skill, Plugin, Registry};
use crate::util::{home_dir, read_to_string, DEACTIVATED_SKILL_CACHE_DIR};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Clone, Debug, Serialize)]
pub struct Inventory {
    pub agents: Vec<AgentInventory>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AgentInventory {
    pub status: AgentStatus,
    pub project_skills: Vec<InstalledResource>,
    pub user_skills: Vec<InstalledResource>,
    pub project_deactivated_skills: Vec<InstalledResource>,
    pub user_deactivated_skills: Vec<InstalledResource>,
    pub project_subagents: Vec<InstalledResource>,
    pub user_subagents: Vec<InstalledResource>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct InstalledResource {
    pub name: String,
    pub path: PathBuf,
}

#[cfg(feature = "plugins")]
#[derive(Clone, Debug, Serialize)]
pub struct PluginCoverage {
    pub plugin: String,
    pub skills_present: usize,
    pub skills_total: usize,
    pub subagents_present: usize,
    pub subagents_total: usize,
}

#[derive(Debug, Deserialize)]
struct ClaudeInstalledPlugins {
    plugins: BTreeMap<String, Vec<ClaudePluginInstall>>,
}

#[derive(Debug, Deserialize)]
struct ClaudePluginInstall {
    scope: String,
    #[serde(rename = "installPath")]
    install_path: PathBuf,
}

impl Inventory {
    pub fn detect(project_root: &Path) -> Self {
        let agents = AgentKind::ALL
            .into_iter()
            .map(|agent| AgentInventory::detect(agent, project_root))
            .collect();
        Self { agents }
    }

    pub fn visible_agents(&self, all_agents: bool) -> Vec<&AgentInventory> {
        self.agents
            .iter()
            .filter(|inventory| {
                all_agents
                    || (inventory.status.agent.is_popular()
                        && (inventory.status.installed || inventory.has_project_resources()))
            })
            .collect()
    }

    pub fn for_agent(&self, agent: AgentKind) -> Option<&AgentInventory> {
        self.agents
            .iter()
            .find(|inventory| inventory.status.agent == agent)
    }

    #[cfg(feature = "plugins")]
    pub fn coverage_for(
        &self,
        registry: &Registry,
        plugin: &Plugin,
        agents: &[AgentKind],
        scope: InstallScope,
    ) -> PluginCoverage {
        let skill_names = plugin
            .skills
            .iter()
            .filter(|skill| !is_deprecated_skill(&skill.name))
            .map(|skill| skill.name.as_str())
            .collect::<Vec<_>>();
        let subagent_names = plugin
            .agents
            .iter()
            .map(|agent| format!("{}-{}", plugin.name, agent.name))
            .collect::<Vec<_>>();

        let mut skills_present = 0;
        let mut subagents_present = 0;
        let skill_total = skill_names.len() * agents.len();
        let subagent_total = subagent_names.len() * agents.len();

        for agent in agents {
            let Some(inventory) = self.for_agent(*agent) else {
                continue;
            };
            let skills = inventory.skill_names(scope);
            let subagents = inventory.subagent_names(scope);
            skills_present += skill_names
                .iter()
                .filter(|name| skills.contains(**name))
                .count();
            subagents_present += subagent_names
                .iter()
                .filter(|name| subagents.contains(name.as_str()))
                .count();
        }

        let _ = registry;
        PluginCoverage {
            plugin: plugin.name.clone(),
            skills_present,
            skills_total: skill_total,
            subagents_present,
            subagents_total: subagent_total,
        }
    }
}

impl AgentInventory {
    pub fn detect(agent: AgentKind, project_root: &Path) -> Self {
        let status = agent.status_at(project_root);
        let mut project_skills = agent
            .skill_roots_at(project_root, InstallScope::Project)
            .unwrap_or_default()
            .into_iter()
            .flat_map(|root| scan_skill_root(agent, &root))
            .collect::<Vec<_>>();
        let mut user_skills = agent
            .skill_roots_at(project_root, InstallScope::User)
            .unwrap_or_default()
            .into_iter()
            .flat_map(|root| scan_skill_root(agent, &root))
            .collect::<Vec<_>>();
        let project_deactivated_skills = agent
            .skill_roots_at(project_root, InstallScope::Project)
            .unwrap_or_default()
            .into_iter()
            .flat_map(|root| scan_skill_root(agent, &root.join(DEACTIVATED_SKILL_CACHE_DIR)))
            .collect::<Vec<_>>();
        let user_deactivated_skills = agent
            .skill_roots_at(project_root, InstallScope::User)
            .unwrap_or_default()
            .into_iter()
            .flat_map(|root| scan_skill_root(agent, &root.join(DEACTIVATED_SKILL_CACHE_DIR)))
            .collect::<Vec<_>>();

        if agent == AgentKind::Claude {
            let native_plugins = scan_claude_native_plugin_skills();
            project_skills.extend(native_plugins.project);
            user_skills.extend(native_plugins.user);
        }

        let project_subagents = agent
            .subagent_roots_at(project_root, InstallScope::Project)
            .unwrap_or_default()
            .into_iter()
            .flat_map(|root| scan_subagent_root(&root))
            .collect::<Vec<_>>();
        let user_subagents = agent
            .subagent_roots_at(project_root, InstallScope::User)
            .unwrap_or_default()
            .into_iter()
            .flat_map(|root| scan_subagent_root(&root))
            .collect::<Vec<_>>();

        Self {
            status,
            project_skills: dedupe(project_skills),
            user_skills: dedupe(user_skills),
            project_deactivated_skills: dedupe(project_deactivated_skills),
            user_deactivated_skills: dedupe(user_deactivated_skills),
            project_subagents: dedupe(project_subagents),
            user_subagents: dedupe(user_subagents),
        }
    }

    pub fn has_project_resources(&self) -> bool {
        !self.project_skills.is_empty()
            || !self.project_deactivated_skills.is_empty()
            || !self.project_subagents.is_empty()
    }

    pub fn skill_count(&self, scope: InstallScope) -> usize {
        match scope {
            InstallScope::Project => self.project_skills.len(),
            InstallScope::User => self.user_skills.len(),
        }
    }

    pub fn subagent_count(&self, scope: InstallScope) -> usize {
        match scope {
            InstallScope::Project => self.project_subagents.len(),
            InstallScope::User => self.user_subagents.len(),
        }
    }

    pub fn skill_names(&self, scope: InstallScope) -> BTreeSet<&str> {
        match scope {
            InstallScope::Project => self.project_skills.iter(),
            InstallScope::User => self.user_skills.iter(),
        }
        .map(|resource| resource.name.as_str())
        .collect()
    }

    pub fn deactivated_skill_names(&self, scope: InstallScope) -> BTreeSet<&str> {
        match scope {
            InstallScope::Project => self.project_deactivated_skills.iter(),
            InstallScope::User => self.user_deactivated_skills.iter(),
        }
        .map(|resource| resource.name.as_str())
        .collect()
    }

    #[cfg(feature = "plugins")]
    pub fn subagent_names(&self, scope: InstallScope) -> BTreeSet<&str> {
        match scope {
            InstallScope::Project => self.project_subagents.iter(),
            InstallScope::User => self.user_subagents.iter(),
        }
        .map(|resource| resource.name.as_str())
        .collect()
    }
}

#[derive(Default)]
struct ScopedSkills {
    project: Vec<InstalledResource>,
    user: Vec<InstalledResource>,
}

#[cfg(feature = "plugins")]
impl PluginCoverage {
    pub fn is_complete(&self) -> bool {
        self.skills_present >= self.skills_total && self.subagents_present >= self.subagents_total
    }

    pub fn label_hint(&self) -> String {
        let mut parts = Vec::new();
        if self.skills_total > 0 {
            parts.push(format!(
                "{}/{} skills",
                self.skills_present, self.skills_total
            ));
        }
        if self.subagents_total > 0 {
            parts.push(format!(
                "{}/{} subagents",
                self.subagents_present, self.subagents_total
            ));
        }
        parts.join(", ")
    }
}

fn scan_skill_root(agent: AgentKind, root: &Path) -> Vec<InstalledResource> {
    if !root.is_dir() {
        return Vec::new();
    }

    let mut resources = WalkDir::new(root)
        .min_depth(2)
        .max_depth(2)
        .follow_links(true)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file() && entry.file_name() == "SKILL.md")
        .filter_map(|entry| {
            let path = entry.into_path();
            let name = path
                .parent()
                .and_then(|path| path.file_name())
                .and_then(|name| name.to_str())?
                .to_string();
            Some(InstalledResource { name, path })
        })
        .collect::<Vec<_>>();

    if agent == AgentKind::AntigravityCli {
        resources.extend(scan_markdown_skill_root(root));
    }

    resources
}

fn scan_markdown_skill_root(root: &Path) -> Vec<InstalledResource> {
    WalkDir::new(root)
        .min_depth(1)
        .max_depth(1)
        .follow_links(true)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| {
            entry.file_type().is_file()
                && entry.path().extension().and_then(|ext| ext.to_str()) == Some("md")
        })
        .filter_map(|entry| {
            let path = entry.into_path();
            let name = path.file_stem().and_then(|name| name.to_str())?.to_string();
            Some(InstalledResource { name, path })
        })
        .collect()
}

fn scan_claude_native_plugin_skills() -> ScopedSkills {
    let Ok(home) = home_dir() else {
        return ScopedSkills::default();
    };
    let registry = home.join(".claude/plugins/installed_plugins.json");
    let Ok(content) = read_to_string(&registry) else {
        return ScopedSkills::default();
    };
    let Ok(installed) = serde_json::from_str::<ClaudeInstalledPlugins>(&content)
        .with_context(|| format!("parse {}", registry.display()))
    else {
        return ScopedSkills::default();
    };

    let mut scoped = ScopedSkills::default();
    for installs in installed.plugins.values() {
        for install in installs {
            let skills = scan_skill_root(AgentKind::Claude, &install.install_path.join("skills"));
            match install.scope.as_str() {
                "project" => scoped.project.extend(skills),
                "user" => scoped.user.extend(skills),
                _ => {}
            }
        }
    }
    scoped
}

fn scan_subagent_root(root: &Path) -> Vec<InstalledResource> {
    if !root.is_dir() {
        return Vec::new();
    }

    WalkDir::new(root)
        .min_depth(1)
        .max_depth(1)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .filter_map(|entry| {
            let path = entry.into_path();
            let name = path
                .file_stem()
                .and_then(|name| name.to_str())
                .map(ToOwned::to_owned)?;
            Some(InstalledResource { name, path })
        })
        .collect()
}

fn dedupe(mut resources: Vec<InstalledResource>) -> Vec<InstalledResource> {
    resources.sort_by(|a, b| a.name.cmp(&b.name).then_with(|| a.path.cmp(&b.path)));
    resources.dedup_by(|a, b| a.name == b.name && a.path == b.path);
    resources
}
