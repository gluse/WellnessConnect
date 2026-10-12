import {
  users,
  services,
  bookings,
  availability,
  serviceEmbeddings,
  type User,
  type UpsertUser,
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
import { eq, and, gte, lte, asc, desc, sql, ne } from "drizzle-orm";

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
  updateUserRole(id: string, role: "seeker" | "provider"): Promise<User>;

  // Service operations
  createService(service: InsertService): Promise<Service>;
  copyService(serviceId: number, providerId: string): Promise<Service | undefined>;
  getServicesByProvider(providerId: string): Promise<Service[]>;
  getServiceById(id: number): Promise<ServiceWithProvider | undefined>;
  updateService(id: number, updates: Partial<InsertService>): Promise<Service>;
  deleteService(id: number): Promise<void>;
  searchServices(filters: {
    category?: string;
    ageGroups?: string[];
    serviceType?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    date?: string;
    searchQuery?: string;
  }): Promise<ServiceWithProvider[]>;

  // Booking operations
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookingsBySeeker(seekerId: string): Promise<BookingWithDetails[]>;
  getBookingsByProvider(providerId: string): Promise<BookingWithDetails[]>;
  getBookingById(id: number): Promise<BookingWithDetails | undefined>;
  updateBookingStatus(id: number, status: string): Promise<Booking>;
  updateBookingPayment(id: number, paymentStatus: string): Promise<Booking>;
  getBookingsForServiceOnDate(serviceId: number, date: Date): Promise<Booking[]>;
  getBookingsForProviderOnDate(providerId: string, date: Date): Promise<Booking[]>;

  // Availability operations
  createAvailability(availability: InsertAvailability): Promise<Availability>;
  getAvailabilityByService(serviceId: number): Promise<Availability[]>;
  getAvailabilityByProvider(providerId: string): Promise<Availability[]>;
  updateAvailability(id: number, updates: Partial<InsertAvailability>): Promise<Availability>;
  deleteAvailability(id: number, providerId: string): Promise<void>;
  
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

  async updateUserRole(id: string, role: "seeker" | "provider"): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ currentRole: role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Service operations
  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db
      .insert(services)
      .values(service)
      .returning();
    return newService;
  }

  async copyService(serviceId: number, providerId: string): Promise<Service | undefined> {
    return db.transaction(async (tx) => {
      const [source] = await tx.select().from(services)
        .where(and(eq(services.id, serviceId), eq(services.providerId, providerId)));
      if (!source) return undefined;
      const { id, createdAt, updatedAt, ...listing } = source;
      const [copy] = await tx.insert(services).values({
        ...listing,
        name: `${source.name} (copy)`,
        isActive: false,
      }).returning();
      return copy;
    });
  }

  async getServicesByProvider(providerId: string): Promise<Service[]> {
    return await db
      .select()
      .from(services)
      .where(eq(services.providerId, providerId))
      .orderBy(desc(services.createdAt));
  }

  async getServiceById(id: number): Promise<ServiceWithProvider | undefined> {
    const [result] = await db
      .select()
      .from(services)
      .leftJoin(users, eq(services.providerId, users.id))
      .where(eq(services.id, id));

    if (!result) return undefined;

    return {
      ...result.services,
      provider: result.users!,
    };
  }

  async updateService(id: number, updates: Partial<InsertService>): Promise<Service> {
    const [service] = await db
      .update(services)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(services.id, id))
      .returning();
    return service;
  }

  async deleteService(id: number): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  async searchServices(filters: {
    category?: string;
    ageGroups?: string[];
    serviceType?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    date?: string;
    dateEnd?: string;
    time?: string;
    timeEnd?: string;
    searchQuery?: string;
    availableOnly?: boolean;
  }): Promise<ServiceWithProvider[]> {
    const conditions = [eq(services.isActive, true)];

    if (filters.category) {
      conditions.push(eq(services.category, filters.category as any));
    }

    if (filters.serviceType) {
      conditions.push(eq(services.serviceType, filters.serviceType as any));
    }

    // Search by name or description (case-insensitive)
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const searchTerm = `%${filters.searchQuery.trim().toLowerCase()}%`;
      conditions.push(
        sql`(LOWER(${services.name}) LIKE ${searchTerm} OR LOWER(${services.description}) LIKE ${searchTerm})`
      );
    }

    const results = await db
      .select()
      .from(services)
      .leftJoin(users, eq(services.providerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(services.createdAt));

    let servicesWithProviders: ServiceWithProvider[] = results.map(result => ({
      ...result.services,
      provider: result.users!,
    }));

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
      
      // Get all availability schedules
      const allAvailability = await db.select().from(availability);
      
      // Get all bookings to check for conflicts
      const allBookings = await db.select().from(bookings);
      
      // Build a map of provider ID -> available time slots
      const providerAvailability = new Map<string, boolean>();
      
      // Check each date in the range
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const currentDate = new Date(d);
        const dayOfWeek = currentDate.getDay();
        const dateStr = currentDate.toISOString().split('T')[0];
        
        for (const schedule of allAvailability) {
          if (!schedule.isActive) continue;
          
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
                providerAvailability.set(schedule.providerId, true);
              } else {
                // Check if there's still available time outside breaks that covers the filter range
                // For simplicity, if any break overlaps with the requested time, we're conservative
                // and still allow if schedule extends beyond the break
                const scheduleCoversBeforeBreak = breaks.every(brk => 
                  filterEnd <= brk.startTime || filterStart >= brk.endTime
                );
                if (scheduleCoversBeforeBreak) {
                  providerAvailability.set(schedule.providerId, true);
                }
              }
            }
          } else {
            // No time filter - just check if any schedule exists for the date
            providerAvailability.set(schedule.providerId, true);
          }
        }
      }
      
      servicesWithProviders = servicesWithProviders.filter(
        service => providerAvailability.get(service.providerId) === true
      );
    }

    return servicesWithProviders;
  }

  // Booking operations
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [newBooking] = await db
      .insert(bookings)
      .values(booking)
      .returning();
    return newBooking;
  }

  async getBookingsBySeeker(seekerId: string): Promise<BookingWithDetails[]> {
    const results = await db
      .select()
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(users, eq(bookings.providerId, users.id))
      .where(eq(bookings.seekerId, seekerId))
      .orderBy(desc(bookings.createdAt));

    return results.map(result => ({
      ...result.bookings,
      service: result.services!,
      seeker: { id: seekerId } as User,
      provider: result.users!,
    }));
  }

  async getBookingsByProvider(providerId: string): Promise<BookingWithDetails[]> {
    const results = await db
      .select()
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(users, eq(bookings.seekerId, users.id))
      .where(eq(bookings.providerId, providerId))
      .orderBy(desc(bookings.createdAt));

    return results.map(result => ({
      ...result.bookings,
      service: result.services!,
      seeker: result.users!,
      provider: { id: providerId } as User,
    }));
  }

  async getBookingById(id: number): Promise<BookingWithDetails | undefined> {
    const [result] = await db
      .select()
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(users, eq(bookings.seekerId, users.id))
      .where(eq(bookings.id, id));

    if (!result) return undefined;

    return {
      ...result.bookings,
      service: result.services!,
      seeker: result.users!,
      provider: { id: result.bookings.providerId } as User,
    };
  }

  async updateBookingStatus(id: number, status: string): Promise<Booking> {
    const [booking] = await db
      .update(bookings)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async updateBookingPayment(id: number, paymentStatus: string): Promise<Booking> {
    const [booking] = await db
      .update(bookings)
      .set({ paymentStatus: paymentStatus as any, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
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
          ne(bookings.status, "cancelled")
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
          ne(bookings.status, "cancelled")
        )
      )
      .orderBy(asc(bookings.scheduledDate));
  }

  // Availability operations
  async createAvailability(availabilityData: InsertAvailability): Promise<Availability> {
    const [newAvailability] = await db
      .insert(availability)
      .values(availabilityData)
      .returning();
    return newAvailability;
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

  async getAvailabilityByProvider(providerId: string): Promise<Availability[]> {
    return await db
      .select()
      .from(availability)
      .where(
        and(
          eq(availability.providerId, providerId),
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

  async deleteAvailability(id: number, providerId: string): Promise<void> {
    await db
      .update(availability)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(availability.id, id),
          eq(availability.providerId, providerId)
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

  async deleteServiceEmbedding(serviceId: number): Promise<void> {
    await db.delete(serviceEmbeddings).where(eq(serviceEmbeddings.serviceId, serviceId));
  }
}

export const storage = new DatabaseStorage();
