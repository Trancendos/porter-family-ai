# Porter Family AI 💼

> Portfolio management, asset tracking, report scheduling, and data transport for the Trancendos mesh.
> Zero-cost compliant — no LLM calls, all rule-based analysis.

**Port:** `3023`
**Architecture:** Trancendos Industry 6.0 / 2060 Standard

---

## Overview

Porter Family AI manages the Trancendos financial portfolio. It tracks assets across 6 asset classes, takes periodic snapshots, schedules automated reports, and handles data package transport between mesh services.

---

## Asset Classes

| Class | Description |
|-------|-------------|
| `crypto` | Cryptocurrency holdings (BTC, ETH, etc.) |
| `stocks` | Equity positions |
| `gold` | Precious metals |
| `forex` | Foreign exchange positions |
| `revenue` | Revenue streams and income |
| `cash` | Cash and cash equivalents |

---

## Report Types

`portfolio` · `trading` · `budget` · `forecast` · `comprehensive`

## Report Frequencies

`daily` · `weekly` · `monthly` · `quarterly`

---

## API Reference

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health + portfolio summary |
| GET | `/metrics` | Runtime metrics + portfolio stats |

### Assets

| Method | Path | Description |
|--------|------|-------------|
| GET | `/assets` | List assets (filter by assetClass) |
| GET | `/assets/:id` | Get a specific asset |
| POST | `/assets` | Add an asset |
| PATCH | `/assets/:id/value` | Update asset current value |
| DELETE | `/assets/:id` | Remove an asset |

### Snapshots

| Method | Path | Description |
|--------|------|-------------|
| GET | `/snapshots` | List recent snapshots |
| POST | `/snapshots` | Take a portfolio snapshot |

### Report Schedules

| Method | Path | Description |
|--------|------|-------------|
| GET | `/schedules` | List schedules (filter by isActive) |
| GET | `/schedules/:id` | Get a specific schedule |
| POST | `/schedules` | Create a report schedule |
| PATCH | `/schedules/:id/toggle` | Enable/disable a schedule |
| DELETE | `/schedules/:id` | Delete a schedule |

### Data Packages

| Method | Path | Description |
|--------|------|-------------|
| GET | `/packages` | List packages (filter by status) |
| POST | `/packages` | Send a data package |
| PATCH | `/packages/:id/status` | Update package status |

### Stats

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Portfolio statistics |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3023` | HTTP server port |
| `HOST` | `0.0.0.0` | HTTP server host |
| `LOG_LEVEL` | `info` | Pino log level |
| `SNAPSHOT_INTERVAL_MS` | `3600000` | Periodic snapshot interval (ms) |

---

## Development

```bash
npm install
npm run dev       # tsx watch mode
npm run build     # compile TypeScript
npm start         # run compiled output
```

---

## Default Assets

Porter Family AI seeds 5 assets on startup (all zero-cost):
- BTC (crypto), ETH (crypto), GOLD (gold), USD (cash), REVENUE (revenue)

---

*Part of the Trancendos Industry 6.0 mesh — 2060 Standard*