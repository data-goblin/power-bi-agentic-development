# The audit rubric

One section per theme. Each gives what good looks like, the scan signal to read, the anti-patterns to flag, and the fix to reach for. Read the reason behind each, not the number; the same count can be healthy for one person and bloat for another. When you judge a theme, write down the signal you read and the reason for your verdict so the user can argue with it.

The through-line across every theme: attention is the scarce resource. Each skill, tool, MCP server, and line of memory is loaded into a finite context and competes with everything else for the model's focus. So the bar for keeping something is not "is it useful sometimes" but "does it earn its place against everything else in the context". Most setups fail by accretion, never by scarcity.

## skills-and-ownership

Covers: how many skills, overlap and redundancy, whether they're tuned or run as-is, vendor vs owned, and whether skills are shared across machines.

Scan signal: `skills.personal_count`, `skills.plugin_count`, `skills.personal[]` (name, description, lines), `skills.name_overlap`, `skills.shared_dir`.

What good looks like:
- Skills exist because a real, recurring task needed them, not because they were available
- Overlapping skills have a clear division of labor, or one was retired
- The person has modified vendor skills, or written their own, to fit how they actually work; a setup made entirely of untouched community skills is a setup nobody owns
- The personal skills dir is under version control and symlinked, so the same skills follow the person across machines and agents

Anti-patterns to flag:
- Two or more skills that trigger on the same intent with no clear winner (read `name_overlap`, then confirm by reading descriptions; name collisions are a hint, not proof)
- Skills untouched since install when the person clearly works in a specific way the skill ignores
- A large plugin skill count where whole plugins are installed for one skill that's rarely used
- Skills pinned to an old version while the marketplace has moved on

Do not flag high counts by themselves. Forty well-earned skills is a strength. Ask whether each earns its context, not whether there are many.

Fixes: retire or disable overlapping and stale skills; tune the ones that don't fit; install `skill-creator` so they can author and tune their own; put the skills dir in a repo and symlink it (see `fix-catalog.md`).

## memory-and-context

Covers: memory token budget, redundancy across scopes, memory that states the obvious, and the quality of project context files. This theme absorbs the old `/audit-context`; for the project-file portion, apply `references/context-review.md` in full.

Scan signal: `memory.total_tokens`, `memory.files[]` (path, scope, tokens, lines).

What good looks like:
- Total memory is lean. Somewhere under ~10-15k tokens of always-on memory is a reasonable ceiling for most people; past that, every session pays a tax whether or not the memory is relevant to the task
- Memory holds what the model does not already know: personal conventions, hard-won project facts, auth paths, gotchas. It does not restate general best practice the model was trained on
- Global and project memory do not repeat each other
- Project memory earns its place; it does not describe the obvious (a directory tree the agent can see with `ls`, framework facts, what a standard file does)

Anti-patterns to flag:
- Total memory well past the ceiling, especially if much of it is generic advice
- The same rule stated in global and project scope
- Project memory that documents directory structure, restates the language's own docs, or narrates what the code plainly shows
- Memory written as a wall of MUST/NEVER commands rather than reasons; rigid command-lists age badly and the model follows them worse than it follows an explained why
- Memory that looks AI-generated: verbose, hedge-heavy, generic. This is where context rot starts

Organization (read `memory.organization`): how memory is structured matters as much as its size.
- A CLAUDE.md that is essentially just `@AGENTS.md` is often a good sign, not a thin file to flag. It keeps one source of truth in an AGENTS.md that other tools (Cursor, Copilot, Codex) also read, so the person maintains their memory once instead of per client. `organization.global_claude_is_pointer` / `project_claude_is_pointer` mark this; treat a pointer plus a real AGENTS.md as healthy, and only flag it if the AGENTS.md it points to is itself missing or bloated
- A `rules/` directory that splits memory into small topical files (`git.md`, `code.md`, `communication.md`) is easier to manage, diff, and prune than one giant CLAUDE.md; `organization.uses_rules_dir` marks it. Someone with a single sprawling memory file is a candidate to reorganize into `rules/`
- The nuance: organization is a means, not a virtue. A short, sharp, single CLAUDE.md needs no splitting; don't push `rules/` or AGENTS.md on someone whose memory is already lean and clear. Recommend the structure only when the size or churn actually warrants it

