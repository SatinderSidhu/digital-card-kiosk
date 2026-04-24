import type { CardDetails } from "./types";

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/i;
const URL_RE = /(https?:\/\/[^\s]+|(?:www\.)?[a-z0-9-]+\.(?:com|net|org|io|co|ai|dev|app|me)[^\s]*)/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

export function parseCardText(raw: string): Partial<CardDetails> {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let email = "";
  let phone = "";
  let website = "";
  const unused: string[] = [];

  for (const line of lines) {
    if (!email) {
      const m = line.match(EMAIL_RE);
      if (m) {
        email = m[0];
        continue;
      }
    }
    if (!phone) {
      const m = line.match(PHONE_RE);
      if (m) {
        phone = m[0].trim();
        continue;
      }
    }
    if (!website) {
      const m = line.match(URL_RE);
      if (m) {
        website = m[0];
        continue;
      }
    }
    unused.push(line);
  }

  const nameLine = unused.find((l) => /^[A-Z][a-z]+(?:\s+[A-Z][a-z'-]+){1,2}$/.test(l)) ?? unused[0] ?? "";
  const titleLine = unused.find(
    (l) =>
      /\b(CEO|CTO|COO|CFO|Manager|Director|Engineer|Designer|Founder|Head|Lead|President|Developer|Officer|Consultant|Owner)\b/i.test(
        l,
      ) && l !== nameLine,
  ) ?? "";
  const companyLine =
    unused.find(
      (l) =>
        l !== nameLine &&
        l !== titleLine &&
        /\b(Inc|LLC|Ltd|Corp|Corporation|Co\.|Company|Group|Studio|Labs|Solutions|Technologies|Tech|Systems)\b/i.test(
          l,
        ),
    ) ?? unused.find((l) => l !== nameLine && l !== titleLine) ?? "";

  return {
    fullName: nameLine,
    title: titleLine,
    company: companyLine,
    phone,
    email,
    website,
  };
}

export function parseVcard(raw: string): Partial<CardDetails> {
  const out: Partial<CardDetails> = {};
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || rest.length === 0) continue;
    const value = rest.join(":").trim();
    const key = rawKey.split(";")[0].toUpperCase();
    switch (key) {
      case "FN":
        out.fullName = value;
        break;
      case "N":
        if (!out.fullName) out.fullName = value.split(";").filter(Boolean).reverse().join(" ");
        break;
      case "TITLE":
        out.title = value;
        break;
      case "ORG":
        out.company = value.replace(/;/g, " ").trim();
        break;
      case "TEL":
        if (!out.phone) out.phone = value;
        break;
      case "EMAIL":
        if (!out.email) out.email = value;
        break;
      case "URL":
        if (!out.website) out.website = value;
        break;
    }
  }
  return out;
}

export function parseMecard(raw: string): Partial<CardDetails> {
  // MECARD:N:Doe,John;TEL:555...;EMAIL:j@x.com;URL:x.com;ORG:Acme;;
  const body = raw.replace(/^MECARD:/i, "").replace(/;;$/, "");
  const out: Partial<CardDetails> = {};
  for (const part of body.split(";")) {
    const [k, ...rest] = part.split(":");
    if (!k || rest.length === 0) continue;
    const value = rest.join(":").trim();
    const key = k.toUpperCase();
    if (key === "N") out.fullName = value.split(",").reverse().join(" ").trim();
    else if (key === "TEL") out.phone = value;
    else if (key === "EMAIL") out.email = value;
    else if (key === "URL") out.website = value;
    else if (key === "ORG") out.company = value;
    else if (key === "TITLE") out.title = value;
  }
  return out;
}

export function parseScannedCode(text: string): Partial<CardDetails> {
  const t = text.trim();
  if (/^BEGIN:VCARD/i.test(t)) return parseVcard(t);
  if (/^MECARD:/i.test(t)) return parseMecard(t);
  // fall back to plain text parse
  return parseCardText(t);
}
