import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, BookingConflictError } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertServiceSchema, insertBookingSchema, insertAvailabilitySchema, providerProfileSchema, employeeSchema, accountDetailsSchema, addressInputSchema, type AddressLocation } from "@shared/schema";
import { addressStore } from "./addresses";
import { supabaseAdmin, createAuthClient } from "./supabase";
import { z } from "zod";
import { createImageUpload, validateOwnedImage, validateServiceImage, canReadImage, downloadImage, ImageStorageError } from "./imageStorage";
import { serviceImageChanges, ServiceImageError } from "./serviceImages";
import { generateEmbedding } from "./embeddings";
import { setupPublicSearchRoutes } from "./publicSearch";
import { setupSearchLocationRoutes } from "./searchLocationRoutes";
import { searchLocationStore } from "./searchLocations";
import { setupPaymentRoutes } from "./payments";
import { GeocodingError } from "./geocoding";
import { registerLocation, resolveServiceLocation } from "./registeredLocations";
import { setupCompanyRoutes } from "./companyRoutes";
import { setupSchedulingRoutes, serviceSlotData } from "./schedulingRoutes";
import { setupAdminRoutes } from "./adminRoutes";
import { setupCategoryRoutes } from "./categoryRoutes";
import { categoryStore } from "./categories";
import { CategoryError } from "@shared/categories";
import { setupReviewRoutes } from "./reviewRoutes";
import { setupProviderCatalogRoutes } from "./providerCatalogRoutes";
import { setupStorefrontRoutes } from "./storefrontRoutes";
import { scope, assertService, assertBookingChange, ensureCompany, workspaceContext, saveWorkspaceSession, AccessError } from "./companyAccess";
import { CustomerBookingError } from "./customerBookings";
import { db } from "./db";
import { companies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requestAuditContext } from "./audit/http";
import { AuditCaptureUnavailable } from "./audit/capture";
import { auditRemoteOperation } from "./audit/remote";
import { protectedReadAudit, auditResponseDenials } from "./audit/reads";
import { setupServiceViewRoutes } from "./serviceViewRoutes";
import { setupServiceViewReportRoutes } from "./service-view-report/routes";
import { createServiceViewReportStore } from "./service-view-report/store";
import { createServiceViewReportService, ServiceViewReportError } from "./service-view-report/service";
import { setupLocationAuditRoutes } from "./audit/location";
import { setupAuditViewerRoutes } from "./audit/viewer";
import { auditViewerStore } from "./audit/viewer-runtime";
import { setupNotificationRoutes } from "./notifications/routes";
import { setupAppointmentRoutes } from "./appointments/routes";
import { setupWishlistRoutes } from "./wishlist/routes";
import { createWishlistStore } from "./wishlist/postgres";
import { createWishlistService } from "./wishlist/service";
import { createInboxService } from "./wishlist/inbox";
import { createSearchPageStore } from "./search-pagination/store";
import { bookingReminderSummaries } from "./notifications/repository";
import { notificationConfig } from "./notifications/transports";
import { NotificationError, notificationTimezoneSchema } from "@shared/notifications";
import { bookingMoneyDto, bookingPriceSnapshot, expectedPriceSchema, MoneyInputError, PriceChangedError } from "./money";
import { setupWorkspacePricingRoutes } from "./workspace-pricing/routes";
import { createWorkspacePricingStore } from "./workspace-pricing/store";
import { WorkspacePricingError } from "@shared/workspace-pricing";
import { bookingOptionSelectionSchema, bookingQuoteInputSchema, bookingQuoteResponseSchema, calculatePlatformQuote, serviceOptionsInputSchema } from "@shared/service-options";
import { effectiveOnlinePayments } from "./service-options-store";
import { optionBookableSlots, optionEffectiveService, selectedServiceOption, ServiceOptionError } from "./service-options";

// Older booking clients send `notes`; both inputs start the same conversation.
const initialBookingMessageSchema = z.object({
  initialMessage: z.string().trim().max(4000).nullish(),
  notes: z.string().trim().max(4000).nullish(),
}).superRefine((input, context) => {
  if (input.initialMessage && input.notes && input.initialMessage !== input.notes) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["initialMessage"], message: "Provide one initial message for this reservation." });
  }
}).transform(input => input.initialMessage || input.notes || null);

