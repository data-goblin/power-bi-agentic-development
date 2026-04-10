# Feeling out the landscape

Before teaching anything, get a feel for the person's actual situation, because it decides what's even possible for them and what's worth teaching. Do this gently and conversationally, like a consultant scoping a first meeting, not a form to fill in. Many beginners won't know their own answers (licensing especially), and that's fine; help them find out, and never make them feel behind for not knowing.

You're feeling out three things: their role, what they can access, and what systems they touch. Weave these into the goal conversation rather than firing them as a checklist. Ask a couple at a time with `AskUserQuestion`, react to what they say, and follow the thread. The aim is a working picture of what they can do, so the rest of the guide fits them.

## Their role

Role changes what you teach and which tools matter. Feel out where they sit:

- What they make: reports and dashboards, semantic models, both, or mostly consuming and analyzing. A report author cares about the reports and visuals tooling; a modeler cares about the semantic-model and Tabular Editor tooling; the paths differ.
- Whether they administer anything: are they a Power BI or Fabric admin, or do they just build inside a workspace someone else runs. Admins have tenant-level reach and a whole governance surface; builders don't, and shouldn't be steered toward admin tooling they can't use.
- Consultant or internal: a consultant hops between clients and tenants, so portability, clean separation between engagements, and not leaving traces matter; an internal person lives in one tenant and can lean on shared conventions and standing setup.
- Solo or team: someone working alone owns their whole setup and conventions; someone on a team shares a repo, naming standards, and deployment process, and needs to fit those rather than invent their own. This changes how you talk about git, memory, and shared skills.

Let their role steer which pillars lean heavier and which plugins you eventually point at. Don't teach a report author the depths of semantic-model tooling they'll never open.

## What they can access

This decides what's actually possible, so feel it out plainly and help them check if they're unsure:

- Licensing tier: Free, Pro, Premium Per User (PPU), Premium capacity, or Fabric. This gates real capabilities. XMLA read/write (which most of the modelling tooling needs), deployment pipelines, larger models, and some APIs need PPU, Premium, or Fabric; a plain Pro user can't drive the same workflows. If they don't know their tier, that's common; you can help them find it, and it's a fine early thing to establish because it rules options in or out.
- API and service-principal access: can they get at the Power BI / Fabric REST APIs, and does their organization allow service principals and tenant settings that let automation run. In locked-down tenants, IT may block the very things an agent workflow leans on. Feel out whether they can authenticate, whether they have the rights, or whether they'll need to ask their admin.
- Machine rights: can they install software on their own machine, or is it managed and locked. This decides whether the tool-install path is even open to them, or whether they need IT's help first. Worth knowing before you send them to install anything.

Keep the tone reassuring: not knowing a license tier or lacking an entitlement isn't a failing, it just shapes the plan. Where something is gated, say so honestly and offer the path that fits what they do have.

## What systems they touch

Feel out where their data and work actually live, because agent work rarely happens in Power BI alone:

- Other data platforms: do they pull from or push to Snowflake, Databricks, Fabric lakehouses, SQL Server, Excel, SharePoint, or something else. This shapes which connectors, credentials, and eventually which tooling matter.
- Where the work lives: files on their machine, a shared drive, a git repo, or straight in the service. This connects to the environment pillar and to how you talk about git and safety.
- Who and what depends on their output: a report a few people glance at is a different stakes level from a model a whole team builds on; it informs how carefully you steer them on safety and process.

You don't need exhaustive answers. You need enough of a picture that when you teach the pillars and eventually hand off to install tools, it fits their role, respects what they can access, and connects to the systems they actually use.
