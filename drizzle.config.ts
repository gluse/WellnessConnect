import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  schemaFilter: ["public"],
  tablesFilter: ["sessions", "users", "services", "bookings", "service_embeddings", "availability", "service_reviews"],
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
