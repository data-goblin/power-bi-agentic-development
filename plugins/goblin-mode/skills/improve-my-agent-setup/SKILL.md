---
name: improve-my-agent-setup
version: 26.28.0
description: Audit and improve an entire agentic-development setup, including skills, context, memory, tools, models, permissions, hooks, workflow habits, and secrets hygiene. Invoke for setup reviews, workflow grading, Goblin Mode, or questions about what to improve. Supports shallow, deep, ultra, and yolo modes. Use domain-specific skills for a single model, report, or tenant.
---

# Improve my agent setup

A setup-wide health check for someone doing agentic development. It measures what can be measured (skills, memory, config, tools, git, transcripts), interviews the user about the parts that can't be measured (ethics, focus, habits), scores each theme, writes a report to `.claude/scratchpads/`, and then offers to fix the weak spots one at a time.

The point is not a vanity score. It is to find the two or three changes that would most improve how this person works with agents, and then actually make them. A setup rots the same way a codebase does: skills pile up unused, memory bloats with things the model already knows, tools go redundant, and nobody prunes. This skill is the prune.

Guiding stance, echoed across this marketplace: every installed tool, skill, and line of memory competes for the agent's attention and context. More is not better. The best setup is the smallest one that does the job, owned and tuned by the person using it.

## How to use this skill

