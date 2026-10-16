import { z } from "zod";

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Choose a rating from 1 to 5.").max(5),
  comment: z.string().trim().max(2000, "Comments must be 2,000 characters or fewer.").default(""),
}).strict().refine(value => value.rating >= 3 || value.comment.length > 0, {
  path: ["comment"], message: "Please add a comment for a rating below 3 stars.",
});

export type ReviewInput = z.infer<typeof reviewSchema>;

export type PublicServiceReview = {
  id: number;
  rating: number;
  comment: string;
  reviewerName: string | null;
  createdAt: string;
};

export type ServiceReviewPage = {
  reviews: PublicServiceReview[];
  page: number;
  hasMore: boolean;
};

export class ReviewError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
