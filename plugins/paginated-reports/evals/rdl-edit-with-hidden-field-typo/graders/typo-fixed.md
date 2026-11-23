---
type: regex
pattern: 'Fields!Revenu\.'
match: not_contains
target: { source: file, path: report.rdl }
---
