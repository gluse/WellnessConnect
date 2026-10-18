import { z } from "zod";
import { validDateKey } from "@shared/scheduling";

export const MAX_SEARCH_DAYS = 31;
export const MAX_SEARCH_CANDIDATES = 500;
export const MAX_SEARCH_SCHEDULES = 5000;
export const MAX_SEMANTIC_RESULTS = 100;

export class SearchError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const date = z.string().refine(validDateKey, "Choose a valid date in YYYY-MM-DD format.");
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Choose a valid time in HH:mm format.");
const ageGroup = z.enum(["children", "teens", "adults", "seniors"]);
const filterShape = {
  category: z.string().trim().min(1).max(64).optional(),
  serviceType: z.enum(["one_to_one", "group"]).optional(),
  ageGroups: z.array(ageGroup).max(4).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  radius: z.number().finite().positive().max(20000).optional(),
  date: date.optional(), dateEnd: date.optional(),
  time: clock.optional(), timeEnd: clock.optional(),
  availableOnly: z.boolean().optional(),
  searchQuery: z.string().trim().max(200).optional(),
  companyId: z.number().int().positive().max(2147483647).optional(),
  providerId: z.string().trim().min(1).max(128).optional(),
  serviceIds: z.array(z.number().int().positive()).max(MAX_SEARCH_CANDIDATES).optional(),
};
const filterObject = z.object(filterShape).strict();
type FilterInput = z.infer<typeof filterObject>;
function checkRanges(value: FilterInput, context: z.RefinementCtx) {
  const issue = (path: string, message: string) => context.addIssue({ code: "custom", path: [path], message });
  if (value.dateEnd && !value.date) issue("dateEnd", "Choose a start date before an end date.");
  if (value.availableOnly && !value.date) issue("date", "Choose a date when filtering by availability.");
  if (value.date && value.dateEnd) {
    const days = (Date.parse(value.dateEnd) - Date.parse(value.date)) / 86400000 + 1;
    if (days < 1 || days > MAX_SEARCH_DAYS) issue("dateEnd", `Choose a date range of at most ${MAX_SEARCH_DAYS} days.`);
  }
  if (value.time && value.timeEnd && value.timeEnd <= value.time) issue("timeEnd", "End time must be after start time.");
  const locationFields = [value.latitude, value.longitude, value.radius].filter(item => item !== undefined).length;
  if (locationFields !== 0 && locationFields !== 3) issue("latitude", "Provide latitude, longitude, and radius together.");
}
export const searchFiltersSchema = filterObject.superRefine(checkRanges);
export type SearchFilters = z.infer<typeof searchFiltersSchema>;

const numericQuery = (schema: z.ZodNumber) => z.preprocess(value =>
  typeof value === "string" && value.trim() !== "" ? Number(value) : value, schema.optional());
const queryShape = {
  ...filterShape,
  latitude: numericQuery(z.number().finite().min(-90).max(90)),
  longitude: numericQuery(z.number().finite().min(-180).max(180)),
  radius: numericQuery(z.number().finite().positive().max(20000)),
  ageGroups: z.union([ageGroup, z.array(ageGroup).max(4)]).transform(value => typeof value === "string" ? [value] : value).optional(),
  availableOnly: z.enum(["true", "false"]).transform(value => value === "true").optional(),
};
const publicQuery = z.object(queryShape).omit({ companyId: true, providerId: true, serviceIds: true });
export const publicSearchSchema = publicQuery.strict().superRefine(checkRanges);
export const semanticSearchSchema = publicQuery.omit({ searchQuery: true }).extend({
  query: z.string().trim().min(1).max(200),
}).strict().superRefine(checkRanges);

export function assertSearchSize(size: number, maximum = MAX_SEARCH_CANDIDATES) {
  if (size > maximum) throw new SearchError(422, "SEARCH_TOO_BROAD", "This search is too broad. Narrow the category, location, or search text.");
}
