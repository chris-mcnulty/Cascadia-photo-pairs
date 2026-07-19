import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  AlignmentType,
  PageOrientation,
  WidthType,
  ShadingType,
  BorderStyle,
  HeightRule,
} from "docx";
import { BRAND, readBrandLogoBuffer, imageDimensions } from "./catalog-brand";
import type { PriceListRow, PriceListPdfOptions } from "./pricelist-pdf";

const FONT_HEADING = "Metro Nova Pro Black";
const FONT_BODY = "Metro Nova Pro";
const FONT_LIGHT = "Metro Nova Pro Light";

function hex(h: string) {
  return h.toUpperCase();
}

function fmtCents(cents: number): string {
  const d = cents / 100;
  return `$${d.toLocaleString("en-US")}`;
}

function fmtSize(label: string): string {
  return label
    .trim()
    .replace(/\s*[xX]\s*/g, '" × ')
    .concat('"');
}

function scaleToFit(
  dims: { width: number; height: number } | null,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  if (!dims || !dims.width || !dims.height)
    return { width: maxW, height: Math.round(maxW * 0.5) };
  const ratio = Math.min(maxW / dims.width, maxH / dims.height);
  return { width: Math.round(dims.width * ratio), height: Math.round(dims.height * ratio) };
}

function detectType(buf: Buffer): "jpg" | "png" {
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  return "png";
}

const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

const THIN_BOTTOM = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: hex(BRAND.granite) },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function headerCell(text: string, align: AlignmentType = AlignmentType.LEFT) {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: hex(BRAND.evergreen) },
    borders: NO_BORDER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text,
            font: FONT_HEADING,
            bold: true,
            size: 16,
            color: BRAND.white,
          }),
        ],
      }),
    ],
  });
}

function dataCell(
  text: string,
  opts: {
    bold?: boolean;
    color?: string;
    align?: AlignmentType;
    font?: string;
    shade?: string;
    borders?: any;
  } = {},
) {
  return new TableCell({
    shading: opts.shade
      ? { type: ShadingType.SOLID, color: opts.shade }
      : { type: ShadingType.CLEAR, color: "FFFFFF" },
    borders: opts.borders ?? NO_BORDER,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            font: opts.font ?? FONT_BODY,
            bold: opts.bold,
            size: 18,
            color: opts.color ?? BRAND.textDark,
          }),
        ],
      }),
    ],
  });
}

export async function generatePriceListDocx(
  rows: PriceListRow[],
  opts: PriceListPdfOptions,
): Promise<Buffer> {
  const brandLogoBuf = opts.brandLogo ?? readBrandLogoBuffer();
  const showDiscount = opts.discountRate > 0;

  const children: (Paragraph | Table)[] = [];

  // ── Header ─────────────────────────────────────────────────────────────
  // Logo — centered
  if (brandLogoBuf) {
    const d = scaleToFit(imageDimensions(brandLogoBuf), 110, 60);
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new ImageRun({
            data: brandLogoBuf,
            type: detectType(brandLogoBuf),
            transformation: d,
          }),
        ],
      }),
    );
  }

  // "Price List" — centered
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "Price List",
          font: FONT_HEADING,
          bold: true,
          size: 44,
          color: BRAND.evergreen,
        }),
      ],
    }),
  );

  // "Cascadia Oceanic · Chris McNulty" — centered
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: "Cascadia Oceanic · Chris McNulty",
          font: FONT_LIGHT,
          size: 20,
          color: BRAND.midtone,
        }),
      ],
    }),
  );

  // Spacer
  children.push(new Paragraph({ spacing: { after: 120 } }));

  // Show title — centered (only if provided)
  if (opts.title) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: opts.title,
            font: FONT_HEADING,
            bold: true,
            size: 28,
            color: BRAND.granite,
          }),
        ],
      }),
    );
  }

  // Discount note — centered
  if (showDiscount) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: `${opts.discountRate}% show discount applied · prices rounded to nearest $5`,
            font: FONT_LIGHT,
            size: 18,
            color: BRAND.midtone,
          }),
        ],
      }),
    );
  }

  // Material note
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "All prints are ChromaLuxe aluminum — archival metal print process with exceptional color, depth, and durability.",
          font: FONT_LIGHT,
          size: 16,
          color: BRAND.granite,
          italics: true,
        }),
      ],
    }),
  );

  // ── Table ───────────────────────────────────────────────────────────────
  const TABLE_W = 9360; // ~6.5 inches in twentieths of a point (twips)
  const colWidths = showDiscount
    ? [3800, 2200, 1680, 1680]
    : [4100, 2460, 2800, 0];

  // Header row
  const headerCells = [
    headerCell("PHOTO"),
    headerCell("SIZE"),
    headerCell(showDiscount ? "LIST PRICE" : "PRICE", AlignmentType.RIGHT),
  ];
  if (showDiscount) {
    headerCells.push(headerCell("SHOW PRICE", AlignmentType.RIGHT));
  }

  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      height: { value: 350, rule: HeightRule.ATLEAST },
      children: headerCells,
    }),
  ];

  let prevTitle = "";
  rows.forEach((row, idx) => {
    const isNewGroup = row.productTitle !== prevTitle;
    const isOdd = idx % 2 === 0;
    const shade = isOdd ? "EEF4F0" : "FFFFFF";
    const borders = isNewGroup && idx > 0 ? THIN_BOTTOM : NO_BORDER;

    const cells = [
      dataCell(isNewGroup ? row.productTitle : "", {
        bold: isNewGroup,
        color: isNewGroup ? BRAND.evergreen : BRAND.textDark,
        font: isNewGroup ? FONT_HEADING : FONT_BODY,
        shade,
        borders,
      }),
      dataCell(fmtSize(row.sizeLabel), { shade, borders }),
      dataCell(fmtCents(row.listPriceCents), {
        align: AlignmentType.RIGHT,
        color: showDiscount ? BRAND.granite : BRAND.textDark,
        shade,
        borders,
      }),
    ];

    if (showDiscount) {
      cells.push(
        dataCell(fmtCents(row.showPriceCents), {
          align: AlignmentType.RIGHT,
          bold: true,
          color: BRAND.midtone,
          shade,
          borders,
        }),
      );
    }

    tableRows.push(
      new TableRow({
        height: { value: 300, rule: HeightRule.ATLEAST },
        children: cells,
      }),
    );

    if (isNewGroup) prevTitle = row.productTitle;
  });

  children.push(
    new Table({
      width: { size: TABLE_W, type: WidthType.DXA },
      columnWidths: colWidths.filter((w) => w > 0),
      rows: tableRows,
    }),
  );

  // Footer
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: `© ${new Date().getFullYear()} Christopher F McNulty · Cascadia Oceanic · www.chrismcnulty.net`,
          font: FONT_LIGHT,
          size: 14,
          color: BRAND.granite,
        }),
      ],
    }),
  );

  const doc = new Document({
    creator: "Cascadia Oceanic",
    title: opts.title,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
            size: { orientation: PageOrientation.PORTRAIT },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
