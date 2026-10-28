import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { BILLING_V2_PROFILE_TABLES as BILLING_PROFILE_TABLES } from "./migrations/billing/v2-contract.mjs";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  schemaFilter: ["public"],
  // Default scope is unchanged; TASK-024 billing requires explicit local opt-in.
  // This is schema-preparation scope, never permission to run db:push.
  tablesFilter: process.env.BILLING_SCHEMA_PROFILE === "choice2" ? [...BILLING_PROFILE_TABLES] :
    ["sessions", "users", "services", "bookings", "service_embeddings", "availability", "service_reviews", "geocoding_cache", "categories", "provider_subscriptions", "storefronts"],
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
