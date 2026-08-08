import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getConnections } from "@/domains/calendar/connections-service";
import { isProviderConfigured } from "@/platform/calendar/get-provider";
import type { CalendarProviderId } from "@/platform/calendar/types";

const PROVIDERS: CalendarProviderId[] = ["google", "microsoft", "apple"];

/**
 * Bearer-authenticated read endpoint for the mobile Settings > Calendar
 * screen -- same getConnections the web Settings page calls, plus whether
 * each provider is configured server-side (missing client id/secret env
 * vars shows as "Not available" rather than a broken Connect button).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }

  const connections = await getConnections(auth.userId);
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  const providers = PROVIDERS.map((provider) => ({
    provider,
    configured: isProviderConfigured(provider),
    connection: byProvider.get(provider) ?? null,
  }));

  return NextResponse.json({ providers });
}
