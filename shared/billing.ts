export type BillingCandidate = {
  activityCode: string;
  narrative: string;
  sourceQuote: string;
  explicitDurationText: string;
  durationSeconds: number | null;
  confidence: number;
};

export type BillingActivityCode = "COMMUNICATION" | "DRAFTING" | "REVIEW" | "RESEARCH" | "COURT" | "NEGOTIATION" | "ADMIN" | "OTHER";

export type BillingVoiceCommand =
  | { type: "start_timer"; activityCode: BillingActivityCode; narrative: string }
  | { type: "stop_timer" }
  | { type: "cancel_timer" }
  | { type: "create_entry"; activityCode: BillingActivityCode; narrative: string; durationSeconds: number | null; sourceQuote: string };

export function parseExplicitDurationSeconds(text: string): number | null {
  const hours = text.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  if (hours) return Math.round(Number(hours[1]) * 3600);
  const minutes = text.match(/\b(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/i);
  if (minutes) return Math.round(Number(minutes[1]) * 60);
  return null;
}

export function classifyBillingActivity(text: string): BillingActivityCode {
  const value = text.toLowerCase();
  if (/call|conference|email|correspond|communicat/.test(value)) return "COMMUNICATION";
  if (/draft|prepare|revise|write/.test(value)) return "DRAFTING";
  if (/review|analy[sz]|inspect|examine/.test(value)) return "REVIEW";
  if (/research|case law|statute/.test(value)) return "RESEARCH";
  if (/hearing|deposition|trial|court|appearance/.test(value)) return "COURT";
  if (/negotiate|settlement|mediation/.test(value)) return "NEGOTIATION";
  if (/file|calendar|schedule|administrative/.test(value)) return "ADMIN";
  return "OTHER";
}

export function parseBillingVoiceCommand(input: string): BillingVoiceCommand | null {
  const sourceQuote = input.trim();
  const normalized = sourceQuote.toLowerCase().replace(/[.,!?]+$/g, "").replace(/\s+/g, " ").trim();
  if (normalized === "stop billing timer" || normalized === "stop timer") return { type: "stop_timer" };
  if (normalized === "cancel billing timer" || normalized === "cancel timer") return { type: "cancel_timer" };
  const start = normalized.match(/^start (?:billing )?timer (?:for )?(.+)$/);
  if (start) return { type: "start_timer", activityCode: classifyBillingActivity(start[1]), narrative: start[1] };
  const entry = normalized.match(/^(?:bill|billing entry)(?:\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?))?\s+(?:for\s+)?(.+)$/);
  if (entry) {
    const durationText = entry[1] && entry[2] ? `${entry[1]} ${entry[2]}` : "";
    const narrative = entry[3].trim();
    return { type: "create_entry", activityCode: classifyBillingActivity(narrative), narrative, durationSeconds: durationText ? parseExplicitDurationSeconds(durationText) : null, sourceQuote };
  }
  return null;
}

export function normalizedEvidence(text: string) {
  return text.toLowerCase().replace(/[“”‘’]/g, "'").replace(/\s+/g, " ").trim();
}

export function isSourceGrounded(source: string, quote: string) {
  const normalizedQuote = normalizedEvidence(quote);
  return normalizedQuote.length >= 4 && normalizedEvidence(source).includes(normalizedQuote);
}

export function hasCompletedWorkEvidence(quote: string) {
  const value = normalizedEvidence(quote);
  if (parseExplicitDurationSeconds(value) != null) return true;
  const actor = /\b(i|we|our team|attorney|counsel|lawyer|paralegal|he|she)\b/i;
  const completedWork = /\b(reviewed|analyzed|researched|drafted|prepared|revised|wrote|emailed|called|conferred|attended|appeared|filed|negotiated|traveled|worked|met|presented)\b/i;
  return actor.test(value) && completedWork.test(value);
}

export function enforceBillingEvidence(source: string, candidate: BillingCandidate): BillingCandidate | null {
  if (!isSourceGrounded(source, candidate.sourceQuote)) return null;
  const verifiedDuration = parseExplicitDurationSeconds(candidate.sourceQuote);
  return {
    ...candidate,
    durationSeconds: verifiedDuration,
    explicitDurationText: verifiedDuration == null ? "" : candidate.explicitDurationText,
  };
}

export function normalizedBillingFingerprint(input: {
  firmId: number;
  matterId: number;
  activityCode: string;
  narrative: string;
  workDate: Date;
  durationSeconds: number | null;
  sourceIdentifier?: string | null;
}) {
  return [
    input.firmId,
    input.matterId,
    input.activityCode.trim().toLowerCase(),
    normalizedEvidence(input.narrative),
    input.workDate.toISOString().slice(0, 10),
    input.durationSeconds ?? "none",
  ].join("|");
}
