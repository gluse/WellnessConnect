import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import RoleSwitcher from "@/components/role-switcher";
import ServiceFilters from "@/components/service-filters";
import ServiceCard from "@/components/service-card";
import GoogleMap from "@/components/google-map";
import BookingModal from "@/components/booking-modal";
import ServiceDetailModal from "@/components/service-detail-modal";
import BottomNavigation from "@/components/bottom-navigation";
import ProviderDashboard from "@/pages/provider-dashboard";
import { Button } from "@/components/ui/button";
import { Heart, MapPin, List, Map, Target } from "lucide-react";
import type { ServiceWithProvider } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentRole, setCurrentRole] = useState<"seeker" | "provider">((user as any)?.currentRole || "seeker");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedService, setSelectedService] = useState<ServiceWithProvider | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
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

  const handleViewDetails = (service: ServiceWithProvider) => {
    setSelectedService(service);
    setShowDetailModal(true);
  };

  if (currentRole === "provider") {
    return <ProviderDashboard onRoleSwitch={handleRoleSwitch} />;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
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
      <div className="max-w-7xl mx-auto lg:flex lg:gap-6 lg:px-4 lg:py-6">
        {/* Filters Sidebar - Desktop */}
        <aside className="hidden lg:block lg:w-80 lg:shrink-0">
          <div className="bg-white rounded-lg shadow-sm sticky top-20">
            <ServiceFilters 
              filters={filters}
              onFiltersChange={setFilters}
              locationName={locationName}
              onLocationNameChange={setLocationName}
              onUseCurrentLocation={handleGetCurrentLocation}
            />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 pb-20 lg:pb-0">
          {/* Filters - Mobile Only */}
          <div className="lg:hidden">
            <ServiceFilters 
              filters={filters}
              onFiltersChange={setFilters}
              locationName={locationName}
              onLocationNameChange={setLocationName}
              onUseCurrentLocation={handleGetCurrentLocation}
            />
          </div>

          {/* View Toggle */}
          <div className="px-4 pb-4 lg:px-0">
            <div className="flex bg-neutral-100 rounded-lg p-1 max-w-xs">
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
            <div className="space-y-4 px-4 lg:px-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
              {servicesLoading ? (
                <div className="text-center py-8 lg:col-span-2">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-neutral-600">Loading services...</p>
                </div>
              ) : services.length === 0 ? (
                <div className="text-center py-8 lg:col-span-2">
                  <MapPin className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                  <p className="text-neutral-600">No services found matching your criteria</p>
                </div>
              ) : (
                services.map((service: ServiceWithProvider) => (
                  <ServiceCard 
                    key={service.id} 
                    service={service}
                    onBook={() => handleBookService(service)}
                    onViewDetails={() => handleViewDetails(service)}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="h-96 px-4 lg:px-0 lg:h-[600px]">
              {services.length > 0 || userLocation ? (
                <GoogleMap 
                  services={services}
                  userLocation={userLocation}
                  onServiceSelect={handleBookService}
                />
              ) : (
                <div className="bg-neutral-100 rounded-xl h-full flex items-center justify-center border-2 border-dashed border-neutral-300">
                  <div className="text-center p-6">
                    <MapPin className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-700 font-medium mb-2">No Services to Display</p>
                    <p className="text-sm text-neutral-500 mb-4">Enable your location to find services near you</p>
                    <Button onClick={handleGetCurrentLocation} data-testid="button-enable-location">
                      <Target className="w-4 h-4 mr-2" />
                      Enable Location
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Booking Modal */}
      {showBookingModal && selectedService && (
        <BookingModal
          service={selectedService}
          onClose={() => setShowBookingModal(false)}
        />
      )}

      {/* Service Detail Modal */}
      <ServiceDetailModal
        service={selectedService}
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedService(null);
        }}
        onBook={() => {
          setShowDetailModal(false);
          setShowBookingModal(true);
        }}
      />

      {/* Bottom Navigation - Mobile Only */}
      <div className="lg:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
}
