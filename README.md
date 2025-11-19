# WellnessFind

A service marketplace platform connecting users with local service providers in health & wellness, education, and entertainment sectors.

## Overview

WellnessFind enables users to discover and book services based on location, with support for both desktop and mobile devices. The platform features dual-role functionality where users can both seek services and offer them as providers.

## Key Features

### For Service Seekers
- **Location-Based Search**: Find services by typing any address or using your current location
- **Multiple View Modes**: Browse services in List, Map, or Calendar view
- **Smart Filtering**: Filter by category, distance, date, age group, and service type
- **Service Details**: View comprehensive service information including images, descriptions, and external links
- **Easy Booking**: Request bookings with instant or manual approval options
- **Calendar Management**: View all your bookings in a monthly calendar with color-coded status

### For Service Providers
- **Service Management**: Create and manage service listings with images and external URLs
- **Availability Scheduling**: Set availability schedules and capacity limits
- **Booking Management**: Accept or decline booking requests
- **Calendar View**: Manage your services and bookings in a visual calendar
- **Manual Coordinates**: Support for international addresses with manual latitude/longitude entry

### Technical Features
- Mobile-first responsive design
- Real-time distance calculations using GPS coordinates
- Interactive Google Maps integration
- Image upload support via Replit Object Storage
- Secure authentication with Replit Auth
- PostgreSQL database with automated backups
- Timezone-aware calendar system

## Prerequisites

Before setting up WellnessFind, you'll need:

