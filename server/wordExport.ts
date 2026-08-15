import {
  AlignmentType,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";

export type LegalExportInput = {
  firmName: string;
  matterName: string;
  matterNumber: string;
  jurisdiction: string;
  documentTitle: string;
  content: string;
  authorName?: string | null;
};

export async function generateLegalDocx(input: LegalExportInput) {
  const paragraphs = input.content
    .split(/\n{2,}/)
    .map(value => value.trim())
    .filter(Boolean)
    .map(value =>
      new Paragraph({
        children: [new TextRun({ text: value, font: "Times New Roman", size: 24 })],
        spacing: { line: 480, after: 240 },
      }),
    );

  const document = new Document({
    creator: input.authorName || "CounselScribe",
    title: input.documentTitle,
    description: `Attorney-reviewed draft for ${input.matterName}`,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `${input.matterNumber} · ${input.jurisdiction}`, font: "Times New Roman", size: 18 })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Attorney-reviewed CounselScribe draft · Page ", font: "Times New Roman", size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], font: "Times New Roman", size: 18 }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: input.firmName.toUpperCase(), bold: true, font: "Times New Roman", size: 24 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
            children: [new TextRun({ text: input.documentTitle.toUpperCase(), bold: true, font: "Times New Roman", size: 28 })],
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({ text: "Matter: ", bold: true, font: "Times New Roman", size: 24 }),
              new TextRun({ text: input.matterName, font: "Times New Roman", size: 24 }),
            ],
          }),
          ...paragraphs,
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
