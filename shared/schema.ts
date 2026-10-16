import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  real,
  primaryKey,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  // Stable legacy billing/storage anchor; ownership can transfer independently.
  providerId: varchar("provider_id").references(() => users.id).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}).enableRLS();

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

// Services table
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  employeeId: integer("employee_id").references(() => employees.id),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category", { enum: ["health_wellness", "education", "entertainment"] }).notNull(),
  serviceType: varchar("service_type", { enum: ["one_to_one", "group"] }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  duration: integer("duration").notNull(), // in minutes
  maxCapacity: integer("max_capacity").default(1),
  ageGroups: jsonb("age_groups").$type<string[]>().default([]), // ["children", "teens", "adults", "seniors"]
  targetGender: varchar("target_gender", { enum: ["females", "males", "both"] }).default("both"),
  instantBooking: boolean("instant_booking").default(false),
  advancePaymentPercent: integer("advance_payment_percent").default(50),
  latitude: real("latitude"),
  longitude: real("longitude"),
  address: text("address"),
  imageUrl: text("image_url"),
  externalUrl: text("external_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  status: varchar("status", { enum: ["pending", "confirmed", "cancelled", "completed"] }).default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  advanceAmount: decimal("advance_amount", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: varchar("payment_status", { enum: ["pending", "advance_paid", "fully_paid"] }).default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("bookings_employee_date_idx").on(table.employeeId, table.scheduledDate)]).enableRLS();

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
  services: many(services),
  bookings: many(bookings),
  availabilities: many(availability),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  provider: one(users, {
    fields: [services.providerId],
    references: [users.id],
  }),
  bookings: many(bookings),
  availability: many(availability),
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
export type Service = typeof services.$inferSelect;

export type InsertBooking = typeof bookings.$inferInsert;
export type Booking = typeof bookings.$inferSelect;

export type InsertAvailability = typeof availability.$inferInsert;
export type Availability = typeof availability.$inferSelect;

export type InsertServiceEmbedding = typeof serviceEmbeddings.$inferInsert;
export type ServiceEmbedding = typeof serviceEmbeddings.$inferSelect;

// Schemas
export const insertServiceSchema = createInsertSchema(services, {
  ageGroups: z.array(z.string()).nullable().optional(),
  employeeId: z.number().int().positive().nullable().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
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
