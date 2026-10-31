# Verification – Filament Shelf v1.1

Date: 2026-10-31

## Automated tests

`node --test tests/*.test.js` — **43 tests pass**, zero dependencies.

Coverage:

- Wishlist validation, v1 migration, backup round trips, duplicate IDs and idempotent imports.
- Atomic wish-to-stock transfer, decrement/removal, invalid transfer rollback and storage failure protection.

- Official code `10301`, material, name, manufacturer and exact HEX.
- 318 catalog entries; multi-variant lookup and duplicate-record collapse.
- All 16 authoritative seed rolls, weights, refill type and gift note.
- Missing-catalog fallback; unknown/malformed codes and manual additions.
- HEX, transparency, multicolor and CSS-injection rejection.
- Consumption, decimals, zero transitions and invalid/excessive amounts.
- Duplicate physical rolls with unique IDs; consistent statuses and weights.
- Backup round trip, invalid JSON/schema/version/weights/prices/dates, duplicate IDs and size limits.
- Idempotent merge, explicit replacement and intentional empty inventory.
- Single initialization, reload persistence and no reseeding after inventory is empty.
- Corrupt stored data preservation and explicit recovery.
- Storage failure rollback and stale-tab conflict protection.
- Pre-import backup, recovery, failure to create a recovery snapshot.
- Archive-aware statistics, RGB/RGBA aggregation and color-family filters.

Tests use a memory-backed Storage implementation; quota and concurrency failures are simulated.

## Browser checks

Executed through the cloud Chromium browser against the static app:

- Wishlist: code 10301 recognized, two desired roles saved without affecting inventory; reload preserved the wish. Taking one role into stock increased inventory from 16 to 17 and reduced the wish quantity from two to one.

- First start displays 16 roles / 16 kg.
- Code `10301` fills PLA Basic, Pumpkin Orange and `#FF9016` (opaque alpha normalized for display).
- Adding a second Pumpkin Orange as Refill increments physical rolls to 17, keeps color count at 16.
- Record 125.5 g; 874.5 g remains and status is opened. Reload preserves all values.
- Replace-import preview, explicit confirmation, replacement to one roll and restoration to 17 rolls verified.
- Remaining-weight consumption to exactly zero, hiding empty roles, empty filter, archive and archive filter verified.
- Editing dialog and deletion confirmation verified with disposable QA roll. QA additions removed; original 16 rolls restored.
- Statistics show 12 kg PLA and 4 kg PETG, six material subtypes and all 16 color variants.
- JSON export produces a file. Reimporting that file offers 0 new roles and skips all 16 matching IDs.
- iPhone-width (390 px iframe) and iPad-width (820 px iframe) layouts rendered. DOM measurements found no horizontal body overflow. Desktop also visually inspected.
- Browser's local HTTP preview exposed missing `crypto.randomUUID`; fixed with a `crypto.getRandomValues` UUID fallback and verified by successful add/consume flows.

Browser responsive checks are Chromium viewports, not a claim of testing real iOS hardware. No real Safari or physical P2S/AMS integration testing was performed; printer integration is outside v1.

## Publication

The user created `ieeks/filament-shelf` and enabled GitHub Pages from `main` / root on 2026-10-31. The source is prepared for that existing repository, retaining the initial commit. No custom build workflow or secrets are required. GitHub's `pages build and deployment` workflow provides the deployment result.
