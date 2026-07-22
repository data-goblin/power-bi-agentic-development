use crate::util::{read_to_string, strip_agent_suffix};
use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use serde_yaml::Value;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub fn is_deprecated_skill(name: &str) -> bool {
    matches!(name, "te2-cli")
}

#[derive(Clone, Debug, Serialize)]
pub struct Registry {
    pub root: PathBuf,
    pub name: String,
    pub version: Option<String>,
    pub plugins: Vec<Plugin>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Plugin {
    pub name: String,
    pub description: String,
    pub version: Option<String>,
    pub path: PathBuf,
    pub keywords: Vec<String>,
    pub skills: Vec<Skill>,
    pub agents: Vec<AgentDefinition>,
    pub hooks: Option<PathBuf>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub path: PathBuf,
}

#[derive(Clone, Debug, Serialize)]
pub struct AgentDefinition {
    pub name: String,
    pub description: String,
    pub path: PathBuf,
    pub body: String,
    pub model: Option<String>,
    pub color: Option<String>,
    pub tools: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct MarketplaceManifest {
    name: String,
    metadata: Option<MarketplaceMetadata>,
    plugins: Vec<MarketplacePlugin>,
}

#[derive(Debug, Deserialize)]
struct MarketplaceMetadata {
    version: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MarketplacePlugin {
    name: String,
    description: Option<String>,
    source: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct PluginManifest {
    name: String,
    version: Option<String>,
    description: Option<String>,
    keywords: Option<Vec<String>>,
}

impl Registry {
    pub fn load(root: PathBuf) -> Result<Self> {
        let marketplace_path = root.join(".claude-plugin/marketplace.json");
        let marketplace: MarketplaceManifest =
            serde_json::from_str(&read_to_string(&marketplace_path)?)
                .with_context(|| format!("parse {}", marketplace_path.display()))?;

        let mut plugins = Vec::new();
        for entry in marketplace.plugins {
            let Some(source) = entry.source.as_str() else {
                continue;
            };
            let plugin_path = resolve_relative_source(&root, source)?;
            let manifest_path = plugin_path.join(".claude-plugin/plugin.json");
            let manifest: PluginManifest =
                serde_json::from_str(&read_to_string(&manifest_path)?)
                    .with_context(|| format!("parse {}", manifest_path.display()))?;

            let skills = load_skills(&plugin_path)?;
            let agents = load_agents(&plugin_path)?;
            let hooks = plugin_path.join("hooks/hooks.json");
            let name = if manifest.name.is_empty() {
                entry.name
            } else {
                manifest.name
            };

            plugins.push(Plugin {
                name,
                description: manifest
                    .description
                    .or(entry.description)
                    .unwrap_or_else(|| "No description".to_string()),
                version: manifest.version,
                path: plugin_path,
                keywords: manifest.keywords.unwrap_or_default(),
                skills,
                agents,
                hooks: hooks.is_file().then_some(hooks),
            });
        }

        Ok(Self {
            root,
            name: marketplace.name,
            version: marketplace.metadata.and_then(|metadata| metadata.version),
            plugins,
        })
    }

    pub fn plugin(&self, name: &str) -> Option<&Plugin> {
        self.plugins.iter().find(|plugin| plugin.name == name)
    }

    pub fn skill(&self, name: &str) -> Option<(&Plugin, &Skill)> {
        self.plugins.iter().find_map(|plugin| {
            plugin
                .skills
                .iter()
                .find(|skill| skill.name == name)
                .map(|skill| (plugin, skill))
        })
    }

    pub fn skills(&self) -> impl Iterator<Item = (&Plugin, &Skill)> {
        self.plugins
            .iter()
            .flat_map(|plugin| plugin.skills.iter().map(move |skill| (plugin, skill)))
    }

    #[cfg_attr(not(feature = "plugins"), allow(dead_code))]
    pub fn resolve_selection(&self, name: &str) -> Option<ResourceSelection<'_>> {
        if let Some(plugin) = self.plugin(name) {
            return Some(ResourceSelection::Plugin(plugin));
        }
        self.plugins.iter().find_map(|plugin| {
            plugin
                .skills
                .iter()
                .find(|skill| skill.name == name)
                .map(|skill| ResourceSelection::Skill { plugin, skill })
        })
    }
}

#[cfg_attr(not(feature = "plugins"), allow(dead_code))]
#[derive(Clone, Copy, Debug)]
pub enum ResourceSelection<'a> {
    Plugin(&'a Plugin),
    Skill {
        plugin: &'a Plugin,
        skill: &'a Skill,
    },
}

impl Plugin {
    #[cfg(feature = "plugins")]
    pub fn component_summary(&self) -> String {
        let mut parts = Vec::new();
        let supported_skills = self
            .skills
            .iter()
            .filter(|skill| !is_deprecated_skill(&skill.name))
            .count();
        if supported_skills > 0 {
            parts.push(format!("{} skills", supported_skills));
        }
        if !self.agents.is_empty() {
            parts.push(format!("{} subagents", self.agents.len()));
        }
        if self.hooks.is_some() {
            parts.push("hooks".to_string());
        }
        if parts.is_empty() {
            "metadata only".to_string()
        } else {
            parts.join(", ")
        }
    }
}

fn resolve_relative_source(root: &Path, source: &str) -> Result<PathBuf> {
    if !source.starts_with("./") {
        return Err(anyhow!(
            "only local relative plugin sources are supported for now: {}",
            source
        ));
    }
    Ok(root.join(source.trim_start_matches("./")))
}

fn load_skills(plugin_path: &Path) -> Result<Vec<Skill>> {
    let skills_root = plugin_path.join("skills");
    if !skills_root.is_dir() {
        return Ok(Vec::new());
    }

    let mut skills = Vec::new();
    for entry in WalkDir::new(&skills_root)
        .min_depth(2)
        .max_depth(2)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file() && entry.file_name() == "SKILL.md")
    {
        let path = entry.into_path();
        let dir_name = path
            .parent()
            .and_then(|path| path.file_name())
            .and_then(|name| name.to_str())
            .unwrap_or("skill")
            .to_string();
        let content = read_to_string(&path)?;
        let frontmatter = parse_frontmatter(&content).unwrap_or_default();
        let name = string_field(&frontmatter, "name").unwrap_or(dir_name);
        let description = string_field(&frontmatter, "description")
            .unwrap_or_else(|| "No description".to_string());
        skills.push(Skill {
            name,
            description,
            path,
        });
    }
    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

fn load_agents(plugin_path: &Path) -> Result<Vec<AgentDefinition>> {
    let agents_root = plugin_path.join("agents");
    if !agents_root.is_dir() {
        return Ok(Vec::new());
    }

    let mut agents = Vec::new();
    for entry in WalkDir::new(&agents_root)
        .min_depth(1)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
    {
        let path = entry.into_path();
        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if !file_name.ends_with(".agent.md") {
            continue;
        }
        let content = read_to_string(&path)?;
        let (frontmatter, body) = if let Some((yaml, body)) = split_frontmatter(&content) {
            (
                serde_yaml::from_str::<BTreeMap<String, Value>>(yaml)
                    .with_context(|| format!("parse agent frontmatter {}", path.display()))?,
                body,
            )
        } else {
            (BTreeMap::new(), "")
        };
        let fallback = strip_agent_suffix(file_name).to_string();
        let name = string_field(&frontmatter, "name").unwrap_or(fallback);
        let description = string_field(&frontmatter, "description")
            .unwrap_or_else(|| "No description".to_string());
        let model = string_field(&frontmatter, "model");
        let color = string_field(&frontmatter, "color");
        let tools = string_list_field(&frontmatter, "tools");
        agents.push(AgentDefinition {
            name,
            description,
            path,
            body: body.trim().to_string(),
            model,
            color,
            tools,
        });
    }
    agents.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(agents)
}

fn parse_frontmatter(content: &str) -> Option<BTreeMap<String, Value>> {
    split_frontmatter(content)
        .and_then(|(yaml, _)| serde_yaml::from_str::<BTreeMap<String, Value>>(yaml).ok())
}

fn split_frontmatter(content: &str) -> Option<(&str, &str)> {
    let rest = content.strip_prefix("---\n")?;
    let end = rest.find("\n---")?;
    let yaml = &rest[..end];
    let body = rest[end + 4..]
        .strip_prefix('\n')
        .unwrap_or(&rest[end + 4..]);
    Some((yaml, body))
}

fn string_field(map: &BTreeMap<String, Value>, key: &str) -> Option<String> {
    map.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn string_list_field(map: &BTreeMap<String, Value>, key: &str) -> Vec<String> {
    map.get(key)
        .and_then(Value::as_sequence)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_frontmatter() {
        let content = "---\nname: dax\ndescription: DAX help\n---\nBody";
        let map = parse_frontmatter(content).expect("frontmatter");
        assert_eq!(string_field(&map, "name").as_deref(), Some("dax"));
        assert_eq!(
            string_field(&map, "description").as_deref(),
            Some("DAX help")
        );
    }
}
