import { apiRequest, queryClient } from "./queryClient";

export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export async function logout() {
  await apiRequest("POST", "/api/logout");
  queryClient.clear();
  window.location.assign("/");
}
