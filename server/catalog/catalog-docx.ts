import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  PageBreak,
  PageOrientation,
} from "docx";
import type { CatalogEntry } from "./catalog-data";
import {
  BRAND,
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

const FONT_HEADING = "Metro Nova Pro Black";
const FONT_BODY = "Metro Nova Pro";
const FONT_LIGHT = "Metro Nova Pro Light";

export interface DocxOptions {
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

interface PreparedAsset {
  entry: CatalogEntry;
  imageBuf: Buffer | null;
  imageType: "jpg" | "png";
  imageDims: { width: number; height: number } | null;
  qrBuf: Buffer | null;
}

function detectType(buf: Buffer): "jpg" | "png" {
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  return "png";
}

function scaleToFit(
  dims: { width: number; height: number } | null,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  if (!dims || !dims.width || !dims.height) return { width: maxW, height: Math.round(maxW * 0.66) };
  const ratio = Math.min(maxW / dims.width, maxH / dims.height);
  return { width: Math.round(dims.width * ratio), height: Math.round(dims.height * ratio) };
}

async function prepareAssets(
  entries: CatalogEntry[],
  opts: DocxOptions,
): Promise<PreparedAsset[]> {
  const baseUrl = opts.storeBaseUrl || STORE_BASE_URL;
  const includePhoto = opts.mode !== "signage" || opts.includePhoto !== false;
  return mapWithConcurrency(entries, 5, async (entry) => {
    const imageBuf = includePhoto && entry.imageUrl ? await fetchImageBuffer(entry.imageUrl, 1600) : null;
    const qrBuf =
      opts.includeQr && opts.mode === "signage"
        ? await generateQrBuffer(entry.customPurchaseUrl || productUrl(entry.slug, baseUrl))
        : null;
    return {
      entry,
      imageBuf,
      imageType: imageBuf ? detectType(imageBuf) : "png",
      imageDims: imageBuf ? imageDimensions(imageBuf) : null,
      qrBuf,
    };
  });
}

function heading(text: string, size: number, color: string, opts: { spacingAfter?: number; spacingBefore?: number; align?: any } = {}) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { after: opts.spacingAfter ?? 120, before: opts.spacingBefore ?? 0 },
    children: [new TextRun({ text, font: FONT_HEADING, bold: true, size, color })],
  });
}

function bodyPara(text: string, opts: { size?: number; color?: string; italics?: boolean; font?: string; align?: any; spacingAfter?: number } = {}) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { after: opts.spacingAfter ?? 120, line: 276 },
    children: [
      new TextRun({
        text,
        font: opts.font ?? FONT_BODY,
        size: opts.size ?? 22,
        color: opts.color ?? BRAND.textDark,
        italics: opts.italics,
      }),
    ],
  });
}

const CHROMALUXE_NOTE =
  "This image is printed on ChromaLuxe aluminum, an archival metal print process that produces exceptional color, depth, and durability.";

