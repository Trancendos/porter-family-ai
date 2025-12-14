/**
 * Product ID Service
 * 
 * Generates and manages:
 * - PID (Product ID) for user-created apps
 * - DPID (Domain Product ID) for admin/root apps
 */

import { randomBytes } from "crypto";

/**
 * Generate a unique Product ID (PID) for user apps
 * Format: PID-USR-{timestamp}-{random}
 * Example: PID-USR-1705155234-A7F3E9
 */
export function generatePID(): string {
  const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp
  const random = randomBytes(3).toString('hex').toUpperCase(); // 6 char hex
  return `PID-USR-${timestamp}-${random}`;
}

/**
 * Generate a unique Domain Product ID (DPID) for admin apps
 * Format: DPID-ADM-{timestamp}-{random}
 * Example: DPID-ADM-1705155234-B2C4D6
 */
export function generateDPID(): string {
  const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp
  const random = randomBytes(3).toString('hex').toUpperCase(); // 6 char hex
  return `DPID-ADM-${timestamp}-${random}`;
}

/**
 * Validate PID format
 */
export function isValidPID(pid: string): boolean {
  const pidPattern = /^PID-USR-\d{10}-[A-F0-9]{6}$/;
  return pidPattern.test(pid);
}

/**
 * Validate DPID format
 */
export function isValidDPID(dpid: string): boolean {
  const dpidPattern = /^DPID-ADM-\d{10}-[A-F0-9]{6}$/;
  return dpidPattern.test(dpid);
}

/**
 * Extract timestamp from PID/DPID
 */
export function extractTimestamp(productId: string): Date | null {
  const match = productId.match(/-(USR|ADM)-(\d{10})-/);
  if (!match) return null;
  
  const timestamp = parseInt(match[2], 10);
  return new Date(timestamp * 1000);
}

/**
 * Get product ID type
 */
export function getProductIdType(productId: string): 'user' | 'admin' | 'invalid' {
  if (isValidPID(productId)) return 'user';
  if (isValidDPID(productId)) return 'admin';
  return 'invalid';
}

/**
 * Generate product ID based on app type
 */
export function generateProductId(appType: 'root' | 'user'): { pid?: string; dpid?: string } {
  if (appType === 'root') {
    return { dpid: generateDPID() };
  } else {
    return { pid: generatePID() };
  }
}

/**
 * Format product ID for display
 * Shortens the ID for UI display while keeping it identifiable
 */
export function formatProductIdShort(productId: string): string {
  // PID-USR-1705155234-A7F3E9 → PID-...A7F3E9
  // DPID-ADM-1705155234-B2C4D6 → DPID-...B2C4D6
  const parts = productId.split('-');
  if (parts.length !== 4) return productId;
  
  return `${parts[0]}-${parts[1]}-...${parts[3]}`;
}

/**
 * Search apps by PID/DPID
 */
export async function findAppByProductId(productId: string) {
  const { getDb } = await import("../db");
  const { platformApps } = await import("../../drizzle/platform-schema");
  const { eq, or } = await import("drizzle-orm");
  
  const db = await getDb();
  if (!db) return null;
  
  const results = await db
    .select()
    .from(platformApps)
    .where(
      or(
        eq(platformApps.pid, productId),
        eq(platformApps.dpid, productId)
      )
    )
    .limit(1);
  
  return results[0] || null;
}
