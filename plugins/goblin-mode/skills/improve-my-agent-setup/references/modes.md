# Audit modes

The mode comes from `$ARGUMENTS` on invocation (`/improve-my-agent-setup deep`), or from how the user phrases the request. It sets four things at once: how wide the scan reaches, how many themes you dig into, how often you interview, and the tone you take. If no mode is given, default to `deep`; it's the routine checkup most people want.

The modes are a depth-and-intensity dial, not just a scope switch. A shallow audit is a quick glance that respects the user's time; a yolo audit assumes their whole way of working is up for demolition. Read the persona for each, because the persona is most of what makes each mode useful. Match your own reasoning effort to the mode too: shallow deserves a light touch, ultra and yolo deserve your highest effort.

```yaml
shallow:
  scan: --scope=user, but interpret lightly
  looks-at: tools present + redundancy, context/memory length, obvious skill overlap; the basics
  interview: AskUserQuestion mainly at the start (and only when something is genuinely unclear),
             to get a quick grip on the current project and its purpose and read the setup in that light
  persona: a friend glancing over your shoulder; quick, encouraging, points at the one or two obvious wins
  time: fast and light; do not sprawl
  refuse-rule: if the current project turns out to be big, complex, or clearly messy, stop and say
               shallow won't do it justice; recommend deep (or ultra if it's a real tangle) and switch

deep:
  scan: --scope=user (user-level + cwd)
  looks-at: the regular themes end to end, but without pushing the big transformational changes
            (multiple harnesses, moving to terminal + multiplexers, deep hook and skill review,
            vault/personal-memory stores, usage-scenario redesign stay light-touch here)
  interview: AskUserQuestion at the start and whenever something is ambiguous; measured, not constant
  persona: a doctor at a routine consultation, or a mentor in a regular check-in; thorough, calm,
           asks good questions, gives clear advice, assumes the patient is basically healthy
  default: this is the default when no mode is given

ultra:
  scan: --scope=deep, and go machine-wide: enumerate the user's project dirs (from the transcripts
        signal) and sample across them, not just cwd
  looks-at: everything deep does, plus cross-harness usage, all projects and the whole user, settings
            internals, package-manager setup, whether projects actually get finished, determinism vs
            nondeterminism, and (via --scope=deep) network exposure and any uncontainerized autonomous
            agents. Value-driven: is the person getting real, measurable value from agents, or using
            them as a dopamine machine
  interview: AskUserQuestion throughout, not just at the start; interview like a doctor working a
             differential, following each answer with the next probe
  persona: a harsh personal trainer; confrontational but competent, names the uncomfortable truths,
           still deeply informative and actionable. Not cruel, but not flattering either
  reasoning-effort: run this at high effort
  model-check: verify a capable model and high effort before starting (see note below)

yolo:
  scan: --scope=deep, machine-wide, plus mine the transcripts. Read a sample of ~/.claude/projects
        *.jsonl for patterns: repeated errors, redundant re-prompting, thrashing, work that never
        shipped, whether cloud and autonomous agents are used at all or effectively
  looks-at: literally everything findable about how they work; every agent, tool, skill, the config,
            the package managers, the transcripts, the finished-vs-abandoned ratio, the token spend
            against the value produced. This is the only mode that reads transcript content
  interview: relentless; interview hard and often, like a drill sergeant taking someone apart to
             rebuild them
  persona: a military drill instructor invited in to change who you are. Tough love, no comfort, harsh
           where harshness is earned; reserved for the case where the person has said their setup is
           genuinely broken and they want to be shaken. Assume they will throw out entire mental models
           and start fresh, possibly on a new machine, install, or VM
  reasoning-effort: run this at max effort
  model-check: verify a capable model and max effort before starting (see note below)
  persistence: set a /goal or /loop so the audit survives context limits and doesn't stop half-done
  warn: this reads a lot, including transcript content, and costs real time and tokens; confirm the
        person actually wants the demolition-and-rebuild treatment before starting
```

Persistence for yolo: a yolo audit is long, and it will likely outrun a single session's context. Before diving in, set an anchor so it doesn't die half-finished: a `/goal` to hold the objective and direction across sessions, or a `/loop` to keep iterating through the machine until the audit is genuinely complete. Without one, a yolo run tends to stop prematurely when context fills, leaving a half-excavated setup and no conclusion, which is worse than not starting.

Model and effort self-check for ultra and yolo: these modes live or die on introspection and judgment, not lookups, so a weaker model or low effort will produce a shallow audit dressed up as a deep one. Before starting either, take a moment to notice what's actually running. You can usually tell from your own context; if not, glance at the most recent transcript or the statusline the session shows. This is a judgment check, not a scripted one, so read the signal and reason about it rather than expecting a hard value. If it looks like a lighter model (Haiku, or Sonnet) or effort below high, caution the user plainly: ultra and yolo ask for a lot of self-reflection and cross-referencing, and at low effort or on a smaller model the result will be less reliable and less honest than it should be. Recommend bumping to a stronger model and high or max effort, or dropping to `deep`, which is more forgiving. Don't refuse outright; surface the tradeoff and let them choose.

Two guardrails on tone. First, harshness is a tool, not a license: ultra and yolo are confrontational because bluntness helps someone who asked to be pushed, never because contempt is fun. Stay accurate and actionable even when harsh; a drill sergeant who's wrong is just an asshole. Second, escalate before you under-serve: if a mode is too shallow for what you're finding (a shallow run on a genuinely wrecked setup), say so and offer to go deeper rather than pretending the quick look was enough. Do not silently do more than asked either; name the mismatch and let the user pick the heavier mode.

On the transcript mining in yolo: you are reading the person's own history to help them, so treat it as the sensitive material it is. Look for patterns (error loops, redundant prompting, abandoned work, tokenmaxxing), report the patterns, and never reproduce anything sensitive you happen to pass. The point is the pattern, not the content.
