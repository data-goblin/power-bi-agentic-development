# Row-level and object-level security

Companion to the `semantic-model` skill (SKILL.md). Original guidance; each section cites its sources.

**Working with `te`:** `te add role "Region" --save`, then the table filter via `te set` / `te script`. `te` has no impersonation flag: validate with `te test` (wrap filters in `TREATAS`) or connect-pbid (`Roles=` / `EffectiveUserName=`). Audit fail-open filters with `te find "TRUE" --in expressions --paths-only`.

## Validating RLS roles before deploy (te-cli has no impersonation flag)

A wrong RLS filter is a data leak, not a noticeable bug. The trap for agents: `te query`/`te test` expose no `--as-role`/effective-identity option (only `-q/-f/--limit/--trace/--cold/--plan/--runs`), so you cannot ask the engine "render as Alice." Validate by other means and know which actually exercises the security layer:
1. **Emulate the filter as DAX (offline).** Substitute a literal for the identity function: `CALCULATETABLE(SUMMARIZECOLUMNS(...), TREATAS({"alice@contoso.com"}, 'UserRegionMap'[UserEmail]))`. This proves the predicate is well-formed and returns the intended rows, but does not exercise the security context, so it misses ambiguous-path/propagation surprises. Always assert the adversarial case: an unmapped UPN must return zero rows
2. **Bake these into `te test`** (`te test init --from-model`) wrapping each role's filter in `CALCULATETABLE(..., TREATAS(...))`, asserting counts for a known and an unmapped identity, run as a gate (`te test run --fail-on error`)
3. **True security-context validation needs a deployed model and connection-string impersonation, not te-cli.** Tabular Editor appends `Roles=` + `EffectiveUserName=` (+ `CustomData=` since TE3 3.25) to the XMLA string (the impersonated user needs Build + role assignment); if `te` exposes no flag, fall to TOM/ADOMD via connect-pbid opening a connection with `Roles=...;EffectiveUserName=...`, or test in the service with View as / Test as role

Test as role uses your identity for the DAX functions ; `USERPRINCIPALNAME()` returns the tester's UPN unless you supply "Other user" + role, and you cannot see what a B2B guest or service principal sees without signing in as them (docs admit it "doesn't fully replicate the authentication context"). View as roles does not work for DirectQuery with SSO ; validate by signing in as a real Viewer. Test 3-10 distinct identities per role, including out-of-band values.

Sources: learn.microsoft.com service-admin-row-level-security (validating role, Test as role); learn.microsoft.com rls-guidance (validate roles); docs.tabulareditor.com data-security-testing; repo te-cli command-reference

## Defensive dynamic-RLS filter expressions (fail closed, not open)

Write the role filter so unexpected or malicious identity values return zero rows. The common `IF(USERNAME()="Worker", [Type]="Internal", TRUE())` fails **open** ; any value that is not "Worker" (a typo, or an injected value in an embedded "embed for your customers" app that can pass arbitrary effective usernames) hits the `TRUE()` branch and returns everything. Exploitable, not theoretical. Match every expected value explicitly and make the fall-through `FALSE()`. The mapping-table pattern (`[Region] = USERPRINCIPALNAME()` against a table with no row for an unmapped UPN) is fail-closed automatically; the danger is only the `IF(..., TRUE())` style. Audit with `te find "TRUE" --in expressions --paths-only`.

`USERNAME()` returns `DOMAIN\user` in Desktop but the UPN in the service; standardize on `USERPRINCIPALNAME()` and store that exact sign-in UPN (not the Entra `mail` alias) in the mapping table. B2B guest UPN format is not guaranteed (`user@partner.com` vs `user_partner.com#EXT#@tenant.onmicrosoft.com`); a format mismatch silently shows the guest no data ; verify with a `[WhoAmI]=USERPRINCIPALNAME()` card. A user in no role sees no rows once any role exists; a user seeing everything is usually a workspace Admin/Member/Contributor (Edit bypasses RLS) or in a fail-open role. In embedded service-principal flows the DAX identity functions return the app ID or empty string, so per-user RLS there comes from the REST `EffectiveIdentity` (and `CUSTOMDATA()`), never the DAX functions.

Sources: learn.microsoft.com rls-guidance (defensive filters); learn.microsoft.com service-admin-row-level-security (dynamic RLS considerations); learn.microsoft.com embedded-row-level-security

## Bidirectional cross-filtering with RLS (mechanics and the one-relationship constraint)

By default RLS propagation is single-directional regardless of the relationship's cross-filter setting; a bidirectional relationship does not push the RLS filter both ways. You opt in per relationship via "apply security filter in both directions" (`securityFilteringBehavior = BothDirections`). This is distinct from the modeling rule "avoid model-level bidirectional" ; here the toggle is sometimes required, not a smell. Canonical case: dynamic RLS where the secured user-mapping table on the one-side must filter through a bridge to reach the fact; without the opt-in the filter does not reach across and users see wrong rows.

