---
name: frontend
description: Guide for the frontend (web/ folder) in React + Vite + Tailwind - 4 views (Overview, Learn, Educational, Expert), map, year x month calendar, raw/harmonized switch, bilingual, dark theme from the Figma design. Use it before touching web/ or drafting a prompt for Figma Make.
---

# Frontend

The frontend **only draws** what the API returns. It does not compute medians, statuses or factors. The shape of the data is in `docs/contracts/api.md` and the examples in `docs/contracts/examples/`.

## Running

```bash
pnpm install --frozen-lockfile   # from the repo ROOT: it is a pnpm workspace that includes web/
pnpm dev                         # http://localhost:5173 (from the root or from web/)
pnpm typecheck                   # check types before pushing
pnpm build                       # must pass before opening a PR
```

### Versions (pnpm)

- Only **pnpm 12.18.0** and **Node 24**. They are pinned in the root `package.json` (`packageManager`, `engines`); pnpm switches to the pinned version by itself.
- Never `npm install` or `yarn`. If `package-lock.json` or `yarn.lock` shows up, delete it.
- There is **a single lockfile**: `pnpm-lock.yaml` at the root. Always install with `--frozen-lockfile`. If it fails, say so; do not delete it.
- A new dependency only if needed and with an exact version: `pnpm --filter machinelove-web add -E <package>` (or `pnpm add -E` inside `web/`). `web/package.json` and the root `pnpm-lock.yaml` go in the same commit.
- The root `pnpm-workspace.yaml` is not touched without notice: `minimumReleaseAge: 1440` rejects packages less than 1 day old, the `postcss` `override` exists because of that, and `allowBuilds` lets the `esbuild` installer run.

`web/.env` (copy from `.env.example`): empty `VITE_API_URL` → mocks; `VITE_API_URL=http://localhost:8000/api/v1` → local API.

## Structure

| File | What it does |
|---|---|
| `src/api.ts` | **The only door to the API.** `getPresets()`, `getCalendar(req)`, `downloadCalendarCsv(req)`, `downloadHotspotsCsv(req)`, `downloadAoiGeoJson(geom, name)` |
| `src/types.ts` | Contract types. If the contract changes, it changes here first |
| `src/i18n/` | `es.ts` and `en.ts` (one dictionary per language, same keys) and `index.ts` (`translate`, saved language). Includes `status.*`, `flag.*`, `source.*`, `error.*` |
| `src/state.tsx` | Global state: language, tab, mode, `basis` ("Simulate the end of MODIS"), palette, area (`aoi`), loaded calendar, selected month. The calendar cache is keyed by area **and** `basis`; changing only `basis` keeps the selected month |
| `src/components/ModisSwitch.tsx` | "Switch MODIS off" button: changes `basis` to `viirs_primary`. The yearly bars (`YearBars` in Expert, the timeline histogram in Overview) then draw the series with MODIS as a dashed line |
| `src/theme/tokens.ts` | **The only source of colors** in TS: surfaces, UI accents, levels per palette, ramps, map. `@theme` in `src/index.css` is its mirror for Tailwind |
| `src/lib/color.ts` | Ramps, color per level (`statusColor`), symbol contrast (`inkOn`, `readableOn`), square-root scale |
| `src/components/` | Calendar (per-year view `YearView` + matrix `Calendar`), month card, legend, map (`MapPanel`, loaded with `LazyMapPanel`), timeline, yearly bars, k inspector, monthly series, downloads |
| `src/components/CalendarTiles.tsx` | Expert tile calendar (years in columns). Reuses `cellValue`, `useScaleMax` and `Tooltip` from `Calendar.tsx` |
| `src/components/HudBar.tsx`, `src/lib/hud.ts` | Telemetry bar and its store outside React (cursor, latency) |
| `src/mocks/index.ts` | All mocks in one module that `api.ts` imports on demand (`import('./mocks')`): with the real API they are not downloaded |
| `src/components/CoordSearch.tsx` | Expert coordinate search (next to the strip at the top right): `parseLatLon` + `boxAround` from `lib/geo.ts`, shortcut `/` |
| `src/components/AnimatedNumber.tsx` | A figure that rolls to the new value in 600 ms (presentation only) |
| `src/components/icons/` | Animated icons from lucide-animated (MIT) + `useIconAnim` (the whole button triggers the animation) |
| `src/components/map/` | The map, in pieces: `MapPanel.tsx` (orchestrates: creates the map, camera, data, controls), `layers.ts` (sources and layers: tone, terrain, regions, fire, drawing), `fire.ts` (month hot spots + flicker), `useDrawTool.ts` (rectangle and polygon), `Toolbar.tsx` (floating bar), `CustomAreaPanel.tsx` (coordinates + radius), `geometry.ts` (pure utilities). Always imported through `components/LazyMapPanel.tsx` |
| `src/views/` | `General` (Overview), `Learn`, `Edu` (Educational) and `expert/` |
| `src/views/expert/` | The console, in pieces: `Expert.tsx` (assembles the screen), `Controls.tsx` (left panel), `Kpis.tsx` (indicators), `CalendarSide.tsx` (right panel), `panels.tsx` (`FloatPanel`, `Section`, `StripButton`), `hooks.ts` (open panels, screen width) |
| `src/mocks/` | Copies of the real API per preset + DEMO generator for drawn polygons (`demoCalendar.ts`) |

