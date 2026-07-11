import { GoogleGenAI, Modality } from "@google/genai";
import { getAi } from "../client";

export async function generateImage(
  prompt: string
): Promise<{ b64_json: string; mimeType: string }> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-preview-image-generation",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }

  return {
    b64_json: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}

export const ai = new Proxy({} as GoogleGenAI, {
  get(_t, prop, receiver) {
    return Reflect.get(getAi(), prop, receiver);
  },
});
