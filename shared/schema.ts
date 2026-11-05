import {
  pgTable,
  text,
  varchar,
  timestamp,
  date,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  doublePrecision,
  primaryKey,
  uniqueIndex,
  check,
  uuid,
  foreignKey,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { CURRENCY_DIGITS, SUPPORTED_CURRENCIES, SUPPORTED_COUNTRIES, isSupportedCurrency } from "./currencies";

// Use unconstrained exact numeric plus explicit checks. numeric(p,s) would round
// excess input precision before CHECK constraints get a chance to reject it.
const codeLiterals = (codes: readonly string[]) => sql.join(codes.map(code => {
  if (!/^[A-Z]{2,3}$/.test(code)) throw new Error("Invalid static country/currency code");
  return sql.raw(`'${code}'`);
}), sql`, `);
const currencyCodeCheck = (currency: AnyPgColumn) => sql`${currency} IN (${codeLiterals(SUPPORTED_CURRENCIES)})`;
const moneyAmountCheck = (amount: AnyPgColumn, currency: AnyPgColumn) => {
  const zero = SUPPORTED_CURRENCIES.filter(code => CURRENCY_DIGITS[code] === 0);
  const three = SUPPORTED_CURRENCIES.filter(code => CURRENCY_DIGITS[code] === 3);
  return sql`${amount} >= 0 AND ${amount} <= 99999999.99 AND ${amount} = trunc(${amount}, CASE WHEN ${currency} IN (${codeLiterals(zero)}) THEN 0 WHEN ${currency} IN (${codeLiterals(three)}) THEN 3 ELSE 2 END)`;
};
const currencyInput = z.string().refine(isSupportedCurrency, "Choose a supported currency.");
const countryInput = z.string().refine(value => SUPPORTED_COUNTRIES.some(country => country === value), "Choose a supported country.");

// Express session storage for Supabase authentication.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
).enableRLS();

// Application profiles keyed by Supabase Auth user IDs.
export const accountDetailsSchema = z.object({
  firstName: z.string().trim().max(100, "Name must be 100 characters or fewer."),
  lastName: z.string().trim().max(100, "Surname must be 100 characters or fewer."),
}).strict();

export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  currentRole: varchar("current_role", { enum: ["seeker", "provider"] }).default("seeker"),
  providerType: varchar("provider_type", { enum: ["individual", "company"] }).notNull().default("individual"),
  companyName: varchar("company_name", { length: 150 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}).enableRLS();

// Separate from users so private search coordinates never enter provider payloads.
export const userSearchLocations = pgTable("user_search_locations", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  source: varchar("source", { enum: ["device", "address"] }).notNull(),
  inputText: varchar("input_text", { length: 300 }),
  placeId: varchar("place_id", { length: 512 }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [check("search_location_shape", sql`(
  (${table.source} = 'device' AND ${table.inputText} IS NULL AND ${table.placeId} IS NULL
    AND ${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL
    AND ${table.latitude} BETWEEN -90 AND 90 AND ${table.longitude} BETWEEN -180 AND 180)
  OR (${table.source} = 'address' AND ${table.inputText} IS NOT NULL
    AND length(trim(${table.inputText})) BETWEEN 1 AND 300
    AND ${table.latitude} IS NULL AND ${table.longitude} IS NULL
    AND (${table.placeId} IS NULL OR length(trim(${table.placeId})) > 0)))`)]).enableRLS();

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  // Stable legacy billing/storage anchor; ownership can transfer independently.
  providerId: varchar("provider_id").references(() => users.id).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}).enableRLS();

// A subscription belongs to a workspace, so company ownership can transfer.
export const providerSubscriptions = pgTable("provider_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).unique(),
  companyId: integer("company_id").references(() => companies.id).unique(),
  plan: varchar("plan", { enum: ["free", "pro"] }).notNull().default("free"),
  proUntil: timestamp("pro_until", { withTimezone: true }),
  updatedBy: varchar("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check("subscription_workspace_check", sql`(${table.userId} IS NOT NULL) <> (${table.companyId} IS NOT NULL)`),
  check("subscription_plan_check", sql`${table.plan} IN ('free', 'pro') AND (${table.plan} <> 'pro' OR ${table.proUntil} IS NOT NULL)`),
]).enableRLS();

