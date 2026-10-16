import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import ServiceFilters, { SearchFilters } from "@/components/service-filters";
import ServiceCard from "@/components/service-card";
import ProviderServicesDialog from "@/components/provider-services-dialog";
import SearchResultsSort from "@/components/search-results-sort";
import { serviceRating, sortServices, type ServiceSort } from "@/lib/service-sort";
import GoogleMap from "@/components/google-map";
import { loadGeocoder } from "@/lib/google-maps";
import BookingModal from "@/components/booking-modal";
import ServiceDetailModal from "@/components/service-detail-modal";
import BottomNavigation from "@/components/bottom-navigation";
import { Button } from "@/components/ui/button";
import { MapPin, List, Map, Target, X } from "lucide-react";
import { format } from "date-fns";
import type { ServiceWithProvider } from "@shared/schema";
import { useCategories } from "@/hooks/use-categories";

interface ActiveFiltersBarProps {
  filters: SearchFilters;
  locationName: string;
  onFiltersChange: (filters: SearchFilters) => void;
  onLocationClear: () => void;
}

function ActiveFiltersBar({ filters, locationName, onFiltersChange, onLocationClear }: ActiveFiltersBarProps) {
  const categories = useCategories();
  const activeFilters: { key: string; label: string; onRemove: () => void }[] = [];

  if (filters.category) {
    const category = categories.data?.find(category => category.key === filters.category);
    activeFilters.push({
      key: "category",
      label: category ? `${category.icon} ${category.name}`.trim() : filters.category,
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
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [sort, setSort] = useState<ServiceSort>("default");
  const [selectedService, setSelectedService] = useState<ServiceWithProvider | null>(null);
  const [providerSource, setProviderSource] = useState<ServiceWithProvider | null>(null);
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

  const handleGeocodeLocation = async (address: string) => {
    try {
      const { Geocoder } = await loadGeocoder();
      const geocoder = new Geocoder();
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
  const { data: searchResults, isLoading: servicesLoading } = useQuery<ServiceWithProvider[]>({
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
  });

  const effectiveSort = sort.startsWith("distance-") && !userLocation ? "default" : sort;
  const services = useMemo(
    () => sortServices(searchResults ?? [], effectiveSort, userLocation),
    [searchResults, effectiveSort, userLocation],
  );

  const handleBookService = (service: ServiceWithProvider) => {
    setSelectedService(service);
    setShowBookingModal(true);
  };

  const handleViewDetails = (service: ServiceWithProvider) => {
    setSelectedService(service);
    setShowDetailModal(true);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
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
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">
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
              setSort(current => current.startsWith("distance-") ? "default" : current);
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
            </div>
          </div>

          <div className="px-4 pb-4 lg:px-0">
            <SearchResultsSort
              value={effectiveSort}
              onChange={setSort}
              hasLocation={userLocation !== null}
              hasRatings={services.some(service => serviceRating(service) !== undefined)}
            />
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
                    onViewProvider={() => setProviderSource(service)}
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
      <ProviderServicesDialog
        source={providerSource}
        open={providerSource !== null && !showDetailModal && !showBookingModal}
        onClose={() => setProviderSource(null)}
        onBook={handleBookService}
        onViewDetails={handleViewDetails}
      />
      <ServiceDetailModal
        service={selectedService}
        open={showDetailModal}
        onViewProvider={() => {
          if (selectedService) setProviderSource(selectedService);
          setShowDetailModal(false);
        }}
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
