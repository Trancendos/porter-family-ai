import { describe, it, expect } from "vitest";
import * as crypto from "crypto";
import { encryptPrivateKey, decryptPrivateKey } from "../lighthouseCertificate";

describe("Lighthouse Certificate Encryption", () => {
  const TEST_KEY = "test-private-key-content-12345";
  // Use the same fallback key as in the source file
  const MASTER_ENCRYPTION_KEY =
    process.env.LIGHTHOUSE_MASTER_KEY ||
    "default-master-key-change-in-production";

  it("should encrypt and decrypt correctly", () => {
    const encrypted = encryptPrivateKey(TEST_KEY);
    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe("string");

    const decrypted = decryptPrivateKey(encrypted);
    expect(decrypted).toBe(TEST_KEY);
  });

  it("should decrypt legacy format (aes-256-cbc)", () => {
    // Manually create a legacy encrypted string using the deprecated method's logic
    // This mimics existing data in the database
    function deriveLegacyKeyAndIv(password: string): {
      key: Buffer;
      iv: Buffer;
    } {
      const passwordBuf = Buffer.from(password);
      let d = Buffer.alloc(0);
      let d_prev = Buffer.alloc(0);
      while (d.length < 48) {
        // devskim:ignore:DS126858
        const hash = crypto.createHash("md5");
        if (d_prev.length > 0) hash.update(d_prev);
        hash.update(passwordBuf);
        d_prev = hash.digest();
        d = Buffer.concat([d, d_prev]);
      }
      return { key: d.subarray(0, 32), iv: d.subarray(32, 48) };
    }

    const { key, iv } = deriveLegacyKeyAndIv(MASTER_ENCRYPTION_KEY);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let legacyEncrypted = cipher.update(TEST_KEY, "utf8", "hex");
    legacyEncrypted += cipher.final("hex");

    const decrypted = decryptPrivateKey(legacyEncrypted);
    expect(decrypted).toBe(TEST_KEY);
  });
});
