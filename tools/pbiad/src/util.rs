use anyhow::{anyhow, Context, Result};
use directories::BaseDirs;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub const DEACTIVATED_SKILL_CACHE_DIR: &str = ".pbiad-cache";

#[cfg(test)]
pub static TEST_ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

pub fn home_dir() -> Result<PathBuf> {
    BaseDirs::new()
        .map(|dirs| dirs.home_dir().to_path_buf())
        .ok_or_else(|| anyhow!("could not determine home directory"))
}

pub fn ensure_dir(path: &Path) -> Result<()> {
    fs::create_dir_all(path).with_context(|| format!("create {}", path.display()))
}

pub fn read_to_string(path: &Path) -> Result<String> {
    fs::read_to_string(path).with_context(|| format!("read {}", path.display()))
}

pub fn write_string(path: &Path, content: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    fs::write(path, content).with_context(|| format!("write {}", path.display()))
}

pub fn canonical_or_original(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

pub fn symlink_dir(src: &Path, dst: &Path, dry_run: bool) -> Result<()> {
    if dst.exists() {
        if same_link_target(src, dst)? {
            return Ok(());
        }
        return Err(anyhow!(
            "destination already exists and is not the expected symlink: {}",
            dst.display()
        ));
    }

    if dry_run {
        return Ok(());
    }

    if let Some(parent) = dst.parent() {
        ensure_dir(parent)?;
    }

    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(src, dst)
            .with_context(|| format!("symlink {} -> {}", dst.display(), src.display()))?;
    }

    #[cfg(windows)]
    {
        std::os::windows::fs::symlink_dir(src, dst)
            .with_context(|| format!("symlink {} -> {}", dst.display(), src.display()))?;
    }

    Ok(())
}

pub fn remove_symlink_dir(path: &Path, dry_run: bool) -> Result<bool> {
    let meta = match fs::symlink_metadata(path) {
        Ok(meta) => meta,
        Err(err) if err.kind() == io::ErrorKind::NotFound => return Ok(false),
        Err(err) => return Err(err).with_context(|| format!("inspect {}", path.display())),
    };

    if !meta.file_type().is_symlink() {
        return Err(anyhow!(
            "refusing to remove non-symlink skill directory: {}",
            path.display()
        ));
    }

    if dry_run {
        return Ok(true);
    }

    fs::remove_file(path)
        .or_else(|_| fs::remove_dir(path))
        .with_context(|| format!("remove symlink {}", path.display()))?;
    Ok(true)
}

fn same_link_target(src: &Path, dst: &Path) -> Result<bool> {
    let meta = fs::symlink_metadata(dst).with_context(|| format!("inspect {}", dst.display()))?;
    if !meta.file_type().is_symlink() {
        return Ok(false);
    }
    let target = fs::read_link(dst).with_context(|| format!("read symlink {}", dst.display()))?;
    let resolved = if target.is_absolute() {
        target
    } else {
        dst.parent().unwrap_or_else(|| Path::new(".")).join(target)
    };
    Ok(canonical_or_original(&resolved) == canonical_or_original(src))
}

pub fn strip_agent_suffix(file_name: &str) -> &str {
    file_name
        .strip_suffix(".agent.md")
        .or_else(|| file_name.strip_suffix(".md"))
        .unwrap_or(file_name)
}

#[cfg_attr(not(feature = "plugins"), allow(dead_code))]
pub fn quote_toml_multiline(value: &str) -> String {
    let escaped = value.replace("\"\"\"", "\\\"\\\"\\\"");
    format!("\"\"\"\n{}\n\"\"\"", escaped.trim())
}

pub fn shell_quote(value: &Path) -> String {
    let s = value.to_string_lossy();
    format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
}
