# Verification – Filament Shelf v1.4

Date: 2026-11-01

## Automated tests

`node --test tests/*.test.js` — **66 tests pass**, zero dependencies.

Coverage:

- Cloud adoption races, stale device saves, atomic inventory/wishlist transfers, offline failures, size limits, per-account cache isolation and recovery.

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

The user created `ieeks/filament-shelf` and enabled GitHub Pages from `main` / root on 2026-11-01. The source is prepared for that existing repository, retaining the initial commit. No custom build workflow or secrets are required. GitHub's `pages build and deployment` workflow provides the deployment result.


## Firestore emulator verification (2026-11-01)

`npm --prefix tests/firebase test` — **7 tests pass** with Java 21 and Firebase Tools 15.34.2. Uses only project `demo-filament-shelf` and local emulator port 8088, no production credentials.

- Owner Google account can read/create; other users, anonymous clients and password-provider accounts cannot access that shelf.
- Revision reuse/skipping, extra fields, wrong types/formats, oversize writes, client deletion/listing and unrelated paths are denied.
- The actual SDK transport and CloudRepository are tested together against Firestore: exactly one of two racing saves succeeds, with stock and wishlist committed as one snapshot.

Cloud browser QA: the real CDN SDK loads, Sync opens with a working sign-in control, and the default local inventory remains at 16 roles / 16 kg. A disposable transport (not deployed) was used to test the first-use consent and two-tab UI conflict: an unsaved note stayed in its dialog and saving was blocked after the other tab changed stock. Real Google login, the production Firebase rules publication, device-to-device production sync, and physical iPhone Safari testing still require the owner's setup/login. No production account or test inventory was created by QA.

## Sharing verification (2026-11-01)

- Whitelist projection excludes IDs, account data, notes, prices, purchase dates, history, archived rolls and wishlist. Reader validation rejects invalid weights/colors and drops unknown fields.
- Share tokens use 32 cryptographically random bytes; disabling and re-enabling creates a new token. Stale clients cannot re-enable a revoked link.
- Real Firestore emulator: anonymous document read works, private stock/ownership reads and collection listing fail. Anonymous/foreign writes, deletion and known-token ownership hijacking fail.
- Real transport: stock and public projection update atomically; private-only legacy saves cannot strand public data. Revocation deletes the readable document and anonymous snapshot listeners receive null. Re-enabling never reactivates the previous token.
- Browser with disposable test transport: connected cloud stock, created a link, opened the login-free reader (16 rolls / 16 kg), searched 10301 (Pumpkin Orange), revoked access and observed the open reader clear. No production account or public inventory was created by QA.
- Production setup still requires the owner to publish the updated Firestore rules and sign in. GitHub Pages deployment does not publish Firebase rules.

## Public landing page (2026-11-01)

The root is now the login-free reader for the owner-selected share. `edit.html` retains the full original editor and browser storage keys. Explicit `share.html#token` links remain separate and never fall back to the public default if invalid/revoked. The selector is static public configuration; no Firestore rules change or database mutation is part of this deployment.

Browser verification for V1.4: the public root loaded the actual configured share without login (16 rolls / 16 kg). The editing link opened `edit.html`, retained 16 local rolls and exposed Sync. Existing 66 core/adapter tests passed; Firestore rules were unchanged. No production inventory was modified during verification.