Fixes: trim to the ceiling; cut obvious-facts and duplicates; rewrite command-lists as short explained rules; reorganize a sprawling file into `rules/` or a shared AGENTS.md when size warrants; apply `references/context-review.md` (the absorbed context audit) to the project files. Remind the user that context quality is iterative and that AI-written memory has a high chance of being verbose or wrong.

## tools-and-redundancy

Covers: whether the right tools are installed for the work, and the wrong kind of redundancy where two tools do the same job and one should win.

Scan signal: `tools.on_path`, `tools.missing`, `mcp.servers` (plus the live MCP tools in your session, which the scan cannot see).

What good looks like:
- The tools present match the work. For semantic modelling that means a validated path (`te` CLI, or a model MCP) rather than hand-editing. For reports it means `pbir`. For the service it means `fab`
- Overlapping tools are not all in play at once. The marketplace's own stance is a cascade: prefer the validated CLI, then an MCP, then live TOM (`connect-pbid`), then hand-authored TMDL, and stop at the first available. Someone running both `te` and `connect-pbid` and an MCP for the same edits has three ways to leave a model inconsistent
- MCP servers are present where an MCP genuinely beats a CLI, and absent where a CLI is leaner

Anti-patterns to flag:
- A live-TOM or hand-authoring path used as a habit when a validated CLI is installed (`connect-pbid` or raw TMDL editing when `te` is on PATH)
- An MCP server kept around that a CLI already covers more cheaply, or vice versa
- Missing the one tool that would remove a whole class of manual work

Fixes: pick the top of the cascade that's installed and route edits through it; drop the redundant lower-cascade habit; install the missing high-leverage tool (ask first). See `fix-catalog.md`.

## input-ergonomics

Covers: how the person gets prompts into the agent, and whether speech-to-text is unlocking longer, richer prompting.

Scan signal: `input_methods.has_stt`, `input_methods.stt_apps`, `input_methods.stt_clis`. Whether they actually use `/voice` or dictation in practice is an interview point; the scan only sees what's installed.

What good looks like:
- Longer, more context-rich prompts come easily, because typing them all out is the bottleneck that keeps people terse. Speech-to-text (Wispr Flow, superwhisper, macOS dictation, a `/voice` mode) lets someone say three paragraphs of context in the time it takes to type one line, and richer prompts get materially better agent output
- The person reaches for dictation on the big framing prompts, not just the one-liners

Anti-patterns to flag:
- Consistently thin, keyboard-terse prompts on complex tasks, with no STT in the toolkit; the person is rationing context because typing is expensive, and the agent is guessing as a result
- STT installed but unused out of habit

Nuance: this is a strong recommendation, not a universal one. Some people think better in writing, or work in quiet-required or shared spaces where dictation isn't practical, and that's legitimate. Push STT because the leverage is real and underused, but don't treat typing as a failing. The goal is richer prompts; dictation is the usual path there, not the only one.

Fixes: suggest trying Wispr Flow or a `/voice`-style dictation flow for the long framing prompts; if STT is already installed, nudge toward actually using it on the prompts where context depth pays off.

## model-independence

Covers: whether the person is starting to explore local and open-source models and harnesses, as a hedge against cost and access risk.

Scan signal: `alternatives.explores_local_or_oss`, `alternatives.local_harness_clis` (opencode, pi, ollama, aider, goose, and similar), `alternatives.local_model_apps` (LM Studio, Jan, and similar).

What good looks like:
- Some awareness of, and ideally some hands-on time with, alternatives to a single hosted provider: a local model runner (ollama, LM Studio), an open harness (opencode, pi), an OSS-friendly workflow. Not necessarily as the daily driver, but as a known, working fallback
- The person understands which of their work genuinely needs a frontier hosted model and which could run locally or on an open model

Anti-patterns to flag:
- Total dependence on one hosted provider and one harness, with no local or open-source option ever tried. Two pressures make this fragile: token prices trend up as usage deepens, and access to specific models or providers can be curtailed by geopolitical events, sanctions, regional restrictions, or plain provider instability. A person whose entire workflow assumes one API is one policy change or price hike away from disruption
- No sense of what their work would cost or how it would degrade if they had to switch

Nuance: frontier hosted models are genuinely better today, and for the hard reasoning work they're often worth the lock-in; this is not an argument to move everything local now, and local models come with real setup and quality tradeoffs. The point is optionality, not purity. Someone who has tried ollama or opencode and keeps them as a fallback is in a far stronger position than someone who never looked, even if they use a hosted model 95% of the time. Weight this by how central agent work is to the person's livelihood; the more they depend on it, the more a hedge matters.

