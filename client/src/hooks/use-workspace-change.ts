import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { WorkspaceContext } from "@shared/schema";
import { WORKSPACE_CHANGE_KEY } from "./use-provider-workspace";
import { useToast } from "./use-toast";
import { apiRequest } from "@/lib/queryClient";

const workspaceQueries = (key: unknown) => /^\/api\/(addresses|workspace\/pricing-settings|provider|company\/team|services\/provider|bookings\/provider|availability\/provider|notifications)/.test(String(key)) || key === "notification-preview";

/** Shared by the desktop workspace control and the mobile Menu. */
export function useWorkspaceChange() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const editing = /\/services\/(?:new|\d+\/edit)$/.test(location);
  return useMutation({
    mutationKey: WORKSPACE_CHANGE_KEY,
    onMutate: () => queryClient.cancelQueries({ predicate: query => workspaceQueries(query.queryKey[0]) }),
    mutationFn: async (companyId: number | null): Promise<WorkspaceContext> => (await apiRequest("POST", "/api/company/context", { companyId })).json(),
    onSuccess: async context => {
      await queryClient.resetQueries({ predicate: query => workspaceQueries(query.queryKey[0]) });
      queryClient.setQueryData(["/api/company/context"], context);
      if (editing) navigate("/my-services/services", { replace: true });
      else if ((location.startsWith("/my-services/availability") && !context.permissions.manageSchedules) || (location.startsWith("/my-services/settings") && !context.permissions.manageServices && !context.permissions.manageTeam && !context.permissions.isOwner)) navigate("/my-services/appointments", { replace: true });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: () => toast({ title: "Unable to switch workspace", description: "Please try again.", variant: "destructive" }),
  });
}