1. **Replit Account**: Sign up at [replit.com](https://replit.com)
2. **Google Maps API Key**: Required for map view and address search
   - Create a project in [Google Cloud Console](https://console.cloud.google.com)
   - Enable the following APIs:
     - Maps JavaScript API
     - Geocoding API
   - Create an API key (see Configuration section below)

## Setup Instructions

### 1. Environment Variables

The following environment variables are required:

- `GOOGLE_MAPS_API_KEY`: Your Google Maps API key
- `DATABASE_URL`: PostgreSQL connection string (auto-configured by Replit)
- Additional variables are auto-configured by Replit platform

#### Setting the Google Maps API Key

1. Click on the "Secrets" tool in Replit (lock icon on the left sidebar)
2. Click "New Secret"
3. Set key as `GOOGLE_MAPS_API_KEY`
4. Paste your Google Maps API key as the value
5. Click "Add Secret"

### 2. Database Setup

The PostgreSQL database is automatically configured when you create it in Replit:

1. No manual setup required - the database is already connected
2. Database schema is automatically synchronized
3. To reset or migrate the database, run:
   ```bash
   npm run db:push
   ```

### 3. Object Storage Setup (Optional)

For image uploads to work:

1. Open the "Object Storage" tool in Replit
2. Create a new bucket (if not already created)
3. The app will automatically use the configured bucket

### 4. Configure Google Maps API Key

**IMPORTANT**: Your Google Maps API key must be configured correctly for the app to work:

#### Option 1: No Restrictions (Easiest, Less Secure)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to: APIs & Services → Credentials
3. Click on your API key
4. Under "API restrictions", select **"Don't restrict key"**
5. Click "Save"

#### Option 2: With Restrictions (Recommended, More Secure)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to: APIs & Services → Credentials
3. Click on your API key
4. Under "API restrictions":
   - Select "Restrict key"
   - Enable these APIs:
     - **Maps JavaScript API**
     - **Geocoding API**
5. Under "Application restrictions":
   - Select "HTTP referrers (websites)"
   - Add your Replit app URL (e.g., `https://your-repl-name.repl.co/*`)
   - Add `https://*.replit.dev/*` for development
6. Click "Save"

## Running the Application

### Development Mode

The app automatically runs in development mode on Replit:

1. The "Start application" workflow runs automatically
2. It starts both the backend (Express) and frontend (Vite) servers
3. Access your app through the Preview tool:
   - Click "All tools" in the left sidebar
   - Select "Preview"
   - Or use the search bar (magnifying glass) and type "Preview"

The development server includes:
- Hot module replacement (instant updates when you edit code)
- Detailed error messages
- Browser developer tools in the Preview

### Manual Start

If you need to manually start the application:

```bash
npm run dev
```

This command:
- Starts the Express backend on port 5000
- Starts the Vite frontend development server
- Enables hot reloading for both frontend and backend

## Deploying the Application

### Publishing on Replit

To make your app publicly accessible with a live URL:

1. **Prepare for Publishing**:
   - Ensure all secrets (API keys) are configured
   - Test the app thoroughly in Preview mode
   - Make sure the database is set up correctly

2. **Publish Your App**:
   - Click the **"Publish"** button (cloud icon) at the top of your workspace
   - Replit will automatically suggest the best deployment option
   - For WellnessFind, **Autoscale Deployment** is recommended (scales with traffic)

3. **Deployment Options**:
   - **Autoscale**: Best for WellnessFind - scales automatically based on traffic
   - **Reserved VM**: For consistent high traffic or specific resource needs
   - **Static**: Not suitable for WellnessFind (requires backend)

4. **After Publishing**:
   - You'll receive a public URL (e.g., `https://your-app.replit.app`)
   - The app will automatically handle SSL/HTTPS
   - You can add a custom domain in the Publishing settings

5. **Update Google Maps API Key**:
   - After publishing, update your Google Maps API key restrictions
   - Add your production URL to the HTTP referrers list
   - Format: `https://your-app.replit.app/*`

### Monitoring Your Deployment

Once published, you can:
- View analytics and usage statistics
- Monitor app performance
- Check deployment logs
- Update configuration without redeploying

## Project Structure

```
wellnessfind/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/        # Page components (Home, Dashboard, etc.)
│   │   ├── lib/          # Utilities and helpers
│   │   └── hooks/        # Custom React hooks
├── server/                # Backend Express application
│   ├── routes.ts         # API endpoints
│   ├── storage.ts        # Database interface
│   ├── auth.ts          # Authentication logic
│   └── objectStorage.ts  # Object storage integration
├── shared/               # Shared code between frontend and backend
│   └── schema.ts        # Database schema and types
└── db/                  # Database migrations and config
```

## Troubleshooting

### "Location Not Found" Error

**Problem**: Typing an address shows "Location Not Found" error

**Solution**: This happens when the Google Maps API key doesn't have Geocoding API enabled.

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to: APIs & Services → Library
3. Search for "Geocoding API"
4. Click "Enable"
5. Make sure your API key allows the Geocoding API (see Configuration section above)

### Images Not Uploading

**Problem**: Service image uploads fail or don't appear

**Solution**: Set up Object Storage in Replit:

1. Open the "Object Storage" tool in the left sidebar
2. Create a bucket if you haven't already
3. Restart your application

### Map Not Loading

**Problem**: The map view shows a blank page or error

**Solution**: Check your Google Maps API key:

1. Verify `GOOGLE_MAPS_API_KEY` is set in Secrets
2. Ensure Maps JavaScript API is enabled in Google Cloud Console
3. Check API key restrictions allow your Replit domain
4. Look at browser console for specific error messages

### "Use Current Location" Not Working

**Problem**: The location button doesn't detect your location

**Solution**: This requires browser permissions:

1. Your browser will prompt for location access - click "Allow"
2. If you previously blocked location access:
   - Click the lock icon in the browser address bar
   - Change location permission to "Allow"
   - Refresh the page
3. Note: Location access doesn't work in some browsers' private/incognito mode

### Database Sync Issues

**Problem**: Schema changes aren't reflected in the database

**Solution**: Push the schema changes:

```bash
npm run db:push
```

If you see warnings about data loss:

```bash
npm run db:push --force
```

**Note**: `--force` will drop and recreate tables, losing data. Use only in development.

### App Not Starting

**Problem**: The application workflow fails to start

**Solution**:

1. Check the workflow logs for specific errors
2. Ensure all dependencies are installed:
   ```bash
   npm install
   ```
3. Verify environment variables are set correctly
4. Check that the database is created and accessible

## Support & Resources

- **Replit Documentation**: [docs.replit.com](https://docs.replit.com)
- **Google Maps Platform**: [developers.google.com/maps](https://developers.google.com/maps)
- **Report Issues**: Use the Replit support if you encounter platform-specific issues

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
- **Storage**: Replit Object Storage (Google Cloud Storage)
- **Maps**: Google Maps JavaScript API
- **Build Tools**: Vite, esbuild
- **Deployment**: Replit Autoscale Deployments

## License

This project is configured for use on the Replit platform.