Fixes: suggest spending a little time with a local runner (ollama, LM Studio) and an open harness (opencode, pi) to know the fallback works and where quality lands; identify the subset of their work that runs fine on a local or open model so a price or access shock is an inconvenience, not a stoppage.

## cross-client

Covers: the other agentic dev environments on the machine (Claude Desktop, VS Code, Cursor, Zed), whether they're set up, and whether capability is wired up redundantly across them.

Scan signal: `clients.<name>` for each of `claude-desktop`, `vscode`, `cursor`, `zed`, giving `installed`, `config_files`, `mcp_servers`, `rule_files`.

What good looks like:
- Each client the person actually uses is set up deliberately: the MCP servers and rules it needs, nothing it doesn't
- The same capability is not duplicated across clients without reason. If a model MCP is in Claude Desktop and the equivalent CLI is in Claude Code, that is two paths to maintain and two things to keep in sync
- Rules and instructions are consistent across clients (a `.cursorrules`, a Copilot instructions file, and Claude memory should not contradict each other)

Anti-patterns to flag:
- The same MCP server configured in several clients when the person works in one of them; dead config that drifts and misleads
- A capability present as both a CLI (in Claude Code) and an MCP (in Desktop or Cursor); pick the surface that fits and drop the other, per the tools cascade
- A client installed and half-configured, with MCP servers or rules nobody uses
- Client rule files that disagree with the person's Claude memory, pulling different agents in different directions

Do not push someone toward using more clients. The goal is that the clients they use are clean and consistent, and the ones they don't are not carrying stale config. If a client is uninstalled or unconfigured, that is usually fine, not a gap.

Fixes: prune MCP servers and rules from clients the person doesn't use; collapse a CLI-plus-MCP duplication down to one surface; reconcile contradicting rule files against the source-of-truth memory.

## harness-config

Covers: settings.json quality; specifically the statusline, hooks as guardrails, the permission allowlist, and output style.

Scan signal: `settings.files[]` (has_statusline, statusline_type, model, hook_events, permission_allow/deny, output_style), `settings.any_statusline`.

What good looks like:
- A statusline that surfaces the things you glance at constantly: repo and branch, staged and incoming changes, PR number and status, model, effort, and running cost or token use. A good statusline turns invisible state into a constant readout and changes behavior
- Hooks enforce the rules the person would otherwise rely on memory for: blocking a dangerous command, validating output, refreshing metadata. A rule enforced by a hook is deterministic; a rule written in memory is a suggestion the model may miss
- A permission allowlist for the common read-only calls, so the person is not clicking approve all day (`/fewer-permission-prompts` builds this from transcripts)

Anti-patterns to flag:
- No statusline, or one that shows only cwd; the git and cost state is invisible
- Relying on memory for a rule that a hook could enforce deterministically
- No permission allowlist despite heavy repeated read-only calls
- Hooks that route around a user policy rather than enforce it

Fixes: set up or enrich the statusline (see `fix-catalog.md` for a git+cost+model line); convert a load-bearing memory rule into a hook; run `/fewer-permission-prompts`.

## version-control

Covers: whether projects are in git, on GitHub or ADO, with a healthy commit cadence; and whether the person is logging their work at all.

Scan signal: `git.is_repo`, `git.remote_host`, `git.branch`, `git.dirty_files`, `git.last_commit_relative`, `git.tag_count`.

What good looks like:
- Work lives in git with a real remote (GitHub or ADO), so it is backed up, reviewable, and logged
- Commits are regular and atomic; the working tree is not a graveyard of uncommitted change
- Releases or tags exist where the project ships something

Anti-patterns to flag:
- Work not in git at all, or in git with no remote (no backup, no log)
- A large uncommitted working tree that has sat for a long time (`dirty_files` high, `last_commit_relative` stale)
- No tags or releases on a project that is supposedly shipping

Why it matters: git is the cheapest logging and safety net there is. Without it there is no record of what the agent changed, no way to revert a bad run, and no shipping signal. This theme also feeds focus-and-shipping.

Fixes: init and add a remote; commit the stranded tree in atomic pieces; adopt a branch-and-PR habit.

## permission-posture

Covers: the default permission mode, and whether a permissive mode is being run somewhere it's safe to.

