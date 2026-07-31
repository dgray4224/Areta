import { ImageResponse } from "next/og";

export const alt = "Areta — Become more of who you are";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f0e7",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div
            style={{
              display: "flex",
              width: 160,
              height: 160,
              borderRadius: 40,
              background: "#c85a3a",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="96" height="96" viewBox="0 0 64 64" fill="none">
              <path
                d="M32 14 L48 50 L39 50 L35.5 41.5 L28.5 41.5 L25 50 L16 50 Z"
                fill="#1c130f"
              />
              <rect x="27" y="37" width="10" height="5" fill="#c85a3a" />
            </svg>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 128,
              fontWeight: 700,
              color: "#1c130f",
              letterSpacing: "-0.02em",
            }}
          >
            Areta
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: "#7a6f63" }}>
          Become more of who you are
        </div>
      </div>
    ),
    { ...size }
  );
}
