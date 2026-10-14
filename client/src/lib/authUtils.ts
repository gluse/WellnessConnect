import { apiRequest, queryClient } from "./queryClient";

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof Error && /^401:/.test(error.message);
}

export async function logout() {
  await apiRequest("POST", "/api/logout");
  queryClient.clear();
  window.location.assign("/");
}
