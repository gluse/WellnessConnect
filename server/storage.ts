import {
  users,
  services,
  bookings,
  availability,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, asc, desc, sql, ne } from "drizzle-orm";

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
  }): Promise<ServiceWithProvider[]>;

  // Booking operations
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookingsBySeeker(seekerId: string): Promise<BookingWithDetails[]>;
  getBookingsByProvider(providerId: string): Promise<BookingWithDetails[]>;
  getBookingById(id: number): Promise<BookingWithDetails | undefined>;
  updateBookingStatus(id: number, status: string): Promise<Booking>;
  updateBookingPayment(id: number, paymentStatus: string): Promise<Booking>;

  // Availability operations
  createAvailability(availability: InsertAvailability): Promise<Availability>;
  getAvailabilityByService(serviceId: number): Promise<Availability[]>;
  getAvailabilityByProvider(providerId: string): Promise<Availability[]>;
  updateAvailability(id: number, updates: Partial<InsertAvailability>): Promise<Availability>;
  deleteAvailability(id: number, providerId: string): Promise<void>;
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
  }): Promise<ServiceWithProvider[]> {
    let query = db
      .select()
      .from(services)
      .leftJoin(users, eq(services.providerId, users.id))
      .where(eq(services.isActive, true));

    if (filters.category) {
      query = query.where(eq(services.category, filters.category));
    }

    if (filters.serviceType) {
      query = query.where(eq(services.serviceType, filters.serviceType));
    }

    const results = await query.orderBy(desc(services.createdAt));

    return results.map(result => ({
      ...result.services,
      provider: result.users!,
    }));
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
      .set({ status, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async updateBookingPayment(id: number, paymentStatus: string): Promise<Booking> {
    const [booking] = await db
      .update(bookings)
      .set({ paymentStatus, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
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
}

export const storage = new DatabaseStorage();
