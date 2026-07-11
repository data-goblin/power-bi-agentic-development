use crate::agents::AgentKind;
use anyhow::Result;
use serde::Serialize;
use std::collections::BTreeSet;
use std::fmt;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Clone, Debug, Serialize)]
pub struct MemoryInventory {
    pub entries: Vec<MemoryEntry>,
    pub total_approx_tokens: usize,
}

#[derive(Clone, Debug, Serialize)]
pub struct MemoryEntry {
    pub scope: MemoryScope,
    pub kind: MemoryKind,
    pub agent: Option<AgentKind>,
    pub path: PathBuf,
    pub bytes: u64,
    pub lines: usize,
    pub approx_tokens: usize,
    pub included_by: Option<PathBuf>,
    pub include_depth: usize,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MemoryScope {
    Project,
    User,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MemoryKind {
    Memory,
    Rules,
    Instructions,
    Prompt,
}

impl MemoryInventory {
    pub fn detect(project_root: &Path, include_user: bool) -> Result<Self> {
        let mut builder = MemoryBuilder::default();
        builder.add_project(project_root)?;
        if include_user {
            builder.add_user()?;
        }
        Ok(builder.finish())
    }
}

impl fmt::Display for MemoryScope {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            MemoryScope::Project => "project",
            MemoryScope::User => "user",
        })
    }
}

impl fmt::Display for MemoryKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            MemoryKind::Memory => "memory",
            MemoryKind::Rules => "rules",
            MemoryKind::Instructions => "instructions",
            MemoryKind::Prompt => "prompt",
        })
    }
}

#[derive(Default)]
struct MemoryBuilder {
    entries: Vec<MemoryEntry>,
    seen: BTreeSet<PathBuf>,
}

impl MemoryBuilder {
    fn add_project(&mut self, root: &Path) -> Result<()> {
        self.add_file(
            root,
            "AGENTS.md",
            MemoryScope::Project,
            MemoryKind::Instructions,
            None,
        )?;
        self.add_file(
            root,
            "CLAUDE.md",
            MemoryScope::Project,
            MemoryKind::Memory,
            Some(AgentKind::Claude),
        )?;
        self.add_file(
            root,
            "GEMINI.md",
            MemoryScope::Project,
            MemoryKind::Memory,
            Some(AgentKind::AntigravityCli),
        )?;
        self.add_file(
            root,
            "CONVENTIONS.md",
            MemoryScope::Project,
            MemoryKind::Rules,
            Some(AgentKind::Aider),
        )?;
        self.add_file(
            root,
            ".cursorrules",
            MemoryScope::Project,
            MemoryKind::Rules,
            Some(AgentKind::Cursor),
        )?;
        self.add_file(
            root,
            ".windsurfrules",
            MemoryScope::Project,
            MemoryKind::Rules,
            Some(AgentKind::Windsurf),
        )?;
        self.add_file(
            root,
            ".clinerules",
            MemoryScope::Project,
            MemoryKind::Rules,
            Some(AgentKind::Cline),
        )?;
        self.add_file(
            root,
            ".roorules",
            MemoryScope::Project,
            MemoryKind::Rules,
            Some(AgentKind::Roo),
        )?;
        self.add_file(
            root,
            ".github/copilot-instructions.md",
            MemoryScope::Project,
            MemoryKind::Instructions,
            Some(AgentKind::Copilot),
        )?;
        self.add_file(
            root,
            ".claude/prompt.md",
            MemoryScope::Project,
            MemoryKind::Prompt,
            Some(AgentKind::Claude),
        )?;
        self.add_file(
            root,
            ".opencode/AGENTS.md",
            MemoryScope::Project,
            MemoryKind::Instructions,
            Some(AgentKind::Opencode),
        )?;
        self.add_dir(
            root,
            ".claude/rules",
            MemoryScope::Project,
            MemoryKind::Rules,
            Some(AgentKind::Claude),
        )?;
        self.add_dir(
            root,
            ".github/instructions",
            MemoryScope::Project,
            MemoryKind::Instructions,
            Some(AgentKind::Copilot),
        )?;
        self.add_dir(
            root,
            ".github/prompts",
            MemoryScope::Project,
            MemoryKind::Prompt,
            Some(AgentKind::Copilot),
        )?;
        self.add_dir(
            root,
            ".cursor/rules",
            MemoryScope::Project,
            MemoryKind::Rules,
            Some(AgentKind::Cursor),
        )?;
        self.add_dir(
            root,
            ".windsurf/rules",
            MemoryScope::Project,
            MemoryKind::Rules,
            Some(AgentKind::Windsurf),
        )?;
        self.add_dir(
            root,
            ".agents/rules",
            MemoryScope::Project,
            MemoryKind::Rules,
            None,
        )?;
        self.add_dir(
            root,
            ".opencode/rules",
            MemoryScope::Project,
            MemoryKind::Rules,
            Some(AgentKind::Opencode),
        )?;
        self.add_dir(
            root,
            ".kiro/steering",
            MemoryScope::Project,
            MemoryKind::Instructions,
            Some(AgentKind::Kiro),
        )?;
        self.add_dir(
            root,
            ".kiro/specs",
            MemoryScope::Project,
            MemoryKind::Instructions,
            Some(AgentKind::Kiro),
        )?;
        self.add_dir(
            root,
            ".roo/rules",
            MemoryScope::Project,
            MemoryKind::Rules,
            Some(AgentKind::Roo),
        )?;
        self.add_dir(
            root,
            ".clinerules",
            MemoryScope::Project,
            MemoryKind::Rules,
            Some(AgentKind::Cline),
        )?;
        self.add_dir(
            root,
            "memory-bank",
            MemoryScope::Project,
            MemoryKind::Memory,
            Some(AgentKind::Cline),
        )?;

        Ok(())
    }

