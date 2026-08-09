import { networkInterfaces } from "os";
import type { NextConfig } from "next";

/**
 * `next dev` gets started bound to 0.0.0.0 (not just localhost) so a
 * Simulator/physical device on the LAN can reach it -- but Next's dev
 * server only allows dev-tooling requests (HMR socket, RSC dev endpoints)
 * from origins it recognizes, and the Mac's LAN IP isn't one of them by
 * default. Left unset, that browser session loads a page whose scripts
 * never fully take over -- forms silently fall back to native HTML GET
 * submission instead of running the React handlers/Server Actions that
 * should have handled them (found via the mobile calendar-connect bridge:
 * the Apple Calendar form submitted as a GET with the password in the
 * query string instead of calling connectAppleCalendar).
 *
 * Resolved from the network interfaces at dev-server startup rather than
 * hardcoded, since the Mac's LAN IP drifts across sessions (DHCP lease
 * renewal, network switch) -- see areta-mobile's run-app skill for the
 * same staleness problem on the mobile side. No effect in production
 * (Vercel doesn't run `next dev`), so this is dev-only surface area.
 */
function currentLanIPv4Addresses(): string[] {
  const addresses: string[] = [];
  for (const iface of Object.values(networkInterfaces())) {
    for (const info of iface ?? []) {
      if (info.family === "IPv4" && !info.internal) {
        addresses.push(info.address);
      }
    }
  }
  return addresses;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: currentLanIPv4Addresses(),
  images: {
    // Recipe photos live in the `recipe-photos` Supabase Storage bucket
    // (see scripts/backfill-recipe-photos.ts), served from this project's
    // own Supabase host -- greenfield, no other remote image host is used
    // anywhere in the app yet.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "eqzrvidshghwvbycdvqi.supabase.co",
        pathname: "/storage/v1/object/public/recipe-photos/**",
      },
    ],
  },
};

export default nextConfig;
