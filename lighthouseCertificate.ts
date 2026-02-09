/**
 * Lighthouse Certificate Service
 *
 * Generates and manages cryptographic certificates for Infinity-One accounts.
 * Certificates validate user identity and permissions across all Trancendos apps.
 */

import * as crypto from "crypto";
import { nanoid } from "nanoid";
import { getDb } from "../db";
import { infinityOneAccounts, lighthouseCertificates, certificateRevocationList } from "../../drizzle/infinity-one-schema";
import { eq } from "drizzle-orm";

const CERTIFICATE_VALIDITY_DAYS = 90;
const MASTER_ENCRYPTION_KEY = process.env.LIGHTHOUSE_MASTER_KEY || "default-master-key-change-in-production";

export interface CertificateSubject {
  commonName: string;
  email: string;
  userId: string;
  openId: string;
  organization?: string;
}

export interface CertificateIssuer {
  commonName: string;
  organization: string;
  country: string;
}

/**
 * Generate a new Lighthouse certificate for an Infinity-One account
 */
export async function generateLighthouseCertificate(infinityOneAccountId: string): Promise<string> {
  /* jscpd:ignore-start */
  const db = await getDb();

  if (!db) {
    throw new Error("Database not available");
  }

  // Get account details
  const [account] = await db
    .select()
    .from(infinityOneAccounts)
    .where(eq(infinityOneAccounts.id, infinityOneAccountId))
    .limit(1);
  /* jscpd:ignore-end */

  if (!account) {
    throw new Error("Account not found");
  }

  // Generate RSA key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  // Prepare certificate subject
  const subject: CertificateSubject = {
    commonName: account.masterProfile.name,
    email: account.masterProfile.email,
    userId: account.userId.toString(),
    openId: account.openId,
    organization: account.masterProfile.company,
  };

  // Prepare certificate issuer
  const issuer: CertificateIssuer = {
    commonName: "Lighthouse Certificate Authority",
    organization: "Trancendos",
    country: "US",
  };

  // Calculate validity dates
  const issuedAt = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CERTIFICATE_VALIDITY_DAYS);

  // Create certificate data
  const certificateData = {
    version: 1,
    serialNumber: nanoid(16),
    subject,
    issuer,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    publicKey,
  };

  // Generate certificate hash
  const certificateHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(certificateData))
    .digest("hex");

  // Sign certificate
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(JSON.stringify(certificateData))
    .sign(privateKey, "base64");

  // Encrypt private key
  const encryptedPrivateKey = encryptPrivateKey(privateKey);

  // Store certificate in database
  const certificateId = nanoid();
  await db.insert(lighthouseCertificates).values({
    id: certificateId,
    infinityOneAccountId,
    certificateHash,
    publicKey,
    privateKey: encryptedPrivateKey,
    certificateVersion: 1,
    subject,
    issuer,
    issuedAt,
    expiresAt,
    notBefore: issuedAt,
    status: "active",
    signature,
    signatureAlgorithm: "RS256",
    keyUsage: ["digitalSignature", "keyEncipherment"],
    extendedKeyUsage: ["clientAuth"],
    renewalCount: 0,
    autoRenewEnabled: true,
  });

  // Update Infinity-One account with certificate reference
  await db
    .update(infinityOneAccounts)
    .set({
      lighthouseCertificateId: certificateId,
      certificateHash,
      certificateExpiry: expiresAt,
      certificateStatus: "active",
    })
    .where(eq(infinityOneAccounts.id, infinityOneAccountId));

  return certificateId;
}

/**
 * Renew an existing certificate
 */
export async function renewCertificate(infinityOneAccountId: string): Promise<string> {
  const db = await getDb();

  if (!db) {
    throw new Error("Database not available");
  }

  // Get current certificate
  const [account] = await db
    .select()
    .from(infinityOneAccounts)
    .where(eq(infinityOneAccounts.id, infinityOneAccountId))
    .limit(1);

  if (!account || !account.lighthouseCertificateId) {
    // No existing certificate, generate new one
    return await generateLighthouseCertificate(infinityOneAccountId);
  }

  const [currentCert] = await db
    .select()
    .from(lighthouseCertificates)
    .where(eq(lighthouseCertificates.id, account.lighthouseCertificateId))
    .limit(1);

  if (!currentCert) {
    return await generateLighthouseCertificate(infinityOneAccountId);
  }

  // Mark old certificate as superseded
  await revokeCertificate(currentCert.id, "superseded", null);

  // Generate new certificate
  const newCertificateId = await generateLighthouseCertificate(infinityOneAccountId);

  // Update renewal count
  await db
    .update(lighthouseCertificates)
    .set({
      renewalCount: currentCert.renewalCount + 1,
      lastRenewedAt: new Date(),
    })
    .where(eq(lighthouseCertificates.id, newCertificateId));

  return newCertificateId;
}