Scan signal: `guards.default_mode`, read against `environment.isolated`.

What good looks like:
- The default is `auto` (formerly "accept edits" style): the agent moves without a prompt on every edit, but genuinely dangerous or outward-facing actions still gate. This is the mode that keeps momentum without handing over the keys. If someone is running the plain prompt-on-everything default, they are paying an attention tax on every step and will start rubber-stamping prompts, which is worse than auto; nudge them onto auto firmly
- `bypassPermissions` (nothing ever prompts) is legitimate, but only inside a box: a container or a VM where a rogue command or a prompt-injection can't reach the real machine, real credentials, or the network you care about. Bypass on an isolated throwaway is fine and fast; bypass on the bare host you keep your life on is how a single injected instruction exfiltrates or destroys

Anti-patterns to flag:
- Running the plain default mode out of inertia when auto would serve them better; this one deserves a blunt nudge
- `bypassPermissions` as the default on a non-isolated machine (`environment.isolated` false); treat this as high-severity and pair the finding with the execution-environment theme
- A permissive mode plus no supply-chain or secret-read guards; the blast radius of a bad command is then unbounded

Nuance: mode preference is somewhat personal, and auto is a strong default rather than a law. The hard line is only bypass-on-bare-metal; everything else is a nudge, not a slap.

Fixes: set `permissions.defaultMode` to `auto`; if they want bypass, pair it with an isolated environment first (see below).

## execution-environment

Covers: how isolated the session is from what matters, across the full ladder of separation, and the exfiltration and blast-radius risk that follows from that plus the permission mode.

Scan signal: `environment.isolation_degree` (`container` | `vm` | `bare-metal` | `unknown`), `environment.is_container`, `environment.virtualization`, `environment.isolated`, `environment.os_user`, `environment.indicators`.

Think of separation as a ladder, strongest to weakest, and match the rung to the risk:
- Separate physical box: a different machine entirely for the risky work; total blast-radius containment
- Separate VM: a guest OS; a compromise is trapped in the guest, host stays clean
- Separate container: lighter than a VM, still a real boundary around filesystem and process space
- Separate OS user / permissions: same machine, but a distinct user whose files, keys, and permissions the agent's user can't touch
- Nothing: bare host, your own user, full reach to everything you own

A specific and cheap win worth recommending: separate OS users (or at least separate credential sets and checkouts) for different trust domains, for example work vs personal vs each client. Then an agent running a client project literally cannot read another client's data or your personal keys, because the user it runs as has no access. This is real isolation from the same laptop, without standing up a VM per context.

What good looks like:
- The rung matches the risk. Interactive, human-in-the-loop work on trusted inputs is fine on the bare host. Bypass, unattended autonomy, or running untrusted inputs (web content, downloaded repos, MCP servers of unknown provenance) is done at least a rung or two up
- Trust domains are separated by identity: different users or credential scopes for work, personal, and client contexts, so cross-contamination is impossible rather than merely discouraged

Anti-patterns to flag:
- High autonomy (bypass, or heavy unattended automation) on the bare host as your own everyday user; this is where an exfiltration or destructive attack actually lands, because the agent has direct reach to every credential, file, and network you have
- One user and one credential set doing work, personal, and client projects all at once, so a bad step in one context can read or wreck another
- Untrusted input flowing through an autonomous agent with no isolation at all

Nuance: detection is best-effort, especially on macOS, so `isolation_degree: unknown` means "couldn't tell", not "bare metal"; say what the indicators show rather than asserting a rung. Isolation costs friction, and more is not always warranted; the right rung climbs with autonomy and with how untrusted the inputs are, not with paranoia. A solo hobby project on your own machine needs none of this.

A brief word on the operating system (read `os` from the scan): anecdotally, Windows tends to give a rougher agentic-development experience than macOS or Linux; more tooling assumes a Unix shell, more paths and hooks behave, and fewer sharp edges get in the way. If someone is on Windows and hitting friction, it's worth trying their agent work on macOS or Linux (or WSL) to feel the difference. Keep this gentle and honest: there is no measured performance gap, it's a lived-experience observation, not a benchmark. Don't hammer it, and never imply their work is invalid on Windows; just mention it once where relevant.

Fixes: move autonomous or bypass work up a rung (container, VM, or separate box); split trust domains onto separate OS users or credential scopes; keep bare-metal same-user sessions on a gating mode and trusted inputs. See `fix-catalog.md`.

