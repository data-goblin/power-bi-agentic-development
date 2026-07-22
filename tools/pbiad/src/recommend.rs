use crate::detect::EnvironmentSignals;
use crate::registry::{Plugin, Registry};
use serde::Serialize;
use std::collections::BTreeSet;

#[derive(Clone, Debug, Serialize)]
pub struct Recommendation {
    pub plugin: String,
    pub description: String,
    pub recommended: bool,
    pub reasons: Vec<String>,
}

pub fn recommend(registry: &Registry, signals: &EnvironmentSignals) -> Vec<Recommendation> {
    let mut selected = BTreeSet::new();
    let mut out = Vec::new();

    push_if(
        registry,
        &mut selected,
        &mut out,
        "agentic-help",
        !signals.tools.pbir && !signals.tools.te && !signals.tools.fab,
        vec!["setup/on-ramp; core Power BI CLIs are not all detected".to_string()],
    );

    push_if(
        registry,
        &mut selected,
        &mut out,
        "pbip",
        signals.project.has_pbip(),
        vec![format!(
            "PBIP project signals: {} .pbip, {} .Report, {} .SemanticModel",
            signals.project.pbip_files,
            signals.project.report_dirs,
            signals.project.semantic_model_dirs
        )],
    );

    push_if(
        registry,
        &mut selected,
        &mut out,
        "reports",
        signals.project.has_report() || signals.tools.pbir,
        compact_reasons([
            (signals.project.has_report(), "PBIR/.Report files detected"),
            (signals.tools.pbir, "pbir CLI found on PATH"),
        ]),
    );

    push_if(
        registry,
        &mut selected,
        &mut out,
        "semantic-models",
        signals.project.has_semantic_model(),
        compact_reasons([
            (
                signals.project.semantic_model_dirs > 0,
                ".SemanticModel folder detected",
            ),
            (signals.project.tmdl_files > 0, "TMDL files detected"),
        ]),
    );

    push_if(
        registry,
        &mut selected,
        &mut out,
        "tabular-editor",
        signals.tools.te || signals.project.has_semantic_model(),
        compact_reasons([
            (signals.tools.te, "te CLI found on PATH"),
            (
                signals.project.has_semantic_model(),
                "semantic model project detected",
            ),
        ]),
    );

    push_if(
        registry,
        &mut selected,
        &mut out,
        "pbi-desktop",
        signals.project.has_pbip() && signals.tools.pwsh,
        compact_reasons([
            (signals.project.has_pbip(), "Power BI project detected"),
            (
                signals.tools.pwsh,
                "PowerShell found for Desktop bridge scripts",
            ),
        ]),
    );

    push_if(
        registry,
        &mut selected,
        &mut out,
        "fabric-cli",
        signals.tools.fab || signals.tools.az || signals.tools.sqlcmd,
        compact_reasons([
            (signals.tools.fab, "fab CLI found on PATH"),
            (signals.tools.az, "Azure CLI found on PATH"),
            (signals.tools.sqlcmd, "sqlcmd found on PATH"),
        ]),
    );

    push_if(
        registry,
        &mut selected,
        &mut out,
        "paginated-reports",
        signals.project.rdl_files > 0,
        vec![format!("{} .rdl files detected", signals.project.rdl_files)],
    );

    push_if(
        registry,
        &mut selected,
        &mut out,
        "custom-visuals",
        signals.project.deneb_specs > 0
            || signals.project.python_visuals > 0
            || signals.project.r_visuals > 0,
        compact_reasons([
            (
                signals.project.deneb_specs > 0,
                "Deneb/Vega visual JSON detected",
            ),
            (
                signals.project.python_visuals > 0,
                "Python visual files detected",
            ),
            (signals.project.r_visuals > 0, "R visual files detected"),
        ]),
    );

    push_if(
        registry,
        &mut selected,
        &mut out,
        "etl",
        signals.project.notebook_files > 0,
        vec![format!(
            "{} notebooks detected",
            signals.project.notebook_files
        )],
    );

    out
}

fn push_if(
    registry: &Registry,
    selected: &mut BTreeSet<String>,
    out: &mut Vec<Recommendation>,
    plugin_name: &str,
    condition: bool,
    reasons: Vec<String>,
) {
    if !condition || selected.contains(plugin_name) {
        return;
    }
    let Some(plugin) = registry.plugin(plugin_name) else {
        return;
    };
    selected.insert(plugin_name.to_string());
    out.push(from_plugin(plugin, true, reasons));
}

pub fn from_plugin(plugin: &Plugin, recommended: bool, reasons: Vec<String>) -> Recommendation {
    Recommendation {
        plugin: plugin.name.clone(),
        description: plugin.description.clone(),
        recommended,
        reasons,
    }
}

fn compact_reasons<const N: usize>(items: [(bool, &'static str); N]) -> Vec<String> {
    items
        .into_iter()
        .filter_map(|(enabled, reason)| enabled.then_some(reason.to_string()))
        .collect()
}