The property is not in the documented `te set -q` list, so confirm it on a real object (`te get 'Relationships/<name>'`), then set it or drop to TOM (`SecurityFilteringBehavior.BothDirections`). Hard constraint: if a table participates in multiple bidirectional relationships, the security filter can be enabled on only **one** of them (the others stay bidi for normal cross-filtering); pick the path the RLS filter must travel. `securityFilteringBehavior` is independent of `crossFilteringBehavior` (two separate properties; one does not imply the other). It degrades query performance (extra propagation passes), so use it only where the RLS path needs it, and it only changes RLS propagation ; it does not fix ambiguous-path numbers in normal cross-filtering.

Sources: learn.microsoft.com service-admin-row-level-security (define roles and rules); learn.microsoft.com desktop-bidirectional-filtering

## OLS hard restrictions (relationship chains, RLS+OLS cross-role error, measure propagation, composite leakage)

Object-level security secures tables/columns (data + name + metadata) via per-role `metadataPermission = None`. Most OLS failures are not "the column is still visible" but design-time errors, query-time errors for specific role combinations, or silent over/under-exposure through composite chaining:
- **Securing a table cannot break a relationship chain** (design-time error): with A->B->C you cannot secure B; fix with a direct A->C relationship or secure a leaf. `te validate` catches it
- **RLS and OLS from different roles cannot combine for one user** (query-time error): keep both kinds of restriction for a user inside one combined role
- **Measures are auto-restricted by reference, never explicitly** (no measure-level OLS): a measure touching a secured object becomes restricted (same for KPIs, DetailRows). To deliberately hide a measure, rewrite it to touch a secured object (the sentinel workaround); to avoid accidentally killing a measure, check `te deps` before securing a column
- **A relationship may reference a secured column only if the column's table is not itself secured**
- **Composite-model OLS leakage**: OLS is enforced only on the source model; the composite author copies whatever schema they can see, so a downstream consumer may see metadata hidden from them (or miss entitled objects) because the composite froze the author's view. Actual data never leaks (DirectQuery re-evaluates OLS at the source and errors for unauthorized columns), but the metadata experience is wrong. Treat OLS as non-composable

OLS applies only to Viewers (Admin/Member/Contributor bypass). Power BI features unsupported with any OLS: Q&A, Quick Insights, Smart Narrative, Excel Data Types ; if a model needs Copilot/Q&A, OLS may be the wrong tool (consider RLS-only plus separate models). Perspectives are not security. There is no Desktop UI for OLS, so the `te`/TOM/TMDL path is the only route.

Sources: learn.microsoft.com object-level-security; learn.microsoft.com service-admin-object-level-security; learn.microsoft.com desktop-composite-models; learn.microsoft.com powerbi-implementation-planning-security-report-consumer-planning

## User-defined aggregations: grain design, agg-awareness, precedence, RLS

A user-defined aggregation is a hidden Import (or DQ) table holding a coarser-grain pre-aggregate of a large DQ detail table; the engine transparently rewrites qualifying DAX subqueries to it. Encoded as `alternateOf` on each agg column (`baseColumn`+`summarization`, or `baseTable`+`groupByColumns`) plus the table mode ; no special object. Two techniques with different rules: **relationship-based** (star sources, agg relates to the same dimensions) where GroupBy entries are optional except DISTINCTCOUNT needs an explicit GroupBy on the key; **GroupBy-based** (denormalized, no relationships) where GroupBy entries are mandatory or the agg never hits.

Agg-awareness works through DAX the engine doesn't see literally: COUNTROWS hits a count agg; AVERAGE folds to SUM/COUNT and hits if both exist; time-intelligence hits only if the agg covers the grain it expands to (DATESYTD expands to day grain, so a month-grain agg misses); DISTINCTCOUNT can hit if the key is a GroupBy column. The load-bearing grain rule: an agg should be at least ~10x fewer rows than its detail or maintenance outweighs speedup ; strip high-cardinality attributes (lat/long, timestamps) from the GroupBy set. **Precedence** lets one subquery try a smaller/coarser agg first (higher `precedence` integer) and fall to a larger agg then the detail table; chained aggregations are illegal (`detailTable` must point at the real detail, never another agg).

`te` v0.2.0 has no `-q AlternateOf`, so this is the canonical `te script` fallback: build the scaffolding (agg table, hide it, set columns) with `te`-native verbs, then map via TOM (`new TOM.AlternateOf { Summarization = ..., BaseColumn = ... }`). Audit existing mappings and check the 10x ratio with `te query`. Verify hits at runtime via a trace (connect-pbid or DAX Studio) watching `Aggregate Table Rewrite Query` ; `te query` alone won't show cache-hit vs source. Rules `te` won't warn about: RLS must filter both agg and detail or the engine refuses to answer from the agg; inactive-relationship + USERELATIONSHIP for an agg hit is unsupported (use TREATAS); `detailTable` must be DirectQuery; max 3-table chains; `AlternateOf` needs compat >= 1460; Import aggs are ignored on SSO-enabled sources since Aug 2022; hybrid tables and Direct Lake (either flavor) do not support user-defined aggregations (pre-aggregate in the Lakehouse).

Sources: learn.microsoft.com aggregations-advanced (+ precedence); learn.microsoft.com composite-model-guidance; learn.microsoft.com SummarizationType / AlternateOf; learn.microsoft.com aggregations-auto
