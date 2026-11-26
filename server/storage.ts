import {
  users,
  employees,
  companies,
  services,
  serviceOptions,
  addresses,
  bookings,
  bookingMessages,
  bookingRescheduleRequests,
  availability,
  serviceEmbeddings,
  serviceReviews,
  providerSubscriptions,
  type ServiceReview,
  type User,
  type UpsertUser,
  type Employee,
  type Service,
  type InsertService,
  type Booking,
  type InsertBooking,
  type Availability,
  type InsertAvailability,
  type ServiceWithProvider,
  type BookingWithDetails,
  type ServiceEmbedding,
  type InsertServiceEmbedding,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, gte, lte, asc, desc, sql, ne, isNull, inArray } from "drizzle-orm";
import { publicProvider } from "@shared/provider";
import { storefrontStore } from "./storefronts";
import { serviceLocation } from "./addresses";
import { assertAuditContext, createAuditContext, type AuditContext } from "./audit/context";
import { createAuditEvent } from "./audit/events";
import { enqueueDrizzleAudit, AuditCaptureUnavailable } from "./audit/capture";
import { availableCapacity, bookableSlots, schedulesForDay, workingRanges, OCCUPYING_BOOKING_STATUSES, type ResourceBooking } from "@shared/scheduling";
import { reviewSchema, ReviewError, type ReviewInput, type ServiceReviewPage } from "@shared/reviews";
import { assertSearchSize, MAX_SEARCH_CANDIDATES, MAX_SEARCH_SCHEDULES, searchFiltersSchema, type SearchFilters } from "./searchInput";
import { assertCustomerBookingChange } from "./customerBookings";
import { assertReminderConfiguration, captureStatusEvent, reconcileBookingReminder, reconcileServiceReminders } from "./notifications/repository";
import { statusAction } from "./notifications/policy";
import type { NotificationSummary } from "@shared/notifications";
import { randomUUID } from "node:crypto";
import { bookingMoneyDto, bookingPriceSnapshot, serviceMoneyChanges, serviceMoneyDto, type ExpectedPrice } from "./money";
import { hasPro } from "@shared/storefront";
import { assertServiceImageEntitlement, serviceImageChanges, serviceImageList } from "./serviceImages";
import { hasUnfinishedServiceBookings, notifyBookedServiceChanges } from "./service-booking-protection";
import { defaultServiceOption, effectiveOnlinePayments, optionDto, optionSummary, readServiceOptions, replaceServiceOptions } from "./service-options-store";
import { optionBookableSlots, optionEffectiveService, optionScheduleRows, selectedServiceOption, ServiceOptionError } from "./service-options";
import type { BookingOptionSelection, ServiceOption, ServiceOptionInput, ServicePageDetails } from "@shared/service-options";
import { normalizeMoneyAmount, parseMoneyAmount } from "@shared/money";
import { readManualBusyIntervals } from "./manual-appointments/busy";

type NotificationBooking = Booking & { notification?: NotificationSummary };

async function galleryProAccess(tx: Pick<typeof db, "select">, service: Pick<InsertService, "providerId" | "companyId">) {
  // The subscription writer takes an update lock. Hold a shared lock until this
  // service mutation commits so a concurrent downgrade cannot race this check.
  const [subscription] = await tx.select().from(providerSubscriptions).where(service.companyId != null
    ? eq(providerSubscriptions.companyId, service.companyId) : eq(providerSubscriptions.userId, service.providerId)).for("share");
  return hasPro(subscription ?? null);
}

async function assertGalleryConfiguration(tx: Pick<typeof db, "select">, service: InsertService, previous?: Pick<Service, "imageUrl" | "imageUrls">) {
  if (serviceImageList(service).length <= 1) return;
  assertServiceImageEntitlement(service, await galleryProAccess(tx, service), previous);
}

function searchDurationLimit(filters: SearchFilters) {
  if (!filters.time && !filters.timeEnd) return undefined;
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  // Search applies the same daily time window throughout the selected dates.
  return minutes(filters.timeEnd ?? "23:59") - minutes(filters.time ?? "00:00");
}

function searchDistance(filters: SearchFilters) {
  if (filters.latitude === undefined || filters.longitude === undefined) return undefined;
  const radians = sql`pi() / 180`;
  const a = sql`least(1.0, greatest(0.0,
    power(sin((${addresses.latitude} - ${filters.latitude}) * ${radians} / 2), 2)
    + cos(${filters.latitude} * ${radians}) * cos(${addresses.latitude} * ${radians})
    * power(sin((${addresses.longitude} - ${filters.longitude}) * ${radians} / 2), 2)))`;
  return sql<number>`CASE WHEN ${addresses.latitude} IS NOT NULL AND ${addresses.longitude} IS NOT NULL
    AND (${addresses.locationSource} IS DISTINCT FROM 'google' OR ${addresses.locationExpiresAt} > now())
    THEN (6371 * 2 * atan2(sqrt(${a}), sqrt(1 - ${a})))::float8 END`;
}

function publicSearchConditions(filters: SearchFilters) {
  const conditions = [eq(services.isActive, true), isNull(services.deletedAt), sql`(${companies.id} IS NULL OR ${companies.isActive} = true)`];
  const durationLimit = searchDurationLimit(filters);
  if (durationLimit !== undefined) conditions.push(lte(services.duration, durationLimit));
  if (filters.companyId !== undefined) conditions.push(eq(services.companyId, filters.companyId));
  if (filters.providerId !== undefined) conditions.push(eq(services.providerId, filters.providerId), isNull(services.companyId));
  if (filters.serviceIds) conditions.push(inArray(services.id, filters.serviceIds));
  if (filters.category) conditions.push(eq(services.category, filters.category));
  if (filters.serviceType) conditions.push(eq(services.serviceType, filters.serviceType));
  if (filters.ageGroups?.length) conditions.push(sql`${services.ageGroups} ?| ARRAY[${sql.join(filters.ageGroups.map(group => sql`${group}`), sql`, `)}]::text[]`);
  if (filters.searchQuery?.trim()) {
    const term = `%${filters.searchQuery.trim().toLowerCase()}%`;
    conditions.push(sql`(LOWER(${services.name}) LIKE ${term} OR LOWER(${services.description}) LIKE ${term}
      OR LOWER(${companies.name}) LIKE ${term} OR (${employees.showName} = true AND LOWER(${employees.name}) LIKE ${term}))`);
  }
  const distance = searchDistance(filters);
  if (distance && filters.radius !== undefined) conditions.push(sql`${distance} <= ${filters.radius}`);
  return conditions;
}