function apiFailure(error: unknown, res: import("express").Response, fallback: string) {
  if (error instanceof ServiceOptionError) return res.status(error.status).json({ code: error.code, message: error.message });
  if (error instanceof PriceChangedError) return res.status(409).json({ code: error.code, message: error.message, currentPrice: error.currentPrice, currentCurrency: error.currentCurrency, currentAdvancePaymentPercent: error.currentAdvancePaymentPercent });
  const pgError = (error as any)?.cause ?? error;
  if ((pgError as any)?.code === "23503" && (pgError as any)?.constraint === "services_category_categories_key_fk") {
    return res.status(400).json({ message: "Choose an existing category." });
  }
  const known = error instanceof AccessError || error instanceof CustomerBookingError || error instanceof ImageStorageError || error instanceof ServiceImageError || error instanceof GeocodingError || error instanceof CategoryError || error instanceof AuditCaptureUnavailable || error instanceof NotificationError || error instanceof MoneyInputError;
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

export async function registerRoutes(app: Express, billing?: { mountAuthenticated(app: Express): void }): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  app.use(auditResponseDenials());
  app.use(protectedReadAudit());
  // Coordinate retention is managed explicitly, not by intermediary HTTP caches.
  app.use(["/api/services", "/api/bookings", "/api/geocode", "/api/addresses"], (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  setupAdminRoutes(app);
  setupAuditViewerRoutes(app, { authenticate: isAuthenticated, store: auditViewerStore });
  setupLocationAuditRoutes(app, { verifyActor: async req => {
    const auth = req.session?.auth;
    if (!auth) return { kind: "anonymous" };
    const { data, error } = await createAuthClient().auth.getUser(auth.accessToken);
    if (error || !data.user || data.user.id !== auth.userId) throw new AuditCaptureUnavailable();
    const profile = await storage.getUser(data.user.id);
    if (!profile || (profile.currentRole !== "seeker" && profile.currentRole !== "provider")) throw new AuditCaptureUnavailable();
    return { kind: "user", userId: data.user.id, effectiveRole: profile.currentRole };
  } });
  setupCategoryRoutes(app);
  setupCompanyRoutes(app);
  setupServiceViewReportRoutes(app, {
    authenticate: isAuthenticated,
    service: createServiceViewReportService(createServiceViewReportStore(db), () => process.env.PRODUCT_ACTIVITY_ENABLED === "true"),
    currentActor(req) {
      try { const current = scope(req); return { userId: current.userId, companyId: current.companyId ?? null }; }
      catch (error) {
        if (error instanceof AccessError) throw new ServiceViewReportError(403, "workspace_unavailable");
        throw error;
      }
    },
  });
  setupWorkspacePricingRoutes(app, { authenticate: isAuthenticated, store: createWorkspacePricingStore(db), currentWorkspace(req, write) {
    try {
      const current = scope(req, "manageServices");
      if (write && current.companyId != null && !current.ctx.permissions.manageCompany) throw new AccessError(403, "Your access level does not allow this action.");
      return { userId: current.userId, companyId: current.companyId };
    } catch (error) {
      if (error instanceof AccessError) throw new WorkspacePricingError(403, "WORKSPACE_PRICING_FORBIDDEN", error.message);
      throw error;
    }
  } });
  setupNotificationRoutes(app);
  setupAppointmentRoutes(app);
  const wishlist = createWishlistService(createWishlistStore(db), id => storage.getServiceById(id));
  setupWishlistRoutes(app, isAuthenticated, wishlist, createInboxService(db, id => storage.getBookingById(id)), id => storage.getUser(id));
  billing?.mountAuthenticated(app);
  setupSchedulingRoutes(app);
  setupReviewRoutes(app);
  setupProviderCatalogRoutes(app);
  setupStorefrontRoutes(app);
  setupPublicSearchRoutes(app, {
    searchPageStore: createSearchPageStore(db, ids => storage.searchServices({serviceIds: ids})),
    searchServices: filters => storage.searchServices(filters),
    getPublicServiceEmbeddings: filters => storage.getPublicServiceEmbeddings(filters),
    generateEmbedding,
  });
  setupPaymentRoutes(app, isAuthenticated);
  setupSearchLocationRoutes(app, isAuthenticated, searchLocationStore);
  setupServiceViewRoutes(app, {
    getService: id => storage.getServiceById(id),
    recordProductView: process.env.PRODUCT_ACTIVITY_ENABLED === "true" ? (id, userId) => wishlist.recordView(id, userId) : undefined,
    verifyActor: async (token, expectedUserId) => {
      const { data, error } = await createAuthClient().auth.getUser(token);
      if (error || !data.user || data.user.id !== expectedUserId) return { kind: "anonymous" };
      const profile = await storage.getUser(data.user.id);
      if (!profile || (profile.currentRole !== "seeker" && profile.currentRole !== "provider")) return { kind: "anonymous" };
      return { kind: "user", userId: data.user.id, effectiveRole: profile.currentRole };
    },
  });

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
      const { error } = await auditRemoteOperation(req, "profile_update", () => supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { first_name: names.firstName, last_name: names.lastName },
      }));
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
      Object.assign(serviceData, serviceImageChanges(serviceData));
      for (const image of serviceData.imageUrls ?? []) await validateServiceImage(image, userId, current.companyId);
      await validateEmployeeAssignment(serviceData.employeeId, req);
      
      const options = req.body.options === undefined ? undefined : serviceOptionsInputSchema.parse(req.body.options);
      const service = await storage.createService(serviceData, options);
      
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
      const serviceId = z.coerce.number().int().positive().max(2147483647).parse(req.params.id);
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
      const serviceId = z.coerce.number().int().positive().max(2147483647).parse(req.params.id);
      const service = await storage.getServicePageDetails(serviceId);
      
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
      Object.assign(updates, serviceImageChanges(updates, service));
      for (const image of updates.imageUrls ?? []) await validateServiceImage(image, userId, current.companyId);
      await validateEmployeeAssignment(updates.employeeId, req);
      if (updates.employeeId !== undefined && updates.employeeId !== service!.employeeId) {
        const upcoming = (await storage.getBookingsByProvider(current.providerId, current.companyId)).some(booking => booking.serviceId === serviceId
          && (booking.status === "pending" || booking.status === "confirmed")
          && new Date(booking.scheduledDate).getTime() + ((booking.bookingDuration ?? service!.duration) + (booking.bookingCleanupTime ?? 0)) * 60_000 > Date.now());
        if (upcoming) return res.status(409).json({ message: "This service has upcoming bookings. Keep its assigned employee or resolve those bookings before changing the assignment." });
      }
      const options = req.body.options === undefined ? undefined : serviceOptionsInputSchema.parse(req.body.options);
      const updatedService = await storage.updateService(serviceId, updates, options);
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

  // Quotes are read-only calculations. A quote or browser return is never payment evidence.
  app.post('/api/bookings/quote', isAuthenticated, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    try {
      const input = bookingQuoteInputSchema.parse(req.body);
      const instant = new Date(input.scheduledDate);
      if (instant.getTime() <= Date.now()) throw new ServiceOptionError(400, "INVALID_TIME", "Choose a future appointment time.");
      const date = instant.toISOString().slice(0, 10);
      const data = await serviceSlotData(input.serviceId, date, date, input.optionId);
      const maximum = data.service.serviceType === "group" ? data.service.maxCapacity ?? 1 : 1;
      if (input.participantCount > maximum) throw new ServiceOptionError(400, "INVALID_PARTICIPANTS", "Choose a valid number of participants.");
      const slot = optionBookableSlots({ ...data, specialist: input.specialist, date, timezone: "UTC", participantCount: input.participantCount }).find(item => item.startsAt === instant.toISOString());
      if (!slot) throw new ServiceOptionError(409, "TIME_UNAVAILABLE", "This appointment time is no longer available.");
      const effective = optionEffectiveService(data.service, data.option, slot.employeeId);
      let amounts: ReturnType<typeof calculatePlatformQuote>;
      try { amounts = calculatePlatformQuote({ ...effective, participantCount: input.participantCount, paymentMethod: input.paymentMethod }); }
      catch { throw new MoneyInputError("The appointment amount exceeds the supported payment limit. Choose fewer participants."); }
      res.json(bookingQuoteResponseSchema.parse({ serviceId: data.service.id, optionId: data.option.id, optionName: data.option.name, pricingMode: data.option.pricingMode,
        price: effective.price, currency: data.service.currency, advancePaymentPercent: data.service.advancePaymentPercent ?? 0, duration: data.option.duration,
        employeeId: slot.employeeId, employeeName: slot.employeeName, scheduledDate: instant.toISOString(), endsAt: slot.endsAt, timezone: input.timezone,
        participantCount: input.participantCount, paymentMethod: input.paymentMethod, ...amounts,
        onlinePaymentsAllowed: await effectiveOnlinePayments(db, data.service), onlinePaymentsAvailable: false }));
    } catch (error) { apiFailure(error, res, "Unable to quote this appointment. Please try again."); }
  });

  // Booking routes
  app.post('/api/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const initialMessage = initialBookingMessageSchema.parse(req.body);
      const serviceId = z.number().int().positive().parse(req.body.serviceId);
      const service = await storage.getServiceById(serviceId);
      if (!service || !service.isActive || !service.companyActive) {
        return res.status(404).json({ message: "Service not found" });
      }

      const scheduledDate = z.string().datetime().transform(value => new Date(value)).refine(value => value.getTime() > Date.now(), "Choose a future appointment time.").parse(req.body.scheduledDate);
      const participantCount = z.number().int().min(1).max(service.serviceType === "group" ? service.maxCapacity ?? 1 : 1).parse(req.body.participantCount ?? 1);
      const expectedPrice = expectedPriceSchema.parse(req.body);
      const selection = bookingOptionSelectionSchema.parse(req.body);
      if (selection.paymentMethod === "fitsmytime") throw new ServiceOptionError(409, "PAYMENTS_UNAVAILABLE", "Online payment collection is not available. Choose pay onsite.");
      const option = selectedServiceOption(await storage.getServiceOptions(service), selection.optionId);
      const snapshot = bookingPriceSnapshot(optionEffectiveService(service, option, service.employeeId), participantCount, expectedPrice);
      const bookingData = insertBookingSchema.parse({
        serviceId,
        notes: null,
        seekerId: userId,
        providerId: service.providerId,
        companyId: service.companyId,
        employeeId: service.employeeId,
        bookingDuration: option.duration,
        bookingCleanupTime: service.cleanupTime,
        status: service.instantBooking ? "confirmed" : "pending",
        paymentStatus: "pending",
        scheduledDate,
        participantCount,
        ...snapshot,
      });
      
      const booking = await storage.createBooking(bookingData, initialMessage, expectedPrice, selection);
      res.json(bookingMoneyDto(booking));
    } catch (error) {
      console.error("Error creating booking:", error instanceof Error ? error.name : "Error");
      apiFailure(error, res, "Failed to create booking");
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
      const visible = current.ctx.permissions.readAll ? bookings : bookings.filter(booking => current.employeeId != null && booking.employeeId === current.employeeId);
      if (!notificationConfig().enabled) return res.json(visible);
      const reminders = await bookingReminderSummaries(db, visible);
      res.json(visible.map(booking => ({ ...booking, reminder: reminders.get(booking.id) })));
    } catch (error) {
      console.error("Error fetching provider bookings:", error);
      apiFailure(error, res, "Failed to fetch bookings");
    }
  });

  app.patch('/api/bookings/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const bookingId = z.coerce.number().int().positive().parse(req.params.id);
      const { status } = z.object({ status: z.enum(["pending", "confirmed", "cancelled", "completed"]) }).parse(req.body);
      
      const booking = await storage.getBookingById(bookingId);
      const seekerId = assertBookingChange(req, booking);
      if (seekerId && status !== "cancelled") throw new AccessError(403, "Customers can only cancel their reservations.");
      
      const timeZone = notificationTimezoneSchema.parse(req.body.timeZone);
      const updatedBooking = await storage.updateBookingStatus(bookingId, status, seekerId, timeZone);
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
      z.string().datetime().refine(value => Date.parse(value) > Date.now(), "Choose a future appointment time.").parse(req.body.scheduledDate);
      const booking = await storage.getBookingById(id);
      assertBookingChange(req, booking);
      res.status(409).json({ code: "consent_required", message: "Send a reschedule request. The other party must agree before the reservation changes." });
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
