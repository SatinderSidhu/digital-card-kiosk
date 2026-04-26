import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
// The model + base64 round-trip means generate calls take 5–15 s; default
// route timeout is 10 s, so bump it.
export const maxDuration = 60;

const PROMPT = `Convert this photo into a professional studio headshot of the same person.
Preserve the subject's identity exactly — same face, hair, glasses, expression, and clothing colour.
Improve lighting (soft, even, studio quality), gently sharpen features without smoothing skin away,
and replace the background with a clean neutral colour or subtle gradient.
Output a single image only.`;

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
    const message =
      err instanceof Error ? err.message : "Gemini request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
