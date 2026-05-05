"use client";

import { motion } from "framer-motion";

type Props = {
  name: string;
  title?: string;
  showLive?: boolean;
};

/**
 * Broadcast-style lower-third — slides in from the left with a red accent
 * stripe and an optional pulsing LIVE badge. Sized to look right inside the
 * 16:9 video frame on the kiosk.
 */
export function LowerThird({ name, title, showLive = true }: Props) {
  if (!name?.trim()) return null;

  return (
    <motion.div
      initial={{ x: "-110%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.4, type: "spring", stiffness: 160, damping: 22 }}
      className="absolute left-0 right-16 z-10 flex items-stretch shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)]"
      style={{ bottom: "12%" }}
    >
      {/* Red accent stripe — the colour bar that "anchors" CNN/BBC chyrons. */}
      <div className="w-[3px] bg-gradient-to-b from-[#ef4444] via-[#dc2626] to-[#7c5cff]" />

      <div className="flex-1 bg-gradient-to-r from-black/90 via-black/75 to-black/0 backdrop-blur-sm pl-3 pr-8 py-2">
        <div className="flex items-center gap-2">
          <span className="text-white text-base sm:text-lg font-bold leading-tight tracking-tight truncate">
            {name}
          </span>
          {showLive && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-red-600 text-white text-[8px] font-bold uppercase tracking-[0.15em] shrink-0">
              <motion.span
                animate={{ opacity: [0.35, 1, 0.35] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="block w-1 h-1 rounded-full bg-white"
              />
              Live
            </span>
          )}
        </div>
        {title?.trim() && (
          <div className="text-white/80 text-[10px] sm:text-xs uppercase tracking-[0.18em] font-medium leading-tight mt-0.5 truncate">
            {title}
          </div>
        )}
      </div>
    </motion.div>
  );
}
