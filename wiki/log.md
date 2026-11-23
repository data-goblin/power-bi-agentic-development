# Verification log

One line per check: `YYYY-MM-DD <page> <what was checked against what>`.

2026-11-23 plugins/pbip/wiki/tmdl-hand-editing-gotchas.md te 0.8.1.1 validate and save-as on examples/bikes; Learn tmdl-overview and dax-user-defined-functions read
2026-11-23 plugins/pbip/wiki/tmdl-worked-example.md te 0.8.1.1 validate and save-as on examples/bikes; Learn tmdl-overview and dax-user-defined-functions read
2026-11-23 plugins/pbip/wiki/tmdl-user-defined-functions.md te 0.8.1.1 validate and save-as on examples/bikes; Learn tmdl-overview and dax-user-defined-functions read
2026-11-23 plugins/pbip/wiki/bim-to-tmdl.md te 0.8.1.1 validate and save-as on examples/bikes; Learn tmdl-overview and dax-user-defined-functions read
2026-11-23 plugins/pbip/wiki/pbip-entry-files.md schemas from microsoft/json-schemas, validate_pbip.py and pbir validate on examples/bikes
2026-11-23 plugins/pbip/wiki/pbip-rename-gaps.md schemas from microsoft/json-schemas, validate_pbip.py and pbir validate on examples/bikes
2026-11-23 plugins/pbip/wiki/pbip-copilot-folder.md schemas from microsoft/json-schemas, validate_pbip.py and pbir validate on examples/bikes
2026-11-23 plugins/pbip/wiki/pbir-schema-map.md semanticQuery 1.4.0, filterConfiguration 1.3.0, page 2.1.0 schemas read; pbir 0.9.33 help
2026-11-23 plugins/pbip/wiki/pbir-expression-values.md semanticQuery 1.4.0, filterConfiguration 1.3.0, page 2.1.0 schemas read; pbir 0.9.33 help
2026-11-23 plugins/pbip/wiki/pbir-filters.md semanticQuery 1.4.0, filterConfiguration 1.3.0, page 2.1.0 schemas read; pbir 0.9.33 help
2026-11-23 plugins/pbip/wiki/pbir-page-json.md semanticQuery 1.4.0, filterConfiguration 1.3.0, page 2.1.0 schemas read; pbir 0.9.33 help
2026-11-23 plugins/pbip/wiki/pbir-theme-cascade.md semanticQuery 1.4.0, filterConfiguration 1.3.0, page 2.1.0 schemas read; pbir 0.9.33 help
2026-11-23 plugins/tabular-editor/wiki/bpa-rule-format.md te 0.8.1.1 bpa run on Bikes and embedded examples; docs bpa.md read
2026-11-23 plugins/tabular-editor/wiki/bpa-dynamic-linq.md te 0.8.1.1 bpa run on Bikes and embedded examples; docs bpa.md read
2026-11-23 plugins/tabular-editor/wiki/bpa-model-annotations.md te 0.8.1.1 bpa run on Bikes and embedded examples; docs bpa.md read
2026-11-23 plugins/custom-visuals/wiki/deneb-2-migration.md checked against deneb.guide changelog and published capabilities.json
2026-11-23 plugins/custom-visuals/wiki/deneb-community-templates.md all 12 repository URLs returned 200 or a redirect
2026-11-23 plugins/custom-visuals/wiki/deneb-pbir-objects.md object properties read from capabilities.json; pbir 0.9.33 commands run on a scratch report
2026-11-23 plugins/custom-visuals/wiki/deneb-templates-v2.md example usermeta validated against deneb-template-usermeta-v2.json
2026-11-23 plugins/custom-visuals/wiki/pbiviz-7-gotchas.md compared with PowerBI-visuals-tools Changelog.md and the Learn certification page
2026-11-23 plugins/custom-visuals/wiki/r-visual-service-traps.md compared with Learn service R visuals page
2026-11-23 plugins/custom-visuals/wiki/script-visual-dataset-and-limits.md compared with Learn Python and R visual pages and the service package page
2026-11-23 plugins/custom-visuals/wiki/script-visuals-retirement.md compared with Learn script visuals overview dated 2026-11-06
2026-11-23 plugins/custom-visuals/wiki/svg-measure-gotchas.md checked against the SQLBI article; community claims marked Unverified
2026-11-23 plugins/custom-visuals/wiki/svg-measure-wiring-by-visual.md table and matrix steps run with pbir 0.9.33; card, slicer and image blocks carried over unrendered
2026-11-23 plugins/paginated-reports/wiki/paginated-example-reports.md ten public samples run through validate_rdl.py without errors
2026-11-23 plugins/paginated-reports/wiki/paginated-limits-and-differences.md compared with Learn paginated FAQ and performance guidance
2026-11-23 plugins/paginated-reports/wiki/paginated-publish-and-export.md REST page URLs return 200; flow and constraints carried over from earlier notes, not re-run
2026-11-23 plugins/paginated-reports/wiki/pbidataset-connection-and-fields.md starter passes validate_rdl.py; connect string rules from earlier repository notes
2026-11-23 plugins/paginated-reports/wiki/rdl-structure-and-order.md three starters and ten public samples pass validate_rdl.py
2026-11-23 plugins/fabric-cli/wiki/*.md ten pages condensed from the former references; fab commands checked against fab 1.7.0 help and read-only calls; REST bodies marked Unverified where not run
2026-11-23 plugins/etl/wiki/livy-api.md Livy token scopes and endpoints against Learn get-started-api-livy-session; session behaviour not run (consumes capacity)
2026-11-23 plugins/tabular-editor/wiki/bpa-ci-rule-set.md two rules run with te bpa run on the Bikes model (0 violations); prove-rules.py injects each violation and sees exit 1 with the rule ID
2026-11-23 plugins/tabular-editor/wiki/te-test-reconciliation-suite.md suites parse with te test list; te test run on a deployed service model passed 4 of 4 and failed the deliberate suite with exit 1 (runs not in verified_by, need a deployed model)
2026-11-23 plugins/semantic-models/wiki/daxlib-formatstring-udfs.md five DaxLib.FormatString functions and four measures pass te validate; a misspelled call and an extra argument each report DAX0002
2026-11-23 plugins/tabular-editor/wiki/tmdl-model-ci-workflow.md workflow passes actionlint and zizmor; its validate, bpa run and test list commands run on the Bikes example; deploy and test run steps not run
2026-11-23 plugins/reports/wiki/report-eval-gate-and-rubric.md case loads in claude plugin eval without grader warnings; check-gate.py accepts the reference solution with the released pbir; one real run scored 0 (no pbir and read-only workspace in the eval sandbox), rubric graders unscored
2026-11-23 plugins/custom-visuals/wiki/svg-measure-gotchas.md string ceiling re-read against Learn data types (about 32,000 characters for text, not stated for measure results); undocumented sort key claim removed
2026-11-23 plugins/custom-visuals/wiki/svg-measure-wiring-by-visual.md new card image and callout image areas re-read on the Learn card page; unsupported classic card claim removed
2026-11-23 plugins/dashboards/wiki/dashboard-dax-query-patterns.md four example queries parse with te util format-dax; selection-filter.dax parses once its placeholders are literals
2026-11-23 plugins/dashboards/wiki/dashboard-crossfilter-parameters.md unsourced Claude Dashboard wiring section removed
2026-11-23 plugins/paginated-reports/wiki/paginated-limits-and-differences.md undocumented document map claim removed; Learn FAQ re-read
2026-11-23 plugins/paginated-reports/wiki/rdl-structure-and-order.md unordered choice in the 2016/01 XSD of microsoft/RdlMigration re-read; untested reorder claim removed
2026-11-23 plugins/paginated-reports/wiki/paginated-publish-and-export.md 20 MB rdl limit confirmed on Learn; Fabric item definition re-read on Learn (rdl part plus optional .platform, create accepts a definition); Git folder layout claim removed
2026-11-23 plugins/paginated-reports/wiki/pbidataset-connection-and-fields.md earlier 10 minute DirectQuery timeout note removed, Learn FAQ 600 second default kept; identity provider GUID marked undocumented
2026-11-23 plugins/pbi-desktop/wiki/desktop-bridge.md bridge methods and theme reload note checked in the pbir 0.9.33 source and pbir desktop --help
2026-11-23 plugins/pbi-desktop/wiki/tom-gotchas.md untested PowerShell loading remark removed
2026-11-23 plugins/pbi-desktop/wiki/parallels-macos.md prlctl exec and Parallels Tools requirement re-read in the Parallels docs; dead source URL replaced; timeout and port file bullets removed
2026-11-23 plugins/pbip/wiki/bim-to-tmdl.md model.bim versus definition folder re-read on the Learn semantic model folder page
2026-11-23 plugins/pbip/wiki/pbip-rename-gaps.md pbir 0.9.33 replace_field and replace_table source searched for the listed locations; DAXQueries location re-read on Learn
2026-11-23 plugins/pbip/wiki/tmdl-hand-editing-gotchas.md expression named like a table still untested in Desktop, kept as a warning
2026-11-23 plugins/reports/wiki/pbir-desktop-bridge.md theme reload note taken from the pbir 0.9.33 source
2026-11-23 plugins/reports/wiki/report-custom-visual-choice.md licensed visual environments re-read on Learn; organizational visuals in Report Server re-read on the Fabric admin page
2026-11-23 plugins/reports/wiki/report-filter-pane.md publish to web and the filter pane re-read on Learn
2026-11-23 plugins/reports/wiki/report-usage-sources.md 200 requests per hour re-read on the REST page; 30 and 60 minute lag re-read on Track user activities
2026-11-23 plugins/semantic-models/wiki/copilot-ai-metadata.md 10,000 character AI instructions limit confirmed; hidden field behaviour re-read on the AI data schema page; undocumented 200 character description limit removed
2026-11-23 plugins/tabular-editor/wiki/bpa-model-annotations.md object level BestPracticeAnalyzer_IgnoreRules annotation run with te bpa run on examples/bpa/object-ignore: only the annotated measure is skipped
