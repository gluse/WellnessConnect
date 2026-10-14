import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import AccountMenu from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Heart, Plus, Calendar, DollarSign, Star, Users, Check, X, Image as ImageIcon, Link as LinkIcon, Sparkles, Pencil, Copy } from "lucide-react";
import RoleSwitcher from "@/components/role-switcher";
import BottomNavigation from "@/components/bottom-navigation";
import { ImageUploader } from "@/components/ImageUploader";
import AppointmentAgenda from "@/components/appointment-agenda";
import AvailabilityEditor from "@/components/availability-editor";
import BookingTimePicker from "@/components/booking-time-picker";
import type { BookableSlot } from "@shared/scheduling";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProviderProfile from "@/components/provider-profile";
import CompanyTeam from "@/components/company-team";
import { format } from "date-fns";
import type { Service, Booking, BookingWithDetails, Availability, Employee, WorkspaceContext } from "@shared/schema";

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
  const [reschedulingBookingId, setReschedulingBookingId] = useState<number | null>(null);
  const [rescheduleSlot, setRescheduleSlot] = useState<BookableSlot | null>(null);
  const { data: context } = useQuery<WorkspaceContext>({ queryKey: ["/api/company/context"], retry: false });
  const canManageServices = context?.permissions.manageServices ?? false;
  const canManageSchedules = context?.permissions.manageSchedules ?? false;
  const canManageBookings = context?.permissions.manageBookings ?? false;
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
    isActive: true,
    employeeId: null as number | null,
  });
  // Fetch provider services
  const { data: employees = [] } = useQuery<Employee[]>({ queryKey: ["/api/provider/employees"] });
  const { data: services = [], isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services/provider"],
    retry: false,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch provider bookings
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<BookingWithDetails[]>({
    queryKey: ["/api/bookings/provider"],
    retry: false,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch provider availability schedules
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<Availability[]>({
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
      queryClient.invalidateQueries({ queryKey: ["/api/services/search"] });
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
        isActive: true,
        employeeId: null,
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
      queryClient.invalidateQueries({ queryKey: ["/api/services/search"] });
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
        isActive: true,
        employeeId: null,
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

  const copyServiceMutation = useMutation({
    mutationFn: async (serviceId: number): Promise<Service> => {
      const response = await apiRequest("POST", `/api/services/${serviceId}/copy`);
      return response.json();
    },
    onSuccess: (copy) => {
      queryClient.invalidateQueries({ queryKey: ["/api/services/provider"] });
      handleEditService(copy);
      toast({ title: "Service copied", description: "An inactive copy is ready to edit. Publish it when you are ready." });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) { window.location.assign("/api/login"); return; }
      toast({ title: "Unable to copy service", description: "Please try again.", variant: "destructive" });
    },
  });

  // Update booking status mutation
  const rescheduleMutation = useMutation({
    mutationFn: async () => apiRequest("PATCH", `/api/bookings/${reschedulingBookingId}/reschedule`, { scheduledDate: rescheduleSlot?.startsAt }),
    onSuccess: () => {
      setReschedulingBookingId(null); setRescheduleSlot(null);
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
      queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/availability") });
      toast({ title: "Reservation rescheduled" });
    },
    onError: () => toast({ title: "Unable to reschedule", description: "Check your access level and choose an available future time.", variant: "destructive" }),
  });
  const updateBookingMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: number; status: "confirmed" | "cancelled" | "completed" }): Promise<Booking> => {
      const response = await apiRequest("PATCH", `/api/bookings/${bookingId}/status`, { status });
      return response.json();
    },
    onSuccess: async (updatedBooking, { status }) => {
      queryClient.setQueryData<BookingWithDetails[]>(["/api/bookings/provider"], current =>
        current?.map(booking => booking.id === updatedBooking.id ? { ...booking, ...updatedBooking } : booking));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/bookings/seeker"] }),
      ]);
      toast({
        title: status === "completed" ? "Booking Completed" : "Booking Updated",
        description: status === "completed" ? "The appointment has been marked complete." : "Booking status has been updated",
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

  const handleCreateService = (isActive: boolean) => {
    if (!newService.name || !newService.price) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!newService.address || newService.latitude == null || newService.longitude == null) {
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
          isActive,
          price: newService.price,
        },
      });
    } else {
      createServiceMutation.mutate({
        ...newService,
        isActive,
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
      advancePaymentPercent: service.advancePaymentPercent ?? 50,
      address: service.address || "",
      latitude: service.latitude ?? null,
      longitude: service.longitude ?? null,
      imageUrl: (service as any).imageUrl || "",
      externalUrl: (service as any).externalUrl || "",
      isActive: service.isActive ?? false,
      employeeId: service.employeeId,
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
      isActive: true,
      employeeId: null,
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

  const handleBookingAction = (bookingId: number, action: "confirmed" | "cancelled" | "completed") => {
    if (updateBookingMutation.isPending) return;
    updateBookingMutation.mutate({ bookingId, status: action });
  };

  // Calculate stats
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter((b: BookingWithDetails) => b.status === "confirmed").length;
  const totalRevenue = bookings
    .filter((b: BookingWithDetails) => b.status === "confirmed" || b.status === "completed")
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
              <AccountMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20 lg:pb-8">
        <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
          {context ? <CompanyTeam context={context} employees={employees} onWorkspaceChange={() => { handleCloseModal(); setShowScheduleModal(false); setReschedulingBookingId(null); }} /> : <p>Loading workspace…</p>}
          {user && canManageServices && <ProviderProfile user={{ ...user, providerType: context?.company ? "company" : "individual", companyName: context?.company?.name ?? null }} />}
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
            {(canManageServices || canManageSchedules) && <div className="space-y-3">
              <h2 className="text-lg font-semibold text-neutral-800">Quick Actions</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {canManageServices && <Button
                  className="p-4 h-auto flex-col bg-primary text-white"
                  onClick={() => setShowAddService(true)}
                >
                  <Plus className="w-5 h-5 mb-2" />
                  Add Service
                </Button>}
                {canManageSchedules && <Button
                  variant="outline" 
                  className="p-4 h-auto flex-col"
                  onClick={() => setShowScheduleModal(true)}
                  data-testid="button-manage-schedule"
                >
                  <Calendar className="w-5 h-5 mb-2" />
                  Availability
                </Button>}
                {canManageServices && <Button
                  variant="outline" 
                  className="p-4 h-auto flex-col"
                  onClick={() => generateEmbeddingsMutation.mutate()}
                  disabled={generateEmbeddingsMutation.isPending || services.length === 0}
                  data-testid="button-generate-ai-search"
                >
                  <Sparkles className="w-5 h-5 mb-2" />
                  {generateEmbeddingsMutation.isPending ? "Updating..." : "Update AI Search"}
                </Button>}
              </div>
            </div>}

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
                    <p className="text-sm text-neutral-500 mb-4">{canManageServices ? "Create your first service to get started" : "An administrator can assign services to your employee profile."}</p>
                    {canManageServices && <Button onClick={() => setShowAddService(true)}>
                      Add Service
                    </Button>}
                  </CardContent>
                </Card>
              ) : (
                services.map((service: Service) => (
                  <Card key={service.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-neutral-800">{service.name}</h3>
                          {!service.isActive && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Inactive</Badge>}
                        </div>
                        <Badge variant={service.serviceType === "one_to_one" ? "default" : "secondary"}>
                          {service.serviceType === "one_to_one" ? "One-to-One" : "Group"}
                        </Badge>
                      </div>
                      {service.employeeId != null && <p className="text-sm text-neutral-600 mb-2">Employee: {employees.find(employee => employee.id === service.employeeId)?.name || "Assigned employee"}</p>}
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
                        {canManageServices && <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => copyServiceMutation.mutate(service.id)} disabled={copyServiceMutation.isPending} data-testid={`button-copy-service-${service.id}`}>
                            <Copy className="w-4 h-4 mr-1" />
                            {copyServiceMutation.isPending && copyServiceMutation.variables === service.id ? "Copying…" : "Copy"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEditService(service)} data-testid={`button-edit-service-${service.id}`}>Edit</Button>
                        </div>}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <AppointmentAgenda bookings={bookings} employees={employees} provider loading={bookingsLoading} updating={updateBookingMutation.isPending}
              onStatusChange={canManageBookings ? handleBookingAction : undefined}
              onReschedule={canManageBookings ? booking => { setReschedulingBookingId(booking.id); setRescheduleSlot(null); } : undefined} />
          </div>
        </main>

        {/* Add/Edit Service Modal */}
        {showAddService && canManageServices && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50">
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-w-md mx-auto max-h-[80vh] flex flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between p-6 pb-4">
                <h2 className="text-xl font-semibold">{editingService ? "Edit Service" : "Add New Service"}</h2>
                <Button variant="ghost" size="sm" onClick={handleCloseModal} data-testid="button-close-modal">
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="space-y-4 min-h-0 overflow-y-auto px-6 pb-6">
                {user?.providerType === "company" && <div>
                  <Label htmlFor="service-employee">Employee (optional)</Label>
                  <select id="service-employee" className="w-full border rounded-md p-2 bg-white" value={newService.employeeId ?? "none"}
                    onChange={event => setNewService(prev => ({ ...prev, employeeId: event.target.value === "none" ? null : Number(event.target.value) }))} data-testid="select-service-employee">
                    <option value="none">No specific employee (shared schedule)</option>
                    {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">Offers assigned to different employees can be booked at the same time. Customer name visibility is set in Employees.</p>
                </div>}
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
                          const unavailable = error instanceof Error && /^(500|502|503|429):/.test(error.message);
                          toast({
                            title: unavailable ? "Address lookup unavailable" : "Verification Failed",
                            description: unavailable
                              ? "Address lookup is temporarily unavailable. Please try again later or enter coordinates manually below."
                              : "Try the street address, town, and country, or enter coordinates manually below.",
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
                    <ImageUploader
                      onComplete={(objectPath) => setNewService(prev => ({ ...prev, imageUrl: objectPath }))}
                      buttonClassName="w-full"
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      {newService.imageUrl ? "Change Image" : "Upload Image"}
                    </ImageUploader>
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
                
              </div>
              <div className="shrink-0 border-t bg-white p-4">
                <p className="text-xs text-neutral-500 mb-3">
                  Save and Publish makes this service visible in search. Inactive services stay hidden.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleCreateService(false)}
                    disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
                    data-testid="button-save-inactive-service"
                  >
                    Save Inactive
                  </Button>
                  <Button
                    onClick={() => handleCreateService(true)}
                    disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
                    data-testid="button-save-service"
                  >
                    {createServiceMutation.isPending || updateServiceMutation.isPending ? "Saving…" : "Save and Publish"}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="w-full mt-1"
                  onClick={handleCloseModal}
                  data-testid="button-cancel-service"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {showScheduleModal && canManageSchedules && <AvailabilityEditor services={services} schedules={schedules} onClose={() => setShowScheduleModal(false)} />}
        {reschedulingBookingId != null && canManageBookings && <Dialog open onOpenChange={open => { if (!open && !rescheduleMutation.isPending) setReschedulingBookingId(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Reschedule appointment</DialogTitle><DialogDescription>Choose a new available time for this reservation.</DialogDescription></DialogHeader>
            <BookingTimePicker serviceId={bookings.find(booking => booking.id === reschedulingBookingId)!.serviceId} bookingId={reschedulingBookingId} selected={rescheduleSlot} onSelect={setRescheduleSlot} />
            <div className="flex justify-end gap-2"><Button variant="outline" disabled={rescheduleMutation.isPending} onClick={() => setReschedulingBookingId(null)}>Cancel</Button><Button disabled={!rescheduleSlot || rescheduleMutation.isPending} onClick={() => rescheduleMutation.mutate()}>{rescheduleMutation.isPending ? "Saving…" : "Save new time"}</Button></div>
          </DialogContent>
        </Dialog>}

        {/* Bottom Navigation - Mobile Only */}
        <div className="lg:hidden">
          <BottomNavigation />
        </div>
    </div>
  );
}
