import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { AuditAccess } from "@/lib/audit-viewer";

export function useAuditAccess() {
  const { user } = useAuth();
  return useQuery<AuditAccess>({
    queryKey: ["/api/admin/audit/access", user?.id], enabled: Boolean(user),
    queryFn: async ({ signal }) => (await apiRequest("GET", "/api/admin/audit/access", undefined, signal)).json(),
    staleTime: 0, gcTime: 0, retry: false,
  });
}
