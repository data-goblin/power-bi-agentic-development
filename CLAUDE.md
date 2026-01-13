# power-bi-agentic-development Plugin

## Overview

Claude Code plugin for agentic Power BI development. Primary skill: BPA (Best Practice Analyzer) rules for Tabular Editor.

## Skills

### bpa-rules

Skill for suggesting, improving, and understanding BPA rules for Power BI semantic models.

**Capabilities:**
- Suggest new BPA rules based on model analysis
- Improve existing rule expressions and fix expressions
- Parse BPA annotations from TMDL files
- Validate rule syntax and scope

## Development

### Versioning

Format: `<major>.<minor>.<patch>`

| Increment | When |
|-----------|------|
| major | Breaking changes or explicit approval |
| minor | New files or components |
| patch | Updates to existing files |

### Testing

Test skills by:
1. Installing plugin locally in Claude Code
2. Invoking skill with test prompts
3. Verifying outputs against expected behavior

## References

- [Tabular Editor BPA Docs](https://docs.tabulareditor.com/common/using-bpa.html)
- [BPA Rules Repository](https://github.com/TabularEditor/BestPracticeRules)
