import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: "AIzaSyA_NQ6AvRyuoy1sQVL7uLwIjXv3EFE-Nqc",
});

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "3 lines poem by arabic",
  });
  console.log(response.text);
}

await main();
