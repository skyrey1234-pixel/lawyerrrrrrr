export type CorrectionCommand = {
  heardPhrase: string;
  approvedText: string;
};

const SPOKEN_PUNCTUATION: Array<[RegExp, string]> = [
  [/\bnew paragraph\b/gi, "\n\n"],
  [/\bnew line\b/gi, "\n"],
  [/\bcomma\b/gi, ","],
  [/\bsemicolon\b/gi, ";"],
  [/\bcolon\b/gi, ":"],
  [/\bquestion mark\b/gi, "?"],
  [/\bexclamation (?:mark|point)\b/gi, "!"],
  [/\bopen quote\b/gi, "“"],
  [/\bclose quote\b/gi, "”"],
  [/\bperiod\b/gi, "."],
];

export function applyVoiceCommands(input: string) {
  let output = input;
  for (const [pattern, replacement] of SPOKEN_PUNCTUATION) {
    output = output.replace(pattern, replacement);
  }

  output = output.replace(/(^|[.!?]\s+)([^.!?]*?)\b(?:scratch|strike) that\b/gi, "$1");
  output = output
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])(?=[A-Za-z])/g, "$1 ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return output;
}

export function extractCorrectionCommand(input: string): CorrectionCommand | null {
  const match = input.match(/\bcorrect\s+(.+?)\s+to\s+(.+?)(?:[.!?]|$)/i);
  if (!match) return null;
  const heardPhrase = match[1]?.trim();
  const approvedText = match[2]?.trim();
  if (!heardPhrase || !approvedText) return null;
  return { heardPhrase, approvedText };
}

export type ReviewVoiceAction =
  | { type: "next" }
  | { type: "previous" }
  | { type: "accept" }
  | { type: "keep" }
  | { type: "play" }
  | { type: "format"; value: string; label: string }
  | ({ type: "correct" } & CorrectionCommand);

export function parseReviewVoiceCommand(input: string): ReviewVoiceAction | null {
  const correction = extractCorrectionCommand(input);
  if (correction) return { type: "correct", ...correction };
  const normalized = input.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (normalized === "new paragraph") return { type: "format", value: "\n\n", label: "new paragraph" };
  if (normalized === "new line") return { type: "format", value: "\n", label: "new line" };
  if (normalized === "comma") return { type: "format", value: ",", label: "comma" };
  if (normalized === "period") return { type: "format", value: ".", label: "period" };
  if (normalized === "open quote") return { type: "format", value: "“", label: "open quote" };
  if (normalized === "close quote") return { type: "format", value: "”", label: "close quote" };
  if (/\bnext (?:issue|change|suggestion)\b/.test(normalized)) return { type: "next" };
  if (/\bprevious (?:issue|change|suggestion)\b/.test(normalized)) return { type: "previous" };
  if (/\b(?:accept|approve) (?:issue|change|suggestion)\b/.test(normalized)) return { type: "accept" };
  if (/\b(?:keep original|reject change|reject suggestion)\b/.test(normalized)) return { type: "keep" };
  if (/\bplay (?:source|audio)\b/.test(normalized)) return { type: "play" };
  return null;
}

export function applyGlossary(
  input: string,
  terms: Array<{ heardPhrase: string; approvedText: string }>,
) {
  return [...terms]
    .sort((a, b) => b.heardPhrase.length - a.heardPhrase.length)
    .reduce((text, term) => {
      const escaped = term.heardPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), term.approvedText);
    }, input);
}

export function normalizeLegalDictation(
  input: string,
  terms: Array<{ heardPhrase: string; approvedText: string }>,
) {
  const commanded = applyVoiceCommands(input);
  const corrected = applyGlossary(commanded, terms);
  const protectedAbbreviations = corrected
    .replace(/\bet al\./gi, match => match.replace(".", "<CS_DOT>"))
    .replace(/\be\.g\./gi, match => match.replaceAll(".", "<CS_DOT>"))
    .replace(/\bi\.e\./gi, match => match.replaceAll(".", "<CS_DOT>"));
  return protectedAbbreviations
    .replace(/(^|[.!?]\s+)([a-z])/g, (_match, boundary: string, letter: string) => `${boundary}${letter.toUpperCase()}`)
    .replaceAll("<CS_DOT>", ".");
}

export function tokenizeForAccuracy(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9§]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function wordErrorRate(candidate: string, reference: string) {
  const source = tokenizeForAccuracy(candidate);
  const target = tokenizeForAccuracy(reference);
  if (!target.length) return 0;

  const matrix = Array.from({ length: target.length + 1 }, () => Array<number>(source.length + 1).fill(0));
  for (let row = 0; row <= target.length; row += 1) matrix[row]![0] = row;
  for (let column = 0; column <= source.length; column += 1) matrix[0]![column] = column;

  for (let row = 1; row <= target.length; row += 1) {
    for (let column = 1; column <= source.length; column += 1) {
      const substitutionCost = target[row - 1] === source[column - 1] ? 0 : 1;
      matrix[row]![column] = Math.min(
        matrix[row - 1]![column]! + 1,
        matrix[row]![column - 1]! + 1,
        matrix[row - 1]![column - 1]! + substitutionCost,
      );
    }
  }

  return Number(((matrix[target.length]![source.length]! / target.length) * 100).toFixed(2));
}

export function legalTermAccuracy(
  candidate: string,
  reference: string,
  terms: Array<{ approvedText: string }>,
) {
  const expectedTerms = terms.filter(term => reference.toLowerCase().includes(term.approvedText.toLowerCase()));
  if (!expectedTerms.length) return 100;
  const matched = expectedTerms.filter(term => candidate.toLowerCase().includes(term.approvedText.toLowerCase())).length;
  return Number(((matched / expectedTerms.length) * 100).toFixed(2));
}
