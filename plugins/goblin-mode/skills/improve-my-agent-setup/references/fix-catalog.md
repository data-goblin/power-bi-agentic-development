# Fix catalog

The concrete fixes to offer in Step 4, with the commands and the reasoning. Offer them one at a time, apply on confirmation, and never force a fix through a hook or a blocked action. Anything that installs software needs an explicit yes first. Pick fixes by leverage, not by how many you can list.

## Statusline: make git and cost state visible

For someone with no statusline or a bare cwd one. A statusline is a constant readout of the state you otherwise have to stop and check: which repo and branch, what's staged, what's incoming from the remote, the current PR and its status, the model and effort you're paying for, and the running cost. Making that visible changes behavior; invisible state gets ignored.

Route through the `statusline-setup` agent, or the `/statusline` flow, to write a `statusLine` command into settings.json. Aim for a line that shows, in some order that fits the width:

```
repo / branch  •  ±staged  ↓incoming  •  PR #123 (open|approved|checks)  •  model · effort  •  $cost
```

Explain the tradeoff: a command statusline runs every render, so keep it fast (cache git calls, avoid slow network calls on the hot path). If they already have a thin statusline, enrich it rather than replace it.

## Trim memory to the ceiling

When total always-on memory is past ~10-15k tokens, or restates what the model already knows.

- Cut anything the model was trained on: framework facts, language docs, generic best practice
- Cut anything the agent can see for itself: directory trees, file inventories, what a standard file does
- De-duplicate across scopes: a rule in global memory does not also belong in project memory
- Rewrite MUST/NEVER command-lists as short rules with the reason; the model follows an explained why better than a bare order, and reasons age better than commands

Show the before/after token count from the scan so the saving is concrete. This is an edit to their memory files, so confirm each cut.

## Route edits through the top of the cascade

When a redundant lower-cascade path is a habit while a better tool is installed. The marketplace cascade for model edits:

```
te CLI  >  model MCP  >  connect-pbid (live TOM/ADOMD)  >  hand-authored TMDL
```

Stop at the first available. If `te` is on PATH, drive edits through it and stop hand-editing TMDL or reaching for live TOM by reflex; the validated API keeps the model consistent where manual paths quietly corrupt it. Same logic for reports: route PBIR changes through `pbir` rather than editing visual.json by hand. The fix is a habit change plus, sometimes, retiring the now-redundant tool or MCP.

## Retire overlapping or stale skills

When two skills trigger on the same intent, or a skill has gone stale or pins an old version.

- Confirm the overlap by reading both descriptions, not just the name collision from the scan
- Disable or remove the loser, or give them a clear division of labor in their descriptions
- Update skills pinned to an old marketplace version
- For vendor skills run untouched that don't fit the person's workflow, tune them (which means owning a copy) rather than living with the misfit

## Install skill-creator so they own their skills

When the setup is mostly untouched vendor and community skills. `skill-creator` lets the person write, tune, and eval their own skills instead of renting someone else's defaults. Owning skills is how a setup stops being generic. It is already available in this environment in many cases; if not, point them at installing it. Pair this with the knowledge-system fixes; a person who authors their own skills is building a compounding asset.

## Version and share the skills dir

When `skills.shared_dir` shows the personal skills dir is neither a git repo nor a symlink. Skills trapped on one machine don't compound and don't follow the person to other agents.

- Move `~/.claude/skills` into a git repo (a personal `agents` or `dotfiles` repo)
- Symlink it back so Claude Code still finds it
- Now the same skills, tuned once, work across machines and across every agent that reads that dir; if they run several agents, a shared skills repo or a meta-harness is what keeps them in sync

Confirm before moving directories; back up first.

## Convert a load-bearing memory rule into a hook

When the person relies on remembering a rule that a hook could enforce. A rule in memory is a suggestion the model may miss; a hook is deterministic. Good candidates: blocking a dangerous command, validating output shape, refreshing metadata after a change, enforcing a naming or path convention. Use the `hook-development` skill to write it. The win is that the guardrail no longer depends on the model paying attention.

## Reduce permission prompts

When the person clicks approve on the same read-only calls all day and has no allowlist. Run `/fewer-permission-prompts`; it reads recent transcripts and writes a prioritized allowlist into project settings, so the common safe calls stop prompting. Keep deny rules for the genuinely dangerous ones.

## Right-size model and effort

When an expensive model or max effort is running trivial, high-volume, mechanical work (or the reverse). Suggest a lighter default with an easy escalate for the hard tasks, and point out that both model and effort switch per task. If a statusline is being set up, put model and effort on it so the choice stays in view and the person notices when it's wrong.

## Turn manual recurring work into a routine

When the person described doing something on a clean interval by hand. `/loop` runs a prompt or slash command on an interval; `/schedule` sets up a cloud routine on a cron. Convert the described task into one of these. For long or async work, point at cloud agents so they aren't babysitting a terminal; for work that fans out, a multiplexer or multi-agent harness runs several at once.

