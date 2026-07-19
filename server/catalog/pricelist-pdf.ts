import PDFDocument from "pdfkit";
import {
  BRAND,
  FONT_FILES,
  readBrandLogoBuffer,
  imageDimensions,
} from "./catalog-brand";

export interface PriceListRow {
  productTitle: string;
  sizeLabel: string;
  mediaType: string;
  listPriceCents: number;
  showPriceCents: number;
}

export interface PriceListPdfOptions {
  title: string;
  subtitle?: string;
  discountRate: number;
  brandLogo?: Buffer | null;
}

const HEX = (h: string) => `#${h}`;
const PAGE_W = 612;
const PAGE_H = 792;
const M = { top: 54, bottom: 54, left: 60, right: 60 };
const CW = PAGE_W - M.left - M.right;
const ROW_H = 16;
const HEADER_ROW_H = 18;

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

function registerFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont("Heading", FONT_FILES.black());
  doc.registerFont("Bold", FONT_FILES.bold());
  doc.registerFont("Body", FONT_FILES.regular());
  doc.registerFont("Light", FONT_FILES.light());
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  y: number,
  col: Record<string, number>,
  colW: Record<string, number>,
  showDiscount: boolean,
) {
  doc.save();
  doc.rect(M.left, y, CW, HEADER_ROW_H).fillColor(HEX(BRAND.evergreen)).fill();
  const ty = y + 4;
  doc.font("Bold").fontSize(8).fillColor(HEX(BRAND.white));
  doc.text("PHOTO", col.name + 4, ty, { width: colW.name - 8, lineBreak: false });
  doc.text("SIZE", col.size + 4, ty, { width: colW.size - 8, lineBreak: false });
  doc.text(showDiscount ? "LIST PRICE" : "PRICE", col.list + 4, ty, {
    width: colW.list - 8,
    align: "right",
    lineBreak: false,
  });
  if (showDiscount) {
    doc.text("SHOW PRICE", col.show + 4, ty, {
      width: colW.show - 8,
      align: "right",
      lineBreak: false,
    });
  }
  doc.restore();
  return y + HEADER_ROW_H;
}

function drawFooter(doc: PDFKit.PDFDocument, pageNum: number) {
  const year = new Date().getFullYear();
  const footerLineH = doc.font("Light").fontSize(7).currentLineHeight(true);
  const maxY = PAGE_H - M.bottom;
  const footerY = maxY - footerLineH - 3;

  doc.save();
  doc
    .moveTo(M.left, footerY - 6)
    .lineTo(M.left + CW, footerY - 6)
    .lineWidth(0.3)
    .strokeColor(HEX(BRAND.granite))
    .stroke();

  doc
    .font("Light")
    .fontSize(7)
    .fillColor(HEX(BRAND.granite))
    .text(`© ${year} Christopher F McNulty · Cascadia Oceanic`, M.left, footerY, {
      width: CW * 0.55,
      align: "left",
      lineBreak: false,
    });
  doc.text("www.chrismcnulty.net", M.left, footerY, {
    width: CW,
    align: "center",
    lineBreak: false,
  });
  doc.text(`${pageNum}`, M.left, footerY, {
    width: CW,
    align: "right",
    lineBreak: false,
  });
  doc.restore();
}