No component calls `fetch` directly. **Calendar CSV:** the endpoint is `POST`, so there is no direct URL; `downloadCalendarCsv` does the `POST` and saves the file.

## Mocks

- `presets.response.json` and `calendar.response.json`: copies of `docs/contracts/examples/`.
- `calendar.demo.*.json` (`modis_primary`), `calendar.viirs.*.json` (`viirs_primary`) and `presets.response.json`: **copies of the real API** (`firms` database). Without an API, the presets look the same as with the API. They are updated with `python3 scripts/snapshot_mocks.py` (with the API on 8000).
- With mocks, a drawn polygon returns an **invented** calendar (`demoCalendar.ts`) and the hot spots CSV carries only the header. The interface shows "DEMO" while mocks are in use.
- Real values are 4–7 times lower than those of the old DEMO and there are many months at 0 (58 in Sierra Gorda): the design has to look good with that.

## Real data (what changes compared with the old DEMO)

Measured on Nov 14 comparing the DEMO mocks against the real API. The **shape** is identical (same keys, same codes); the **values** are not.

| | Old DEMO | Real |
|---|---|---|
| Harmonized monthly maximum | 234 (Sierra Gorda) to 1,155 | **64** (Sierra Gorda), 150 (Bajío), 166 (Querétaro) |
| Monthly median | 12–37 | **3** (Sierra Gorda), 11, 17 |
| Months at 0 | 12 | **58** in Sierra Gorda |
| `no_data` months | 1 | **12**: Jan–Oct 2000 (no MODIS yet), Nov 2026 (partial) and Dec 2026 |
| `source = viirs_scaled` | never | never in `modis_primary`; it only appears with `basis = viirs_primary` |
| `viirs_outage` flag | 1 | none in the presets |
| Season | peak in April for all | Bajío **Jan–Mar** (+ Dec), Sierra Gorda **Apr–Jun**, Querétaro March |
| Card on open (`latest`) | — | Oct 2026: Sierra Gorda **0.0**, Bajío 7.0 |
| Worst year in validation | 19–43 % | 15–55 % |

What this implies:
- The scale and the bars have to read well with small numbers and many zeros.
- The 2000 row comes out almost entirely gray: that is correct ("no data" is not zero).
- `k` only changes what is shown with the "Simulate the end of MODIS" button (`basis = viirs_primary`). Without it, harmonized mode is MODIS in cell-days.

## Views

The top bar is the same in all of them: name on the left; on the right 3 buttons of 44 px: language (🌐), accessibility (Standard / Colorblind-safe / High contrast palettes + sonification) and **View: <mode>** (menu of the 4 views). The app always starts in **Expert** (the demo console). **For the demo and the MVP the View menu only offers Learn and Expert** (`TABS` in `TopBar.tsx`); Overview and Educational are still in the code. At the bottom, a 28 px telemetry bar (`HudBar`): source, cursor coordinates, area, sensor status and API latency.

