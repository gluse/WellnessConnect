# WellnessFind - Service Booking Platform

## Overview

WellnessFind is a full-stack web application that connects service seekers with local service providers in health, wellness, education, and entertainment sectors. The platform features a mobile-first design with dual-role functionality, allowing users to both seek and provide services.

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
- **Database**: PostgreSQL with Neon serverless
- **ORM**: Drizzle ORM with type-safe queries
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage

### Database Design
- **Users**: Profile management with dual roles (seeker/provider)
- **Services**: Categorized offerings with pricing and availability
- **Bookings**: Transaction records with payment tracking
- **Availability**: Time-slot management for service providers
- **Sessions**: Secure session storage for authentication

## Key Components

### Authentication System
- **Provider**: Replit Auth with OIDC integration
- **Session Storage**: PostgreSQL-backed sessions with configurable TTL
- **Authorization**: Role-based access control with middleware protection
- **Security**: HTTP-only cookies, secure transport, CSRF protection

### Service Management
- **Categories**: Health & Wellness, Education, Entertainment
- **Service Types**: One-to-one and group services
- **Pricing**: Flexible pricing with advance payment options
- **Availability**: Real-time capacity tracking and scheduling
- **Media**: Image upload support via Replit Object Storage
- **External Links**: Optional external URLs for additional information

### Booking System
- **Instant Booking**: Automated confirmation for participating providers
- **Payment Integration**: Stripe-ready infrastructure (components present)
- **Status Tracking**: Comprehensive booking lifecycle management
- **Notifications**: Toast-based user feedback system

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

## Data Flow

### Service Discovery
1. User applies filters (category, location, date, service type)
2. Backend queries services with spatial and temporal constraints
3. Results returned with provider information and availability
4. Frontend displays cards with booking options

### Booking Process
1. User selects service and specifies requirements
2. System calculates pricing and advance payment
3. Booking created with pending status
4. Provider receives notification for manual approval
5. Payment processing initiated upon confirmation

### Provider Dashboard
1. Providers manage service listings and availability
2. Real-time booking notifications and management
3. Revenue tracking and analytics
4. Customer communication interface

## External Dependencies

### Database & Infrastructure
- **Neon Database**: Serverless PostgreSQL with connection pooling
- **Replit Platform**: Development environment and deployment
- **WebSocket Support**: Real-time features via ws library
- **Object Storage**: Replit Object Storage (Google Cloud Storage) for image uploads

### UI & Styling
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling framework
- **Lucide React**: Icon library for consistent iconography
- **Google Maps**: Interactive mapping with markers and info windows

### Payment & Communication
- **Stripe**: Payment processing infrastructure (configured)
- **React Query**: Server state synchronization
- **Date-fns**: Date manipulation and formatting
- **Uppy**: File upload with AWS S3-compatible API for object storage

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
- November 15, 2025. Added address search functionality: users can now type any address (city, street, etc.) to search for nearby services; location input is now editable with search button; implemented client-side geocoding using Google Maps JavaScript API; added loading states and error handling; supports Enter key for quick search; NOTE: Requires Google Maps API key with Geocoding API enabled and proper restrictions
- October 09, 2025 (Update 4). Added calendar feature with timezone support: created CalendarView component showing monthly calendar of bookings and availability schedules; integrated calendar into provider dashboard for managing services; added Calendar tab to seeker home page for viewing bookings; calendar displays color-coded events (confirmed, pending, cancelled, completed); added image upload functionality using Replit Object Storage with ObjectUploader component; added external URL field to service creation form for linking to provider websites
- October 09, 2025 (Update 3). Enhanced service creation with manual coordinate entry: added latitude/longitude input fields for international addresses that can't be auto-verified by Google Maps; both auto-verification and manual entry now supported; unified UX flow so clicking services from both list and map views shows detail modal first, with option to proceed to booking
- October 09, 2025 (Update 2). Enhanced service discovery UX: changed distance filter from dropdown to manual input (1-500km); added comprehensive service detail modal for seekers showing full service information; fixed booking creation bug by updating schema to accept ISO string dates; made service names clickable to view details
- October 09, 2025. Switched from Leaflet to Google Maps for interactive map view; fixed location search UX with read-only input and clear instructions; added HTML escaping for XSS protection in map popups; added secure backend endpoint for Google Maps API key delivery
- July 03, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```