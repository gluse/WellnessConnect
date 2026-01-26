import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Heart, Plus, Calendar, DollarSign, Star, Users, Check, X, Image as ImageIcon, Link as LinkIcon, Sparkles } from "lucide-react";
import RoleSwitcher from "@/components/role-switcher";
import BottomNavigation from "@/components/bottom-navigation";
import { ObjectUploader } from "@/components/ObjectUploader";
import CalendarView from "@/components/calendar-view";
import { format } from "date-fns";
import type { Service, BookingWithDetails, Availability } from "@shared/schema";

interface ProviderDashboardProps {
  onRoleSwitch?: (role: "seeker" | "provider") => void;
}

export default function ProviderDashboard({ onRoleSwitch }: ProviderDashboardProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddService, setShowAddService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newService, setNewService] = useState({
    name: "",
    description: "",
    category: "health_wellness",
    serviceType: "one_to_one",
    price: "",
    duration: 60,
    maxCapacity: 1,
    ageGroups: [] as string[],
    targetGender: "both",
    instantBooking: false,
    advancePaymentPercent: 50,
    address: "",
    latitude: null as number | null,
    longitude: null as number | null,
    imageUrl: "",
    externalUrl: "",
  });
  const [newSchedule, setNewSchedule] = useState({
    serviceId: 0,
    scheduleType: "specific" as "specific" | "recurring",
    specificDate: "",
    daysOfWeek: [] as number[],
    startTime: "09:00",
    endTime: "17:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recurrenceEndType: "never" as "never" | "after_events" | "on_date",
    recurrenceEndValue: "",
  });

  // Fetch provider services
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/services/provider"],
    retry: false,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch provider bookings
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["/api/bookings/provider"],
    retry: false,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch provider availability schedules
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["/api/availability/provider"],
    retry: false,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Create service mutation
  const createServiceMutation = useMutation({
    mutationFn: async (serviceData: any) => {
      const response = await apiRequest("POST", "/api/services", serviceData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services/provider"] });
      setShowAddService(false);
      setEditingService(null);
      setNewService({
        name: "",
        description: "",
        category: "health_wellness",
        serviceType: "one_to_one",
        price: "",
        duration: 60,
        maxCapacity: 1,
        ageGroups: [],
        targetGender: "both",
        instantBooking: false,
        advancePaymentPercent: 50,
        address: "",
        latitude: null,
        longitude: null,
      });
      toast({
        title: "Service Created",
        description: "Your service has been added successfully",
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
        description: "Failed to create service",
        variant: "destructive",
      });
    },
  });

  // Update service mutation
  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, serviceData }: { id: number; serviceData: any }) => {
      const response = await apiRequest("PATCH", `/api/services/${id}`, serviceData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services/provider"] });
      setShowAddService(false);
      setEditingService(null);
      setNewService({
        name: "",
        description: "",
        category: "health_wellness",
        serviceType: "one_to_one",
        price: "",
        duration: 60,
        maxCapacity: 1,
        ageGroups: [],
        targetGender: "both",
        instantBooking: false,
        advancePaymentPercent: 50,
        address: "",
        latitude: null,
        longitude: null,
      });
      toast({
        title: "Service Updated",
        description: "Your service has been updated successfully",
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
        description: "Failed to update service",
        variant: "destructive",
      });
    },
  });

  // Update booking status mutation
  const updateBookingMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: number; status: string }) => {
      const response = await apiRequest("PATCH", `/api/bookings/${bookingId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
      toast({
        title: "Booking Updated",
        description: "Booking status has been updated",
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
        description: "Failed to update booking",
        variant: "destructive",
      });
    },
  });

  // Create availability mutation
  const createAvailabilityMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      const response = await apiRequest("POST", "/api/availability", scheduleData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/availability/provider"] });
      setShowScheduleModal(false);
      setNewSchedule({
        serviceId: 0,
        scheduleType: "specific",
        specificDate: "",
        daysOfWeek: [],
        startTime: "09:00",
        endTime: "17:00",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        recurrenceEndType: "never",
        recurrenceEndValue: "",
      });
      toast({
        title: "Schedule Created",
        description: "Availability schedule has been added",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create schedule",
        variant: "destructive",
      });
    },
  });

  // Delete availability mutation
  const deleteAvailabilityMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      const response = await apiRequest("DELETE", `/api/availability/${scheduleId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/availability/provider"] });
      toast({
        title: "Schedule Deleted",
        description: "Availability schedule has been removed",
      });
    },
  });

  // Generate embeddings mutation for AI-powered search
  const generateEmbeddingsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/generate-embeddings", {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "AI Search Updated",
        description: `Generated search data for ${data.generated} services`,
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
        description: "Failed to generate search data",
        variant: "destructive",
      });
    },
  });

  const handleRoleSwitch = (role: "seeker" | "provider") => {
    if (onRoleSwitch) {
      onRoleSwitch(role);
    }
  };

  const handleCreateService = () => {
    if (!newService.name || !newService.price) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!newService.address || !newService.latitude || !newService.longitude) {
      toast({
        title: "Location Required",
        description: "Please provide an address and coordinates (verify address or enter manually)",
        variant: "destructive",
      });
      return;
    }

    if (editingService) {
      updateServiceMutation.mutate({
        id: editingService.id,
        serviceData: {
          ...newService,
          price: newService.price,
        },
      });
    } else {
      createServiceMutation.mutate({
        ...newService,
        price: newService.price,
      });
    }
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setNewService({
      name: service.name,
      description: service.description || "",
      category: service.category,
      serviceType: service.serviceType,
      price: service.price,
      duration: service.duration,
      maxCapacity: service.maxCapacity || 1,
      ageGroups: (service.ageGroups as string[]) || [],
      targetGender: service.targetGender || "both",
      instantBooking: service.instantBooking || false,
      advancePaymentPercent: service.advancePaymentPercent || 50,
      address: service.address || "",
      latitude: service.latitude || null,
      longitude: service.longitude || null,
      imageUrl: (service as any).imageUrl || "",
      externalUrl: (service as any).externalUrl || "",
    });
    setShowAddService(true);
  };

  const handleCloseModal = () => {
    setShowAddService(false);
    setEditingService(null);
    setNewService({
      name: "",
      description: "",
      category: "health_wellness",
      serviceType: "one_to_one",
      price: "",
      duration: 60,
      maxCapacity: 1,
      ageGroups: [],
      targetGender: "both",
      instantBooking: false,
      advancePaymentPercent: 50,
      address: "",
      latitude: null,
      longitude: null,
      imageUrl: "",
      externalUrl: "",
    });
  };

  const handleAgeGroupToggle = (ageGroup: string) => {
    setNewService(prev => ({
      ...prev,
      ageGroups: prev.ageGroups.includes(ageGroup)
        ? prev.ageGroups.filter(ag => ag !== ageGroup)
        : [...prev.ageGroups, ageGroup]
    }));
  };

  const handleBookingAction = (bookingId: number, action: "confirmed" | "cancelled") => {
    updateBookingMutation.mutate({ bookingId, status: action });
  };

  const handleCreateSchedule = () => {
    if (newSchedule.serviceId === 0) {
      toast({
        title: "Error",
        description: "Please select a service",
        variant: "destructive",
      });
      return;
    }

    createAvailabilityMutation.mutate(newSchedule);
  };

  const handleDayToggle = (day: number) => {
    setNewSchedule(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }));
  };

  // Calculate stats
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter((b: BookingWithDetails) => b.status === "confirmed").length;
  const totalRevenue = bookings
    .filter((b: BookingWithDetails) => b.status === "confirmed")
    .reduce((sum: number, b: BookingWithDetails) => sum + parseFloat(b.totalAmount), 0);

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
                currentRole="provider" 
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
      <main className="pb-20 lg:pb-8">
        <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{totalBookings}</div>
                  <div className="text-sm text-neutral-600">Total Bookings</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-secondary">4.8</div>
                  <div className="text-sm text-neutral-600">Average Rating</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-accent">${totalRevenue.toFixed(0)}</div>
                  <div className="text-sm text-neutral-600">Revenue</div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-neutral-800">Quick Actions</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Button 
                  className="p-4 h-auto flex-col bg-primary text-white"
                  onClick={() => setShowAddService(true)}
                >
                  <Plus className="w-5 h-5 mb-2" />
                  Add Service
                </Button>
                <Button 
                  variant="outline" 
                  className="p-4 h-auto flex-col"
                  onClick={() => setShowScheduleModal(true)}
                  data-testid="button-manage-schedule"
                >
                  <Calendar className="w-5 h-5 mb-2" />
                  Manage Schedule
                </Button>
                <Button 
                  variant="outline" 
                  className="p-4 h-auto flex-col"
                  onClick={() => generateEmbeddingsMutation.mutate()}
                  disabled={generateEmbeddingsMutation.isPending || services.length === 0}
                  data-testid="button-generate-ai-search"
                >
                  <Sparkles className="w-5 h-5 mb-2" />
                  {generateEmbeddingsMutation.isPending ? "Updating..." : "Update AI Search"}
                </Button>
              </div>
            </div>

            {/* My Services */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-800">My Services</h2>
                <Button variant="ghost" size="sm">View All</Button>
              </div>
              
              {servicesLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : services.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Plus className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-600">No services yet</p>
                    <p className="text-sm text-neutral-500 mb-4">Create your first service to get started</p>
                    <Button onClick={() => setShowAddService(true)}>
                      Add Service
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                services.map((service: Service) => (
                  <Card key={service.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-neutral-800">{service.name}</h3>
                        <Badge variant={service.serviceType === "one_to_one" ? "default" : "secondary"}>
                          {service.serviceType === "one_to_one" ? "One-to-One" : "Group"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-neutral-600">Price:</span>
                          <span className="font-medium ml-1">${service.price}</span>
                        </div>
                        <div>
                          <span className="text-neutral-600">Duration:</span>
                          <span className="font-medium ml-1">{service.duration}min</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <Badge variant={service.instantBooking ? "default" : "outline"}>
                          {service.instantBooking ? "Instant Book" : "Approval Required"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditService(service)}
                          data-testid={`button-edit-service-${service.id}`}
                        >
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Recent Bookings */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-neutral-800">Recent Bookings</h2>
              
              {bookingsLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : bookings.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Calendar className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-600">No bookings yet</p>
                  </CardContent>
                </Card>
              ) : (
                bookings.slice(0, 5).map((booking: BookingWithDetails) => (
                  <Card key={booking.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-neutral-200 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-neutral-600" />
                          </div>
                          <div>
                            <p className="font-medium text-neutral-800">
                              {booking.seeker.firstName} {booking.seeker.lastName}
                            </p>
                            <p className="text-sm text-neutral-600">{booking.service.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-neutral-800">${booking.totalAmount}</p>
                          <p className="text-sm text-neutral-600">
                            {new Date(booking.scheduledDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge 
                          variant={booking.status === "confirmed" ? "default" : booking.status === "pending" ? "secondary" : "destructive"}
                        >
                          {booking.status}
                        </Badge>
                        {booking.status === "pending" && (
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleBookingAction(booking.id, "confirmed")}
                              className="bg-secondary hover:bg-secondary/90"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleBookingAction(booking.id, "cancelled")}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Calendar View */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-neutral-800">Calendar</h2>
              <CalendarView
                services={services as Service[]}
                bookings={bookings as BookingWithDetails[]}
                schedules={schedules as Availability[]}
                onDateClick={(date) => {
                  toast({
                    title: "Date Selected",
                    description: `You selected ${format(date, 'MMMM d, yyyy')}`,
                  });
                }}
              />
            </div>
          </div>
        </main>

        {/* Add/Edit Service Modal */}
        {showAddService && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50">
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 max-w-md mx-auto max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">{editingService ? "Edit Service" : "Add New Service"}</h2>
                <Button variant="ghost" size="sm" onClick={handleCloseModal} data-testid="button-close-modal">
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="serviceName">Service Name *</Label>
                  <Input
                    id="serviceName"
                    value={newService.name}
                    onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Deep Tissue Massage"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newService.description}
                    onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your service..."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select 
                      value={newService.category} 
                      onValueChange={(value) => setNewService(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="health_wellness">Health & Wellness</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="entertainment">Entertainment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="serviceType">Service Type</Label>
                    <Select 
                      value={newService.serviceType} 
                      onValueChange={(value) => setNewService(prev => ({ ...prev, serviceType: value, maxCapacity: value === "one_to_one" ? 1 : 10 }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_to_one">One-to-One</SelectItem>
                        <SelectItem value="group">Group</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="price">Price ($) *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={newService.price}
                      onChange={(e) => setNewService(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="duration">Duration (min)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={newService.duration}
                      onChange={(e) => setNewService(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                    />
                  </div>
                </div>
                
                {newService.serviceType === "group" && (
                  <div>
                    <Label htmlFor="maxCapacity">Max Capacity</Label>
                    <Input
                      id="maxCapacity"
                      type="number"
                      value={newService.maxCapacity}
                      onChange={(e) => setNewService(prev => ({ ...prev, maxCapacity: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                )}
                
                <div>
                  <Label>Target Age Groups</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {["children", "teens", "adults", "seniors"].map(ageGroup => (
                      <Button
                        key={ageGroup}
                        variant={newService.ageGroups.includes(ageGroup) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleAgeGroupToggle(ageGroup)}
                        data-testid={`button-age-${ageGroup}`}
                      >
                        {ageGroup.charAt(0).toUpperCase() + ageGroup.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <Label>Target Gender</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant={newService.targetGender === "females" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewService(prev => ({ ...prev, targetGender: "females" }))}
                      data-testid="button-gender-females"
                      className="flex-1"
                    >
                      Females
                    </Button>
                    <Button
                      variant={newService.targetGender === "males" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewService(prev => ({ ...prev, targetGender: "males" }))}
                      data-testid="button-gender-males"
                      className="flex-1"
                    >
                      Males
                    </Button>
                    <Button
                      variant={newService.targetGender === "both" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewService(prev => ({ ...prev, targetGender: "both" }))}
                      data-testid="button-gender-both"
                      className="flex-1"
                    >
                      Females and Males
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch 
                    checked={newService.instantBooking}
                    onCheckedChange={(checked) => setNewService(prev => ({ ...prev, instantBooking: checked }))}
                  />
                  <Label>Enable Instant Booking</Label>
                </div>
                
                <div>
                  <Label htmlFor="advancePayment">Advance Payment (%)</Label>
                  <Input
                    id="advancePayment"
                    type="number"
                    min="0"
                    max="100"
                    value={newService.advancePaymentPercent}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value)) {
                        const clampedValue = Math.min(Math.max(value, 0), 100);
                        setNewService(prev => ({ ...prev, advancePaymentPercent: clampedValue }));
                      } else if (e.target.value === '') {
                        setNewService(prev => ({ ...prev, advancePaymentPercent: 0 }));
                      }
                    }}
                    data-testid="input-advance-payment"
                  />
                </div>
                
                <div>
                  <Label htmlFor="address">Address *</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="address"
                      value={newService.address}
                      onChange={(e) => setNewService(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Enter service address"
                      data-testid="input-address"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        if (!newService.address.trim()) {
                          toast({
                            title: "Address Required",
                            description: "Please enter an address to verify",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        try {
                          const response = await apiRequest("POST", "/api/geocode", {
                            address: newService.address,
                          });
                          const data = await response.json();
                          
                          setNewService(prev => ({
                            ...prev,
                            latitude: data.latitude,
                            longitude: data.longitude,
                            address: data.formattedAddress,
                          }));
                          
                          toast({
                            title: "Address Verified",
                            description: "Location coordinates set successfully",
                          });
                        } catch (error) {
                          toast({
                            title: "Verification Failed",
                            description: "Unable to verify address automatically. Please enter coordinates manually below.",
                            variant: "destructive",
                          });
                        }
                      }}
                      data-testid="button-verify-address"
                    >
                      Verify
                    </Button>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Use the Verify button to auto-fill coordinates, or enter them manually below
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="latitude">Latitude *</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      value={newService.latitude ?? ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? null : parseFloat(e.target.value);
                        setNewService(prev => ({ ...prev, latitude: value }));
                      }}
                      placeholder="e.g. 57.5397"
                      data-testid="input-latitude"
                    />
                  </div>
                  <div>
                    <Label htmlFor="longitude">Longitude *</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      value={newService.longitude ?? ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? null : parseFloat(e.target.value);
                        setNewService(prev => ({ ...prev, longitude: value }));
                      }}
                      placeholder="e.g. 25.4175"
                      data-testid="input-longitude"
                    />
                  </div>
                </div>
                {newService.latitude && newService.longitude && (
                  <p className="text-xs text-green-600">
                    ✓ Coordinates set: {newService.latitude.toFixed(4)}, {newService.longitude.toFixed(4)}
                  </p>
                )}
                
                <Separator />
                
                <div>
                  <Label>Service Image (Optional)</Label>
                  <div className="mt-2">
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={10485760}
                      onGetUploadParameters={async () => {
                        const response = await apiRequest("POST", "/api/objects/upload", {});
                        const data = await response.json();
                        return {
                          method: 'PUT' as const,
                          url: data.uploadURL,
                        };
                      }}
                      onComplete={(result) => {
                        if (result.successful.length > 0) {
                          const uploadedUrl = result.successful[0].uploadURL;
                          apiRequest("PUT", "/api/service-images", { imageURL: uploadedUrl })
                            .then((res) => res.json())
                            .then((data) => {
                              setNewService(prev => ({ ...prev, imageUrl: data.objectPath }));
                              toast({
                                title: "Image Uploaded",
                                description: "Service image uploaded successfully",
                              });
                            })
                            .catch((error) => {
                              console.error("Error setting image:", error);
                              toast({
                                title: "Error",
                                description: "Failed to set service image",
                                variant: "destructive",
                              });
                            });
                        }
                      }}
                      buttonClassName="w-full"
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      {newService.imageUrl ? "Change Image" : "Upload Image"}
                    </ObjectUploader>
                    {newService.imageUrl && (
                      <p className="text-xs text-green-600 mt-2">
                        ✓ Image uploaded
                      </p>
                    )}
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="externalUrl">External URL (Optional)</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <LinkIcon className="w-4 h-4 text-neutral-400" />
                    <Input
                      id="externalUrl"
                      type="url"
                      value={newService.externalUrl}
                      onChange={(e) => setNewService(prev => ({ ...prev, externalUrl: e.target.value }))}
                      placeholder="https://example.com/more-info"
                      data-testid="input-external-url"
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Add a link to your website or booking page
                  </p>
                </div>
                
                <Separator />
                
                <div className="flex space-x-3">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={handleCloseModal}
                    data-testid="button-cancel-service"
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={handleCreateService}
                    disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
                    data-testid="button-save-service"
                  >
                    {editingService
                      ? (updateServiceMutation.isPending ? "Updating..." : "Update Service")
                      : (createServiceMutation.isPending ? "Creating..." : "Create Service")
                    }
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50">
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 max-w-md mx-auto max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Manage Availability</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowScheduleModal(false)} data-testid="button-close-schedule">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="scheduleService">Select Service</Label>
                  <select
                    id="scheduleService"
                    className="w-full p-2 border rounded-md"
                    value={newSchedule.serviceId}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, serviceId: parseInt(e.target.value) }))}
                    data-testid="select-service"
                  >
                    <option value={0}>Select a service...</option>
                    {(services as Service[]).map((service: Service) => (
                      <option key={service.id} value={service.id}>{service.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Schedule Type</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant={newSchedule.scheduleType === "specific" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewSchedule(prev => ({ ...prev, scheduleType: "specific" }))}
                      data-testid="button-schedule-specific"
                      className="flex-1"
                    >
                      Specific Date
                    </Button>
                    <Button
                      variant={newSchedule.scheduleType === "recurring" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewSchedule(prev => ({ ...prev, scheduleType: "recurring" }))}
                      data-testid="button-schedule-recurring"
                      className="flex-1"
                    >
                      Recurring
                    </Button>
                  </div>
                </div>

                {newSchedule.scheduleType === "specific" && (
                  <div>
                    <Label htmlFor="specificDate">Date</Label>
                    <Input
                      id="specificDate"
                      type="date"
                      value={newSchedule.specificDate}
                      onChange={(e) => setNewSchedule(prev => ({ ...prev, specificDate: e.target.value }))}
                      data-testid="input-specific-date"
                    />
                  </div>
                )}

                {newSchedule.scheduleType === "recurring" && (
                  <>
                    <div>
                      <Label>Days of Week</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {[{day: 0, label: "Sun"}, {day: 1, label: "Mon"}, {day: 2, label: "Tue"}, {day: 3, label: "Wed"}, {day: 4, label: "Thu"}, {day: 5, label: "Fri"}, {day: 6, label: "Sat"}].map(({day, label}) => (
                          <Button
                            key={day}
                            variant={newSchedule.daysOfWeek.includes(day) ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleDayToggle(day)}
                            data-testid={`button-day-${day}`}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Recurrence End</Label>
                      <select
                        className="w-full p-2 border rounded-md mt-2"
                        value={newSchedule.recurrenceEndType}
                        onChange={(e) => setNewSchedule(prev => ({ ...prev, recurrenceEndType: e.target.value as any }))}
                        data-testid="select-recurrence-end"
                      >
                        <option value="never">Never</option>
                        <option value="after_events">After number of events</option>
                        <option value="on_date">On specific date</option>
                      </select>
                    </div>

                    {newSchedule.recurrenceEndType === "after_events" && (
                      <div>
                        <Label htmlFor="eventCount">Number of Events</Label>
                        <Input
                          id="eventCount"
                          type="number"
                          min="1"
                          value={newSchedule.recurrenceEndValue}
                          onChange={(e) => setNewSchedule(prev => ({ ...prev, recurrenceEndValue: e.target.value }))}
                          data-testid="input-event-count"
                        />
                      </div>
                    )}

                    {newSchedule.recurrenceEndType === "on_date" && (
                      <div>
                        <Label htmlFor="endDate">End Date</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={newSchedule.recurrenceEndValue}
                          onChange={(e) => setNewSchedule(prev => ({ ...prev, recurrenceEndValue: e.target.value }))}
                          data-testid="input-end-date"
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={newSchedule.startTime}
                      onChange={(e) => setNewSchedule(prev => ({ ...prev, startTime: e.target.value }))}
                      data-testid="input-start-time"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={newSchedule.endTime}
                      onChange={(e) => setNewSchedule(prev => ({ ...prev, endTime: e.target.value }))}
                      data-testid="input-end-time"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={newSchedule.timezone}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, timezone: e.target.value }))}
                    placeholder="e.g. America/New_York"
                    data-testid="input-timezone"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Current: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
                </div>

                <Separator />

                <div className="flex space-x-3">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowScheduleModal(false)}
                    data-testid="button-cancel-schedule"
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={handleCreateSchedule}
                    disabled={createAvailabilityMutation.isPending}
                    data-testid="button-save-schedule"
                  >
                    {createAvailabilityMutation.isPending ? "Creating..." : "Create Schedule"}
                  </Button>
                </div>

                {schedules.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-3">Existing Schedules</h3>
                      <div className="space-y-2">
                        {(schedules as any[]).map((schedule: any) => (
                          <div key={schedule.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {schedule.scheduleType === "specific" ? "Specific" : "Recurring"}
                              </p>
                              <p className="text-xs text-neutral-600">
                                {schedule.startTime} - {schedule.endTime}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteAvailabilityMutation.mutate(schedule.id)}
                              data-testid={`button-delete-schedule-${schedule.id}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation - Mobile Only */}
        <div className="lg:hidden">
          <BottomNavigation />
        </div>
    </div>
  );
}
