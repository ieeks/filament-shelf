# Source and attribution

Filament Shelf is an independent inventory app, not an official Bambu Lab product.
Product names, manufacturer names and color codes belong to their respective owners.
The spool illustration is drawn in CSS; it is not a product photograph.

## Official color catalog

- Upstream: Bambu Lab, BambuStudio repository.
- Source: https://github.com/bambulab/BambuStudio/blob/master/resources/profiles/BBL/filament/filaments_color_codes.json
- Retrieved: 2026-10-31; 318 source records.
- Last file-changing upstream commit returned at retrieval: `804d93bb5de142c48c0dabedba87736ea9553206` (2026-09-22).
- Repository license: GNU Affero General Public License, version 3. Full text in LICENSE.
- Original snapshot: `data/bambu-source.json` (JSON formatting normalized).
- Derived local module: `js/catalog-data.js` retains the requested fields, with English/German names. Other translation languages and unused upstream fields are omitted to reduce payload size.
- Normalization at runtime uppercases HEX values and handles optional alpha, multiple colors and variants. No network requests for the catalog at runtime.
- Seed names and stock quantities are user-provided and authoritative. Seed fallback color values are copied from this snapshot, not invented as official colors.

For code 30604, the upstream catalog associates Navy Blue with `#0086D6FF`.
This is the upstream value even though it looks lighter than the name suggests;
Filament Shelf deliberately preserves it. It can be changed per roll in the editor.

All application source is distributed alongside the app under AGPL-3.0; see LICENSE.
No compiled/minified-only components are required. Google Fonts are requested from
Google's font CDN (Instrument Sans / IBM Plex Mono); if unavailable, system fonts
are used and all inventory functions continue to work.