## network-and-autonomous-exposure

Covers: whether the machine is on a proper private network rather than exposing services to the open internet, and whether any uncontainerized autonomous agents are running on a primary machine. This is deep-level material; surface it mainly in ultra and yolo, where the scan actually enumerates listeners and processes.

Scan signal: `network.mesh_vpn_clis`, `network.tailscale_up`, and at deep scope `network.exposed_listeners` and `network.wildcard_bind_count`; plus `autonomous_agents.found` and `autonomous_agents.any`. The listener and process enumeration only runs at `deep` scope (ultra/yolo), so at lighter modes you can only speak to what's installed, not what's listening.

What good looks like:
- Remote access goes over a private mesh network (Tailscale, WireGuard, ZeroTier, Nebula, netbird) where devices reach each other over an encrypted overlay and nothing is published to the public internet. `tailscale_up` true is a good sign
- Services bind to loopback (127.0.0.1) or to the mesh interface, not to `0.0.0.0`/`*` on a machine that's directly reachable. `wildcard_bind_count` of zero is what you want on a normal workstation
- Autonomous agent runtimes, if used at all, run inside a container or a disposable VM, never loose on the daily-driver machine that holds real credentials and files

Anti-patterns to flag, and these are high-severity:
- Ports exposed to the public internet: a service bound to `0.0.0.0` on a machine with a public IP or a forwarded port is an open door. This is the "doing something genuinely dangerous" case; if `wildcard_bind_count` is nonzero, look at what's listening and why, and treat anything reachable from outside as a serious finding
- No private-network layer at all while doing remote access by punching holes in the firewall or forwarding ports, instead of a mesh VPN that would make all of it private
- Uncontainerized autonomous agents on a primary machine: an autonomous agent that acts on its own, running directly on the host rather than in a container or VM, is a standing security risk. It has the machine's full reach, and a prompt-injection or a bad decision executes against the real environment. `autonomous_agents.found` lists what was detected; if any are found and `environment.isolated` is false, flag it plainly and ask what's containing them

Nuance: detection here is heuristic and best-effort. The autonomous-agent marker list is illustrative, not exhaustive, and a name match is a prompt to look, not proof; confirm what a flagged process actually is before alarming. A listener on `0.0.0.0` behind a hardware firewall or NAT with no forwarding is far less exposed than the same bind on a public host, so read the finding in context rather than declaring every wildcard bind a breach. And plenty of people have no need for a mesh VPN because they never do remote access; absence isn't a fault, it only matters once they're reaching machines remotely. The severity scales with how reachable the machine actually is and how much it holds.

Fixes: put remote access on a mesh VPN (Tailscale is the easy default) and stop forwarding ports; rebind exposed services to loopback or the mesh interface; move any autonomous agent into a container or VM, or shut it off on the primary machine. See `fix-catalog.md`.

## safety-enforcement

Covers: the gap between safety that is declared in memory ("never exfiltrate", "never force-push to main", "never write secrets to disk") and safety that is actually enforced. This is one of the most important and least understood parts of a setup.

Scan signal: `safety_instructions.count`, `safety_instructions.by_category`, `safety_instructions.samples`, cross-referenced with `guards` (`release_age_guard`, `secret_read_block`), `settings.files[].hook_events`, and `guards.default_mode`.

The core point to land, clearly and without scolding: a "never X" line in a memory file is a suggestion to the model, not a control. On its own it does nothing. Whether it has any effect at all depends entirely on how the setup runs:
- In a gating mode, the rule might cause the model to pause and surface the dangerous action for a human to catch. That is real but soft; it relies on the model noticing and on the human reading the prompt
- In auto or bypass mode, nothing pauses. The only thing standing between the instruction and the outcome is the model choosing to obey, or at best an LLM-as-judge in the loop deciding to block it. Both are probabilistic. A prompt-injection, a confused chain of reasoning, or a novel phrasing can walk right past a written rule
- A hook enforces the rule deterministically: the action is blocked by code regardless of what the model decides. This is the difference between hoping and preventing
- Best of all is making the bad outcome structurally impossible: if the agent's user cannot read the secret, "never exfiltrate the secret" is moot; if the network is blocked, exfiltration has nowhere to go; if the token is injected inline and never on disk, "never write secrets to disk" cannot be violated

So the ladder for any safety rule is: written instruction (weakest) → LLM-judge → gating-mode pause → deterministic hook → impossible by construction (strongest). Read each declared rule against what actually backs it.

