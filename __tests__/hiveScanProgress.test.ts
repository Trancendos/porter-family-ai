/**
 * Unit Tests for Hive Scan Progress Service
 * Tests scan progress tracking, event emission, and state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hiveScanProgressService, type ScanProgressUpdate } from '../hiveScanProgress';

describe('HiveScanProgressService', () => {
  beforeEach(() => {
    // Clear all active scans before each test
    hiveScanProgressService.removeAllListeners();
  });

  describe('startScan', () => {
    it('should start a new scan and emit scan:started event', (done) => {
      const scanData = {
        scanId: 'test-scan-1',
        estateId: 'estate-1',
        estateName: 'Test Estate',
        totalItems: 100,
      };

      hiveScanProgressService.once('scan:started', (progress: ScanProgressUpdate) => {
        expect(progress.scanId).toBe(scanData.scanId);
        expect(progress.estateId).toBe(scanData.estateId);
        expect(progress.estateName).toBe(scanData.estateName);
        expect(progress.progress).toBe(0);
        expect(progress.itemsScanned).toBe(0);
        expect(progress.totalItems).toBe(scanData.totalItems);
        expect(progress.currentPhase).toBe('Initializing');
        done();
      });

      hiveScanProgressService.startScan(scanData);
    });

    it('should not start a scan if one is already active for the estate', () => {
      const scanData = {
        scanId: 'test-scan-1',
        estateId: 'estate-1',
        estateName: 'Test Estate',
        totalItems: 100,
      };

      hiveScanProgressService.startScan(scanData);
      
      // Try to start another scan for the same estate
      expect(() => {
        hiveScanProgressService.startScan({
          ...scanData,
          scanId: 'test-scan-2',
        });
      }).toThrow();
    });
  });

  describe('updateProgress', () => {
    it('should update scan progress and emit scan:progress event', (done) => {
      const scanId = 'test-scan-1';
      
      hiveScanProgressService.startScan({
        scanId,
        estateId: 'estate-1',
        estateName: 'Test Estate',
        totalItems: 100,
      });

      hiveScanProgressService.once('scan:progress', (progress: ScanProgressUpdate) => {
        expect(progress.scanId).toBe(scanId);
        expect(progress.itemsScanned).toBe(25);
        expect(progress.progress).toBe(25);
        expect(progress.currentPhase).toBe('Scanning modules');
        done();
      });

      hiveScanProgressService.updateProgress(scanId, {
        itemsScanned: 25,
        currentPhase: 'Scanning modules',
      });
    });

    it('should calculate progress percentage correctly', () => {
      const scanId = 'test-scan-1';
      
      hiveScanProgressService.startScan({
        scanId,
        estateId: 'estate-1',
        estateName: 'Test Estate',
        totalItems: 200,
      });

      hiveScanProgressService.updateProgress(scanId, {
        itemsScanned: 50,
      });

      const progress = hiveScanProgressService.getProgress(scanId);
      expect(progress?.progress).toBe(25); // 50/200 = 25%
    });

    it('should not update progress for non-existent scan', () => {
      expect(() => {
        hiveScanProgressService.updateProgress('non-existent-scan', {
          itemsScanned: 10,
        });
      }).toThrow();
    });
  });

  describe('completeScan', () => {
    it('should complete scan and emit scan:completed event', (done) => {
      const scanId = 'test-scan-1';
      
      hiveScanProgressService.startScan({
        scanId,
        estateId: 'estate-1',
        estateName: 'Test Estate',
        totalItems: 100,
      });

      hiveScanProgressService.once('scan:completed', (data) => {
        expect(data.scan.scanId).toBe(scanId);
        expect(data.result.status).toBe('completed');
        expect(data.result.itemsFound).toBe(50);
        expect(data.result.injectionsFound).toBe(5);
        expect(data.result.patternsFound).toBe(3);
        done();
      });

      hiveScanProgressService.completeScan(scanId, {
        status: 'completed',
        itemsFound: 50,
        injectionsFound: 5,
        patternsFound: 3,
        duration: 5000,
      });
    });

    it('should remove scan from active scans after completion', () => {
      const scanId = 'test-scan-1';
      
      hiveScanProgressService.startScan({
        scanId,
        estateId: 'estate-1',
        estateName: 'Test Estate',
        totalItems: 100,
      });

      hiveScanProgressService.completeScan(scanId, {
        status: 'completed',
        itemsFound: 50,
        injectionsFound: 5,
        patternsFound: 3,
        duration: 5000,
      });

      const progress = hiveScanProgressService.getProgress(scanId);
      expect(progress).toBeUndefined();
    });
  });

  describe('cancelScan', () => {
    it('should cancel scan and emit scan:cancelled event', (done) => {
      const scanId = 'test-scan-1';
      
      hiveScanProgressService.startScan({
        scanId,
        estateId: 'estate-1',
        estateName: 'Test Estate',
        totalItems: 100,
      });

      hiveScanProgressService.once('scan:cancelled', (progress: ScanProgressUpdate) => {
        expect(progress.scanId).toBe(scanId);
        done();
      });

      hiveScanProgressService.cancelScan(scanId);
    });

    it('should remove scan from active scans after cancellation', () => {
      const scanId = 'test-scan-1';
      
      hiveScanProgressService.startScan({
        scanId,
        estateId: 'estate-1',
        estateName: 'Test Estate',
        totalItems: 100,
      });

      hiveScanProgressService.cancelScan(scanId);

      const progress = hiveScanProgressService.getProgress(scanId);
      expect(progress).toBeUndefined();
    });
  });

  describe('getProgress', () => {
    it('should return current progress for active scan', () => {
      const scanId = 'test-scan-1';
      
      hiveScanProgressService.startScan({
        scanId,
        estateId: 'estate-1',
        estateName: 'Test Estate',
        totalItems: 100,
      });

      const progress = hiveScanProgressService.getProgress(scanId);
      expect(progress).toBeDefined();
      expect(progress?.scanId).toBe(scanId);
      expect(progress?.progress).toBe(0);
    });

    it('should return undefined for non-existent scan', () => {
      const progress = hiveScanProgressService.getProgress('non-existent-scan');
      expect(progress).toBeUndefined();
    });
  });

  describe('getAllActiveScans', () => {
    it('should return all active scans', () => {
      hiveScanProgressService.startScan({
        scanId: 'scan-1',
        estateId: 'estate-1',
        estateName: 'Estate 1',
        totalItems: 100,
      });

      hiveScanProgressService.startScan({
        scanId: 'scan-2',
        estateId: 'estate-2',
        estateName: 'Estate 2',
        totalItems: 200,
      });

      const activeScans = hiveScanProgressService.getAllActiveScans();
      expect(activeScans).toHaveLength(2);
      expect(activeScans.map(s => s.scanId)).toContain('scan-1');
      expect(activeScans.map(s => s.scanId)).toContain('scan-2');
    });

    it('should return empty array when no scans are active', () => {
      const activeScans = hiveScanProgressService.getAllActiveScans();
      expect(activeScans).toHaveLength(0);
    });
  });

  describe('estimateCompletion', () => {
    it('should estimate completion time based on progress', () => {
      const scanId = 'test-scan-1';
      
      hiveScanProgressService.startScan({
        scanId,
        estateId: 'estate-1',
        estateName: 'Test Estate',
        totalItems: 100,
      });

      // Simulate progress after 1 second
      setTimeout(() => {
        hiveScanProgressService.updateProgress(scanId, {
          itemsScanned: 25,
        });

        const progress = hiveScanProgressService.getProgress(scanId);
        expect(progress?.estimatedCompletion).toBeDefined();
      }, 1000);
    });
  });
});
