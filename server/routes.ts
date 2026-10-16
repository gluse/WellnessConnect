import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, BookingConflictError } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertServiceSchema, insertBookingSchema, insertAvailabilitySchema, providerProfileSchema, employeeSchema, accountDetailsSchema } from "@shared/schema";
import { supabaseAdmin } from "./supabase";
import { z } from "zod";
import { createImageUpload, validateOwnedImage, validateServiceImage, canReadImage, downloadImage, ImageStorageError } from "./imageStorage";
import { generateEmbedding, cosineSimilarity } from "./embeddings";
import { geocodeAddress, GeocodingError } from "./geocoding";
import { setupCompanyRoutes } from "./companyRoutes";
import { setupSchedulingRoutes } from "./schedulingRoutes";
import { setupAdminRoutes } from "./adminRoutes";
import { setupReviewRoutes } from "./reviewRoutes";
import { scope, assertService, assertBooking, ensureCompany, workspaceContext, saveWorkspaceSession, AccessError } from "./companyAccess";
import { db } from "./db";
import { companies } from "@shared/schema";
import { eq } from "drizzle-orm";

function apiFailure(error: unknown, res: import("express").Response, fallback: string) {
  const known = error instanceof AccessError || error instanceof ImageStorageError;
  res.status(known ? error.status : error instanceof z.ZodError ? 400 : error instanceof BookingConflictError ? 409 : 500)
    .json({ message: known || error instanceof BookingConflictError ? error.message : error instanceof z.ZodError ? error.issues[0].message : fallback });
}

