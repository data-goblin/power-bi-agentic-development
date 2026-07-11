use crate::agents::AgentKind;
use crate::util::ensure_dir;
use anyhow::{anyhow, Context, Result};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct AppConfig {
    pub agents: Option<Vec<String>>,
}

pub fn load_config() -> Result<AppConfig> {
    let path = config_path()?;
    if !path.is_file() {
        return Ok(AppConfig::default());
    }
    let content = fs::read_to_string(&path).with_context(|| format!("read {}", path.display()))?;
    toml::from_str(&content).with_context(|| format!("parse {}", path.display()))
}

pub fn configured_agents() -> Result<Option<Vec<AgentKind>>> {
    let Some(slugs) = load_config()?.agents else {
        return Ok(None);
    };
    let mut agents = Vec::new();
    for slug in slugs {
        let agent = agent_from_slug(&slug)
            .ok_or_else(|| anyhow!("unknown configured agent in pbiad config: {}", slug))?;
        if !agents.contains(&agent) {
            agents.push(agent);
        }
    }
    if agents.is_empty() {
        Ok(None)
    } else {
        Ok(Some(agents))
    }
}

pub fn save_agents(agents: &[AgentKind]) -> Result<PathBuf> {
    let path = config_path()?;
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    let config = AppConfig {
        agents: Some(
            agents
                .iter()
                .map(|agent| agent.slug().to_string())
                .collect(),
        ),
    };
    let content = toml::to_string_pretty(&config).context("serialize pbiad config")?;
    fs::write(&path, content).with_context(|| format!("write {}", path.display()))?;
    Ok(path)
}

pub fn clear_agents() -> Result<PathBuf> {
    let path = config_path()?;
    if path.is_file() {
        fs::remove_file(&path).with_context(|| format!("remove {}", path.display()))?;
    }
    Ok(path)
}

pub fn config_path() -> Result<PathBuf> {
    let dirs = ProjectDirs::from("com", "data-goblin", "pbiad")
        .ok_or_else(|| anyhow!("could not determine config directory"))?;
    Ok(dirs.config_dir().join("config.toml"))
}

fn agent_from_slug(value: &str) -> Option<AgentKind> {
    let normalized = value.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "claude" => return Some(AgentKind::Claude),
        "copilot" => return Some(AgentKind::Copilot),
        "jetbrains" => return Some(AgentKind::Junie),
        _ => {}
    }
    AgentKind::ALL.into_iter().find(|agent| {
        agent.slug() == normalized || agent.display_name().to_ascii_lowercase() == normalized
    })
}