| View | Contents |
|---|---|
| Overview | Month card with ‹ › arrows · map across the center with regions, custom area and a **Calendar** button · the calendar is a floating panel over the map (closed at first): 12 months of the year with a ‹ year › selector and "Today", historical comparison 2000–2026 on demand · **"Simulate the end of MODIS"** button at the foot of the card · a single 2000–2026 time bar with the yearly totals as a mini histogram. **Nothing scrolls**: the view fits fully in the window (tested at 1366×657). **No** raw switch, raw points, sensor tracks or downloads |
| Learn | Don Modesto's notebook in 4 steps (raw → static sources → cell-days → factor k) with monthly bars of `raw_points`, `viirs_cell_days`/`modis_cell_days` and `harmonized`; 3 questions |
| Educational | Two regions side by side (Sierra Gorda and Querétaro Bajío) with `k` and `seasonality` on the same scale; MODIS vs VIIRS; what the median is |
| Expert | **Full-screen console, no global scroll and no top bar.** The 3D map (`MapPanel tools`) fills the whole window; two panels float on top and are hidden with a button (remembered in `localStorage`). **Left, Controls**, with collapsible sections: Regions `[1] [2] [3]` (keyboard shortcuts), Data (Harmonized/Raw switch with an amber warning in raw), Indicators (month status, `calibration.k`, `loyo_annual_mape` / `monthly_mape` error), "Simulate the end of MODIS", and closed at first Downloads and k inspector. **Right, Calendar**: yearly bars aligned with the tiles (`CalendarTiles`: columns = years, rows = months; color by value or by level), the month's notes and the month's series collapsed. At the top right, a single floating strip of 36 px buttons: Calendar (shows or hides the panel), language, accessibility and View (`<TopBar floating lead=… />`, without the app name). With Controls hidden, an identical button remains at the top left. Map toolbar at the bottom center (drawing, 3D view, fire, north, fit, zoom) (icons only if both panels are open on a narrow screen). The map fits the region in the free space between panels (`padLeft` / `padRight`). Tested at 1366×657 and 1920×1080 |

## Visualization rules

- Dark theme with the tokens in `src/theme/tokens.ts` (mirrored in `src/index.css`). **No hand-written colors in components.**
- Surfaces `#090D14` (canvas) and `#111827` (panels and cards) with border `#1E293B`. White `#F8FAFC` with a cyan `#38BDF8` glow is **only** for interaction (selected month, active region, active button), never for data.
- Levels (Standard): No fires `#64748B`, Low `#A855F7`, Normal `#E06D53`, High `#F97316`, Extreme `#FDE047`. Colorblind-safe: `#2B5C8F`, `#5698A3`, `#D4AF37`, `#FDE725`. The same scale in the month card, per-year view, historical comparison and legend.
- A month with `harmonized = 0` is shown as "No fires (0)" in neutral gray, even if the API says `normal` (median 0).
- **Typography:** Space Grotesk (`font-display`: titles, buttons, selectors), Inter (body text) and JetBrains Mono (`font-mono`: figures, technical labels). `@fontsource-variable/*` packages, no network.
- **Animation (everything respects "reduce motion"):** panels that slide in and out and sections that collapse (`motion`), sliding marker in `Segmented`, letters that appear one by one when the region, month or level changes (`Reveal` in `ui.tsx`), tiles that appear by year on load and grow with a ring on hover, menus with `.pop`. No flame icons.
- **Performance:** no `backdrop-filter` / `backdrop-blur` over the map (it forces recompositing on every frame of the WebGL canvas); animate only `transform` and `opacity`; the map paints at `pixelRatio` ≤ 1.5 and its only repaint at rest is the fire flicker (~9 changes per second = ~18 frames, because MapLibre paints an extra one after each style change; none if there is no fire). Every property animated from code (`setPaintProperty` in a timer or `requestAnimationFrame`) carries `'<property>-transition': { duration: 0 }`: with the default 300 ms transition the map never settles and repaints at 60 frames per second; the calendar tooltip keeps its own state (`TipHost`) so that hovering does not repaint the 324 tiles; Overview, Learn and Educational are loaded with `lazy`.
- Console classes in `src/index.css`: `.bracket` (card with corner accents), `.hud` and `.tool` (floating controls), `.tile` (tile). Corners of 2–4 px at most; all figures in monospace with `tabular-nums`.
- **Harmonized:** cell color by `harmonized`. **Raw:** color by `raw_points`. Each mode with its own scale; the legend warns that they are not comparable.
- Inferno or Cividis ramps, clipped so the lowest value is visible on a dark background. Monotonic luminance: they read in grayscale and with colorblindness. Square-root scale.
- Zero = dark cell with "0". `harmonized = null` (`status = "no_data"`) → gray hatch, never the color of zero. A month not in the response → dashed border.
- The level is communicated with text and a mark in addition to color: `below` ↓ Low, `normal` Normal, `above` • High (p75–p90), `critical` •• Extreme (> p90), `insufficient_baseline` ? Not enough history.
- Flags (`flags`) → cyan triangle in the corner of the cell and an explanation in the tooltip and in the card.
- Cell tooltip: month, value, raw points, median (n), p25–p75 range, ratio, source, flags.
- Validation panel: `k`, `scope`, overlap months, sums, LOYO and monthly errors as percentages. If `scope = "country"`, a low-overlap warning.
- The margin shown is `calibration.monthly_mape`, not a fixed ±30 %.
- While loading, a skeleton; if the API returns an error, a message per `error.code` with a retry button.
- **Fire on the map: in Overview and in Expert** (the same `MapPanel`), only with what `POST /hotspots` (api.md) returns for the selected month (`getHotspots` in `api.ts`; months already queried are kept). They are **points per detection in the CONAE style** (`circle` layer `hot-core`: red `FIRE.dotLow` → orange → yellow `FIRE.dotPeak` by `frp`, larger with more `frp` and the most intense on top with `circle-sort-key`) over a **reddish thermal patch** in the background (`heatmap` layer `hot-fire`, `FIRE.ramp` from tokens, opacity 0.78, without washing out to white) in the areas with `is_vegetation_fire` detections. The brightness of the patch is normalized by how many detections there are (few → each one glows more; thousands → it is attenuated so it does not burn out to white): this is presentation only, the patch says **where** and the calendar says **how much**. In the console the fill of the active region is fainter (4 %) so it does not wash out the fire. Gray ring = detection at a static source. Hovering over a point opens its card (`components/map/hotspotPopup.ts`): satellite, date, FRP, type and coordinates from `POST /hotspots`; it opens toward the center of the screen, without stealing focus, and closes on leaving the point or changing month, area, mode or layer. The patch flickers by changing `heatmap-intensity` ~9 times per second (a timer, not on every frame; it stops with no fire, with the tab hidden or with "reduce motion"). **No flame icons.** In Expert it is turned off with the "Fire" button (Overview does not have that button: always on); the bottom bar says how many hot spots there are. More than 20,000 → the API answers `aoi_too_large` and the bar says so. With mocks there are no points. There is no 1 km pixel map: the API does not return cells.

