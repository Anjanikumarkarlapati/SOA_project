"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Droplets,
  Sprout,
  Activity,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import {
  usePropertyWizard,
  useFarmStore,
  computeSensorRecommendations,
  type CropIntent,
} from "@/lib/property-store";
import { useAuthStore } from "@/lib/auth";
import { FarmMap } from "@/components/FarmMap";
import { Button } from "@/components/ui/Button";

const STEPS = [
  { num: 1, label: "Location",     icon: MapPin },
  { num: 2, label: "Water & Land", icon: Droplets },
  { num: 3, label: "Crop Intent",  icon: Sprout },
  { num: 4, label: "Sensors",      icon: Activity },
  { num: 5, label: "Review",       icon: CheckCircle2 },
] as const;

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center mb-8">
      {STEPS.map(({ num, icon: Icon }, idx) => (
        <React.Fragment key={num}>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors"
              style={{
                background:  step > num  ? "var(--accent)"    : step === num ? "var(--bg-raised)" : "var(--bg-base)",
                borderColor: step >= num ? "var(--accent)"    : "var(--border-default)",
                color:       step > num  ? "var(--on-accent)" : step === num ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {step > num ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
            </div>
            <span
              className="text-xs hidden sm:block"
              style={{ color: step >= num ? "var(--text-primary)" : "var(--text-secondary)" }}
            >
              {STEPS[idx].label}
            </span>
          </div>
          {num < 5 && (
            <div
              className="flex-1 h-0.5 mx-1 mt-[-1rem]"
              style={{ background: step > num ? "var(--accent)" : "var(--border-default)" }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
        style={{
          background: "var(--bg-raised)",
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = "Continue",
  hideBack = false,
  nextDisabled = false,
  loading = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  hideBack?: boolean;
  nextDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      {!hideBack && onBack ? (
        <Button
          label="Back"
          variant="secondary"
          size="sm"
          icon={<ChevronLeft className="w-4 h-4" />}
          onClick={onBack}
        />
      ) : (
        <div />
      )}
      <Button
        label={nextLabel}
        variant="primary"
        size="md"
        elevation="low"
        loading={loading}
        disabled={nextDisabled}
        endContent={!loading ? <ChevronRight className="w-4 h-4" /> : undefined}
        onClick={onNext}
      />
    </div>
  );
}

// Step 1 ──────────────────────────────────────────────────────────────────────
function Step1() {
  const { name, location, setName, setLocation, setStep } = usePropertyWizard();
  const [lat, setLat] = useState(location?.lat.toString() ?? "");
  const [lon, setLon] = useState(location?.lon.toString() ?? "");
  const [addr, setAddr] = useState(location?.address ?? "");
  const [area, setArea] = useState(location?.areaHa?.toString() ?? "");
  const [err, setErr] = useState("");

  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);
  const mapLat = !isNaN(parsedLat) && parsedLat >= -90 && parsedLat <= 90 ? parsedLat : 30.901;
  const mapLon = !isNaN(parsedLon) && parsedLon >= -180 && parsedLon <= 180 ? parsedLon : 75.857;

  const next = () => {
    if (!name.trim()) {
      setErr("Enter a farm name.");
      return;
    }
    const lt = parseFloat(lat);
    const ln = parseFloat(lon);
    if (isNaN(lt) || isNaN(ln) || lt < -90 || lt > 90 || ln < -180 || ln > 180) {
      setErr("Enter valid coordinates.");
      return;
    }
    setLocation({
      lat: lt,
      lon: ln,
      address: addr,
      country: "",
      region: "",
      areaHa: parseFloat(area) || 1,
    });
    setErr("");
    setStep(2);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Farm Location
      </h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Name your farm and set its coordinates or click directly on the interactive satellite map below.
      </p>
      {err && (
        <p className="text-sm" role="alert" style={{ color: "var(--status-critical)" }}>
          {err}
        </p>
      )}
      <Field label="Farm name *" value={name} onChange={setName} placeholder="My Wheat Farm" />
      <Field
        label="Address / landmark"
        value={addr}
        onChange={setAddr}
        placeholder="Village, District, State"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude *" value={lat} onChange={setLat} placeholder="28.6139" type="number" />
        <Field label="Longitude *" value={lon} onChange={setLon} placeholder="77.2090" type="number" />
      </div>
      <Field label="Farm area (hectares)" value={area} onChange={setArea} placeholder="2.5" type="number" />

      <div className="pt-2">
        <FarmMap
          lat={mapLat}
          lng={mapLon}
          farmName={name || "New Farm Parcel"}
          cropName="Field Parcel"
          areaHectares={parseFloat(area) || 2.0}
          onLocationChange={(loc) => {
            setLat(loc.lat.toFixed(4));
            setLon(loc.lng.toFixed(4));
            if (loc.address) setAddr(loc.address);
          }}
        />
      </div>

      <NavButtons hideBack onNext={next} />
    </div>
  );
}

// Step 2 ──────────────────────────────────────────────────────────────────────
function Step2() {
  const { water, setWater, setStep } = usePropertyWizard();
  const [err, setErr] = useState("");
  const next = () => {
    if (!water.waterSource) {
      setErr("Select a water source.");
      return;
    }
    setErr("");
    setStep(3);
  };

  const chip = (
    group: "waterSource" | "irrigationType" | "soilType",
    value: string,
    label?: string
  ) => {
    const active = water[group] === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setWater({ [group]: value } as never)}
        className="px-3 py-2 text-sm rounded-lg border capitalize transition-colors"
        style={{
          background:  active ? "var(--accent)"    : "var(--bg-raised)",
          borderColor: active ? "var(--accent)"    : "var(--border-default)",
          color:       active ? "var(--on-accent)" : "var(--text-primary)",
        }}
      >
        {label ?? value.replace("-", " ")}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Water &amp; Land Details
      </h2>
      {err && (
        <p className="text-sm" role="alert" style={{ color: "var(--status-critical)" }}>
          {err}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
          Primary water source *
        </label>
        <div className="grid grid-cols-2 gap-2">
          {["borewell", "canal", "rain-fed", "river"].map((v) => chip("waterSource", v))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
          Irrigation type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {["drip", "sprinkler", "flood", "none"].map((v) => chip("irrigationType", v))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
          Soil type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {["clay", "loam", "sandy", "silt", "black"].map((v) => chip("soilType", v))}
        </div>
      </div>

      <NavButtons onBack={() => setStep(1)} onNext={next} />
    </div>
  );
}

// Step 3 ──────────────────────────────────────────────────────────────────────
function Step3() {
  const { cropIntent, setCropIntent, setStep } = usePropertyWizard();
  const [prevInput, setPrevInput] = useState(cropIntent.previousCrops.join(", "));
  const [err, setErr] = useState("");

  const INTENTS: { value: CropIntent; label: string; desc: string }[] = [
    { value: "GROW_NOW",       label: "Grow now",           desc: "Current season — pick the best crop right now" },
    { value: "PLAN_SEASON",    label: "Plan a season",      desc: "Choose a specific date range or season" },
    { value: "RECOMMEND_BEST", label: "Recommend the best", desc: "Let the climate engine choose for maximum yield" },
  ];

  const next = () => {
    if (!cropIntent.intent) {
      setErr("Choose a crop intent.");
      return;
    }
    setCropIntent({
      previousCrops: prevInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setErr("");
    setStep(4);
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Crop Intent
      </h2>
      {err && (
        <p className="text-sm" role="alert" style={{ color: "var(--status-critical)" }}>
          {err}
        </p>
      )}

      <div className="space-y-2">
        {INTENTS.map(({ value, label, desc }) => {
          const active = cropIntent.intent === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setCropIntent({ intent: value })}
              className="w-full text-left px-4 py-3 rounded-lg border transition-colors"
              style={{
                background:  active ? "rgba(84,83,51,0.1)" : "var(--bg-raised)",
                borderColor: active ? "var(--accent)"       : "var(--border-default)",
              }}
            >
              <div
                className="text-sm font-medium"
                style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}
              >
                {label}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {desc}
              </div>
            </button>
          );
        })}
      </div>

      {cropIntent.intent === "PLAN_SEASON" && (
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="From"
            value={cropIntent.plannedDateStart ?? ""}
            onChange={(v) => setCropIntent({ plannedDateStart: v })}
            type="date"
          />
          <Field
            label="To"
            value={cropIntent.plannedDateEnd ?? ""}
            onChange={(v) => setCropIntent({ plannedDateEnd: v })}
            type="date"
          />
        </div>
      )}

      <Field
        label="Previously grown crops (comma-separated)"
        value={prevInput}
        onChange={setPrevInput}
        placeholder="Wheat, Rice"
      />
      <NavButtons onBack={() => setStep(2)} onNext={next} />
    </div>
  );
}

// Step 4 ──────────────────────────────────────────────────────────────────────
function Step4() {
  const { location, water, cropIntent, setSensorRecs, sensorRecs, setStep } = usePropertyWizard();

  React.useEffect(() => {
    const recs = computeSensorRecommendations(
      location?.areaHa ?? 1,
      water.waterSource,
      cropIntent.intent
    );
    setSensorRecs(recs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const PRIORITY_COLOR: Record<string, string> = {
    essential:   "var(--status-critical)",
    recommended: "var(--status-warning)",
    optional:    "var(--text-secondary)",
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Sensor Recommendations
      </h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Based on your farm area ({(location?.areaHa ?? 1).toFixed(1)} ha), {water.waterSource} water source, and crop intent.
      </p>

      <div className="space-y-3">
        {sensorRecs.map((r, i) => (
          <div
            key={i}
            className="rounded-lg border px-4 py-3"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {r.type}
                </span>
                <span className="text-sm ml-2" style={{ color: "var(--text-secondary)" }}>
                  ×{r.quantity}
                </span>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  Placement: {r.placement}
                </div>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full capitalize shrink-0"
                style={{
                  background: "var(--bg-raised)",
                  color: PRIORITY_COLOR[r.priority] ?? "var(--text-secondary)",
                }}
              >
                {r.priority}
              </span>
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
              {r.reason}
            </p>
          </div>
        ))}
      </div>

      <NavButtons onBack={() => setStep(3)} onNext={() => setStep(5)} nextLabel="Review & save" />
    </div>
  );
}

// Step 5 ──────────────────────────────────────────────────────────────────────
function Step5() {
  const { name, location, water, cropIntent, sensorRecs, setStep, reset } = usePropertyWizard();
  const addProperty = useFarmStore((s) => s.addProperty);
  const token = useAuthStore((s) => s.user?.token ?? "");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      await addProperty(
        {
          name,
          lat: location?.lat ?? 30.901,
          lon: location?.lon ?? 75.857,
          address: location?.address ?? "",
          areaHa: location?.areaHa ?? 1,
          waterSource: water.waterSource,
          irrigationType: water.irrigationType,
          soilType: water.soilType,
          cropIntent: cropIntent.intent,
          previousCrops: cropIntent.previousCrops,
          plannedSeason: cropIntent.plannedSeason,
          plannedDateStart: cropIntent.plannedDateStart,
          plannedDateEnd: cropIntent.plannedDateEnd,
          sensorRecs,
        },
        token
      );
      reset();
      router.push("/dashboard");
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const row = (label: string, value: string) => (
    <div
      key={label}
      className="flex gap-3 text-sm py-2 border-b last:border-0"
      style={{ borderColor: "var(--border-default)" }}
    >
      <span className="font-medium w-36 shrink-0" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span style={{ color: "var(--text-primary)" }}>{value || "—"}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Review &amp; Confirm
      </h2>
      {saveErr && (
        <div
          className="text-sm px-4 py-3 rounded-lg border"
          style={{
            background: "rgba(179,38,30,0.08)",
            borderColor: "rgba(179,38,30,0.3)",
            color: "var(--status-critical)",
          }}
        >
          {saveErr}
        </div>
      )}

      <div
        className="rounded-xl border p-4"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
      >
        {row("Farm name", name)}
        {row(
          "Coordinates",
          location ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : ""
        )}
        {row("Address", location?.address ?? "")}
        {row("Area", location?.areaHa ? `${location.areaHa} ha` : "")}
        {row("Water source", water.waterSource)}
        {row("Irrigation", water.irrigationType)}
        {row("Soil type", water.soilType)}
        {row("Crop intent", cropIntent.intent.replace("_", " "))}
        {row("Prev. crops", cropIntent.previousCrops.join(", "))}
        {row("Sensors recommended", `${sensorRecs.length} types`)}
      </div>

      <NavButtons
        onBack={() => setStep(4)}
        onNext={save}
        nextLabel="Confirm & save"
        loading={saving}
      />
    </div>
  );
}

// Page ────────────────────────────────────────────────────────────────────────
export default function NewPropertyPage() {
  const step = usePropertyWizard((s) => s.step);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1
        className="text-2xl font-semibold mb-2"
        style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}
      >
        Register a Farm
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Answer 4 quick steps to configure climate analysis and sensor recommendations for your land.
      </p>

      <ProgressBar step={step} />

      <div
        className="rounded-2xl border p-6"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
      >
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
        {step === 4 && <Step4 />}
        {step === 5 && <Step5 />}
      </div>
    </div>
  );
}
