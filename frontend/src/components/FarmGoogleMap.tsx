"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary,
  useApiLoadingStatus,
  APILoadingStatus,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import {
  AlertTriangle,
  Check,
  CloudSun,
  Droplets,
  Layers,
  Radio,
  Sprout,
} from "lucide-react";
import type { CurrentWeather } from "@/lib/climate";
import type { SensorMarker } from "./FarmMap";

interface FarmGoogleMapProps {
  apiKey: string;
  mapId?: string;
  lat: number;
  lng: number;
  zoom?: number;
  farmName?: string;
  cropName?: string;
  areaHectares?: number;
  currentWeather?: CurrentWeather | null;
  mapType: "hybrid" | "roadmap" | "terrain";
  sensors: SensorMarker[];
  selectedSensor: SensorMarker | null;
  onSelectSensor: (sensor: SensorMarker | null) => void;
  onLocationChange: (loc: { lat: number; lng: number; address?: string }) => void;
  onErrorFallback?: () => void;
}

/**
 * Handles automatic map camera panning when lat/lng change externally
 */
function MapCameraController({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  const { lat, lng } = center;
  useEffect(() => {
    if (!map) return;
    map.panTo({ lat, lng });
  }, [map, lat, lng]);
  return null;
}

/**
 * Renders the circular boundary for farm acreage
 */
function FarmAcreageCircle({
  center,
  areaHectares,
}: {
  center: { lat: number; lng: number };
  areaHectares: number;
}) {
  const map = useMap();
  const circleRef = useRef<google.maps.Circle | null>(null);
  const { lat, lng } = center;

  useEffect(() => {
    if (!map) return;

    // 1 hectare = 10,000 m2 => r = sqrt(Area / pi)
    const radiusMeters = Math.sqrt((areaHectares * 10000) / Math.PI);
    const point = { lat, lng };

    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        map,
        center: point,
        radius: radiusMeters,
        strokeColor: "#485C11",
        strokeOpacity: 0.85,
        strokeWeight: 2,
        fillColor: "#485C11",
        fillOpacity: 0.16,
        clickable: false,
      });
    } else {
      circleRef.current.setCenter(point);
      circleRef.current.setRadius(radiusMeters);
    }

    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
  }, [map, lat, lng, areaHectares]);

  return null;
}

/**
 * Inner Map component that executes within APIProvider
 */
