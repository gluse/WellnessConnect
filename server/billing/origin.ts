import { BillingError } from "./contracts";

/** HTTP is a development sandbox exception, never a production redirect policy. */
export function billingReturnOrigin(value: string, context?: { environment: string; mode: string; localSandbox: boolean }) {
  let url: URL;
  try { url = new URL(value); } catch { throw new BillingError("INVALID_INPUT"); }
  const local = context?.localSandbox === true && context.environment === "development" && context.mode === "test" &&
    url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.origin !== value || url.username || url.password || (url.protocol !== "https:" && !local))
    throw new BillingError("INVALID_INPUT");
  return url;
}
