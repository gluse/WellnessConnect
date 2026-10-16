import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Clock, Users, MapPin, DollarSign, Calendar, CheckCircle } from "lucide-react";
import ServiceRating from "@/components/service-rating";
import type { ServiceWithProvider } from "@shared/schema";
import { getProviderName } from "@shared/provider";
import { currentLocation } from "@shared/locations";
import { useTranslation } from "react-i18next";
import { useCategories } from "@/hooks/use-categories";

interface ServiceDetailModalProps {
  service: ServiceWithProvider | null;
  open: boolean;
  onClose: () => void;
  onBook: () => void;
  onViewProvider?: () => void;
}

export default function ServiceDetailModal({ service, open, onClose, onBook, onViewProvider }: ServiceDetailModalProps) {
  const { t } = useTranslation();
  const categories = useCategories();
  if (!service) return null;
  service = currentLocation(service);

  const isGroupService = service.serviceType === "group";
  const availableSpots = isGroupService ? ((service.maxCapacity || 1) - (service.availableCapacity || 0)) : 1;

  const getCategoryLabel = (key: string) => categories.data?.find(category => category.key === key)?.name ?? key;

  const getAgeGroupLabel = (ageGroup: string) => {
    switch (ageGroup) {
      case "children":
        return "Children (0-12)";
      case "teens":
        return "Teens (13-17)";
      case "adults":
        return "Adults (18-64)";
      case "seniors":
        return "Seniors (65+)";
      default:
        return ageGroup;
    }
  };

  const getGenderLabel = (gender: string) => {
    switch (gender) {
      case "male":
        return "Male Only";
      case "female":
        return "Female Only";
      case "both":
        return "All Genders";
      default:
        return gender;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-service-details">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-neutral-800" data-testid="text-service-name">
              {service.name}
            </DialogTitle>
            <Badge variant={isGroupService ? "secondary" : "default"}>
              {isGroupService ? "Group" : "One-to-One"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {service.imageUrl && <img src={service.imageUrl} alt={service.name} className="w-full max-h-72 object-cover rounded-xl" />}
          {/* Provider Info */}
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center">
              <span className="text-xl font-semibold">
                {getProviderName(service.provider).split(/\s+/).slice(0, 2).map(word => word[0]).join("")}
              </span>
            </div>
            <div>
              {onViewProvider ? <button type="button" onClick={onViewProvider}
                data-testid="button-provider-details" aria-label={t("catalog.view", { name: getProviderName(service.provider) })}
                className="font-semibold text-primary text-left underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {getProviderName(service.provider)}
              </button> : <p className="font-semibold text-neutral-800" data-testid="text-provider-name">
                {getProviderName(service.provider)}
              </p>}
              {service.employee?.name && <p className="text-sm text-neutral-600">With {service.employee.name}</p>}
              <ServiceRating service={service} />
            </div>
          </div>

          <Separator />

          {/* Description */}
          {service.description && (
            <div>
              <h3 className="font-semibold text-neutral-800 mb-2">About this service</h3>
              <p className="text-neutral-600 leading-relaxed" data-testid="text-description">
                {service.description}
              </p>
            </div>
          )}

          <Separator />

          {/* Service Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-neutral-500">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">Price</span>
              </div>
              <p className="text-lg font-semibold text-neutral-800" data-testid="text-price">
                ${service.price}
                {isGroupService ? " per person" : ""}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-neutral-500">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Duration</span>
              </div>
              <p className="text-lg font-semibold text-neutral-800" data-testid="text-duration">
                {service.duration} minutes
              </p>
            </div>

            {isGroupService && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-neutral-500">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">Group Size</span>
                </div>
                <p className="text-lg font-semibold text-neutral-800" data-testid="text-capacity">
                  {availableSpots} of {service.maxCapacity} spots available
                </p>
              </div>
            )}

            {service.distance !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-neutral-500">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm font-medium">Distance</span>
                </div>
                <p className="text-lg font-semibold text-neutral-800" data-testid="text-distance">
                  {service.distance} km away
                </p>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-neutral-500">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Category</span>
              </div>
              <p className="text-lg font-semibold text-neutral-800" data-testid="text-category">
                {getCategoryLabel(service.category)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-neutral-500">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Booking Type</span>
              </div>
              <Badge variant={service.instantBooking ? "default" : "outline"} data-testid="badge-booking-type">
                {service.instantBooking ? "Instant Book" : "Requires Approval"}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Additional Details */}
          <div className="space-y-3">
            <h3 className="font-semibold text-neutral-800">Additional Information</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-neutral-500 mb-1">Age Groups</p>
                <div className="flex flex-wrap gap-1">
                  {service.ageGroups && service.ageGroups.length > 0 ? (
                    (service.ageGroups as string[]).map((ageGroup) => (
                      <Badge key={ageGroup} variant="outline" className="text-xs">
                        {getAgeGroupLabel(ageGroup)}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-neutral-400">All ages welcome</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm text-neutral-500 mb-1">Target Audience</p>
                <Badge variant="outline" className="text-xs">
                  {getGenderLabel(service.targetGender || "both")}
                </Badge>
              </div>
            </div>

            {!service.instantBooking && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Advance Payment:</strong> {service.advancePaymentPercent}% required upfront
                </p>
              </div>
            )}

            {service.address && (
              <div>
                <p className="text-sm text-neutral-500 mb-1">Location</p>
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-neutral-400 mt-0.5" />
                  <p className="text-sm text-neutral-700" data-testid="text-address">
                    {service.address}
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button 
              onClick={onBook} 
              className="flex-1 bg-primary hover:bg-primary/90"
              data-testid="button-book-from-details"
            >
              {service.instantBooking ? "Book Now" : "Request Booking"}
            </Button>
            <Button 
              onClick={onClose} 
              variant="outline" 
              className="flex-1"
              data-testid="button-close-details"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
