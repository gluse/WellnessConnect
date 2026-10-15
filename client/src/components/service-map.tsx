import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ServiceWithProvider } from "@shared/schema";
import { getProviderName } from "@shared/provider";

interface ServiceMapProps {
  services: ServiceWithProvider[];
  userLocation: { lat: number; lng: number } | null;
  onServiceSelect?: (service: ServiceWithProvider) => void;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default function ServiceMap({ services, userLocation, onServiceSelect }: ServiceMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const defaultCenter: [number, number] = userLocation 
      ? [userLocation.lat, userLocation.lng] 
      : [37.7749, -122.4194];

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(defaultCenter, 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
    }

    const markers: L.Marker[] = [];

    if (userLocation && mapRef.current) {
      const userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: "custom-user-marker",
          html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).addTo(mapRef.current);
      
      userMarker.bindPopup("<b>Your Location</b>");
      markers.push(userMarker);
    }

    services.forEach((service) => {
      if (service.latitude && service.longitude && mapRef.current) {
        const marker = L.marker([service.latitude, service.longitude], {
          icon: L.icon({
            iconUrl: '/service-location-pin.svg',
            iconSize: [32, 42],
            iconAnchor: [16, 40],
            popupAnchor: [0, -40],
          }),
        }).addTo(mapRef.current);

        const providerName = service.provider
          ? getProviderName(service.provider)
          : 'Unknown Provider';
        
        const popupContent = `
          <div style="min-width: 200px;">
            <h3 style="font-weight: bold; margin-bottom: 4px;">${escapeHtml(service.name)}</h3>
            <p style="font-size: 14px; color: #666; margin-bottom: 4px;">${escapeHtml(providerName)}</p>
            ${service.employee?.name ? `<p style="font-size: 14px; color: #666; margin-bottom: 4px;">With ${escapeHtml(service.employee.name)}</p>` : ''}
            <p style="font-size: 14px; font-weight: bold; color: #10b981;">$${Number(service.price).toFixed(2)}</p>
            ${service.distance ? `<p style="font-size: 12px; color: #999;">${Number(service.distance).toFixed(1)} km away</p>` : ''}
          </div>
        `;

        marker.bindPopup(popupContent);
        
        if (onServiceSelect) {
          marker.on("click", () => {
            onServiceSelect(service);
          });
        }
        
        markers.push(marker);
      }
    });

    if (markers.length > 0 && mapRef.current) {
      const group = L.featureGroup(markers);
      mapRef.current.fitBounds(group.getBounds().pad(0.1));
    }

    return () => {
      markers.forEach(marker => marker.remove());
    };
  }, [services, userLocation, onServiceSelect]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: "400px" }}
    />
  );
}
