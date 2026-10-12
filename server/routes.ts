import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, BookingConflictError } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertServiceSchema, insertBookingSchema, insertAvailabilitySchema, providerProfileSchema, employeeSchema } from "@shared/schema";
import { z } from "zod";
import { createImageUpload, validateOwnedImage, canReadImage, downloadImage, ImageStorageError } from "./imageStorage";
import { generateEmbedding, cosineSimilarity } from "./embeddings";
import { geocodeAddress, GeocodingError } from "./geocoding";

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

  // Object Storage routes
  app.post('/api/objects/upload', isAuthenticated, async (req: any, res) => {
    try {
      const upload = await createImageUpload(req.user.claims.sub, req.body.contentType, req.body.size);
      res.json(upload);
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(error instanceof ImageStorageError ? error.status : 500).json({ message: error instanceof ImageStorageError ? error.message : "Failed to get upload URL" });
    }
  });

  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    try {
      const canAccess = await canReadImage(req.path, userId);
      if (!canAccess) {
        return res.sendStatus(403);
      }
      const image = await downloadImage(req.path);
      res.set({ "Content-Type": image.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" });
      res.send(image.bytes);
    } catch (error) {
      console.error("Error checking object access:", error);
      return res.status(error instanceof ImageStorageError ? error.status : 500).json({ message: error instanceof ImageStorageError ? error.message : "Unable to load image" });
    }
  });

  app.put("/api/service-images", isAuthenticated, async (req: any, res) => {
    if (typeof req.body.objectPath !== "string") {
      return res.status(400).json({ message: "objectPath is required" });
    }

    const userId = req.user?.claims?.sub;

    try {
      const objectPath = req.body.objectPath;
      await validateOwnedImage(objectPath, userId);

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting service image:", error);
      res.status(error instanceof ImageStorageError ? error.status : 500).json({ message: error instanceof ImageStorageError ? error.message : "Failed to confirm image" });
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
      res.status(500).json({ message: "Failed to fetch user" });
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
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Service routes
  app.patch('/api/provider/profile', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.claims.sub;
      const profile = providerProfileSchema.parse(req.body);
      if (profile.providerType === "individual") {
        const listings = await storage.getServicesByProvider(userId);
        if (listings.some(service => service.employeeId != null)) {
          return res.status(409).json({ message: "Remove employee assignments from your services before switching to an individual profile." });
        }
      }
      res.json(await storage.updateProviderProfile(userId, {
        providerType: profile.providerType,
        companyName: profile.providerType === "company" ? profile.companyName! : null,
      }));
    } catch (error) {
      res.status(error instanceof z.ZodError ? 400 : 500).json({ message: error instanceof z.ZodError ? error.issues[0].message : "Unable to save provider profile" });
    }
  });

  app.get('/api/provider/employees', isAuthenticated, async (req, res) => {
    try { res.json(await storage.getEmployees(req.user!.claims.sub)); }
    catch { res.status(500).json({ message: "Unable to load employees" }); }
  });

  const saveEmployee: import("express").RequestHandler = async (req, res) => {
    try {
      const userId = req.user!.claims.sub;
      const user = await storage.getUser(userId);
      if (user?.providerType !== "company") return void res.status(400).json({ message: "Set up a company profile before adding employees." });
      const id = req.params.id ? z.coerce.number().int().positive().parse(req.params.id) : undefined;
      const employee = await storage.saveEmployee(userId, employeeSchema.parse(req.body), id);
      if (!employee) return void res.status(404).json({ message: "Employee not found" });
      res.status(id ? 200 : 201).json(employee);
    } catch (error) {
      res.status(error instanceof z.ZodError ? 400 : 500).json({ message: error instanceof z.ZodError ? error.issues[0].message : "Unable to save employee" });
    }
  };
  app.post('/api/provider/employees', isAuthenticated, saveEmployee);
  app.patch('/api/provider/employees/:id', isAuthenticated, saveEmployee);
  app.delete('/api/provider/employees/:id', isAuthenticated, async (req, res) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      if (!await storage.deleteEmployee(req.user!.claims.sub, id)) return void res.status(404).json({ message: "Employee not found" });
      res.json({ message: "Employee removed" });
    } catch (error) {
      const referenced = (error as { code?: string }).code === "23503";
      res.status(referenced ? 409 : error instanceof z.ZodError ? 400 : 500).json({ message: referenced
        ? "This employee is linked to services or bookings. Remove service assignments first; employees with booking history must be kept."
        : "Unable to remove employee" });
    }
  });

  async function validateEmployeeAssignment(employeeId: number | null | undefined, userId: string) {
    if (employeeId == null) return;
    const user = await storage.getUser(userId);
    const employees = await storage.getEmployees(userId);
    if (user?.providerType !== "company" || !employees.some(employee => employee.id === employeeId)) {
      throw new z.ZodError([{ code: "custom", path: ["employeeId"], message: "Choose an employee from your company." }]);
    }
  }

  app.post('/api/services', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const serviceData = insertServiceSchema.parse({
        ...req.body,
        providerId: userId,
      });
      if (serviceData.imageUrl) await validateOwnedImage(serviceData.imageUrl, userId);
      await validateEmployeeAssignment(serviceData.employeeId, userId);
      
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
      res.status(error instanceof ImageStorageError ? error.status : error instanceof z.ZodError ? 400 : 500).json({ message: error instanceof ImageStorageError ? error.message : error instanceof z.ZodError ? error.issues[0].message : "Failed to create service" });
    }
  });

  app.get('/api/services/provider', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const services = await storage.getServicesByProvider(userId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching provider services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
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
      res.status(500).json({ message: "Failed to search services" });
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
      let services = servicesResults.filter((s): s is NonNullable<typeof s> => s !== undefined && s.isActive === true);
      
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
      res.status(500).json({ message: "Failed to generate embedding" });
    }
  });

  // Bulk generate embeddings for all services (admin endpoint)
  // Only providers can generate embeddings for their own services
  app.post('/api/admin/generate-embeddings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Only allow providers to generate embeddings for their own services
      if (!user || user.currentRole !== 'provider') {
        return res.status(403).json({ message: "Only providers can generate embeddings" });
      }
      
      // Get only this provider's services
      const providerServices = await storage.getServicesByProvider(userId);
      
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
      res.status(500).json({ message: "Failed to generate embeddings" });
    }
  });

  app.get('/api/services/:id', async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const service = await storage.getServiceById(serviceId);
      
      if (!service || !service.isActive) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Error fetching service:", error);
      res.status(500).json({ message: "Failed to fetch service" });
    }
  });

  app.post('/api/services/:id/copy', isAuthenticated, async (req, res) => {
    const serviceId = Number(req.params.id);
    if (!Number.isSafeInteger(serviceId) || serviceId < 1) {
      return res.status(400).json({ message: "Invalid service ID" });
    }
    try {
      const copy = await storage.copyService(serviceId, req.user!.claims.sub);
      if (!copy) return res.status(404).json({ message: "Service not found" });
      res.status(201).json(copy);
    } catch (error) {
      console.error("Failed to copy service:", error instanceof Error ? error.name : "Error");
      res.status(500).json({ message: "Failed to copy service" });
    }
  });

  app.patch('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const serviceId = parseInt(req.params.id);
      
      // Verify service belongs to user
      const service = await storage.getServiceById(serviceId);
      if (!service || service.providerId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updates = insertServiceSchema.omit({ providerId: true }).partial().parse(req.body);
      if (updates.imageUrl) await validateOwnedImage(updates.imageUrl, userId);
      await validateEmployeeAssignment(updates.employeeId, userId);
      if (updates.employeeId !== undefined && updates.employeeId !== service.employeeId) {
        const upcoming = (await storage.getBookingsByProvider(userId)).some(booking => booking.serviceId === serviceId
          && (booking.status === "pending" || booking.status === "confirmed")
          && new Date(booking.scheduledDate).getTime() + (booking.bookingDuration ?? service.duration) * 60_000 > Date.now());
        if (upcoming) return res.status(409).json({ message: "This service has upcoming bookings. Keep its assigned employee or resolve those bookings before changing the assignment." });
      }
      const updatedService = await storage.updateService(serviceId, updates);
      res.json(updatedService);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(error instanceof ImageStorageError ? error.status : error instanceof z.ZodError ? 400 : 500).json({ message: error instanceof ImageStorageError ? error.message : error instanceof z.ZodError ? error.issues[0].message : "Failed to update service" });
    }
  });

  app.delete('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const serviceId = parseInt(req.params.id);
      
      // Verify service belongs to user
      const service = await storage.getServiceById(serviceId);
      if (!service || service.providerId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      await storage.deleteService(serviceId);
      res.json({ message: "Service deleted successfully" });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // Booking routes
  app.post('/api/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const serviceId = z.number().int().positive().parse(req.body.serviceId);
      const service = await storage.getServiceById(serviceId);
      if (!service || !service.isActive) {
        return res.status(404).json({ message: "Service not found" });
      }

      const bookingData = insertBookingSchema.parse({
        ...req.body,
        seekerId: userId,
        providerId: service.providerId,
        employeeId: service.employeeId,
        bookingDuration: service.duration,
        status: service.instantBooking ? "confirmed" : "pending",
        paymentStatus: "pending",
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
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get('/api/bookings/provider', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookings = await storage.getBookingsByProvider(userId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching provider bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.patch('/api/bookings/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookingId = parseInt(req.params.id);
      const { status } = req.body;
      
      // Verify booking belongs to user (as provider)
      const booking = await storage.getBookingById(bookingId);
      if (!booking || booking.providerId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updatedBooking = await storage.updateBookingStatus(bookingId, status);
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking status:", error);
      res.status(500).json({ message: "Failed to update booking status" });
    }
  });

  // Availability routes
  app.post('/api/availability', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Normalize serviceId: treat empty string, "null", undefined as null
      const rawServiceId = req.body.serviceId;
      const serviceId = (rawServiceId && rawServiceId !== "null" && rawServiceId !== "") 
        ? parseInt(rawServiceId, 10) 
        : null;
      
      // Verify service ownership only if serviceId is provided
      // When serviceId is null, this is a general working hours schedule
      if (serviceId !== null) {
        const service = await storage.getServiceById(serviceId);
        if (!service || service.providerId !== userId) {
          return res.status(403).json({ message: "Unauthorized - service not found or not owned by you" });
        }
      }
      
      // Parse and convert data
      const availabilityData = {
        ...req.body,
        serviceId: serviceId, // Use normalized value
        providerId: userId,
        specificDate: req.body.specificDate ? new Date(req.body.specificDate) : null,
        daysOfWeek: req.body.daysOfWeek || null,
      };
      
      const validated = insertAvailabilitySchema.parse(availabilityData);
      const availability = await storage.createAvailability(validated);
      res.json(availability);
    } catch (error) {
      console.error("Error creating availability:", error);
      res.status(500).json({ message: "Failed to create availability" });
    }
  });

  app.get('/api/availability/service/:serviceId', async (req, res) => {
    try {
      const serviceId = parseInt(req.params.serviceId);
      const availability = await storage.getAvailabilityByService(serviceId);
      res.json(availability);
    } catch (error) {
      console.error("Error fetching availability:", error);
      res.status(500).json({ message: "Failed to fetch availability" });
    }
  });

  app.get('/api/availability/slots/:serviceId', async (req, res) => {
    try {
      const serviceId = parseInt(req.params.serviceId);
      const dateStr = req.query.date as string;

      if (!dateStr) {
        return res.status(400).json({ message: "Date parameter is required" });
      }

      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();

      const service = await storage.getServiceById(serviceId);
      if (!service || !service.isActive) {
        return res.status(404).json({ message: "Service not found" });
      }

      // Get service-specific schedules AND provider's general working hours
      const serviceSchedules = await storage.getAvailabilityByService(serviceId);
      const providerSchedules = await storage.getAvailabilityByProvider(service.providerId);
      
      // Filter provider schedules to only include general working hours (serviceId is null)
      const generalWorkingHours = providerSchedules.filter(s => s.serviceId === null);
      
      // Combine both types of schedules
      const availabilitySchedules = [...serviceSchedules, ...generalWorkingHours];
      
      // Get all bookings for this provider on this date (not just this service)
      const existingBookings = await storage.getBookingsForResourceOnDate(service, date);

      // Use service duration for slot calculation
      const slotDuration = service.duration || 60;

      // Helper to check if time overlaps with breaks
      const isInBreak = (slotStartMins: number, slotEndMins: number, breaks: {startTime: string, endTime: string}[] | null) => {
        if (!breaks || breaks.length === 0) return false;
        return breaks.some(brk => {
          const [bStartH, bStartM] = brk.startTime.split(":").map(Number);
          const [bEndH, bEndM] = brk.endTime.split(":").map(Number);
          const breakStart = bStartH * 60 + bStartM;
          const breakEnd = bEndH * 60 + bEndM;
          // Slot overlaps with break if: slotStart < breakEnd AND slotEnd > breakStart
          return slotStartMins < breakEnd && slotEndMins > breakStart;
        });
      };

      const slots: Array<{
        startTime: string;
        endTime: string;
        available: boolean;
        slotDuration: number;
      }> = [];

      for (const schedule of availabilitySchedules) {
        let isApplicable = false;

        if (schedule.scheduleType === "specific") {
          if (schedule.specificDate) {
            const scheduleDate = new Date(schedule.specificDate);
            isApplicable =
              scheduleDate.getFullYear() === date.getFullYear() &&
              scheduleDate.getMonth() === date.getMonth() &&
              scheduleDate.getDate() === date.getDate();
          }
        } else if (schedule.scheduleType === "recurring") {
          if (schedule.daysOfWeek && schedule.daysOfWeek.includes(dayOfWeek)) {
            isApplicable = true;
          }
        }

        if (!isApplicable) continue;

        const [startHour, startMin] = schedule.startTime.split(":").map(Number);
        const [endHour, endMin] = schedule.endTime.split(":").map(Number);

        const scheduleStartMinutes = startHour * 60 + startMin;
        const scheduleEndMinutes = endHour * 60 + endMin;

        // Generate slots in 15-minute increments, but check if service duration fits
        for (let currentMinutes = scheduleStartMinutes; currentMinutes + slotDuration <= scheduleEndMinutes; currentMinutes += 15) {
          const slotStartHour = Math.floor(currentMinutes / 60);
          const slotStartMin = currentMinutes % 60;
          const slotEndMinutes = currentMinutes + slotDuration;
          const slotEndHour = Math.floor(slotEndMinutes / 60);
          const slotEndMin = slotEndMinutes % 60;

          // Skip if slot overlaps with any break time
          if (isInBreak(currentMinutes, slotEndMinutes, schedule.breaks as any)) {
            continue;
          }

          const slotStart = `${slotStartHour.toString().padStart(2, "0")}:${slotStartMin.toString().padStart(2, "0")}`;
          const slotEnd = `${slotEndHour.toString().padStart(2, "0")}:${slotEndMin.toString().padStart(2, "0")}`;

          // Check if this slot already exists (from another schedule)
          if (slots.some(s => s.startTime === slotStart)) {
            continue;
          }

          const slotStartDateTime = new Date(date);
          slotStartDateTime.setHours(slotStartHour, slotStartMin, 0, 0);
          const slotEndDateTime = new Date(date);
          slotEndDateTime.setHours(slotEndHour, slotEndMin, 0, 0);

          // Check for overlap with any existing booking
          const hasOverlap = existingBookings.some((booking) => {
            const bookingStart = new Date(booking.scheduledDate);
            const bookingDurationMins = booking.bookingDuration || 60;
            const bookingEnd = new Date(bookingStart.getTime() + bookingDurationMins * 60000);

            return slotStartDateTime < bookingEnd && slotEndDateTime > bookingStart;
          });

          slots.push({
            startTime: slotStart,
            endTime: slotEnd,
            available: !hasOverlap,
            slotDuration,
          });
        }
      }

      slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

      res.json({
        date: dateStr,
        serviceId,
        serviceDuration: service.duration,
        slots: slots.filter(s => s.available), // Only return available slots
        totalSlots: slots.length,
        availableSlots: slots.filter((s) => s.available).length,
      });
    } catch (error) {
      console.error("Error fetching available slots:", error);
      res.status(500).json({ message: "Failed to fetch available slots" });
    }
  });

  app.get('/api/availability/provider', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const availability = await storage.getAvailabilityByProvider(userId);
      res.json(availability);
    } catch (error) {
      console.error("Error fetching provider availability:", error);
      res.status(500).json({ message: "Failed to fetch availability" });
    }
  });

  app.patch('/api/availability/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const availabilityId = parseInt(req.params.id);
      
      // Verify ownership
      const existing = await storage.getAvailabilityByProvider(userId);
      const availability = existing.find(a => a.id === availabilityId);
      if (!availability) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Convert date if provided
      const updates = {
        ...req.body,
        specificDate: req.body.specificDate ? new Date(req.body.specificDate) : undefined,
      };
      
      const updated = await storage.updateAvailability(availabilityId, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating availability:", error);
      res.status(500).json({ message: "Failed to update availability" });
    }
  });

  app.delete('/api/availability/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const availabilityId = parseInt(req.params.id);
      
      // Delete with ownership verification in storage layer
      await storage.deleteAvailability(availabilityId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting availability:", error);
      res.status(500).json({ message: "Failed to delete availability" });
    }
  });

  // Mock payment route (for demo purposes)
  app.post('/api/payments/process', isAuthenticated, async (req: any, res) => {
    try {
      const { bookingId, amount, paymentMethod } = req.body;
      
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
      res.status(500).json({ message: "Failed to process payment" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
