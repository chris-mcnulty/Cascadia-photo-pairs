import { storage } from "./storage";

const CASCADIA_GREEN = "#2d5f3f";
const CASCADIA_SAGE = "#94b46c";
const CASCADIA_BLUE = "#4a92b3";
const LIGHT_BG = "#f7f9fa";

export interface BrandedEmailOptions {
  bodyHtml: string;
  unsubscribeUrl?: string;
  supportEmail?: string;
  mailingAddress?: string;
  recipientEmail?: string;
  logoUrl?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function renderBrandedEmail(opts: BrandedEmailOptions): Promise<string> {
  const settings = await storage.getSettings().catch(() => null);
  const supportEmail = opts.supportEmail || settings?.supportEmail || "support@cascadiaoceanic.com";
  const mailingAddress =
    opts.mailingAddress ||
    settings?.campaignMailingAddress ||
    "Cascadia Oceanic LLC, Seattle, WA, USA";
  const baseUrl = process.env.BASE_URL || "https://voting.chrismcnulty.net";
  const logoUrl = opts.logoUrl || `${baseUrl}/cascadia-logo.png`;

  const unsubscribeBlock = opts.unsubscribeUrl
    ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">
         You're receiving this email${opts.recipientEmail ? ` at ${escapeHtml(opts.recipientEmail)}` : ""} as part of the Cascadia Oceanic mailing list.
         <br>
         <a href="${opts.unsubscribeUrl}" clicktracking="off" style="color: ${CASCADIA_GREEN}; text-decoration: underline;">Unsubscribe</a>
         &nbsp;|&nbsp;
         <a href="mailto:${escapeHtml(supportEmail)}" style="color: ${CASCADIA_GREEN}; text-decoration: underline;">Contact us</a>
       </p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cascadia Oceanic</title>
</head>
<body style="margin:0;padding:0;background:${LIGHT_BG};font-family: Arial, Helvetica, sans-serif;color:#222;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${LIGHT_BG};padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:${CASCADIA_GREEN};padding:20px 24px;" align="left">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:12px;">
                  <img src="${logoUrl}" alt="Cascadia Oceanic" width="48" height="48" style="display:block;border:0;background:#fff;border-radius:4px;padding:4px;">
                </td>
                <td style="vertical-align:middle;color:#ffffff;font-family:Arial,sans-serif;font-size:20px;font-weight:bold;letter-spacing:0.5px;">
                  Cascadia Oceanic
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px 32px;font-size:15px;line-height:1.55;color:#222;">
            ${opts.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="border-top:3px solid ${CASCADIA_SAGE};background:#fafbfc;padding:20px 32px;font-size:12px;color:#666;line-height:1.5;">
            <p style="margin:0 0 6px 0;"><strong style="color:${CASCADIA_GREEN};">Cascadia Oceanic</strong></p>
            <p style="margin:0 0 6px 0;">${escapeHtml(mailingAddress)}</p>
            <p style="margin:0;">Questions? Email <a href="mailto:${escapeHtml(supportEmail)}" style="color:${CASCADIA_BLUE};">${escapeHtml(supportEmail)}</a></p>
            ${unsubscribeBlock}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
