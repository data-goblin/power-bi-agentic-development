use anyhow::{anyhow, Context, Result};
use clap::ValueEnum;
use directories::ProjectDirs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub enum RegistrySource {
    Auto,
    Local,
    Latest,
}

#[derive(Clone, Debug)]
pub struct SourceOptions {
    pub repo: Option<PathBuf>,
    pub source: RegistrySource,
    pub git_ref: String,
    pub refresh: bool,
}

pub fn resolve_registry_root(start: &Path, options: &SourceOptions) -> Result<PathBuf> {
    if let Some(repo) = &options.repo {
        return validate_registry_root(repo);
    }

    match options.source {
        RegistrySource::Local => {
            let local = discover_registry_root(start)
                .ok_or_else(|| anyhow!("no local marketplace found from {}", start.display()))?;
            validate_registry_root(&local)
        }
        RegistrySource::Latest => ensure_cached_repo(&options.git_ref, options.refresh),
        RegistrySource::Auto => {
            if let Some(local) = discover_registry_root(start) {
                validate_registry_root(&local)
            } else {
                ensure_cached_repo(&options.git_ref, options.refresh)
            }
        }
    }
}

pub fn discover_registry_root(start: &Path) -> Option<PathBuf> {
    let mut current = start.canonicalize().unwrap_or_else(|_| start.to_path_buf());
    if current.is_file() {
        current.pop();
    }

    loop {
        if current.join(".claude-plugin/marketplace.json").is_file() {
            return Some(current);
        }
        if !current.pop() {
            return None;
        }
    }
}

fn validate_registry_root(path: &Path) -> Result<PathBuf> {
    let root = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let marketplace = root.join(".claude-plugin/marketplace.json");
    if !marketplace.is_file() {
        return Err(anyhow!(
            "{} does not contain .claude-plugin/marketplace.json",
            root.display()
        ));
    }
    Ok(root)
}

fn ensure_cached_repo(git_ref: &str, refresh: bool) -> Result<PathBuf> {
    let dirs = ProjectDirs::from("com", "data-goblin", "pbiad")
        .ok_or_else(|| anyhow!("could not determine cache directory"))?;
    let safe_ref = git_ref
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>();
    let root = dirs
        .cache_dir()
        .join("registries")
        .join("power-bi-agentic-development")
        .join(safe_ref);

    if root.join(".claude-plugin/marketplace.json").is_file() && !refresh {
        return Ok(root);
    }

    if root.join(".git").is_dir() {
        run_git(
            Command::new("git")
                .arg("-C")
                .arg(&root)
                .arg("fetch")
                .arg("--quiet")
                .arg("--depth")
                .arg("1")
                .arg("origin")
                .arg(git_ref),
        )?;
        run_git(
            Command::new("git")
                .arg("-C")
                .arg(&root)
                .arg("checkout")
                .arg("--quiet")
                .arg("FETCH_HEAD"),
        )?;
    } else {
        if let Some(parent) = root.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("create {}", parent.display()))?;
        }
        run_git(
            Command::new("git")
                .arg("clone")
                .arg("--quiet")
                .arg("--depth")
                .arg("1")
                .arg("--branch")
                .arg(git_ref)
                .arg("https://github.com/data-goblin/power-bi-agentic-development.git")
                .arg(&root),
        )?;
    }

    validate_registry_root(&root)
}

fn run_git(command: &mut Command) -> Result<()> {
    let command_text = format!("{command:?}");
    let output = command
        .output()
        .with_context(|| format!("run {command_text}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let details = if stderr.trim().is_empty() {
            stdout.trim()
        } else {
            stderr.trim()
        };
        if details.is_empty() {
            return Err(anyhow!(
                "git command failed with status {}: {}",
                output.status,
                command_text
            ));
        }
        return Err(anyhow!(
            "git command failed with status {}: {}\n{}",
            output.status,
            command_text,
            details
        ));
    }
    Ok(())
}
