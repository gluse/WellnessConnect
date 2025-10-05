import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CalendarCheck, CreditCard, X, AlertCircle } from "lucide-react";
import type { ServiceWithProvider } from "@shared/schema";

interface BookingModalProps {
  service: ServiceWithProvider;
  onClose: () => void;
}

export default function BookingModal({ service, onClose }: BookingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [participantCount, setParticipantCount] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState("10:00");

  const isGroupService = service.serviceType === "group";
  const maxParticipants = isGroupService ? (service.maxCapacity - (service.availableCapacity || 0)) : 1;
  const totalAmount = parseFloat(service.price) * participantCount;
  const advanceAmount = (totalAmount * service.advancePaymentPercent) / 100;

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async () => {
      const scheduledDate = new Date(`${selectedDate}T${selectedTime}`);
      const bookingData = {
        serviceId: service.id,
        providerId: service.providerId,
        participantCount,
        scheduledDate: scheduledDate.toISOString(),
        totalAmount: totalAmount.toFixed(2),
        advanceAmount: advanceAmount.toFixed(2),
        status: service.instantBooking ? "confirmed" : "pending",
        paymentStatus: "pending",
      };
      
      const response = await apiRequest("POST", "/api/bookings", bookingData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/seeker"] });
      toast({
        title: "Booking Created",
        description: service.instantBooking 
          ? "Your booking has been confirmed!"
          : "Your booking request has been sent to the provider.",
      });
      onClose();
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
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleConfirmBooking = () => {
    createBookingMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center">
            <CalendarCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Confirm Your Booking</h2>
          <p className="text-neutral-600">{service.name} with {service.provider.firstName}</p>
        </div>
        
        <div className="space-y-4">
          {/* Booking Details */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Service</span>
                  <span className="font-medium">{service.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Duration</span>
                  <span className="font-medium">{service.duration} minutes</span>
                </div>
                
                {/* Date and Time Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Date</Label>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Time</Label>
                    <Select value={selectedTime} onValueChange={setSelectedTime}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="09:00">9:00 AM</SelectItem>
                        <SelectItem value="10:00">10:00 AM</SelectItem>
                        <SelectItem value="11:00">11:00 AM</SelectItem>
                        <SelectItem value="14:00">2:00 PM</SelectItem>
                        <SelectItem value="15:00">3:00 PM</SelectItem>
                        <SelectItem value="16:00">4:00 PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Participant Count for Group Services */}
                {isGroupService && (
                  <div>
                    <Label className="text-sm">Number of Participants</Label>
                    <Select 
                      value={participantCount.toString()} 
                      onValueChange={(value) => setParticipantCount(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: maxParticipants }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {i + 1} participant{i > 0 ? 's' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                    <div>
                      <p className="font-medium">•••• •••• •••• 4242</p>
                      <p className="text-sm text-neutral-600">Expires 12/25</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">Change</Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Advance Payment Notice */}
          {service.advancePaymentPercent > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Advance Payment Required</span>
                </div>
                <p className="text-sm text-amber-700">
                  You'll be charged ${advanceAmount.toFixed(2)} ({service.advancePaymentPercent}%) now. 
                  The remaining ${(totalAmount - advanceAmount).toFixed(2)} will be charged after the service.
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={handleConfirmBooking}
              disabled={createBookingMutation.isPending}
            >
              {createBookingMutation.isPending ? "Processing..." : 
               service.instantBooking ? `Confirm & Pay $${advanceAmount.toFixed(2)}` : 
               "Send Request"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
