import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { startLocationExpiry } from "./location-expiry";

export class ApiResponseError extends Error {
  readonly status: number;
  readonly stagingAccessRequired: boolean;
  constructor(response: Response, text: string) {
    super(`${response.status}: ${text}`);
    this.status = response.status;
    this.stagingAccessRequired = response.status === 401
      && /^Basic\s/i.test(response.headers.get("WWW-Authenticate") || "");
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new ApiResponseError(res, text);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  signal?: AbortSignal,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      signal,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
if (typeof window !== "undefined") {
  const stopExpiry = startLocationExpiry(queryClient);
  if (import.meta.hot) import.meta.hot.dispose(stopExpiry);
}
