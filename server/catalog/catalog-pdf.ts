import PDFDocument from "pdfkit";
import type { CatalogEntry } from "./catalog-data";
import {
  BRAND,
  FONT_FILES,
  formatPrice,
  formatSizeLabel,
  pickFeaturedSize,
  fetchImageBuffer,
  imageDimensions,
  generateQrBuffer,
  productUrl,
  STORE_BASE_URL,
  mapWithConcurrency,
} from "./catalog-brand";

export interface PdfOptions {
  mode: "portfolio" | "signage";
  title: string;
  subtitle?: string;
  featuredSize?: "largest" | "smallest";
  includeQr?: boolean;
  includePhoto?: boolean; // signage: whether to embed the photo (default true)
  storeBaseUrl?: string;
  brandLogo?: Buffer | null;
  showLogo?: Buffer | null;
  discountRate?: number; // signage: 0–99, show price = round(list*(1-rate/100)/500)*500
  includePrice?: boolean; // signage: show featured price on card (default true)
}

const HEX = (h: string) => `#${h}`;

interface PreparedAsset {
  entry: CatalogEntry;
  imageBuf: Buffer | null;
  qrBuf: Buffer | null;
}

// Signage page geometry (points; 72 pt = 1 inch)
//
// Two cards stacked vertically on portrait letter (8.5" × 11" = 612 × 792 pt).
// Each card is exactly 6" wide × 4" tall (432 × 288 pt) with a 1" (72 pt) gap
// between them. Total print area: 6" × 9" — comfortably centred on letter.
const CARD_W = 432;         // 6 inches — exact
const CARD_H = 288;         // 4 inches — exact
const CARD_INNER_M = 14;    // inner padding within each card
const CARD_GAP = 72;        // 1 inch between the two cards
const SIG_PAGE_W = 612;     // portrait letter width  (8.5")
const SIG_PAGE_H = 792;     // portrait letter height (11")
// Centre the 6"×9" block horizontally and vertically on the letter page
const CARD_ORIGIN_X = Math.round((SIG_PAGE_W - CARD_W) / 2);                   // 90 pt from left
const CARD_ORIGIN_Y = Math.round((SIG_PAGE_H - (CARD_H * 2 + CARD_GAP)) / 2); // 72 pt from top
// Top and bottom card positions
const CARD_X = [CARD_ORIGIN_X, CARD_ORIGIN_X];
const CARD_Y_POS = [CARD_ORIGIN_Y, CARD_ORIGIN_Y + CARD_H + CARD_GAP];

async function prepareAssets(entries: CatalogEntry[], opts: PdfOptions): Promise<PreparedAsset[]> {
  const baseUrl = opts.storeBaseUrl || STORE_BASE_URL;
  // Signage cards never embed the photo (text + branding only).
  // Portfolio mode fetches the image buffer as before.
  const fetchPhoto = opts.mode !== "signage" && opts.includePhoto !== false;
  return mapWithConcurrency(entries, 5, async (entry) => ({
    entry,
    imageBuf: fetchPhoto && entry.imageUrl ? await fetchImageBuffer(entry.imageUrl, 1600) : null,
    qrBuf:
      opts.includeQr && opts.mode === "signage"
        ? await generateQrBuffer(entry.customPurchaseUrl || productUrl(entry.slug, baseUrl))
        : null,
  }));
}

function registerFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont("Heading", FONT_FILES.black());
  doc.registerFont("Bold", FONT_FILES.bold());
  doc.registerFont("Medium", FONT_FILES.medium());
  doc.registerFont("Body", FONT_FILES.regular());
  doc.registerFont("Light", FONT_FILES.light());
  doc.registerFont("Italic", FONT_FILES.italic());
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

// Draw a centered image scaled to fit, returns the height consumed.
function drawImage(doc: PDFKit.PDFDocument, buf: Buffer, maxW: number, maxH: number, centered: boolean) {
  const dims = imageDimensions(buf);
  let w = maxW;
  let h = maxH;
  if (dims && dims.width && dims.height) {
    const ratio = Math.min(maxW / dims.width, maxH / dims.height);
    w = dims.width * ratio;
    h = dims.height * ratio;
  }
  const x = centered ? doc.page.margins.left + (contentWidth(doc) - w) / 2 : doc.page.margins.left;
  doc.image(buf, x, doc.y, { width: w, height: h });
  doc.y += h;
  return h;
}

