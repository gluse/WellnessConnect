import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import type { ServiceWithProvider } from "@shared/schema";

interface GoogleMapProps {
  services: ServiceWithProvider[];
  userLocation: { lat: number; lng: number } | null;
  onServiceSelect?: (service: ServiceWithProvider) => void;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default function GoogleMap({ services, userLocation, onServiceSelect }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [apiKey, setApiKey] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch API key
  useEffect(() => {
    fetch('/api/config/maps')
      .then(res => res.json())
      .then(data => {
        setApiKey(data.apiKey);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load maps config:', err);
        setIsLoading(false);
      });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !apiKey || isLoading) return;

    const defaultCenter = userLocation 
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : { lat: 37.7749, lng: -122.4194 };

    const loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
    });

    loader.load().then(() => {
      if (!mapRef.current) return;

      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
    });

    return () => {
      googleMapRef.current = null;
    };
  }, [apiKey, isLoading, userLocation]);

  // Add markers
  useEffect(() => {
    if (!googleMapRef.current || !apiKey) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;

    // Add user location marker
    if (userLocation) {
      const userMarker = new google.maps.Marker({
        position: { lat: userLocation.lat, lng: userLocation.lng },
        map: googleMapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        title: 'Your Location',
      });

      const userInfoWindow = new google.maps.InfoWindow({
        content: '<div style="padding: 8px;"><b>Your Location</b></div>',
      });

      userMarker.addListener('click', () => {
        userInfoWindow.open(googleMapRef.current, userMarker);
      });

      markersRef.current.push(userMarker);
      bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
      hasMarkers = true;
    }

    // Add service markers
    services.forEach((service) => {
      if (service.latitude && service.longitude && googleMapRef.current) {
        const marker = new google.maps.Marker({
          position: { lat: service.latitude, lng: service.longitude },
          map: googleMapRef.current,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: '#10b981',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          title: service.name,
        });

        const providerName = service.provider 
          ? `${service.provider.firstName || ''} ${service.provider.lastName || ''}`.trim() || 'Unknown Provider'
          : 'Unknown Provider';

        const infoWindowContent = `
          <div style="padding: 12px; min-width: 200px;">
            <h3 style="font-weight: bold; margin: 0 0 8px 0; font-size: 16px;">${escapeHtml(service.name)}</h3>
            <p style="margin: 0 0 4px 0; color: #666; font-size: 14px;">${escapeHtml(providerName)}</p>
            <p style="margin: 0 0 4px 0; font-weight: bold; color: #10b981; font-size: 14px;">$${Number(service.price).toFixed(2)}</p>
            ${service.distance ? `<p style="margin: 0; color: #999; font-size: 12px;">${Number(service.distance).toFixed(1)} km away</p>` : ''}
          </div>
        `;

        const infoWindow = new google.maps.InfoWindow({
          content: infoWindowContent,
        });

        marker.addListener('click', () => {
          infoWindow.open(googleMapRef.current, marker);
          if (onServiceSelect) {
            onServiceSelect(service);
          }
        });

        markersRef.current.push(marker);
        bounds.extend({ lat: service.latitude, lng: service.longitude });
        hasMarkers = true;
      }
    });

    // Fit map to show all markers
    if (hasMarkers && googleMapRef.current) {
      googleMapRef.current.fitBounds(bounds);
      // Prevent too much zoom for single marker
      const listener = google.maps.event.addListenerOnce(googleMapRef.current, 'bounds_changed', () => {
        if (googleMapRef.current && googleMapRef.current.getZoom()! > 15) {
          googleMapRef.current.setZoom(15);
        }
      });
    }

    return () => {
      markersRef.current.forEach(marker => marker.setMap(null));
    };
  }, [services, userLocation, onServiceSelect, apiKey]);

  if (isLoading) {
    return (
      <div className="w-full h-full rounded-xl bg-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading map...</p>
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="w-full h-full rounded-xl bg-neutral-100 flex items-center justify-center border-2 border-dashed border-neutral-300">
        <div className="text-center p-6">
          <p className="text-neutral-700 font-medium">Map Unavailable</p>
          <p className="text-sm text-neutral-500">Google Maps API key not configured</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: "400px" }}
    />
  );
}
