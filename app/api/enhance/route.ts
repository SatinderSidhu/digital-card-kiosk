import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
// The model + base64 round-trip means generate calls take 5–15 s; default
// route timeout is 10 s, so bump it.
export const maxDuration = 60;

type PolishStyle = {
  outfit?: "keep" | "suit" | "blazer" | "smart-casual";
  eyewear?: "keep" | "add" | "remove";
  background?: "neutral" | "soft-blue" | "warm" | "office-blur";
  mood?: "balanced" | "friendly" | "confident" | "approachable";
};

const BASE_PROMPT = `Re-light this photo as a professional LinkedIn-style headshot of the SAME person.

Hard rules — do not break these:
- Preserve the person's identity exactly: same face shape, eye colour, eye shape, eyebrows, skin tone, hair, beard / facial hair, age, and gender.
- Keep the head and shoulders in the same position. Do NOT alter the framing or pose.
- Do NOT alter the clothing UNLESS specifically instructed in the style overrides below.
- Do NOT add eyewear, hats, jewelry, ties, or makeup UNLESS specifically instructed in the style overrides below.
- Keep the natural facial expression. Do not exaggerate the smile or change the mouth shape; tone changes should come from lighting and colour, not from morphing the face.

What to improve:
- Lighting: soft, even, balanced studio lighting. Remove harsh shadows, colour casts, and blown-out highlights.
- Skin: keep natural texture. Do not airbrush, smooth, or plasticise the skin.
- Sharpness: gently sharpen the eyes and hair without over-processing.

Output a single edited photograph of the same person. No collage, no text, no logos.`;

function buildStylePrompt(style: PolishStyle | undefined): string {
  if (!style) return "";
  const parts: string[] = [];

  switch (style.outfit) {
    case "suit":
      parts.push(
        "- Replace the visible upper-body clothing with a clean dark business suit jacket over a crisp white shirt. Keep the body shape and shoulders identical.",
      );
      break;
    case "blazer":
      parts.push(
        "- Replace the visible upper-body clothing with a tailored neutral-tone blazer (no tie). Keep the body shape and shoulders identical.",
      );
      break;
    case "smart-casual":
      parts.push(
        "- Replace the visible upper-body clothing with a smart business-casual collared shirt in a muted tone. Keep the body shape and shoulders identical.",
      );
      break;
  }

  switch (style.eyewear) {
    case "add":
      parts.push(
        "- Add modern, clean rimmed eyeglasses that fit the face naturally. Lenses must be transparent — do not obscure the eyes.",
      );
      break;
    case "remove":
      parts.push("- Remove any glasses from the face if present.");
      break;
  }

  switch (style.background) {
    case "soft-blue":
      parts.push(
        "- Replace the background with a soft blue gradient suited for a corporate headshot.",
      );
      break;
    case "warm":
      parts.push(
        "- Replace the background with a warm, soft beige or cream gradient.",
      );
      break;
    case "office-blur":
      parts.push(
        "- Replace the background with a tasteful, blurred modern office scene (shallow depth of field).",
      );
      break;
    case "neutral":
    default:
      parts.push(
        "- Replace the background with a clean neutral grey, evenly lit and free of clutter.",
      );
      break;
  }

  switch (style.mood) {
    case "friendly":
      parts.push(
        "- Lighting tone: warm and friendly — slightly warm colour temperature, soft fill light. Do not change the expression.",
      );
      break;
    case "confident":
      parts.push(
        "- Lighting tone: bold and confident — slightly higher contrast and a defined key light. Do not change the expression.",
      );
      break;
    case "approachable":
      parts.push(
        "- Lighting tone: approachable — even diffuse light with a gentle warm cast. Do not change the expression.",
      );
      break;
    case "balanced":
    default:
      parts.push(
        "- Lighting tone: clean and balanced — neutral colour temperature, even soft lighting.",
      );
      break;
  }

  if (parts.length === 0) return "";
  return "\n\nStyle overrides — apply ONLY these changes:\n" + parts.join("\n");
}

type ImageBody = { image?: string; style?: PolishStyle };

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

  const fullPrompt = BASE_PROMPT + buildStylePrompt(body.style);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            { text: fullPrompt },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      // Surface any text the model returned so the kiosk can show why
      // (e.g. content policy, prompt mismatch).
      const textPart = parts.find((p) => p.text);
      return NextResponse.json(
        {
          error:
            textPart?.text ?? "Gemini did not return an image for this request.",
        },
        { status: 502 },
      );
    }

    const outMime = imagePart.inlineData.mimeType ?? "image/png";
    const outData = imagePart.inlineData.data;

    return NextResponse.json({
      image: `data:${outMime};base64,${outData}`,
    });
  } catch (err) {
    // The Gemini SDK throws Errors whose .message often contains the raw
    // JSON response. Pull the inner human-readable message out so the kiosk
    // shows "Quota exceeded..." instead of a 2 KB blob of nested JSON.
    let message = "Gemini request failed.";
    let status = 502;
    if (err instanceof Error) {
      message = err.message;
      try {
        const parsed = JSON.parse(err.message) as {
          error?: { message?: string; code?: number; status?: string };
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