// Draw a single signage card at the given top-left origin (cardX, cardY).
function drawSignageCard(
  doc: PDFKit.PDFDocument,
  asset: PreparedAsset,
  opts: PdfOptions,
  cardX: number,
  cardY: number,
) {
  const { entry } = asset;
  const baseHost = (opts.storeBaseUrl || STORE_BASE_URL)
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  // Cut-guide border
  doc
    .rect(cardX, cardY, CARD_W, CARD_H)
    .lineWidth(0.5)
    .strokeColor("#CCCCCC")
    .stroke();

  const innerX = cardX + CARD_INNER_M;
  const innerW = CARD_W - CARD_INNER_M * 2;
  const innerTop = cardY + CARD_INNER_M;

  // Reserve space for bottom row and caption above it
  const bottomRowH = 52;
  const captionH = 11;
  const captionGap = 3;
  const captionY = cardY + CARD_H - CARD_INNER_M - bottomRowH - captionGap - captionH;
  const bottomRowY = cardY + CARD_H - CARD_INNER_M - bottomRowH;

  // ── Text block ───────────────────────────────────────────────────────
  let curY = innerTop;

  // Title
  doc
    .font("Heading")
    .fontSize(16)
    .fillColor(HEX(BRAND.evergreen))
    .text(entry.displayTitle, innerX, curY, { width: innerW, align: "left", lineBreak: true });
  curY = doc.y + 4;

  // Description — clamp to available height with ellipsis
  if (entry.description) {
    const descAvail = captionY - curY - 24; // reserve ~24pt for size line
    if (descAvail > 10) {
      doc
        .font("Body")
        .fontSize(9)
        .fillColor(HEX(BRAND.textDark))
        .text(entry.description, innerX, curY, {
          width: innerW,
          align: "left",
          lineGap: 1,
          height: descAvail,
          ellipsis: true,
        });
      curY = doc.y + 4;
    }
  }

  // Featured size + price (omitted when includePrice is explicitly false)
  const featured = entry.featuredOverride || pickFeaturedSize(entry, opts.featuredSize || "largest");
  if (featured && opts.includePrice !== false) {
    const rate = opts.discountRate || 0;
    const showPrice = rate > 0
      ? Math.round(featured.priceCents * (1 - rate / 100) / 500) * 500
      : featured.priceCents;
    const priceBlockH = rate > 0 ? 32 : 18;
    const sizeY = Math.min(curY, captionY - priceBlockH);
    doc
      .font("Bold")
      .fontSize(11)
      .fillColor(HEX(BRAND.midtone))
      .text(
        `${formatSizeLabel(featured.sizeLabel)}  —  ${formatPrice(showPrice)}`,
        innerX,
        sizeY,
        { width: innerW, align: "left", lineBreak: false },
      );
    if (rate > 0) {
      doc
        .font("Light")
        .fontSize(8)
        .fillColor(HEX(BRAND.granite))
        .text(
          `${rate}% show price · list ${formatPrice(featured.priceCents)}`,
          innerX,
          sizeY + 15,
          { width: innerW, align: "left", lineBreak: false },
        );
    }
  }

  // "More sizes" caption — left-aligned just above bottom row
  doc
    .font("Light")
    .fontSize(7.5)
    .fillColor(HEX(BRAND.granite))
    .text(`More sizes at ${baseHost}`, innerX, captionY, { width: innerW, align: "left" });

  // ── Bottom row: sponsor logo | Cascadia logo | QR code ───────────────
  const qrSize = 48;
  const logoMaxH = bottomRowH - 4;
  const logoMaxW = 90;

  // Sponsor/show logo — left-aligned
  if (opts.showLogo) {
    const dims = imageDimensions(opts.showLogo);
    const ratio = dims ? Math.min(logoMaxW / dims.width, logoMaxH / dims.height) : 1;
    const w = dims ? dims.width * ratio : logoMaxW;
    const h = dims ? dims.height * ratio : logoMaxH;
    doc.image(opts.showLogo, innerX, bottomRowY + (bottomRowH - h) / 2, { width: w, height: h });
  }

  // Cascadia brand logo — centered in the card inner width
  if (opts.brandLogo) {
    const dims = imageDimensions(opts.brandLogo);
    const ratio = dims ? Math.min(logoMaxW / dims.width, logoMaxH / dims.height) : 1;
    const w = dims ? dims.width * ratio : logoMaxW;
    const h = dims ? dims.height * ratio : logoMaxH;
    const logoX = innerX + (innerW - w) / 2;
    doc.image(opts.brandLogo, logoX, bottomRowY + (bottomRowH - h) / 2, { width: w, height: h });
  }

  // QR code — right-aligned
  if (asset.qrBuf) {
    const qrX = innerX + innerW - qrSize;
    const qrY = bottomRowY + (bottomRowH - qrSize) / 2;
    doc.image(asset.qrBuf, qrX, qrY, { width: qrSize, height: qrSize });
  }
}

function buildSignage(doc: PDFKit.PDFDocument, assets: PreparedAsset[], opts: PdfOptions) {
  for (let i = 0; i < assets.length; i++) {
    // New page after every second card; first card uses the auto-first page
    if (i > 0 && i % 2 === 0) {
      doc.addPage();
    }
    const slot = i % 2; // 0 = top card, 1 = bottom card
    drawSignageCard(doc, assets[i], opts, CARD_X[slot], CARD_Y_POS[slot]);
  }
}

