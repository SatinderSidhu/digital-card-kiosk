import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const TITLE = "Digital Card Kiosk";
const DESCRIPTION =
  "Self-service kiosk to build a digital business card in under a minute — snap a photo, scan a card or QR, pick a design, share via QR / SMS / email.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: TITLE,
  authors: [{ name: "Satinder Sidhu" }],
  keywords: [
    "digital business card",
    "kiosk",
    "QR code",
    "vCard",
    "Next.js",
    "OCR",
  ],
  // app/opengraph-image.tsx is auto-detected and added to images for both
  // openGraph and twitter blocks below — no need to list it explicitly.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: TITLE,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0f1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col overscroll-none select-none">
        {children}
      </body>
    </html>
  );
}