const workspaceKey = (item: { companyId: number | null; providerId: string }) =>
  item.companyId != null ? `company:${item.companyId}` : `user:${item.providerId}`;

const reviewStats = db.select({
  serviceId: bookings.serviceId,
  rating: sql<number>`avg(${serviceReviews.rating})::float8`.as("rating"),
  reviewCount: sql<number>`count(*)::int`.as("review_count"),
}).from(serviceReviews).innerJoin(bookings, eq(serviceReviews.bookingId, bookings.id))
  .groupBy(bookings.serviceId).as("review_stats");

export class BookingConflictError extends Error {}

// All booking mutations take the provider row lock before calling this check.
// This keeps accepting a request serialized with creation and rescheduling.
async function assertResourceAvailable(tx: Pick<typeof db, "select">, service: Pick<Service, "id" | "duration" | "cleanupTime" | "serviceType" | "maxCapacity">, candidate: {
  id?: number; providerId: string; companyId?: number | null; employeeId?: number | null; optionId?: number | null; scheduledDate: Date;
  bookingDuration: number; bookingCleanupTime: number; participantCount?: number | null;
}) {
  const start = candidate.scheduledDate;
  const end = new Date(start.getTime() + (candidate.bookingDuration + candidate.bookingCleanupTime) * 60_000);
  const overlapping = await tx.select({ booking: bookings, duration: services.duration }).from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(and(candidate.id === undefined ? undefined : ne(bookings.id, candidate.id),
      eq(bookings.providerId, candidate.providerId), inArray(bookings.status, [...OCCUPYING_BOOKING_STATUSES]),
      candidate.companyId == null ? isNull(bookings.companyId) : eq(bookings.companyId, candidate.companyId),
      candidate.employeeId != null ? or(eq(bookings.employeeId, candidate.employeeId), candidate.companyId != null ? isNull(bookings.employeeId) : undefined) : candidate.companyId == null ? isNull(bookings.employeeId) : undefined,
      sql`${bookings.scheduledDate} < ${end.toISOString()}::timestamp`,
      sql`${bookings.scheduledDate} + (COALESCE(${bookings.bookingDuration}, ${services.duration}, 60) + COALESCE(${bookings.bookingCleanupTime}, 0)) * interval '1 minute' > ${start.toISOString()}::timestamp`));
  const count = candidate.participantCount ?? 1;
  const remaining = availableCapacity({ ...service, optionId: candidate.optionId, duration: candidate.bookingDuration, cleanupTime: candidate.bookingCleanupTime },
    [...overlapping.map(row => ({ ...row.booking, bookingDuration: row.booking.bookingDuration ?? row.duration ?? 60 })),
      ...await readManualBusyIntervals(tx, candidate, start, end)], start);
  if (!Number.isInteger(count) || count < 1 || count > remaining) throw new BookingConflictError("This time slot is no longer available.");
}

// Haversine formula to calculate distance between two points in kilometers
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

export interface IStorage {
  // Application profile operations for Supabase Auth identities.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserNames(id: string, names: { firstName: string; lastName: string }): Promise<User>;
  updateUserRole(id: string, role: "seeker" | "provider", audit?: AuditContext): Promise<User>;
  updateProviderProfile(id: string, profile: { providerType: "individual" | "company"; companyName: string | null }): Promise<User>;
  getEmployees(providerId: string, companyId?: number): Promise<Employee[]>;
  saveEmployee(providerId: string, employee: { name: string; showName: boolean }, id?: number, companyId?: number): Promise<Employee | undefined>;
  deleteEmployee(providerId: string, id: number, companyId?: number): Promise<boolean>;

  // Service operations
  createService(service: InsertService, options?: ServiceOptionInput[]): Promise<Service>;
  copyService(serviceId: number, providerId: string, companyId?: number): Promise<Service | undefined>;
  getServicesByProvider(providerId: string, companyId?: number): Promise<Service[]>;
  getServiceById(id: number): Promise<ServiceWithProvider | undefined>;
  updateService(id: number, updates: Partial<InsertService>, options?: ServiceOptionInput[]): Promise<Service>;
  deleteService(id: number): Promise<void>;
  searchServices(filters: SearchFilters): Promise<ServiceWithProvider[]>;
  getPublicServiceEmbeddings(filters: SearchFilters): Promise<{ serviceId: number; embedding: number[] }[]>;

  // Booking operations
  createBooking(booking: InsertBooking, initialMessage?: string | null, expectedPrice?: ExpectedPrice, selection?: BookingOptionSelection): Promise<Booking>;
  createReview(bookingId: number, seekerId: string, input: ReviewInput): Promise<ServiceReview>;
  updateReview(bookingId: number, seekerId: string, input: ReviewInput): Promise<ServiceReview>;
  deleteReview(bookingId: number, seekerId: string): Promise<void>;
  getServiceReviews(serviceId: number, page: number): Promise<ServiceReviewPage | undefined>;
  getBookingsBySeeker(seekerId: string): Promise<BookingWithDetails[]>;
  getBookingsByProvider(providerId: string, companyId?: number): Promise<BookingWithDetails[]>;
  getBookingById(id: number): Promise<BookingWithDetails | undefined>;
  updateBookingStatus(id: number, status: string, seekerId?: string, timeZone?: string): Promise<NotificationBooking>;
  rescheduleBooking(id: number, date: Date, seekerId?: string, timeZone?: string): Promise<NotificationBooking>;
  updateBookingPayment(id: number, paymentStatus: string): Promise<Booking>;
  getBookingsForServiceOnDate(serviceId: number, date: Date): Promise<Booking[]>;
  getBookingsForProviderOnDate(providerId: string, date: Date): Promise<Booking[]>;
  getBookingsForResourceOnDate(service: Service, date: Date): Promise<ResourceBooking[]>;
  getBookingsForResourceRange(service: Service, start: Date, end: Date): Promise<ResourceBooking[]>;

  // Availability operations
  createAvailability(availability: InsertAvailability): Promise<Availability>;
  getAvailabilityByService(serviceId: number): Promise<Availability[]>;
  getAvailabilityByProvider(providerId: string, companyId?: number): Promise<Availability[]>;
  updateAvailability(id: number, updates: Partial<InsertAvailability>): Promise<Availability>;
  deleteAvailability(id: number, providerId: string, companyId?: number): Promise<void>;
  replaceAvailability(providerId: string, companyId: number | undefined, serviceId: number | null, type: "recurring" | "specific", rows: InsertAvailability[], date?: Date): Promise<void>;
  