const CHROMALUXE_NOTE =
  "This image is printed on ChromaLuxe aluminum, an archival metal print process that produces exceptional color, depth, and durability.";

// ── Page footer (drawn at absolute coordinates; does not affect doc.y) ────────

function drawPageFooter(
  doc: PDFKit.PDFDocument,
  pageNum: number,
  mode: "portfolio" | "signage",
) {
  const year = new Date().getFullYear();
  const pageW = doc.page.width;
  const pageH = doc.page.height;

  let footerY: number;
  let leftM: number;
  let cw: number;

  // ── Measure actual line height BEFORE computing footerY ─────────────────
  // LineWrapper.wrap() checks: doc.y + lineHeight > page.maxY() → new page.
  // We must ensure footerY + lineHeight ≤ maxY() or every footer draw creates
  // a spurious overflow page. Measuring with the real font+size avoids guessing.
  doc.font("Light").fontSize(7);
  const footerLineH = doc.currentLineHeight(true);

  if (mode === "signage") {
    // Signage: 72 pt of white space below the bottom card — center everything there.
    // maxY() = pageH (margins.bottom = 0), so any Y below the cards is safe.
    leftM = 20;
    cw = pageW - leftM * 2;
    footerY = CARD_Y_POS[1] + CARD_H + (pageH - (CARD_Y_POS[1] + CARD_H)) / 2 - 8;
  } else {
    leftM = doc.page.margins.left;
    cw = pageW - leftM - doc.page.margins.right;
    // maxY() = pageH - margins.bottom. Keep footerY + lineHeight safely ≤ maxY().
    const maxY = pageH - doc.page.margins.bottom;
    footerY = maxY - footerLineH - 3; // 3 pt gap above the hard boundary

    // Thin separator line just above the footer text
    doc.save()
      .moveTo(leftM, footerY - 6)
      .lineTo(leftM + cw, footerY - 6)
      .lineWidth(0.3)
      .strokeColor(HEX(BRAND.granite))
      .stroke()
      .restore();
  }

  doc.save();

  // Left segment: © year name · gallery
  doc
    .font("Light")
    .fontSize(7)
    .fillColor(HEX(BRAND.granite))
    .text(
      `© ${year} Christopher F McNulty  ·  Cascadia Oceanic`,
      leftM,
      footerY,
      { width: cw * 0.55, align: "left", lineBreak: false },
    );

  // Centre segment: website
  doc
    .font("Light")
    .fontSize(7)
    .fillColor(HEX(BRAND.granite))
    .text("www.chrismcnulty.net", leftM, footerY, {
      width: cw,
      align: "center",
      lineBreak: false,
    });

  // Right segment: page number
  doc
    .font("Light")
    .fontSize(7)
    .fillColor(HEX(BRAND.granite))
    .text(`${pageNum}`, leftM, footerY, {
      width: cw,
      align: "right",
      lineBreak: false,
    });

  doc.restore();
}

// ── Portfolio cover contact block ─────────────────────────────────────────────

function drawCoverContact(doc: PDFKit.PDFDocument, afterTitleY: number) {
  const leftM = doc.page.margins.left;
  const cw = contentWidth(doc);

  // Rule sits 24 pt below the last line of the title block
  const ruleY = afterTitleY + 24;
  const contactY = ruleY + 14;

  doc.save();

  // Thin rule above the contact block
  doc
    .moveTo(leftM + cw * 0.2, ruleY)
    .lineTo(leftM + cw * 0.8, ruleY)
    .lineWidth(0.5)
    .strokeColor(HEX(BRAND.midtone))
    .stroke();

  doc
    .font("Body")
    .fontSize(11)
    .fillColor(HEX(BRAND.midtone))
    .text("Photography by Chris McNulty", leftM, contactY, {
      width: cw,
      align: "center",
      lineBreak: false,
    });

  doc
    .font("Light")
    .fontSize(10)
    .fillColor(HEX(BRAND.granite))
    .text("www.chrismcnulty.net", leftM, contactY + 18, {
      width: cw,
      align: "center",
      lineBreak: false,
    });

  doc.restore();
}

// ─────────────────────────────────────────────────────────────────────────────

