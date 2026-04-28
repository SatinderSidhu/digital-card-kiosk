import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
// The model + base64 round-trip means generate calls take 5–15 s; default
// route timeout is 10 s, so bump it.
export const maxDuration = 60;

const PROMPT = `Re-light this photo as a professional LinkedIn-style headshot of the SAME person.

Hard rules — do not break these:
- Preserve the person's identity exactly: same face shape, eye colour, eye shape, eyebrows, skin tone, hair, beard / facial hair, expression, age, and gender.
- Do NOT add anything that is not already in the original photo. Specifically: do NOT add glasses, hats, jewelry, ties, facial hair, makeup, or any clothing items. Only add an item if it is clearly visible in the original.
- Do NOT change the clothing style or colour. Keep the same outfit.
- Do NOT alter the framing or pose. Keep the head and shoulders in the same position.

What to improve:
- Lighting: soft, even, balanced studio lighting. Remove harsh shadows, colour casts, and blown-out highlights.
- Skin: keep natural texture. Do not airbrush, smooth, or plasticise the skin.
- Sharpness: gently sharpen the eyes and hair without over-processing.
- Background: replace the existing background with a clean neutral grey, soft gradient, or out-of-focus office tone. Keep the person fully in frame.

Output a single edited photograph of the same person. No collage, no text, no logos.`;

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
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            { text: PROMPT },
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