export async function generatePriceListPdf(
  rows: PriceListRow[],
  opts: PriceListPdfOptions,
): Promise<Buffer> {
  const brandLogo = opts.brandLogo ?? readBrandLogoBuffer();
  const showDiscount = opts.discountRate > 0;

  // Column widths
  const colW = {
    name: 190,
    size: 112,
    list: showDiscount ? 95 : 190,
    show: showDiscount ? 95 : 0,
  };
  const col = {
    name: M.left,
    size: M.left + colW.name,
    list: M.left + colW.name + colW.size,
    show: M.left + colW.name + colW.size + colW.list,
  };

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margins: M,
        info: { Title: opts.title, Author: "Cascadia Oceanic" },
        autoFirstPage: true,
        bufferPages: true,
      });
      registerFonts(doc);

      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // ── Header ─────────────────────────────────────────────────────────
      let curY = M.top;

      // Logo — centered
      if (brandLogo) {
        const dims = imageDimensions(brandLogo);
        const logoMaxH = 44;
        const logoMaxW = 120;
        const ratio = dims
          ? Math.min(logoMaxW / dims.width, logoMaxH / dims.height)
          : 1;
        const lw = dims ? dims.width * ratio : logoMaxW;
        const lh = dims ? dims.height * ratio : logoMaxH;
        const logoX = M.left + (CW - lw) / 2;
        doc.image(brandLogo, logoX, curY, { width: lw, height: lh });
        curY += lh + 10;
      }

      // "Price List" — centered
      doc
        .font("Heading")
        .fontSize(22)
        .fillColor(HEX(BRAND.evergreen))
        .text("Price List", M.left, curY, {
          width: CW,
          align: "center",
          lineBreak: false,
        });
      curY += 28;

      // "Cascadia Oceanic · Chris McNulty" — centered
      doc
        .font("Light")
        .fontSize(10)
        .fillColor(HEX(BRAND.midtone))
        .text("Cascadia Oceanic · Chris McNulty", M.left, curY, {
          width: CW,
          align: "center",
          lineBreak: false,
        });
      curY += 16;

      // Spacer
      curY += 8;

      // Show title — centered (only if provided)
      if (opts.title) {
        doc
          .font("Bold")
          .fontSize(13)
          .fillColor(HEX(BRAND.granite))
          .text(opts.title, M.left, curY, {
            width: CW,
            align: "center",
            lineBreak: false,
          });
        curY += 18;
      }

      // Discount note — centered
      if (showDiscount) {
        doc
          .font("Light")
          .fontSize(8)
          .fillColor(HEX(BRAND.midtone))
          .text(
            `${opts.discountRate}% show discount applied · prices rounded to nearest $5`,
            M.left,
            curY,
            { width: CW, align: "center", lineBreak: false },
          );
        curY += 13;
      }

      // Separator rule
      curY += 6;
      doc
        .save()
        .moveTo(M.left, curY)
        .lineTo(M.left + CW, curY)
        .lineWidth(1.2)
        .strokeColor(HEX(BRAND.evergreen))
        .stroke()
        .restore();
      curY += 12;

      // Material note — centered
      doc
        .font("Light")
        .fontSize(8)
        .fillColor(HEX(BRAND.granite))
        .text(
          "All prints are ChromaLuxe aluminum — archival metal print process with exceptional color, depth, and durability.",
          M.left,
          curY,
          { width: CW, align: "center", lineBreak: false },
        );
      curY += 14;

      // ── Table ──────────────────────────────────────────────────────────
      const footerZone = M.bottom + 20;
      const maxContentY = PAGE_H - footerZone - HEADER_ROW_H;

      curY = drawTableHeader(doc, curY, col, colW, showDiscount);

      let rowIdx = 0;
      let prevTitle = "";

      for (const row of rows) {
        // Page break check
        if (curY + ROW_H > PAGE_H - footerZone) {
          doc.addPage();
          curY = M.top;
          curY = drawTableHeader(doc, curY, col, colW, showDiscount);
        }

        const isNewGroup = row.productTitle !== prevTitle;
        const bgColor = rowIdx % 2 === 0 ? "#EEF4F0" : "#FFFFFF";

        // Row background
        doc.save();
        doc.rect(M.left, curY, CW, ROW_H).fillColor(bgColor).fill();

        // Top separator on new group (except very first)
        if (isNewGroup && rowIdx > 0) {
          doc
            .moveTo(M.left, curY)
            .lineTo(M.left + CW, curY)
            .lineWidth(0.4)
            .strokeColor(HEX(BRAND.granite))
            .stroke();
        }
        doc.restore();

        const cellY = curY + 3;
        const cellSize = 9;

        // Photo name (only on first row of each group — bolded + evergreen)
        if (isNewGroup) {
          doc
            .font("Bold")
            .fontSize(cellSize)
            .fillColor(HEX(BRAND.evergreen))
            .text(row.productTitle, col.name + 4, cellY, {
              width: colW.name - 8,
              lineBreak: false,
            });
          prevTitle = row.productTitle;
        }

        // Size (indented slightly on continuation rows)
        const sizeIndent = isNewGroup ? 0 : 10;
        doc
          .font("Body")
          .fontSize(cellSize)
          .fillColor(HEX(BRAND.textDark))
          .text(fmtSize(row.sizeLabel), col.size + 4 + sizeIndent, cellY, {
            width: colW.size - 8 - sizeIndent,
            lineBreak: false,
          });

        // List price
        doc
          .font("Body")
          .fontSize(cellSize)
          .fillColor(showDiscount ? HEX(BRAND.granite) : HEX(BRAND.textDark))
          .text(fmtCents(row.listPriceCents), col.list + 4, cellY, {
            width: colW.list - 8,
            align: "right",
            lineBreak: false,
          });

        // Show price
        if (showDiscount) {
          doc
            .font("Bold")
            .fontSize(cellSize)
            .fillColor(HEX(BRAND.midtone))
            .text(fmtCents(row.showPriceCents), col.show + 4, cellY, {
              width: colW.show - 8,
              align: "right",
              lineBreak: false,
            });
        }

        curY += ROW_H;
        rowIdx++;
      }

      // Closing rule below last row
      doc
        .save()
        .moveTo(M.left, curY)
        .lineTo(M.left + CW, curY)
        .lineWidth(0.4)
        .strokeColor(HEX(BRAND.evergreen))
        .stroke()
        .restore();

      // ── Footer post-pass ──────────────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.y = M.top;
        drawFooter(doc, i + 1);
      }

      doc.end();
    } catch (e) {
      reject(e as Error);
    }
  });
}
