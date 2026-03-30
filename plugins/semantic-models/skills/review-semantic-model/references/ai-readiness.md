# AI and Copilot Readiness

Guidance for preparing a semantic model for conversational BI experiences (Copilot, data agents) and evaluating whether a model is ready for AI consumption.

## Before Investing in AI Readiness

AI readiness preparation can easily double the development time for a semantic model. Before investing that effort, confirm with the user:

1. **Will users actually use conversational BI?** If users will only consume reports, AI readiness work is low priority. Good naming and descriptions are always beneficial, but the AI-specific work (instructions, verified answers, AI schema) is only valuable if someone will use Copilot or a data agent.
2. **Is the model stable enough?** AI readiness is iterative and requires testing. If the model is still undergoing significant structural changes, defer AI prep until it stabilizes.
3. **Is Copilot/Data Agent enabled in the tenant?** Check tenant settings before investing effort.

## The Decision: Reports, Conversational BI, or Both?

Reports and conversational BI address different problems and suit different scenarios. The model design choices change depending on the consumption method:

| Consumption | Model Impact |
|---|---|
| Reports only | Standard design: star schema, good measures, appropriate grain |
| Conversational BI | All of the above PLUS: AI instructions, AI schema, verified answers, linguistic schema, synonyms, English naming, descriptions optimized for AI |
| Both | Full investment in both report design and AI readiness |

Ask the user which consumption methods are planned before scoping the AI readiness review.

## AI Readiness Checklist

### 1. Model Architecture (Foundation)

These are prerequisites: without them, Copilot and data agents will produce poor results regardless of other configuration.

- [ ] Star schema with clear fact and dimension tables (no flat, denormalized, or pivoted structures)
- [ ] Correct data types on all columns
- [ ] Unnecessary columns and tables removed
- [ ] Explicit DAX measures for all key metrics (implicit measures are not accessible to data agents)
- [ ] Report-scoped extension measures moved to the model (extension measures are invisible to data agents)
- [ ] Duplicate or overlapping measures consolidated or clearly differentiated

### 2. Naming and Metadata

Business-friendly naming is one of the highest-impact changes for AI readiness. AI interprets field names literally.

- [ ] Human-readable names on all visible objects (no CamelCase, snake_case, UPPER_CASE, or technical abbreviations like TR_AMT, CustName)
- [ ] Synonyms configured for alternative terminology users employ (e.g. "Revenue" and "Sales" and "Turnover" for the same measure)
- [ ] Row labels set on dimension tables (helps AI identify the "name" column)
- [ ] Default summarization set correctly on numeric columns (prevents accidentally summing IDs)

### 3. Descriptions

Descriptions are critical for AI -- they provide context that field names alone cannot convey. However, good descriptions for AI are *different* from good descriptions for human users.

**For AI/agents:** Descriptions should disambiguate and direct. Example:
> "When a user asks for Margin, they are referring to Standard Margin (this measure). Use this field, not Gross Margin or Contribution Margin."

**For human users:** Descriptions should explain calculation and source. Example:
> "Standard margin = revenue minus standard cost of goods sold, using the valuated production cost from the manufacturing plant"

**Guidance:**
- [ ] Descriptions present on all visible tables, columns, and measures
- [ ] Descriptions make implicit or hidden information explicit (not restating the field name)
- [ ] Descriptions for AI focus on disambiguation, preferred usage, and relationships between fields
- [ ] Descriptions for humans focus on calculation logic, data sources, and business context
- [ ] If both audiences need descriptions, consider using AI instructions for the AI-specific guidance and descriptions for the human-readable content

**Do not rely solely on AI to generate descriptions.** AI-generated descriptions without additional business context tend to be verbose and unhelpful -- they restate what the AI can already infer from the model structure. If using AI to draft descriptions, always review and enhance with business-specific knowledge. Ask the user or domain experts for implicit knowledge that is not obvious from the model alone.

### 4. AI Instructions

AI instructions are freeform text that Copilot and data agents read automatically. They are one of the most impactful controls for conversational BI quality.

