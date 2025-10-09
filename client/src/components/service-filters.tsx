import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Target } from "lucide-react";

interface ServiceFiltersProps {
  filters: {
    category: string;
    ageGroups: string[];
    serviceType: string;
    distance: number;
    date: string;
  };
  onFiltersChange: (filters: any) => void;
  locationName: string;
  onLocationNameChange: (name: string) => void;
  onUseCurrentLocation: () => void;
}

export default function ServiceFilters({ 
  filters, 
  onFiltersChange,
  locationName,
  onLocationNameChange,
  onUseCurrentLocation
}: ServiceFiltersProps) {
  const handleCategoryChange = (category: string) => {
    onFiltersChange({ ...filters, category });
  };

  const handleAgeGroupToggle = (ageGroup: string) => {
    const newAgeGroups = filters.ageGroups.includes(ageGroup)
      ? filters.ageGroups.filter(ag => ag !== ageGroup)
      : [...filters.ageGroups, ageGroup];
    onFiltersChange({ ...filters, ageGroups: newAgeGroups });
  };

  const handleServiceTypeToggle = (serviceType: string) => {
    const newServiceType = filters.serviceType === serviceType ? "" : serviceType;
    onFiltersChange({ ...filters, serviceType: newServiceType });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Location Input */}
      <div className="relative">
        <MapPin className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
        <Input 
          placeholder="Click target to use your location" 
          className="pl-10 pr-12 bg-neutral-50 cursor-not-allowed"
          value={locationName}
          readOnly
          data-testid="input-location"
        />
        <Button 
          variant="ghost" 
          size="sm"
          className="absolute right-2 top-2 p-1"
          onClick={onUseCurrentLocation}
          data-testid="button-use-current-location"
          title="Use my current location"
        >
          <Target className="w-4 h-4 text-primary" />
        </Button>
      </div>

      {/* Service Categories */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-neutral-700">Service Category</Label>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={filters.category === "health_wellness" ? "default" : "outline"}
            size="sm"
            onClick={() => handleCategoryChange("health_wellness")}
            className="p-3 h-auto flex-col"
          >
            <span className="text-lg mb-1">🏥</span>
            <span className="text-xs">Health & Wellness</span>
          </Button>
          <Button
            variant={filters.category === "education" ? "default" : "outline"}
            size="sm"
            onClick={() => handleCategoryChange("education")}
            className="p-3 h-auto flex-col"
          >
            <span className="text-lg mb-1">🎓</span>
            <span className="text-xs">Education</span>
          </Button>
          <Button
            variant={filters.category === "entertainment" ? "default" : "outline"}
            size="sm"
            onClick={() => handleCategoryChange("entertainment")}
            className="p-3 h-auto flex-col"
          >
            <span className="text-lg mb-1">🎵</span>
            <span className="text-xs">Entertainment</span>
          </Button>
        </div>
      </div>

      {/* Age Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-neutral-700">Age Group</Label>
        <div className="flex flex-wrap gap-2">
          {["children", "teens", "adults", "seniors"].map(ageGroup => (
            <Button
              key={ageGroup}
              variant={filters.ageGroups.includes(ageGroup) ? "default" : "outline"}
              size="sm"
              onClick={() => handleAgeGroupToggle(ageGroup)}
              className="px-3 py-1 text-sm"
            >
              {ageGroup.charAt(0).toUpperCase() + ageGroup.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Distance and Date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-sm font-medium text-neutral-700">Distance (km)</Label>
          <Input 
            type="number"
            min="1"
            max="500"
            value={filters.distance}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 5;
              const clampedValue = Math.min(Math.max(value, 1), 500);
              onFiltersChange({ ...filters, distance: clampedValue });
            }}
            placeholder="Distance in km"
            data-testid="input-distance"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-medium text-neutral-700">When</Label>
          <Input 
            type="date" 
            value={filters.date}
            onChange={(e) => onFiltersChange({ ...filters, date: e.target.value })}
          />
        </div>
      </div>

      {/* Service Type Filter */}
      <div className="flex items-center space-x-4">
        <Label className="text-sm font-medium text-neutral-700">Service Type:</Label>
        <div className="flex space-x-4">
          <Button
            variant={filters.serviceType === "one_to_one" ? "default" : "outline"}
            size="sm"
            onClick={() => handleServiceTypeToggle("one_to_one")}
            className="text-sm"
          >
            One-to-One
          </Button>
          <Button
            variant={filters.serviceType === "group" ? "default" : "outline"}
            size="sm"
            onClick={() => handleServiceTypeToggle("group")}
            className="text-sm"
          >
            Group
          </Button>
        </div>
      </div>
    </div>
  );
}
