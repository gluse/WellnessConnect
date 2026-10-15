import { passwordChangeResultSchema, type PasswordChange } from "@shared/password";
import { apiRequest } from "@/lib/queryClient";

export class PasswordUpdateResponseError extends Error {
  constructor() {
    super("Could not confirm the password update. Reload the page and sign in again if needed.");
  }
}

export async function updateAccountPassword(passwords: PasswordChange) {
  const response = await apiRequest("POST", "/api/auth/password", passwords);
  if (!response.headers.get("Content-Type")?.toLowerCase().includes("application/json")) throw new PasswordUpdateResponseError();
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new PasswordUpdateResponseError(); }
  const parsed = passwordChangeResultSchema.safeParse(body);
  if (!parsed.success) throw new PasswordUpdateResponseError();
  return parsed.data;
}
