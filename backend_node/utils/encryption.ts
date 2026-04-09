import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!key || key.length < 32) {
    throw new Error("ENCRYPTION_KEY or SESSION_SECRET must be at least 32 characters");
  }
  return crypto.createHash("sha256").update(key).digest();
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  
  return iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(":");
  
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }
  
  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

export function isEncrypted(text: string): boolean {
  const parts = text.split(":");
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32;
}