    fn add_user(&mut self) -> Result<()> {
        let home = crate::util::home_dir()?;
        self.add_file(
            &home,
            ".claude/CLAUDE.md",
            MemoryScope::User,
            MemoryKind::Memory,
            Some(AgentKind::Claude),
        )?;
        self.add_file(
            &home,
            ".codex/AGENTS.md",
            MemoryScope::User,
            MemoryKind::Instructions,
            Some(AgentKind::Codex),
        )?;
        self.add_file(
            &home,
            ".gemini/GEMINI.md",
            MemoryScope::User,
            MemoryKind::Memory,
            Some(AgentKind::AntigravityCli),
        )?;
        self.add_file(
            &home,
            ".copilot/copilot-instructions.md",
            MemoryScope::User,
            MemoryKind::Instructions,
            Some(AgentKind::Copilot),
        )?;
        self.add_file(
            &home,
            ".config/opencode/AGENTS.md",
            MemoryScope::User,
            MemoryKind::Instructions,
            Some(AgentKind::Opencode),
        )?;
        self.add_dir(
            &home,
            ".claude/rules",
            MemoryScope::User,
            MemoryKind::Rules,
            Some(AgentKind::Claude),
        )?;
        self.add_dir(
            &home,
            ".cursor/rules",
            MemoryScope::User,
            MemoryKind::Rules,
            Some(AgentKind::Cursor),
        )?;
        self.add_dir(
            &home,
            ".codeium/windsurf/rules",
            MemoryScope::User,
            MemoryKind::Rules,
            Some(AgentKind::Windsurf),
        )?;
        self.add_dir(
            &home,
            ".kiro/steering",
            MemoryScope::User,
            MemoryKind::Instructions,
            Some(AgentKind::Kiro),
        )?;
        self.add_dir(
            &home,
            ".roo/rules",
            MemoryScope::User,
            MemoryKind::Rules,
            Some(AgentKind::Roo),
        )?;

        Ok(())
    }

    fn add_file(
        &mut self,
        root: &Path,
        relative: &str,
        scope: MemoryScope,
        kind: MemoryKind,
        agent: Option<AgentKind>,
    ) -> Result<()> {
        let path = root.join(relative);
        self.add_path(path, scope, kind, agent)
    }