## Harden the runtime: permission mode, isolation, supply-chain

Three linked fixes that decide the blast radius when something goes wrong. Offer them together, because they only make sense as a set.

- Permission mode: set `permissions.defaultMode` to `auto` so edits flow but dangerous and outward-facing actions still gate. If they run the plain prompt-on-everything default, this is the single easiest quality-of-life and safety win. If they want `bypassPermissions`, do not just flip it on; make it conditional on isolation first
- Isolation: for bypass or heavy unattended autonomy, move the work into a container or a disposable VM. The point is that a prompt-injection, a poisoned dependency, or a bad generated command hits a sandbox instead of the host with the real SSH keys, cloud tokens, and files. On the bare host, keep a gating mode. Detection of the current environment is best-effort, so confirm with the person rather than asserting it
- Supply-chain guard: add a hook that blocks installing a package version published in roughly the last 48 hours. The dangerous window is right after a malicious publish and before the ecosystem notices; waiting it out dodges most recent npm and PyPI incidents. This marketplace ships a bun release-age guard as the template; use the `hook-development` skill to generalize it to npm, uv, cargo, or whichever managers the agent actually uses, and consolidate onto one manager per ecosystem so the guard has a single choke point

The reasoning to convey: autonomy and safety are a dial, not a switch. More autonomy is fine, but it has to be bought with more isolation and more guardrails, so that the worst a bad step can do stays bounded.

## Climb the isolation ladder to match the risk

When autonomy or untrusted input is high but the session runs on the bare host as the everyday user. Pick the lightest rung that contains the risk; you rarely need the heaviest.

- Separate OS user per trust domain is the cheapest strong move: a `work` user, a `personal` user, a per-client user, each with its own keys, checkouts, and permissions. An agent running as one literally cannot read another's files or credentials. No VM overhead, real containment, and it maps cleanly to how people already think about work vs personal vs client
- Container for autonomous or untrusted-input work: a real boundary around filesystem and process space, quick to spin up and throw away
- VM or separate box when the work is genuinely hostile (analyzing untrusted code, running unknown MCP servers) or when a full guest OS boundary is warranted
- Keep bare-host, same-user sessions for interactive, trusted, human-in-the-loop work on a gating mode

The move to recommend most often is the separate-user one, because it's low-friction and closes the cross-contamination hole that one-user-does-everything leaves open.

## Back a naked safety rule with real enforcement

When memory carries high-stakes "never X" rules that nothing actually enforces, especially in auto or bypass mode. Walk the specific rules the scan surfaced and, for each, decide what should back it.

- If the outcome is catastrophic and irreversible (exfiltration, destructive commands, pushing to production), a written rule is not enough. Add a hook that blocks the action deterministically (`hook-development`), or better, remove the possibility: take away the access, block the network path, inject secrets inline so there is nothing on disk to leak
- The enforcement ladder, weakest to strongest: written instruction → LLM-as-judge → gating-mode pause → deterministic hook → impossible by construction. Move each high-stakes rule as far right as is practical
- Leave written rules in place for what they're good at: judgment calls, tone, when-to-ask, style. Those can't be hooks and aren't catastrophic if occasionally missed
- Do not add blocks for everything; that just makes ordinary work painful. Target the rules whose violation you actually can't afford

The point to leave the person with: a rule you can't afford to have broken should not live only in a sentence the model may or may not follow. Either enforce it or make it impossible; otherwise it's comfort, not safety.

## Close network exposure and cage autonomous agents

Deep-level, high-severity when it applies. Offer when the scan shows exposed ports or an uncontainerized autonomous agent.

- Exposed ports: a service bound to `0.0.0.0`/`*` on a reachable machine is an open door. Rebind it to loopback (`127.0.0.1`) or to the mesh interface so only trusted devices reach it. Stop forwarding ports on the router for ad-hoc remote access
- Private network: put remote access on a mesh VPN instead of holes in the firewall. Tailscale is the easy default: devices join an encrypted overlay and reach each other privately, with nothing published to the public internet. WireGuard, ZeroTier, Nebula, and netbird do the same job. Confirm the finding in context first; a wildcard bind behind NAT with no forwarding is far less urgent than one on a public host
- Autonomous agents: an agent that acts on its own, running loose on the daily-driver machine, has the machine's full reach; a prompt-injection or a bad decision executes against real credentials and files. Move it into a container or a disposable VM, or shut it off on the primary machine. Verify what a flagged process actually is before acting; the marker list is heuristic

The principle mirrors the isolation ladder: anything that either listens to the outside world or acts autonomously belongs behind a private network and inside a sandbox, not exposed on the host you live on.

## Remediate an exposed secret

When a hit is confirmed real (not a doc example or placeholder). Order matters, and never print the value while doing this.

