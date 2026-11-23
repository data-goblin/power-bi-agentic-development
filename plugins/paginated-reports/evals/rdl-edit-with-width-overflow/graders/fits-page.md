---
type: regex
pattern: '</Body>\s*<Width>(10|9(\.\d+)?|[1-8](\.\d+)?)in</Width>'
target: { source: file, path: report.rdl }
---
