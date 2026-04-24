import type { CardDetails } from "./types";

export function buildVcard(d: CardDetails, sessionId: string): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    d.fullName && `FN:${d.fullName}`,
    d.title && `TITLE:${d.title}`,
    d.company && `ORG:${d.company}`,
    d.phone && `TEL;TYPE=CELL:${d.phone}`,
    d.email && `EMAIL:${d.email}`,
    d.website && `URL:${d.website}`,
    `NOTE:session=${sessionId}`,
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\n");
}