  // Embedding operations for semantic search
  upsertServiceEmbedding(embedding: InsertServiceEmbedding): Promise<ServiceEmbedding>;
  getServiceEmbedding(serviceId: number): Promise<ServiceEmbedding | undefined>;
  getAllServiceEmbeddings(): Promise<ServiceEmbedding[]>;
  deleteServiceEmbedding(serviceId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserNames(id: string, names: { firstName: string; lastName: string }): Promise<User> {
    const [user] = await db.update(users).set({
      firstName: names.firstName || null,
      lastName: names.lastName || null,
      updatedAt: new Date(),
    }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserRole(id: string, role: "seeker" | "provider", audit?: AuditContext): Promise<User> {
    if (audit) return db.transaction(async tx => {
      assertAuditContext(audit);
      const [previous] = await tx.select().from(users).where(eq(users.id, id)).for("update");
      if (!previous || audit.actor.kind !== "user" || audit.actor.userId !== id) throw new Error("Account unavailable");
      if (previous.currentRole !== "seeker" && previous.currentRole !== "provider") throw new AuditCaptureUnavailable();
      const [user] = await tx.update(users).set({ currentRole: role, updatedAt: new Date() }).where(eq(users.id, id)).returning();
      const before = previous.currentRole;
      const actionContext = createAuditContext({ ...audit, actor: { ...audit.actor, effectiveRole: before } });
      const event = createAuditEvent(actionContext, { eventName: "account.active_role_changed.v1", outcome: "succeeded",
        ...(before === role ? { reasonCode: "NO_CHANGE" as const } : {}),
        changes: before === role ? [] : [{ field: "currentRole", before, after: role }] });
      await enqueueDrizzleAudit(tx, event);
      return user;
    });
    const [user] = await db
      .update(users)
      .set({ currentRole: role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Service operations
  async updateProviderProfile(id: string, profile: { providerType: "individual" | "company"; companyName: string | null }): Promise<User> {
    const [user] = await db.update(users).set({ ...profile, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return user;
  }

  async getEmployees(providerId: string, companyId?: number): Promise<Employee[]> {
    return db.select().from(employees).where(companyId != null ? eq(employees.companyId, companyId) : and(eq(employees.providerId, providerId), isNull(employees.companyId))).orderBy(asc(employees.name));
  }

  async saveEmployee(providerId: string, employee: { name: string; showName: boolean }, id?: number, companyId?: number): Promise<Employee | undefined> {
    if (id !== undefined) {
      const [updated] = await db.update(employees).set({ ...employee, updatedAt: new Date() })
        .where(and(eq(employees.id, id), companyId != null ? eq(employees.companyId, companyId) : and(eq(employees.providerId, providerId), isNull(employees.companyId)))).returning();
      return updated;
    }
    const [created] = await db.insert(employees).values({ ...employee, providerId, companyId }).returning();
    return created;
  }

  async deleteEmployee(providerId: string, id: number, companyId?: number): Promise<boolean> {
    const removed = await db.delete(employees).where(and(eq(employees.id, id), companyId != null ? eq(employees.companyId, companyId) : and(eq(employees.providerId, providerId), isNull(employees.companyId)))).returning();
    return removed.length > 0;
  }

  async createService(service: InsertService, options?: ServiceOptionInput[]): Promise<Service> {
    service = { ...service, ...serviceMoneyChanges(service), ...serviceImageChanges(service), deletedAt: null };
    const newService = await db.transaction(async tx => {
      await assertGalleryConfiguration(tx, service);
      await assertReminderConfiguration(tx, service, service);
      const [created] = await tx.insert(services).values(service).returning();
      const savedOptions = await replaceServiceOptions(tx, created, options ?? [defaultServiceOption(created)]);
      const summary = optionSummary(savedOptions, created.currency);
      const [listing] = summary ? await tx.update(services).set({ price: summary.price, duration: summary.duration }).where(eq(services.id, created.id)).returning() : [created];
      return { ...listing, options: savedOptions, ...summary };
    });
    return serviceLocation(newService, newService.addressId == null ? null : (await db.select().from(addresses).where(eq(addresses.id, newService.addressId)))[0]);
  }

  async copyService(serviceId: number, providerId: string, companyId?: number): Promise<Service | undefined> {
    const copy = await db.transaction(async (tx) => {
      const [source] = await tx.select().from(services)
        .where(and(eq(services.id, serviceId), isNull(services.deletedAt), companyId != null ? eq(services.companyId, companyId) : and(eq(services.providerId, providerId), isNull(services.companyId)))).for("share");
      if (!source) return undefined;
      const { id, createdAt, updatedAt, ...listing } = source;
      let imageUrls = serviceImageList(source);
      if (imageUrls.length > 1 && !await galleryProAccess(tx, source)) imageUrls = imageUrls.slice(0, 1);
      const [copy] = await tx.insert(services).values({
        ...listing,
        ...serviceImageChanges({ imageUrls }),
        name: `${source.name} (copy)`,
        deletedAt: null,
        isActive: false,
        reminderEnabled: false,
      }).returning();
      const options = await readServiceOptions(tx, source, true);
      const copiedOptions = await replaceServiceOptions(tx, copy, options.map(({ id: _id, serviceId: _serviceId, ...option }) => option));
      return { ...copy, options: copiedOptions };
    });
    return copy ? serviceLocation(copy, copy.addressId == null ? null : (await db.select().from(addresses).where(eq(addresses.id, copy.addressId)))[0]) : undefined;
  }

  async getServicesByProvider(providerId: string, companyId?: number): Promise<Service[]> {
    const rows = await db
      .select()
      .from(services)
      .leftJoin(addresses, eq(services.addressId, addresses.id))
      .where(and(isNull(services.deletedAt), companyId != null ? eq(services.companyId, companyId) : and(eq(services.providerId, providerId), isNull(services.companyId))))
      .orderBy(desc(services.createdAt));
    return Promise.all(rows.map(async row => ({ ...serviceLocation(row.services, row.addresses), options: await readServiceOptions(db, row.services, true) })));
  }

  async getServiceById(id: number): Promise<ServiceWithProvider | undefined> {
    const [result] = await db
      .select()
      .from(services)
      .leftJoin(addresses, eq(services.addressId, addresses.id))
      .leftJoin(users, eq(services.providerId, users.id))
      .leftJoin(employees, eq(services.employeeId, employees.id))
      .leftJoin(companies, eq(services.companyId, companies.id))
      .leftJoin(reviewStats, eq(services.id, reviewStats.serviceId))
      .where(and(eq(services.id, id), isNull(services.deletedAt)));

    if (!result) return undefined;

    const slugs = await storefrontStore.slugs([result.services]);

    return {
      ...serviceLocation(result.services, result.addresses),
      storefrontSlug: slugs.get(result.services.companyId != null ? `company:${result.services.companyId}` : `user:${result.services.providerId}`) ?? null,
      rating: result.review_stats?.rating ?? null,
      reviewCount: result.review_stats?.reviewCount ?? 0,
      provider: publicProvider(result.users!, result.companies),
      companyActive: result.companies?.isActive ?? true,
      employee: result.employees ? { id: result.employees.id, name: result.employees.showName ? result.employees.name : null } : null,
    };
  }

  async getServicePageDetails(id: number): Promise<ServicePageDetails | undefined> {
    const service = await this.getServiceById(id);
    if (!service) return undefined;
    const options = await readServiceOptions(db, service);
    const roster = service.companyId == null ? [] : await this.getEmployees(service.providerId, service.companyId);
    const eligible = new Set(options.flatMap(option => option.employeeIds ?? (service.employeeId == null ? [] : [service.employeeId])));
    const summary = optionSummary(options, service.currency);
    return { ...service, ...summary, options, specialists: roster.filter(person => eligible.has(person.id)).map(person => ({ id: person.id, name: person.showName ? person.name : null })),
      onlinePaymentsOverride: service.onlinePaymentsOverride ?? null, onlinePaymentsAllowed: await effectiveOnlinePayments(db, service), onlinePaymentsAvailable: false,
      priceIsFrom: summary?.priceIsFrom ?? false, minimumDuration: summary?.minimumDuration ?? service.duration, maximumDuration: summary?.maximumDuration ?? service.duration };
  }

  async getServiceOptions(service: Pick<Service, "id" | "currency">, includeInactive = false) { return readServiceOptions(db, service, includeInactive); }

  async updateService(id: number, updates: Partial<InsertService>, options?: ServiceOptionInput[]): Promise<Service> {
    const service = await db.transaction(async tx => {
      const [previous] = await tx.select().from(services).where(eq(services.id, id)).for("update");
      if (!previous || previous.deletedAt) throw new BookingConflictError("Service not found.");
      updates = { ...updates, ...serviceMoneyChanges(updates, previous), ...serviceImageChanges(updates, previous) };
      const retained = options === undefined || updates.currency !== undefined && updates.currency !== previous.currency ? await readServiceOptions(tx, previous, true) : [];
      const synchronizeDefault = options === undefined && retained.length === 1 && (updates.price !== undefined || updates.duration !== undefined);
      if (updates.currency !== undefined && updates.currency !== previous.currency) {
        try {
          for (const option of retained) parseMoneyAmount(options?.find(input => input.id === option.id)?.price ?? (synchronizeDefault && updates.price !== undefined ? updates.price : option.price), updates.currency);
        } catch { throw new ServiceOptionError(400, "PRICE_PRECISION", "Review every option amount, including inactive options, for the selected currency. Amounts are never converted or rounded automatically."); }
      }
      if (updates.imageUrls !== undefined) await assertGalleryConfiguration(tx, { ...previous, ...updates }, previous);
      await assertReminderConfiguration(tx, previous, updates, previous);
      const [updated] = await tx.update(services).set({ ...updates, updatedAt: new Date() }).where(eq(services.id, id)).returning();
      let savedOptions: ServiceOption[];
      if (synchronizeDefault) {
        const { serviceId: _serviceId, ...option } = retained[0];
        savedOptions = await replaceServiceOptions(tx, updated, [{ ...option, price: updated.price, duration: updated.duration }]);
      } else savedOptions = options === undefined ? await readServiceOptions(tx, updated, true) : await replaceServiceOptions(tx, updated, options);
      if (updated.isActive && !savedOptions.some(option => option.isActive)) throw new ServiceOptionError(400, "NO_ACTIVE_OPTIONS", "Publish at least one active service option.");
      const summary = optionSummary(savedOptions, updated.currency);
      const [listing] = summary ? await tx.update(services).set({ price: summary.price, duration: summary.duration }).where(eq(services.id, id)).returning() : [updated];
      if (updated.reminderEnabled !== previous.reminderEnabled || updated.reminderMethod !== previous.reminderMethod || updated.reminderHours !== previous.reminderHours || updated.reminderMessage !== previous.reminderMessage) await reconcileServiceReminders(tx, id);
      await notifyBookedServiceChanges(tx, previous, listing);
      return { ...listing, options: savedOptions, ...summary };
    });
    return serviceLocation(service, service.addressId == null ? null : (await db.select().from(addresses).where(eq(addresses.id, service.addressId)))[0]);
  }

  async deleteService(id: number): Promise<void> {
    await db.transaction(async tx => {
      const [service] = await tx.select().from(services).where(eq(services.id, id)).for("update");
      if (!service || service.deletedAt) throw new BookingConflictError("Service not found.");
      if (await hasUnfinishedServiceBookings(tx, id)) throw new BookingConflictError("Complete or cancel all reservations before deleting this service.");
      // Historical reservations retain their source listing and snapshot values.
      const removedAt = new Date();
      await tx.update(services).set({ isActive: false, deletedAt: removedAt, updatedAt: removedAt }).where(eq(services.id, id));
    });
  }

  async searchServices(filters: SearchFilters): Promise<ServiceWithProvider[]> {
    filters = searchFiltersSchema.parse(filters);
    if (filters.serviceIds?.length === 0) return [];
    const conditions = publicSearchConditions(filters);
    const distance = searchDistance(filters);
    // Scope-only catalogs have separate callers/contracts. Keep their existing
    // behavior until pagination is designed rather than silently cutting them off.
    const bounded = filters.companyId === undefined && filters.providerId === undefined;

    const query = db
      .select()
      .from(services)
      .leftJoin(addresses, eq(services.addressId, addresses.id))
      .leftJoin(users, eq(services.providerId, users.id))
      .leftJoin(employees, eq(services.employeeId, employees.id))
      .leftJoin(companies, eq(services.companyId, companies.id))
      .leftJoin(reviewStats, eq(services.id, reviewStats.serviceId))
      .where(and(...conditions))
      .orderBy(...(distance ? [asc(distance)] : []), desc(services.createdAt), desc(services.id));
    // Availability is evaluated below; don't cap before those matches are known.
    const queryLimit = filters.limit && !filters.availableOnly ? filters.limit : MAX_SEARCH_CANDIDATES + 1;
    const results = bounded ? await query.limit(queryLimit) : await query;

    if (bounded) assertSearchSize(results.length);

    const slugs = await storefrontStore.slugs(results.map(result => result.services));
    let servicesWithProviders: ServiceWithProvider[] = results.map(result => ({
      ...serviceLocation(result.services, result.addresses),
      storefrontSlug: slugs.get(result.services.companyId != null ? `company:${result.services.companyId}` : `user:${result.services.providerId}`) ?? null,
      rating: result.review_stats?.rating ?? null,
      reviewCount: result.review_stats?.reviewCount ?? 0,
      provider: publicProvider(result.users!, result.companies),
      companyActive: result.companies?.isActive ?? true,
      employee: result.employees ? { id: result.employees.id, name: result.employees.showName ? result.employees.name : null } : null,
    }));

    const optionsByService = new Map<number, ServiceOption[]>();
    if (servicesWithProviders.length) {
      const optionRows = await db.select().from(serviceOptions).where(and(inArray(serviceOptions.serviceId, servicesWithProviders.map(service => service.id)), eq(serviceOptions.isActive, true)));
      servicesWithProviders = servicesWithProviders.flatMap(service => {
        const options = optionRows.filter(option => option.serviceId === service.id).map(option => optionDto(option, service.currency));
        optionsByService.set(service.id, options);
        const summary = optionSummary(options, service.currency);
        return summary ? [{ ...service, ...summary }] : [];
      });
    }

    // Retain the time-window constraint on hydrated results as well as the SQL
    // query, independently of the optional provider-availability filter.
    const durationLimit = searchDurationLimit(filters);
    if (durationLimit !== undefined) servicesWithProviders = servicesWithProviders.filter(service => service.duration <= durationLimit);

    // Filter by age groups if specified
    if (filters.ageGroups && filters.ageGroups.length > 0) {
      servicesWithProviders = servicesWithProviders.filter(service => {
        if (!service.ageGroups || service.ageGroups.length === 0) return false;
        return filters.ageGroups!.some(ag => service.ageGroups?.includes(ag));
      });
    }

    // Calculate distance if user location is provided
    if (filters.latitude !== undefined && filters.longitude !== undefined) {
      servicesWithProviders = servicesWithProviders.map(service => {
        let distance: number | undefined;
        
        if (service.latitude !== null && service.longitude !== null) {
          distance = calculateDistance(
            filters.latitude!,
            filters.longitude!,
            service.latitude,
            service.longitude
          );
        }
        
        return {
          ...service,
          distance,
        };
      });

      // Filter by radius if specified
      if (filters.radius !== undefined) {
        servicesWithProviders = servicesWithProviders.filter(
          service => service.distance !== undefined && service.distance <= filters.radius!
        );
      }

      // Sort by distance (closest first)
      servicesWithProviders.sort((a, b) => {
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
      });
    }

    // Filter by availability if requested
    if (filters.availableOnly && filters.date) {
      const startDate = new Date(filters.date);
      const endDate = filters.dateEnd ? new Date(filters.dateEnd) : startDate;
      
      if (!servicesWithProviders.length) return [];
      const companyIds = Array.from(new Set(servicesWithProviders.flatMap(service => service.companyId == null ? [] : [service.companyId])));
      const personalIds = Array.from(new Set(servicesWithProviders.filter(service => service.companyId == null).map(service => service.providerId)));
      // Only materialize relevant public workspaces, service assignments, and days.
      const allAvailability = await db.select().from(availability).where(and(
        eq(availability.isActive, true),
        or(companyIds.length ? inArray(availability.companyId, companyIds) : undefined,
          personalIds.length ? and(isNull(availability.companyId), inArray(availability.providerId, personalIds)) : undefined),
        or(isNull(availability.serviceId), inArray(availability.serviceId, servicesWithProviders.map(service => service.id))),
        or(eq(availability.scheduleType, "recurring"), and(eq(availability.scheduleType, "specific"),
          sql`${availability.specificDate} >= ${filters.date}::date`,
          sql`${availability.specificDate} < ${filters.dateEnd ?? filters.date}::date + interval '1 day'`)),
      )).orderBy(asc(availability.id)).limit(MAX_SEARCH_SCHEDULES + 1);
      assertSearchSize(allAvailability.length, MAX_SEARCH_SCHEDULES);
      
      // Use the same schedule precedence as booking: a closed service week and
      // an expired recurring schedule must not reopen through inherited hours.
      servicesWithProviders = servicesWithProviders.filter(service => {
        const inherited = allAvailability.filter(schedule => workspaceKey(schedule) === workspaceKey(service));
        for (const option of optionsByService.get(service.id) ?? []) {
          if (durationLimit !== undefined && option.duration > durationLimit || option.employeeIds?.length === 0) continue;
          const schedules = optionScheduleRows(service, option, inherited);
          const zones = Array.from(new Set(schedules.map(schedule => schedule.timezone)));
          for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
            const day = d.toISOString().slice(0, 10);
            for (const zone of zones) for (const schedule of schedulesForDay(schedules, service.id, day, zone)) {
              if (workingRanges(schedule).some(range => (!filters.time && !filters.timeEnd)
                || (filters.time || "00:00") < range.endTime && (filters.timeEnd || "23:59") > range.startTime)) return true;
            }
          }
        }
        return false;
      });
    }

    return filters.limit ? servicesWithProviders.slice(0, filters.limit) : servicesWithProviders;
  }

  // Booking operations
  async createBooking(booking: InsertBooking, initialMessage?: string | null, expectedPrice?: ExpectedPrice, selection?: BookingOptionSelection): Promise<Booking> {
    return db.transaction(async tx => {
      // Serialize check + insert for this administrator, including simultaneous requests.
      await tx.execute(sql`SELECT id FROM users WHERE id = ${booking.providerId} FOR UPDATE`);
      const [service] = await tx.select().from(services).where(eq(services.id, booking.serviceId)).for("share");
      if (!service?.isActive || service.deletedAt || service.providerId !== booking.providerId || service.companyId !== (booking.companyId ?? null)) throw new BookingConflictError("The service has changed. Please choose a time again.");
      const option = selectedServiceOption(await readServiceOptions(tx, service), selection?.optionId ?? booking.optionId ?? undefined);
      if (selection?.expectedDuration !== undefined && selection.expectedDuration !== option.duration || selection?.expectedPricingMode !== undefined && selection.expectedPricingMode !== option.pricingMode || selection?.expectedOptionName !== undefined && selection.expectedOptionName !== option.name) throw new ServiceOptionError(409, "OPTION_CHANGED", "The service option changed. Review the appointment before booking.");
      const participantCount = booking.participantCount ?? 1;
      if (!Number.isInteger(participantCount) || participantCount < 1 || participantCount > (service.serviceType === "group" ? service.maxCapacity ?? 1 : 1)) throw new BookingConflictError("Choose a valid number of participants.");
      if (selection?.paymentMethod === "fitsmytime") throw new ServiceOptionError(409, "PAYMENTS_UNAVAILABLE", "Online payment collection is not available. Choose pay onsite.");
      const roster = service.companyId == null ? [] : await tx.select().from(employees).where(and(eq(employees.companyId, service.companyId), eq(employees.providerId, service.providerId)));
      // The locked listing owns money and its currency; never accept caller totals.
      // HTTP requires an explicit quote. Internal callers also compare their saved
      // currency and must take their expected unit price from the listing.
      const expected = expectedPrice ?? { expectedPrice: normalizeMoneyAmount(option.price, service.currency), expectedCurrency: booking.currency, expectedAdvancePaymentPercent: service.advancePaymentPercent ?? 0 };
      const schedules = await tx.select().from(availability).where(and(
        service.companyId != null ? eq(availability.companyId, service.companyId) : and(eq(availability.providerId, service.providerId), isNull(availability.companyId)), eq(availability.isActive, true)));
      const existing = await tx.select().from(bookings).where(and(eq(bookings.providerId, service.providerId),
        service.companyId == null ? isNull(bookings.companyId) : eq(bookings.companyId, service.companyId), inArray(bookings.status, [...OCCUPYING_BOOKING_STATUSES]),
        sql`${bookings.scheduledDate} < ${new Date(booking.scheduledDate.getTime() + (option.duration + service.cleanupTime) * 60_000).toISOString()}::timestamp`,
        sql`${bookings.scheduledDate} + (COALESCE(${bookings.bookingDuration}, 60) + COALESCE(${bookings.bookingCleanupTime}, 0)) * interval '1 minute' > ${booking.scheduledDate.toISOString()}::timestamp`));
      const manualBusy = await readManualBusyIntervals(tx, { ...service, employeeId: null }, booking.scheduledDate,
        new Date(booking.scheduledDate.getTime() + (option.duration + service.cleanupTime) * 60000));
      const offered = optionBookableSlots({ service, option, schedules, bookings: [...existing, ...manualBusy], employees: roster, specialist: selection?.specialist ?? "any",
        participantCount: booking.participantCount ?? 1, date: booking.scheduledDate.toISOString().slice(0, 10), timezone: "UTC" });
      const slot = offered.find(item => item.startsAt === booking.scheduledDate.toISOString());
      if (!slot) throw new BookingConflictError("This time is no longer available.");
      if (selection?.expectedEmployeeId !== undefined && selection.expectedEmployeeId !== slot.employeeId) throw new ServiceOptionError(409, "SPECIALIST_CHANGED", "The assigned specialist changed. Review the appointment before booking.");
      const effective = optionEffectiveService(service, option, slot.employeeId);
      const snapshot = bookingPriceSnapshot(effective, booking.participantCount ?? 1, expected);
      const createdAt = new Date();
      const [created] = await tx.insert(bookings).values({ ...booking, ...snapshot, notes: null, createdAt, employeeId: slot.employeeId,
        bookingDuration: option.duration, bookingCleanupTime: service.cleanupTime, optionId: option.id, optionName: option.name,
        pricingMode: option.pricingMode, unitPrice: effective.price, paymentMethod: "onsite", platformFeeRateBps: 0, platformFeeAmount: "0" }).returning();
      if (initialMessage) {
        await tx.insert(bookingMessages).values({ id: randomUUID(), bookingId: created.id, authorId: created.seekerId,
          authorRole: "customer", body: initialMessage, clientRequestId: randomUUID(), broadcastId: null, createdAt });
      }
      await reconcileBookingReminder(tx, created, new Date(), schedules.find(item => item.serviceId === service.id)?.timezone ?? schedules[0]?.timezone ?? "UTC");
      return bookingMoneyDto(created);
    });
  }

  async getServiceReviews(serviceId: number, page: number): Promise<ServiceReviewPage | undefined> {
    const service = await this.getServiceById(serviceId);
    if (!service?.isActive || !service.companyActive) return undefined;
    const pageSize = 20;
    const results = await db.select({
      id: serviceReviews.id,
      rating: serviceReviews.rating,
      comment: serviceReviews.comment,
      createdAt: serviceReviews.createdAt,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(serviceReviews)
      .innerJoin(bookings, eq(serviceReviews.bookingId, bookings.id))
      .leftJoin(users, eq(bookings.seekerId, users.id))
      .where(eq(bookings.serviceId, serviceId))
      .orderBy(desc(serviceReviews.createdAt), desc(serviceReviews.id))
      .limit(pageSize + 1).offset((page - 1) * pageSize);
    return {
      page,
      hasMore: results.length > pageSize,
      reviews: results.slice(0, pageSize).map(review => ({
        id: review.id, rating: review.rating, comment: review.comment,
        reviewerName: [review.firstName?.trim(), review.lastName?.trim()].filter(Boolean).join(" ") || null,
        createdAt: review.createdAt.toISOString(),
      })),
    };
  }

  async createReview(bookingId: number, seekerId: string, input: ReviewInput): Promise<ServiceReview> {
    const values = reviewSchema.parse(input);
    return db.transaction(async tx => {
      const [booking] = await tx.select().from(bookings)
        .where(and(eq(bookings.id, bookingId), eq(bookings.seekerId, seekerId))).for("update");
      if (!booking) throw new ReviewError(404, "Booking not found.");
      if (booking.status !== "completed") throw new ReviewError(409, "Only completed bookings can be reviewed.");
      const [review] = await tx.insert(serviceReviews).values({ bookingId, ...values })
        .onConflictDoNothing({ target: serviceReviews.bookingId }).returning();
      if (!review) throw new ReviewError(409, "This booking has already been reviewed.");
      return review;
    });
  }

  async updateReview(bookingId: number, seekerId: string, input: ReviewInput): Promise<ServiceReview> {
    const values = reviewSchema.parse(input);
    const [review] = await db.update(serviceReviews).set(values).where(and(
      eq(serviceReviews.bookingId, bookingId),
      inArray(serviceReviews.bookingId, db.select({ id: bookings.id }).from(bookings)
        .where(and(eq(bookings.seekerId, seekerId), eq(bookings.status, "completed")))),
    )).returning();
    if (!review) throw new ReviewError(404, "Review not found.");
    return review;
  }

  async deleteReview(bookingId: number, seekerId: string): Promise<void> {
    const [review] = await db.delete(serviceReviews).where(and(
      eq(serviceReviews.bookingId, bookingId),
      inArray(serviceReviews.bookingId, db.select({ id: bookings.id }).from(bookings).where(eq(bookings.seekerId, seekerId))),
    )).returning({ id: serviceReviews.id });
    if (!review) throw new ReviewError(404, "Review not found.");
  }

  async getBookingsBySeeker(seekerId: string): Promise<BookingWithDetails[]> {
    const results = await db
      .select()
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(addresses, eq(services.addressId, addresses.id))
      .leftJoin(users, eq(bookings.providerId, users.id))
      .leftJoin(employees, eq(bookings.employeeId, employees.id))
      .leftJoin(companies, eq(bookings.companyId, companies.id))
      .leftJoin(serviceReviews, eq(serviceReviews.bookingId, bookings.id))
      .where(eq(bookings.seekerId, seekerId))
      .orderBy(desc(bookings.createdAt));

    return results.map(result => ({
      ...bookingMoneyDto(result.bookings),
      review: result.service_reviews,
      service: serviceLocation(result.services!, result.addresses),
      seeker: { id: seekerId } as User,
      provider: publicProvider(result.users!, result.companies),
      employee: result.employees ? { id: result.employees.id, name: result.employees.showName ? result.employees.name : null } : null,
    }));
  }

  async getBookingsByProvider(providerId: string, companyId?: number): Promise<BookingWithDetails[]> {
    const results = await db
      .select()
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(addresses, eq(services.addressId, addresses.id))
      .leftJoin(users, eq(bookings.seekerId, users.id))
      .where(companyId != null ? eq(bookings.companyId, companyId) : and(eq(bookings.providerId, providerId), isNull(bookings.companyId)))
      .orderBy(desc(bookings.createdAt));

    return results.map(result => ({
      ...bookingMoneyDto(result.bookings),
      service: serviceLocation(result.services!, result.addresses),
      seeker: result.users!,
      provider: { id: providerId } as User,
    }));
  }

  async getBookingById(id: number): Promise<BookingWithDetails | undefined> {
    const [result] = await db
      .select()
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(addresses, eq(services.addressId, addresses.id))
      .leftJoin(users, eq(bookings.seekerId, users.id))
      .where(eq(bookings.id, id));

    if (!result) return undefined;

    return {
      ...bookingMoneyDto(result.bookings),
      service: serviceLocation(result.services!, result.addresses),
      seeker: result.users!,
      provider: { id: result.bookings.providerId } as User,
    };
  }

  async updateBookingStatus(id: number, status: string, seekerId?: string, timeZone = "UTC"): Promise<NotificationBooking> {
    return db.transaction(async tx => {
      const [initial] = await tx.select().from(bookings).where(eq(bookings.id, id));
      if (!initial) throw new BookingConflictError("Reservation not found.");
      await tx.execute(sql`SELECT id FROM users WHERE id = ${initial.providerId} FOR UPDATE`);
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).for("update");
      if (seekerId !== undefined) {
        assertCustomerBookingChange(booking, seekerId);
        if (status !== "cancelled") throw new BookingConflictError("Customers can only cancel their reservations.");
      }
      if ((booking.status === "cancelled" || booking.status === "completed") && status !== booking.status) throw new BookingConflictError("Closed reservations cannot be changed.");
      if (OCCUPYING_BOOKING_STATUSES.some(value => value === status) && !OCCUPYING_BOOKING_STATUSES.some(value => value === booking.status)) {
        const [service] = await tx.select().from(services).where(eq(services.id, booking.serviceId));
        if (!service) throw new BookingConflictError("The service is no longer available.");
        await assertResourceAvailable(tx, service, { ...booking, bookingDuration: booking.bookingDuration ?? service.duration, bookingCleanupTime: booking.bookingCleanupTime ?? 0 });
      }
      if (booking.status === status) return { ...bookingMoneyDto(booking), notification: { mode: "none" as const } };
      const [updated] = await tx.update(bookings).set({ status: status as Booking["status"], notificationRevision: booking.notificationRevision + 1,
        closedAt: status === "completed" || status === "cancelled" ? booking.closedAt ?? new Date() : null, updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
      await tx.update(bookingRescheduleRequests).set({ state: "superseded" }).where(and(eq(bookingRescheduleRequests.bookingId, id), eq(bookingRescheduleRequests.state, "pending")));
      const action = seekerId === undefined ? statusAction(booking.status, updated.status) : null;
      const notification = action ? await captureStatusEvent(tx, updated, action, timeZone) : { mode: "none" as const };
      await reconcileBookingReminder(tx, updated, new Date(), timeZone);
      return { ...bookingMoneyDto(updated), notification };
    });
  }

  async updateBookingPayment(id: number, paymentStatus: string): Promise<Booking> {
    const [booking] = await db
      .update(bookings)
      .set({ paymentStatus: paymentStatus as any, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return bookingMoneyDto(booking);
  }

  async rescheduleBooking(id: number, date: Date, seekerId?: string, timeZone = "UTC"): Promise<NotificationBooking> {
    return db.transaction(async tx => {
      const [initial] = await tx.select().from(bookings).where(eq(bookings.id, id));
      if (!initial) throw new BookingConflictError("Reservation not found.");
      await tx.execute(sql`SELECT id FROM users WHERE id = ${initial.providerId} FOR UPDATE`);
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).for("update");
      if (seekerId !== undefined) assertCustomerBookingChange(booking, seekerId);
      if (!(date.getTime() > Date.now())) throw new BookingConflictError("Choose a future appointment time.");
      if (booking.status !== "pending" && booking.status !== "confirmed") throw new BookingConflictError("Only pending or confirmed reservations can be rescheduled.");
      if (booking.scheduledDate.getTime() === date.getTime()) return { ...bookingMoneyDto(booking), notification: { mode: "none" as const } };
      const [service] = await tx.select().from(services).where(eq(services.id, booking.serviceId));
      const schedules = await tx.select().from(availability).where(and(
        booking.companyId != null ? eq(availability.companyId, booking.companyId) : and(eq(availability.providerId, booking.providerId), isNull(availability.companyId)), eq(availability.isActive, true)));
      const option = (await readServiceOptions(tx, service, true)).find(item => item.id === booking.optionId);
      const offered = bookableSlots({ service: { ...service, optionId: booking.optionId, duration: booking.bookingDuration ?? service.duration, cleanupTime: booking.bookingCleanupTime ?? 0 },
        schedules: option ? optionScheduleRows(service, option, schedules) : schedules, bookings: [], date: date.toISOString().slice(0, 10), timezone: "UTC" });
      if (!offered.some(slot => slot.startsAt === date.toISOString())) throw new BookingConflictError("Choose a time within the available working hours.");
      await assertResourceAvailable(tx, service, { ...booking, scheduledDate: date, bookingDuration: booking.bookingDuration ?? service.duration, bookingCleanupTime: booking.bookingCleanupTime ?? 0 });
      const [updated] = await tx.update(bookings).set({ scheduledDate: date, notificationRevision: booking.notificationRevision + 1, updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
      const notification = seekerId === undefined ? await captureStatusEvent(tx, updated, "rescheduled", timeZone, booking.scheduledDate) : { mode: "none" as const };
      await reconcileBookingReminder(tx, updated, new Date(), timeZone);
      return { ...bookingMoneyDto(updated), notification };
    });
  }

  async getBookingsForServiceOnDate(serviceId: number, date: Date): Promise<Booking[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.serviceId, serviceId),
          gte(bookings.scheduledDate, startOfDay),
          lte(bookings.scheduledDate, endOfDay),
          inArray(bookings.status, [...OCCUPYING_BOOKING_STATUSES])
        )
      )
      .orderBy(asc(bookings.scheduledDate));
  }

  async getBookingsForProviderOnDate(providerId: string, date: Date): Promise<Booking[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.providerId, providerId),
          gte(bookings.scheduledDate, startOfDay),
          lte(bookings.scheduledDate, endOfDay),
          inArray(bookings.status, [...OCCUPYING_BOOKING_STATUSES])
        )
      )
      .orderBy(asc(bookings.scheduledDate));
  }

  // Availability operations
  async getBookingsForResourceOnDate(service: Service, date: Date): Promise<ResourceBooking[]> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return this.getBookingsForResourceRange(service, start, end);
  }

  async getBookingsForResourceRange(service: Service, start: Date, end: Date): Promise<ResourceBooking[]> {
    const rows = await db.select({ booking: bookings, duration: services.duration }).from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.providerId, service.providerId), service.companyId == null ? isNull(bookings.companyId) : eq(bookings.companyId, service.companyId), inArray(bookings.status, [...OCCUPYING_BOOKING_STATUSES]),
        service.employeeId != null ? or(eq(bookings.employeeId, service.employeeId), service.companyId != null ? isNull(bookings.employeeId) : undefined) : service.companyId == null ? isNull(bookings.employeeId) : undefined,
        sql`${bookings.scheduledDate} < ${end.toISOString()}::timestamp`,
        sql`${bookings.scheduledDate} + (COALESCE(${bookings.bookingDuration}, ${services.duration}, 60) + COALESCE(${bookings.bookingCleanupTime}, 0)) * interval '1 minute' > ${start.toISOString()}::timestamp`));
    return [...rows.map(row => ({ ...row.booking, bookingDuration: row.booking.bookingDuration ?? row.duration ?? 60 })),
      ...await readManualBusyIntervals(db, service, start, end)];
  }

  async createAvailability(availabilityData: InsertAvailability): Promise<Availability> {
    const [newAvailability] = await db
      .insert(availability)
      .values(availabilityData)
      .returning();
    return newAvailability;
  }

  async replaceAvailability(providerId: string, companyId: number | undefined, serviceId: number | null, type: "recurring" | "specific", rows: InsertAvailability[], date?: Date): Promise<void> {
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT id FROM users WHERE id = ${providerId} FOR UPDATE`);
      await tx.update(availability).set({ isActive: false, updatedAt: new Date() }).where(and(
        companyId != null ? eq(availability.companyId, companyId) : and(eq(availability.providerId, providerId), isNull(availability.companyId)),
        serviceId == null ? isNull(availability.serviceId) : eq(availability.serviceId, serviceId),
        eq(availability.scheduleType, type),
        ...(date ? [sql`${availability.specificDate}::date = ${date.toISOString().slice(0, 10)}::date`] : [])));
      if (rows.length) await tx.insert(availability).values(rows);
    });
  }

  async getAvailabilityByService(serviceId: number): Promise<Availability[]> {
    return await db
      .select()
      .from(availability)
      .where(
        and(
          eq(availability.serviceId, serviceId),
          eq(availability.isActive, true)
        )
      )
      .orderBy(asc(availability.startTime));
  }

  async getAvailabilityByProvider(providerId: string, companyId?: number): Promise<Availability[]> {
    return await db
      .select()
      .from(availability)
      .where(
        and(
          companyId != null ? eq(availability.companyId, companyId) : and(eq(availability.providerId, providerId), isNull(availability.companyId)),
          eq(availability.isActive, true)
        )
      )
      .orderBy(asc(availability.createdAt));
  }

  async updateAvailability(id: number, updates: Partial<InsertAvailability>): Promise<Availability> {
    const [updated] = await db
      .update(availability)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(availability.id, id))
      .returning();
    return updated;
  }

  async deleteAvailability(id: number, providerId: string, companyId?: number): Promise<void> {
    await db
      .update(availability)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(availability.id, id),
          companyId != null ? eq(availability.companyId, companyId) : and(eq(availability.providerId, providerId), isNull(availability.companyId))
        )
      );
  }

  // Embedding operations for semantic search
  async upsertServiceEmbedding(embeddingData: InsertServiceEmbedding): Promise<ServiceEmbedding> {
    const [embedding] = await db
      .insert(serviceEmbeddings)
      .values(embeddingData)
      .onConflictDoUpdate({
        target: serviceEmbeddings.serviceId,
        set: {
          embedding: embeddingData.embedding,
          textContent: embeddingData.textContent,
          updatedAt: new Date(),
        },
      })
      .returning();
    return embedding;
  }

  async getServiceEmbedding(serviceId: number): Promise<ServiceEmbedding | undefined> {
    const [embedding] = await db
      .select()
      .from(serviceEmbeddings)
      .where(eq(serviceEmbeddings.serviceId, serviceId));
    return embedding;
  }

  async getAllServiceEmbeddings(): Promise<ServiceEmbedding[]> {
    return await db.select().from(serviceEmbeddings);
  }

  async getPublicServiceEmbeddings(filters: SearchFilters): Promise<{ serviceId: number; embedding: number[] }[]> {
    filters = searchFiltersSchema.parse(filters);
    const candidates = await db.select({ serviceId: serviceEmbeddings.serviceId, embedding: serviceEmbeddings.embedding })
      .from(serviceEmbeddings).innerJoin(services, eq(serviceEmbeddings.serviceId, services.id))
      .leftJoin(addresses, eq(services.addressId, addresses.id))
      .leftJoin(employees, eq(services.employeeId, employees.id))
      .leftJoin(companies, eq(services.companyId, companies.id))
      .where(and(...publicSearchConditions(filters)))
      .orderBy(desc(services.createdAt), desc(services.id)).limit(MAX_SEARCH_CANDIDATES + 1);
    assertSearchSize(candidates.length);
    return candidates;
  }

  async deleteServiceEmbedding(serviceId: number): Promise<void> {
    await db.delete(serviceEmbeddings).where(eq(serviceEmbeddings.serviceId, serviceId));
  }
}

export const storage = new DatabaseStorage();
