use serde::Serialize;
use std::path::Path;
use walkdir::WalkDir;
use which::which;

#[derive(Clone, Debug, Default, Serialize)]
pub struct ProjectSignals {
    pub pbip_files: usize,
    pub report_dirs: usize,
    pub semantic_model_dirs: usize,
    pub tmdl_files: usize,
    pub rdl_files: usize,
    pub notebook_files: usize,
    pub deneb_specs: usize,
    pub python_visuals: usize,
    pub r_visuals: usize,
}

#[derive(Clone, Debug, Serialize)]
pub struct ToolSignals {
    pub pbir: bool,
    pub te: bool,
    pub fab: bool,
    pub az: bool,
    pub sqlcmd: bool,
    pub pwsh: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct EnvironmentSignals {
    pub project: ProjectSignals,
    pub tools: ToolSignals,
}

impl EnvironmentSignals {
    pub fn detect(root: &Path) -> Self {
        Self {
            project: ProjectSignals::detect(root),
            tools: ToolSignals::detect(),
        }
    }
}

impl ProjectSignals {
    fn detect(root: &Path) -> Self {
        let mut signals = Self::default();
        for entry in WalkDir::new(root)
            .follow_links(false)
            .into_iter()
            .filter_entry(|entry| !is_ignored_dir(entry.path()))
            .filter_map(Result::ok)
        {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
                continue;
            };

            if entry.file_type().is_dir() {
                if name.ends_with(".Report") {
                    signals.report_dirs += 1;
                } else if name.ends_with(".SemanticModel") {
                    signals.semantic_model_dirs += 1;
                }
                continue;
            }

            if !entry.file_type().is_file() {
                continue;
            }

            match path.extension().and_then(|extension| extension.to_str()) {
                Some("pbip") => signals.pbip_files += 1,
                Some("tmdl") => signals.tmdl_files += 1,
                Some("rdl") => signals.rdl_files += 1,
                Some("ipynb") => signals.notebook_files += 1,
                Some("py")
                    if path_has_segment(path, "visual") || path_has_segment(path, "visuals") =>
                {
                    signals.python_visuals += 1;
                }
                Some("r") | Some("R")
                    if path_has_segment(path, "visual") || path_has_segment(path, "visuals") =>
                {
                    signals.r_visuals += 1;
                }
                _ => {}
            }

            if name.eq_ignore_ascii_case("definition.pbir") {
                signals.report_dirs += 0;
            }
            if name.eq_ignore_ascii_case("visual.json") {
                if let Ok(content) = std::fs::read_to_string(path) {
                    if content.contains("deneb")
                        || content.contains("vega")
                        || content.contains("vegaLite")
                    {
                        signals.deneb_specs += 1;
                    }
                }
            }
        }
        signals
    }

    pub fn has_pbip(&self) -> bool {
        self.pbip_files > 0 || self.report_dirs > 0 || self.semantic_model_dirs > 0
    }

    pub fn has_report(&self) -> bool {
        self.report_dirs > 0
    }

    pub fn has_semantic_model(&self) -> bool {
        self.semantic_model_dirs > 0 || self.tmdl_files > 0
    }
}

impl ToolSignals {
    fn detect() -> Self {
        Self {
            pbir: which("pbir").is_ok(),
            te: which("te").is_ok(),
            fab: which("fab").is_ok(),
            az: which("az").is_ok(),
            sqlcmd: which("sqlcmd").is_ok(),
            pwsh: which("pwsh").is_ok() || which("powershell").is_ok(),
        }
    }
}

fn is_ignored_dir(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
        return false;
    };
    matches!(
        name,
        ".git" | "node_modules" | "target" | ".venv" | "venv" | "__pycache__" | ".cache"
    )
}

fn path_has_segment(path: &Path, segment: &str) -> bool {
    path.components().any(|component| {
        component
            .as_os_str()
            .to_string_lossy()
            .eq_ignore_ascii_case(segment)
    })
}