1. Pick the audit mode from `$ARGUMENTS` (or the user's phrasing); it sets depth, interview cadence, and tone
2. Run the scan script at the breadth that mode implies, to gather deterministic facts
3. Read `references/dimensions.md` for the full rubric; it defines each theme, what good looks like, and the signals to read from the scan
4. Interpret the facts theme by theme; do not just echo the JSON
5. Interview the user for what the scan can't see; how often you interview depends on the mode
6. For the context-files theme, apply `references/context-review.md` (the absorbed context audit)
7. Write the report to `.claude/scratchpads/setup-audit-<YYYY-MM-DD>.md` using the template below
8. Walk the top fixes with the user and offer to apply them, and strongly advise a recurring re-audit; see `references/fix-catalog.md`

Do not try to fix things silently while auditing. Audit first, present the picture, then fix with consent.

## Step 1: Pick the mode

The mode comes from `$ARGUMENTS` (`/improve-my-agent-setup deep`) or from how the user phrases the request. It sets four things at once: how wide the scan reaches, how many themes you dig into, how often you interview, and the tone you take. Read `references/modes.md` for the full definitions; the short version:

```yaml
shallow:  quick, light glance; the basics (tools, redundancy, memory length); interview mainly up front;
          friendly. Refuse and escalate if the project turns out big or messy.
deep:     the default. Routine full checkup, user-level + cwd, without pushing the big transformational
          changes; interview at the start and on ambiguity; a doctor at a consultation.
ultra:    machine-wide and much deeper (all projects, settings, package managers, finished-vs-abandoned,
          determinism, value-for-money); interview throughout; a harsh personal trainer. High effort.
yolo:     everything findable, including mining the transcripts for error and tokenmaxxing patterns;
          relentless interview; a drill sergeant. Assumes a demolition-and-rebuild. Warn on cost. Max effort.
```

If no mode is given, default to `deep`. If the user's situation doesn't match the mode they asked for (a shallow run on a clearly wrecked setup), say so and offer the heavier mode rather than under-serving. Match your own reasoning effort to the mode.

Before an `ultra` or `yolo` run, do two things `modes.md` describes in full: check what model and effort are actually running (introspect your context, or glance at the recent transcript or statusline) and caution the user if it's a lighter model or effort below high, since these modes need real introspection; and for `yolo`, set a `/goal` or `/loop` first so the long run survives context limits and doesn't stop half-done.

## Step 2: Run the scan

Map the mode to the scan's `--scope`: shallow and deep use `user`; ultra and yolo use `deep`. For ultra and yolo, also go machine-wide beyond cwd, enumerating the user's project dirs (the transcripts signal lists them) and sampling across them; yolo additionally reads a sample of `~/.claude/projects/*.jsonl` for patterns. Pass a project path to target one repo.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/improve-my-agent-setup/scripts/scan_setup.py" --scope=<user|project|deep> [project-path] \
  > .claude/scratchpads/setup-scan.json
```

Pass a project path to target a specific repo; with no path it uses the current git root. The script is stdlib-only and reads metadata only. It is built so no secret material ever reaches disk: env vars and connection strings come back as keys, and the secrets sweep reports only a file path, a line number, a rule name, and a match length; never the matched value. Keep that contract; when you write the report, describe where a secret is, never what it is. If `${CLAUDE_PLUGIN_ROOT}` is not set, use the script's path under this skill directly.

The JSON has these sections: `skills`, `memory`, `settings`, `tools`, `mcp`, `git`, `transcripts`, `clients`, `secrets`. Notable ones:

- `memory.organization` flags how context is structured: whether a CLAUDE.md is just a thin pointer (for example `@AGENTS.md`), whether AGENTS.md is used, and whether a `rules/` directory organizes memory into modular files. Read it for the memory-and-context theme.
- `clients` detects the other agentic dev environments (Claude Desktop, VS Code, Cursor, Zed): whether each is set up, its MCP servers, and its rule files. Read it to catch config outside Claude Code and the same capability wired up redundantly across clients.
- `guards` reports the permission `default_mode`, whether a supply-chain install guard is present (`release_age_guard`), and whether the secret-read verb is blocked (`secret_read_block`). Read it for the permission-posture and supply-chain themes.
- `environment` reports the isolation rung (`isolation_degree`: container / vm / bare-metal / unknown), the `os_user`, and container/VM indicators. Read it with `guards.default_mode`: a permissive mode is a very different risk on the bare host as your everyday user than in a throwaway box or under a separate user.
- `safety_instructions` counts declared "never X" safety rules in memory (`by_category`, `samples`). These are non-binding suggestions; cross-reference them against `guards` and hooks to judge which are actually enforced (the safety-enforcement theme).
- `network` reports mesh-VPN CLIs and, at `deep` scope only, non-loopback listening ports (`exposed_listeners`, `wildcard_bind_count`); `autonomous_agents` reports detected agent runtimes. Both feed the network-and-autonomous-exposure theme and are meaningful mainly at ultra/yolo, where the enumeration actually runs.
- `input_methods` reports installed speech-to-text (`has_stt`, `stt_apps`, `stt_clis`) for the input-ergonomics theme; whether they actually use it is an interview point.
- `alternatives` reports local / OSS harnesses and model runners found (`explores_local_or_oss`, `local_harness_clis`, `local_model_apps`) for the model-independence theme.
- `secrets` lists candidate secret and PII hits (`secret_hits`) and any `.env` files with their git exposure. These are candidates, not confirmed leaks; triage them (see the secrets theme).

Two things the scan cannot see on its own, so check them yourself:

- **MCP servers from plugins.** The scan reads config files only; servers a plugin ships (for example `microsoft-learn`, `figma`, `claude-in-chrome`) will not appear there. Cross-check the MCP tools actually available in your session before concluding someone has "no MCP".
- **Live model and effort.** Read the model powering the current session and any effort setting from your own context, not just the `model` field in settings.

## Step 3: Interpret, theme by theme

`references/dimensions.md` is the rubric. Work each theme, read the relevant scan signal, and form a judgment with a short reason. The themes:

```yaml
skills-and-ownership:   count, overlap, redundancy, tuned-vs-as-is, vendor vs owned, shared/symlinked
memory-and-context:     token budget, redundancy across scopes, obvious-facts, organization, quality
tools-and-redundancy:   right tools present, and the WRONG kind of overlap (cli + connect-pbid both)
input-ergonomics:       speech-to-text (Wispr Flow, /voice) for longer, richer prompts
model-independence:     exploring local / OSS models + harnesses as a cost and access hedge
cross-client:           Claude Desktop / VS Code / Cursor / Zed setup and MCP redundancy across them
harness-config:         statusline content, hooks as guardrails, permission allowlist, output style
version-control:        git present, github/ado remote, commit cadence, are they logging their work
permission-posture:     default mode (auto expected); bypass only when sandboxed
execution-environment:  isolation ladder (box>vm>container>user>none) + trust-domain separation
network-and-autonomous-exposure:  private mesh vs exposed ports; uncontainerized autonomous agents (deep-level)
safety-enforcement:     declared "never X" rules vs what actually enforces them
supply-chain-defense:   blocking installs of packages published in the last ~48h
secrets-hygiene:        secrets / PII / passwords in plaintext, .env exposure in git
delegation-and-ethics:  what they delegate to agents, and whether any of it is unethical to delegate
determinism:            nondeterministic where a script would be right, and vice versa
focus-and-shipping:     many half-built projects vs sustained focus that ships
model-and-effort:       expensive model / max effort on trivial work, or the reverse
usage-review:           do they ever look at their own transcripts, cost, or usage
automation:             /loop, /schedule, goals, multiplexers, cloud agents for async delegation
knowledge-system:       is there any way memory and context compound over time, tailored to them
```

Judgment beats measurement. A person with 40 skills that all earn their place is fine; a person with 8 that all overlap is not. Read the reason, not the count. When the scan and your read disagree, trust your read and say why.

## Step 4: Interview for what the scan can't see

Some themes have no reliable file signal. Ask, don't guess. Use `AskUserQuestion`, batch related questions, and let the mode set the cadence: shallow asks mainly up front; deep asks at the start and on ambiguity; ultra and yolo interview throughout, following each answer with the next probe like a doctor working a differential. Good starting questions:

- Delegation: "What do you hand to agents unsupervised?" then probe for the anti-patterns in `references/dimensions.md` (docs they never read, posts in their name, review-rubber-stamping)
- Shipping: "Of the projects you started this quarter, how many shipped or reached someone else?" The transcript scan shows how many project dirs exist; contrast that with what actually shipped
- Usage review: "When did you last read one of your own transcripts or check your spend?"
- Automation: "Do you use /loop, /schedule, goals, a multiplexer, or cloud agents, and for what?"

Ask only what you cannot infer. If the scan already answers it, skip the question and say what you found.

## Step 5: Write the report

Write to `.claude/scratchpads/setup-audit-<date>.md`. Use ASCII tables for the numbers (CLI-dashboard style, not markdown tables). Keep it skimmable; the fixes matter more than the prose. Let the mode set the tone: deep is a calm consultation, ultra is a blunt trainer, yolo is a drill sergeant. Harshness in the higher modes is a tool for someone who asked to be pushed; stay accurate and actionable even when harsh, never contemptuous.

Every theme you report gets the same four-part treatment, because a bare verdict helps nobody decide. For each point, say: what the reading is, why it's good or bad, the nuance (when this reading would actually be fine, or when it's worse than it looks), and the possible actions to improve it. The nuance line is not optional; almost nothing here is universally good or bad, and skipping it turns the audit into dogma. Where an action is one you can perform, mark it so the user knows it's on the table for Step 6.

```
# Goblin Mode setup audit — <date>   (scope: <user|project|deep>)

## Snapshot
<ASCII table: theme | reading | verdict (strong / ok / weak)>

## Findings
<one block per theme that isn't clean, ordered by impact. Each block:>

### <theme>  — <strong|ok|weak>
- Reading:  <what the scan and interview showed, concretely, with the numbers>
- Why:      <why this is good or bad for how they work>
- Nuance:   <when this reading is actually fine, or when it's worse than it looks>
- Actions:  <the possible moves to improve it; mark the ones you can apply now>

## What's working
<the 2-4 things genuinely done well; name them, so it's not all criticism>

## Interview notes
<what the user told you for the un-scannable themes>

## Fixes to apply now
<the short ranked list you'll walk through in Step 6, each a one-liner>
```

Do not pad the report to look thorough. Three real problems, each with its nuance and actions, beats twelve nitpicks. If a theme is genuinely fine, give it one line in the snapshot and don't write a findings block for it.

## Step 6: Offer to fix

This is where the value lands. For each item on the suggested-fixes list, offer the concrete change and apply it on confirmation. `references/fix-catalog.md` has the common ones with the exact commands and the reasoning. Examples of fixes worth offering:

- Set up a statusline that shows repo, branch, staged/incoming changes, PR status, model, effort, and cost, if they have none or a thin one
- Trim memory that restates what the model already knows (directory trees, generic advice) or duplicates across scopes
- Swap a redundant path for the better tool (drive PBIR edits through `pbir` instead of hand-editing JSON; use `fab` instead of an overlapping MCP where the CLI is better)
- Remove or disable skills that overlap or have gone stale, and update ones pinned to an old version
- Install `skill-creator` so they can write and tune their own skills instead of running vendor skills as-is
- Put `~/.claude/skills` under version control and symlink it, so skills are shared across machines and agents
- Add a hook where they are relying on themselves to remember a rule that a hook could enforce
- Point them at `/loop` and `/schedule` for the recurring work they described doing by hand
- Move a plaintext secret into a secret manager and rotate it; gitignore (and untrack) a committed `.env`
- Reorganize sprawling memory into a `rules/` directory, or point a CLAUDE.md at a shared AGENTS.md
- Set the default permission mode to auto; move any bypass-permissions work into a container or VM
- Separate trust domains (work / personal / client) onto different OS users or credential scopes
- Back a high-stakes "never X" memory rule with a hook, or change the setup so the outcome is impossible
- Add a supply-chain guard hook that blocks installing packages published in the last ~48h
- Adopt speech-to-text (Wispr Flow, /voice) for the long framing prompts where context depth pays off
- Spend a little time with a local runner (ollama, LM Studio) and an open harness (opencode, pi) as a hedge

Confirm each fix before making it, and never route around a hook or a blocked action to force one through. Some fixes are installs; ask before installing anything, per the usual rule. The goal is that the user finishes this audit with a setup that is measurably leaner and more theirs than when they started, not just a document telling them so.

## Step 7: Strongly advise a recurring re-audit

A setup rots continuously, so a one-off audit decays. Before you finish, strongly recommend putting this audit on a schedule, and offer to set it up with `/schedule`. A good default is weekly; daily for someone actively overhauling their setup, every two weeks for a stable one. Frame it plainly: the value is in catching drift early (a new pile of skills, memory creeping past budget, a `.env` that slipped into git) while it's cheap to fix. Offer the three cadences and wire the chosen one:

```yaml
daily:      for someone mid-overhaul or with a fast-changing setup
weekly:     the sensible default for most people
biweekly:   for a stable, well-tended setup that just needs a periodic check
```

Match the recurring run's mode to the need: usually a `shallow` or `deep` scheduled run to catch drift, reserving `ultra`/`yolo` for occasional deliberate deep cleans. Set it up only with the user's yes, and confirm the cadence.

## What not to do

- Do not fabricate findings to fill the report; an empty theme is a valid result
- Do not present community or vendor defaults as universal truth; recommendations are contextual, and the user decides
- Do not modify anything during the audit pass; fixes come after, with consent
- Do not treat the score as the deliverable; the applied fixes are
- Never reproduce a secret's value; not in the report, not on screen, not in a scratchpad. Report where it is and what kind, then help rotate it. A secrets finding is a candidate until you have reason to believe it is real, so triage before you alarm
