import { assertAuthority, assertBinding, authoritySchema, bindingSchema, BillingError, leaseSchema,
  snapshotSchema, type Authority, type Binding, type BillingSnapshot, type ReconciliationLease } from "./contracts";
import { invoiceCoverage, type Coverage, type InvoiceAccessPolicy } from "./coverage";

export interface ReconciliationRepository {
  /** Atomically claim a bounded lease and capture dirty generation + projection revision. */
  claim(binding: Binding, now: number): Promise<ReconciliationLease | null>;
  /** One transaction: full binding + unexpired lease token + generation/revision CAS;
   * replace invoice evidence, save paid-source coverage, bump revision, enqueue approved
   * audit, then mark work processed. Audit failure must roll back everything.
   * Manual-source projection/cutover requires separately approved combination policy. */
  commit(lease: ReconciliationLease, result: { snapshot: BillingSnapshot; coverage: Coverage; observedAt: number }): Promise<boolean>;
}
export interface ReconciliationProvider {
  fetch(lease: ReconciliationLease): Promise<unknown>;
}
export async function reconcileBilling(bindingInput: Binding, deps: {
  authority: Authority; offerReference: string; now(): number; policy: InvoiceAccessPolicy;
  repository: ReconciliationRepository; provider: ReconciliationProvider;
}): Promise<"idle" | "stale" | "committed"> {
  const binding = bindingSchema.parse(bindingInput);
  assertAuthority(binding, authoritySchema.parse(deps.authority));
  const claimed = await deps.repository.claim(binding, deps.now());
  if (!claimed) return "idle";
  const lease = leaseSchema.parse(claimed);
  assertBinding(lease.binding, binding);
  if (lease.expiresAt <= deps.now()) return "stale";
  // Network outside the workspace transaction. No browser payload can supply this snapshot.
  const snapshot = snapshotSchema.parse(await deps.provider.fetch(lease));
  assertBinding(snapshot.binding, binding);
  // Existing contracts keep their own immutable offer when Administration publishes another price.
  if (snapshot.processorSubscriptionId !== lease.processorSubscriptionId || snapshot.requestedOffer !== (lease.offerReference ?? deps.offerReference))
    throw new BillingError("BINDING_MISMATCH");
  const observedAt = deps.now();
  if (lease.expiresAt <= observedAt) return "stale";
  const coverage = invoiceCoverage(snapshot.invoices, observedAt, deps.policy);
  return await deps.repository.commit(lease, { snapshot, coverage, observedAt }) ? "committed" : "stale";
}
