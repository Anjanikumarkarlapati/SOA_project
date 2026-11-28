"use client";

import React, { Suspense, useMemo, useRef, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme } from "@/components/providers/ThemeProvider";

const R3FCanvas = dynamic(
  () => import("@react-three/fiber").then((m) => m.Canvas),
  { ssr: false }
);

export interface TerrainZoneMarker {
  id: string;
  name: string;
  xPct: number;
  yPct: number;
  moisture: number;
  status: "OPTIMAL" | "ATTENTION" | "NORMAL";
}

export interface FieldTerrain3DProps {
  zones: TerrainZoneMarker[];
  selectedZoneId: string;
  moistureAvg?: number;
}

const subscribeNoop = () => () => {};

function canUseWebGL(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return false;
  try {
    const c = document.createElement("canvas");
    return Boolean(
      c.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
        c.getContext("webgl", { failIfMajorPerformanceCaveat: true })
    );
  } catch {
    return false;
  }
}

function getReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function TerrainMesh({
  isDark,
  reducedMotion,
  zones,
  selectedZoneId,
}: {
  isDark: boolean;
  reducedMotion: boolean;
  zones: TerrainZoneMarker[];
  selectedZoneId: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const beaconRefs = useRef<(THREE.Mesh | null)[]>([]);
  const elapsedRef = useRef(0);

  // Build contoured agricultural furrow geometry once and reuse
  const { surfaceGeo, wireGeo } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(6.4, 4.4, 34, 24);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const ridge = Math.sin(x * 1.15) * 0.22 + Math.cos(y * 1.35) * 0.16;
      const furrow = Math.sin(x * 3.8 + y * 0.6) * 0.045;
      pos.setZ(i, ridge + furrow);
    }
    geo.computeVertexNormals();
    return { surfaceGeo: geo, wireGeo: geo };
  }, []);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    elapsedRef.current += delta;
    if (groupRef.current) {
      groupRef.current.rotation.z = Math.sin(elapsedRef.current * 0.25) * 0.08;
    }
    beaconRefs.current.forEach((mesh, idx) => {
      if (!mesh) return;
      const s = 1 + Math.sin(elapsedRef.current * 2.4 + idx * 1.2) * 0.14;
      mesh.scale.setScalar(s);
    });
  });

  const surfaceColor = isDark ? "#243016" : "#DFECC6";
  const wireColor = isDark ? "#9AB556" : "#485C11";

  return (
    <group ref={groupRef} rotation={[-0.92, 0, 0.12]} position={[0, -0.15, 0]}>
      <mesh geometry={surfaceGeo} receiveShadow>
        <meshStandardMaterial
          color={surfaceColor}
          roughness={0.82}
          metalness={0.08}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh geometry={wireGeo} position={[0, 0, 0.012]}>
        <meshBasicMaterial color={wireColor} wireframe transparent opacity={0.34} />
      </mesh>

      {zones.map((zone, idx) => {
        const px = ((zone.xPct - 50) / 50) * 2.6;
        const py = -((zone.yPct - 50) / 50) * 1.7;
        const pz = Math.sin(px * 1.15) * 0.22 + Math.cos(py * 1.35) * 0.16 + 0.28;
        const active = zone.id === selectedZoneId;
        const color =
          zone.status === "ATTENTION"
            ? "#E0B243"
            : active
              ? "#9AB556"
              : "#485C11";

        return (
          <group key={zone.id} position={[px, py, pz]}>
            <mesh
              ref={(el) => {
                beaconRefs.current[idx] = el;
              }}
            >
              <sphereGeometry args={[active ? 0.14 : 0.1, 16, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={active ? 0.85 : 0.35}
              />
            </mesh>
            <mesh position={[0, 0, -0.16]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
              <meshBasicMaterial color={color} transparent opacity={0.65} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function FieldTerrain3D({
  zones,
  selectedZoneId,
  moistureAvg = 64,
}: FieldTerrain3DProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const webglReady = useSyncExternalStore(subscribeNoop, canUseWebGL, () => false);
  const reducedMotion = useSyncExternalStore(subscribeNoop, getReducedMotion, () => false);

  if (!webglReady) {
    return (
      <div
        data-testid="field-terrain-3d-fallback"
        className="bg-oklch-wash flex h-full w-full flex-col items-center justify-center p-6 text-center"
      >
        <p className="font-serif-display text-lg text-[var(--text-primary)]">
          3D Root-Zone Topographic Mesh
        </p>
        <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
          Mean volumetric moisture: {moistureAvg}% · {zones.length} active probe beacons
        </p>
      </div>
    );
  }

  return (
    <div data-testid="field-terrain-3d" className="h-full w-full bg-[var(--bg-bezel)]">
      <Suspense fallback={null}>
        <R3FCanvas
          dpr={[1, 2]}
          camera={{ position: [0, 1.8, 4.6], fov: 42 }}
          style={{ width: "100%", height: "100%" }}
        >
          <ambientLight intensity={isDark ? 0.75 : 1.05} />
          <directionalLight position={[4, 6, 4]} intensity={isDark ? 1.1 : 1.35} />
          <TerrainMesh
            isDark={isDark}
            reducedMotion={reducedMotion}
            zones={zones}
            selectedZoneId={selectedZoneId}
          />
        </R3FCanvas>
      </Suspense>
    </div>
  );
}
