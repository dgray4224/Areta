import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { calendarProviderIdSchema } from "@/domains/calendar/schema";
import { disconnectConnection } from "@/domains/calendar/connections-service";

const bodySchema = z.object({ provider: calendarProviderIdSchema });

/** Bearer-authenticated mirror of the web Settings page's disconnectCalendar
 * server action -- lets the mobile app disconnect a provider natively
 * without reopening the in-app browser bridge. */
export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid provider" }, { status: 400 });
  }

  await disconnectConnection(auth.userId, parsed.data.provider);
  return NextResponse.json({ ok: true });
}