function GoogleMapInner({
  mapId,
  lat,
  lng,
  zoom = 14,
  farmName = "Farm",
  cropName = "Crops",
  areaHectares = 2.0,
  currentWeather,
  mapType,
  sensors,
  selectedSensor,
  onSelectSensor,
  onLocationChange,
  onErrorFallback,
}: Omit<FarmGoogleMapProps, "apiKey">) {
  const status = useApiLoadingStatus();
  const geocodingLib = useMapsLibrary("geocoding");
  const [farmInfoOpen, setFarmInfoOpen] = useState(false);

  useEffect(() => {
    if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
      onErrorFallback?.();
    }
  }, [status, onErrorFallback]);

  // Reverse Geocoding via Google Maps Geocoding service
  const reverseGeocode = useCallback(
    (newLat: number, newLng: number) => {
      if (!geocodingLib) return;
      const geocoder = new geocodingLib.Geocoder();
      geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          onLocationChange({
            lat: newLat,
            lng: newLng,
            address: results[0].formatted_address,
          });
        } else {
          onLocationChange({ lat: newLat, lng: newLng });
        }
      });
    },
    [geocodingLib, onLocationChange]
  );

  const handleMapClick = (e: MapMouseEvent) => {
    if (e.detail?.latLng) {
      const newLat = e.detail.latLng.lat;
      const newLng = e.detail.latLng.lng;
      reverseGeocode(newLat, newLng);
    }
  };

  const handleFarmDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      reverseGeocode(newLat, newLng);
    }
  };

  const googleMapTypeId =
    mapType === "hybrid"
      ? "hybrid"
      : mapType === "terrain"
      ? "terrain"
      : "roadmap";

  return (
    <div className="relative w-full h-full">
      <Map
        id="gcs-farm-google-map"
        mapId={mapId || "DEMO_MAP_ID"}
        defaultCenter={{ lat, lng }}
        defaultZoom={zoom}
        mapTypeId={googleMapTypeId}
        gestureHandling="greedy"
        disableDefaultUI={false}
        zoomControl={true}
        streetViewControl={true}
        mapTypeControl={false}
        fullscreenControl={true}
        onClick={handleMapClick}
        // Mandatory solution tracking attribution ID per Google Maps Platform instructions
        internalUsageAttributionIds={["gmp_git_agentskills_v1"]}
        className="w-full h-full"
      >
        <MapCameraController center={{ lat, lng }} />
        <FarmAcreageCircle center={{ lat, lng }} areaHectares={areaHectares} />

        {/* Central Farm Advanced Marker */}
        <AdvancedMarker
          position={{ lat, lng }}
          draggable={true}
          onDragEnd={handleFarmDragEnd}
          onClick={() => setFarmInfoOpen(true)}
          title={`${farmName} (${cropName})`}
        >
          <div className="flex flex-col items-center cursor-pointer group">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[#485C11] border-2 border-white shadow-md transition-transform group-hover:scale-110">
              <Sprout className="w-4 h-4 text-white" aria-hidden="true" />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#485C11] border border-white flex items-center justify-center text-white">
                <Check className="w-2.5 h-2.5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-1 bg-black/85 text-white text-[11px] font-sans font-medium tracking-[0.01em] px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm border border-[#DFECC6]/40">
              {farmName}
            </div>
          </div>
        </AdvancedMarker>

        {/* Farm InfoWindow */}
        {farmInfoOpen && (
          <InfoWindow
            position={{ lat, lng }}
            onCloseClick={() => setFarmInfoOpen(false)}
            pixelOffset={[0, -45]}
          >
            <div className="p-2 text-xs font-sans text-black max-w-[240px]">
              <div className="font-semibold text-[15px] leading-snug tracking-[-0.015em] text-[#485C11] mb-1 font-serif">
                {farmName}
              </div>
              <div className="text-[11px] text-[#485C11] mb-1.5">
                Target Crop: <span className="font-semibold text-black">{cropName}</span>
              </div>
              <div className="text-[11px] text-[#6F6F6F] mb-2 font-mono">
                Boundary: {areaHectares} ha ({(areaHectares * 2.471).toFixed(1)} ac)
              </div>
              {currentWeather && (
                <div className="bg-[#DFECC6]/55 p-1.5 rounded-lg border border-[#E9E9E9] text-[11px] text-[#485C11]">
                  <strong>Current Field Weather:</strong> {currentWeather.temperature_2m.toFixed(1)}°C, Humidity {currentWeather.relative_humidity_2m}%
                </div>
              )}
            </div>
          </InfoWindow>
        )}

        {/* Telemetry Sensor Advanced Markers */}
        {sensors.map((sensor) => {
          const isSoil = sensor.type === "soil";
          const isWeather = sensor.type === "weather";
          const isValve = sensor.type === "valve";

          const bg = isSoil
            ? "bg-[#9A6300]"
            : isWeather
            ? "bg-[#2C5E8A]"
            : isValve
            ? "bg-[#485C11]"
            : "bg-[#B3261E]";

          const GlyphIcon = isSoil
            ? Layers
            : isWeather
            ? CloudSun
            : isValve
            ? Droplets
            : AlertTriangle;

          return (
            <AdvancedMarker
              key={sensor.id}
              position={{ lat: sensor.lat, lng: sensor.lng }}
              onClick={() => onSelectSensor(sensor)}
              title={`${sensor.name}: ${sensor.value}`}
            >
              <div className="flex flex-col items-center cursor-pointer group">
                <div
                  className={`w-7 h-7 rounded-full ${bg} border border-white shadow flex items-center justify-center text-white transition-transform group-hover:scale-125`}
                >
                  <GlyphIcon className="w-3.5 h-3.5" aria-hidden="true" />
                </div>
              </div>
            </AdvancedMarker>
          );
        })}

        {/* Selected Sensor InfoWindow */}
        {selectedSensor && (
          <InfoWindow
            position={{ lat: selectedSensor.lat, lng: selectedSensor.lng }}
            onCloseClick={() => onSelectSensor(null)}
            pixelOffset={[0, -32]}
          >
            <div className="p-2 text-xs font-sans text-black max-w-[260px]">
              <div className="flex items-center gap-1.5 mb-1">
                <Radio className="w-3.5 h-3.5 text-[#485C11]" />
                <span className="font-semibold text-xs text-[#485C11]">
                  {selectedSensor.name}
                </span>
              </div>
              <div className="bg-[#F7F8F5] p-2 rounded-lg border border-[#E9E9E9] my-1 font-mono text-[11px] text-black">
                {selectedSensor.value}
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px] text-[#6F6F6F]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#DFECC6] text-[#485C11] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#485C11]" />
                  {selectedSensor.status}
                </span>
                <span className="font-mono">
                  {selectedSensor.lat.toFixed(4)}, {selectedSensor.lng.toFixed(4)}
                </span>
              </div>
            </div>
          </InfoWindow>
        )}
      </Map>
    </div>
  );
}

export function FarmGoogleMap({
  apiKey,
  ...props
}: FarmGoogleMapProps) {
  return (
    <APIProvider
      apiKey={apiKey}
      libraries={["places", "marker", "geometry"]}
    >
      <GoogleMapInner {...props} />
    </APIProvider>
  );
}
