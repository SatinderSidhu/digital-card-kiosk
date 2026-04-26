import { ImageResponse } from "next/og";
import QRCode from "qrcode";

export const alt =
  "Digital Card Kiosk — walk up, snap, scan, share your digital business card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  // The QR encodes the deployed site URL when one is configured; falls back
  // to the GitHub repo so the QR is always something meaningful.
  const linkTarget =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://github.com/SatinderSidhu/digital-card-kiosk";

  const qrModules = QRCode.create(linkTarget, {
    errorCorrectionLevel: "M",
  }).modules;
  const qrSize = qrModules.size;
  // qrcode's data is a 1D Uint8Array, indexed as y * size + x.
  const cellAt = (x: number, y: number) =>
    qrModules.data[y * qrSize + x] === 1;

  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < qrSize; y++) {
    for (let x = 0; x < qrSize; x++) {
      if (cellAt(x, y)) cells.push({ x, y });
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 56,
          background:
            "linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #0c4a6e 100%)",
          color: "white",
          fontFamily: '"Inter", system-ui, sans-serif',
          position: "relative",
        }}
      >
        {/* Soft purple blob */}
        <div
          style={{
            position: "absolute",
            top: -120,
            left: -90,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: "#8b5cf6",
            filter: "blur(120px)",
            opacity: 0.55,
          }}
        />
        {/* Soft cyan blob */}
        <div
          style={{
            position: "absolute",
            bottom: -130,
            right: -80,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: "#22d3ee",
            filter: "blur(120px)",
            opacity: 0.45,
          }}
        />

        {/* Header strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            position: "relative",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, #7c5cff, #22d3ee)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22">
              <rect
                x="2"
                y="2"
                width="18"
                height="18"
                rx="3"
                transform="rotate(45 11 11)"
                fill="white"
                opacity="0.95"
              />
            </svg>
          </div>
          <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.4 }}>
            Digital Card Kiosk
          </span>
        </div>

        {/* The Aurora card preview */}
        <div
          style={{
            display: "flex",
            flex: 1,
            marginTop: 32,
            padding: 32,
            gap: 32,
            borderRadius: 28,
            background:
              "linear-gradient(135deg, rgba(30,27,75,0.95) 0%, rgba(49,46,129,0.95) 50%, rgba(12,74,110,0.95) 100%)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 30px 80px -20px rgba(0,0,0,0.55)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Photo column */}
          <div
            style={{
              width: 260,
              display: "flex",
              flexDirection: "column",
              borderRadius: 18,
              border: "2px solid rgba(255,255,255,0.5)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.6)",
              fontSize: 16,
            }}
          >
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.1))",
                display: "flex",
              }}
            />
            <span style={{ marginTop: 16, letterSpacing: 1.5 }}>PHOTO</span>
          </div>

          {/* Info column */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 64,
                fontWeight: 700,
                letterSpacing: -1.2,
                lineHeight: 1.05,
              }}
            >
              Your Name
            </span>
            <span
              style={{
                fontSize: 30,
                fontWeight: 500,
                color: "rgba(255,255,255,0.92)",
                marginTop: 6,
              }}
            >
              CEO
            </span>
            <span
              style={{
                fontSize: 22,
                color: "rgba(255,255,255,0.6)",
                marginTop: 2,
              }}
            >
              Your Company
            </span>

            <div
              style={{
                height: 2,
                background: "rgba(255,255,255,0.2)",
                borderRadius: 2,
                margin: "22px 0 18px",
                display: "flex",
              }}
            />

            <div
              style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22, marginBottom: 8 }}
            >
              <span style={{ opacity: 0.75 }}>📞</span>
              <span>+1 555 0123</span>
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22, marginBottom: 8 }}
            >
              <span style={{ opacity: 0.75 }}>✉</span>
              <span>you@example.com</span>
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22 }}
            >
              <span style={{ opacity: 0.75 }}>🌐</span>
              <span>example.com</span>
            </div>

            <span
              style={{
                marginTop: "auto",
                fontSize: 14,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              Digital Card
            </span>
          </div>

          {/* QR column */}
          <div
            style={{
              width: 260,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 240,
                height: 240,
                borderRadius: 18,
                background: "white",
                padding: 16,
                display: "flex",
              }}
            >
              <svg
                width="208"
                height="208"
                viewBox={`0 0 ${qrSize} ${qrSize}`}
                xmlns="http://www.w3.org/2000/svg"
                shapeRendering="crispEdges"
              >
                {cells.map((c, i) => (
                  <rect
                    key={i}
                    x={c.x}
                    y={c.y}
                    width="1"
                    height="1"
                    fill="#000"
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* Tagline */}
        <span
          style={{
            marginTop: 28,
            fontSize: 22,
            color: "rgba(255,255,255,0.78)",
            textAlign: "center",
            alignSelf: "center",
            letterSpacing: 0.2,
          }}
        >
          Walk up · Snap · Scan · Share — six designs, QR + SMS + email
        </span>
      </div>
    ),
    {
      ...size,
    },
  );
}
