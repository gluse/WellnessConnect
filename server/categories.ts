import { asc, eq } from "drizzle-orm";
import { categories } from "@shared/schema";
import { CategoryError, type CategoryInput } from "@shared/categories";
import { db } from "./db";

export const categoryStore = {
  list: () => db.select().from(categories).orderBy(asc(categories.name), asc(categories.key)),
  async create(input: CategoryInput) {
    const [category] = await db.insert(categories).values(input).returning();
    return category;
  },
  async update(key: string, input: Omit<CategoryInput, "key">) {
    const [category] = await db.update(categories).set(input).where(eq(categories.key, key)).returning();
    if (!category) throw new CategoryError(404, "Category not found.");
    return category;
  },
  async remove(key: string) {
    const [category] = await db.delete(categories).where(eq(categories.key, key)).returning();
    if (!category) throw new CategoryError(404, "Category not found.");
  },
};