export const storefronts = pgTable("storefronts", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => providerSubscriptions.id).unique(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description").notNull().default(""),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  isPublished: boolean("is_published").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export type ProviderSubscription = typeof providerSubscriptions.$inferSelect;
export type Storefront = typeof storefronts.$inferSelect;

// TASK-024 choice 2: dormant expansion only. These source records do not grant
// Pro or replace the existing manually administered entitlement writer.
const billingScope = () => ({
  workspaceId: integer("workspace_id").notNull().references(() => providerSubscriptions.id),
  provider: varchar("provider", { length: 64 }).notNull(),
  merchantAccount: varchar("merchant_account", { length: 255 }).notNull(),
  mode: varchar("mode", { length: 4, enum: ["test", "live"] }).notNull(),
});
const billingTimes = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Local catalog revisions are immutable; changing the pointer affects NEW
// subscriptions only. Stripe price creation is a separate durable operation.
export const billingOfferRevisions = pgTable("billing_offer_revisions", {
  id: uuid("id").primaryKey(),
  version: integer("version").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
  interval: varchar("interval", { length: 5 }).notNull().default("month"),
  taxIncluded: boolean("tax_included").notNull().default(true),
  issuedBy: varchar("issued_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("billing_offer_version").on(table.version),
  check("billing_offer_shape", sql`${table.version} > 0 AND ${table.amountMinor} > 0 AND ${table.currency} = 'EUR' AND ${table.interval} = 'month' AND ${table.taxIncluded} AND (${table.issuedBy} IS NOT NULL OR ${table.version} = 1)`),
]).enableRLS();

export const billingOfferSettings = pgTable("billing_offer_settings", {
  singleton: boolean("singleton").primaryKey().default(true),
  currentOfferId: uuid("current_offer_id").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  foreignKey({ name: "billing_offer_settings_current_offer_fk", columns: [table.currentOfferId], foreignColumns: [billingOfferRevisions.id] }),
  check("billing_offer_settings_shape", sql`${table.singleton} AND ${table.revision} > 0 AND (${table.updatedBy} IS NOT NULL OR ${table.revision} = 1)`),
]).enableRLS();

export const billingPriceMappings = pgTable("billing_price_mappings", {
  id: uuid("id").primaryKey(),
  offerId: uuid("offer_id").notNull().references(() => billingOfferRevisions.id),
  provider: varchar("provider", { length: 64 }).notNull(),
  merchantAccount: varchar("merchant_account", { length: 255 }).notNull(),
  mode: varchar("mode", { length: 4, enum: ["test", "live"] }).notNull(),
  processorPriceId: varchar("processor_price_id", { length: 255 }),
  state: varchar("state", { enum: ["reserved", "unknown", "ready"] }).notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  ...billingTimes(),
}, table => [
  uniqueIndex("billing_price_offer_scope").on(table.offerId, table.provider, table.merchantAccount, table.mode),
  uniqueIndex("billing_price_remote_identity").on(table.provider, table.merchantAccount, table.mode, table.processorPriceId),
  unique("billing_price_binding").on(table.id, table.offerId, table.provider, table.merchantAccount, table.mode),
  check("billing_price_shape", sql`${table.provider} = 'stripe' AND length(trim(${table.merchantAccount})) > 0 AND ${table.mode} IN ('test','live') AND ${table.state} IN ('reserved','unknown','ready') AND ${table.fingerprint} ~ '^[a-f0-9]{64}$' AND ((${table.state} = 'ready') = (${table.processorPriceId} IS NOT NULL)) AND (${table.processorPriceId} IS NULL OR length(trim(${table.processorPriceId})) > 0)`),
]).enableRLS();

export const billingSourceState = pgTable("billing_source_state", {
  workspaceId: integer("workspace_id").primaryKey().references(() => providerSubscriptions.id),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull(),
  revision: integer("revision").notNull().default(0),
}, table => [check("billing_source_revision", sql`${table.revision} >= 0`)]).enableRLS();

export const billingAccounts = pgTable("billing_accounts", {
  id: uuid("id").primaryKey(),
  ...billingScope(),
  customerId: varchar("customer_id", { length: 255 }),
  ...billingTimes(),
}, table => [
  uniqueIndex("billing_account_workspace_scope").on(table.workspaceId, table.provider, table.merchantAccount, table.mode),
  uniqueIndex("billing_account_customer_identity").on(table.provider, table.merchantAccount, table.mode, table.customerId),
  unique("billing_account_binding").on(table.id, table.workspaceId, table.provider, table.merchantAccount, table.mode),
  check("billing_account_shape", sql`${table.mode} IN ('test','live') AND length(trim(${table.provider})) > 0 AND length(trim(${table.merchantAccount})) > 0 AND (${table.customerId} IS NULL OR length(trim(${table.customerId})) > 0)`),
]).enableRLS();

export const billingSubscriptions = pgTable("billing_subscriptions", {
  id: uuid("id").primaryKey(),
  ...billingScope(),
  accountId: uuid("account_id").notNull(),
  processorSubscriptionId: varchar("processor_subscription_id", { length: 255 }).notNull(),
  state: varchar("state", { enum: ["pending", "running", "attention", "ended"] }).notNull(),
  processorStatus: varchar("processor_status", { length: 64 }).notNull(),
  approvedOfferRef: varchar("approved_offer_ref", { length: 255 }).notNull(),
  offerRevisionId: uuid("offer_revision_id"),
  priceMappingId: uuid("price_mapping_id"),
  currency: varchar("currency", { length: 3 }).notNull(),
  interval: varchar("interval", { length: 5 }).notNull().default("month"),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  paidThrough: timestamp("paid_through", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  generation: integer("generation").notNull().default(0),
  revision: integer("revision").notNull().default(0),
  leaseToken: uuid("lease_token"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
  nextReconcileAt: timestamp("next_reconcile_at", { withTimezone: true }),
  ...billingTimes(),
}, table => [
  foreignKey({ name: "billing_subscription_account_binding", columns: [table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingAccounts.id, billingAccounts.workspaceId, billingAccounts.provider, billingAccounts.merchantAccount, billingAccounts.mode] }),
  foreignKey({ name: "billing_subscription_offer_revision_fk", columns: [table.offerRevisionId], foreignColumns: [billingOfferRevisions.id] }),
  foreignKey({ name: "billing_subscription_price_binding", columns: [table.priceMappingId, table.offerRevisionId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingPriceMappings.id, billingPriceMappings.offerId, billingPriceMappings.provider, billingPriceMappings.merchantAccount, billingPriceMappings.mode] }),
  check("billing_subscription_offer_binding", sql`${table.priceMappingId} IS NULL OR ${table.offerRevisionId} IS NOT NULL`),
  uniqueIndex("billing_subscription_identity").on(table.provider, table.merchantAccount, table.mode, table.processorSubscriptionId),
  unique("billing_subscription_binding").on(table.id, table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode),
  uniqueIndex("billing_subscription_workspace_slot").on(table.workspaceId, table.mode).where(sql`${table.state} <> 'ended'`),
  index("billing_subscription_due").on(table.nextReconcileAt),
  check("billing_subscription_shape", sql`${table.mode} IN ('test','live') AND ${table.state} IN ('pending','running','attention','ended') AND ${table.currency} = 'EUR' AND ${table.interval} = 'month' AND length(trim(${table.processorSubscriptionId})) > 0 AND length(trim(${table.processorStatus})) > 0 AND length(trim(${table.approvedOfferRef})) > 0 AND ${table.generation} >= 0 AND ${table.revision} >= 0 AND ((${table.periodStart} IS NULL AND ${table.periodEnd} IS NULL) OR (${table.periodStart} IS NOT NULL AND ${table.periodEnd} IS NOT NULL AND ${table.periodEnd} > ${table.periodStart})) AND ((${table.leaseToken} IS NULL) = (${table.leaseUntil} IS NULL))`),
]).enableRLS();

export const billingInvoices = pgTable("billing_invoices", {
  id: uuid("id").primaryKey(),
  ...billingScope(),
  accountId: uuid("account_id").notNull(),
  subscriptionId: uuid("subscription_id").notNull(),
  processorInvoiceId: varchar("processor_invoice_id", { length: 255 }).notNull(),
  status: varchar("status", { enum: ["paid", "unpaid", "reversed"] }).notNull(),
  processorStatus: varchar("processor_status", { length: 64 }),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  amountDue: decimal("amount_due", { precision: 18, scale: 0 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 18, scale: 0 }).notNull(),
  amountRefunded: decimal("amount_refunded", { precision: 18, scale: 0 }).notNull().default("0"),
  paymentReference: varchar("payment_reference", { length: 255 }),
  refundReferences: varchar("refund_references", { length: 255 }).array().notNull().default(sql`ARRAY[]::varchar(255)[]`),
  disputeReferences: varchar("dispute_references", { length: 255 }).array().notNull().default(sql`ARRAY[]::varchar(255)[]`),
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }).notNull(),
  ...billingTimes(),
}, table => [
  foreignKey({ name: "billing_invoice_subscription_binding", columns: [table.subscriptionId, table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingSubscriptions.id, billingSubscriptions.accountId, billingSubscriptions.workspaceId, billingSubscriptions.provider, billingSubscriptions.merchantAccount, billingSubscriptions.mode] }),
  uniqueIndex("billing_invoice_identity").on(table.provider, table.merchantAccount, table.mode, table.processorInvoiceId),
  index("billing_invoice_coverage").on(table.subscriptionId, table.periodStart, table.periodEnd),
  check("billing_invoice_shape", sql`${table.mode} IN ('test','live') AND ${table.status} IN ('paid','unpaid','reversed') AND ${table.currency} = 'EUR' AND length(trim(${table.processorInvoiceId})) > 0 AND ${table.periodEnd} > ${table.periodStart} AND ${table.amountDue} >= 0 AND ${table.amountPaid} >= 0 AND ${table.amountRefunded} >= 0 AND ${table.amountRefunded} <= ${table.amountPaid} AND cardinality(${table.refundReferences}) <= 100 AND cardinality(${table.disputeReferences}) <= 100 AND array_position(${table.refundReferences}, NULL) IS NULL AND array_position(${table.disputeReferences}, NULL) IS NULL AND array_position(${table.refundReferences}, '') IS NULL AND array_position(${table.disputeReferences}, '') IS NULL`),
]).enableRLS();

export const billingOperations = pgTable("billing_operations", {
  id: uuid("id").primaryKey(),
  ...billingScope(),
  accountId: uuid("account_id").notNull(),
  kind: varchar("kind", { enum: ["checkout", "portal", "cancel", "reconcile"] }).notNull(),
  initiatorId: varchar("initiator_id").references(() => users.id),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  approvedOfferRef: varchar("approved_offer_ref", { length: 255 }),
  offerRevisionId: uuid("offer_revision_id"),
  priceMappingId: uuid("price_mapping_id"),
  termsVersion: varchar("terms_version", { length: 128 }),
  state: varchar("state", { enum: ["reserved", "unknown", "completed", "failed"] }).notNull(),
  remoteCheckoutId: varchar("remote_checkout_id", { length: 255 }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  failureCode: varchar("failure_code", { length: 64 }),
  ...billingTimes(),
}, table => [
  foreignKey({ name: "billing_operation_account_binding", columns: [table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingAccounts.id, billingAccounts.workspaceId, billingAccounts.provider, billingAccounts.merchantAccount, billingAccounts.mode] }),
  foreignKey({ name: "billing_operation_offer_revision_fk", columns: [table.offerRevisionId], foreignColumns: [billingOfferRevisions.id] }),
  foreignKey({ name: "billing_operation_price_binding", columns: [table.priceMappingId, table.offerRevisionId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingPriceMappings.id, billingPriceMappings.offerId, billingPriceMappings.provider, billingPriceMappings.merchantAccount, billingPriceMappings.mode] }),
  check("billing_operation_offer_binding", sql`${table.priceMappingId} IS NULL OR ${table.offerRevisionId} IS NOT NULL`),
  unique("billing_operation_binding").on(table.id, table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode),
  uniqueIndex("billing_operation_idempotency").on(table.workspaceId, table.mode, table.kind, table.idempotencyKey),
  uniqueIndex("billing_checkout_workspace_slot").on(table.workspaceId, table.mode).where(sql`${table.kind} = 'checkout' AND ${table.resolvedAt} IS NULL`),
  check("billing_operation_shape", sql`${table.mode} IN ('test','live') AND ${table.kind} IN ('checkout','portal','cancel','reconcile') AND ${table.state} IN ('reserved','unknown','completed','failed') AND ${table.fingerprint} ~ '^[a-f0-9]{64}$' AND length(trim(${table.idempotencyKey})) > 0 AND (${table.kind} = 'reconcile' OR ${table.initiatorId} IS NOT NULL) AND (${table.kind} <> 'checkout' OR (${table.approvedOfferRef} IS NOT NULL AND length(trim(${table.approvedOfferRef})) > 0 AND ${table.termsVersion} IS NOT NULL AND length(trim(${table.termsVersion})) > 0)) AND (${table.kind} <> 'checkout' OR ${table.state} <> 'completed' OR (${table.remoteCheckoutId} IS NOT NULL AND length(trim(${table.remoteCheckoutId})) > 0))`),
]).enableRLS();

export const billingEvents = pgTable("billing_events", {
  id: uuid("id").primaryKey(),
  provider: varchar("provider", { length: 64 }).notNull(),
  merchantAccount: varchar("merchant_account", { length: 255 }).notNull(),
  mode: varchar("mode", { length: 4, enum: ["test", "live"] }).notNull(),
  accountId: uuid("account_id"),
  workspaceId: integer("workspace_id"),
  operationId: uuid("operation_id"),
  eventId: varchar("event_id", { length: 255 }).notNull(),
  eventType: varchar("event_type", { length: 128 }).notNull(),
  objectId: varchar("object_id", { length: 255 }).notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  state: varchar("state", { enum: ["pending", "processing", "processed", "quarantined"] }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  leaseToken: uuid("lease_token"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  failureCode: varchar("failure_code", { length: 64 }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, table => [
  foreignKey({ name: "billing_event_account_binding", columns: [table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingAccounts.id, billingAccounts.workspaceId, billingAccounts.provider, billingAccounts.merchantAccount, billingAccounts.mode] }),
  foreignKey({ name: "billing_event_operation_binding", columns: [table.operationId, table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingOperations.id, billingOperations.accountId, billingOperations.workspaceId, billingOperations.provider, billingOperations.merchantAccount, billingOperations.mode] }),
  uniqueIndex("billing_event_identity").on(table.provider, table.merchantAccount, table.mode, table.eventId),
  index("billing_event_pending").on(table.nextAttemptAt).where(sql`${table.state} IN ('pending','processing')`),
  check("billing_event_shape", sql`${table.mode} IN ('test','live') AND length(trim(${table.provider})) > 0 AND length(trim(${table.merchantAccount})) > 0 AND length(trim(${table.eventId})) > 0 AND length(trim(${table.eventType})) > 0 AND length(trim(${table.objectId})) > 0 AND ${table.fingerprint} ~ '^[a-f0-9]{64}$' AND ${table.state} IN ('pending','processing','processed','quarantined') AND ${table.attempts} >= 0 AND ((${table.accountId} IS NULL) = (${table.workspaceId} IS NULL)) AND (${table.operationId} IS NULL OR ${table.accountId} IS NOT NULL) AND ((${table.leaseToken} IS NULL) = (${table.leaseUntil} IS NULL)) AND ((${table.state} = 'processed') = (${table.processedAt} IS NOT NULL)) AND (${table.state} <> 'processed' OR ${table.accountId} IS NOT NULL)`),
]).enableRLS();

export const manualProGrants = pgTable("manual_pro_grants", {
  id: uuid("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => providerSubscriptions.id),
  source: varchar("source", { enum: ["legacy_manual", "administrator"] }).notNull(),
  sourceReference: varchar("source_reference", { length: 255 }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  issuedBy: varchar("issued_by").references(() => users.id),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  // Preserve the original unbounded updated_by value without truncating it.
  legacyUpdatedBy: varchar("legacy_updated_by"),
  legacyUpdatedAt: timestamp("legacy_updated_at", { withTimezone: true }),
  reasonCode: varchar("reason_code", { length: 64 }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: varchar("revoked_by").references(() => users.id),
}, table => [
  uniqueIndex("manual_pro_grant_source").on(table.workspaceId, table.source, table.sourceReference),
  index("manual_pro_grant_coverage").on(table.workspaceId, table.startsAt, table.endsAt),
  check("manual_pro_grant_shape", sql`${table.source} IN ('legacy_manual','administrator') AND length(trim(${table.sourceReference})) > 0 AND ${table.endsAt} > ${table.startsAt} AND (${table.source} <> 'administrator' OR ${table.issuedBy} IS NOT NULL) AND (${table.revokedBy} IS NULL OR ${table.revokedAt} IS NOT NULL)`),
]).enableRLS();

export type BillingAccount = typeof billingAccounts.$inferSelect;
export type BillingSubscription = typeof billingSubscriptions.$inferSelect;
export type BillingInvoice = typeof billingInvoices.$inferSelect;
export type BillingOperation = typeof billingOperations.$inferSelect;
export type BillingEvent = typeof billingEvents.$inferSelect;
export type ManualProGrant = typeof manualProGrants.$inferSelect;
export type BillingOfferRevision = typeof billingOfferRevisions.$inferSelect;
export type BillingOfferSettings = typeof billingOfferSettings.$inferSelect;
export type BillingPriceMapping = typeof billingPriceMappings.$inferSelect;
export type BillingSourceState = typeof billingSourceState.$inferSelect;

// Employees may be linked to a login through a company membership.
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  name: varchar("name", { length: 100 }).notNull(),
  showName: boolean("show_name").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("employees_provider_idx").on(table.providerId)]).enableRLS();

export const companyRoles = ["owner", "admin", "provider", "viewer"] as const;
export type CompanyRole = typeof companyRoles[number];
export const companyMemberships = pgTable("company_memberships", {
  companyId: integer("company_id").references(() => companies.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: varchar("role", { enum: companyRoles }).notNull(),
  employeeId: integer("employee_id").references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow(),
}, table => [primaryKey({ columns: [table.companyId, table.userId] }), uniqueIndex("company_memberships_employee_idx").on(table.employeeId)]).enableRLS();

export const companyInvitations = pgTable("company_invitations", {
  id: varchar("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  email: varchar("email").notNull(),
  role: varchar("role", { enum: ["admin", "provider", "viewer"] }).notNull(),
  employeeId: integer("employee_id").references(() => employees.id),
  tokenHash: varchar("token_hash").notNull().unique(),
  invitedBy: varchar("invited_by").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  revokedAt: timestamp("revoked_at"),
}).enableRLS();

export const categories = pgTable("categories", {
  key: varchar("key", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 16 }).notNull().default(""),
  searchKeywords: text("search_keywords").notNull().default(""),
}, table => [uniqueIndex("categories_name_idx").on(sql`lower(${table.name})`)]).enableRLS();
export type Category = typeof categories.$inferSelect;

// Locations are saved once per personal or company workspace.
export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  address: text("address"),
  countryCode: varchar("country_code", { length: 2 }),
  locationSource: varchar("location_source", { enum: ["legacy", "manual", "google"] }).notNull().default("legacy"),
  locationKey: varchar("location_key"),
  locationPlaceId: text("location_place_id"),
  locationExpiresAt: timestamp("location_expires_at", { withTimezone: true }),
  locationAddressSource: varchar("location_address_source", { enum: ["user", "google"] }).notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, table => [index("addresses_workspace_idx").on(table.providerId, table.companyId),
  index("addresses_google_expiry_idx").on(table.locationExpiresAt).where(sql`${table.locationSource} = 'google'`),
  check("addresses_country_code_check", sql`${table.countryCode} IS NULL OR ${table.countryCode} IN (${codeLiterals(SUPPORTED_COUNTRIES)})`)]).enableRLS();
export type Address = typeof addresses.$inferSelect;
export type AddressLocation = Pick<Address, "address" | "countryCode" | "latitude" | "longitude" | "locationSource" | "locationKey" | "locationPlaceId" | "locationExpiresAt" | "locationAddressSource">;
export const addressInputSchema = createInsertSchema(addresses, {
  address: z.string().trim().min(5).max(500),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  countryCode: countryInput.nullable().optional(),
}).pick({ address: true, latitude: true, longitude: true, countryCode: true });

// Services table
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  employeeId: integer("employee_id").references(() => employees.id),
  addressId: integer("address_id").references(() => addresses.id),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").notNull().references(() => categories.key),
  serviceType: varchar("service_type", { enum: ["one_to_one", "group"] }).notNull(),
  price: decimal("price").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  duration: integer("duration").notNull(), // in minutes
  cleanupTime: integer("cleanup_time").notNull().default(0), // Extra minutes after the service
  maxCapacity: integer("max_capacity").default(1),
  ageGroups: jsonb("age_groups").$type<string[]>().default([]), // ["children", "teens", "adults", "seniors"]
  targetGender: varchar("target_gender", { enum: ["females", "males", "both"] }).default("both"),
  instantBooking: boolean("instant_booking").default(false),
  advancePaymentPercent: integer("advance_payment_percent").default(50),
  imageUrl: text("image_url"),
  externalUrl: text("external_url"),
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  reminderMethod: varchar("reminder_method", { enum: ["email", "sms", "whatsapp"] }).notNull().default("email"),
  reminderHours: integer("reminder_hours").notNull().default(24),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, table => [index("services_address_idx").on(table.addressId), index("services_category_idx").on(table.category), check("services_cleanup_time_check", sql`${table.cleanupTime} BETWEEN 0 AND 1440`),
  check("services_reminder_settings_check", sql`${table.reminderMethod} IN ('email','sms','whatsapp') AND ${table.reminderHours} BETWEEN 1 AND 168`),
  check("services_currency_check", currencyCodeCheck(table.currency)),
  check("services_advance_percent_check", sql`${table.advancePaymentPercent} IS NULL OR (${table.advancePaymentPercent} >= 0 AND ${table.advancePaymentPercent} <= 100)`),
  check("services_price_money_check", moneyAmountCheck(table.price, table.currency))]).enableRLS();

// Only accepted Google coordinates, never Google's formatted address or response.
// Place IDs may survive coordinate expiry; the key hashes the user's address.
export const geocodingCache = pgTable("geocoding_cache", {
  addressKey: varchar("address_key").primaryKey(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  placeId: text("place_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}).enableRLS();

// Bookings table
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  seekerId: varchar("seeker_id").references(() => users.id).notNull(),
  providerId: varchar("provider_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  // Snapshot the assigned employee so editing a listing does not move existing bookings.
  employeeId: integer("employee_id").references(() => employees.id),
  participantCount: integer("participant_count").default(1),
  scheduledDate: timestamp("scheduled_date").notNull(),
  bookingDuration: integer("booking_duration"), // Duration in minutes for this specific booking
  bookingCleanupTime: integer("booking_cleanup_time").notNull().default(0), // Snapshot; listing edits do not change reservations
  status: varchar("status", { enum: ["pending", "confirmed", "cancelled", "completed"] }).default("pending"),
  closedAt: timestamp("closed_at", { withTimezone: true }), // Terminal transition snapshot; payment updates must not extend history retention.
  totalAmount: decimal("total_amount").notNull(),
  advanceAmount: decimal("advance_amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  paymentStatus: varchar("payment_status", { enum: ["pending", "advance_paid", "fully_paid"] }).default("pending"),
  notes: text("notes"),
  notificationRevision: integer("notification_revision").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("bookings_employee_date_idx").on(table.employeeId, table.scheduledDate), check("bookings_cleanup_time_check", sql`${table.bookingCleanupTime} BETWEEN 0 AND 1440`),
  index("bookings_message_retention_idx").on(table.closedAt, table.id).where(sql`${table.closedAt} IS NOT NULL AND ${table.status} IN ('cancelled','completed')`),
  check("bookings_notification_revision_check", sql`${table.notificationRevision} >= 0`),
  check("bookings_closed_at_check", sql`${table.closedAt} IS NULL OR ${table.status} IN ('cancelled','completed')`),
  check("bookings_currency_check", currencyCodeCheck(table.currency)),
  check("bookings_total_money_check", moneyAmountCheck(table.totalAmount, table.currency)),
  check("bookings_advance_money_check", sql`${moneyAmountCheck(table.advanceAmount, table.currency)} AND ${table.advanceAmount} <= ${table.totalAmount}`)]).enableRLS();

// Private booking conversations and agreement requests. Only the server runtime
// accesses these; booking/workspace authorization is checked per operation.
export const bookingMessages = pgTable("booking_messages", {
  id: uuid("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  authorRole: varchar("author_role", { enum: ["provider", "customer"] }).notNull(),
  body: text("body").notNull(),
  clientRequestId: uuid("client_request_id").notNull(),
  broadcastId: uuid("broadcast_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("booking_message_request_identity").on(table.authorId, table.clientRequestId, table.bookingId),
  index("booking_message_history_idx").on(table.bookingId, table.createdAt, table.id),
  index("booking_message_broadcast_idx").on(table.broadcastId).where(sql`${table.broadcastId} IS NOT NULL`),
  check("booking_message_shape", sql`${table.authorRole} IN ('provider','customer') AND length(trim(${table.body})) BETWEEN 1 AND 4000 AND length(${table.body}) <= 4000 AND (${table.broadcastId} IS NULL OR ${table.authorRole} = 'provider')`),
]).enableRLS();

export const bookingRescheduleRequests = pgTable("booking_reschedule_requests", {
  id: uuid("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  requestedById: varchar("requested_by_id").notNull().references(() => users.id),
  requestedByRole: varchar("requested_by_role", { enum: ["provider", "customer"] }).notNull(),
  originalScheduledDate: timestamp("original_scheduled_date", { withTimezone: true }).notNull(),
  proposedScheduledDate: timestamp("proposed_scheduled_date", { withTimezone: true }).notNull(),
  fallback: varchar("fallback", { enum: ["keep_original", "cancel_booking"] }).notNull(),
  state: varchar("state", { enum: ["pending", "accepted", "declined", "withdrawn", "superseded"] }).notNull().default("pending"),
  batchId: uuid("batch_id"),
  clientRequestId: uuid("client_request_id").notNull(),
  note: text("note"),
  timezone: varchar("timezone", { length: 100 }).notNull().default("UTC"),
  baseRevision: integer("base_revision").notNull(),
  respondedById: varchar("responded_by_id").references(() => users.id),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("booking_reschedule_pending_identity").on(table.bookingId).where(sql`${table.state} = 'pending'`),
  uniqueIndex("booking_reschedule_request_identity").on(table.requestedById, table.clientRequestId, table.bookingId),
  index("booking_reschedule_history_idx").on(table.bookingId, table.createdAt, table.id),
  index("booking_reschedule_batch_idx").on(table.batchId).where(sql`${table.batchId} IS NOT NULL`),
  check("booking_reschedule_shape", sql`${table.requestedByRole} IN ('provider','customer') AND ${table.fallback} IN ('keep_original','cancel_booking') AND ${table.state} IN ('pending','accepted','declined','withdrawn','superseded') AND ${table.baseRevision} >= 0 AND length(trim(${table.timezone})) BETWEEN 1 AND 100 AND (${table.note} IS NULL OR length(${table.note}) <= 2000) AND ${table.originalScheduledDate} <> ${table.proposedScheduledDate} AND (${table.batchId} IS NULL OR ${table.requestedByRole} = 'provider')`),
  check("booking_reschedule_response_shape", sql`(${table.state} <> 'pending' OR (${table.respondedAt} IS NULL AND ${table.respondedById} IS NULL)) AND ((${table.state} <> 'accepted' AND ${table.state} <> 'declined') OR (${table.respondedAt} IS NOT NULL AND ${table.respondedById} IS NOT NULL)) AND (${table.respondedAt} IS NULL OR ${table.respondedAt} >= ${table.createdAt})`),
]).enableRLS();

export type BookingMessage = typeof bookingMessages.$inferSelect;

// One implicit private wishlist belongs to each account, across all role/workspace
// contexts. No container row, public saver list or copied service content is needed.
export const wishlistServices = pgTable("wishlist_services", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.userId, table.serviceId] }),
  index("wishlist_user_saved_idx").on(table.userId, table.savedAt.desc(), table.serviceId.desc()),
  index("wishlist_service_idx").on(table.serviceId),
]).enableRLS();

// Private transactional source/outbox, separate from security auditing and external
// notification delivery. Wishlist identities survive unsave for at most 90 days to
// deduplicate a user's additions within a UTC day; providers receive aggregates.
export const productActivityEvents = pgTable("product_activity_events", {
  id: uuid("id").primaryKey(),
  kind: varchar("kind", { enum: ["wishlist_additions", "service_views"] }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  reportingDay: date("reporting_day", { mode: "string" }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, table => [
  uniqueIndex("product_wishlist_daily_identity").on(table.userId, table.serviceId, table.reportingDay).where(sql`${table.kind} = 'wishlist_additions'`),
  index("product_activity_pending_idx").on(table.reportingDay, table.occurredAt, table.id).where(sql`${table.processedAt} IS NULL`),
  index("product_activity_expiry_idx").on(table.expiresAt),
  index("product_activity_user_idx").on(table.userId),
  index("product_activity_service_idx").on(table.serviceId),
  index("product_activity_provider_idx").on(table.providerId),
  index("product_activity_company_idx").on(table.companyId),
  check("product_activity_shape", sql`${table.kind} IN ('wishlist_additions','service_views') AND (${table.kind} <> 'wishlist_additions' OR ${table.userId} IS NOT NULL) AND ${table.reportingDay} = (${table.occurredAt} AT TIME ZONE 'UTC')::date AND ${table.expiresAt} > ${table.occurredAt} AND ${table.expiresAt} <= ${table.occurredAt} + '2160:00:00'::interval AND (${table.processedAt} IS NULL OR ${table.processedAt} >= ${table.occurredAt})`),
]).enableRLS();

export const serviceActivityGroups = pgTable("service_activity_groups", {
  id: uuid("id").primaryKey(),
  kind: varchar("kind", { enum: ["wishlist_additions", "service_views"] }).notNull(),
  serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  scopeKey: varchar("scope_key").notNull(),
  reportingDay: date("reporting_day", { mode: "string" }).notNull(),
  count: integer("count").notNull().default(1),
  revision: integer("revision").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [
  uniqueIndex("service_activity_group_identity").on(table.kind, table.serviceId, table.reportingDay, table.scopeKey),
  index("service_activity_scope_day_idx").on(table.scopeKey, table.reportingDay.desc(), table.id.desc()),
  index("service_activity_group_expiry_idx").on(table.expiresAt),
  index("service_activity_group_service_idx").on(table.serviceId),
  index("service_activity_group_provider_idx").on(table.providerId),
  index("service_activity_group_company_idx").on(table.companyId),
  check("service_activity_group_shape", sql`${table.kind} IN ('wishlist_additions','service_views') AND ${table.count} > 0 AND ${table.revision} > 0 AND ${table.expiresAt} > ${table.updatedAt} AND ${table.scopeKey} = CASE WHEN ${table.companyId} IS NULL THEN 'provider:' || ${table.providerId} ELSE 'company:' || ${table.companyId}::text END`),
]).enableRLS();

export const serviceActivityReads = pgTable("service_activity_reads", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").notNull().references(() => serviceActivityGroups.id, { onDelete: "cascade" }),
  readRevision: integer("read_revision").notNull().default(0),
}, table => [
  primaryKey({ columns: [table.userId, table.groupId] }),
  index("service_activity_read_group_idx").on(table.groupId),
  check("service_activity_read_revision_check", sql`${table.readRevision} >= 0`),
]).enableRLS();

// Explicit per-message receipts avoid a watermark clearing unseen older pages or
// late-committing messages. Existing message deletion cascades receipt cleanup;
// message bodies, sender-visible seen receipts and retention are unchanged.
export const bookingMessageReads = pgTable("booking_message_reads", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").notNull().references(() => bookingMessages.id, { onDelete: "cascade" }),
  contextKey: varchar("context_key", { length: 100 }).notNull(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.userId, table.messageId, table.contextKey] }),
  index("booking_message_read_message_idx").on(table.messageId),
  check("booking_message_read_context_check", sql`${table.contextKey} IN ('customer','provider:personal') OR ${table.contextKey} ~ '^provider:company:[1-9][0-9]*$'`),
]).enableRLS();

export type WishlistService = typeof wishlistServices.$inferSelect;
export type ProductActivityEvent = typeof productActivityEvents.$inferSelect;
export type ServiceActivityGroup = typeof serviceActivityGroups.$inferSelect;
export type BookingRescheduleRequest = typeof bookingRescheduleRequests.$inferSelect;

// Private server-only data: never join these into public users/provider payloads.
export const userCommunicationPreferences = pgTable("user_communication_preferences", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  phone: varchar("phone", { length: 16 }),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
  preferredMethod: varchar("preferred_method", { enum: ["email", "sms", "whatsapp"] }),
  emailSuppressed: boolean("email_suppressed").notNull().default(false),
  language: varchar("language", { length: 8 }).notNull().default("en"),
  smsOptIn: boolean("sms_opt_in").notNull().default(false),
  whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("communication_preferences_phone_idx").on(table.phone).where(sql`${table.phone} IS NOT NULL`),
  check("communication_preferences_phone_check", sql`${table.phone} IS NULL OR ${table.phone} ~ '^\\+[1-9][0-9]{7,14}$'`),
  check("communication_preferences_verification_check", sql`(${table.phoneVerifiedAt} IS NULL OR ${table.phone} IS NOT NULL) AND (NOT ${table.smsOptIn} OR ${table.phoneVerifiedAt} IS NOT NULL) AND (NOT ${table.whatsappOptIn} OR ${table.phoneVerifiedAt} IS NOT NULL)`),
  check("communication_preferences_method_check", sql`${table.preferredMethod} IS NULL OR ${table.preferredMethod} = 'email' OR (${table.preferredMethod} = 'sms' AND ${table.smsOptIn}) OR (${table.preferredMethod} = 'whatsapp' AND ${table.whatsappOptIn})`),
  check("communication_preferences_language_check", sql`${table.language} IN ('en','lv','ru','ar','zh','fr','de','hi','ja','pt','es')`),
]).enableRLS();

export const phoneVerificationChallenges = pgTable("phone_verification_challenges", {
  id: uuid("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phone: varchar("phone", { length: 16 }).notNull(),
  providerRequestId: varchar("provider_request_id", { length: 255 }),
  status: varchar("status", { enum: ["pending", "verified", "failed", "expired", "unknown"] }).notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  nextSendAt: timestamp("next_send_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("phone_verification_user_created_idx").on(table.userId, table.createdAt),
  index("phone_verification_phone_created_idx").on(table.phone, table.createdAt),
  index("phone_verification_expiry_idx").on(table.expiresAt),
  uniqueIndex("phone_verification_provider_identity").on(table.providerRequestId),
  check("phone_verification_shape", sql`${table.phone} ~ '^\\+[1-9][0-9]{7,14}$' AND ${table.status} IN ('pending','verified','failed','expired','unknown') AND ${table.attemptCount} BETWEEN 0 AND 5 AND ${table.expiresAt} > ${table.createdAt} AND ${table.nextSendAt} >= ${table.createdAt}`),
]).enableRLS();

export const notificationEvents = pgTable("notification_events", {
  id: uuid("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  bookingRevision: integer("booking_revision").notNull(),
  kind: varchar("kind", { enum: ["accepted", "rejected", "rescheduled", "reminder"] }).notNull(),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  previousScheduledDate: timestamp("previous_scheduled_date", { withTimezone: true }),
  timezone: varchar("timezone", { length: 100 }).notNull().default("UTC"),
  automatic: boolean("automatic").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("notification_event_revision_identity").on(table.bookingId, table.bookingRevision, table.kind),
  uniqueIndex("notification_reminder_identity").on(table.bookingId, table.scheduledDate).where(sql`${table.kind} = 'reminder'`),
  index("notification_events_retention_idx").on(table.createdAt),
  check("notification_event_shape", sql`${table.bookingRevision} >= 0 AND ${table.kind} IN ('accepted','rejected','rescheduled','reminder') AND length(trim(${table.timezone})) BETWEEN 1 AND 100 AND (${table.kind} <> 'rescheduled' OR ${table.previousScheduledDate} IS NOT NULL)`),
]).enableRLS();

export const notificationJobs = pgTable("notification_jobs", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull().references(() => notificationEvents.id, { onDelete: "cascade" }),
  channel: varchar("channel", { enum: ["email", "sms", "whatsapp"] }),
  state: varchar("state", { enum: ["queued", "leased", "accepted", "delivered", "failed", "unknown", "skipped", "cancelled"] }).notNull().default("queued"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  leaseToken: uuid("lease_token"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }),
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  reasonCode: varchar("reason_code", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("notification_job_event_identity").on(table.eventId),
  index("notification_job_due_idx").on(table.dueAt).where(sql`${table.state} = 'queued'`),
  index("notification_job_lease_idx").on(table.leaseUntil).where(sql`${table.state} = 'leased'`),
  index("notification_jobs_retention_idx").on(table.updatedAt),
  check("notification_job_state_check", sql`${table.state} IN ('queued','leased','accepted','delivered','failed','unknown','skipped','cancelled') AND (${table.channel} IS NULL OR ${table.channel} IN ('email','sms','whatsapp'))`),
  check("notification_job_lease_check", sql`((${table.leaseToken} IS NULL) = (${table.leaseUntil} IS NULL)) AND (${table.state} <> 'leased' OR ${table.leaseToken} IS NOT NULL)`),
  check("notification_job_expiry_check", sql`${table.expiresAt} IS NULL OR ${table.expiresAt} >= ${table.dueAt}`),
]).enableRLS();

export const notificationDeliveryAttempts = pgTable("notification_delivery_attempts", {
  id: uuid("id").primaryKey(),
  jobId: uuid("job_id").notNull().references(() => notificationJobs.id, { onDelete: "cascade" }),
  provider: varchar("provider", { enum: ["vonage", "resend"] }).notNull(),
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  state: varchar("state", { enum: ["reserved", "accepted", "delivered", "failed", "unknown"] }).notNull().default("reserved"),
  errorCode: varchar("error_code", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("notification_attempt_job_identity").on(table.jobId),
  index("notification_attempt_recent_idx").on(table.createdAt, table.jobId),
  uniqueIndex("notification_attempt_provider_identity").on(table.provider, table.providerMessageId),
  check("notification_attempt_shape", sql`${table.provider} IN ('vonage','resend') AND ${table.state} IN ('reserved','accepted','delivered','failed','unknown')`),
]).enableRLS();

export const notificationCallbacks = pgTable("notification_callbacks", {
  id: uuid("id").primaryKey(),
  provider: varchar("provider", { enum: ["vonage", "resend"] }).notNull(),
  providerEventId: varchar("provider_event_id", { length: 255 }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("notification_callback_identity").on(table.provider, table.providerEventId),
  index("notification_callbacks_retention_idx").on(table.receivedAt),
  check("notification_callback_shape", sql`${table.provider} IN ('vonage','resend') AND length(trim(${table.providerEventId})) > 0`),
]).enableRLS();

export type UserCommunicationPreferences = typeof userCommunicationPreferences.$inferSelect;
export type PhoneVerificationChallenge = typeof phoneVerificationChallenges.$inferSelect;
export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type NotificationJob = typeof notificationJobs.$inferSelect;
export type NotificationDeliveryAttempt = typeof notificationDeliveryAttempts.$inferSelect;

// One review per completed booking; the booking supplies its customer and service.
export const serviceReviews = pgTable("service_reviews", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id).notNull().unique(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => [
  check("service_reviews_rating_check", sql`${table.rating} BETWEEN 1 AND 5`),
  check("service_reviews_comment_check", sql`length(${table.comment}) <= 2000 AND (${table.rating} >= 3 OR length(btrim(${table.comment})) > 0)`),
]).enableRLS();

export type ServiceReview = typeof serviceReviews.$inferSelect;

// Service embeddings table for semantic search
export const serviceEmbeddings = pgTable("service_embeddings", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull().unique(),
  embedding: jsonb("embedding").$type<number[]>().notNull(),
  textContent: text("text_content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}).enableRLS();

// Availability table - now represents provider working hours (not tied to specific services)
export const availability = pgTable("availability", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id), // Optional - null means applies to all services
  providerId: varchar("provider_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  
  // Schedule type
  scheduleType: varchar("schedule_type", { enum: ["specific", "recurring"] }).notNull(),
  
  // For specific date/time
  specificDate: timestamp("specific_date"),
  
  // For recurring schedules
  daysOfWeek: jsonb("days_of_week").$type<number[]>(), // [0-6] where 0=Sunday
  
  // Time slots (HH:MM format) - working hours
  startTime: varchar("start_time").notNull(),
  endTime: varchar("end_time").notNull(),
  
  // Break times within working hours (e.g., lunch break)
  breaks: jsonb("breaks").$type<{startTime: string, endTime: string}[]>(), // [{startTime: "13:00", endTime: "14:00"}]
  
  // Slot duration in minutes - kept for backward compatibility but service duration takes precedence
  slotDuration: integer("slot_duration").default(60),
  
  // Timezone
  timezone: varchar("timezone").notNull().default("UTC"),
  
  // Recurrence end conditions (for recurring only)
  recurrenceEndType: varchar("recurrence_end_type", { enum: ["never", "after_events", "on_date"] }),
  recurrenceEndValue: varchar("recurrence_end_value"), // number of events or date string
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}).enableRLS();

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  services: many(services),
  bookings: many(bookings),
  availabilities: many(availability),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  savedAddress: one(addresses, { fields: [services.addressId], references: [addresses.id] }),
  provider: one(users, {
    fields: [services.providerId],
    references: [users.id],
  }),
  bookings: many(bookings),
  availability: many(availability),
}));

export const addressesRelations = relations(addresses, ({ one, many }) => ({
  provider: one(users, { fields: [addresses.providerId], references: [users.id] }),
  services: many(services),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  service: one(services, {
    fields: [bookings.serviceId],
    references: [services.id],
  }),
  seeker: one(users, {
    fields: [bookings.seekerId],
    references: [users.id],
  }),
  provider: one(users, {
    fields: [bookings.providerId],
    references: [users.id],
  }),
}));

export const availabilityRelations = relations(availability, ({ one }) => ({
  service: one(services, {
    fields: [availability.serviceId],
    references: [services.id],
  }),
  provider: one(users, {
    fields: [availability.providerId],
    references: [users.id],
  }),
}));

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type CompanyMembership = typeof companyMemberships.$inferSelect;
export type WorkspaceContext = {
  company: Company | null;
  membership: CompanyMembership | null;
  workspaces: { id: number; name: string; role: CompanyRole }[];
  invalid: boolean;
  permissions: { manageCompany: boolean; manageTeam: boolean; manageServices: boolean; manageSchedules: boolean; manageBookings: boolean; readAll: boolean; isOwner: boolean };
};

export const providerProfileSchema = z.object({
  providerType: z.enum(["individual", "company"]),
  companyName: z.string().trim().max(150).nullable().optional(),
}).refine(data => data.providerType !== "company" || Boolean(data.companyName), {
  message: "Company name is required", path: ["companyName"],
});
export const employeeSchema = z.object({
  name: z.string().trim().min(1, "Employee name is required").max(100),
  showName: z.boolean().default(false),
});

export type InsertService = typeof services.$inferInsert;
export type Service = typeof services.$inferSelect & AddressLocation;

export type InsertBooking = typeof bookings.$inferInsert;
export type Booking = typeof bookings.$inferSelect;

export type InsertAvailability = typeof availability.$inferInsert;
export type Availability = typeof availability.$inferSelect;

export type InsertServiceEmbedding = typeof serviceEmbeddings.$inferInsert;
export type ServiceEmbedding = typeof serviceEmbeddings.$inferSelect;

// Schemas
export const insertServiceSchema = createInsertSchema(services, {
  currency: currencyInput,
  advancePaymentPercent: z.number().int().min(0).max(100).nullable().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderMethod: z.enum(["email", "sms", "whatsapp"]).optional(),
  reminderHours: z.number().int().min(1).max(168).optional(),
  cleanupTime: z.number().int().min(0).max(1440).optional(),
  category: z.string().trim().min(1, "Choose a category.").max(64),
  ageGroups: z.array(z.string()).nullable().optional(),
  employeeId: z.number().int().positive().nullable().optional(),
  addressId: z.number().int().positive(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBookingSchema = createInsertSchema(bookings, { currency: currencyInput }).omit({
  id: true,
  closedAt: true,
  notificationRevision: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  scheduledDate: z.string().or(z.date()).transform((val) => {
    if (typeof val === 'string') {
      const date = new Date(val);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
      }
      return date;
    }
    return val;
  }),
});

export const insertAvailabilitySchema = createInsertSchema(availability, {
  daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  breaks: z.array(z.object({ startTime: z.string(), endTime: z.string() })).nullable().optional(),
}).omit({
  id: true,
  createdAt: true,
});

// Extended service type for API responses
export type ServiceWithProvider = Service & {
  storefrontSlug?: string | null;
  provider: User;
  companyActive?: boolean;
  employee: { id: number; name: string | null } | null;
  availableCapacity?: number;
  nextAvailability?: string;
  distance?: number; // Distance in kilometers from user's location
  rating?: number | null; // Average customer rating (1–5), null if unrated.
  reviewCount?: number;
};

export type BookingWithDetails = Booking & {
  review?: ServiceReview | null;
  service: Service;
  seeker: User;
  provider: User;
  employee?: { id: number; name: string | null } | null;
};