/**
 * Revoke a certificate
 */
export async function revokeCertificate(
  certificateId: string,
  reason: "user_request" | "security_breach" | "account_closure" | "key_compromise" | "superseded" | "administrative",
  revokedBy: number | null
): Promise<void> {
  const db = await getDb();

  if (!db) {
    throw new Error("Database not available");
  }

  const [certificate] = await db
    .select()
    .from(lighthouseCertificates)
    .where(eq(lighthouseCertificates.id, certificateId))
    .limit(1);

  if (!certificate) {
    throw new Error("Certificate not found");
  }

  // Update certificate status
  await db
    .update(lighthouseCertificates)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      revocationReason: reason,
    })
    .where(eq(lighthouseCertificates.id, certificateId));

  // Add to revocation list
  await db.insert(certificateRevocationList).values({
    id: nanoid(),
    certificateId,
    certificateHash: certificate.certificateHash,
    revokedAt: new Date(),
    revokedBy: revokedBy || 0,
    reason,
    effectiveDate: new Date(),
  });

  // Update account certificate status
  await db
    .update(infinityOneAccounts)
    .set({
      certificateStatus: "revoked",
    })
    .where(eq(infinityOneAccounts.lighthouseCertificateId, certificateId));
}

/**
 * Verify a certificate
 */
export async function verifyCertificate(certificateHash: string): Promise<{
  valid: boolean;
  certificate?: any;
  reason?: string;
}> {
  const db = await getDb();

  if (!db) {
    throw new Error("Database not available");
  }

  // Check if certificate exists
  const [certificate] = await db
    .select()
    .from(lighthouseCertificates)
    .where(eq(lighthouseCertificates.certificateHash, certificateHash))
    .limit(1);

  if (!certificate) {
    return {
      valid: false,
      reason: "Certificate not found",
    };
  }

  // Check if revoked
  if (certificate.status === "revoked") {
    return {
      valid: false,
      reason: "Certificate has been revoked",
    };
  }

  // Check if expired
  if (new Date() > certificate.expiresAt) {
    return {
      valid: false,
      reason: "Certificate has expired",
    };
  }

  // Check not before date
  if (new Date() < certificate.notBefore) {
    return {
      valid: false,
      reason: "Certificate is not yet valid",
    };
  }

  // Verify signature
  const certificateData = {
    version: certificate.certificateVersion,
    subject: certificate.subject,
    issuer: certificate.issuer,
    issuedAt: certificate.issuedAt.toISOString(),
    expiresAt: certificate.expiresAt.toISOString(),
    publicKey: certificate.publicKey,
  };

  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(JSON.stringify(certificateData));

  try {
    const isValid = verify.verify(certificate.publicKey, certificate.signature, "base64");

    if (!isValid) {
      return {
        valid: false,
        reason: "Invalid certificate signature",
      };
    }
  } catch (error) {
    return {
      valid: false,
      reason: "Signature verification failed",
    };
  }

  return {
    valid: true,
    certificate,
  };
}

/**
 * Check if certificate needs renewal (within 30 days of expiry)
 */
