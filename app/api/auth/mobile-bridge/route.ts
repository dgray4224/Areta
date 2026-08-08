import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { createMobileBridgeCode } from "@/platform/auth/mobile-bridge-codes";

const bodySchema = z.object({ refreshToken: z.string().min(1) });

/**
 * Mints a one-time mobile-bridge code (platform/auth/mobile-bridge-codes.ts).
 * The access token is already proven valid by authenticateBearerRequest
 * (it's the same token in the Authorization header) -- only the refresh
 * token needs to come from the request body.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader!.slice("Bearer ".length);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing refreshToken" }, { status: 400 });
  }

  const code = await createMobileBridgeCode(auth.userId, accessToken, parsed.data.refreshToken);
  return NextResponse.json({ code });
}
