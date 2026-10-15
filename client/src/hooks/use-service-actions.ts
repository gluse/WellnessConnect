import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Service } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";

export function useServiceActions() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const onError = (error: Error) => {
    if (isUnauthorizedError(error)) { window.location.assign("/login?returnTo=%2Fmy-services%2Fservices"); return; }
    let message = "Please try again.";
    try { message = JSON.parse(error.message.replace(/^\d+:\s*/, "")).message || message; } catch {}
    toast({ title: "Unable to update services", description: message, variant: "destructive" });
  };
  const copy = useMutation({
    mutationFn: async (id: number): Promise<Service> => (await apiRequest("POST", `/api/services/${id}/copy`)).json(),
    onSuccess: async service => {
      await queryClient.invalidateQueries({ queryKey: ["/api/services/provider"] });
      navigate(`/my-services/services/${service.id}/edit`);
      toast({ title: "Service copied", description: "An inactive copy is ready to edit. Publish it when you are ready." });
    }, onError,
  });
  const search = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/generate-embeddings", {}),
    onSuccess: () => toast({ title: "AI Search Updated" }), onError,
  });
  return { copy, search };
}
