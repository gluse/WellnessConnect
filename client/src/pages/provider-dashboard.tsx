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
import { Heart, Plus, Calendar, DollarSign, Star, Users, Check, X } from "lucide-react";
import RoleSwitcher from "@/components/role-switcher";
import BottomNavigation from "@/components/bottom-navigation";
import type { Service, BookingWithDetails } from "@shared/schema";

export default function ProviderDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddService, setShowAddService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
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
  });

  // Fetch provider services
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/services/provider"],
    retry: false,
  });

  // Fetch provider bookings
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["/api/bookings/provider"],
    retry: false,
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

  const handleRoleSwitch = (role: "seeker" | "provider") => {
    // This will be handled by the parent component
    window.location.reload();
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
      instantBooking: false,
      advancePaymentPercent: 50,
      address: "",
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

  // Calculate stats
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter((b: BookingWithDetails) => b.status === "confirmed").length;
  const totalRevenue = bookings
    .filter((b: BookingWithDetails) => b.status === "confirmed")
    .reduce((sum: number, b: BookingWithDetails) => sum + parseFloat(b.totalAmount), 0);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-md mx-auto bg-white shadow-xl min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white border-b border-neutral-200">
          <div className="px-4 py-3">
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
        <main className="pb-20">
          <div className="p-4 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
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
              <div className="grid grid-cols-2 gap-3">
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
                >
                  <Calendar className="w-5 h-5 mb-2" />
                  Manage Schedule
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
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={newService.address}
                    onChange={(e) => setNewService(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Service location"
                  />
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

        {/* Bottom Navigation */}
        <BottomNavigation />
      </div>
    </div>
  );
}
