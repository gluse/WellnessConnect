import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, BookingConflictError } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertServiceSchema, insertBookingSchema, insertAvailabilitySchema, providerProfileSchema, employeeSchema, accountDetailsSchema, addressInputSchema, type AddressLocation } from "@shared/schema";
import { addressStore } from "./addresses";
import { supabaseAdmin } from "./supabase";
import { z } from "zod";
import { createImageUpload, validateOwnedImage, validateServiceImage, canReadImage, downloadImage, ImageStorageError } from "./imageStorage";
import { generateEmbedding } from "./embeddings";
import { setupPublicSearchRoutes } from "./publicSearch";
import { setupPaymentRoutes } from "./payments";
import { GeocodingError } from "./geocoding";
import { registerLocation, resolveServiceLocation } from "./registeredLocations";
import { setupCompanyRoutes } from "./companyRoutes";
import { setupSchedulingRoutes } from "./schedulingRoutes";
import { setupAdminRoutes } from "./adminRoutes";
import { setupCategoryRoutes } from "./categoryRoutes";
import { categoryStore } from "./categories";
import { CategoryError } from "@shared/categories";
import { setupReviewRoutes } from "./reviewRoutes";
import { setupProviderCatalogRoutes } from "./providerCatalogRoutes";
import { setupStorefrontRoutes } from "./storefrontRoutes";
import { scope, assertService, assertBooking, ensureCompany, workspaceContext, saveWorkspaceSession, AccessError } from "./companyAccess";
import { db } from "./db";
import { companies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requestAuditContext } from "./audit/http";
import { AuditCaptureUnavailable } from "./audit/capture";

function apiFailure(error: unknown, res: import("express").Response, fallback: string) {
  const pgError = (error as any)?.cause ?? error;
  if ((pgError as any)?.code === "23503" && (pgError as any)?.constraint === "services_category_categories_key_fk") {
    return res.status(400).json({ message: "Choose an existing category." });
  }
  const known = error instanceof AccessError || error instanceof ImageStorageError || error instanceof GeocodingError || error instanceof CategoryError || error instanceof AuditCaptureUnavailable;
  res.status(known ? error.status : error instanceof z.ZodError ? 400 : error instanceof BookingConflictError ? 409 : 500)
    .json({ message: known || error instanceof BookingConflictError ? error.message : error instanceof z.ZodError ? error.issues[0].message : fallback });
}

