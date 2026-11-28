"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type * as LType from "leaflet";
import {
  MapPin,
  Search,
  Navigation,
  ExternalLink,
  Radio,
  CloudSun,
  Droplets,
} from "lucide-react";
import type { CurrentWeather } from "@/lib/climate";
import { useFarmStore, getActiveProperty } from "@/lib/property-store";
import { FarmGoogleMap } from "./FarmGoogleMap";

export function escapeHtml(raw: string): string {
  return String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SensorMarker {
  id: string;
  name: string;
  type: "soil" | "weather" | "valve" | "pest";
  lat: number;
  lng: number;
  value: string;
  status: "OPTIMAL" | "WARNING" | "CRITICAL";
}

interface FarmMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  farmName?: string;
  cropName?: string;
  areaHectares?: number;
  currentWeather?: CurrentWeather | null;
  apiKey?: string;
  onLocationChange: (loc: { lat: number; lng: number; address?: string }) => void;
  onOpenSettings?: () => void;
  className?: string;
}

const FARM_PIN_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>';

function getSensorPinSvg(type: SensorMarker["type"]): string {
  if (type === "soil") {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>';
  }
  if (type === "weather") {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>';
  }
  if (type === "valve") {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>';
  }
  return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
}

export function FarmMap({
  lat,
  lng,
  zoom = 14,
  farmName = "Green Field Farm",
  cropName = "Wheat",
  areaHectares = 2.0,
  currentWeather,
  apiKey,
  onLocationChange,
  className = "",
}: FarmMapProps) {
  const leafletContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapInstanceRef = useRef<LType.Map | null>(null);
  const leafletMarkerRef = useRef<LType.Marker | null>(null);
  const leafletCircleRef = useRef<LType.Circle | null>(null);
  const leafletTileLayersRef = useRef<LType.TileLayer[]>([]);
  const leafletSensorsRef = useRef<LType.Marker[]>([]);

  const [mapType, setMapType] = useState<"hybrid" | "roadmap" | "terrain">("hybrid");
  const [addressSearch, setAddressSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationName, setLocationName] = useState<string>("");
  const [selectedSensor, setSelectedSensor] = useState<SensorMarker | null>(null);

  // Determine Google Maps Platform API key from build-time public config only
  const gKey = apiKey !== undefined ? apiKey : (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "");
  const [googleAuthError, setGoogleAuthError] = useState(false);

  const hasValidGoogleKey = Boolean(gKey && gKey.trim().length > 10 && !googleAuthError);

  const addTileLayers = useCallback(
    (map: LType.Map, L: typeof LType, type: string) => {
      leafletTileLayersRef.current.forEach((layer) => map.removeLayer(layer));
      leafletTileLayersRef.current = [];

      if (type === "hybrid") {
        const sat = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19 }
        ).addTo(map);
        const ref = L.tileLayer(
          "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19 }
        ).addTo(map);
        leafletTileLayersRef.current = [sat, ref];
      } else if (type === "terrain") {
        const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
          maxZoom: 17,
        }).addTo(map);
        leafletTileLayersRef.current = [topo];
      } else {
        const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map);
        leafletTileLayersRef.current = [osm];
      }
    },
    []
  );

  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const sensorsByFarm = useFarmStore((s) => s.sensorsByFarm);
  const activeFarm = getActiveProperty({ properties, activePropertyId });
  const customFarmSensors = useMemo(
    () => (activeFarm ? sensorsByFarm[activeFarm.id] ?? [] : []),
    [activeFarm, sensorsByFarm]
  );

  // Generate sensors around the farm coordinates + merge user-registered farm sensors
  const sensorList: SensorMarker[] = useMemo(
    () => {
      const defaults: SensorMarker[] = [
        {
          id: "sensor-soil-01",
          name: "Soil Moisture & Temp Probe (Root Zone)",
          type: "soil",
          lat: lat + 0.0012,
          lng: lng + 0.0015,
          value: "62% Vol. / 22.4 °C",
          status: "OPTIMAL",
        },
        {
          id: "sensor-weather-01",
          name: "Agro Weather Micro-Station",
          type: "weather",
          lat: lat - 0.0014,
          lng: lng - 0.0011,
          value: `${currentWeather ? currentWeather.temperature_2m.toFixed(1) : "24.5"} °C / Wind ${currentWeather ? currentWeather.wind_speed_10m.toFixed(1) : "8.2"} km/h`,
          status: "OPTIMAL",
        },
        {
          id: "sensor-valve-01",
          name: "Smart Drip Irrigation Solenoid Valve #1",
          type: "valve",
          lat: lat + 0.0008,
          lng: lng - 0.0016,
          value: "Closed (Scheduled for 06:00 AM)",
          status: "OPTIMAL",
        },
        {
          id: "sensor-pest-01",
          name: "Digital Acoustic Pest & Canopy Monitor",
          type: "pest",
          lat: lat - 0.0009,
          lng: lng + 0.0014,
          value: "Clean (No Pathogen / Spore Surge)",
          status: "OPTIMAL",
        },
      ];
      const userMarkers: SensorMarker[] = customFarmSensors.map((cs, idx) => ({
        id: cs.deviceId,
        name: `${cs.deviceId} (${cs.sensorType})`,
        type: cs.sensorType.toLowerCase().includes("weather") ? "weather" : "soil",
        lat: cs.location?.latitude ?? lat + (idx + 1) * 0.0005,
        lng: cs.location?.longitude ?? lng - (idx + 1) * 0.0005,
        value: `Field ${cs.fieldId} • Battery ${cs.batteryPercent ?? 100}%`,
        status: cs.status === "OFFLINE" ? "CRITICAL" : "OPTIMAL",
      }));
      return [...defaults, ...userMarkers];
    },
    [lat, lng, currentWeather, customFarmSensors]
  );

  // Reverse geocoding on lat/lng change using open-access Nominatim service
  useEffect(() => {
    let active = true;
    async function reverseGeocode() {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        if (res.ok && active) {
          const data = await res.json();
          const name =
            data.address?.village ||
            data.address?.town ||
            data.address?.suburb ||
            data.address?.city ||
            data.address?.county ||
            data.address?.state_district ||
            data.address?.state ||
            "Field Location";
          const state = data.address?.state || "";
          const country = data.address?.country || "";
          setLocationName(`${name}${state ? `, ${state}` : ""}${country ? ` (${country})` : ""}`);
        }
      } catch {
        if (active) setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
    }
    reverseGeocode();
    return () => {
      active = false;
    };
  }, [lat, lng]);

  // Leaflet map initialization & reactive updates (Zero-API-Key Mode)
  useEffect(() => {
    if (hasValidGoogleKey) {
      if (leafletMapInstanceRef.current) {
        leafletMapInstanceRef.current.remove();
        leafletMapInstanceRef.current = null;
      }
      return;
    }

    let isMounted = true;

    async function setupOrUpdateLeaflet() {
      if (!leafletContainerRef.current) return;
      const L = await import("leaflet");
      if (!isMounted || !leafletContainerRef.current) return;

      const radiusMeters = Math.sqrt((areaHectares * 10000) / Math.PI);

      // If map instance already exists, perform smooth camera pan & update positions
      if (leafletMapInstanceRef.current) {
        const map = leafletMapInstanceRef.current;
        map.flyTo([lat, lng], zoom, { duration: 0.6 });

        if (leafletMarkerRef.current) {
          leafletMarkerRef.current.setLatLng([lat, lng]);
        }

        if (leafletCircleRef.current) {
          leafletCircleRef.current.setLatLng([lat, lng]);
          leafletCircleRef.current.setRadius(radiusMeters);
        }

        // Re-render sensor markers around new coords
        if (leafletSensorsRef.current.length > 0) {
          leafletSensorsRef.current.forEach((sm) => map.removeLayer(sm));
          leafletSensorsRef.current = [];
        }

        sensorList.forEach((s) => {
          const sIcon = L.divIcon({
            className: "custom-sensor-pin",
            html: `<div style="
              background: ${s.type === "soil" ? "#9A6300" : s.type === "weather" ? "#2C5E8A" : "#485C11"};
              color: #FFFFFF;
              width: 26px;
              height: 26px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 1.5px solid #FFFFFF;
              box-shadow: 0 1px 4px rgba(0,0,0,0.25);
              font-size: 12px;
              cursor: pointer;
            ">${getSensorPinSvg(s.type)}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          const sm = L.marker([s.lat, s.lng], { icon: sIcon }).addTo(map);
          sm.bindPopup(
            `<div style="font-family: sans-serif; font-size: 13px; color: #000000; padding: 4px;">
              <strong style="color: #485C11;">${escapeHtml(s.name)}</strong><br/>
              <span>Telemetry: <strong>${escapeHtml(s.value)}</strong></span><br/>
              <span style="font-size: 11px; color: #6F6F6F;">Status: ${escapeHtml(s.status)}</span>
            </div>`
          );
          sm.on("click", () => setSelectedSensor(s));
          leafletSensorsRef.current.push(sm);
        });

        return;
      }

      // Initial Creation
      leafletContainerRef.current.innerHTML = "";
      const map = L.map(leafletContainerRef.current, {
        center: [lat, lng],
        zoom,
        zoomControl: true,
        attributionControl: false,
      });
      leafletMapInstanceRef.current = map;

      // Add base layer based on current mapType
      addTileLayers(map, L, mapType);

      // Farm Circle Boundary
      const circle = L.circle([lat, lng], {
        radius: radiusMeters,
        color: "#485C11",
        fillColor: "#485C11",
        fillOpacity: 0.16,
        weight: 2,
        dashArray: "4, 6",
      }).addTo(map);
      leafletCircleRef.current = circle;

      // Custom Farm Pin
      const farmIcon = L.divIcon({
        className: "custom-farm-pin",
        html: `<div style="
          background: #485C11;
          color: #FFFFFF;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #FFFFFF;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          font-size: 18px;
          cursor: grab;
        ">${FARM_PIN_SVG}</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([lat, lng], {
        icon: farmIcon,
        draggable: true,
        title: `${farmName} (${cropName})`,
      }).addTo(map);
      leafletMarkerRef.current = marker;

      marker.on("dragend", (e: LType.DragEndEvent) => {
        const target = e.target as LType.Marker;
        const pos = target.getLatLng();
        onLocationChange({ lat: pos.lat, lng: pos.lng });
      });

      map.on("click", (e: LType.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
        onLocationChange({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      // Sensor markers
      sensorList.forEach((s) => {
        const sIcon = L.divIcon({
          className: "custom-sensor-pin",
          html: `<div style="
            background: ${s.type === "soil" ? "#9A6300" : s.type === "weather" ? "#2C5E8A" : "#485C11"};
            color: #FFFFFF;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1.5px solid #FFFFFF;
            box-shadow: 0 1px 4px rgba(0,0,0,0.25);
            font-size: 12px;
            cursor: pointer;
          ">${getSensorPinSvg(s.type)}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const sm = L.marker([s.lat, s.lng], { icon: sIcon }).addTo(map);
        sm.bindPopup(
          `<div style="font-family: sans-serif; font-size: 13px; color: #000000; padding: 4px;">
            <strong style="color: #485C11;">${escapeHtml(s.name)}</strong><br/>
            <span>Telemetry: <strong>${escapeHtml(s.value)}</strong></span><br/>
            <span style="font-size: 11px; color: #545333;">Status: ${escapeHtml(s.status)}</span>
          </div>`
        );
        sm.on("click", () => setSelectedSensor(s));
        leafletSensorsRef.current.push(sm);
      });
    }

    setupOrUpdateLeaflet();

    return () => {
      isMounted = false;
    };
  }, [hasValidGoogleKey, lat, lng, areaHectares, farmName, cropName, addTileLayers, mapType, onLocationChange, sensorList, zoom]);

  useEffect(() => {
    if (leafletMapInstanceRef.current && !hasValidGoogleKey) {
      import("leaflet").then((L) => {
        if (leafletMapInstanceRef.current) {
          addTileLayers(leafletMapInstanceRef.current, L, mapType);
        }
      });
    }
  }, [mapType, hasValidGoogleKey, addTileLayers]);

  // Handle Search for village / district / coordinates
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!addressSearch.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressSearch.trim())}&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const newLat = parseFloat(data[0].lat);
          const newLng = parseFloat(data[0].lon);
          onLocationChange({
            lat: newLat,
            lng: newLng,
            address: data[0].display_name,
          });
          setLocationName(data[0].display_name);
        }
      }
    } catch {
      // Ignored
    } finally {
      setSearching(false);
    }
  }

  // Geolocation "Locate My Field"
  function handleLocateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onLocationChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }

  const googleMapsExternalUrl = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Search & Location Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form onSubmit={handleSearch} className="flex-1 min-w-[260px] flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search village, district, pincode, or coordinates..."
              value={addressSearch}
              onChange={(e) => setAddressSearch(e.target.value)}
              className="w-full min-h-[38px] pl-9 pr-3 py-2 text-xs rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="pill-btn pill-btn-primary text-xs py-2 px-4 whitespace-nowrap"
          >
            {searching ? "Searching..." : "Locate"}
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            title="Use Device GPS"
            className="pill-btn pill-btn-secondary text-xs py-2 px-3"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>{locating ? "Finding..." : "GPS"}</span>
          </button>

          {/* Layer switcher: Satellite / Topo / Streets */}
          <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-full p-0.5">
            <button
              type="button"
              onClick={() => setMapType("hybrid")}
              className={`text-xs py-1.5 px-3 rounded-full transition-colors ${
                mapType === "hybrid"
                  ? "bg-[var(--accent)] text-[var(--on-accent)] font-medium"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              title="High-Resolution Satellite with boundaries"
            >
              Satellite
            </button>
            <button
              type="button"
              onClick={() => setMapType("terrain")}
              className={`text-xs py-1.5 px-3 rounded-full transition-colors ${
                mapType === "terrain"
                  ? "bg-[var(--accent)] text-[var(--on-accent)] font-medium"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              title="Topographic relief & elevation contours"
            >
              Terrain
            </button>
            <button
              type="button"
              onClick={() => setMapType("roadmap")}
              className={`text-xs py-1.5 px-3 rounded-full transition-colors ${
                mapType === "roadmap"
                  ? "bg-[var(--accent)] text-[var(--on-accent)] font-medium"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              title="Standard street and navigation map"
            >
              Roads
            </button>
          </div>

          <a
            href={googleMapsExternalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pill-btn pill-btn-secondary text-xs py-2 px-3 text-[var(--text-secondary)]"
            title="Open coordinates in Google Maps"
          >
            <span>Google Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Map Display Canvas */}
      <div className="relative w-full h-[380px] sm:h-[440px] rounded-[24px] overflow-hidden border border-[var(--border-default)]">
        {hasValidGoogleKey ? (
          <FarmGoogleMap
            apiKey={gKey}
            mapId="DEMO_MAP_ID"
            lat={lat}
            lng={lng}
            zoom={zoom}
            farmName={farmName}
            cropName={cropName}
            areaHectares={areaHectares}
            currentWeather={currentWeather}
            mapType={mapType}
            sensors={sensorList}
            selectedSensor={selectedSensor}
            onSelectSensor={setSelectedSensor}
            onLocationChange={onLocationChange}
            onErrorFallback={() => setGoogleAuthError(true)}
          />
        ) : (
          <div ref={leafletContainerRef} className="map-canvas-container w-full h-full" />
        )}

        {/* Real-time Weather Badge Overlay on Map */}
        {currentWeather && (
          <div className="absolute top-3 left-3 z-[1000] bg-[var(--bg-surface)]/95 backdrop-blur-sm border border-[var(--border-default)] rounded-full px-3 py-1.5 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <CloudSun className="w-4 h-4 text-[var(--accent)]" />
              <span className="font-medium font-mono tabular-nums text-[var(--text-primary)]">
                {currentWeather.temperature_2m.toFixed(1)}°C
              </span>
              <span className="text-[var(--text-secondary)] hidden sm:inline">
                (Feels {currentWeather.apparent_temperature.toFixed(1)}°C)
              </span>
            </div>
            <span className="text-[var(--border-default)]">|</span>
            <div className="flex items-center gap-1 font-mono tabular-nums text-[var(--text-secondary)]">
              <Droplets className="w-3.5 h-3.5" />
              <span>{currentWeather.relative_humidity_2m}%</span>
            </div>
            <span className="text-[var(--border-default)]">|</span>
            <div className="flex items-center gap-1 font-mono tabular-nums text-[var(--text-secondary)]">
              <span>Wind {currentWeather.wind_speed_10m.toFixed(1)} km/h</span>
            </div>
          </div>
        )}

        {/* Map Engine Badge (Bottom Right) */}
        <div className="absolute bottom-3 right-3 z-[1000] bg-[var(--bg-surface)]/95 backdrop-blur-sm border border-[var(--border-default)] rounded-full px-3 py-1 text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          <span className="font-medium">
            {hasValidGoogleKey
              ? "Google Maps Platform (Advanced Markers)"
              : mapType === "hybrid"
              ? "High-Resolution Satellite (No API Key Required)"
              : mapType === "terrain"
              ? "OpenTopoMap Terrain (No API Key Required)"
              : "OpenStreetMap (No API Key Required)"}
          </span>
        </div>

        {/* Click Instruction Pill */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-[var(--bg-surface)]/90 backdrop-blur-sm border border-[var(--border-default)] rounded-full px-3 py-1 text-[11px] text-[var(--text-secondary)] hidden sm:flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-[var(--accent)]" />
          <span>Click anywhere or drag pin to update field coordinates</span>
        </div>
      </div>

      {/* Location & Coordinates Footer */}
      <div className="flex flex-wrap items-center justify-between text-xs text-[var(--text-secondary)] px-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="font-medium text-[var(--text-primary)]">
            Field: {locationName || "Locating coordinates..."}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono tabular-nums">
          <span>Lat: {lat.toFixed(5)}</span>
          <span>Lng: {lng.toFixed(5)}</span>
          <span>Area: {areaHectares} ha ({(areaHectares * 2.471).toFixed(1)} ac)</span>
        </div>
      </div>

      {/* Sensor Detail Drawer if selected */}
      {selectedSensor && (
        <div className="bg-[var(--bg-raised)] border border-[var(--border-default)] rounded-xl p-3 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[var(--accent)]" />
            <div>
              <strong className="text-[var(--text-primary)]">{selectedSensor.name}</strong>
              <p className="text-[var(--text-secondary)]">Reading: {selectedSensor.value}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedSensor(null)}
            className="text-[11px] text-[var(--text-secondary)] underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
