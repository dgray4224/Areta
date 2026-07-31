import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS "Add to Home Screen" reads this specifically — icon.svg only covers
 * the browser-tab favicon. Full-bleed square, no pre-rounded corners: iOS
 * applies its own rounded-square mask on top, so baking in rx here would
 * just double it up. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#c85a3a",
        }}
      >
        <svg width="108" height="108" viewBox="0 0 64 64" fill="none">
          <path
            d="M32 14 L48 50 L39 50 L35.5 41.5 L28.5 41.5 L25 50 L16 50 Z"
            fill="#1c130f"
          />
          <rect x="27" y="37" width="10" height="5" fill="#c85a3a" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
