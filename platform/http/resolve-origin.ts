import type { NextRequest } from "next/server";

/**
 * `request.url`/`request.nextUrl` reflect the server's own bind address
 * (0.0.0.0) rather than the Host header a real client connected with when
 * `next dev` is started with `-H 0.0.0.0` (required so a Simulator/device
 * on the LAN can reach it). Building an OAuth redirect_uri from
 * request.url in that setup sends Google/Microsoft's token exchange a
 * redirect_uri that doesn't match the one used at the authorize step
 * (platform/auth/session.ts's callers build that one from the real Origin
 * header instead), so the exchange fails outright rather than just
 * redirecting somewhere unreachable. The Host header (or
 * x-forwarded-host/-proto behind Vercel's proxy in production) always
 * reflects what the client actually connected to. See also
 * app/auth/mobile-bridge/route.ts, which had the same bug.
 */
export function resolveOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}
