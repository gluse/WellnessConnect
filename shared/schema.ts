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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  currentRole: varchar("current_role", { enum: ["seeker", "provider"] }).default("seeker"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Services table
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id").references(() => users.id).notNull(),
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
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bookings table
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  seekerId: varchar("seeker_id").references(() => users.id).notNull(),
  providerId: varchar("provider_id").references(() => users.id).notNull(),
  participantCount: integer("participant_count").default(1),
  scheduledDate: timestamp("scheduled_date").notNull(),
  status: varchar("status", { enum: ["pending", "confirmed", "cancelled", "completed"] }).default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  advanceAmount: decimal("advance_amount", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: varchar("payment_status", { enum: ["pending", "advance_paid", "fully_paid"] }).default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Availability table
export const availability = pgTable("availability", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  providerId: varchar("provider_id").references(() => users.id).notNull(),
  
  // Schedule type
  scheduleType: varchar("schedule_type", { enum: ["specific", "recurring"] }).notNull(),
  
  // For specific date/time
  specificDate: timestamp("specific_date"),
  
  // For recurring schedules
  daysOfWeek: jsonb("days_of_week").$type<number[]>(), // [0-6] where 0=Sunday
  
  // Time slots (HH:MM format)
  startTime: varchar("start_time").notNull(),
  endTime: varchar("end_time").notNull(),
  
  // Timezone
  timezone: varchar("timezone").notNull().default("UTC"),
  
  // Recurrence end conditions (for recurring only)
  recurrenceEndType: varchar("recurrence_end_type", { enum: ["never", "after_events", "on_date"] }),
  recurrenceEndValue: varchar("recurrence_end_value"), // number of events or date string
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

export type InsertService = typeof services.$inferInsert;
export type Service = typeof services.$inferSelect;

export type InsertBooking = typeof bookings.$inferInsert;
export type Booking = typeof bookings.$inferSelect;

export type InsertAvailability = typeof availability.$inferInsert;
export type Availability = typeof availability.$inferSelect;

// Schemas
export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAvailabilitySchema = createInsertSchema(availability).omit({
  id: true,
  createdAt: true,
});

// Extended service type for API responses
export type ServiceWithProvider = Service & {
  provider: User;
  availableCapacity?: number;
  nextAvailability?: string;
};

export type BookingWithDetails = Booking & {
  service: Service;
  seeker: User;
  provider: User;
};
