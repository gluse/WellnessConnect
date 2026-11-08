# TASK-047 operating cost and recovery constraints

Prepared 8 November 2026 (Europe/Riga). Public-price research only; no project,
credential, billing-plan or resource access. Selected requirements:
**99.9% monthly availability**, **EUR 100–300/month operating budget**, worldwide
readiness with initial Latvia/EU launch. This is a comparison, not a selected
production topology or permission to spend.

## A small deployment is affordable; complete recovery needs explicit budgeting

The table models a separate production organization with two Supabase Micro
projects (application and audit) and two Lightsail Small container nodes. This is
an illustrative cost basket, not a claim that this capacity or failure-domain
placement meets the workload or availability target. Existing development and
staging costs are separate; no existing subscription/credits are assumed.

Public monthly inputs checked today:

- Lightsail Small container nodes: USD 15 each; service cost multiplies power by
  node count. [AWS pricing](https://aws.amazon.com/lightsail/pricing/),
  [container billing FAQ](https://aws.amazon.com/lightsail/faq/).
- Supabase Pro: USD 25 organization plan, two Micro projects at USD 10 each,
  minus USD 10 included compute credit: USD 35. Daily database backups are
  included. [Supabase pricing](https://supabase.com/pricing).
- Seven-day point-in-time recovery (PITR): approximately USD 100 per enabled
  project/month, billed hourly; it is not covered by the spend cap.
  [PITR usage and billing](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery).

PITR can currently be enabled on all compute sizes. Database backups omit stored
object bytes and custom-role passwords, so private images and credential recovery
need separate protection. These facts preclude treating the DB add-on as complete
application recovery. [Backup scope](https://supabase.com/docs/guides/platform/backups).

Calculations were executed with JavaScript using the public monthly inputs, not
estimated mentally. EUR conversions use the ECB's **6 November 2026 reference
rate: EUR 1 = USD 1.1165**. This is an indicative comparison, not a payment rate.
[ECB reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html).

| Recovery basket | Approx. USD/month subtotal | Indicative EUR/month subtotal | EUR remaining below 300 before excluded costs |
| --- | ---: | ---: | ---: |
| Two app nodes + two DB projects, daily DB backups | 65 | 58.22 | 241.78 |
| Same, PITR on application DB only | 165 | 147.78 | 152.22 |
| Same, PITR on both application and audit DBs | 265 | 237.35 | 62.65 |

Formula: `(25 + 2*10 - 10 + 2*15 + PITR add-ons) / 1.1165`.
PITR monthly amounts are advertised approximations; invoice totals vary with
billable hours and usage. No scenario is a complete production quote.

Excluded and still to cost: backup object storage/transfer and restore executor,
monitoring/probes/log ingestion/alerts, DNS/domain, transactional email/SMS,
Maps/AI calls, traffic/storage overages, additional worker/replica compute,
measured memory/CPU requirements, taxes, exchange fees and contingency.
Developer/store fees and existing development/staging are outside this production
basket. **No paid human 24/7 incident rota is included.** Named incident coverage
must be arranged and its cost treated separately if it is not supplied by owners.

The two-PITR basket leaves limited room within the selected cap. Selecting daily
backups to save cost changes potential data loss, rather than merely changing a
billing option. Availability target, maximum recoverable data loss and restore
time are separate requirements. No recovery policy has been selected here.

## Provider terms do not establish FitsMyTime's SLA

Supabase's published uptime agreement is for Enterprise customers specified in
an order form. Pro cannot be represented as providing that contractual uptime
coverage. Team support terms and Enterprise uptime are distinct.
[Supabase SLA](https://supabase.com/sla).

Inference: retaining lower-cost managed services can be evaluated for FitsMyTime's
99.9% objective, but it does not produce a matching vendor-backed end-to-end
guarantee. Terms, monitoring, failure recovery and ownership must substantiate any
promise made to customers. Buying two application nodes also does not establish
database/Auth/Storage failover, distinct-AZ placement or safe multi-instance state.

Do not recommend an apparent saving that drops the goal's SLA or app-store scope.
If the full selected requirements exceed EUR 300 after measured sizing, present
the complete shortfall and alternatives for user choice before provisioning.

## Production selection and execution still required

- CI/CD and DB: cost complete isolation, failure-domain placement, app/worker
  counts, bounded autoscaling, database/Auth/Storage capabilities and restore
  rehearsal using the selected workload and recovery objectives. Compare the
  portable managed-container path with a more explicit ECS/Fargate deployment
  after verifying current Stockholm pricing and project availability.
- Backend and DB: resolve instance-local search state and the five-total-login
  role budget before treating multiple nodes as a valid scale option. Preserve
  security checks; see [database review](worldwide-database-review.md).
- Service owner/user: choose acceptable RPO/RTO, incident coverage, SLA measurement
  and consequences. These are new service-policy choices, not inferred from the
  99.9% planning selection. Cost all enabled paid channels with real usage limits.
- Revalidate billing plan, service eligibility and exact resource costs before
  requesting named creation/upgrade operations. The previous AWS Free-plan and
  staging observations are historical; no current plan is asserted here. Selected
  Region remains `eu-north-1`; confirm it in AWS Settings > View all projects >
  Overview > Additional Info > Region before new Regional execution.

Tool limitation: required AWS skill-search/retrieval tools were absent from the
exposed tool catalog. Read installed `aws-billing-and-cost-management` and
`aws-containers` skills and relevant references, then used official public pages.
No AWS CLI/API call or deployment script was executed. This document supplies
public planning evidence; it does not close cloud/service execution gates.
