import { getAnthropicClient, AI_MODEL } from "./client";
import type { RecapStats } from "@/lib/types";

/**
 * Write the narrative portion of the monthly family recap email:
 * a short, warm summary of the animals helped this month.
 */
export async function generateRecapNarrative(stats: RecapStats): Promise<string> {
  const client = getAnthropicClient();

  const monthName = new Date(stats.month + "-15").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 1200,
    thinking: { type: "adaptive" },
    system: [
      "You write the monthly giving recap for the Rowley Family Charitable Giving Trust,",
      "sent to family members. The trust pays veterinary bills for rescue animals referred by PACC 911.",
      "",
      "Write 2-4 short paragraphs of plain text (no markdown, no headers):",
      "- Open with the month's headline: how many animals helped and the total given.",
      "- Tell the story of one or two specific cases with warmth and a light touch.",
      "- If there are none this month, say so gracefully.",
      "- Close with the year-to-date picture in one sentence.",
      "Do not invent details that aren't in the data. Do not include a greeting or sign-off —",
      "the email template adds those.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: `Write the recap narrative for ${monthName}.\n\nData:\n${JSON.stringify(stats, null, 2)}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("Recap generation returned no text");
  }
  return text.text.trim();
}
