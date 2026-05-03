import crypto from "crypto";

function getKey(): Buffer {
  const secret = process.env.SOCIAL_TOKEN_KEY || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SOCIAL_TOKEN_KEY or SESSION_SECRET must be set to encrypt social access tokens"
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

export function decryptToken(payload: string): string {
  const [version, ivB, tagB, encB] = payload.split(":");
  if (version !== "v1") throw new Error("Unsupported token format");
  const iv = Buffer.from(ivB, "base64");
  const tag = Buffer.from(tagB, "base64");
  const enc = Buffer.from(encB, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

export function loadAccountToken(account: {
  accessTokenEncrypted: string | null;
  tokenSecretKey: string | null;
}): string {
  if (account.accessTokenEncrypted) {
    return decryptToken(account.accessTokenEncrypted);
  }
  if (account.tokenSecretKey) {
    const t = process.env[account.tokenSecretKey];
    if (t) return t;
  }
  throw new Error(
    "No access token available for this social account; reconnect required"
  );
}
