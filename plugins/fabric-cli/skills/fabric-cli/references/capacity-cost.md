# Capacity cost: estimate before acting

Bursting hides cost. An operation finishes fast, the bill arrives as smoothed usage afterwards, and on a small F SKU one operation can put the capacity into days of throttling. Estimate first, then act.

Learn: https://learn.microsoft.com/en-us/fabric/enterprise/throttling | https://learn.microsoft.com/en-us/fabric/enterprise/fabric-operations | https://learn.microsoft.com/en-us/fabric/enterprise/enable-capacity-overage | Plan billing: https://learn.microsoft.com/en-us/fabric/iq/plan/resources/billing-fabric-plan | Ontology usage: https://learn.microsoft.com/en-us/fabric/iq/ontology/resources-capacity-usage

## Budget math

```yaml
F<n>:            n CU; 24 * n CU-hours per day; 720 * n CU-hours per 30 days
F2:              2 CU; 48 CU-h/day; 1,440 CU-h/30 days; 60 CU-s per 30 s timepoint; 1,200 CU-s per 10 minutes
price:           pay-as-you-go per CU-hour, per region; look it up for the capacity's region (West Europe F SKU was about EUR 0.19 per CU-h in 2026-09)
billing:         per second while Active; paused capacities bill storage only
```

## Smoothing and throttling (Microsoft Learn, fabric/enterprise/throttling)

```yaml
timepoint:              30 seconds; 2,880 per 24 hours
interactive smoothing:  5 to 64 minutes
background smoothing:   24 hours (notebooks, pipelines, refreshes, almost all Warehouse queries)
overage protection:     up to 10 minutes of future capacity, no throttling
interactive delay:      10 to 60 minutes of future capacity used; new interactive requests wait 20 s
interactive rejection:  60 minutes to 24 hours; new interactive requests fail
background rejection:   over 24 hours; every new request fails
exception:              Real-Time Intelligence skips the 20 s delay stage; on-demand Spark billing sits outside smoothing (per Learn throttling page, 2026-11)
error:                  CapacityLimitExceeded, "Your organization's Fabric compute capacity has exceeded its limits"
```

- A background operation of X CU-h adds X / (24 * n) to every timepoint of the next day. On an F2, 1 CU-h adds about 2.1 percent
- An interactive operation bigger than 10 minutes of capacity (n * 600 CU-s) starts delaying users at once
- Overage beyond the 10-minute window becomes *carry forward*. Only idle capacity burns it down, so payback takes `carry_forward / ((1 - utilization) * n)` hours of the SKU's CU. The Monitoring hub's "Carry forward CUs" figure did not match the billed CU-hours in one observed case (3.1M shown, about 200 CU-h billed for the day), so check the bill by meter before quoting a settlement cost
- Ways out: pause then resume (bills the whole carry forward and smoothed backlog at once, clears throttling); scale the SKU up temporarily (faster burndown, similar total cost); capacity overage billing (3x the normal rate)
- `fab stop` pauses; the pause is itself the billing event for the carry forward

## Before any operation that consumes CUs

Creating items, running notebooks, pipelines, refreshes, SQL or DAX queries at scale, Copilot, graph or ontology loads, and anything scheduled all count.

1. Find the capacity, its SKU and its state: `fab ls .capacities -l`, or ARM `az rest --method get --url https://management.azure.com/<capacity id>?api-version=2023-11-01` (`properties.state`, `sku`)
2. Check its current load: Fabric Monitoring hub, Manage capacities, open the capacity (utilization, current throttling, carry forward CUs). Any carry forward or throttling means the capacity has no headroom
3. Estimate the operation's CU-hours: use a known flat charge (below), or measure one small run in the Capacity Metrics app before scaling up. Multiply scheduled work by its frequency
4. Express it as EUR and as a share of the daily budget and of the 10-minute, 60-minute and 24-hour windows
5. State that estimate to the user and wait for an explicit go when any of these hold:
   - the charge is flat, per session or per user rather than per use
   - it exceeds 25 percent of the capacity's daily CU-hours
   - the capacity already throttles or has carry forward
   - it recurs (schedule, trigger, pipeline) and the recurring total crosses the thresholds above
   - the cost cannot be estimated at all

A user asking for a feature by name is not consent to its cost.

## Known charges

```yaml
Plan (preview):
  model:     30-day sessions per user, per capacity (Learn: billed per tenant, user and capacity); cannot be ended early; billed even if the plan or capacity is deleted
  Planner:   847 CU-h per session (59 percent of an F2 month)
  Stakeholder: 168 CU-h
  Viewer:    37 CU-h
  automation job: 2 CU per run
  trigger:   docs say opening, creating or editing a plan item in the portal
  observed:  2026-09, creating a plan by REST and pushing updateDefinition, with nobody opening the portal, was billed as one Stakeholder session: meter "Fabric Planning - Stakeholder Sessions Capacity Usage CU", 167.9 CU-h, EUR 31.72 on an F2 in West Europe; it drove the F2 into carry forward and throttling the same day
  verdict:   never on an F2 or F4 without the user accepting the session cost first
Ontology and graph (preview):
  creating an ontology creates a GraphModel and a lakehouse; graph loads and queries consume capacity
  observed:  2026-09, a 34-entity ontology bound to large fact tables never populated its graph on an F2 while a 2-entity probe did; bind small or aggregated tables and measure one load first
Copilot and AI:
  billed as its own capacity meter; on small capacities it can be the largest daily line
```

## Seeing what it cost

- Capacity Metrics app: Compute page, utilization and throttling charts, drill through a timepoint for the operations; Overages tab for carry forward and burndown
- Azure Cost Management, by meter: `az rest --method post --url "https://management.azure.com/<scope>/providers/Microsoft.CostManagement/query?api-version=2023-11-01"` with `granularity: Daily` and grouping on `Meter`; Fabric bills per workload meter (for example "Spark Memory Optimized Capacity Usage CU"); costs lag 8 to 24 hours