What good looks like:
- The rules that matter are backed by a hook or by construction, not just written. The person's own `never bypass a hook` is backed by hooks; `never write secrets to disk` is backed by inline injection and an `op read` block; `never install without asking` is backed by the permission mode or a release-age guard
- Written rules are used for genuine judgment calls that cannot be encoded, not as a substitute for controls that should exist

Anti-patterns to flag:
- A pile of "never X" safety rules in memory with nothing enforcing the dangerous ones, especially while running in auto or bypass mode. This is safety theater: it reads as careful and prevents nothing. Name the specific naked rules from `safety_instructions.samples` and, for each, ask what actually enforces it
- Relying on the model's obedience or an LLM-judge for outcomes that are catastrophic and irreversible (destructive commands, exfiltration, pushing to production); those deserve a hook or structural impossibility, not a sentence
- The reverse over-correction is rare but possible: so many hard blocks that ordinary work is impossible; controls should target the genuinely dangerous, not everything

Nuance: written rules are not worthless. For soft, judgment-heavy preferences (tone, when to ask, style) they are exactly right, because those cannot be encoded as a hook and are not catastrophic if occasionally missed. The flag is specifically for high-stakes, irreversible outcomes guarded only by a sentence. Match the enforcement strength to the cost of the rule being broken.

Fixes: for each high-stakes naked rule, either add a hook (`hook-development`) or change the setup so the outcome is impossible (remove the access, block the network, inject secrets inline); reserve written rules for the judgment calls that genuinely need a human's or model's discretion. Pair this with permission-posture and execution-environment, since the same rule is worth very different amounts in different modes and on different rungs.

## supply-chain-defense

Covers: whether installs are guarded against freshly-published (and therefore possibly compromised) package versions.

Scan signal: `guards.release_age_guard`, `guards.match_counts`, plus the person's install habits.

What good looks like:
- A guard that blocks installing a package version published in roughly the last 48 hours, because the window right after a malicious publish (a hijacked maintainer account, a typosquat, a poisoned update) is exactly when the bad version is live and before the ecosystem has caught it. Waiting out that window dodges most of the recent npm and PyPI supply-chain incidents. This marketplace ships exactly this pattern as a bun release-age guard hook
- Installs go through a consistent toolchain (a single package manager per ecosystem) so the guard has one place to sit

