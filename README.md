# HW3 — High-Concurrency Flash-Sale E-Commerce Engine

Minimal React + TypeScript + Vite browser demo. The project includes date-based countdown logic and an in-memory inventory reservation model/service; checkout and the complete sale workflow are not implemented yet.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Install and run

    npm install
    npm run dev

## Check and build

    npm run typecheck
    npm test -- --run
    npm run build
    npm run preview

See TASK_DECOMPOSITION.md for milestones and AI_FAILURE_AUDIT.md for the evidence-only audit template.

## Inventory simulation scope

`InventoryCoordinator` keeps stock and reservations in memory in one JavaScript runtime. Its synchronous reserve operation prevents interleaving within that coordinator instance, but it is not a distributed lock across browser tabs, processes, or servers. Expiry uses an injectable clock and `expireDueReservations()`; reserve also expires due reservations before checking available stock.