// Helper to add English keywords to embedding text for cross-language search
async function enrichEmbeddingText(name: string, description: string | null, category: string): Promise<string> {
  const details = (await categoryStore.list()).find(item => item.key === category);
  let text = `${name} ${description || ''} ${category} ${details?.name ?? ''} ${details?.searchKeywords ?? ''}`.trim();
  
  // Common Latvian to English translations for better cross-language search
  const latvianToEnglish: Record<string, string> = {
    'pirts': 'sauna bathhouse steam bath traditional bathing ritual',
    'masāža': 'massage therapy bodywork',
    'matemātika': 'math mathematics arithmetic algebra calculus',
    'privātstundas': 'private lessons tutoring one-on-one teaching',
    'joga': 'yoga stretching meditation wellness',
    'fizika': 'physics science',
    'ķīmija': 'chemistry science',
    'valoda': 'language learning speaking',
    'angļu': 'english language',
    'vācu': 'german language',
    'krievu': 'russian language',
    'mūzika': 'music lessons instrument playing',
    'māksla': 'art drawing painting creative',
    'sports': 'sports fitness training exercise',
    'dejas': 'dance dancing lessons',
    'frizieris': 'hairdresser haircut styling barber',
    'skaistumkopšana': 'beauty care cosmetics skincare',
  };
  
  // Check for Latvian keywords and add English equivalents
  const lowerText = text.toLowerCase();
  for (const [latvian, english] of Object.entries(latvianToEnglish)) {
    if (lowerText.includes(latvian)) {
      text += ` ${english}`;
    }
  }
  
  return text;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  // Coordinate retention is managed explicitly, not by intermediary HTTP caches.
  app.use(["/api/services", "/api/bookings", "/api/geocode", "/api/addresses"], (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  setupAdminRoutes(app);
  setupCategoryRoutes(app);
  setupCompanyRoutes(app);
  setupSchedulingRoutes(app);
  setupReviewRoutes(app);
  setupProviderCatalogRoutes(app);
  setupStorefrontRoutes(app);
  setupPublicSearchRoutes(app, {
    searchServices: filters => storage.searchServices(filters),
    getPublicServiceEmbeddings: filters => storage.getPublicServiceEmbeddings(filters),
    generateEmbedding,
  });
  setupPaymentRoutes(app, isAuthenticated);

  // Object Storage routes
  app.post('/api/objects/upload', isAuthenticated, async (req: any, res) => {
    try {
      scope(req, "manageServices");
      const upload = await createImageUpload(req.user.claims.sub, req.body.contentType, req.body.size);
      res.json(upload);
    } catch (error) {
      console.error("Error getting upload URL:", error);
      apiFailure(error, res, "Failed to get upload URL");
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res, next) => {
    try {
      if (await canReadImage(req.path)) return next();
      return isAuthenticated(req, res, next);
    } catch (error) { return apiFailure(error, res, "Unable to load image"); }
  }, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    try {
      if (userId) {
        const workspace = await workspaceContext(userId, req.session.activeCompanyId);
        if (!await canReadImage(req.path, userId, workspace)) return res.sendStatus(403);
      }
      const image = await downloadImage(req.path);
      res.set({ "Content-Type": image.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      res.send(image.bytes);
    } catch (error) {
      console.error("Error checking object access:", error);
      return apiFailure(error, res, "Unable to load image");
    }
  });

  app.put("/api/service-images", isAuthenticated, async (req: any, res) => {
    if (typeof req.body.objectPath !== "string") {
      return res.status(400).json({ message: "objectPath is required" });
    }

    const userId = req.user?.claims?.sub;

    try {
      scope(req, "manageServices");
      const objectPath = req.body.objectPath;
      await validateOwnedImage(objectPath, userId);

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting service image:", error);
      apiFailure(error, res, "Failed to confirm image");
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      apiFailure(error, res, "Failed to fetch user");
    }
  });

  app.patch('/api/auth/user', isAuthenticated, async (req, res) => {
    try {
      const names = accountDetailsSchema.parse(req.body);
      const userId = req.user!.claims.sub;
      if (!await storage.getUser(userId)) return res.status(404).json({ message: "Account not found." });
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { first_name: names.firstName, last_name: names.lastName },
      });
      if (error) return res.status(503).json({ message: "Unable to save account details. Please try again." });
      res.json(await storage.updateUserNames(userId, names));
    } catch (error) {
      apiFailure(error, res, "Unable to save account details. Please try again.");
    }
  });

  // Config routes
  app.get('/api/config/maps', async (req, res) => {
    res.json({ 
      apiKey: process.env.GOOGLE_MAPS_API_KEY || '' 
    });
  });

  app.post('/api/geocode', isAuthenticated, async (req, res) => {
    try {
      const current = scope(req, "manageServices");
      res.json(await registerLocation(req.body.address, current));
    } catch (error) { apiFailure(error, res, "Address lookup is temporarily unavailable."); }
  });

  app.get('/api/addresses', isAuthenticated, async (req, res) => {
    try {
      res.json(await addressStore.list(scope(req, "manageServices")));
    } catch (error) { apiFailure(error, res, "Unable to load saved addresses."); }
  });
  const saveAddress: import("express").RequestHandler = async (req, res) => {
    try {
      const owner = scope(req, "manageServices");
      const id = req.params.id ? z.coerce.number().int().positive().parse(req.params.id) : undefined;
      const existing = id == null ? undefined : await addressStore.get(id, owner);
      const input = addressInputSchema.parse(req.body);
      const metadata = await resolveServiceLocation(input, req.body, existing);
      res.status(id == null ? 201 : 200).json(await addressStore.save({ ...input, ...metadata } as AddressLocation, owner, id));
    } catch (error) { apiFailure(error, res, "Unable to save address."); }
  };
  app.post('/api/addresses', isAuthenticated, saveAddress);
  app.patch('/api/addresses/:id', isAuthenticated, saveAddress);
  app.delete('/api/addresses/:id', isAuthenticated, async (req, res) => {
    try {
      const owner = scope(req, "manageServices");
      await addressStore.remove(z.coerce.number().int().positive().parse(req.params.id), owner);
      res.sendStatus(204);
    } catch (error) {
      if (((error as any)?.cause ?? error)?.code === "23503") return void res.status(409).json({ message: "This address is used by services. Choose another address for those services before removing it." });
      apiFailure(error, res, "Unable to remove address.");
    }
  });

  // User routes
  app.patch('/api/users/role', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { role } = req.body;
      
      if (!['seeker', 'provider'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await storage.updateUserRole(userId, role, requestAuditContext(req, "account"));
      res.json(user);
    } catch (error) {
      console.error("Error updating user role:", error instanceof AuditCaptureUnavailable ? "AUDIT_CAPTURE_UNAVAILABLE" : "ROLE_UPDATE_FAILED");
      apiFailure(error, res, "Failed to update user role");
    }
  });

  // Service routes
  app.patch('/api/provider/profile', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.claims.sub;
      const profile = providerProfileSchema.parse(req.body);
      const current = scope(req);
      if (current.companyId) {
        scope(req, "manageCompany");
        if (profile.providerType !== "company") throw new AccessError(409, "Choose Personal workspace to manage individual offers.");
        await db.update(companies).set({ name: profile.companyName! }).where(eq(companies.id, current.companyId));
        return res.json({ ...await storage.getUser(userId), providerType: "company", companyName: profile.companyName });
      }
      if (profile.providerType === "company") {
        const company = await ensureCompany(userId, profile.companyName!);
        req.session.activeCompanyId = company.id;
        await saveWorkspaceSession(req);
        return res.json(await storage.getUser(userId));
      }
      if (profile.providerType === "individual") {
        const listings = await storage.getServicesByProvider(userId);
        if (listings.some(service => service.employeeId != null)) {
          return res.status(409).json({ message: "Remove employee assignments from your services before switching to an individual profile." });
        }
      }
      res.json(await storage.updateProviderProfile(userId, {
        providerType: profile.providerType,
        companyName: null,
      }));
    } catch (error) {
      apiFailure(error, res, "Unable to save provider profile");
    }
  });

  app.get('/api/provider/employees', isAuthenticated, async (req, res) => {
    try {
      const current = scope(req);
      const employees = await storage.getEmployees(current.providerId, current.companyId);
      res.json(current.ctx.permissions.readAll ? employees : employees.filter(employee => employee.id === current.employeeId));
    } catch (error) { apiFailure(error, res, "Unable to load employees"); }
  });

  const saveEmployee: import("express").RequestHandler = async (req, res) => {
    try {
      const userId = req.user!.claims.sub;
      const current = scope(req);
      if (!current.companyId) return void res.status(400).json({ message: "Set up a company profile before adding employees." });
      scope(req, "manageTeam");
      const id = req.params.id ? z.coerce.number().int().positive().parse(req.params.id) : undefined;
      const employee = await storage.saveEmployee(current.providerId, employeeSchema.parse(req.body), id, current.companyId);
      if (!employee) return void res.status(404).json({ message: "Employee not found" });
      res.status(id ? 200 : 201).json(employee);
    } catch (error) {
      apiFailure(error, res, "Unable to save employee");
    }
  };
  app.post('/api/provider/employees', isAuthenticated, saveEmployee);
  app.patch('/api/provider/employees/:id', isAuthenticated, saveEmployee);
  app.delete('/api/provider/employees/:id', isAuthenticated, async (req, res) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const current = scope(req, "manageTeam");
      if (!await storage.deleteEmployee(current.providerId, id, current.companyId)) return void res.status(404).json({ message: "Employee not found" });
      res.json({ message: "Employee removed" });
    } catch (error) {
      const referenced = (error as { code?: string }).code === "23503";
      if (error instanceof AccessError) return void apiFailure(error, res, "Unable to remove employee");
      res.status(referenced ? 409 : error instanceof z.ZodError ? 400 : 500).json({ message: referenced
        ? "This employee is linked to services, bookings, or team access. Remove those links first; employees with booking history must be kept."
        : "Unable to remove employee" });
    }
  });

  async function validateEmployeeAssignment(employeeId: number | null | undefined, req: import("express").Request) {
    if (employeeId == null) return;
    const current = scope(req);
    const employees = await storage.getEmployees(current.providerId, current.companyId);
    if (!current.companyId || !employees.some(employee => employee.id === employeeId)) {
      throw new z.ZodError([{ code: "custom", path: ["employeeId"], message: "Choose an employee from your company." }]);
    }
  }

  async function validateAddressAssignment(addressId: number, req: import("express").Request) {
    const address = await addressStore.get(addressId, scope(req, "manageServices"));
    if (!address.address?.trim()) throw new AccessError(400, "Update this saved address before using it for a service.");
  }

  app.post('/api/services', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const current = scope(req, "manageServices");
      const serviceData = insertServiceSchema.parse({
        ...req.body,
        providerId: current.providerId,
        companyId: current.companyId ?? null,
      });
      if (!(await categoryStore.list()).some(category => category.key === serviceData.category)) throw new CategoryError(400, "Choose an existing category.");
      await validateAddressAssignment(serviceData.addressId, req);
      if (serviceData.imageUrl) await validateServiceImage(serviceData.imageUrl, userId, current.companyId);
      await validateEmployeeAssignment(serviceData.employeeId, req);
      
      const service = await storage.createService(serviceData);
      
      // Generate embedding for the new service asynchronously
      try {
        const textContent = await enrichEmbeddingText(service.name, service.description, service.category);
        const embedding = await generateEmbedding(textContent);
        await storage.upsertServiceEmbedding({
          serviceId: service.id,
          embedding,
          textContent,
        });
      } catch (embeddingError) {
        console.error("Failed to generate embedding for new service:", embeddingError);
        // Continue - embedding generation failure shouldn't block service creation
      }
      
      res.json(service);
    } catch (error) {
      console.error("Error creating service:", error instanceof Error ? error.name : "Error");
      apiFailure(error, res, "Failed to create service");
    }
  });

  app.get('/api/services/provider', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const current = scope(req);
      const services = await storage.getServicesByProvider(current.providerId, current.companyId);
      res.json(current.ctx.permissions.readAll ? services : services.filter(service => current.employeeId != null && service.employeeId === current.employeeId));
    } catch (error) {
      console.error("Error fetching provider services:", error);
      apiFailure(error, res, "Failed to fetch services");
    }
  });


  // Generate/update embedding for a service
  app.post('/api/services/:id/embedding', isAuthenticated, async (req: any, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const service = await storage.getServiceById(serviceId);
      
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      assertService(req, service, true);
      
      // Create text content for embedding with English translations
      const textContent = await enrichEmbeddingText(service.name, service.description, service.category);
      
      // Generate embedding
      const embedding = await generateEmbedding(textContent);
      
      // Store embedding
      const result = await storage.upsertServiceEmbedding({
        serviceId,
        embedding,
        textContent,
      });
      
      res.json({ message: "Embedding generated successfully", id: result.id });
    } catch (error) {
      console.error("Error generating embedding:", error);
      apiFailure(error, res, "Failed to generate embedding");
    }
  });

  // Bulk generate embeddings for all services (admin endpoint)
  // Workspace permissions control who can generate embeddings for its services.
  app.post('/api/admin/generate-embeddings', isAuthenticated, async (req: any, res) => {
    try {
      const current = scope(req, "manageServices");
      const providerServices = await storage.getServicesByProvider(current.providerId, current.companyId);
      
      let generated = 0;
      let failed = 0;
      
      for (const service of providerServices) {
        try {
          const textContent = await enrichEmbeddingText(service.name, service.description, service.category);
          const embedding = await generateEmbedding(textContent);
          
          await storage.upsertServiceEmbedding({
            serviceId: service.id,
            embedding,
            textContent,
          });
          generated++;
        } catch (err) {
          console.error(`Failed to generate embedding for service ${service.id}:`, err);
          failed++;
        }
      }
      
      res.json({ 
        message: "Embedding generation complete for your services",
        generated,
        failed,
        total: providerServices.length
      });
    } catch (error) {
      console.error("Error generating embeddings:", error);
      apiFailure(error, res, "Failed to generate embeddings");
    }
  });

  app.get('/api/services/:id', async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const service = await storage.getServiceById(serviceId);
      
      if (!service || !service.isActive || !service.companyActive) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Error fetching service:", error);
      apiFailure(error, res, "Failed to fetch service");
    }
  });

  app.post('/api/services/:id/copy', isAuthenticated, async (req, res) => {
    const serviceId = Number(req.params.id);
    if (!Number.isSafeInteger(serviceId) || serviceId < 1) {
      return res.status(400).json({ message: "Invalid service ID" });
    }
    try {
      const current = scope(req, "manageServices");
      const copy = await storage.copyService(serviceId, current.providerId, current.companyId);
      if (!copy) return res.status(404).json({ message: "Service not found" });
      res.status(201).json(copy);
    } catch (error) {
      console.error("Failed to copy service:", error instanceof Error ? error.name : "Error");
      apiFailure(error, res, "Failed to copy service");
    }
  });

  app.patch('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const serviceId = parseInt(req.params.id);
      
      // Verify service belongs to user
      const service = await storage.getServiceById(serviceId);
      const current = assertService(req, service, true);
      
      const updates = insertServiceSchema.omit({ providerId: true, companyId: true }).partial().parse(req.body);
      if (updates.category !== undefined && !(await categoryStore.list()).some(category => category.key === updates.category)) throw new CategoryError(400, "Choose an existing category.");
      if (updates.addressId !== undefined) await validateAddressAssignment(updates.addressId, req);
      if (updates.imageUrl) await validateServiceImage(updates.imageUrl, userId, current.companyId);
      await validateEmployeeAssignment(updates.employeeId, req);
      if (updates.employeeId !== undefined && updates.employeeId !== service!.employeeId) {
        const upcoming = (await storage.getBookingsByProvider(current.providerId, current.companyId)).some(booking => booking.serviceId === serviceId
          && (booking.status === "pending" || booking.status === "confirmed")
          && new Date(booking.scheduledDate).getTime() + ((booking.bookingDuration ?? service!.duration) + (booking.bookingCleanupTime ?? 0)) * 60_000 > Date.now());
        if (upcoming) return res.status(409).json({ message: "This service has upcoming bookings. Keep its assigned employee or resolve those bookings before changing the assignment." });
      }
      const updatedService = await storage.updateService(serviceId, updates);
      res.json(updatedService);
    } catch (error) {
      console.error("Error updating service:", error instanceof Error ? error.name : "Error");
      apiFailure(error, res, "Failed to update service");
    }
  });

  app.delete('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const serviceId = parseInt(req.params.id);
      
      // Verify service belongs to user
      const service = await storage.getServiceById(serviceId);
      assertService(req, service, true);
      
      await storage.deleteService(serviceId);
      res.json({ message: "Service deleted successfully" });
    } catch (error) {
      console.error("Error deleting service:", error);
      apiFailure(error, res, "Failed to delete service");
    }
  });

  // Booking routes
  app.post('/api/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const serviceId = z.number().int().positive().parse(req.body.serviceId);
      const service = await storage.getServiceById(serviceId);
      if (!service || !service.isActive || !service.companyActive) {
        return res.status(404).json({ message: "Service not found" });
      }

      const scheduledDate = z.string().datetime().transform(value => new Date(value)).refine(value => value.getTime() > Date.now(), "Choose a future appointment time.").parse(req.body.scheduledDate);
      const participantCount = z.number().int().min(1).max(service.serviceType === "group" ? service.maxCapacity ?? 1 : 1).parse(req.body.participantCount ?? 1);
      const total = Number(service.price) * participantCount;
      const bookingData = insertBookingSchema.parse({
        ...req.body,
        seekerId: userId,
        providerId: service.providerId,
        companyId: service.companyId,
        employeeId: service.employeeId,
        bookingDuration: service.duration,
        bookingCleanupTime: service.cleanupTime,
        status: service.instantBooking ? "confirmed" : "pending",
        paymentStatus: "pending",
        scheduledDate,
        participantCount,
        totalAmount: total.toFixed(2),
        advanceAmount: (total * (service.advancePaymentPercent ?? 0) / 100).toFixed(2),
      });
      
      const booking = await storage.createBooking(bookingData);
      res.json(booking);
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(error instanceof BookingConflictError ? 409 : error instanceof z.ZodError ? 400 : 500).json({ message: error instanceof BookingConflictError
        ? "This time slot is no longer available. Please choose another time."
        : error instanceof z.ZodError ? error.issues[0].message : "Failed to create booking" });
    }
  });

  app.get('/api/bookings/seeker', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookings = await storage.getBookingsBySeeker(userId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching seeker bookings:", error);
      apiFailure(error, res, "Failed to fetch bookings");
    }
  });

  app.get('/api/bookings/provider', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const current = scope(req);
      const bookings = await storage.getBookingsByProvider(current.providerId, current.companyId);
      res.json(current.ctx.permissions.readAll ? bookings : bookings.filter(booking => current.employeeId != null && booking.employeeId === current.employeeId));
    } catch (error) {
      console.error("Error fetching provider bookings:", error);
      apiFailure(error, res, "Failed to fetch bookings");
    }
  });

  app.patch('/api/bookings/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookingId = parseInt(req.params.id);
      const { status } = z.object({ status: z.enum(["pending", "confirmed", "cancelled", "completed"]) }).parse(req.body);
      
      // Verify booking belongs to user (as provider)
      const booking = await storage.getBookingById(bookingId);
      assertBooking(req, booking, true);
      
      const updatedBooking = await storage.updateBookingStatus(bookingId, status);
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking status:", error);
      apiFailure(error, res, "Failed to update booking status");
    }
  });

  // Availability routes
  app.patch('/api/bookings/:id/reschedule', isAuthenticated, async (req, res) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const date = z.string().datetime().transform(value => new Date(value)).refine(value => value.getTime() > Date.now(), "Choose a future appointment time.").parse(req.body.scheduledDate);
      const booking = await storage.getBookingById(id);
      assertBooking(req, booking, true);
      res.json(await storage.rescheduleBooking(id, date));
    } catch (error) { apiFailure(error, res, "Unable to reschedule reservation"); }
  });

  app.post('/api/availability', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const current = scope(req, "manageSchedules");
      
      // Normalize serviceId: treat empty string, "null", undefined as null
      const rawServiceId = req.body.serviceId;
      const serviceId = (rawServiceId && rawServiceId !== "null" && rawServiceId !== "") 
        ? parseInt(rawServiceId, 10) 
        : null;
      
      // Verify service ownership only if serviceId is provided
      // When serviceId is null, this is a general working hours schedule
      if (serviceId !== null) {
        const service = await storage.getServiceById(serviceId);
        assertService(req, service, true);
      }
      
      // Parse and convert data
      const availabilityData = {
        ...req.body,
        serviceId: serviceId, // Use normalized value
        providerId: current.providerId,
        companyId: current.companyId ?? null,
        specificDate: req.body.specificDate ? new Date(req.body.specificDate) : null,
        daysOfWeek: req.body.daysOfWeek || null,
      };
      
      const validated = insertAvailabilitySchema.parse(availabilityData);
      const availability = await storage.createAvailability(validated);
      res.json(availability);
    } catch (error) {
      console.error("Error creating availability:", error);
      apiFailure(error, res, "Failed to create availability");
    }
  });

  app.get('/api/availability/service/:serviceId', async (req, res) => {
    try {
      const serviceId = parseInt(req.params.serviceId);
      const service = await storage.getServiceById(serviceId);
      if (!service?.isActive || !service.companyActive) return res.status(404).json({ message: "Service not found" });
      const availability = await storage.getAvailabilityByService(serviceId);
      res.json(availability);
    } catch (error) {
      console.error("Error fetching availability:", error);
      apiFailure(error, res, "Failed to fetch availability");
    }
  });

  app.get('/api/availability/provider', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const current = scope(req);
      const availability = await storage.getAvailabilityByProvider(current.providerId, current.companyId);
      const assigned = current.ctx.permissions.readAll ? [] : await storage.getServicesByProvider(current.providerId, current.companyId);
      res.json(current.ctx.permissions.readAll ? availability : availability.filter(schedule => schedule.serviceId == null || assigned.some(service => service.id === schedule.serviceId && service.employeeId === current.employeeId)));
    } catch (error) {
      console.error("Error fetching provider availability:", error);
      apiFailure(error, res, "Failed to fetch availability");
    }
  });

  app.patch('/api/availability/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const availabilityId = parseInt(req.params.id);
      
      // Verify ownership
      const current = scope(req, "manageSchedules");
      const existing = await storage.getAvailabilityByProvider(current.providerId, current.companyId);
      const availability = existing.find(a => a.id === availabilityId);
      if (!availability) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Convert date if provided
      const updates = insertAvailabilitySchema.omit({ providerId: true, companyId: true }).partial().parse({
        ...req.body,
        specificDate: req.body.specificDate ? new Date(req.body.specificDate) : undefined,
      });
      if (updates.serviceId != null) assertService(req, await storage.getServiceById(updates.serviceId), true);
      
      const updated = await storage.updateAvailability(availabilityId, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating availability:", error);
      apiFailure(error, res, "Failed to update availability");
    }
  });

  app.delete('/api/availability/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const availabilityId = parseInt(req.params.id);
      
      // Delete with ownership verification in storage layer
      const current = scope(req, "manageSchedules");
      const existing = await storage.getAvailabilityByProvider(current.providerId, current.companyId);
      if (!existing.some(schedule => schedule.id === availabilityId)) throw new AccessError(403, "Schedule is not in this workspace.");
      await storage.deleteAvailability(availabilityId, current.providerId, current.companyId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting availability:", error);
      apiFailure(error, res, "Failed to delete availability");
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}
