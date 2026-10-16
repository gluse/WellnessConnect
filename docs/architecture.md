# FitsMyTime Architecture

## Overview

FitsMyTime is a full-stack web application that connects service seekers with local service providers in health, wellness, education, and entertainment sectors. The platform features a mobile-first design with dual-role functionality, allowing users to both seek and provide services.

See the [README](../README.md) for local setup, commands, and deployment, and the
[authentication and storage guide](supabase-auth-storage.md) for Supabase configuration.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite with hot module replacement
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Mobile-First**: Responsive design optimized for mobile devices

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: Supabase PostgreSQL using a standard pg connection pool
- **ORM**: Drizzle ORM with type-safe queries
- **Authentication**: Supabase email/password and optional Google, Facebook, Apple, and Microsoft login
- **Session Management**: Express sessions with PostgreSQL storage

### Database Design
- **Users**: Profile management with dual roles (seeker/provider)
- **Companies**: Separate workspaces with transferable ownership
- **Company Memberships**: Owner, administrator, provider, and read-only access
- **Company Invitations**: Email-bound invitations with expiry and revocation
- **Employees**: Optional public names and links to team-member logins
- **Services**: Categorized offerings with pricing and availability
- **Categories**: Shared database catalog with stable keys referenced by services
- **Bookings**: Transaction records with payment tracking
- **Availability**: Time-slot management for service providers
- **Sessions**: Secure session storage for authentication

## Key Components

### Authentication System
- **Provider**: Supabase Auth with verified email identities
- **Session Storage**: PostgreSQL-backed sessions with configurable TTL
- **Authorization**: Backend checks company membership and employee scope for every company action
- **Security**: HTTP-only cookies, secure transport, CSRF protection

### Service Management
- **Categories**: Managed by application administrators at `/administration`, seeded
  with Health & Wellness, Education, and Entertainment; see [category setup](categories.md)
- **Service Types**: One-to-one and group services
- **Pricing**: Flexible pricing with advance payment options
- **Availability**: Real-time capacity tracking and scheduling
- **Media**: Private Supabase Storage with signed uploads and Express image access checks
- **External Links**: Optional external URLs for additional information

