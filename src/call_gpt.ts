import OpenAI from "openai";
import "dotenv";

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true,
});

export default async function askGPT(prompt: string, call_type: string) : Promise<string> {
  try {
    var sys = ""
    var use = ""

    switch (call_type) {
      case "classify":
        sys = "Classify whether the user is asking a question or just generally searching for a specific paper. If the user is asking a question, return, in all lowercase, 'question'. If the user is searching for a specific paper, return, in all lowercase, 'search'."
        use = prompt
        break;
      case "summarize":
        sys = "You are a concise, factual assistant. Your job is to summarize and help people learn about papers on Space Biology."
        use = "Summarize the following paper(s): " + prompt
        break;
      case "question":
        sys = "You are a concise, factual assistant. Your job is to summarize and help people learn about papers on Space Biology."
        use = "The user asked: " + prompt + "\n These are the paper(s) in question: [refer to paper(s)]"
        break;
    }

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

// Run when called directly from CLI
/*if (process.argv[2]) {
  askGPT(process.argv.slice(2).join(" "), "");
} else {
  console.log("Usage: tsx call_gpt.ts 'your question here'");
}*/
