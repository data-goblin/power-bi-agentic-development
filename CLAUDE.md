# power-bi-agentic-development Plugin

## Overview

Claude Code plugin for agentic Power BI development including skills, subagents, commands, and other primitives for Claude Code and Cowork to work better with Power BI and Fabric.

## Skills

### bpa-rules

Skill for suggesting, improving, and understanding BPA rules for Power BI semantic models.

**Capabilities:**
- Suggest new BPA rules based on model analysis
- Improve existing rule expressions and fix expressions
- Parse BPA annotations from TMDL files
- Validate rule syntax and scope

### pbip-project-operations

Skill for project-level operations on Power BI Project (PBIP) files.

**Capabilities:**
- PBIP project structure and file type reference
- Cascading table, measure, and column renames across all affected locations
- Project forking workflows (copy, rename folders, update entry points)
- Report visual JSON Entity/Property/queryRef pattern reference
- Post-rename verification with grep strategies

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

- [Tabular Editor BPA Docs](https://docs.tabulareditor.com/getting-started/bpa.html)
- [BPA Rules Repository](https://github.com/TabularEditor/BestPracticeRules)
- Local TE Docs: Clone [TabularEditorDocs](https://github.com/TabularEditor/TabularEditorDocs) locally and use tabular-editor-docs skill for search
