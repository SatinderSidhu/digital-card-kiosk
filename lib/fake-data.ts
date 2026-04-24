import type { CardDetails } from "./types";

export const FAKE_CARD: CardDetails = {
  fullName: "Your Name",
  title: "CEO",
  company: "Your Company",
  phone: "+1 555 0123",
  email: "you@example.com",
  website: "example.com",
};

/**
 * Returns a CardDetails where any empty field is filled from FAKE_CARD.
 * Use for template previews before the user has entered real data.
 */
export function withFallback(details: CardDetails): CardDetails {
  return {
    fullName: details.fullName || FAKE_CARD.fullName,
    title: details.title || FAKE_CARD.title,
    company: details.company || FAKE_CARD.company,
    phone: details.phone || FAKE_CARD.phone,
    email: details.email || FAKE_CARD.email,
    website: details.website || FAKE_CARD.website,
  };
}

export function hasRealDetails(details: CardDetails): boolean {
  return details.fullName.trim().length > 0;
}
