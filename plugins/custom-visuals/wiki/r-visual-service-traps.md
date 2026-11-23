---
title: R visual works in Desktop, blank in the service
summary: The R-only reasons an R visual fails in the service, with the exact flags Learn requires.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/visuals/service-r-visuals
  - url: https://learn.microsoft.com/en-us/power-bi/connect-data/service-r-packages-support
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 60
skills: [custom-visuals/r-visuals]
---

# R visual works in Desktop, blank in the service

The service runs scripts in a sandbox (no network) on R 4.3.3 with the [supported package list](https://learn.microsoft.com/en-us/power-bi/connect-data/service-r-packages-support). R visuals retire in May 2027; fix these only for reports that must keep running until then.

```yaml
text_labels_missing: add powerbi_rEnableShowText = 1 at the beginning of the script (text becomes graphics; Desktop ignores it)
cjk_text_blank: install showtext and add powerbi_rEnableShowTextForCJKLanguages = 1 at the beginning of the script
time_column: the Time data type is unsupported; model the field as Date/Time
package_missing: only CRAN packages on the Learn list load; no private packages, no packages that query the web (RgoogleMaps, mailR)
timeout: 60 seconds
html_xml_packages: run out of memory in the service; Learn says to move them to a custom visual built with pbiviz
directquery_analysis_services: unsupported
printing: R visuals do not print with the report
```

Learn's wording for both text flags is "add the following line at the beginning of the R script"; keep them on the first lines. For CJK, Learn also lists `install.packages("showtext")` as step 1.
