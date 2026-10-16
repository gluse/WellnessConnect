/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState } from "react";
import { loadMapLibraries } from "@/lib/google-maps";
import type { ServiceWithProvider } from "@shared/schema";
import { getProviderName } from "@shared/provider";
import { currentLocation } from "@shared/locations";

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const latestLocation = useRef(userLocation);
  latestLocation.current = userLocation;

  // Initialize map
  useEffect(() => {
    let cancelled = false;
    const mapsWindow = window as typeof window & { gm_authFailure?: () => void };
    const previousAuthFailure = mapsWindow.gm_authFailure;
    const authFailure = () => {
      if (!cancelled) {
        console.error("Google Maps authentication failed. Check Maps JavaScript API access and the browser key's allowed website origins.");
        setError("The map is unavailable. Please try again later.");
        setIsLoading(false);
      }
      previousAuthFailure?.();
    };
    mapsWindow.gm_authFailure = authFailure;

    loadMapLibraries().then(({ Map }) => {
      if (cancelled || !mapRef.current) return;

      googleMapRef.current = new Map(mapRef.current, {
        center: latestLocation.current || { lat: 37.7749, lng: -122.4194 },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      
      setMapReady(true);
      setIsLoading(false);
    }).catch(err => {
      if (cancelled) return;
      console.error('Failed to load Google Maps:', err);
      setError("The map could not load. Check your connection and try again.");
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      if (mapsWindow.gm_authFailure === authFailure) mapsWindow.gm_authFailure = previousAuthFailure;
      if (googleMapRef.current) google.maps.event.clearInstanceListeners(googleMapRef.current);
      googleMapRef.current = null;
    };
  }, []);

  // Add markers
  useEffect(() => {
    if (!googleMapRef.current || !mapReady) return;

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
      service = currentLocation(service);
      if (service.latitude != null && service.longitude != null && googleMapRef.current) {
        const marker = new google.maps.Marker({
          position: { lat: service.latitude, lng: service.longitude },
          map: googleMapRef.current,
          icon: {
            url: '/service-location-pin.svg',
            scaledSize: new google.maps.Size(32, 42),
            anchor: new google.maps.Point(16, 40),
          },
          title: service.name,
        });

        const providerName = service.provider
          ? getProviderName(service.provider)
          : 'Unknown Provider';

        const infoWindowContent = `
          <div style="padding: 12px; min-width: 200px;">
            <h3 style="font-weight: bold; margin: 0 0 8px 0; font-size: 16px;">${escapeHtml(service.name)}</h3>
            <p style="margin: 0 0 4px 0; color: #666; font-size: 14px;">${escapeHtml(providerName)}</p>
            ${service.employee?.name ? `<p style="margin: 0 0 4px 0; color: #666; font-size: 14px;">With ${escapeHtml(service.employee.name)}</p>` : ''}
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
  }, [services, userLocation, onServiceSelect, mapReady]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden" style={{ minHeight: "400px" }}>
      <div ref={mapRef} className="absolute inset-0" />
      {(isLoading || error) && <div className="absolute inset-0 bg-neutral-100 flex items-center justify-center">
        <div className="text-center p-6" role={error ? "alert" : "status"}>
          {isLoading && !error && <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />}
          <p className="text-neutral-600">{error || "Loading map…"}</p>
          {error && <button type="button" className="mt-3 text-primary underline" onClick={() => window.location.reload()}>Reload page</button>}
        </div>
      </div>}
    </div>
  );
}
