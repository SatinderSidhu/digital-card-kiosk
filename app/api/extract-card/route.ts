import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 30;

const PROMPT = `You are extracting contact information from a single business card photograph.

Rules:
- Output JSON only — no commentary, no markdown.
- For any field you cannot read, return an empty string ("") — do not guess.
- Strip prefixes like "Tel:", "Mobile:", "Email:", "Web:", "www." — return just the value.
- Preserve the formatting the card uses for phone numbers (don't normalize spaces / dashes).
- For website, drop "https://" / "http://" but keep the rest as written.
- "fullName" is the person's name. "title" is their role / position. "company" is the organisation.
- If the card lists multiple phones / emails, pick the primary (usually the first or the one labelled "office" / "mobile").`;

type CardSchema = {
  fullName: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
};

type ImageBody = { image?: string };

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is not configured on the server. Set it in your Amplify (or local .env) environment variables.",
      },
      { status: 503 },
    );
  }

  let body: ImageBody;
  try {
    body = (await req.json()) as ImageBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const image = body.image;
  if (typeof image !== "string" || !image) {
    return NextResponse.json(
      { error: "Body must include an `image` data URL." },
      { status: 400 },
    );
  }

  const match = image.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json(
      { error: "Image must be a base64 data URL." },
      { status: 400 },
    );
  }
  const [, mimeType, base64Data] = match;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: PROMPT },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullName: { type: Type.STRING },
            title: { type: Type.STRING },
            company: { type: Type.STRING },
            phone: { type: Type.STRING },
            email: { type: Type.STRING },
            website: { type: Type.STRING },
          },
          required: [
            "fullName",
            "title",
            "company",
            "phone",
            "email",
            "website",
          ],
          propertyOrdering: [
            "fullName",
            "title",
            "company",
            "phone",
            "email",
            "website",
          ],
        },
      },
    });

    const raw = response.text;
    if (!raw) {
      return NextResponse.json(
        { error: "Gemini did not return any text for this card." },
        { status: 502 },
      );
    }

    let parsed: CardSchema;
    try {
      parsed = JSON.parse(raw) as CardSchema;
    } catch {
      return NextResponse.json(
        { error: "Gemini returned a non-JSON response." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      details: {
        fullName: parsed.fullName ?? "",
        title: parsed.title ?? "",
        company: parsed.company ?? "",
        phone: parsed.phone ?? "",
        email: parsed.email ?? "",
        website: parsed.website ?? "",
      },
    });
  } catch (err) {
    let message = "Gemini request failed.";
    let status = 502;
    if (err instanceof Error) {
      message = err.message;
      try {
        const parsed = JSON.parse(err.message) as {
          error?: { message?: string; code?: number };
        };
        if (parsed.error?.message) message = parsed.error.message;
        if (parsed.error?.code === 429) status = 429;
        else if (parsed.error?.code === 401 || parsed.error?.code === 403)
          status = parsed.error.code;
      } catch {
        // err.message wasn't JSON; keep it as-is.
      }
    }
    return NextResponse.json({ error: message }, { status });
  }
}
