/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState } from "react";
import { loadMapLibraries } from "@/lib/google-maps";
import { createMapPreview } from "@/lib/map-preview";
import type { ServiceWithProvider } from "@shared/schema";
import { currentLocation } from "@shared/locations";
import { useTranslation } from "react-i18next";

interface GoogleMapProps {
  services: ServiceWithProvider[];
  userLocation: { lat: number; lng: number } | null;
  onShowList?: () => void;
  onServiceSelect?: (service: ServiceWithProvider) => void;
}

export default function GoogleMap({ services, userLocation, onServiceSelect, onShowList }: GoogleMapProps) {
  const { t } = useTranslation();
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const latestLocation = useRef(userLocation);
  latestLocation.current = userLocation;
  const latestSelect = useRef(onServiceSelect);
  latestSelect.current = onServiceSelect;

  // Initialize map
  useEffect(() => {
    let cancelled = false, failed = false;
    const mapsWindow = window as typeof window & { gm_authFailure?: () => void };
    const previousAuthFailure = mapsWindow.gm_authFailure;
    const authFailure = () => {
      if (!cancelled) {
        console.error("Google Maps authentication failed. Check Maps JavaScript API access and the browser key's allowed website origins.");
        failed = true;
        setError("mapPreview.unavailable");
        setIsLoading(false);
      }
      previousAuthFailure?.();
    };
    mapsWindow.gm_authFailure = authFailure;

    loadMapLibraries().then(({ Map }) => {
      if (cancelled || failed || !mapRef.current) return;

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
      setError("mapPreview.loadError");
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
    if (!googleMapRef.current || !mapReady || error) return;
    const map = googleMapRef.current;

    // Clear existing markers
    markersRef.current = [];

    // Reuse one preview; hovering must not pan the map or steal browser focus.
    const preview = new google.maps.InfoWindow({ disableAutoPan: true, maxWidth: 300, headerDisabled: true });
    let userInfoWindow: google.maps.InfoWindow | undefined;
    let openTimer: number | undefined;
    let closeTimer: number | undefined;
    let activeMarker: google.maps.Marker | null = null;
    let hoveredMarker: google.maps.Marker | null = null;
    let activeCard: HTMLElement | null = null;
    const clearTimers = () => { window.clearTimeout(openTimer); window.clearTimeout(closeTimer); openTimer = closeTimer = undefined; };
    const closePreview = () => {
      clearTimers(); preview.close(); preview.setContent(""); activeMarker = hoveredMarker = null; activeCard = null;
    };
    const dismiss = () => { closePreview(); userInfoWindow?.close(); };
    const scheduleClose = () => {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        closeTimer = undefined;
        if (!activeCard?.contains(document.activeElement)) closePreview();
      }, 250);
    };
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    document.addEventListener("keydown", onEscape);
    const dismissListeners = ["click", "dragstart", "zoom_changed"].map(event => map.addListener(event, dismiss));

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
        title: t("mapPreview.yourLocation"),
      });

      const locationLabel = document.createElement("p");
      locationLabel.className = "p-2 font-semibold";
      locationLabel.textContent = t("mapPreview.yourLocation");
      userInfoWindow = new google.maps.InfoWindow({ content: locationLabel });

      userMarker.addListener('click', () => {
        dismiss();
        userInfoWindow?.open({ map, anchor: userMarker, shouldFocus: false });
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

        const selectService = () => { closePreview(); latestSelect.current?.(service); };
        const showPreview = () => {
          clearTimers();
          userInfoWindow?.close();
          const card = createMapPreview({ name: service.name, description: service.description,
            fallback: t("mapPreview.noDescription"), detailsLabel: t("mapPreview.viewDetails"), closeLabel: t("mapPreview.close"),
            onDetails: latestSelect.current ? selectService : undefined, onClose: closePreview });
          card.addEventListener("mouseenter", () => { if (activeCard === card) clearTimers(); });
          card.addEventListener("mouseleave", () => { if (activeCard === card) scheduleClose(); });
          card.addEventListener("focusin", () => { if (activeCard === card) clearTimers(); });
          card.addEventListener("focusout", event => { if (activeCard === card && !card.contains(event.relatedTarget as Node | null)) scheduleClose(); });
          preview.setContent(card);
          preview.setOptions({ ariaLabel: service.name });
          activeCard = card; activeMarker = marker;
          preview.open({ map, anchor: marker, shouldFocus: false });
        };

        marker.addListener("mouseover", () => {
          clearTimers(); hoveredMarker = marker;
          if (activeMarker !== marker) openTimer = window.setTimeout(showPreview, 150);
        });
        marker.addListener("mouseout", () => {
          if (hoveredMarker !== marker) return;
          hoveredMarker = null;
          window.clearTimeout(openTimer); openTimer = undefined;
          scheduleClose();
        });

        marker.addListener('click', () => {
          if (latestSelect.current) selectService(); else showPreview();
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
      dismissListeners.push(listener);
    }

    return () => {
      dismiss();
      document.removeEventListener("keydown", onEscape);
      dismissListeners.forEach(listener => listener.remove());
      markersRef.current.forEach(marker => { google.maps.event.clearInstanceListeners(marker); marker.setMap(null); });
      markersRef.current = [];
      google.maps.event.clearInstanceListeners(preview);
      if (userInfoWindow) google.maps.event.clearInstanceListeners(userInfoWindow);
    };
  }, [services, userLocation, mapReady, error, t]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden" style={{ minHeight: "400px" }}>
      <div ref={mapRef} className="absolute inset-0" />
      {(isLoading || error) && <div className="absolute inset-0 bg-neutral-100 flex items-center justify-center">
        <div className="text-center p-6" role={error ? "alert" : "status"}>
          {isLoading && !error && <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />}
          <p className="text-neutral-600">{t(error || "mapPreview.loading")}</p>
          {error && (onShowList ? <button type="button" className="mt-3 text-primary underline" onClick={onShowList}>{t("searchPage.backList")}</button> : <button type="button" className="mt-3 text-primary underline" onClick={() => window.location.reload()}>{t("mapPreview.reload")}</button>)}
        </div>
      </div>}
    </div>
  );
}
