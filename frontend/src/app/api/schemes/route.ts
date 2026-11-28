import { NextRequest, NextResponse } from "next/server";
import {
  AGRISTACK_CHECKLIST_ITEMS,
  getSchemesCatalog,
} from "@/lib/schemes-data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stateCode = (searchParams.get("stateCode") ?? "OD").trim().toUpperCase().slice(0, 8) || "OD";
  const schemes = getSchemesCatalog(stateCode);

  return NextResponse.json({
    stateCode,
    centralSchemes: schemes.filter((s) => s.scope === "central"),
    stateSchemes: schemes.filter((s) => s.scope === "state"),
    schemes,
    agristackChecklist: AGRISTACK_CHECKLIST_ITEMS,
    updatedAt: new Date().toISOString(),
  });
}
