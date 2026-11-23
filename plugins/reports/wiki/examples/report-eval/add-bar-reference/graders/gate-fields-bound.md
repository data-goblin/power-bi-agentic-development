---
type: regex
target:
  source: file
  path: Bikes.Report/definition/pages/Overview/visuals/sales_returns/visual.json
pattern: '^(?=[\s\S]*"Property":\s*"Category")(?=[\s\S]*"Property":\s*"Total Sales")(?=[\s\S]*"Property":\s*"Returned Sales")'
---
