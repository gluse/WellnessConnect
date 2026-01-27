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
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRole(id: string, role: "seeker" | "provider"): Promise<User>;

  // Service operations
  createService(service: InsertService): Promise<Service>;
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
    searchQuery?: string;
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
