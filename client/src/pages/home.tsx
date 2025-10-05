import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import RoleSwitcher from "@/components/role-switcher";
import ServiceFilters from "@/components/service-filters";
import ServiceCard from "@/components/service-card";
import BookingModal from "@/components/booking-modal";
import BottomNavigation from "@/components/bottom-navigation";
import ProviderDashboard from "@/pages/provider-dashboard";
import { Button } from "@/components/ui/button";
import { Heart, MapPin, List, Map } from "lucide-react";
import type { ServiceWithProvider } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentRole, setCurrentRole] = useState<"seeker" | "provider">(user?.currentRole || "seeker");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedService, setSelectedService] = useState<ServiceWithProvider | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>("San Francisco, CA");
  const [filters, setFilters] = useState({
    category: "health_wellness",
    ageGroups: [] as string[],
    serviceType: "",
    distance: 5,
    date: new Date().toISOString().split('T')[0]
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async (role: "seeker" | "provider") => {
      const response = await apiRequest("PATCH", "/api/users/role", { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Role Updated",
        description: `Switched to ${currentRole} mode`,
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    },
  });

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation Not Supported",
        description: "Your browser doesn't support geolocation",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLocationName("Current Location");
        toast({
          title: "Location Updated",
          description: "Using your current location",
        });
      },
      (error) => {
        toast({
          title: "Location Error",
          description: "Could not get your location. Please enable location services.",
          variant: "destructive",
        });
      }
    );
  };

  // Search services query
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/services/search", filters, userLocation],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.category) params.append("category", filters.category);
      if (filters.serviceType) params.append("serviceType", filters.serviceType);
      if (filters.ageGroups.length > 0) {
        filters.ageGroups.forEach(age => params.append("ageGroups", age));
      }
      if (filters.date) params.append("date", filters.date);
      if (userLocation) {
        params.append("latitude", userLocation.lat.toString());
        params.append("longitude", userLocation.lng.toString());
        params.append("radius", filters.distance.toString());
      }
      
      const response = await fetch(`/api/services/search?${params}`);
      if (!response.ok) throw new Error("Failed to fetch services");
      return response.json();
    },
    enabled: currentRole === "seeker",
  });

  const handleRoleSwitch = (role: "seeker" | "provider") => {
    setCurrentRole(role);
    updateRoleMutation.mutate(role);
  };

  const handleBookService = (service: ServiceWithProvider) => {
    setSelectedService(service);
    setShowBookingModal(true);
  };

  if (currentRole === "provider") {
    return <ProviderDashboard onRoleSwitch={handleRoleSwitch} />;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-md mx-auto bg-white shadow-xl min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white border-b border-neutral-200">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Heart className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-semibold text-neutral-800">WellnessFind</h1>
              </div>
              
              <div className="flex items-center space-x-2">
                <RoleSwitcher 
                  currentRole={currentRole} 
                  onRoleChange={handleRoleSwitch}
                />
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => window.location.href = "/api/logout"}
                  className="w-8 h-8 p-0"
                >
                  <div className="w-6 h-6 bg-neutral-200 rounded-full flex items-center justify-center">
                    <span className="text-xs">👤</span>
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="pb-20">
          {/* Filters */}
          <ServiceFilters 
            filters={filters}
            onFiltersChange={setFilters}
            locationName={locationName}
            onLocationNameChange={setLocationName}
            onUseCurrentLocation={handleGetCurrentLocation}
          />

          {/* View Toggle */}
          <div className="px-4 pb-4">
            <div className="flex bg-neutral-100 rounded-lg p-1">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="flex-1"
              >
                <List className="w-4 h-4 mr-2" />
                List
              </Button>
              <Button
                variant={viewMode === "map" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("map")}
                className="flex-1"
              >
                <Map className="w-4 h-4 mr-2" />
                Map
              </Button>
            </div>
          </div>

          {/* Services List */}
          {viewMode === "list" ? (
            <div className="space-y-4 px-4">
              {servicesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-neutral-600">Loading services...</p>
                </div>
              ) : services.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                  <p className="text-neutral-600">No services found matching your criteria</p>
                </div>
              ) : (
                services.map((service: ServiceWithProvider) => (
                  <ServiceCard 
                    key={service.id} 
                    service={service}
                    onBook={() => handleBookService(service)}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="h-96 px-4">
              <div className="bg-neutral-200 rounded-xl h-full flex items-center justify-center">
                <div className="text-center">
                  <Map className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                  <p className="text-neutral-600">Map View</p>
                  <p className="text-sm text-neutral-500">Coming soon - interactive map with service locations</p>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Booking Modal */}
        {showBookingModal && selectedService && (
          <BookingModal
            service={selectedService}
            onClose={() => setShowBookingModal(false)}
          />
        )}

        {/* Bottom Navigation */}
        <BottomNavigation />
      </div>
    </div>
  );
}
