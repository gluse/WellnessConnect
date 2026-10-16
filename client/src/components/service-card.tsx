import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Users, MapPin } from "lucide-react";
import ServiceRating from "@/components/service-rating";
import type { ServiceWithProvider } from "@shared/schema";
import { getProviderName } from "@shared/provider";
import { currentLocation } from "@shared/locations";
import { useTranslation } from "react-i18next";

interface ServiceCardProps {
  service: ServiceWithProvider;
  onBook: () => void;
  onViewDetails: () => void;
  onViewProvider?: () => void;
}

export default function ServiceCard({ service, onBook, onViewDetails, onViewProvider }: ServiceCardProps) {
  service = currentLocation(service);
  const { t } = useTranslation();
  const isGroupService = service.serviceType === "group";
  const availableSpots = isGroupService ? ((service.maxCapacity || 1) - (service.availableCapacity || 0)) : 1;

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex space-x-3">
          {/* Service Image Placeholder */}
          <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg flex items-center justify-center">
            {service.imageUrl ? <img src={service.imageUrl} alt={service.name} className="w-16 h-16 rounded-lg object-cover" loading="lazy" /> : <span className="text-2xl">
              {service.category === "health_wellness" ? "🏥" : 
               service.category === "education" ? "🎓" : "🎵"}
            </span>}
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 
                className="font-semibold text-neutral-800 hover:text-primary cursor-pointer" 
                onClick={onViewDetails}
                data-testid={`button-view-details-${service.id}`}
              >
                {service.name}
              </h3>
              <Badge variant={isGroupService ? "secondary" : "default"}>
                {isGroupService ? "Group" : "One-to-One"}
              </Badge>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {onViewProvider ? <button type="button" onClick={onViewProvider}
                data-testid={`button-provider-${service.id}`}
                aria-label={t("catalog.view", { name: getProviderName(service.provider) })}
                className="text-sm text-primary text-left underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {getProviderName(service.provider)}
              </button> : <p className="text-sm text-neutral-600">
                {getProviderName(service.provider)}
              </p>}
              {service.distance !== undefined && (
                <>
                  <span className="text-sm text-neutral-500">•</span>
                  <div className="flex items-center">
                    <MapPin className="w-3 h-3 text-neutral-400 mr-1" />
                    <span className="text-sm text-neutral-500" data-testid={`text-distance-${service.id}`}>
                      {service.distance} km away
                    </span>
                  </div>
                </>
              )}
            </div>
            {service.employee?.name && <p className="text-sm text-neutral-500 mb-2">With {service.employee.name}</p>}
            
            <div className="flex items-center justify-between mb-3">
              <ServiceRating service={service} />
              <div className="text-right">
                <p className="text-lg font-semibold text-neutral-800">${service.price}</p>
                <p className="text-xs text-neutral-500">
                  {isGroupService ? "per person" : `${service.duration} min`}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              {isGroupService && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm text-neutral-600">
                      {availableSpots} of {service.maxCapacity} spots available
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-neutral-400" />
                  <span className="text-sm text-neutral-600">Available today</span>
                  <Badge variant={service.instantBooking ? "default" : "outline"} className="text-xs">
                    {service.instantBooking ? "Instant Book" : "Requires Approval"}
                  </Badge>
                </div>
                <Button 
                  onClick={onBook}
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                >
                  {service.instantBooking ? "Book Now" : "Request Booking"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
