/**
 * Porter Family AI — REST API Server
 *
 * Exposes portfolio management, asset tracking, report scheduling,
 * and data transport endpoints for the Trancendos mesh.
 *
 * Architecture: Trancendos Industry 6.0 / 2060 Standard
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import {
  PortfolioEngine,
  AssetClass,
  ReportType,
  ReportFrequency,
  TransportStatus,
} from '../portfolio/portfolio-engine';
import { logger } from '../utils/logger';

// ── Bootstrap ──────────────────────────────────────────────────────────────

const app = express();
export const portfolio = new PortfolioEngine();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined', {
  stream: { write: (msg: string) => logger.info(msg.trim()) },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
}

function fail(res: Response, message: string, status = 400): void {
  res.status(status).json({ success: false, error: message, timestamp: new Date().toISOString() });
}

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

// ── Health ─────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  const stats = portfolio.getStats();
  ok(res, {
    status: 'healthy',
    service: 'porter-family-ai',
    uptime: process.uptime(),
    totalAssets: stats.totalAssets,
    totalValue: stats.totalValue,
  });
});

app.get('/metrics', (_req, res) => {
  ok(res, {
    ...portfolio.getStats(),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  });
});

// ── Assets ─────────────────────────────────────────────────────────────────

// GET /assets — list all assets
app.get('/assets', (req, res) => {
  const { assetClass } = req.query;
  const assets = portfolio.getAssets(assetClass as AssetClass | undefined);
  ok(res, { assets, count: assets.length });
});

// GET /assets/:id — get a specific asset
app.get('/assets/:id', (req, res) => {
  const asset = portfolio.getAsset(req.params.id);
  if (!asset) return fail(res, 'Asset not found', 404);
  ok(res, asset);
});

// POST /assets — add an asset
app.post('/assets', (req, res) => {
  const { name, symbol, assetClass, quantity, purchasePrice, currentValue, currency, notes } = req.body;
  if (!name || !symbol || !assetClass || quantity === undefined || purchasePrice === undefined) {
    return fail(res, 'name, symbol, assetClass, quantity, purchasePrice are required');
  }
  const validClasses: AssetClass[] = ['crypto', 'stocks', 'gold', 'forex', 'revenue', 'cash'];
  if (!validClasses.includes(assetClass)) {
    return fail(res, `assetClass must be one of: ${validClasses.join(', ')}`);
  }
  try {
    const asset = portfolio.addAsset({
      name,
      symbol,
      assetClass: assetClass as AssetClass,
      quantity: Number(quantity),
      purchasePrice: Number(purchasePrice),
      currentValue: currentValue ? Number(currentValue) : undefined,
      currency,
      notes,
    });
    ok(res, asset, 201);
  } catch (err) {
    fail(res, (err as Error).message);
  }
});

// PATCH /assets/:id/value — update asset current value
app.patch('/assets/:id/value', (req, res) => {
  const { currentValue } = req.body;
  if (currentValue === undefined) return fail(res, 'currentValue is required');
  const asset = portfolio.updateAssetValue(req.params.id, Number(currentValue));
  if (!asset) return fail(res, 'Asset not found', 404);
  ok(res, asset);
});

// DELETE /assets/:id — remove an asset
app.delete('/assets/:id', (req, res) => {
  const deleted = portfolio.removeAsset(req.params.id);
  if (!deleted) return fail(res, 'Asset not found', 404);
  ok(res, { deleted: true, id: req.params.id });
});

// ── Snapshots ──────────────────────────────────────────────────────────────

// GET /snapshots — list recent snapshots
app.get('/snapshots', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const snapshots = portfolio.getSnapshots(limit);
  ok(res, { snapshots, count: snapshots.length });
});

// POST /snapshots — take a portfolio snapshot
app.post('/snapshots', (_req, res) => {
  const snapshot = portfolio.takeSnapshot();
  ok(res, snapshot, 201);
});

// ── Report Schedules ───────────────────────────────────────────────────────

// GET /schedules — list all report schedules
app.get('/schedules', (req, res) => {
  const isActive = req.query.isActive !== undefined
    ? req.query.isActive === 'true'
    : undefined;
  const schedules = portfolio.getSchedules(isActive);
  ok(res, { schedules, count: schedules.length });
});

// GET /schedules/:id — get a specific schedule
app.get('/schedules/:id', (req, res) => {
  const schedule = portfolio.getSchedule(req.params.id);
  if (!schedule) return fail(res, 'Schedule not found', 404);
  ok(res, schedule);
});

// POST /schedules — create a report schedule
app.post('/schedules', (req, res) => {
  const { name, reportType, frequency, recipients, includeAssetClasses } = req.body;
  if (!name || !reportType || !frequency) {
    return fail(res, 'name, reportType, frequency are required');
  }
  const validTypes: ReportType[] = ['portfolio', 'trading', 'budget', 'forecast', 'comprehensive'];
  if (!validTypes.includes(reportType)) {
    return fail(res, `reportType must be one of: ${validTypes.join(', ')}`);
  }
  const validFreqs: ReportFrequency[] = ['daily', 'weekly', 'monthly', 'quarterly'];
  if (!validFreqs.includes(frequency)) {
    return fail(res, `frequency must be one of: ${validFreqs.join(', ')}`);
  }
  try {
    const schedule = portfolio.createSchedule({
      name,
      reportType: reportType as ReportType,
      frequency: frequency as ReportFrequency,
      recipients,
      includeAssetClasses,
    });
    ok(res, schedule, 201);
  } catch (err) {
    fail(res, (err as Error).message);
  }
});

// PATCH /schedules/:id/toggle — enable/disable a schedule
app.patch('/schedules/:id/toggle', (req, res) => {
  const schedule = portfolio.toggleSchedule(req.params.id);
  if (!schedule) return fail(res, 'Schedule not found', 404);
  ok(res, schedule);
});

// DELETE /schedules/:id — delete a schedule
app.delete('/schedules/:id', (req, res) => {
  const deleted = portfolio.deleteSchedule(req.params.id);
  if (!deleted) return fail(res, 'Schedule not found', 404);
  ok(res, { deleted: true, id: req.params.id });
});

// ── Data Packages ──────────────────────────────────────────────────────────

// GET /packages — list data packages
app.get('/packages', (req, res) => {
  const { status } = req.query;
  const packages = portfolio.getPackages(status as TransportStatus | undefined);
  ok(res, { packages, count: packages.length });
});

// POST /packages — send a data package
app.post('/packages', (req, res) => {
  const { destination, payload, type, priority } = req.body;
  if (!destination || !payload || !type) {
    return fail(res, 'destination, payload, type are required');
  }
  try {
    const pkg = portfolio.sendPackage({ destination, payload, type, priority });
    ok(res, pkg, 201);
  } catch (err) {
    fail(res, (err as Error).message);
  }
});

// PATCH /packages/:id/status — update package status
app.patch('/packages/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) return fail(res, 'status is required');
  const validStatuses: TransportStatus[] = ['pending', 'in_transit', 'delivered', 'failed'];
  if (!validStatuses.includes(status)) {
    return fail(res, `status must be one of: ${validStatuses.join(', ')}`);
  }
  const pkg = portfolio.updatePackageStatus(req.params.id, status as TransportStatus);
  if (!pkg) return fail(res, 'Package not found', 404);
  ok(res, pkg);
});

// ── Stats ──────────────────────────────────────────────────────────────────

app.get('/stats', (_req, res) => {
  ok(res, portfolio.getStats());
});

// ── Error Handler ──────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  fail(res, err.message || 'Internal server error', 500);
});

export { app };