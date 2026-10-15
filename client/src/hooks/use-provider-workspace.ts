import { useQuery } from "@tanstack/react-query";
import type { Availability, BookingWithDetails, Employee, Service, WorkspaceContext } from "@shared/schema";

export function useProviderWorkspace() {
  return useQuery<WorkspaceContext>({ queryKey: ["/api/company/context"], retry: false });
}

export function useProviderServices() {
  return useQuery<Service[]>({ queryKey: ["/api/services/provider"], staleTime: 30_000, retry: false });
}

export function useProviderEmployees() {
  return useQuery<Employee[]>({ queryKey: ["/api/provider/employees"], retry: false });
}

export function useProviderBookings() {
  return useQuery<BookingWithDetails[]>({ queryKey: ["/api/bookings/provider"], staleTime: 30_000, retry: false });
}

export function useProviderAvailability() {
  return useQuery<Availability[]>({ queryKey: ["/api/availability/provider"], staleTime: 30_000, retry: false });
}
