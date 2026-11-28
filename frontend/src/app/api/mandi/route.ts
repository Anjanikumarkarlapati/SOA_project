import { NextRequest, NextResponse } from "next/server";
import {
  MSP_BENCHMARKS_2025_26,
  getMandiRatesForLocation,
} from "@/lib/mandi-data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stateCode = (searchParams.get("stateCode") ?? "OD").trim().slice(0, 8);
  const district = (searchParams.get("district") ?? "").trim().slice(0, 64) || undefined;
  const crop = (searchParams.get("crop") ?? "").trim().slice(0, 48) || undefined;

  const rates = getMandiRatesForLocation(stateCode, district, crop);
  return NextResponse.json({
    rates,
    mspBenchmarks: MSP_BENCHMARKS_2025_26,
    updatedAt: new Date().toISOString(),
  });
}
