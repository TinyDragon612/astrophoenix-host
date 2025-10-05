import OpenAI from "openai";
import "dotenv";

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true,
});

export default async function askGPT(prompt: string, sys: string, use: string) : Promise<string> {
  try {

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: use },
      ],
    });

    console.log(response.choices[0].message?.content?.trim() || "");
    return response.choices[0].message?.content?.trim() || "";
  } catch (err: any) {
    console.error("Error calling GPT:", err.message || err);
  }
  return "ERROR";
}
