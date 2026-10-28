// Synthetic display data only. This is not an approved tariff or commercial policy.
export const billingTarget = { kind: "company", id: 42 };
export function billingStatus(overrides = {}) {
  return {
    target: billingTarget, state: "none", manualUntil: null, paidThrough: null,
    effectiveAccess: { hasPro: false, until: null }, cancelAtPeriodEnd: false, operation: "none", unavailableReason: null,
    capabilities: { checkout: true, manage: false, recover: false },
    offer: { amount: "12.34", currency: "EUR", interval: "month", taxDisclosure: "Synthetic tax disclosure", termsText: "Synthetic recurring terms. No real payment.", termsVersion: "fixture-v1", offerRevision: "00000000-0000-4000-8000-000000000001" },
    ...overrides,
  };
}
export function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
