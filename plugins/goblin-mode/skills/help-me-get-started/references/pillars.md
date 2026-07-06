# The five pillars

The whole guide hangs on five things that decide how well an agent works for someone: the model, the context, the prompt, the tools, and the environment. You teach these not as a lecture but in service of what the person actually wants to do. Each section below gives you the plain-language idea, an analogy that lands for a Power BI or data person, the opinionated stance to pass on, what to ask them, what to check on their machine, and a sketch for the local explainer to show.

Keep the person's goal in the front of your mind the whole time. Every pillar is taught as "here is how this helps you do the thing you came to do", never as abstract theory. If a pillar doesn't touch their goal yet, say so and keep it short.

Teaching rhythm for every pillar: say one or two sentences, then stop. Ask if they've heard of the thing before you explain it, so you neither talk down to them nor lose them. Show the explainer. Ask one checking question. Only then move on. Slow is the point.

## Pillar 1: model

Plain idea: the model is the brain doing the thinking. There are different ones, and you can switch between them any time. Some are faster and cheaper; some are slower, pricier, and think harder. You also have an "effort" dial that tells the current brain how hard to think.

Analogy: it's like choosing who does a job. A quick question to a sharp junior analyst is cheap and fine; redesigning the whole data model, you want your most senior person on it, and you give them time to think. You wouldn't put your most expensive architect on renaming a column, and you wouldn't hand a tricky DAX performance problem to whoever's fastest.

Opinionated stance: match the brain and the effort to the task, in both directions. Don't burn the biggest model and maximum effort on trivial work, and don't cripple hard reasoning with a small model to save pennies. Most people never learn they can change either; teaching this one thing saves them money and gets them better answers.

Ask: "Did you know you can change which model you're using, and how hard it thinks? Have you ever done that?"

Check: read what model and effort are running right now (from your own context, or the statusline if they have one) and tell them, so it's concrete rather than abstract.

Explainer sketch: two cards side by side, a cheap-and-fast brain and a slow-and-smart brain, with a one-line "use me for..." under each, and a small note that effort is a separate dial.

## Pillar 2: context

Plain idea: context is everything the agent knows going into a task: the files it can see, the memory you've given it, the conversation so far. The agent is only as good as what it knows. Memory is the notes it always carries; you write those notes.

Analogy: it's onboarding a contractor. A contractor who knows your naming conventions, where the models live, and how your team works needs far less hand-holding than one you brief from scratch every morning. Memory is the one-page brief you hand every new contractor so you never repeat yourself.

Opinionated stance, and one of the three core beliefs: own your context. The single biggest lever a beginner has is writing good memory and learning to steer, not installing more of other people's skills and hoping. Start with almost nothing in memory and add a line only when you catch yourself repeating an instruction. Memory that restates what the model already knows, or that balloons to thousands of lines, quietly makes every task worse.

Ask: "Have you heard of memory, or a CLAUDE.md file? Do you know the agent forgets everything between sessions unless you write it down?"

Check: whether they have any memory file yet. If not, that's fine; this is where they start. If they have a giant one they inherited, that's a flag to revisit later with improve-my-agent-setup.

Explainer sketch: a simple before/after; a bare agent guessing, versus the same agent handed a short brief and getting it right, with the brief shown as a few plain bullet points.

## Pillar 3: prompt

Plain idea: the prompt is how you ask. Vague ask, vague result. The more of the real situation you give it, the better it does. And you don't have to type it all; you can talk.

Analogy: it's the difference between telling a colleague "fix the report" and telling them "the sales page loads slowly, I think it's the year-over-year measure, can you check the DAX and tell me what's expensive before changing anything". The second gets you help; the first gets you a shrug or a guess.

Opinionated stance: richer prompts win, and typing is the thing that keeps people terse. Strongly suggest speech-to-text (Wispr Flow, or a voice mode) for the long framing prompts, because saying three paragraphs of context is easy and typing them isn't. Also: ask for a plan before big changes, and iterate; the first answer is a draft, not a verdict.

Ask: "When you ask it to do something, do you give it much background, or keep it short? Have you tried just talking to it instead of typing?"

Check: whether any speech-to-text is installed. Mention it as a real quality-of-life upgrade, not a requirement.

Explainer sketch: two prompt bubbles, thin versus rich, with the kind of result each tends to get underneath.

## Pillar 4: tools

Plain idea: on its own the model can only think and talk. Tools are what let it actually do things: read and write files, run commands, edit a Power BI model, query a workspace. Skills are bundles of instructions that teach it a job; MCP servers and CLIs are ways it reaches your systems.

Analogy: the model is the brain, tools are the hands. A brilliant analyst with no access to your data or files can only advise; give them the keys and they can work. Skills are like giving that analyst your team's playbook for a specific task.

Opinionated stance, and a core belief: start tiny. Install only the tool a real task needs, and add more when a real task needs them. Every tool and skill you add competes for the agent's attention, so a pile of unused ones makes it worse, not better. For the Power BI and Fabric tooling specifically, don't hand-install a sprawl; drive the install from `references/install.md`, which covers exactly what the plugins they want actually need.

Ask: "Do you know what a skill is, or an MCP server? Do you know the agent can edit your Power BI files and models directly with the right tools?"

Check: what's already installed that's relevant to their goal. If their goal needs the Power BI stack, this is the natural point to drive the install from `references/install.md`. Don't install things they have no goal for.

Explainer sketch: a brain in the middle with a few labelled "hands" reaching out (files, terminal, a Power BI model, a workspace), and a note that you add hands as you need them.

## Pillar 5: environment

Plain idea: the environment is where all this runs: the terminal, your files, git, and the safety settings that decide what the agent can do without asking. It sounds intimidating and it isn't.

Analogy: the terminal is just a text way of telling the computer what to do, the same instructions you'd otherwise click through, typed out. Git is an undo button for your whole project; it remembers every version so a mistake is never permanent. Permission modes are how much leash you give the agent: ask-me-every-time, or move-freely-but-stop-at-anything-dangerous.

Opinionated stance, and the third core belief: don't fear the terminal. Demystify it early, because the fear is what stops data people from ever getting good at this. Pair it with two safety ideas: use git from the start so nothing is ever lost, and understand permission modes so the person, not the agent, holds the guardrails. The sensible default mode lets edits flow while still stopping at genuinely dangerous or outward-facing actions.

Ask: "Are you comfortable in the terminal, or does it make you nervous? Have you used git before? Do you know you can control how much the agent does on its own?"

Check: whether git is installed and whether they're working inside a git project; whether a sensible permission mode is set. Keep any operating-system aside very light and gentle: if they happen to be on Windows and hit friction later, macOS or Linux can feel smoother, but it's a soft, anecdotal footnote, not a thing to push, and never something that makes their Windows work wrong.

Explainer sketch: three small cards, terminal ("just typed instructions"), git ("an undo button for everything"), and permission mode ("how much you let it do alone"), each with one friendly line.