### Booking System
- **Instant Booking**: Automated confirmation for participating providers
- **Payment Integration**: Stripe-ready infrastructure (components present)
- **Status Tracking**: Comprehensive booking lifecycle management
- **Notifications**: Toast-based user feedback system
- **Time Slot Booking**: Customers select from available time slots based on provider schedules
- **Slot Duration**: Configurable slot durations (30, 60, 90, 120 minutes) per schedule
- **Overlap Prevention**: Server-side validation prevents double-booking of time slots
- **Preparation and Cleanup**: Each service can reserve extra minutes after an
  appointment. Bookings snapshot this value; slot generation, transactional
  booking/rescheduling checks, and resource range queries include it. Working
  hours and breaks constrain the entire interval; customer-facing duration
  excludes the extra time. See [setup and behavior](../README.md#preparation-and-cleanup-time).

### User Interface
- **Design System**: Consistent component library with theme support
- **Mobile Navigation**: Bottom tab navigation for mobile users
- **Role Switching**: Seamless transition between seeker and provider modes
- **Responsive Design**: Adaptive layouts for all screen sizes
- **Calendar View**: Monthly calendar with timezone support for managing bookings and availability
- **View Modes**: List, Map, and Calendar views for flexible service discovery

### Location & Mapping
- **Geolocation**: Browser-based location detection using Geolocation API
- **Address Search**: Client-side geocoding to convert typed addresses to coordinates
- **Distance Calculation**: Haversine formula for accurate distance measurements
- **Map View**: Interactive Google Maps displaying service locations
- **Location Input**: Editable text field for typing addresses or using current location
- **Security**: HTML escaping for all user-generated content in map popups
- **API Key Management**: Secure backend endpoint for Google Maps API key delivery
- **API Requirements**: Google Maps API key must have Geocoding API enabled and proper restrictions configured

### Multi-Language Support
- **UI Internationalization**: react-i18next with 11 languages (English default, Latvian, Spanish, Chinese, Hindi, Arabic, Portuguese, Russian, Japanese, German, French)
- **Language Detection**: Automatic browser language detection with localStorage persistence
- **Language Picker**: Header dropdown for manual language selection
- **Translation Files**: Located in `client/public/locales/<language>/translation.json`, configured by `client/src/lib/i18n.ts`
- **AI-Powered Search**: OpenAI text-embedding-3-small for cross-language semantic search
- **Embeddings Table**: `service_embeddings` table stores 1536-dimension vectors for each service
- **Search Flow**: User query → embedding generation → cosine similarity → ranked results
- **Fallback Behavior**: Falls back to text-based search if embeddings unavailable or no semantic matches
- **Embedding Generation**: Embeddings auto-generated on service creation; POST `/api/admin/generate-embeddings` for providers to bulk-regenerate their own service embeddings

## Data Flow

### Service Discovery
1. User applies filters (category, location, date, service type)
2. Backend queries services with spatial and temporal constraints
3. Results returned with provider information and availability
4. Frontend displays cards with booking options

### Booking Process
1. User selects service and chooses a date
2. System fetches available time slots (based on provider's schedule minus existing bookings)
3. User selects an available time slot
4. System calculates pricing and advance payment
5. Booking created with selected time slot and duration
6. Server validates no overlapping bookings exist before confirming
7. Provider receives notification for manual approval (or instant confirmation if enabled)
8. Payment processing initiated upon confirmation

### Provider Dashboard
1. Providers manage service listings and availability
2. Real-time booking notifications and management
3. Revenue tracking and analytics
4. Customer communication interface

## External Dependencies

### Database & Infrastructure
- **Supabase PostgreSQL**: Database and Express sessions through a standard `pg` connection pool
- **Node.js Hosting**: Express serves the API and built frontend on the configured port
- **Supabase Auth**: Verified email identities and configured social sign-in providers
- **Supabase Storage**: Private service image bucket with access controlled by Express

### UI & Styling
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling framework
- **Lucide React**: Icon library for consistent iconography
- **Google Maps**: Interactive mapping with markers and info windows

### Payment & Communication
- **Stripe**: Payment processing infrastructure (configured)
- **React Query**: Server state synchronization
- **Date-fns**: Date manipulation and formatting
- **ImageUploader**: Signed uploads to Supabase Storage

## Deployment Strategy

### Development
- **Hot Reloading**: Vite development server with runtime error overlay
- **Type Safety**: Full TypeScript coverage with strict configuration
- **Database Migrations**: Drizzle Kit for schema management

### Production
- **Build Process**: Vite for frontend, esbuild for backend bundling
- **Static Assets**: Optimized asset delivery
- **Environment Variables**: Secure configuration management
- **Database Connection**: Connection pooling for scalability

### Monitoring & Debugging
- **Request Logging**: Detailed API request/response logging
- **Error Handling**: Comprehensive error boundaries and reporting
- **Performance**: Optimized queries and caching strategies

## Changelog

```
Changelog:
- February 09, 2026. Added Outlook-style calendar schedule editing: clicking purple schedule entries in the calendar opens an edit modal; recurring schedules show "This occurrence only" vs "All occurrences" choice (like Outlook); edit form supports modifying start/end times, break times, slot duration, and service assignment; "This occurrence" creates a one-time override for that specific date; "Delete this occurrence" creates an inactive specific-date entry to block just that date; calendar now filters out inactive schedule entries; new ScheduleEditModal component at client/src/components/schedule-edit-modal.tsx
- February 02, 2026. Redesigned search filters (booking.com style): all filters are now optional; added collapsible filter sections; category is now a dropdown; added search mode toggle (Exact/AI Search); added date range picker with start/end dates; added time range inputs; added "Show only available providers" checkbox; active filters display as removable chips with "Clear all" option; backend updated to filter by date/time ranges and check provider availability with break time exclusions
- January 27, 2026. Added general working hours with break times: providers can now set working hours that apply to all their services (serviceId=null); added break time support (e.g., lunch 12:00-13:00) stored as JSONB array; slot generation now uses service.duration for calculating available times; slots automatically exclude break times and check all provider bookings (not just per-service); provider dashboard shows "All Services" badge for general schedules and displays break times
- January 26, 2026. Added recurring schedule with time slot booking: providers can set slot duration (30, 60, 90, 120 min) when creating schedules; customers see only available time slots when booking; system automatically calculates available slots by subtracting existing bookings from schedule; server-side validation prevents double-booking; booking modal now fetches real-time availability
- December 30, 2025. Added service search by name/description: new search input field at top of filters; removed default "San Francisco, CA" location (now starts empty); search is case-insensitive and filters services in real-time
- November 15, 2025. Added address search functionality: users can now type any address (city, street, etc.) to search for nearby services; location input is now editable with search button; implemented client-side geocoding using Google Maps JavaScript API; added loading states and error handling; supports Enter key for quick search; NOTE: Requires Google Maps API key with Geocoding API enabled and proper restrictions
- October 09, 2025 (Update 4). Added calendar feature with timezone support: created CalendarView component showing monthly calendar of bookings and availability schedules; integrated calendar into provider dashboard for managing services; added Calendar tab to seeker home page for viewing bookings; calendar displays color-coded events (confirmed, pending, cancelled, completed); added initial image upload functionality (since replaced by Supabase Storage and ImageUploader); added external URL field to service creation form for linking to provider websites
- October 09, 2025 (Update 3). Enhanced service creation with manual coordinate entry: added latitude/longitude input fields for international addresses that can't be auto-verified by Google Maps; both auto-verification and manual entry now supported; unified UX flow so clicking services from both list and map views shows detail modal first, with option to proceed to booking
- October 09, 2025 (Update 2). Enhanced service discovery UX: changed distance filter from dropdown to manual input (1-500km); added comprehensive service detail modal for seekers showing full service information; fixed booking creation bug by updating schema to accept ISO string dates; made service names clickable to view details
- October 09, 2025. Switched from Leaflet to Google Maps for interactive map view; fixed location search UX with read-only input and clear instructions; added HTML escaping for XSS protection in map popups; added secure backend endpoint for Google Maps API key delivery
- July 03, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```
