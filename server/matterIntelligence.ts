import { enforceBillingEvidence, hasCompletedWorkEvidence, isSourceGrounded, type BillingCandidate } from "@shared/billing";
import { invokeLLM } from "./_core/llm";

export const MATTER_AI_MODEL = "gpt-5-mini";
export const MATTER_AI_PROMPT_VERSION = "matter-intelligence-billing-v1";

type EvidenceItem = {
  label: string;
  value: string;
  sourceQuote: string;
  confidence: number;
};

type VocabularyItem = EvidenceItem & {
  heardPhrase: string;
  approvedText: string;
};

export type MatterIntelligenceResult = {
  summary: string;
  facts: EvidenceItem[];
  entities: EvidenceItem[];
  dates: Array<EvidenceItem & { isDeadline: boolean }>;
  actions: EvidenceItem[];
  vocabulary: VocabularyItem[];
  billing: BillingCandidate[];
};

const evidenceProperties = {
  label: { type: "string" },
  value: { type: "string" },
  sourceQuote: { type: "string", description: "An exact quotation copied from the source text" },
  confidence: { type: "number", minimum: 0, maximum: 1 },
};

const evidenceRequired = ["label", "value", "sourceQuote", "confidence"];

const responseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    facts: { type: "array", items: { type: "object", properties: evidenceProperties, required: evidenceRequired, additionalProperties: false } },
    entities: { type: "array", items: { type: "object", properties: evidenceProperties, required: evidenceRequired, additionalProperties: false } },
    dates: { type: "array", items: { type: "object", properties: { ...evidenceProperties, isDeadline: { type: "boolean" } }, required: [...evidenceRequired, "isDeadline"], additionalProperties: false } },
    actions: { type: "array", items: { type: "object", properties: evidenceProperties, required: evidenceRequired, additionalProperties: false } },
    vocabulary: { type: "array", items: { type: "object", properties: { ...evidenceProperties, heardPhrase: { type: "string" }, approvedText: { type: "string" } }, required: [...evidenceRequired, "heardPhrase", "approvedText"], additionalProperties: false } },
    billing: {
      type: "array",
      items: {
        type: "object",
        properties: {
          activityCode: { type: "string", enum: ["COMMUNICATION", "DRAFTING", "REVIEW", "RESEARCH", "COURT", "NEGOTIATION", "ADMIN", "OTHER"] },
          narrative: { type: "string" },
          sourceQuote: { type: "string", description: "An exact quotation proving the work occurred" },
          explicitDurationText: { type: "string", description: "Exact stated duration or an empty string" },
          durationSeconds: { type: ["integer", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["activityCode", "narrative", "sourceQuote", "explicitDurationText", "durationSeconds", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "facts", "entities", "dates", "actions", "vocabulary", "billing"],
  additionalProperties: false,
};

function grounded<T extends { sourceQuote: string }>(source: string, items: T[]) {
  return items.filter(item => isSourceGrounded(source, item.sourceQuote));
}

export async function analyzeMatterText(input: {
  matterName: string;
  matterNumber: string;
  clientName: string;
  jurisdiction: string;
  content: string;
}) {
  const response = await invokeLLM({
    model: MATTER_AI_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You are CounselScribe's attorney-controlled matter intelligence extractor.",
          "Return only source-grounded structured data. Every item must include an exact quote copied from the supplied text.",
          "Do not provide legal advice, decide legal significance, or invent facts, deadlines, tasks, work performed, or elapsed time.",
          "A billing candidate is allowed only when the source states that work was actually performed. A request, plan, deadline, or future task belongs in actions but never in billing.",
          "Never estimate duration. If the source does not explicitly state numeric hours or minutes, use empty explicitDurationText and null durationSeconds.",
          "Action items must include only unfinished, requested, or future work. Do not classify completed work as an action item.",
          "Draft concise professional billing narratives in task style without embellishment.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Matter: ${input.matterName}\nMatter number: ${input.matterNumber}\nClient: ${input.clientName}\nJurisdiction: ${input.jurisdiction}\n\nSOURCE TEXT\n${input.content}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "counselscribe_matter_intelligence", strict: true, schema: responseSchema },
    },
  });

  const raw = response.choices?.[0]?.message.content;
  if (typeof raw !== "string") {
    const providerError = (response as unknown as { error?: { message?: string } | string }).error;
    const detail = typeof providerError === "string" ? providerError : providerError?.message;
    throw new Error(detail || `Matter AI provider returned no completion. Envelope fields: ${Object.keys(response as object).join(", ") || "none"}`);
  }
  const parsed = JSON.parse(raw) as MatterIntelligenceResult;
  const groundedFacts = grounded(input.content, parsed.facts);
  const result: MatterIntelligenceResult = {
    summary: parsed.summary?.trim() || groundedFacts[0]?.value || "Attorney-selected source analyzed; review each grounded finding below.",
    facts: groundedFacts,
    entities: grounded(input.content, parsed.entities),
    dates: grounded(input.content, parsed.dates),
    actions: grounded(input.content, parsed.actions),
    vocabulary: grounded(input.content, parsed.vocabulary),
    billing: parsed.billing.map(item => enforceBillingEvidence(input.content, item)).filter((item): item is BillingCandidate => Boolean(item)).filter(item => hasCompletedWorkEvidence(item.sourceQuote)),
  };
  return {
    result,
    modelId: response.model || MATTER_AI_MODEL,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}
