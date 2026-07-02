import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient, AI_MODEL } from "./client";

export interface InboundEmail {
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  receivedAt?: string;
  hasAttachments?: boolean;
  attachmentNames?: string[];
}

export interface OpenCaseSummary {
  id: string;
  animalName: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  vetName: string | null;
  amount: number | null;
  situation: string | null;
}

const AnalysisSchema = z.object({
  kind: z.enum(["case_request", "receipt", "other"]).describe(
    "case_request: a rescue request describing an animal that needs financial help. " +
      "receipt: a payment receipt/invoice/confirmation from a vet or payment processor. " +
      "other: anything else (thank-you notes, questions, newsletters, spam)."
  ),
  caseRequest: z
    .object({
      animalName: z.string().nullable().describe("The animal's name, if given"),
      species: z.string().nullable().describe("dog, cat, etc."),
      breed: z.string().nullable(),
      situation: z
        .string()
        .describe(
          "1-3 sentence summary of what the animal needs help with (condition, procedure, urgency)"
        ),
      amount: z
        .number()
        .nullable()
        .describe("Approximate cost in USD mentioned in the email"),
      ownerName: z.string().nullable().describe("The animal owner's full name"),
      ownerEmail: z.string().nullable().describe("The animal owner's email address"),
      ownerPhone: z.string().nullable().describe("The animal owner's phone number"),
      vetName: z.string().nullable().describe("Vet clinic name, if mentioned"),
      vetPhone: z.string().nullable().describe("Vet clinic phone, if mentioned"),
    })
    .nullable()
    .describe("Filled in only when kind is case_request"),
  receipt: z
    .object({
      matchedCaseId: z
        .string()
        .nullable()
        .describe(
          "The id of the open case this receipt most likely belongs to, from the provided list. Null if no confident match."
        ),
      amount: z.number().nullable().describe("The receipt total in USD, if visible"),
      merchant: z.string().nullable().describe("Vet clinic / merchant name on the receipt"),
    })
    .nullable()
    .describe("Filled in only when kind is receipt"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("How confident you are in this classification"),
});

export type EmailAnalysis = z.infer<typeof AnalysisSchema>;

/**
 * Classify an inbound email and extract structured data in one pass.
 * Context (known PACC senders + open cases) sharpens both classification
 * and receipt→case matching.
 */
export async function analyzeInboundEmail(
  email: InboundEmail,
  context: {
    paccSenders: string[];
    openCases: OpenCaseSummary[];
  }
): Promise<EmailAnalysis> {
  const client = getAnthropicClient();

  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system: [
      "You analyze emails arriving at a dedicated inbox for the Rowley Family Charitable Giving Trust,",
      "which funds veterinary care for rescue animals referred by PACC 911 (an animal rescue organization).",
      "",
      "Typical case requests come from PACC 911 coordinators (often Bari or Doug) and describe an animal,",
      "what care it needs, roughly what it costs, and the owner's contact info.",
      "Receipts arrive from vet clinics or payment processors after the family pays for care.",
      "",
      "Known PACC 911 sender addresses: " +
        (context.paccSenders.length ? context.paccSenders.join(", ") : "(none configured yet)"),
      "An email from a known sender is very likely a case request, but judge by content —",
      "coordinators sometimes write from new addresses, and vets sometimes email receipts directly.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          "Analyze this email.",
          "",
          `From: ${email.from}`,
          `To: ${email.to}`,
          `Subject: ${email.subject}`,
          email.attachmentNames?.length
            ? `Attachments: ${email.attachmentNames.join(", ")}`
            : "Attachments: none",
          "",
          "Body:",
          '"""',
          email.bodyText.slice(0, 15000),
          '"""',
          "",
          "Open cases (for receipt matching):",
          context.openCases.length
            ? JSON.stringify(context.openCases, null, 2)
            : "(none)",
        ].join("\n"),
      },
    ],
    output_config: {
      format: zodOutputFormat(AnalysisSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Email analysis returned no structured output");
  }
  return response.parsed_output;
}
