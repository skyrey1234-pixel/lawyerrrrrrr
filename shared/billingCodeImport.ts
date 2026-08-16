import { normalizeBillingCategory, validateBillingCode } from "./billingCodes";

export type ImportedBillingCode = {
  code: string;
  label: string;
  category: string;
  description?: string;
  defaultNarrative?: string;
  displayOrder: number;
  active: boolean;
};

function parseLine(line: string, delimiter: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) { values.push(value.trim()); value = ""; }
    else value += character;
  }
  values.push(value.trim());
  return values;
}

export function parseBillingCodeImport(text: string): { items: ImportedBillingCode[]; errors: string[] } {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return { items: [], errors: ["Paste a CSV or tab-separated billing-code list."] };
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const first = parseLine(lines[0], delimiter).map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const hasHeader = first.includes("code") && first.includes("label");
  const headers = hasHeader ? first : ["code", "label", "category", "description", "defaultnarrative", "displayorder", "active"];
  const rows = hasHeader ? lines.slice(1) : lines;
  const errors: string[] = [];
  const seen = new Set<string>();
  const items: ImportedBillingCode[] = [];
  rows.forEach((line, rowIndex) => {
    const rowNumber = rowIndex + (hasHeader ? 2 : 1);
    const values = parseLine(line, delimiter);
    const field = (name: string) => values[headers.indexOf(name)]?.trim() || "";
    try {
      const code = validateBillingCode(field("code"));
      if (seen.has(code)) throw new Error(`duplicate code ${code} in import`);
      seen.add(code);
      const label = field("label");
      const category = normalizeBillingCategory(field("category"));
      if (label.length < 2) throw new Error("label is required");
      const orderValue = field("displayorder");
      const displayOrder = orderValue ? Number(orderValue) : rowIndex;
      if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 10000) throw new Error("display order must be an integer from 0 to 10000");
      const activeValue = field("active").toLowerCase();
      items.push({ code, label, category, description: field("description") || undefined, defaultNarrative: field("defaultnarrative") || undefined, displayOrder, active: !["false", "0", "no", "inactive"].includes(activeValue) });
    } catch (error) {
      errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : "invalid billing code"}`);
    }
  });
  return { items, errors };
}
