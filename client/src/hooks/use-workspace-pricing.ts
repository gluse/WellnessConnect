import { useIsMutating, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useProviderWorkspace, WORKSPACE_CHANGE_KEY } from "./use-provider-workspace";
import { workspacePricingSettingsViewSchema, type WorkspacePricingSettingsView } from "@shared/workspace-pricing";

export function useWorkspacePricing(actorId: string | undefined, loadSettings = true) {
  const context = useProviderWorkspace();
  const switching = useIsMutating({ mutationKey: WORKSPACE_CHANGE_KEY }) > 0;
  const allowed = Boolean(actorId && context.data && !context.isError && !context.data.invalid && context.data.permissions?.manageServices);
  const companyId = context.data?.company?.id;
  const scope = allowed ? companyId != null ? `company:${companyId}` : `user:${actorId}` : null;
  const settings = useQuery<WorkspacePricingSettingsView>({
    queryKey: ["/api/workspace/pricing-settings", actorId, companyId ?? "personal"],
    enabled: allowed && !switching && loadSettings, staleTime: 0, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const response = await apiRequest("GET", "/api/workspace/pricing-settings", undefined, signal);
      const parsed = workspacePricingSettingsViewSchema.parse(await response.json());
      if (`${parsed.workspace.kind}:${parsed.workspace.id}` !== scope) throw new Error("Workspace pricing scope changed");
      return parsed;
    },
  });
  const loading = Boolean(actorId && (switching || context.isPending || (loadSettings && allowed && settings.isPending)));
  const error = context.error || (loadSettings && allowed ? settings.error : null);
  const denied = loadSettings && settings.error instanceof Error && /^(401|403):/.test(settings.error.message);
  return { context, settings, scope: denied ? null : scope, loading, allowed: allowed && !denied, error, switching,
    retry: () => { if (context.isError) void context.refetch(); else void settings.refetch(); } };
}