export async function checkCertificateRenewal(infinityOneAccountId: string): Promise<boolean> {
  const db = await getDb();

  if (!db) {
    throw new Error("Database not available");
  }

  const [account] = await db
    .select()
    .from(infinityOneAccounts)
    .where(eq(infinityOneAccounts.id, infinityOneAccountId))
    .limit(1);

  if (!account || !account.certificateExpiry) {
    return true; // Needs renewal
  }

  const daysUntilExpiry = Math.floor(
    (account.certificateExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return daysUntilExpiry <= 30;
}

/**
 * Auto-renew certificates that are expiring soon
 */
export async function autoRenewCertificates(): Promise<void> {
  const db = await getDb();

  if (!db) {
    throw new Error("Database not available");
  }

  // Find certificates expiring in next 30 days with auto-renew enabled
  const expiringDate = new Date();
  expiringDate.setDate(expiringDate.getDate() + 30);

  const expiringCertificates = await db
    .select()
    .from(lighthouseCertificates)
    .where(eq(lighthouseCertificates.autoRenewEnabled, true));

  for (const cert of expiringCertificates) {
    if (cert.expiresAt <= expiringDate && cert.status === "active") {
      try {
        await renewCertificate(cert.infinityOneAccountId);
        console.log(`[Lighthouse] Auto-renewed certificate ${cert.id}`);
      } catch (error) {
        console.error(`[Lighthouse] Failed to auto-renew certificate ${cert.id}:`, error);
      }
    }
  }
}

/**
 * Derive encryption key and IV using SHA-256 for stronger security.
 *
 * @param password The master password
 * @returns Object containing 32-byte key and 16-byte IV
 */
function deriveKeyAndIv(password: string): { key: Buffer; iv: Buffer } {
  const key = crypto.createHash('sha256').update(password).digest();
  const iv = crypto.randomBytes(12);
  return { key, iv };
}

/**
 * Derive legacy encryption key and IV using MD5 (OpenSSL-compatible)
 * Used for backward compatibility with existing encrypted keys.
 *
 * @param password The master password
 * @returns Object containing 32-byte key and 16-byte IV
 */
function deriveLegacyKeyAndIv(password: string): { key: Buffer; iv: Buffer } {
  const passwordBuf = Buffer.from(password);
  let d = Buffer.alloc(0);
  let d_prev = Buffer.alloc(0);

  // We need 32 bytes (Key) + 16 bytes (IV) = 48 bytes for aes-256-cbc
  while (d.length < 48) {
    // devskim:ignore:DS126858
    const hash = crypto.createHash("md5");
    if (d_prev.length > 0) {
      hash.update(d_prev);
    }
    hash.update(passwordBuf);
    d_prev = hash.digest();
    d = Buffer.concat([d, d_prev]);
  }

  return {
    key: d.subarray(0, 32),
    iv: d.subarray(32, 48)
  };
}

/**
 * Encrypt private key with master key using AES-256-GCM
 */
export function encryptPrivateKey(privateKey: string): string {
  const { key, iv } = deriveKeyAndIv(MASTER_ENCRYPTION_KEY);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(privateKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString('hex');

  // Format: IV:AuthTag:Ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt private key with master key.
 * Supports both new AES-256-GCM format and legacy AES-256-CBC format.
 */
export function decryptPrivateKey(encryptedPrivateKey: string): string {
  // Check for new format (contains colons for IV and AuthTag)
  if (encryptedPrivateKey.includes(':')) {
    try {
      const parts = encryptedPrivateKey.split(':');
      if (parts.length === 3) {
        const [ivHex, authTagHex, encryptedHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const key = crypto.createHash('sha256').update(MASTER_ENCRYPTION_KEY).digest();
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
      }
    } catch (error) {
      // Fallback to legacy if new format fails (though highly unlikely to clash)
    }
  }

  // Fallback to legacy decryption (AES-256-CBC with MD5 derived key)
  try {
    const { key, iv } = deriveLegacyKeyAndIv(MASTER_ENCRYPTION_KEY);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedPrivateKey, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    throw new Error("Failed to decrypt private key");
  }
}

/**
 * Get certificate for an account
 */
export async function getCertificate(infinityOneAccountId: string) {
  /* jscpd:ignore-start */
  const db = await getDb();

  if (!db) {
    throw new Error("Database not available");
  }

  const [account] = await db
    .select()
    .from(infinityOneAccounts)
    .where(eq(infinityOneAccounts.id, infinityOneAccountId))
    .limit(1);
  /* jscpd:ignore-end */

  if (!account || !account.lighthouseCertificateId) {
    return null;
  }

  const [certificate] = await db
    .select()
    .from(lighthouseCertificates)
    .where(eq(lighthouseCertificates.id, account.lighthouseCertificateId))
    .limit(1);

  return certificate;
}
