import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MapPin, Target, Search, Loader2, CalendarIcon, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface SearchFilters {
  category: string;
  searchQuery: string;
  searchMode: "exact" | "semantic";
  serviceType: string;
  ageGroups: string[];
  distance: number;
  date: string;
  dateEnd: string;
  time: string;
  timeEnd: string;
  availableOnly: boolean;
}

interface ServiceFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  locationName: string;
  onLocationNameChange: (name: string) => void;
  onUseCurrentLocation: () => void;
  onGeocodeLocation: (address: string) => Promise<void>;
}

export default function ServiceFilters({ 
  filters, 
  onFiltersChange,
  locationName,
  onLocationNameChange,
  onUseCurrentLocation,
  onGeocodeLocation
}: ServiceFiltersProps) {
  const { t } = useTranslation();
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [inputAddress, setInputAddress] = useState(locationName);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    category: true,
    name: true,
    location: true,
    filters: false
  });
  const { toast } = useToast();

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSearchLocation = async () => {
    if (!inputAddress.trim()) {
      toast({
        title: "Location Required",
        description: "Please enter an address to search",
        variant: "destructive"
      });
      return;
    }

    setIsGeocoding(true);
    try {
      await onGeocodeLocation(inputAddress);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchLocation();
    }
  };

  const handleAgeGroupToggle = (ageGroup: string) => {
    const newAgeGroups = filters.ageGroups.includes(ageGroup)
      ? filters.ageGroups.filter(ag => ag !== ageGroup)
      : [...filters.ageGroups, ageGroup];
    onFiltersChange({ ...filters, ageGroups: newAgeGroups });
  };

  const clearAllFilters = () => {
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
    setInputAddress("");
    onLocationNameChange("");
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.category) count++;
    if (filters.searchQuery) count++;
    if (filters.serviceType) count++;
    if (filters.ageGroups.length > 0) count++;
    if (filters.date) count++;
    if (filters.availableOnly) count++;
    if (locationName) count++;
    return count;
  };

  const activeCount = getActiveFilterCount();

  const SectionHeader = ({ title, section, badge }: { title: string; section: string; badge?: string }) => (
    <button
      onClick={() => toggleSection(section)}
      className="flex items-center justify-between w-full py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
    >
      <span className="flex items-center gap-2">
        {title}
        {badge && <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">{badge}</span>}
      </span>
      {expandedSections[section] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="p-4 space-y-3">
      {/* Header with Clear All */}
      <div className="flex items-center justify-between pb-2 border-b">
        <span className="font-semibold text-neutral-800">
          Filters {activeCount > 0 && <span className="text-primary">({activeCount})</span>}
        </span>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs h-7">
            <X className="w-3 h-3 mr-1" /> Clear All
          </Button>
        )}
      </div>

      {/* Service Category */}
      <div className="border-b pb-3">
        <SectionHeader title="Service Category" section="category" />
        {expandedSections.category && (
          <div className="pt-2">
            <Select 
              value={filters.category || "all"} 
              onValueChange={(value) => onFiltersChange({ ...filters, category: value === "all" ? "" : value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="health_wellness">🏥 Health & Wellness</SelectItem>
                <SelectItem value="education">🎓 Education</SelectItem>
                <SelectItem value="entertainment">🎵 Entertainment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Service Name Search */}
      <div className="border-b pb-3">
        <SectionHeader title="Service Name" section="name" />
        {expandedSections.name && (
          <div className="pt-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
              <Input 
                placeholder="Search by name or description..." 
                className="pl-10"
                value={filters.searchQuery || ""}
                onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
                data-testid="input-search-query"
              />
            </div>
            {/* Search Mode Toggle */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-neutral-500">Search mode:</Label>
              <div className="flex rounded-md border overflow-hidden">
                <button
                  onClick={() => onFiltersChange({ ...filters, searchMode: "exact" })}
                  className={cn(
                    "px-3 py-1 text-xs transition-colors",
                    filters.searchMode === "exact" 
                      ? "bg-primary text-white" 
                      : "bg-white text-neutral-600 hover:bg-neutral-50"
                  )}
                >
                  Exact
                </button>
                <button
                  onClick={() => onFiltersChange({ ...filters, searchMode: "semantic" })}
                  className={cn(
                    "px-3 py-1 text-xs transition-colors border-l",
                    filters.searchMode === "semantic" 
                      ? "bg-primary text-white" 
                      : "bg-white text-neutral-600 hover:bg-neutral-50"
                  )}
                >
                  AI Search
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Location */}
      <div className="border-b pb-3">
        <SectionHeader title="Location" section="location" />
        {expandedSections.location && (
          <div className="pt-2 space-y-2">
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                <Input 
                  placeholder="Enter address or city" 
                  className="pl-10"
                  value={inputAddress}
                  onChange={(e) => setInputAddress(e.target.value)}
                  onKeyPress={handleKeyPress}
                  data-testid="input-location"
                />
              </div>
              <Button 
                variant="default"
                size="sm"
                onClick={handleSearchLocation}
                disabled={isGeocoding || !inputAddress.trim()}
                data-testid="button-search-location"
                title="Search for this address"
                className="px-3"
              >
                {isGeocoding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={onUseCurrentLocation}
                data-testid="button-use-current-location"
                title="Use my current location"
                className="px-3"
              >
                <Target className="w-4 h-4" />
              </Button>
            </div>
            {locationName && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {locationName}
              </p>
            )}
            {/* Distance */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-neutral-500 whitespace-nowrap">Distance:</Label>
              <Input 
                type="number"
                min="1"
                max="500"
                value={filters.distance}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 50;
                  const clampedValue = Math.min(Math.max(value, 1), 500);
                  onFiltersChange({ ...filters, distance: clampedValue });
                }}
                className="w-20 h-8 text-sm"
                data-testid="input-distance"
              />
              <span className="text-xs text-neutral-500">km</span>
            </div>
          </div>
        )}
      </div>

      {/* More Filters Section */}
      <div className="border-b pb-3">
        <SectionHeader 
          title="More Filters" 
          section="filters" 
          badge={
            (filters.serviceType || filters.ageGroups.length > 0 || filters.date || filters.availableOnly) 
              ? "Active" 
              : undefined
          }
        />
        {expandedSections.filters && (
          <div className="pt-2 space-y-4">
            {/* Service Type */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-neutral-600">Service Type</Label>
              <Select 
                value={filters.serviceType || "all"} 
                onValueChange={(value) => onFiltersChange({ ...filters, serviceType: value === "all" ? "" : value })}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="one_to_one">One-to-One</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Audience / Age Groups */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-neutral-600">Audience</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "children", label: "Children" },
                  { key: "teens", label: "Teens" },
                  { key: "adults", label: "Adults" },
                  { key: "seniors", label: "Seniors" }
                ].map(({ key, label }) => (
                  <Button
                    key={key}
                    variant={filters.ageGroups.includes(key) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleAgeGroupToggle(key)}
                    className="h-7 px-2 text-xs"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Date/Time */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-neutral-600">Date & Time</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-neutral-500">From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-9 justify-start text-left font-normal text-xs",
                          !filters.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {filters.date ? format(new Date(filters.date), "PP") : "Start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.date ? new Date(filters.date) : undefined}
                        onSelect={(date) => onFiltersChange({ 
                          ...filters, 
                          date: date ? format(date, "yyyy-MM-dd") : "" 
                        })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs text-neutral-500">To (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-9 justify-start text-left font-normal text-xs",
                          !filters.dateEnd && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {filters.dateEnd ? format(new Date(filters.dateEnd), "PP") : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateEnd ? new Date(filters.dateEnd) : undefined}
                        onSelect={(date) => onFiltersChange({ 
                          ...filters, 
                          dateEnd: date ? format(date, "yyyy-MM-dd") : "" 
                        })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {/* Time inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-neutral-500">Start time</Label>
                  <Input 
                    type="time"
                    value={filters.time || ""}
                    onChange={(e) => onFiltersChange({ ...filters, time: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-neutral-500">End time</Label>
                  <Input 
                    type="time"
                    value={filters.timeEnd || ""}
                    onChange={(e) => onFiltersChange({ ...filters, timeEnd: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              {filters.date && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onFiltersChange({ ...filters, date: "", dateEnd: "", time: "", timeEnd: "" })}
                  className="text-xs h-6 px-2"
                >
                  <X className="w-3 h-3 mr-1" /> Clear dates
                </Button>
              )}
            </div>

            {/* Available Only */}
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="availableOnly"
                checked={filters.availableOnly}
                onCheckedChange={(checked) => 
                  onFiltersChange({ ...filters, availableOnly: checked === true })
                }
              />
              <label
                htmlFor="availableOnly"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Show only available providers
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