Anti-patterns to flag:
- No release-age guard at all while the agent is allowed to install packages; a single compromised transitive update lands unchecked
- Install commands scattered across several package managers, so any guard is easy to route around
- A guard that exists but is trivially bypassed (the RULES lesson: never reach for curl/wget/an alternate flag to get the blocked install through; that defeats the guard's purpose)

Nuance: the 48-hour window is a heuristic, not a guarantee, and it trades a little freshness for a lot of safety. Someone who never lets an agent install anything, or who pins and vendors all dependencies, may not need the hook at all; the guard matters most when the agent installs packages semi-freely.

Fixes: add a release-age guard hook on the install commands (the bun guard in this marketplace is the template; the `hook-development` skill helps generalize it to npm, uv, cargo); consolidate onto one package manager per ecosystem so the guard has a single choke point.

## secrets-hygiene

Covers: secrets, passwords, tokens, and PII sitting in plaintext, and `.env` files exposed through git.

Scan signal: `secrets.secret_hits` (each a path, line, rule, match length, and kind of `secret` or `pii`), `secrets.env_files` (each with `git_tracked` and `gitignored`), `secrets.files_scanned`, `secrets.capped`. Breadth follows the chosen scope; a `user` scan sweeps `~/.claude` and the current project, `project` sweeps the repo, `deep` also sweeps `~/.config`, `~/.aws`, `~/.azure`, `~/.ssh`. Cross-reference `tools.on_path.op` (is a secret-injecting CLI present) and `settings.files[].hook_events` (is there a PreToolUse hook, which may be blocking the read verb; confirm by reading the hook) to tell whether the read-proof retrieval pattern below is already in place, and credit it when it is.

Read the hits as candidates, not verdicts. The scanner matches patterns; it cannot tell a live AWS key from a documentation example or a placeholder. Triage before you alarm: a `password=...` inside a connection-string reference doc is almost certainly an example; a long token assigned in a real `.env` or a private-key block in a config file is not. Confirm the file's purpose, and never open the report with "you have leaked secrets" on the strength of a regex.

The hard rule: never reproduce the value. The scanner deliberately emits only location and kind, so no secret material touches disk. Keep that contract in the report and on screen. Say "a probable API token at `~/project/.env:12`", never the token.

What good looks like:
- Secrets are fetched through a CLI that injects them inline at the moment of use and never exposes the plaintext to the agent. The strong pattern: a 1Password service account with `op run` / `op inject` resolving `op://` references inside a single command, so the value lives only in that subprocess's memory. The agent orchestrates the command but never sees the secret
- The read verb is fenced off. A hook that blocks `op read` (and similar dump-the-value commands) means even if the agent tries to print a secret, it can't; retrieval is possible, exfiltration is not. This is the difference between "secrets are in a manager" and "the agent structurally cannot leak them"
- `.env` files are gitignored and untracked; the repo carries a `.env.example` with blank values, not the real one
- No PII or credentials in memory, context files, settings, or scratchpads

The bar is not "encrypted at rest somewhere". It is that the retrieval path gives the agent use of the secret without sight of it. A token pasted into an env var the agent can `echo`, or a manager the agent can `op read` freely, still leaks the moment the agent is asked to. The service-account-plus-read-block pattern closes that gap.

Anti-patterns to flag:
- A real secret in plaintext anywhere the agent or a repo can read it, especially in memory or settings that load every session
- A `.env` that is `git_tracked` true, or `gitignored` false; a committed secret is exposed to anyone with repo access and stays in history after deletion
- PII sitting in a file that gets shared, synced, or committed
- Tokens pasted into a scratchpad or a context file "just for now"

Fixes: move the secret into a manager and rotate it (a committed secret must be rotated, not just removed, because it is in history); gitignore and `git rm --cached` a tracked `.env`; strip credentials out of memory and context. See `fix-catalog.md`. If a secret is confirmed live and exposed, say so plainly and prioritize rotation over everything else in the audit.

## delegation-and-ethics

Covers: what the person delegates to agents, and whether any of it is something they should not delegate. This theme is mostly interview; the scan cannot see it.

What good looks like:
- Agents are used for leverage on work the person still owns and can vouch for
- The person reads what an agent produced before it goes out under their name
- Review and judgment stay human where a human is being represented as the author or reviewer

Anti-patterns to flag (ask about these directly, without accusation):
- Publishing docs, posts, or comments the person never read, in their own name or someone else's
- Rubber-stamping agent-written reviews or approvals as if a human reviewed them
- Using an agent to represent themselves as present or as the author where they were not
- Generating volume (posts, PRs, issues) whose point is throughput, not value, and pushing the cost onto readers or reviewers

The line is not "agents did work" (that's the whole point) but "a human is credited or represented without the human's actual judgment behind it". Raise it as a question, let the person reflect, and record what they say. This is not the skill's job to police; it is the skill's job to surface.

## determinism

Covers: using nondeterministic agent calls where a deterministic script would be right, and the reverse.

Signal: mostly interpretive, informed by transcripts and what the person describes. The scan's transcript volume hints at how much work runs through the agent.

What good looks like:
- Repetitive, well-specified, verifiable work is scripted; the agent writes the script once and then the script runs
- The agent is reserved for the genuinely ambiguous, judgment-heavy, or one-off work where a script cannot capture the task
- The person prefers event-driven hooks over the agent polling for state

Anti-patterns to flag:
- Asking the agent to redo the same deterministic transform every session instead of bundling a script (the skill-authoring lesson: if three runs all wrote the same helper, that helper should be a script)
- Nondeterministic model calls for something with a single correct answer and a cheap check
- Conversely, over-scripting a task that actually needs judgment, producing brittle automation that breaks on the first edge case

Fixes: pull the repeated transform into a script the skill or project owns; replace a polling loop with a hook; loosen an over-rigid script back into a judgment call where it keeps breaking.

## focus-and-shipping

Covers: whether the person spreads across many half-built projects or sustains focus long enough to ship. Interview, cross-checked with the scan.

Scan signal: `transcripts.project_dirs` (how many distinct projects have been worked), against how many actually shipped (ask). A high project-dir count with few releases is a signal, not a verdict.

What good looks like:
- Projects reach someone else: shipped, released, handed off, or deliberately archived with a reason
- Focus is sustained enough that things finish; starting is not the bottleneck, finishing is

Anti-patterns to flag:
- Many started projects, few finished; a graveyard of dirs with a first commit and nothing since
- Restarting or rewriting rather than shipping and iterating
- The dopamine of the new project displacing the grind of finishing the current one

Raise it gently and concretely: name the count from the scan, ask how many reached someone, and let the person judge. Some people genuinely run many parallel bets; the question is whether that's a choice or a pattern.

## model-and-effort

Covers: matching model tier and reasoning effort to the task, in both directions.

Scan signal: `settings.files[].model`, plus the live model and effort from your own session context.

What good looks like:
- The default is a capable model, dropping to a cheaper or faster one for trivial mechanical work
- Reasoning effort is high for hard reasoning and low for rote edits; not maxed on everything by reflex
- The person knows they can change both per task and does

Anti-patterns to flag:
- The most expensive model or max effort on trivial, mechanical, high-volume work where a cheaper tier is indistinguishable
- The reverse: a weak model or minimal effort on genuinely hard reasoning, paying in wrong answers to save pennies
- Never varying either; one setting for all work is rarely optimal

Fixes: suggest a lighter default for mechanical work with an easy escalate; point out per-task model and effort switches; if a statusline is being set up, put model and effort on it so the choice stays visible.

## usage-review

Covers: whether the person ever looks at their own transcripts, cost, or usage patterns.

Scan signal: `transcripts.available`, `transcripts.session_count`, `transcripts.total_mb`, `transcripts.project_dirs`. A large corpus that is never read is a missed feedback loop.

What good looks like:
- The person occasionally reads back transcripts to see where the agent went wrong or wasted effort, and feeds that into better context and skills
- They have some sense of their spend and where it goes
- Transcripts are treated as a data source, not exhaust

Anti-patterns to flag:
- Thousands of sessions and gigabytes of transcripts never once reviewed; the richest signal about how they actually work, ignored
- No idea of cost or token distribution across projects
- No mechanism to turn recurring agent mistakes into a fix

Fixes: suggest a periodic transcript review habit; point at analyzing the corpus for repeated failure modes and turning them into memory or skills; tie into the knowledge-system theme.

## automation

Covers: `/loop`, `/schedule`, goals, terminal multiplexers, and cloud agents for async delegation.

Signal: interview, plus any scheduled-agent or cron config. The scan does not detect these reliably; ask.

What good looks like:
- Recurring work runs on `/loop` or `/schedule` instead of by hand each time
- Long or async tasks are delegated to cloud agents so the person is not babysitting a terminal
- Multiple agents run in parallel across a multiplexer (tmux, or a purpose-built multi-agent harness) when the work fans out
- Goals frame longer efforts so the agent keeps direction across sessions

Anti-patterns to flag:
- Doing by hand, every time, something that is on a clean interval and could be a scheduled routine
- Sitting and watching a single long-running task that could be delegated async
- Running one agent at a time when the work obviously parallelizes

Fixes: convert a described manual recurring task into a `/loop` or `/schedule` routine; point at cloud agents for the async work; suggest a multiplexer or multi-agent setup if the work fans out.

## knowledge-system

Covers: whether anything lets the person's memory, context, and skills compound over time, tailored to them, rather than starting cold each project.

Signal: interpretive, drawn from the memory, skills, and shared-dir signals together. A person with a versioned skills repo, a memory vault, and a habit of writing learnings back has a knowledge system; a person with default memory and vendor skills does not.

What good looks like:
- A durable place where hard-won context accumulates: a notes vault, a memory repo, project scratchpads that get read before new work
- A habit of writing learnings back so the next session starts ahead of the last
- Skills and memory versioned and shared so the compounding is not trapped on one machine

Anti-patterns to flag:
- Every project starts from zero; nothing learned in one carries to the next
- Learnings live only in the person's head or in transcripts nobody reads
- No feedback loop from what went wrong to what the setup knows

Fixes: stand up a simple durable store (a vault, a memory repo, a scratchpad convention); adopt a write-back habit; version and share the skills and memory so it compounds across machines and agents. This is the theme that makes all the others compound, so weight it accordingly.

## Scoring

Give each theme a plain verdict: strong, ok, or weak, each with a one-line reason. Skip a numeric score unless the user asks; a number invites gaming and hides the reason. Rank the weak themes by how much fixing them would change the person's daily work, and let that ranking drive the fix list. Two applied fixes beat a twelve-item report.
