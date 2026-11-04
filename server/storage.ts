import {
  users,
  employees,
  companies,
  services,
  addresses,
  bookings,
  bookingMessages,
  bookingRescheduleRequests,
  availability,
  serviceEmbeddings,
  serviceReviews,
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
import { availableCapacity, bookableSlots, OCCUPYING_BOOKING_STATUSES } from "@shared/scheduling";
import { reviewSchema, ReviewError, type ReviewInput, type ServiceReviewPage } from "@shared/reviews";
import { assertSearchSize, MAX_SEARCH_CANDIDATES, MAX_SEARCH_SCHEDULES, searchFiltersSchema, type SearchFilters } from "./searchInput";
import { assertCustomerBookingChange } from "./customerBookings";
import { assertReminderConfiguration, captureStatusEvent, reconcileBookingReminder, reconcileServiceReminders } from "./notifications/repository";
import { statusAction } from "./notifications/policy";
import type { NotificationSummary } from "@shared/notifications";
import { randomUUID } from "node:crypto";

type NotificationBooking = Booking & { notification?: NotificationSummary };

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
  const conditions = [eq(services.isActive, true), sql`(${companies.id} IS NULL OR ${companies.isActive} = true)`];
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
  id?: number; providerId: string; employeeId?: number | null; scheduledDate: Date;
  bookingDuration: number; bookingCleanupTime: number; participantCount?: number | null;
}) {
  const start = candidate.scheduledDate;
  const end = new Date(start.getTime() + (candidate.bookingDuration + candidate.bookingCleanupTime) * 60_000);
  const overlapping = await tx.select({ booking: bookings, duration: services.duration }).from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(and(candidate.id === undefined ? undefined : ne(bookings.id, candidate.id),
      eq(bookings.providerId, candidate.providerId), inArray(bookings.status, [...OCCUPYING_BOOKING_STATUSES]),
      candidate.employeeId != null ? eq(bookings.employeeId, candidate.employeeId) : isNull(bookings.employeeId),
      sql`${bookings.scheduledDate} < ${end.toISOString()}::timestamp`,
      sql`${bookings.scheduledDate} + (COALESCE(${bookings.bookingDuration}, ${services.duration}, 60) + COALESCE(${bookings.bookingCleanupTime}, 0)) * interval '1 minute' > ${start.toISOString()}::timestamp`));
  const count = candidate.participantCount ?? 1;
  const remaining = availableCapacity({ ...service, duration: candidate.bookingDuration, cleanupTime: candidate.bookingCleanupTime },
    overlapping.map(row => ({ ...row.booking, bookingDuration: row.booking.bookingDuration ?? row.duration ?? 60 })), start);
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
  createService(service: InsertService): Promise<Service>;
  copyService(serviceId: number, providerId: string, companyId?: number): Promise<Service | undefined>;
  getServicesByProvider(providerId: string, companyId?: number): Promise<Service[]>;
  getServiceById(id: number): Promise<ServiceWithProvider | undefined>;
  updateService(id: number, updates: Partial<InsertService>): Promise<Service>;
  deleteService(id: number): Promise<void>;
  searchServices(filters: SearchFilters): Promise<ServiceWithProvider[]>;
  getPublicServiceEmbeddings(filters: SearchFilters): Promise<{ serviceId: number; embedding: number[] }[]>;

  // Booking operations
  createBooking(booking: InsertBooking, initialMessage?: string | null): Promise<Booking>;
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
  getBookingsForResourceOnDate(service: Service, date: Date): Promise<Booking[]>;
  getBookingsForResourceRange(service: Service, start: Date, end: Date): Promise<Booking[]>;

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

  async createService(service: InsertService): Promise<Service> {
    const newService = await db.transaction(async tx => {
      await assertReminderConfiguration(tx, service, service);
      const [created] = await tx.insert(services).values(service).returning();
      return created;
    });
    return serviceLocation(newService, newService.addressId == null ? null : (await db.select().from(addresses).where(eq(addresses.id, newService.addressId)))[0]);
  }

  async copyService(serviceId: number, providerId: string, companyId?: number): Promise<Service | undefined> {
    const copy = await db.transaction(async (tx) => {
      const [source] = await tx.select().from(services)
        .where(and(eq(services.id, serviceId), companyId != null ? eq(services.companyId, companyId) : and(eq(services.providerId, providerId), isNull(services.companyId))));
      if (!source) return undefined;
      const { id, createdAt, updatedAt, ...listing } = source;
      const [copy] = await tx.insert(services).values({
        ...listing,
        name: `${source.name} (copy)`,
        isActive: false,
        reminderEnabled: false,
      }).returning();
      return copy;
    });
    return copy ? serviceLocation(copy, copy.addressId == null ? null : (await db.select().from(addresses).where(eq(addresses.id, copy.addressId)))[0]) : undefined;
  }

  async getServicesByProvider(providerId: string, companyId?: number): Promise<Service[]> {
    const rows = await db
      .select()
      .from(services)
      .leftJoin(addresses, eq(services.addressId, addresses.id))
      .where(companyId != null ? eq(services.companyId, companyId) : and(eq(services.providerId, providerId), isNull(services.companyId)))
      .orderBy(desc(services.createdAt));
    return rows.map(row => serviceLocation(row.services, row.addresses));
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
      .where(eq(services.id, id));

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

  async updateService(id: number, updates: Partial<InsertService>): Promise<Service> {
    const service = await db.transaction(async tx => {
      const [previous] = await tx.select().from(services).where(eq(services.id, id)).for("update");
      if (!previous) throw new BookingConflictError("Service not found.");
      await assertReminderConfiguration(tx, previous, updates, previous);
      const [updated] = await tx.update(services).set({ ...updates, updatedAt: new Date() }).where(eq(services.id, id)).returning();
      if (updated.reminderEnabled !== previous.reminderEnabled || updated.reminderMethod !== previous.reminderMethod || updated.reminderHours !== previous.reminderHours) await reconcileServiceReminders(tx, id);
      return updated;
    });
    return serviceLocation(service, service.addressId == null ? null : (await db.select().from(addresses).where(eq(addresses.id, service.addressId)))[0]);
  }

  async deleteService(id: number): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
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
      
      // Track general and service-specific working hours separately for company offers.
      const providerAvailability = new Map<string, boolean>();
      
      // Check each date in the range
      for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
        const currentDate = new Date(d);
        const dayOfWeek = currentDate.getUTCDay();
        const dateStr = currentDate.toISOString().split('T')[0];
        
        for (const schedule of allAvailability) {
          if (!schedule.isActive) continue;
          const scheduleKey = `${workspaceKey(schedule)}:${schedule.serviceId ?? "all"}`;
          
          // Check if schedule applies to this date
          const scheduleApplies = 
            (schedule.scheduleType === 'specific' && 
             schedule.specificDate && 
             new Date(schedule.specificDate).toISOString().split('T')[0] === dateStr) ||
            (schedule.scheduleType === 'recurring' && 
             schedule.daysOfWeek && 
             (schedule.daysOfWeek as number[]).includes(dayOfWeek));
          
          if (!scheduleApplies) continue;
          
          // Parse schedule times
          const schedStart = schedule.startTime || "00:00";
          const schedEnd = schedule.endTime || "23:59";
          const breaks = (schedule.breaks as { startTime: string; endTime: string }[] | null) || [];
          
          // If time filters specified, check for overlap
          if (filters.time || filters.timeEnd) {
            const filterStart = filters.time || "00:00";
            const filterEnd = filters.timeEnd || "23:59";
            
            // Check if requested time range overlaps with schedule
            const hasOverlap = filterStart < schedEnd && filterEnd > schedStart;
            
            if (hasOverlap) {
              // Check if there's any overlap with a break (any overlap = blocked during that time)
              const overlapsWithBreak = breaks.some(brk => 
                filterStart < brk.endTime && filterEnd > brk.startTime
              );
              
              // If no break overlap, or if the available time outside breaks still covers filter range
              if (!overlapsWithBreak) {
                providerAvailability.set(scheduleKey, true);
              } else {
                // Check if there's still available time outside breaks that covers the filter range
                // For simplicity, if any break overlaps with the requested time, we're conservative
                // and still allow if schedule extends beyond the break
                const scheduleCoversBeforeBreak = breaks.every(brk => 
                  filterEnd <= brk.startTime || filterStart >= brk.endTime
                );
                if (scheduleCoversBeforeBreak) {
                  providerAvailability.set(scheduleKey, true);
                }
              }
            }
          } else {
            // No time filter - just check if any schedule exists for the date
            providerAvailability.set(scheduleKey, true);
          }
        }
      }
      
      servicesWithProviders = servicesWithProviders.filter(
        service => providerAvailability.get(`${workspaceKey(service)}:all`) === true
          || providerAvailability.get(`${workspaceKey(service)}:${service.id}`) === true
      );
    }

    return filters.limit ? servicesWithProviders.slice(0, filters.limit) : servicesWithProviders;
  }

  // Booking operations
  async createBooking(booking: InsertBooking, initialMessage?: string | null): Promise<Booking> {
    return db.transaction(async tx => {
      // Serialize check + insert for this administrator, including simultaneous requests.
      await tx.execute(sql`SELECT id FROM users WHERE id = ${booking.providerId} FOR UPDATE`);
      const [service] = await tx.select().from(services).where(eq(services.id, booking.serviceId)).for("share");
      if (!service?.isActive || service.providerId !== booking.providerId || service.employeeId !== (booking.employeeId ?? null)) throw new BookingConflictError("The service has changed. Please choose a time again.");
      const schedules = await tx.select().from(availability).where(and(
        service.companyId != null ? eq(availability.companyId, service.companyId) : and(eq(availability.providerId, service.providerId), isNull(availability.companyId)), eq(availability.isActive, true)));
      const offered = bookableSlots({ service, schedules, bookings: [], date: booking.scheduledDate.toISOString().slice(0, 10), timezone: "UTC" });
      if (!offered.some(slot => slot.startsAt === booking.scheduledDate.toISOString())) throw new BookingConflictError("This time is outside the available working hours.");
      await assertResourceAvailable(tx, service, { ...booking, bookingDuration: service.duration, bookingCleanupTime: service.cleanupTime });
      const createdAt = new Date();
      const [created] = await tx.insert(bookings).values({ ...booking, notes: null, createdAt, bookingDuration: service.duration, bookingCleanupTime: service.cleanupTime }).returning();
      if (initialMessage) {
        await tx.insert(bookingMessages).values({ id: randomUUID(), bookingId: created.id, authorId: created.seekerId,
          authorRole: "customer", body: initialMessage, clientRequestId: randomUUID(), broadcastId: null, createdAt });
      }
      await reconcileBookingReminder(tx, created, new Date(), schedules.find(item => item.serviceId === service.id)?.timezone ?? schedules[0]?.timezone ?? "UTC");
      return created;
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
      ...result.bookings,
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
      ...result.bookings,
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
      ...result.bookings,
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
      if (booking.status === status) return { ...booking, notification: { mode: "none" as const } };
      const [updated] = await tx.update(bookings).set({ status: status as Booking["status"], notificationRevision: booking.notificationRevision + 1,
        closedAt: status === "completed" || status === "cancelled" ? booking.closedAt ?? new Date() : null, updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
      await tx.update(bookingRescheduleRequests).set({ state: "superseded" }).where(and(eq(bookingRescheduleRequests.bookingId, id), eq(bookingRescheduleRequests.state, "pending")));
      const action = seekerId === undefined ? statusAction(booking.status, updated.status) : null;
      const notification = action ? await captureStatusEvent(tx, updated, action, timeZone) : { mode: "none" as const };
      await reconcileBookingReminder(tx, updated, new Date(), timeZone);
      return { ...updated, notification };
    });
  }

  async updateBookingPayment(id: number, paymentStatus: string): Promise<Booking> {
    const [booking] = await db
      .update(bookings)
      .set({ paymentStatus: paymentStatus as any, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
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
      if (booking.scheduledDate.getTime() === date.getTime()) return { ...booking, notification: { mode: "none" as const } };
      const [service] = await tx.select().from(services).where(eq(services.id, booking.serviceId));
      const schedules = await tx.select().from(availability).where(and(
        booking.companyId != null ? eq(availability.companyId, booking.companyId) : and(eq(availability.providerId, booking.providerId), isNull(availability.companyId)), eq(availability.isActive, true)));
      const offered = bookableSlots({ service: { ...service, duration: booking.bookingDuration ?? service.duration, cleanupTime: booking.bookingCleanupTime ?? 0 }, schedules, bookings: [], date: date.toISOString().slice(0, 10), timezone: "UTC" });
      if (!offered.some(slot => slot.startsAt === date.toISOString())) throw new BookingConflictError("Choose a time within the available working hours.");
      await assertResourceAvailable(tx, service, { ...booking, scheduledDate: date, bookingDuration: booking.bookingDuration ?? service.duration, bookingCleanupTime: booking.bookingCleanupTime ?? 0 });
      const [updated] = await tx.update(bookings).set({ scheduledDate: date, notificationRevision: booking.notificationRevision + 1, updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
      const notification = seekerId === undefined ? await captureStatusEvent(tx, updated, "rescheduled", timeZone, booking.scheduledDate) : { mode: "none" as const };
      await reconcileBookingReminder(tx, updated, new Date(), timeZone);
      return { ...updated, notification };
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
  async getBookingsForResourceOnDate(service: Service, date: Date): Promise<Booking[]> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return this.getBookingsForResourceRange(service, start, end);
  }

  async getBookingsForResourceRange(service: Service, start: Date, end: Date): Promise<Booking[]> {
    const rows = await db.select({ booking: bookings, duration: services.duration }).from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.providerId, service.providerId), inArray(bookings.status, [...OCCUPYING_BOOKING_STATUSES]),
        service.employeeId != null ? eq(bookings.employeeId, service.employeeId) : sql`${bookings.employeeId} IS NULL`,
        sql`${bookings.scheduledDate} < ${end.toISOString()}::timestamp`,
        sql`${bookings.scheduledDate} + (COALESCE(${bookings.bookingDuration}, ${services.duration}, 60) + COALESCE(${bookings.bookingCleanupTime}, 0)) * interval '1 minute' > ${start.toISOString()}::timestamp`));
    return rows.map(row => ({ ...row.booking, bookingDuration: row.booking.bookingDuration ?? row.duration ?? 60 }));
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
