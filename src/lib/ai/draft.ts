import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient, AI_MODEL } from "./client";

export interface DraftInput {
  animalName: string | null;
  species: string | null;
  breed: string | null;
  situation: string | null;
  amount: number | null;
  ownerName: string | null;
  vetName: string | null;
  signature: string | null;
}

const DraftSchema = z.object({
  subject: z.string().describe("Email subject line"),
  body: z.string().describe("Plain-text email body, ready to send"),
});

export type OwnerDraft = z.infer<typeof DraftSchema>;

/**
 * Write the warm, personalized introduction email to the animal's owner.
 * Created for every new case on the assumption it will be accepted;
 * Chelsea reviews it in Gmail and hits send (or deletes it for denials).
 */
export async function generateOwnerDraft(input: DraftInput): Promise<OwnerDraft> {
  const client = getAnthropicClient();

  const animal = input.animalName || "your pet";
  const firstName = input.ownerName?.split(" ")[0] || null;

  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 1500,
    thinking: { type: "adaptive" },
    system: [
      "You write introduction emails on behalf of Chelsea, who handles charitable giving for the",
      "Rowley Family Charitable Giving Trust. PACC 911 (an animal rescue) refers owners whose animals",
      "need veterinary care they can't afford, and the trust pays the vet directly.",
      "",
      "This email is the owner's first contact with the family. It should:",
      "1. Introduce Chelsea and the Rowley Family Charitable Giving Trust, mentioning that PACC 911 shared their situation.",
      "2. Say clearly that the family would love to help cover the cost of the animal's care.",
      "3. Reference the animal and its situation specifically and warmly — this is a real family who is worried about their pet. Acknowledge that without being melodramatic.",
      "4. Explain the one thing needed from the owner: add Chelsea to the animal's account at the vet clinic so the trust can pay for the procedure or medications directly.",
      "5. Invite them to reply with any questions, or to confirm once Chelsea has been added.",
      "",
      "Voice: warm, personal, plain-spoken, hopeful. Like a kind neighbor, not a foundation.",
      "Keep it short — under 180 words. No placeholders or brackets: if a detail is unknown,",
      "write around it naturally. Plain text only, no markdown.",
      "Sign off with the provided signature exactly as given.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          "Write the introduction email for this case:",
          "",
          `Animal: ${animal}${input.species ? ` (${[input.breed, input.species].filter(Boolean).join(" ")})` : ""}`,
          `Situation: ${input.situation || "needs veterinary care"}`,
          `Approximate cost: ${input.amount != null ? `$${input.amount}` : "not specified"}`,
          `Owner: ${input.ownerName || "unknown"}${firstName ? ` (address them as ${firstName})` : ""}`,
          `Vet clinic: ${input.vetName || "not specified — refer to it as “your vet”"}`,
          "",
          `Signature to use:\n${input.signature || "Warmly,\nChelsea\nRowley Family Charitable Giving Trust"}`,
        ].join("\n"),
      },
    ],
    output_config: {
      format: zodOutputFormat(DraftSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Draft generation returned no structured output");
  }
  return response.parsed_output;
}