**What to include:**
- Business terminology definitions with examples ("TMS is total media spend, calculated using the measure total_media_spend")
- Time period definitions (fiscal year start, peak season, reporting cadence)
- Metric preferences for common questions ("when users ask about margin, use Standard Margin")
- Disambiguation of date fields ("Order Date is the primary date field; Ship Date is only for logistics analysis")
- Default groupings and analysis preferences
- Example DAX queries for complex scenarios to guide AI patterns
- Instructions for Calculation Groups, DAX UDFs, or Field Parameters if present
- Visualization preferences for Copilot (which chart types to prefer/avoid)
- Output style guidance (conciseness, question-asking behavior, possibly specific tools or scenarios to avoid if copilot)

**Where AI instructions live:**
- Eventually: saved as a `.md` file in the `/Copilot` folder of a PBIP project (might not be live yet but was on the docs...?)
- Editable in Power BI Desktop ("Prep your data for AI"), VS Code, or Tabular Editor (via C# macro)
- AI instructions are NOT automatically read by coding agents (Claude Code, Codex, GitHub Copilot) -- they must be explicitly referenced in agent context

**Important:** AI instructions are a *writing skill*, not an engineering task. Inform instructions from observing users interact with Copilot, not from guessing. Iterate incrementally based on testing and user feedback.

- [ ] AI instructions present and non-empty
- [ ] Business terminology documented
- [ ] Common question patterns addressed
- [ ] Instructions refer to fields by their proper names
- [ ] Instructions tested with Copilot or data agent
- [ ] Instructions kept concise; non-contradictory (also not contradictory with i.e. descriptions)

### 5. AI Data Schema

The AI data schema controls which tables, columns, and measures are visible to Copilot and data agents. Scoping this correctly prevents confusion and improves response quality.

- [ ] Only relevant tables, columns, and measures selected (not the entire model)
- [ ] All dependent objects for selected measures are included (use `get_measure_dependencies()` from semantic-link-labs for complex models)
- [ ] Helper measures and intermediate calculation objects excluded
- [ ] Duplicate or overlapping measures excluded from schema
- [ ] All fields required for verified answers are visible (not hidden)
- [ ] Schema selection matches between "Prep for AI" and data agent configuration

### 6. Verified Answers

Verified answers are pre-built report visuals that Copilot returns for specific questions, ensuring accuracy for the most common and important queries.

**Note:** It's probably not worth investing in Verified Answers. Power Bi visuals are just too poor for this.

- [ ] Most common user questions identified (ask the user or their team)
- [ ] Verified answers created with appropriate visuals
- [ ] Complete, robust trigger questions per verified answer (not partial phrases)
- [ ] Both formal and conversational phrasings included
- [ ] Relevant filters configured per verified answer for flexible slicing
- [ ] All fields used in verified answers are visible in the model
- [ ] Trigger questions tested for exact and semantic matching

### 7. Data Agent Configuration (if applicable)

- [ ] Same tables selected in data agent as in Prep for AI > AI Data Schema
- [ ] Model-specific instructions in AI instructions, NOT at data agent level
- [ ] Data agent instructions limited to: response formatting, cross-source routing, common abbreviations, tone
- [ ] Routing instructions added if multiple data sources ("For revenue questions use the semantic model; for real-time delivery use the KQL database")

## Performance Analysis for AI

AI-generated DAX queries can be unpredictable in their patterns. Measure performance with:
- **Tabular Editor 3:** VertiPaq Analyzer for memory footprint, Best Practice Analyzer for structural issues
- **DAX Studio:** Server timings for query performance, VertiPaq Analyzer (alternative to Tabular Editor)

Test AI-generated queries specifically -- the DAX patterns Copilot produces may differ from hand-written measures and may expose performance issues that don't surface in reports.

## Gathering Context for Descriptions and Instructions

When the user asks to improve AI readiness, gather business context before writing descriptions or instructions:

1. **Ask the user** about the business process, key metrics, common questions, and areas of ambiguity
2. **Review existing reports** connected to the model -- what questions do they answer? What fields do they use?
3. **Check the model's measures** -- are there naming patterns that suggest business logic (YTD, MTD, vs. Plan, vs. LY)?
4. **Look for contentious metrics** -- margins, budgets, forecasts often have multiple definitions across teams
5. **Understand the organizational vocabulary** -- different departments may use different terms for the same concept

Do not assume you know what good descriptions or instructions look like for a specific business context. Always validate with the user before applying changes.
