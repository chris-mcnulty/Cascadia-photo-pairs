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
}

const HEX = (h: string) => `#${h}`;

interface PreparedAsset {
  entry: CatalogEntry;
  imageBuf: Buffer | null;
  qrBuf: Buffer | null;
}

async function prepareAssets(entries: CatalogEntry[], opts: PdfOptions): Promise<PreparedAsset[]> {
  const baseUrl = opts.storeBaseUrl || STORE_BASE_URL;
  const includePhoto = opts.mode !== "signage" || opts.includePhoto !== false;
  return mapWithConcurrency(entries, 5, async (entry) => ({
    entry,
    imageBuf: includePhoto && entry.imageUrl ? await fetchImageBuffer(entry.imageUrl, 1600) : null,
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

function buildSignage(doc: PDFKit.PDFDocument, assets: PreparedAsset[], opts: PdfOptions) {
  const cw = contentWidth(doc);
  assets.forEach((a, idx) => {
    if (idx > 0) doc.addPage();
    const { entry } = a;

    // Logos row
    if (opts.showLogo || opts.brandLogo) {
      const startY = doc.y;
      let maxH = 0;
      if (opts.showLogo) {
        const dims = imageDimensions(opts.showLogo);
        const ratio = dims ? Math.min(110 / dims.width, 60 / dims.height) : 1;
        const w = dims ? dims.width * ratio : 110;
        const h = dims ? dims.height * ratio : 60;
        doc.image(opts.showLogo, doc.page.margins.left, startY, { width: w, height: h });
        maxH = Math.max(maxH, h);
      }
      if (opts.brandLogo) {
        const dims = imageDimensions(opts.brandLogo);
        const ratio = dims ? Math.min(70 / dims.width, 70 / dims.height) : 1;
        const w = dims ? dims.width * ratio : 70;
        const h = dims ? dims.height * ratio : 70;
        doc.image(opts.brandLogo, doc.page.margins.left + cw - w, startY, { width: w, height: h });
        maxH = Math.max(maxH, h);
      }
      doc.y = startY + maxH + 18;
    }

    if (a.imageBuf) {
      drawImage(doc, a.imageBuf, cw, 360, true);
      doc.moveDown(0.8);
    }

    doc.font("Heading").fontSize(30).fillColor(HEX(BRAND.evergreen)).text(entry.displayTitle, { align: "center" });
    doc.moveDown(0.4);

    if (entry.description) {
      doc.font("Body").fontSize(12.5).fillColor(HEX(BRAND.textDark)).text(entry.description, { align: "center", lineGap: 2 });
      doc.moveDown(0.8);
    }

    const featured = entry.featuredOverride || pickFeaturedSize(entry, opts.featuredSize || "largest");
    if (featured) {
      doc
        .font("Heading")
        .fontSize(20)
        .fillColor(HEX(BRAND.midtone))
        .text(`${formatSizeLabel(featured.sizeLabel)} — ${formatPrice(featured.priceCents)}`, { align: "center" });
      doc.moveDown(0.2);
    }

    const baseHost = (opts.storeBaseUrl || STORE_BASE_URL).replace(/^https?:\/\//, "").replace(/\/$/, "");
    doc.font("Light").fontSize(11).fillColor(HEX(BRAND.granite)).text(`More sizes at ${baseHost}`, { align: "center" });
    doc.moveDown(0.6);

    if (a.qrBuf) {
      const qx = doc.page.margins.left + (cw - 80) / 2;
      doc.image(a.qrBuf, qx, doc.y, { width: 80, height: 80 });
      doc.y += 86;
    }

    doc.font("Heading").fontSize(13).fillColor(HEX(BRAND.evergreen)).text("Cascadia Oceanic", { align: "center" });
  });
}

const CHROMALUXE_NOTE =
  "This image is printed on ChromaLuxe aluminum, an archival metal print process that produces exceptional color, depth, and durability.";

function buildPortfolio(doc: PDFKit.PDFDocument, assets: PreparedAsset[], opts: PdfOptions) {
  const cw = contentWidth(doc);

  // Cover page
  doc.y = doc.page.height / 2 - 80;
  doc.font("Heading").fontSize(48).fillColor(HEX(BRAND.evergreen)).text(opts.title, { align: "center" });
  doc.moveDown(0.4);
  if (opts.subtitle) {
    doc.font("Light").fontSize(20).fillColor(HEX(BRAND.midtone)).text(opts.subtitle, { align: "center" });
    doc.moveDown(0.4);
  }
  doc.font("Body").fontSize(14).fillColor(HEX(BRAND.granite)).text("Cascadia Oceanic", { align: "center" });

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
      const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: 54, bottom: 54, left: 60, right: 60 },
        info: { Title: opts.title, Author: "Cascadia Oceanic" },
        autoFirstPage: true,
      });
      registerFonts(doc);

      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      if (opts.mode === "signage") buildSignage(doc, assets, opts);
      else buildPortfolio(doc, assets, opts);

      doc.end();
    } catch (e) {
      reject(e as Error);
    }
  });
}