function buildSignageChildren(assets: PreparedAsset[], opts: DocxOptions): Paragraph[] {
  const children: Paragraph[] = [];
  assets.forEach((a, idx) => {
    const { entry } = a;
    // Brand / show logos row
    const logoRuns: ImageRun[] = [];
    if (opts.showLogo) {
      const d = scaleToFit(imageDimensions(opts.showLogo), 120, 70);
      logoRuns.push(new ImageRun({ data: opts.showLogo, type: detectType(opts.showLogo), transformation: d }));
    }
    if (opts.brandLogo) {
      const d = scaleToFit(imageDimensions(opts.brandLogo), 90, 90);
      logoRuns.push(new ImageRun({ data: opts.brandLogo, type: detectType(opts.brandLogo), transformation: d }));
    }
    if (logoRuns.length) {
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: logoRuns }));
    }

    // Photo
    if (a.imageBuf) {
      const d = scaleToFit(a.imageDims, 560, 470);
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 220 },
          children: [new ImageRun({ data: a.imageBuf, type: a.imageType, transformation: d })],
        }),
      );
    }

    // Title
    children.push(heading(entry.displayTitle, 40, BRAND.evergreen, { align: AlignmentType.CENTER, spacingAfter: 140 }));

    // Description
    if (entry.description) {
      children.push(bodyPara(entry.description, { size: 24, align: AlignmentType.CENTER, spacingAfter: 200 }));
    }

    // Featured size + price (omitted when includePrice is explicitly false)
    const featured = entry.featuredOverride || pickFeaturedSize(entry, opts.featuredSize || "largest");
    if (featured && opts.includePrice !== false) {
      const rate = opts.discountRate || 0;
      const showPrice = rate > 0
        ? Math.round(featured.priceCents * (1 - rate / 100) / 500) * 500
        : featured.priceCents;
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: rate > 0 ? 20 : 80 },
          children: [
            new TextRun({
              text: `${formatSizeLabel(featured.sizeLabel)} — ${formatPrice(showPrice)}`,
              font: FONT_HEADING,
              bold: true,
              size: 30,
              color: BRAND.midtone,
            }),
          ],
        }),
      );
      if (rate > 0) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: `${rate}% show price · list ${formatPrice(featured.priceCents)}`,
                font: FONT_LIGHT,
                size: 18,
                color: BRAND.granite,
              }),
            ],
          }),
        );
      }
    }

    // More sizes line
    const baseHost = (opts.storeBaseUrl || STORE_BASE_URL).replace(/^https?:\/\//, "").replace(/\/$/, "");
    children.push(bodyPara(`More sizes at ${baseHost}`, { size: 20, color: BRAND.granite, align: AlignmentType.CENTER, font: FONT_LIGHT, spacingAfter: 160 }));

    // QR code
    if (a.qrBuf) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new ImageRun({ data: a.qrBuf, type: "png", transformation: { width: 110, height: 110 } })],
        }),
      );
    }

    // Brand footer
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120 },
        children: [new TextRun({ text: "Cascadia Oceanic", font: FONT_HEADING, bold: true, size: 24, color: BRAND.evergreen })],
      }),
    );

    if (idx < assets.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });
  return children;
}

function buildPortfolioChildren(assets: PreparedAsset[], opts: DocxOptions): Paragraph[] {
  const children: Paragraph[] = [];

  // Cover page
  children.push(new Paragraph({ spacing: { before: 2400, after: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: opts.title, font: FONT_HEADING, bold: true, size: 72, color: BRAND.evergreen })] }));
  if (opts.subtitle) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: opts.subtitle, font: FONT_LIGHT, size: 32, color: BRAND.midtone })] }));
  }
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Cascadia Oceanic", font: FONT_BODY, size: 24, color: BRAND.granite })] }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  assets.forEach((a, idx) => {
    const { entry } = a;
    if (a.imageBuf) {
      const d = scaleToFit(a.imageDims, 460, 360);
      children.push(new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 160 }, children: [new ImageRun({ data: a.imageBuf, type: a.imageType, transformation: d })] }));
    }
    children.push(heading(entry.displayTitle, 36, BRAND.evergreen, { spacingAfter: 60 }));
    children.push(bodyPara(entry.collectionName || "", { size: 18, color: BRAND.midtone, font: FONT_LIGHT, spacingAfter: 120 }));
    if (entry.description) {
      children.push(bodyPara(entry.description, { size: 22, spacingAfter: 160 }));
    }

    // Sizes
    if (entry.sizes.length) {
      children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Available sizes", font: FONT_HEADING, bold: true, size: 22, color: BRAND.midtone })] }));
      for (const s of entry.sizes) {
        children.push(
          new Paragraph({
            spacing: { after: 30 },
            children: [
              new TextRun({ text: `${formatSizeLabel(s.sizeLabel)}`, font: FONT_BODY, size: 20, color: BRAND.textDark }),
              new TextRun({ text: `  ·  ${s.mediaType}  ·  ${formatPrice(s.priceCents)}`, font: FONT_BODY, size: 20, color: BRAND.granite }),
            ],
          }),
        );
      }
    }
    children.push(bodyPara(CHROMALUXE_NOTE, { size: 18, color: BRAND.granite, italics: true, font: FONT_LIGHT, spacingAfter: 120 }));

    if (idx < assets.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });
  return children;
}

export async function generateCatalogDocx(entries: CatalogEntry[], opts: DocxOptions): Promise<Buffer> {
  const assets = await prepareAssets(entries, opts);
  const children =
    opts.mode === "signage" ? buildSignageChildren(assets, opts) : buildPortfolioChildren(assets, opts);

  const doc = new Document({
    creator: "Cascadia Oceanic",
    title: opts.title,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 1080, right: 1080 },
            size: { orientation: PageOrientation.PORTRAIT },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
