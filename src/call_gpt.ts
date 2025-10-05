import OpenAI from "openai";
import "dotenv/config";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function askGPT(prompt: string) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a concise, factual assistant. Your job is to summarize and help people learn about papers on Space Biology." },
        { role: "user", content: "This is the user's question: " + prompt },
      ],
    });

    console.log(response.choices[0].message?.content?.trim() || "");
  } catch (err: any) {
    console.error("Error calling GPT:", err.message || err);
  }
}

// Run when called directly from CLI
if (process.argv[2]) {
  askGPT(process.argv.slice(2).join(" "));
} else {
  console.log("Usage: tsx call_gpt.ts 'your question here'");
}
