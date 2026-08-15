/**
 * The Litigator's Desk: deterministic, review-first language helpers.
 * Legal changes are visible and reversible; no rule silently claims legal judgment.
 */

export type LegalTerm = {
  id: string;
  spoken: string;
  replacement: string;
  category: "Florida" | "Latin" | "Citation" | "Firm" | "Personal";
  note: string;
};

export type LegalHit = LegalTerm & {
  count: number;
};

export type CleanupSuggestion = {
  id: string;
  kind: "filler" | "restart" | "repetition";
  title: string;
  original: string;
  replacement: string;
  reason: string;
  count: number;
  confidence: number;
};

export const BUILT_IN_TERMS: LegalTerm[] = [
  {
    id: "motion-in-limine",
    spoken: "motion and lemonade",
    replacement: "motion in limine",
    category: "Latin",
    note: "Pretrial motion phrasing",
  },
  {
    id: "juris-doctor",
    spoken: "jurist doctor",
    replacement: "Juris Doctor",
    category: "Latin",
    note: "Professional degree formatting",
  },
  {
    id: "et-al",
    spoken: "at all",
    replacement: "et al.",
    category: "Latin",
    note: "Multiple-party citation abbreviation",
  },
  {
    id: "res-ipsa",
    spoken: "race ipsa loquitur",
    replacement: "res ipsa loquitur",
    category: "Latin",
    note: "Latin doctrine",
  },
  {
    id: "voir-dire",
    spoken: "war deer",
    replacement: "voir dire",
    category: "Latin",
    note: "Jury selection terminology",
  },
  {
    id: "florida-90408",
    spoken: "Florida statute ninety point four zero eight",
    replacement: "Florida Statute § 90.408",
    category: "Florida",
    note: "Compromise and offer evidence reference",
  },
  {
    id: "summary-judgment",
    spoken: "summery judgment",
    replacement: "summary judgment",
    category: "Florida",
    note: "Procedural motion terminology",
  },
  {
    id: "wrongful-death",
    spoken: "wrong full death",
    replacement: "wrongful death",
    category: "Florida",
    note: "Practice-area terminology",
  },
  {
    id: "insurance-defense",
    spoken: "insurance de fence",
    replacement: "insurance defense",
    category: "Florida",
    note: "Practice-area terminology",
  },
  {
    id: "notice-appearance",
    spoken: "notice of a parents",
    replacement: "Notice of Appearance",
    category: "Florida",
    note: "Filing title formatting",
  },
  {
    id: "record-on-appeal",
    spoken: "record on a peel",
    replacement: "record on appeal",
    category: "Citation",
    note: "Appellate record terminology",
  },
  {
    id: "Hartwell-insurance",
    spoken: "heart well insurance group",
    replacement: "Hartwell Insurance Group",
    category: "Firm",
    note: "Synthetic demo client",
  },
];

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const countMatches = (text: string, phrase: string) => {
  const matches = text.match(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi"));
  return matches?.length ?? 0;
};

export function formatSpokenPunctuation(input: string) {
  return input
    .replace(/\bnew paragraph\b/gi, "\n\n")
    .replace(/\bnew line\b/gi, "\n")
    .replace(/\bcomma\b/gi, ",")
    .replace(/\bsemicolon\b/gi, ";")
    .replace(/\bcolon\b/gi, ":")
    .replace(/\bquestion mark\b/gi, "?")
    .replace(/\bperiod\b/gi, ".")
    .replace(/[ \t]+([,.;:?])/g, "$1")
    .replace(/([,.;:?])([^\s\n])/g, "$1 $2")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

export function finalizeDraftTypography(input: string) {
  return input
    .replace(/\.{2,}/g, ".")
    .replace(/(^|[.!?]\s+|\n+)([a-z])/g, (_match, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`);
}

export function applyLegalTerms(input: string, personalTerms: LegalTerm[]) {
  let text = formatSpokenPunctuation(input);
  const hits: LegalHit[] = [];

  [...personalTerms, ...BUILT_IN_TERMS].forEach((term) => {
    const count = countMatches(text, term.spoken);
    if (!count) return;

    const matcher = new RegExp(`\\b${escapeRegExp(term.spoken)}\\b`, "gi");
    text = text.replace(matcher, term.replacement);
    hits.push({ ...term, count });
  });

  return { text: finalizeDraftTypography(text), hits };
}

const fillerPattern = /\b(?:um+|uh+|erm+|ah+)\b[\s,]*/gi;
const restartPattern = /\b(?:I mean|let me restart|scratch that|rather)\b[\s,]*/gi;
const repetitionPattern = /\b([a-z][a-z'-]{2,})(?:\s+\1\b)+/gi;
const phraseRepetitionPattern = /\b((?:[a-z][a-z'-]*\s+){1,4}[a-z][a-z'-]*)[,\s]+\1\b/gi;

const capitalizeDraftStart = (input: string) =>
  input.replace(/^(\s*)([a-z])/, (_match, spacing: string, letter: string) => `${spacing}${letter.toUpperCase()}`);

export function buildCleanupSuggestions(input: string): CleanupSuggestion[] {
  const suggestions: CleanupSuggestion[] = [];
  const fillers = input.match(fillerPattern) ?? [];
  const restarts = input.match(restartPattern) ?? [];
  const repetitions = Array.from(input.matchAll(repetitionPattern));
  const phraseRepetitions = Array.from(input.matchAll(phraseRepetitionPattern));

  if (fillers.length) {
    suggestions.push({
      id: "remove-fillers",
      kind: "filler",
      title: "Remove vocal fillers",
      original: fillers.slice(0, 4).map((item) => item.trim()).join(" · "),
      replacement: "Remove",
      reason: "Non-substantive vocal fillers detected. Review before applying.",
      count: fillers.length,
      confidence: 96,
    });
  }

  if (restarts.length) {
    suggestions.push({
      id: "remove-restarts",
      kind: "restart",
      title: "Tighten verbal restarts",
      original: restarts.slice(0, 4).map((item) => item.trim()).join(" · "),
      replacement: "Remove cue phrases",
      reason: "Speaker restart cues may not belong in the final legal draft.",
      count: restarts.length,
      confidence: 88,
    });
  }

  if (repetitions.length || phraseRepetitions.length) {
    const originals = [
      ...phraseRepetitions.map((item) => item[0]),
      ...repetitions.map((item) => item[0]),
    ];
    const replacements = [
      ...phraseRepetitions.map((item) => item[1]),
      ...repetitions.map((item) => item[1]),
    ];
    suggestions.push({
      id: "collapse-repetitions",
      kind: "repetition",
      title: "Collapse repeated words",
      original: originals.slice(0, 4).join(" · "),
      replacement: replacements.slice(0, 4).join(" · "),
      reason: "Exact adjacent word or phrase repetitions were detected.",
      count: repetitions.length + phraseRepetitions.length,
      confidence: 94,
    });
  }

  return suggestions;
}

export function applyCleanupRule(input: string, ruleId: string) {
  if (ruleId === "remove-fillers") return finalizeDraftTypography(capitalizeDraftStart(input.replace(fillerPattern, "").replace(/\s{2,}/g, " ").trim()));
  if (ruleId === "remove-restarts") return finalizeDraftTypography(capitalizeDraftStart(input.replace(restartPattern, "").replace(/\s{2,}/g, " ").trim()));
  if (ruleId === "collapse-repetitions") return finalizeDraftTypography(capitalizeDraftStart(input.replace(phraseRepetitionPattern, "$1").replace(repetitionPattern, "$1")));
  return input;
}

export const DEMO_TRANSCRIPT =
  "Um, prepare a motion and lemonade comma I mean a motion and lemonade on behalf of heart well insurance group period New paragraph The plaintiff plaintiff's prior settlement offers should be excluded under Florida statute ninety point four zero eight period Uh, preserve our objection for the record on a peel and cite Jones at all period";