function buildPortfolio(doc: PDFKit.PDFDocument, assets: PreparedAsset[], opts: PdfOptions) {
  const cw = contentWidth(doc);
  const pageH = doc.page.height;

  // Cover page — logo sits above the title block
  const logoBuffer = opts.brandLogo ?? null;
  const logoMaxW = 120;
  const logoMaxH = 120;
  let logoH = 0;

  if (logoBuffer) {
    const dims = imageDimensions(logoBuffer);
    const ratio = dims ? Math.min(logoMaxW / dims.width, logoMaxH / dims.height) : 1;
    const lw = dims ? dims.width * ratio : logoMaxW;
    const lh = dims ? dims.height * ratio : logoMaxH;
    logoH = lh;
    // Start the whole block (logo + gap + title) centered vertically
    const blockStartY = pageH * 0.28;
    const logoX = doc.page.margins.left + (cw - lw) / 2;
    doc.image(logoBuffer, logoX, blockStartY, { width: lw, height: lh });
    doc.y = blockStartY + lh + 18; // gap below logo before title
  } else {
    doc.y = pageH / 2 - 80;
  }

  doc.font("Heading").fontSize(48).fillColor(HEX(BRAND.evergreen)).text(opts.title, { align: "center" });
  doc.moveDown(0.4);
  if (opts.subtitle) {
    doc.font("Light").fontSize(20).fillColor(HEX(BRAND.midtone)).text(opts.subtitle, { align: "center" });
    doc.moveDown(0.4);
  }
  doc.font("Body").fontSize(14).fillColor(HEX(BRAND.granite)).text("Cascadia Oceanic Gallery", { align: "center" });

  // Contact block — pass current doc.y so the rule is anchored below the title, not at a fixed fraction
  drawCoverContact(doc, doc.y);

  assets.forEach((a) => {
    doc.addPage();
    const { entry } = a;
    if (a.imageBuf) {
      drawImage(doc, a.imageBuf, cw, 300, false);
      doc.moveDown(0.8);
    }
    doc.font("Heading").fontSize(26).fillColor(HEX(BRAND.evergreen)).text(entry.displayTitle);
    doc.font("Light").fontSize(11).fillColor(HEX(BRAND.midtone)).text(entry.collectionName || "");
    doc.moveDown(0.5);

    if (entry.description) {
      doc.font("Body").fontSize(12).fillColor(HEX(BRAND.textDark)).text(entry.description, { lineGap: 2 });
      doc.moveDown(0.7);
    }

    if (entry.sizes.length) {
      doc.font("Heading").fontSize(12).fillColor(HEX(BRAND.midtone)).text("Available sizes");
      doc.moveDown(0.2);
      for (const s of entry.sizes) {
        doc.font("Body").fontSize(11).fillColor(HEX(BRAND.textDark)).text(`${formatSizeLabel(s.sizeLabel)}`, { continued: true });
        doc.fillColor(HEX(BRAND.granite)).text(`   ·   ${s.mediaType}   ·   ${formatPrice(s.priceCents)}`);
      }
      doc.moveDown(0.6);
    }
    doc.font("Italic").fontSize(9.5).fillColor(HEX(BRAND.granite)).text(CHROMALUXE_NOTE);
  });
}

export async function generateCatalogPdf(entries: CatalogEntry[], opts: PdfOptions): Promise<Buffer> {
  const assets = await prepareAssets(entries, opts);

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const isSignage = opts.mode === "signage";
      const doc = new PDFDocument({
        size: isSignage ? [SIG_PAGE_W, SIG_PAGE_H] : "LETTER",
        margins: isSignage
          ? { top: 0, bottom: 0, left: 0, right: 0 }
          : { top: 54, bottom: 54, left: 60, right: 60 },
        info: { Title: opts.title, Author: "Cascadia Oceanic" },
        autoFirstPage: true,
        // bufferPages keeps all pages in memory so we can switchToPage() in a
        // post-pass to stamp footers — avoids the recursive pageAdded→text→addPage
        // loop that caused "Maximum call stack size exceeded" in production.
        bufferPages: true,
      });
      registerFonts(doc);

      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      if (opts.mode === "signage") buildSignage(doc, assets, opts);
      else buildPortfolio(doc, assets, opts);

      // ── Footer post-pass ─────────────────────────────────────────────────
      // With bufferPages:true all pages are still in memory. Iterate them now,
      // switch to each one and stamp the footer at absolute coordinates.
      // This happens entirely outside the text-flow event chain, so there is
      // no risk of re-entrant addPage / continueOnNewPage calls.
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        const isPortfolioCover = opts.mode === "portfolio" && i === 0;
        if (!isPortfolioCover) {
          doc.switchToPage(i);
          // Reset cursor to top margin — after switchToPage, doc.y retains the
          // last content position on that page which may be past maxY(), causing
          // doc.text() to immediately trigger continueOnNewPage() before drawing.
          doc.y = isSignage ? 0 : doc.page.margins.top;
          // Content page number: portfolio page index 1 = display "1"; signage index 0 = display "1"
          const displayNum = opts.mode === "portfolio" ? i : i + 1;
          drawPageFooter(doc, displayNum, opts.mode);
        }
      }

      doc.end();
    } catch (e) {
      reject(e as Error);
    }
  });
}
