import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { lookupBarcode } from "@/domains/nutrition/barcode-service";

/**
 * Bearer-token-authenticated barcode-to-nutrition lookup for the mobile
 * Nutrition tab's barcode scanner. Proxies Open Food Facts server-side so
 * the mobile client never calls a third-party API directly (rate limits,
 * no API key to manage on-device). Returns per-100g values -- the client
 * scales by the quantity the user confirms before logging.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }

  const upc = request.nextUrl.searchParams.get("upc");
  if (!upc || !/^\d{6,14}$/.test(upc)) {
    return NextResponse.json({ error: "upc (a 6-14 digit numeric string) is required" }, { status: 400 });
  }

  const result = await lookupBarcode(upc);
  return NextResponse.json(result);
}
