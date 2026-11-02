import { useIsMutating, useQuery } from "@tanstack/react-query";
import type { NotificationCapabilities } from "@shared/notifications";
import { useAuth } from "./useAuth";
import { useProviderWorkspace, WORKSPACE_CHANGE_KEY } from "./use-provider-workspace";
import { apiRequest } from "@/lib/queryClient";

export function useNotificationCapabilities() {
  const { user } = useAuth();
  const workspace = useProviderWorkspace();
  const switching = useIsMutating({ mutationKey: WORKSPACE_CHANGE_KEY }) > 0;
  return useQuery<NotificationCapabilities>({
    queryKey: ["/api/notifications/capabilities", user?.id, workspace.data?.company?.id ?? "personal"],
    queryFn: async ({ signal }) => (await apiRequest("GET", "/api/notifications/capabilities", undefined, signal)).json(),
    enabled: Boolean(user && workspace.data && !switching), staleTime: 0, gcTime: 0, retry: false,
    refetchInterval: 60_000,
  });
}
