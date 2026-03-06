/**
 * Porter Family AI — Portfolio & Data Transport Engine
 *
 * The Porter Family (Ann, Clarence, Edward, Isaac, James) — multimillionaire
 * investors managing the Portfolio: Revenue, Crypto, Stocks, Gold, Exchange Rates.
 * Also handles scheduled report delivery and data transport across the mesh.
 *
 * Zero-cost mandate: all portfolio tracking is read-only/analytical — no real trades.
 *
 * Architecture: Trancendos Industry 6.0 / 2060 Standard
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────

export type AssetClass = 'crypto' | 'stocks' | 'gold' | 'forex' | 'revenue' | 'cash';
export type ReportType = 'portfolio' | 'trading' | 'budget' | 'forecast' | 'comprehensive';
export type ReportFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type TransportStatus = 'pending' | 'in_transit' | 'delivered' | 'failed';

export interface PortfolioAsset {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  costBasis: number;       // zero-cost: always 0
  currentValue: number;   // tracked analytically
  allocation: number;     // percentage
  notes?: string;
  addedAt: Date;
  updatedAt: Date;
}

export interface PortfolioSnapshot {
  id: string;
  totalValue: number;
  totalCostBasis: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  assetCount: number;
  allocationByClass: Record<AssetClass, number>;
  topHoldings: PortfolioAsset[];
  snapshotAt: Date;
}

export interface ReportSchedule {
  id: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  recipients: string[];
  time: string;           // HH:MM
  dayOfWeek?: number;     // 0-6
  dayOfMonth?: number;    // 1-31
  notes?: string;
  isActive: boolean;
  nextRun?: Date;
  lastRun?: Date;
  createdAt: Date;
}

export interface DataPackage {
  id: string;
  name: string;
  source: string;
  destination: string;
  payload: Record<string, unknown>;
  status: TransportStatus;
  retries: number;
  deliveredAt?: Date;
  createdAt: Date;
}

export interface PortfolioStats {
  totalAssets: number;
  assetsByClass: Record<AssetClass, number>;
  totalValue: number;
  activeSchedules: number;
  totalPackages: number;
  deliveredPackages: number;
  pendingPackages: number;
}

// ── Portfolio Engine ──────────────────────────────────────────────────────

export class PortfolioEngine {
  private assets: Map<string, PortfolioAsset> = new Map();
  private snapshots: PortfolioSnapshot[] = [];
  private schedules: Map<string, ReportSchedule> = new Map();
  private packages: Map<string, DataPackage> = new Map();

  constructor() {
    this.seedPortfolio();
    logger.info('PortfolioEngine (Porter Family AI) initialized — portfolio tracking active');
  }

  // ── Asset Management ────────────────────────────────────────────────────

  addAsset(params: {
    symbol: string;
    name: string;
    assetClass: AssetClass;
    quantity: number;
    currentValue?: number;
    notes?: string;
  }): PortfolioAsset {
    const asset: PortfolioAsset = {
      id: uuidv4(),
      symbol: params.symbol.toUpperCase(),
      name: params.name,
      assetClass: params.assetClass,
      quantity: params.quantity,
      costBasis: 0,   // zero-cost mandate
      currentValue: params.currentValue || 0,
      allocation: 0,  // recalculated
      notes: params.notes,
      addedAt: new Date(),
      updatedAt: new Date(),
    };
    this.assets.set(asset.id, asset);
    this.recalculateAllocations();
    logger.info({ assetId: asset.id, symbol: asset.symbol, class: asset.assetClass }, 'Asset added to portfolio');
    return asset;
  }

  updateAssetValue(assetId: string, currentValue: number): PortfolioAsset | undefined {
    const asset = this.assets.get(assetId);
    if (!asset) return undefined;
    asset.currentValue = currentValue;
    asset.updatedAt = new Date();
    this.recalculateAllocations();
    return asset;
  }

  removeAsset(assetId: string): boolean {
    const deleted = this.assets.delete(assetId);
    if (deleted) this.recalculateAllocations();
    return deleted;
  }

  getAsset(assetId: string): PortfolioAsset | undefined {
    return this.assets.get(assetId);
  }

  getAssets(assetClass?: AssetClass): PortfolioAsset[] {
    let assets = Array.from(this.assets.values());
    if (assetClass) assets = assets.filter(a => a.assetClass === assetClass);
    return assets.sort((a, b) => b.currentValue - a.currentValue);
  }

  // ── Portfolio Snapshots ─────────────────────────────────────────────────

  takeSnapshot(): PortfolioSnapshot {
    const assets = Array.from(this.assets.values());
    const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
    const totalCostBasis = 0; // zero-cost

    const allocationByClass = {} as Record<AssetClass, number>;
    const classes: AssetClass[] = ['crypto', 'stocks', 'gold', 'forex', 'revenue', 'cash'];
    for (const cls of classes) {
      const classValue = assets.filter(a => a.assetClass === cls).reduce((sum, a) => sum + a.currentValue, 0);
      allocationByClass[cls] = totalValue > 0 ? (classValue / totalValue) * 100 : 0;
    }

    const snapshot: PortfolioSnapshot = {
      id: uuidv4(),
      totalValue,
      totalCostBasis,
      unrealizedGain: totalValue - totalCostBasis,
      unrealizedGainPercent: totalCostBasis > 0 ? ((totalValue - totalCostBasis) / totalCostBasis) * 100 : 0,
      assetCount: assets.length,
      allocationByClass,
      topHoldings: assets.slice(0, 5),
      snapshotAt: new Date(),
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > 1000) this.snapshots.shift();
    logger.info({ snapshotId: snapshot.id, totalValue, assets: assets.length }, 'Portfolio snapshot taken');
    return snapshot;
  }

  getSnapshots(limit = 10): PortfolioSnapshot[] {
    return this.snapshots.slice(-limit).reverse();
  }

  // ── Report Schedules ────────────────────────────────────────────────────

  createSchedule(params: {
    reportType: ReportType;
    frequency: ReportFrequency;
    recipients: string[];
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    notes?: string;
  }): ReportSchedule {
    const schedule: ReportSchedule = {
      id: uuidv4(),
      reportType: params.reportType,
      frequency: params.frequency,
      recipients: params.recipients,
      time: params.time,
      dayOfWeek: params.dayOfWeek,
      dayOfMonth: params.dayOfMonth,
      notes: params.notes,
      isActive: true,
      nextRun: this.calculateNextRun(params.frequency, params.time, params.dayOfWeek, params.dayOfMonth),
      createdAt: new Date(),
    };
    this.schedules.set(schedule.id, schedule);
    logger.info({ scheduleId: schedule.id, type: schedule.reportType, frequency: schedule.frequency }, 'Report schedule created');
    return schedule;
  }

  getSchedule(scheduleId: string): ReportSchedule | undefined {
    return this.schedules.get(scheduleId);
  }

  getSchedules(isActive?: boolean): ReportSchedule[] {
    let schedules = Array.from(this.schedules.values());
    if (isActive !== undefined) schedules = schedules.filter(s => s.isActive === isActive);
    return schedules.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  toggleSchedule(scheduleId: string): ReportSchedule | undefined {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return undefined;
    schedule.isActive = !schedule.isActive;
    return schedule;
  }

  deleteSchedule(scheduleId: string): boolean {
    return this.schedules.delete(scheduleId);
  }

  // ── Data Transport ──────────────────────────────────────────────────────

  sendPackage(params: {
    name: string;
    source: string;
    destination: string;
    payload: Record<string, unknown>;
  }): DataPackage {
    const pkg: DataPackage = {
      id: uuidv4(),
      name: params.name,
      source: params.source,
      destination: params.destination,
      payload: params.payload,
      status: 'pending',
      retries: 0,
      createdAt: new Date(),
    };
    this.packages.set(pkg.id, pkg);
    logger.info({ packageId: pkg.id, source: pkg.source, destination: pkg.destination }, 'Data package queued');
    return pkg;
  }

  updatePackageStatus(packageId: string, status: TransportStatus): DataPackage | undefined {
    const pkg = this.packages.get(packageId);
    if (!pkg) return undefined;
    pkg.status = status;
    if (status === 'delivered') pkg.deliveredAt = new Date();
    return pkg;
  }

  getPackages(status?: TransportStatus): DataPackage[] {
    let packages = Array.from(this.packages.values());
    if (status) packages = packages.filter(p => p.status === status);
    return packages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  getStats(): PortfolioStats {
    const assets = Array.from(this.assets.values());
    const packages = Array.from(this.packages.values());
    const assetsByClass = {} as Record<AssetClass, number>;
    const classes: AssetClass[] = ['crypto', 'stocks', 'gold', 'forex', 'revenue', 'cash'];
    for (const cls of classes) {
      assetsByClass[cls] = assets.filter(a => a.assetClass === cls).length;
    }

    return {
      totalAssets: assets.length,
      assetsByClass,
      totalValue: assets.reduce((sum, a) => sum + a.currentValue, 0),
      activeSchedules: Array.from(this.schedules.values()).filter(s => s.isActive).length,
      totalPackages: packages.length,
      deliveredPackages: packages.filter(p => p.status === 'delivered').length,
      pendingPackages: packages.filter(p => p.status === 'pending' || p.status === 'in_transit').length,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private recalculateAllocations(): void {
    const assets = Array.from(this.assets.values());
    const total = assets.reduce((sum, a) => sum + a.currentValue, 0);
    for (const asset of assets) {
      asset.allocation = total > 0 ? (asset.currentValue / total) * 100 : 0;
    }
  }

  private calculateNextRun(frequency: ReportFrequency, time: string, dayOfWeek?: number, dayOfMonth?: number): Date {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    switch (frequency) {
      case 'weekly':
        if (dayOfWeek !== undefined) {
          while (next.getDay() !== dayOfWeek) next.setDate(next.getDate() + 1);
        }
        break;
      case 'monthly':
        if (dayOfMonth !== undefined) {
          next.setDate(dayOfMonth);
          if (next <= now) next.setMonth(next.getMonth() + 1);
        }
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
    }
    return next;
  }

  private seedPortfolio(): void {
    const seedAssets = [
      { symbol: 'BTC', name: 'Bitcoin', assetClass: 'crypto' as AssetClass, quantity: 0, currentValue: 0 },
      { symbol: 'ETH', name: 'Ethereum', assetClass: 'crypto' as AssetClass, quantity: 0, currentValue: 0 },
      { symbol: 'GOLD', name: 'Gold', assetClass: 'gold' as AssetClass, quantity: 0, currentValue: 0 },
      { symbol: 'USD', name: 'US Dollar', assetClass: 'cash' as AssetClass, quantity: 0, currentValue: 0 },
      { symbol: 'REVENUE', name: 'Platform Revenue', assetClass: 'revenue' as AssetClass, quantity: 0, currentValue: 0 },
    ];
    for (const a of seedAssets) this.addAsset(a);
    logger.info({ count: seedAssets.length }, 'Portfolio seeded with default asset classes');
  }
}