// Helper to add English keywords to embedding text for cross-language search
function enrichEmbeddingText(name: string, description: string | null, category: string): string {
  let text = `${name} ${description || ''} ${category}`.trim();
  
  // Add category translations
  const categoryTranslations: Record<string, string> = {
    'health_wellness': 'health wellness spa massage sauna bath relaxation therapy healing',
    'education': 'education learning teaching tutoring lessons classes school study math science language',
    'entertainment': 'entertainment fun activities recreation leisure games events party',
  };
  
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
  
  // Add category translation
  if (categoryTranslations[category]) {
    text += ` ${categoryTranslations[category]}`;
  }
  
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
  setupAdminRoutes(app);
  setupCompanyRoutes(app);
  setupSchedulingRoutes(app);
  setupReviewRoutes(app);

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

  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    try {
      const workspace = await workspaceContext(userId, req.session.activeCompanyId);
      const canAccess = await canReadImage(req.path, userId, workspace);
      if (!canAccess) {
        return res.sendStatus(403);
      }
      const image = await downloadImage(req.path);
      res.set({ "Content-Type": image.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" });
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

  const geocodingFailure = (error: unknown, res: import("express").Response) => {
    if (error instanceof GeocodingError) {
      console.error("Geocoding failed:", error.code);
      return res.status(error.status).json({ message: error.message, code: error.code });
    }
    return res.status(503).json({ message: "Address lookup is temporarily unavailable.", code: "UNAVAILABLE" });
  };

  app.get('/api/geocode', async (req, res) => {
    try {
      res.json(await geocodeAddress(req.query.address));
    } catch (error) { geocodingFailure(error, res); }
  });

  app.post('/api/geocode', isAuthenticated, async (req, res) => {
    try {
      const result = await geocodeAddress(req.body.address);
      res.json({ latitude: result.lat, longitude: result.lng, formattedAddress: result.formattedAddress });
    } catch (error) { geocodingFailure(error, res); }
  });

  // User routes
  app.patch('/api/users/role', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { role } = req.body;
      
      if (!['seeker', 'provider'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await storage.updateUserRole(userId, role);
      res.json(user);
    } catch (error) {
      console.error("Error updating user role:", error);
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

  app.post('/api/services', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const current = scope(req, "manageServices");
      const serviceData = insertServiceSchema.parse({
        ...req.body,
        providerId: current.providerId,
        companyId: current.companyId ?? null,
      });
      if (serviceData.imageUrl) await validateServiceImage(serviceData.imageUrl, userId, current.companyId);
      await validateEmployeeAssignment(serviceData.employeeId, req);
      
      const service = await storage.createService(serviceData);
      
      // Generate embedding for the new service asynchronously
      try {
        const textContent = enrichEmbeddingText(service.name, service.description, service.category);
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
      console.error("Error creating service:", error);
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

  app.get('/api/services/search', async (req, res) => {
    try {
      const { 
        category, ageGroups, serviceType, latitude, longitude, radius, 
        date, dateEnd, time, timeEnd, searchQuery, availableOnly 
      } = req.query;
      
      const filters: any = {};
      if (category) filters.category = category;
      if (serviceType) filters.serviceType = serviceType;
      if (ageGroups) filters.ageGroups = Array.isArray(ageGroups) ? ageGroups : [ageGroups];
      if (latitude) filters.latitude = parseFloat(latitude as string);
      if (longitude) filters.longitude = parseFloat(longitude as string);
      if (radius) filters.radius = parseFloat(radius as string);
      if (date) filters.date = date as string;
      if (dateEnd) filters.dateEnd = dateEnd as string;
      if (time) filters.time = time as string;
      if (timeEnd) filters.timeEnd = timeEnd as string;
      if (searchQuery) filters.searchQuery = searchQuery as string;
      if (availableOnly === "true") filters.availableOnly = true;

      const services = await storage.searchServices(filters);
      res.json(services);
    } catch (error) {
      console.error("Error searching services:", error);
      apiFailure(error, res, "Failed to search services");
    }
  });

  // Semantic search endpoint (cross-language AI-powered search)
  app.get('/api/services/semantic-search', async (req, res) => {
    try {
      const { query, category, latitude, longitude, radius } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Search query is required" });
      }

      // First, try exact text search - prioritize exact name/description matches
      const textMatchServices = await storage.searchServices({ 
        searchQuery: query,
        category: category as string,
      });
      
      // If we found exact text matches, return those (prioritizes exact name matches)
      if (textMatchServices.length > 0) {
        // Apply location filter if specified
        let filteredServices = textMatchServices;
        if (latitude && longitude && radius) {
          const lat = parseFloat(latitude as string);
          const lng = parseFloat(longitude as string);
          const rad = parseFloat(radius as string);
          
          filteredServices = textMatchServices.filter(s => {
            if (s.latitude === null || s.longitude === null) return false;
            const R = 6371;
            const dLat = (s.latitude - lat) * Math.PI / 180;
            const dLon = (s.longitude - lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat * Math.PI/180) * Math.cos(s.latitude * Math.PI/180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;
            return distance <= rad;
          });
        }
        return res.json(filteredServices);
      }

      // No exact text matches - try semantic search for cross-language matching
      const allEmbeddings = await storage.getAllServiceEmbeddings();
      
      if (allEmbeddings.length === 0) {
        // No embeddings exist, return empty (text search already found nothing)
        return res.json([]);
      }

      // Generate embedding for the search query
      const queryEmbedding = await generateEmbedding(query);
      
      // Calculate similarity scores for all services
      const scoredServices: { serviceId: number; score: number }[] = [];
      for (const embedding of allEmbeddings) {
        const score = cosineSimilarity(queryEmbedding, embedding.embedding);
        scoredServices.push({ serviceId: embedding.serviceId, score });
      }
      
      // Debug: log top 5 scores for visibility
      const topScores = [...scoredServices].sort((a, b) => b.score - a.score).slice(0, 5);
      console.log(`Semantic search for "${query}" - top scores:`, topScores.map(s => `${s.serviceId}:${s.score.toFixed(3)}`).join(', '));
      
      // Sort by similarity score (highest first) and filter by threshold
      // Use lower threshold (0.30) to catch more semantic matches
      const SIMILARITY_THRESHOLD = 0.30;
      const relevantServiceIds = scoredServices
        .filter(s => s.score >= SIMILARITY_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .map(s => s.serviceId);
      
      if (relevantServiceIds.length === 0) {
        // No semantic matches either
        return res.json([]);
      }
      
      // Fetch the matched services
      const servicesPromises = relevantServiceIds.map(id => storage.getServiceById(id));
      const servicesResults = await Promise.all(servicesPromises);
      let services = servicesResults.filter((s): s is NonNullable<typeof s> => s !== undefined && s.isActive === true && s.companyActive === true);
      
      // Apply category filter if specified
      if (category) {
        services = services.filter(s => s.category === category);
      }
      
      // Apply location filter if specified
      if (latitude && longitude && radius) {
        const lat = parseFloat(latitude as string);
        const lng = parseFloat(longitude as string);
        const rad = parseFloat(radius as string);
        
        services = services.filter(s => {
          if (s.latitude === null || s.longitude === null) return false;
          const R = 6371;
          const dLat = (s.latitude - lat) * Math.PI / 180;
          const dLon = (s.longitude - lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat * Math.PI/180) * Math.cos(s.latitude * Math.PI/180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;
          return distance <= rad;
        });
      }
      
      res.json(services);
    } catch (error) {
      console.error("Error in semantic search:", error);
      // Fallback to regular search on error
      const services = await storage.searchServices({ 
        searchQuery: req.query.query as string,
        category: req.query.category as string,
      });
      res.json(services);
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
      const textContent = enrichEmbeddingText(service.name, service.description, service.category);
      
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
          const textContent = enrichEmbeddingText(service.name, service.description, service.category);
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
      if (updates.imageUrl) await validateServiceImage(updates.imageUrl, userId, current.companyId);
      await validateEmployeeAssignment(updates.employeeId, req);
      if (updates.employeeId !== undefined && updates.employeeId !== service!.employeeId) {
        const upcoming = (await storage.getBookingsByProvider(current.providerId, current.companyId)).some(booking => booking.serviceId === serviceId
          && (booking.status === "pending" || booking.status === "confirmed")
          && new Date(booking.scheduledDate).getTime() + (booking.bookingDuration ?? service!.duration) * 60_000 > Date.now());
        if (upcoming) return res.status(409).json({ message: "This service has upcoming bookings. Keep its assigned employee or resolve those bookings before changing the assignment." });
      }
      const updatedService = await storage.updateService(serviceId, updates);
      res.json(updatedService);
    } catch (error) {
      console.error("Error updating service:", error);
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

  // Mock payment route (for demo purposes)
  app.post('/api/payments/process', isAuthenticated, async (req: any, res) => {
    try {
      const { bookingId, amount, paymentMethod } = req.body;
      const booking = await storage.getBookingById(bookingId);
      if (!booking || booking.seekerId !== req.user.claims.sub) throw new AccessError(403, "This payment is not for your reservation.");
      
      // Mock payment processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update booking payment status
      await storage.updateBookingPayment(bookingId, 'advance_paid');
      
      res.json({ 
        success: true, 
        transactionId: `txn_${Date.now()}`,
        message: "Payment processed successfully"
      });
    } catch (error) {
      console.error("Error processing payment:", error);
      apiFailure(error, res, "Failed to process payment");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