## Map

**`maplibre-gl` only** (WebGL). OpenFreeMap "dark" vector base map (no API key). Regions as native GeoJSON layers (`fill` / `line`), below the labels.

- Camera: native `fitBounds` with dynamic `padding` `{ top: 80, bottom: 50, left: 40, right: 410 | 40 }` depending on whether the calendar panel is open or closed. **Never** animate the camera with manual loops (`requestAnimationFrame` + `setView`/`jumpTo`).
- **3D view (Expert only, `tools` prop):** native tilt and rotation (`pitch` 55°, `bearing` −18° within the same `fitBounds`) and real terrain with `setTerrain` + a `hillshade` layer over the open Mapzen/AWS elevation tiles (no API key). It is turned off with the "3D view" button. If the tiles do not load, the map stays flat and keeps working. Overview keeps the flat map.
- **There are no H3 hexagons, Deck.gl, industrial-source layer or points on the map:** the contract grid is 0.01° and the API does not return cells. To add them, the contract is changed first.
- The map always fills its box; the panels float on top (the canvas is not resized on open/close).
- Native rectangle and polygon drawing (no `mapbox-gl-draw`), with self-intersection validation and a maximum of 200,000 km². The polygon is sent as GeoJSON `[lon, lat]`, closed (first point = last).
- The worker is loaded with `?url` + `setWorkerUrl`. If you change map dependencies and the dev server gives `504 Outdated Optimize Dep`, restart it with `vite --force`.

## Bilingual

`src/i18n/es.ts` and `src/i18n/en.ts` with keys for every text. Language saved in `localStorage`; Spanish by default. Preset names come in `name_es` / `name_en`. New text → new key in **both** dictionaries.

## Base prompt for Figma Make (only for large redesigns)

The code already exists; Figma Make is only for redesigning a component and re-exporting it. If used, ask for: React + Vite + Tailwind, dark theme with the tokens in `src/index.css`, data only from `src/api.ts`, every text through `t(key)`, no statistics computed in the interface, level with text and icon, "no data" with a pattern different from zero.

## Before saying it is ready

Pass the Frontend section of `docs/contracts/acceptance.md`: first with mocks, then with the real API.

Before **every commit**:
1. `pnpm typecheck` and `pnpm build` without errors.
2. Visual check in a real browser on the dev server (Playwright or Chrome over CDP): open and close the calendar, switch region, draw an area, and check that the map fits the region without being covered. A screenshot without animation is not enough to say it "feels smooth": state it as not verified.