- Move it into a secret manager and reference it inline at use: `$(op read ...)`, a keychain lookup, or an env var loaded in memory. The value should never sit in a file again
- Rotate it. If it was committed or shared, removal is not enough; the old value is in git history and any clone, so it must be invalidated at the source
- For a tracked `.env`: add it to `.gitignore`, then `git rm --cached <path>` so git stops tracking it while the local file stays. Leave a `.env.example` with blank keys so the shape is documented
- For a secret in memory, settings, or a scratchpad: strip it, replace with the manager reference, and rotate

If the exposure is live and reachable, this jumps the queue ahead of every other fix in the audit.

## Set up read-proof secret retrieval

The durable fix behind the one above: make it so the agent can use secrets without ever being able to read them. Recommend this when secrets are being pasted into env vars, files, or commands the agent could dump.

- Use a 1Password service account (a scoped, non-interactive token) so retrieval needs no desktop unlock and works in headless and cron runs. Keep the service-account token itself in the OS keychain, loaded into an env var in memory, never on disk
- Resolve secrets inline with `op run` / `op inject`, referencing them as `op://vault/item/field`. The value materializes only inside that one subprocess: `op run -- some-command --token op://...`. The agent composes the command; the plaintext never lands in its context or on disk
- Block the read verb with a hook. A PreToolUse hook that denies `op read` (and any bare `echo $SECRET`-style dump) means the retrieval path can inject but not reveal. Use the `hook-development` skill to write it. Now the guarantee is structural, not a matter of the agent behaving
- The same shape works for cloud tokens: `az account get-access-token ... --query accessToken -o tsv` piped straight into the consuming command, never captured to a variable the agent prints

The principle: the agent should orchestrate secrets, not hold them. Retrieval inline, reading blocked. This is the setup that lets someone hand real credentials to an agentic workflow without handing it the ability to leak them.

## Reorganize memory: rules/ or a shared AGENTS.md

When memory is one sprawling file, or scattered inconsistently across clients.

- Split a large CLAUDE.md into a `rules/` directory of small topical files (`git.md`, `code.md`, `communication.md`, `tools.md`), imported from the top-level memory. Smaller files are easier to diff, prune, and reason about, and you can drop one topic without touching the rest
- If the person uses more than one agentic client, move the real content into an `AGENTS.md` and make each client's memory file a thin pointer to it (`@AGENTS.md`). One source of truth, maintained once, read by Cursor, Copilot, Codex, and Claude alike
- Only do this when size or churn warrants it. A lean, sharp single file needs no reorganization, and splitting it for its own sake just adds indirection. Recommend the structure to fit the problem, not as a default

## Schedule a recurring re-audit

The most important follow-through, and worth pushing hard. A setup rots continuously; a one-off audit is stale within weeks. Use `/schedule` to run this audit on a cadence so drift gets caught while it's cheap: a new pile of untouched skills, memory creeping past budget, a `.env` that slipped into git, a redundant MCP left behind.

- Weekly is the sensible default. Daily for someone actively overhauling their setup; every two weeks for a stable, well-tended one
- Match the scheduled run's mode to the need: a `shallow` or `deep` run catches drift cheaply; reserve `ultra`/`yolo` for occasional deliberate deep cleans, not the routine
- Set it up only on the user's yes, and confirm the cadence and mode

The framing to leave them with: the audit isn't a one-time cleanup, it's a periodic checkup. Catching a small problem weekly is far cheaper than a full excavation twice a year.

## Adopt speech-to-text for richer prompts

When prompts are consistently terse on complex tasks and no STT is in play. Typing is the bottleneck that keeps people rationing context; dictation removes it, and richer prompts get materially better output. Suggest trying Wispr Flow, superwhisper, macOS dictation, or a `/voice`-style flow, specifically on the long framing prompts where saying three paragraphs of context beats typing one line. If STT is already installed but unused, the fix is just the nudge to actually reach for it. Keep it a recommendation, not a mandate; some people genuinely think better in writing or work where dictation isn't practical.

## Build a model-independence hedge

When the whole workflow depends on one hosted provider and one harness. Two pressures make that fragile: token prices trend up as usage deepens, and access to specific models or providers can be curtailed by geopolitical events, sanctions, regional restrictions, or provider instability. The fix is optionality, not migration.

- Spend a little time with a local runner (ollama, LM Studio) and an open harness (opencode, pi) so the fallback is known-working rather than theoretical
- Identify the subset of the person's work that runs fine on a local or open model, so a price or access shock is an inconvenience they can route around, not a full stoppage
- Keep the frontier hosted model for the hard reasoning where it genuinely wins; this is about having a floor, not going all-local

Weight the push by how central agent work is to their livelihood. The more they depend on it, the more a working hedge is worth building now rather than under duress later.

## Stand up a knowledge system

When nothing lets context compound across projects. The smallest useful version: a durable notes store (a vault or a memory repo), a scratchpad convention that gets read before new work, and a habit of writing learnings back at the end of a task. Combined with a versioned, shared skills dir, this is what makes every other fix compound instead of decay. Weight this one; it's the multiplier.
