import { z } from "zod";

export const categoryKeySchema = z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores; start with a letter.")
  .refine(value => value !== "all", "This key is reserved.");
export const categoryDetailsSchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(100),
  icon: z.string().trim().max(16).default(""),
  searchKeywords: z.string().trim().max(1000).default(""),
}).strict();
export const createCategorySchema = categoryDetailsSchema.extend({ key: categoryKeySchema });
export type CategoryInput = z.infer<typeof createCategorySchema>;

export class CategoryError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