    fn add_dir(
        &mut self,
        root: &Path,
        relative: &str,
        scope: MemoryScope,
        kind: MemoryKind,
        agent: Option<AgentKind>,
    ) -> Result<()> {
        let dir = root.join(relative);
        if !dir.is_dir() {
            return Ok(());
        }
        for entry in WalkDir::new(&dir)
            .min_depth(1)
            .max_depth(3)
            .follow_links(false)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_file())
        {
            let path = entry.into_path();
            if is_context_file(&path) {
                self.add_path(path, scope, kind, agent)?;
            }
        }
        Ok(())
    }

    fn add_path(
        &mut self,
        path: PathBuf,
        scope: MemoryScope,
        kind: MemoryKind,
        agent: Option<AgentKind>,
    ) -> Result<()> {
        self.add_path_with_parent(path, scope, kind, agent, None, 0)
    }

    fn add_path_with_parent(
        &mut self,
        path: PathBuf,
        scope: MemoryScope,
        kind: MemoryKind,
        agent: Option<AgentKind>,
        included_by: Option<PathBuf>,
        include_depth: usize,
    ) -> Result<()> {
        if !path.is_file() {
            return Ok(());
        }
        let stable_path = path.canonicalize().unwrap_or(path);
        if !self.seen.insert(stable_path.clone()) {
            return Ok(());
        }
        let bytes = std::fs::metadata(&stable_path)?.len();
        let lines = line_count(&stable_path);
        self.entries.push(MemoryEntry {
            scope,
            kind,
            agent,
            path: stable_path.clone(),
            bytes,
            lines,
            approx_tokens: approx_tokens(bytes),
            included_by: included_by.clone(),
            include_depth,
        });
        if include_depth < 5 {
            for include in referenced_files(&stable_path) {
                self.add_path_with_parent(
                    include,
                    scope,
                    kind,
                    agent,
                    Some(stable_path.clone()),
                    include_depth + 1,
                )?;
            }
        }
        Ok(())
    }

    fn finish(mut self) -> MemoryInventory {
        self.entries.sort_by(|a, b| {
            memory_scope_rank(a.scope)
                .cmp(&memory_scope_rank(b.scope))
                .then_with(|| b.approx_tokens.cmp(&a.approx_tokens))
                .then_with(|| a.kind.cmp(&b.kind))
                .then_with(|| a.path.cmp(&b.path))
        });
        let total_approx_tokens = self.entries.iter().map(|entry| entry.approx_tokens).sum();
        MemoryInventory {
            entries: self.entries,
            total_approx_tokens,
        }
    }
}

fn memory_scope_rank(scope: MemoryScope) -> usize {
    match scope {
        MemoryScope::User => 0,
        MemoryScope::Project => 1,
    }
}

fn is_context_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|extension| extension.to_str()),
        Some("md" | "mdc" | "txt" | "json" | "jsonc" | "toml" | "yaml" | "yml")
    )
}

fn approx_tokens(bytes: u64) -> usize {
    if bytes == 0 {
        0
    } else {
        bytes.div_ceil(4) as usize
    }
}

fn line_count(path: &Path) -> usize {
    std::fs::read_to_string(path)
        .map(|content| content.lines().count().max(1))
        .unwrap_or(0)
}

fn referenced_files(path: &Path) -> Vec<PathBuf> {
    let Ok(content) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let base = path.parent().unwrap_or_else(|| Path::new("."));
    extract_at_paths(&content)
        .into_iter()
        .filter_map(|reference| resolve_reference(base, &reference))
        .filter(|reference| reference.is_file())
        .collect()
}

fn extract_at_paths(content: &str) -> Vec<String> {
    let mut references = Vec::new();
    let chars = content.char_indices().collect::<Vec<_>>();
    let mut idx = 0usize;
    while idx < chars.len() {
        let (byte_idx, ch) = chars[idx];
        if ch != '@' {
            idx += 1;
            continue;
        }
        let start = byte_idx + ch.len_utf8();
        let mut end = start;
        idx += 1;
        while idx < chars.len() {
            let (next_byte, next_ch) = chars[idx];
            if is_reference_delimiter(next_ch) {
                break;
            }
            end = next_byte + next_ch.len_utf8();
            idx += 1;
        }
        if end > start {
            let reference = content[start..end]
                .trim_matches(|ch| matches!(ch, '"' | '\'' | '<' | '>' | '`'))
                .to_string();
            if !reference.is_empty() {
                references.push(reference);
            }
        }
    }
    references
}

fn is_reference_delimiter(ch: char) -> bool {
    ch.is_whitespace() || matches!(ch, ')' | ']' | '}' | ',' | ';' | ':' | '"' | '\'' | '`')
}

fn resolve_reference(base: &Path, reference: &str) -> Option<PathBuf> {
    if reference.starts_with("http://") || reference.starts_with("https://") {
        return None;
    }
    let path = if let Some(stripped) = reference.strip_prefix("~/") {
        crate::util::home_dir().ok()?.join(stripped)
    } else {
        let reference = PathBuf::from(reference);
        if reference.is_absolute() {
            reference
        } else {
            base.join(reference)
        }
    };
    Some(path)
}
