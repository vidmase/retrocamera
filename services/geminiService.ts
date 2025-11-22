import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.API_KEY || '';

export const generateCaption = async (base64Image: string): Promise<string> => {
  if (!GEMINI_API_KEY) {
    console.warn("No API Key provided for Gemini.");
    return "Memories captured in time...";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    // Extract actual base64 data if it contains the prefix
    const cleanBase64 = base64Image.includes('base64,') 
      ? base64Image.split('base64,')[1] 
      : base64Image;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: "Generate a very short, nostalgic, handwritten-style caption (max 6 words) for this polaroid photo. It should feel like a memory from the 80s or 90s. Return only the text."
          }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 0 }, // Disable thinking for speed
        temperature: 0.7,
      }
    });

    return response.text.trim() || "A beautiful moment.";
  } catch (error) {
    console.error("Gemini caption generation failed:", error);
    return "Captured moment #84";
  }
};