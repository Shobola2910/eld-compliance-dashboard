import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

function getKey(): Buffer {
  const key = process.env.TOKEN_ENC_KEY;
  if (!key) throw new Error("TOKEN_ENC_KEY is not set");
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENC_KEY must decode to 32 bytes");
  }
  return buf;
}

export interface EncryptedToken {
  encryptedToken: string;
  iv: string;
  authTag: string;
}

export function encryptToken(plaintext: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedToken: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptToken(row: EncryptedToken): string {
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(row.encryptedToken, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
