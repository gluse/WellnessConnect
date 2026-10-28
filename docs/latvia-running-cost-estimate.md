# Latvia launch: subscribers needed for service bills

Prepared 22 October 2026. Read-only repository review and public pricing research;
no cloud account, invoices, database or live usage inspected. This is an estimate,
not an infrastructure capacity test, vendor quote or deployment plan.

## Direct answer

For a lean launch, budget **EUR 60-120/month** for the app's services and aim for
**10 retained, paying workspaces at EUR 19/month**. The arithmetic break-even is
about **4-7 subscriptions** before output VAT, or **4-8** if EUR 19 includes 21%
output VAT. Ten is a buffered launch target, not a guarantee at arbitrary traffic.

This estimates service bills only. It excludes owner salary, developer labour,
paid marketing, accounting/legal work, SMS, real booking-payment transaction fees,
refund/dispute losses and a high-availability/multi-region architecture. It is
different from the loaded-cost model in the [PM business plan](payment-business-plan.md).

## Price anchors and planning allowances

USD prices below remain in USD; the EUR budgets are rounded planning allowances
with contingency, not a claimed live currency conversion. Actual region, tax,
exchange rate and usage affect invoices. No temporary promotional credits used.

| Service | Verified price anchor | Lean monthly budget assumption |
| --- | --- | --- |
| Supabase | Pro starts at USD 25/month including compute credit covering one Micro project. Extra projects start at USD 10/month; larger compute/storage/egress can add cost. | EUR 25-45 depending on whether audit/staging projects are paid. |
| AWS hosting option | Lightsail Linux bundles with public IPv4 list USD 12/month for 2 GB RAM and USD 24 for 4 GB, including disk and transfer allowances. | EUR 15-35 including a small operational allowance; capacity is unverified. |
| Google Cloud hosting alternative | Cloud Run has usage-based CPU/memory/request billing and a free tier. Minimum instances, network egress, logs, build/artifact storage and separately running workers affect the bill. | EUR 20-50 planning reserve, not a fixed Cloud Run tariff. One host option, not both. |
| Google Maps/Geocoding | Dynamic Maps: first 10,000 billable events/month free, then USD 7/1,000 in the initial paid tier. Geocoding: first 10,000/month free, then USD 5/1,000 in that tier. Caps apply per SKU/billing account, including its other projects. | EUR 0 for the two covered SKUs while below their free caps; usage scenarios below. |
| Other services | Domain amortisation, transactional email, monitoring/snapshots and a small semantic-search API allowance. | EUR 10-25 assumed; no SMS, unusual email volume or AI workload included. |

The lean combined EUR 60-120 range allows some contingency across these ranges;
it is not a promise that every component's maximum fits inside it. With a separate
audit project, multiple staging projects, large images or always-on workers,
replace the allowances with the actual selected configuration.

Sources checked 22 October 2026:
[Supabase pricing](https://supabase.com/pricing),
[Supabase compute credits](https://supabase.com/docs/guides/platform/manage-your-usage/compute),
[AWS Lightsail pricing](https://aws.amazon.com/lightsail/pricing/),
[Cloud Run pricing](https://cloud.google.com/run/pricing),
[Google Maps SKU pricing](https://developers.google.com/maps/billing-and-pricing/pricing).

## How much of EUR 19 is available for the bills?

Assume standard EEA cards and the proposed Stripe pay-as-you-go Billing setup:

- Processing: 1.5% x EUR 19 + EUR 0.25 = EUR 0.535.
- Recurring Billing: 0.7% x EUR 19 = EUR 0.133.
- Available before output VAT and other costs: **EUR 18.332/subscription/month**.
- If EUR 19 includes 21% output VAT: 19/1.21 - 0.668 =
  **EUR 15.0345/subscription/month**.

The VAT case is conditional, not a determination of the operator's registration
or tax position. Where the advertised price is EUR 19 plus VAT, calculate charges
and processor fees on the actual collected amount instead. Compare costs on a
consistent basis and add any unrecoverable vendor taxes.

[Stripe Latvia processing](https://stripe.com/en-lv/pricing),
[Stripe Billing](https://stripe.com/en-lv/billing/pricing),
[VID VAT rate](https://www.vid.gov.lv/en/value-added-tax).

Formula: paying workspaces = round up(monthly service bills / net subscription
receipts available for those bills). Free providers, trials, failed payments and
cancelled subscribers do not count. Companies with several employees count as
one subscription if the price is per company workspace.

## Usage scenarios

These volumes are assumptions, not measured adoption or tested capacity. Map
loads are billable map initialisations, not unique visitors or bookings.
Provider count alone does not predict traffic: free visitors also generate costs.

| Scenario | Monthly Dynamic Maps / Geocoding events | Google cost, USD | Total service budget, EUR | Paying workspaces, no output VAT deducted | Paying workspaces, EUR 19 includes 21% VAT |
| --- | --- | ---: | ---: | ---: | ---: |
| Lean launch | 5,000 / 2,000 | 0 | 60-120 | 4-7 | 4-8 |
| Growing discovery traffic | 25,000 / 10,000 | 105 | 180-260 | 10-15 | 12-18 |
| Heavier map usage | 50,000 / 20,000 | 330 | 450-650 | 25-36 | 30-44 |

Google calculation: max(map loads - 10,000, 0)/1,000 x USD 7 plus
max(geocodes - 10,000, 0)/1,000 x USD 5, for these initial pricing tiers.
At higher volume use the appropriate tier schedule. Other Maps/Places SKUs are
not included. Total budgets assume modest app/database workloads at those volumes;
measure concurrency, query cost, images and egress before resizing infrastructure.

Repository evidence: `client/src/pages/home.tsx` conditionally mounts GoogleMap
when map view is selected; `client/src/components/google-map.tsx` initialises a
Dynamic Map; browser and server code perform geocoding. Registered-address caching
exists but is not assumed to eliminate customer address searches. Supabase serves
database/auth/storage; do not add an RDS/Cloud SQL database to the baseline for
the same role. Existing audit design has an independent database project and
worker, so include those if enabled for production. Semantic search also makes
external embedding calls; the small allowance is not a measured bill.

## Launch target and cost controls

At ten paying workspaces, EUR 190 gross yields about EUR 183.32 after the assumed
subscription fees, or EUR 150.34 after those fees and included 21% output VAT.
That covers the lean EUR 60-120 budget with some headroom. Target **15-20 retained
paying workspaces** as traffic grows, then recalculate using actual bills.

Use one EU-region app host near the selected Supabase region. Keep map loading
deliberate, monitor billable events per completed booking and preserve permitted
address reuse. Set service quotas alongside budget alerts; alerts alone are not
spend caps. Track fixed costs, per-user traffic and paid conversion separately.
No infrastructure changes or vendor commitments are made by this estimate.
