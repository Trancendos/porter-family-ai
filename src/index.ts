/**
 * Porter Family AI — Entry Point
 *
 * Portfolio management, asset tracking, report scheduling, and data
 * transport service for the Trancendos mesh.
 * Zero-cost compliant — no LLM calls, all rule-based analysis.
 *
 * Port: 3023
 * Architecture: Trancendos Industry 6.0 / 2060 Standard
 */

import { app, portfolio } from './api/server';
import { logger } from './utils/logger';

const PORT = Number(process.env.PORT ?? 3023);
const HOST = process.env.HOST ?? '0.0.0.0';

// ── Startup ────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  logger.info('Porter Family AI starting up...');

  const server = app.listen(PORT, HOST, () => {
    logger.info(
      { port: PORT, host: HOST, env: process.env.NODE_ENV ?? 'development' },
      '💼 Porter Family AI is online — Portfolio tracking active',
    );
  });

  // ── Periodic Portfolio Snapshot (every hour) ─────────────────────────────
  const SNAPSHOT_INTERVAL = Number(process.env.SNAPSHOT_INTERVAL_MS ?? 60 * 60 * 1000);
  const snapshotTimer = setInterval(() => {
    try {
      const snapshot = portfolio.takeSnapshot();
      const stats = portfolio.getStats();
      logger.info(
        {
          totalValue: snapshot.totalValue,
          totalAssets: snapshot.totalAssets,
          allocationByClass: snapshot.allocationByClass,
          totalSnapshots: stats.totalSnapshots,
          pendingPackages: stats.pendingPackages,
        },
        '💼 Porter Family periodic portfolio snapshot',
      );
    } catch (err) {
      logger.error({ err }, 'Periodic portfolio snapshot failed');
    }
  }, SNAPSHOT_INTERVAL);

  // ── Graceful Shutdown ────────────────────────────────────────────────────
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    clearInterval(snapshotTimer);
    server.close(() => {
      logger.info('Porter Family AI shut down cleanly');
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Bootstrap failed');
  process.exit(1);
});