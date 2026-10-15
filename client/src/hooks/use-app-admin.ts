import { useQuery } from "@tanstack/react-query";
import type { AppAdminAccess } from "@shared/admin";
import { useAuth } from "@/hooks/useAuth";

export function useAppAdmin() {
  const { isAuthenticated } = useAuth();
  return useQuery<AppAdminAccess>({
    queryKey: ["/api/admin/access"], enabled: isAuthenticated,
    staleTime: 0, retry: false,
  });
}
