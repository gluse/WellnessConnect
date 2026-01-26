import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CalendarCheck, CreditCard, X, AlertCircle, Clock, Loader2 } from "lucide-react";
import type { ServiceWithProvider } from "@shared/schema";

interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  slotDuration: number;
}

interface AvailableSlotsResponse {
  date: string;
  serviceId: number;
  serviceDuration: number;
  slots: TimeSlot[];
  totalSlots: number;
  availableSlots: number;
}

interface BookingModalProps {
  service: ServiceWithProvider;
  onClose: () => void;
}

function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export default function BookingModal({ service, onClose }: BookingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [participantCount, setParticipantCount] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const isGroupService = service.serviceType === "group";
  const maxParticipants = isGroupService ? (service.maxCapacity - (service.availableCapacity || 0)) : 1;
  const totalAmount = parseFloat(service.price) * participantCount;
  const advanceAmount = (totalAmount * service.advancePaymentPercent) / 100;

  const { data: slotsData, isLoading: slotsLoading, error: slotsError } = useQuery<AvailableSlotsResponse>({
    queryKey: ['/api/availability/slots', service.id, selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/availability/slots/${service.id}?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch slots');
      return response.json();
    },
    enabled: !!selectedDate && !!service.id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate]);

  const createBookingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSlot) throw new Error('Please select a time slot');
      
      const scheduledDate = new Date(`${selectedDate}T${selectedSlot.startTime}`);
      const bookingData = {
        serviceId: service.id,
        providerId: service.providerId,
        participantCount,
        scheduledDate: scheduledDate.toISOString(),
        bookingDuration: selectedSlot.slotDuration,
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
      queryClient.invalidateQueries({ queryKey: ['/api/availability/slots', service.id] });
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
    if (!selectedSlot) {
      toast({
        title: "Select Time Slot",
        description: "Please select an available time slot.",
        variant: "destructive",
      });
      return;
    }
    createBookingMutation.mutate();
  };

  const availableSlots = slotsData?.slots?.filter(s => s.available) || [];
  const hasNoSlots = !slotsLoading && availableSlots.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 max-w-md mx-auto max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center">
            <CalendarCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Confirm Your Booking</h2>
          <p className="text-neutral-600">{service.name} with {service.provider.firstName}</p>
        </div>
        
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Service</span>
                  <span className="font-medium">{service.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Duration</span>
                  <span className="font-medium">{selectedSlot?.slotDuration || service.duration} minutes</span>
                </div>
                
                <div>
                  <Label className="text-sm">Select Date</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Available Time Slots
                  </Label>
                  
                  {slotsLoading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="ml-2 text-sm text-neutral-600">Loading available slots...</span>
                    </div>
                  )}

                  {slotsError && (
                    <div className="text-center py-4 text-amber-600 text-sm">
                      Could not load time slots. The provider may not have set availability for this date.
                    </div>
                  )}

                  {hasNoSlots && !slotsError && (
                    <div className="text-center py-4 text-neutral-600 text-sm">
                      No available time slots for this date. Please select another date.
                    </div>
                  )}

                  {!slotsLoading && availableSlots.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {availableSlots.map((slot) => (
                        <Button
                          key={slot.startTime}
                          type="button"
                          variant={selectedSlot?.startTime === slot.startTime ? "default" : "outline"}
                          size="sm"
                          className="text-xs"
                          onClick={() => setSelectedSlot(slot)}
                        >
                          {formatTime(slot.startTime)}
                        </Button>
                      ))}
                    </div>
                  )}

                  {selectedSlot && (
                    <p className="text-xs text-neutral-500 mt-2">
                      Selected: {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)} ({selectedSlot.slotDuration} min)
                    </p>
                  )}
                </div>
                
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
          
          <div className="flex space-x-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={handleConfirmBooking}
              disabled={createBookingMutation.isPending || !selectedSlot}
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
