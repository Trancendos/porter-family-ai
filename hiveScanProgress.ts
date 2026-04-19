/**
 * Hive Scan Progress Service
 * Real-time scanning progress tracking with WebSocket updates
 */

import { EventEmitter } from 'events';

export interface ScanProgressUpdate {
  scanId: string;
  estateId: number;
  estateName: string;
  status: 'queued' | 'scanning' | 'analyzing' | 'completed' | 'failed';
  progress: number; // 0-100
  currentItem?: string;
  itemsScanned: number;
  totalItems: number;
  startedAt: Date;
  estimatedCompletion?: Date;
  errors?: string[];
}

export interface ScanResult {
  scanId: string;
  estateId: number;
  itemsFound: number;
  injectionsFound: number;
  knowledgeCreated: number;
  duration: number; // milliseconds
  status: 'success' | 'partial' | 'failed';
  summary: string;
}

class HiveScanProgressService extends EventEmitter {
  private activeScans: Map<string, ScanProgressUpdate> = new Map();
  private scanHistory: ScanResult[] = [];

  /**
   * Start a new scan and emit initial progress
   */
  startScan(estateId: number, estateName: string, totalItems: number): string {
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const progress: ScanProgressUpdate = {
      scanId,
      estateId,
      estateName,
      status: 'queued',
      progress: 0,
      itemsScanned: 0,
      totalItems,
      startedAt: new Date(),
    };

    this.activeScans.set(scanId, progress);
    this.emit('scan:started', progress);
    
    return scanId;
  }

  /**
   * Update scan progress
   */
  updateProgress(
    scanId: string,
    updates: Partial<Pick<ScanProgressUpdate, 'status' | 'progress' | 'currentItem' | 'itemsScanned' | 'errors'>>
  ): void {
    const scan = this.activeScans.get(scanId);
    if (!scan) {
      console.warn(`[HiveScanProgress] Scan not found: ${scanId}`);
      return;
    }

    // Update fields
    Object.assign(scan, updates);

    // Calculate estimated completion if scanning
    if (scan.status === 'scanning' && scan.progress > 0) {
      const elapsed = Date.now() - scan.startedAt.getTime();
      const estimatedTotal = (elapsed / scan.progress) * 100;
      const remaining = estimatedTotal - elapsed;
      scan.estimatedCompletion = new Date(Date.now() + remaining);
    }

    this.emit('scan:progress', scan);
  }

  /**
   * Complete a scan
   */
  completeScan(
    scanId: string,
    result: Omit<ScanResult, 'scanId' | 'duration'>
  ): void {
    const scan = this.activeScans.get(scanId);
    if (!scan) {
      console.warn(`[HiveScanProgress] Scan not found: ${scanId}`);
      return;
    }

    const duration = Date.now() - scan.startedAt.getTime();
    
    const scanResult: ScanResult = {
      scanId,
      duration,
      ...result,
    };

    // Update scan status
    scan.status = result.status === 'success' ? 'completed' : 'failed';
    scan.progress = 100;

    this.emit('scan:completed', { scan, result: scanResult });
    
    // Move to history
    this.scanHistory.unshift(scanResult);
    if (this.scanHistory.length > 100) {
      this.scanHistory.pop();
    }

    // Clean up after 5 minutes
    setTimeout(() => {
      this.activeScans.delete(scanId);
    }, 5 * 60 * 1000);
  }

  /**
   * Fail a scan
   */
  failScan(scanId: string, error: string): void {
    const scan = this.activeScans.get(scanId);
    if (!scan) return;

    scan.status = 'failed';
    scan.errors = [...(scan.errors || []), error];

    this.completeScan(scanId, {
      estateId: scan.estateId,
      itemsFound: scan.itemsScanned,
      injectionsFound: 0,
      knowledgeCreated: 0,
      status: 'failed',
      summary: `Scan failed: ${error}`,
    });
  }

  /**
   * Get active scan progress
   */
  getProgress(scanId: string): ScanProgressUpdate | undefined {
    return this.activeScans.get(scanId);
  }

  /**
   * Get all active scans
   */
  getAllActiveScans(): ScanProgressUpdate[] {
    return Array.from(this.activeScans.values());
  }

  /**
   * Get scan history
   */
  getHistory(limit: number = 20): ScanResult[] {
    return this.scanHistory.slice(0, limit);
  }

  /**
   * Cancel a scan
   */
  cancelScan(scanId: string): void {
    const scan = this.activeScans.get(scanId);
    if (!scan) return;

    scan.status = 'failed';
    this.emit('scan:cancelled', scan);
    this.activeScans.delete(scanId);
  }
}

// Singleton instance
export const hiveScanProgressService = new HiveScanProgressService();

// Export types
export type { HiveScanProgressService };
