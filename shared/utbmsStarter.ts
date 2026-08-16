export const UTBMS_LITIGATION_SOURCE_URL = "https://utbms.com/aba-litigation-codes/";

const labels: Array<[string, string]> = [
  ["L110", "Fact Investigation/Development"],
  ["L120", "Analysis/Strategy"],
  ["L130", "Experts/Consultants"],
  ["L140", "Document/File Management"],
  ["L150", "Budgeting"],
  ["L160", "Settlement/Non-Binding ADR"],
  ["L190", "Other Case Assessment, Development and Administration"],
  ["L210", "Pleadings"],
  ["L220", "Preliminary Injunctions/Provisional Remedies"],
  ["L230", "Court Mandated Conferences"],
  ["L240", "Dispositive Motions"],
  ["L250", "Other Written Motions and Submissions"],
  ["L260", "Class Action Certification and Notice"],
  ["L310", "Written Discovery"],
  ["L320", "Document Production"],
  ["L330", "Depositions"],
  ["L340", "Expert Discovery"],
  ["L350", "Discovery Motions"],
  ["L390", "Other Discovery"],
  ["L410", "Fact Witnesses"],
  ["L420", "Expert Witnesses"],
  ["L430", "Written Motions and Submissions"],
  ["L440", "Other Trial Preparation and Support"],
  ["L450", "Trial and Hearing Attendance"],
  ["L460", "Post-Trial Motions and Submissions"],
  ["L470", "Enforcement"],
  ["L510", "Appellate Motions and Submissions"],
  ["L520", "Appellate Briefs"],
  ["L530", "Oral Argument"],
];

export const UTBMS_LITIGATION_STARTER = labels.map(([code, label], index) => ({
  code,
  label,
  category: "UTBMS_LITIGATION",
  description: `Public ABA UTBMS Litigation Task Code (1997), reproduced by the LEDES Oversight Committee. Source: ${UTBMS_LITIGATION_SOURCE_URL}`,
  defaultNarrative: undefined,
  displayOrder: 100 + index,
  active: true,
}));

export const FLORIDA_RATE_BENCHMARKS_2025 = [
  { id: "fl-lawyer-average", label: "Florida lawyer average", hourlyRateCents: 35_300, context: "All lawyer practice areas" },
  { id: "fl-civil-litigation", label: "Florida civil litigation average", hourlyRateCents: 32_400, context: "Civil litigation lawyers" },
  { id: "fl-firm-blended", label: "Florida blended law-firm average", hourlyRateCents: 30_500, context: "Lawyer and non-lawyer blended firm rate" },
] as const;

export const FLORIDA_RATE_BENCHMARK_SOURCE_URL = "https://www.clio.com/resources/legal-trends/compare-lawyer-rates/fl/";
