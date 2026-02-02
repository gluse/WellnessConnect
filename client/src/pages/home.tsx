import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import RoleSwitcher from "@/components/role-switcher";
import ServiceFilters, { SearchFilters } from "@/components/service-filters";
import ServiceCard from "@/components/service-card";
import GoogleMap from "@/components/google-map";
import BookingModal from "@/components/booking-modal";
import ServiceDetailModal from "@/components/service-detail-modal";
import BottomNavigation from "@/components/bottom-navigation";
import ProviderDashboard from "@/pages/provider-dashboard";
import CalendarView from "@/components/calendar-view";
import { LanguagePicker } from "@/components/language-picker";
import { Button } from "@/components/ui/button";
import { Heart, MapPin, List, Map, Target, Calendar, X } from "lucide-react";
import { format } from "date-fns";
import type { ServiceWithProvider, BookingWithDetails } from "@shared/schema";

interface ActiveFiltersBarProps {
  filters: SearchFilters;
  locationName: string;
  onFiltersChange: (filters: SearchFilters) => void;
  onLocationClear: () => void;
}

function ActiveFiltersBar({ filters, locationName, onFiltersChange, onLocationClear }: ActiveFiltersBarProps) {
  const activeFilters: { key: string; label: string; onRemove: () => void }[] = [];

  if (filters.category) {
    const categoryLabels: Record<string, string> = {
      health_wellness: "🏥 Health & Wellness",
      education: "🎓 Education",
      entertainment: "🎵 Entertainment"
    };
    activeFilters.push({
      key: "category",
      label: categoryLabels[filters.category] || filters.category,
      onRemove: () => onFiltersChange({ ...filters, category: "" })
    });
  }

  if (filters.searchQuery) {
    activeFilters.push({
      key: "search",
      label: `"${filters.searchQuery}"`,
      onRemove: () => onFiltersChange({ ...filters, searchQuery: "" })
    });
  }

  if (filters.serviceType) {
    activeFilters.push({
      key: "serviceType",
      label: filters.serviceType === "one_to_one" ? "One-to-One" : "Group",
      onRemove: () => onFiltersChange({ ...filters, serviceType: "" })
    });
  }

  if (filters.ageGroups.length > 0) {
    activeFilters.push({
      key: "audience",
      label: `Audience: ${filters.ageGroups.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(", ")}`,
      onRemove: () => onFiltersChange({ ...filters, ageGroups: [] })
    });
  }

  if (locationName) {
    activeFilters.push({
      key: "location",
      label: `📍 ${locationName}`,
      onRemove: onLocationClear
    });
  }

  if (filters.date) {
    const dateLabel = filters.dateEnd 
      ? `${format(new Date(filters.date), "MMM d")} - ${format(new Date(filters.dateEnd), "MMM d")}`
      : format(new Date(filters.date), "MMM d, yyyy");
    activeFilters.push({
      key: "date",
      label: `📅 ${dateLabel}`,
      onRemove: () => onFiltersChange({ ...filters, date: "", dateEnd: "", time: "", timeEnd: "" })
    });
  }

  if (filters.availableOnly) {
    activeFilters.push({
      key: "available",
      label: "Available only",
      onRemove: () => onFiltersChange({ ...filters, availableOnly: false })
    });
  }

  if (activeFilters.length === 0) return null;

  return (
    <div className="px-4 pb-3 lg:px-0">
      <div className="flex flex-wrap gap-2">
        {activeFilters.map(({ key, label, onRemove }) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-full"
          >
            {label}
            <button
              onClick={onRemove}
              className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
              aria-label={`Remove ${label} filter`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <button
          onClick={() => {
            onFiltersChange({
              category: "",
              searchQuery: "",
              searchMode: "exact",
              serviceType: "",
              ageGroups: [],
              distance: 50,
              date: "",
              dateEnd: "",
              time: "",
              timeEnd: "",
              availableOnly: false
            });
            onLocationClear();
          }}
          className="text-xs text-neutral-500 hover:text-neutral-700 underline"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentRole, setCurrentRole] = useState<"seeker" | "provider">((user as any)?.currentRole || "seeker");
  const [viewMode, setViewMode] = useState<"list" | "map" | "calendar">("list");
  const [selectedService, setSelectedService] = useState<ServiceWithProvider | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>("");
  const [filters, setFilters] = useState<SearchFilters>({
    category: "",
    searchQuery: "",
    searchMode: "exact",
    serviceType: "",
    ageGroups: [],
    distance: 50,
    date: "",
    dateEnd: "",
    time: "",
    timeEnd: "",
    availableOnly: false
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

  const loadGoogleMapsAPI = async (apiKey: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).google?.maps) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
  };

  const handleGeocodeLocation = async (address: string) => {
    try {
      // Get Google Maps API key
      const configResponse = await fetch('/api/config/maps');
      const config = await configResponse.json();
      
      if (!config.apiKey) {
        throw new Error("Maps API key not configured");
      }

      // Load Google Maps API if not already loaded
      await loadGoogleMapsAPI(config.apiKey);

      // Use Google Maps Geocoder on the client side
      const geocoder = new (window as any).google.maps.Geocoder();
      const result = await new Promise<any>((resolve, reject) => {
        geocoder.geocode({ address }, (results: any, status: any) => {
          if (status === 'OK' && results && results.length > 0) {
            resolve(results[0]);
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });

      const location = result.geometry.location;
      setUserLocation({ lat: location.lat(), lng: location.lng() });
      setLocationName(result.formatted_address);
      toast({
        title: "Location Found",
        description: `Using ${result.formatted_address}`,
      });
    } catch (error) {
      console.error("Geocoding error:", error);
      toast({
        title: "Location Not Found",
        description: "Could not find the address. Please try a different search.",
        variant: "destructive",
      });
    }
  };

  // Search services query - uses semantic or exact search based on mode
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/services/search", filters, userLocation, locationName],
    queryFn: async () => {
      const searchQuery = filters.searchQuery?.trim();
      
      // Use semantic search if mode is set to semantic and there's a query
      if (searchQuery && filters.searchMode === "semantic") {
        const semanticParams = new URLSearchParams();
        semanticParams.append("query", searchQuery);
        if (filters.category) semanticParams.append("category", filters.category);
        if (filters.serviceType) semanticParams.append("serviceType", filters.serviceType);
        if (userLocation) {
          semanticParams.append("latitude", userLocation.lat.toString());
          semanticParams.append("longitude", userLocation.lng.toString());
          semanticParams.append("radius", filters.distance.toString());
        }
        if (filters.ageGroups.length > 0) {
          filters.ageGroups.forEach(age => semanticParams.append("ageGroups", age));
        }
        if (filters.date) semanticParams.append("date", filters.date);
        if (filters.dateEnd) semanticParams.append("dateEnd", filters.dateEnd);
        if (filters.time) semanticParams.append("time", filters.time);
        if (filters.timeEnd) semanticParams.append("timeEnd", filters.timeEnd);
        if (filters.availableOnly) semanticParams.append("availableOnly", "true");
        
        const response = await fetch(`/api/services/semantic-search?${semanticParams}`);
        if (response.ok) {
          return response.json();
        }
      }
      
      // Regular exact search
      const params = new URLSearchParams();
      if (filters.category) params.append("category", filters.category);
      if (filters.serviceType) params.append("serviceType", filters.serviceType);
      if (filters.ageGroups.length > 0) {
        filters.ageGroups.forEach(age => params.append("ageGroups", age));
      }
      if (filters.date) params.append("date", filters.date);
      if (filters.dateEnd) params.append("dateEnd", filters.dateEnd);
      if (filters.time) params.append("time", filters.time);
      if (filters.timeEnd) params.append("timeEnd", filters.timeEnd);
      if (filters.availableOnly) params.append("availableOnly", "true");
      if (searchQuery) params.append("searchQuery", searchQuery);
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

  // Fetch seeker bookings for calendar
  const { data: bookings = [] } = useQuery({
    queryKey: ["/api/bookings/seeker"],
    enabled: currentRole === "seeker" && viewMode === "calendar",
    retry: false,
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
              <LanguagePicker />
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
              onGeocodeLocation={handleGeocodeLocation}
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
              onGeocodeLocation={handleGeocodeLocation}
            />
          </div>

          {/* Active Filters Chips */}
          <ActiveFiltersBar 
            filters={filters}
            locationName={locationName}
            onFiltersChange={setFilters}
            onLocationClear={() => {
              setLocationName("");
              setUserLocation(null);
            }}
          />

          {/* View Toggle */}
          <div className="px-4 pb-4 lg:px-0">
            <div className="flex bg-neutral-100 rounded-lg p-1 max-w-md">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="flex-1"
                data-testid="button-view-list"
              >
                <List className="w-4 h-4 mr-2" />
                {t('views.list')}
              </Button>
              <Button
                variant={viewMode === "map" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("map")}
                className="flex-1"
                data-testid="button-view-map"
              >
                <Map className="w-4 h-4 mr-2" />
                {t('views.map')}
              </Button>
              <Button
                variant={viewMode === "calendar" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("calendar")}
                className="flex-1"
                data-testid="button-view-calendar"
              >
                <Calendar className="w-4 h-4 mr-2" />
                {t('views.calendar')}
              </Button>
            </div>
          </div>

          {/* Services List */}
          {viewMode === "list" && (
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
          )}

          {/* Map View */}
          {viewMode === "map" && (
            <div className="h-96 px-4 lg:px-0 lg:h-[600px]">
              {services.length > 0 || userLocation ? (
                <GoogleMap 
                  services={services}
                  userLocation={userLocation}
                  onServiceSelect={handleViewDetails}
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

          {/* Calendar View */}
          {viewMode === "calendar" && (
            <div className="px-4 lg:px-0">
              <CalendarView
                bookings={bookings as BookingWithDetails[]}
                schedules={[]}
                onDateClick={(date) => {
                  toast({
                    title: "Date Selected",
                    description: `Selected date: ${date.toLocaleDateString()}`,
                  });
                }}
              />
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
