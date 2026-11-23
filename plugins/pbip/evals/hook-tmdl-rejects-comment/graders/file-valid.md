---
type: regex
pattern: "^// owner"
flags: m
match: not_contains
target: { source: file, path: Shop.SemanticModel/definition/model.tmdl }
arm: both
---
