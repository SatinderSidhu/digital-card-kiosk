"use client";

import clsx from "clsx";

type Props = {
  className?: string;
};

const PROMO_VIDEO_URL =
  "https://kitlabs-app-factory-promo-video.s3.us-east-1.amazonaws.com/DigitalCardPromo.mp4";

/**
 * Promotional video — bottom half of the kiosk display. Plays muted in an
 * autoplay loop so it runs continuously while customers build their card on
 * the top half. Sound is intentionally off because autoplay-with-sound is
 * blocked by every modern browser, and a kiosk's audio is usually
 * system-managed anyway.
 *
 * The dark gradient backdrop stays as a fallback for the brief moment
 * before the video buffers (and as a graceful failure mode if the S3
 * object ever isn't reachable).
 */
export function MarketingSlot({ className }: Props) {
  return (
    <section
      className={clsx(
        "relative w-full overflow-hidden border-t border-white/10",
        "bg-gradient-to-br from-[#0f1530] via-[#1a1038] to-[#0b1628]",
        className,
      )}
    >
      <video
        src={PROMO_VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
      />
    </section>
  );
}
