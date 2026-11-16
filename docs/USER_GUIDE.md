# User guide

How to use the application: what is on screen, how to read the calendar and how to do the common tasks. To learn how it is built, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

The interface is available in Spanish and English; this guide uses the English labels.

## 1. What it is for

It answers one question: **is this month's fire in my area normal or anomalous against its own history?**

Satellites have recorded hot spots since 2000, but with two sensor families that cannot be compared directly: MODIS (since 2000, 1 km pixels) and VIIRS (since 2012, 375 m pixels, sees many more points). The application puts them on a single scale and compares each month against the same months of the other years.

It is designed for civil protection agencies, CONAFOR (Mexico's national forestry commission), fire brigades, protected natural areas and scientists. It covers Mexico, from 2000 to 2026.

**It does not predict fires** or measure burned area: it compares each month's burn activity with its history.

## 2. Opening the application

With the services running (see [`ARCHITECTURE.md`](ARCHITECTURE.md), section 9), open **http://localhost:5173** in Chromium or Chrome. It needs a window at least 1024 px wide; it has been tested at 1024, 1280 and 1366.

It opens on the **Expert** view with the Sierra Gorda, Querétaro region and the latest complete month with data.

If the bottom bar says **"DEMO (mocks)"** instead of a time in milliseconds, the application is not connected to the API and is showing sample data.

## 3. The screen

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ ┌─ Month readout ────┐   [ Search lat, lon ] [Calendar][Language][Access.][View]  │
│ │ SIERRA GORDA       │                                   ┌─ Calendar ───────────┐ │
│ │ ● NORMAL           │                                   │ Yearly total ▂▃▅▂▇   │ │
│ │ DEC 2008 · 1×      │            M A P                  │ 00 02 04 ... 24 26   │ │
│ │ Factor k · Error   │      (fire of the month)          │ J ▪▪▪▪▪▪▪▪▪▪▪▪▪▪     │ │
│ │ [Downloads][k insp]│                                   │ F ▪▪▪▪▪▪▪▪▪▪▪▪▪▪     │ │
│ └────────────────────┘                                   │ ...   [Value][Level] │ │
│                                                          └──────────────────────┘ │
│ ┌─ Time console ────────────────────────────────────────────────────────────────┐ │
│ │ [Regions]   [Harmonized|Raw]   [Rect][Poly][Coord][3D][Fire][N][⤢][−][+]      │ │
│ │ ▶  month-by-month activity 2000 ─────────────────│───────────────────── 2026  │ │
│ │    MODIS ██████████████████████████████████████████████████ [Switch MODIS off]│ │
│ │    VIIRS                        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
│ Source: NASA FIRMS · Cursor · Area · Hotspots · MODIS · S-NPP · NOAA · API 14 ms  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

| Zone | What it shows |
|---|---|
| **Map** | The selected area and the fire of the selected month: a thermal patch and one point per detection |
| **Month readout** (top left) | Region, the month's level, how many times the median, factor k and its error. Arrows to go to the previous or next month. Downloads and k-factor inspector buttons |
| **Top strip** | Coordinate search, Calendar button, language, accessibility and View menu |
| **Calendar** (right panel, can be hidden) | Yearly total and one tile for each month from 2000 to 2026 |
| **Time console** (bottom) | Regions, mode, map tools and the timeline with one track per sensor |
| **Bottom bar** | Credits, cursor coordinate, area in km², hot spots of the month, sensor status and API response time |

## 4. Concepts in one minute

| Term | Meaning |
|---|---|
| **Hot spot** | A hot pixel seen by the satellite. It is not a fire: one fire can produce many points |
| **Cell-day** | A ~1 km square with at least one vegetation hot spot that day. It is the application's unit. Ten points in the same square on the same day count once |
| **Factor k** | The "exchange rate" between sensors: MODIS cell-days divided by VIIRS cell-days, measured when both operated at the same time. It is computed for the selected area |
| **MODIS-eq.** | MODIS equivalent: VIIRS multiplied by k, so that the whole series is on the same scale |
| **Median** | The middle value of that month in the other years: half of them fell below |
| **Ratio** | The month's value divided by the median. 1× is typical; 5× is five times the typical value |
| **Static source** | Industry or flares that always glow in the same place. It is not vegetation fire and does not count |

## 5. Reading the calendar

Columns are years (00 to 26) and rows are months (J, F, M…). On top, one bar per year with its total; a dashed bar is an incomplete year.

### Levels

Each month is compared with the same month in the other years (at least 10 are needed):

| Level | Rule |
|---|---|
| **No fires** | It was measured and there was no fire (value 0) |
| **Low** | Lower than 25 % of years |
| **Normal** | Between 25 % and 75 % of years |
| **High** | Between 75 % and 90 % of years |
| **Extreme** | Higher than 90 % of years |
| **No data** | The satellite did not measure. **Not zero** |
| **Not enough history** | Fewer than 10 years to compare |

### Color: Value or Level

The **Value / Level** switch changes which question the color answers; the data is the same.

| Option | The color says | Use it to |
|---|---|---|
| **Value** | How much fire there was | See the season: March to May always looks intense |
| **Level** | How unusual it was for that month | Find anomalies: an October with little fire can be Extreme if October almost never has any |

Level only exists in harmonized mode; in raw mode the calendar is always colored by value.

### Marks

- **Hatched pattern:** no data (sensor outage or no files). Not zero.
- **Marked corner:** technical note; hovering shows which one.
- **Dot inside the tile:** High month. **Ring:** Extreme month. They let you read the level without relying on color.

### The detail of a month

Hovering over a tile shows:

| Field | Meaning |
|---|---|
| Value | MODIS-equivalent cell-days in the month |
| Raw points | All detections from all satellites, unfiltered |
| Median (n) | What is typical for that month and how many years it was computed from |
| Normal (p25–p75) | The range where the middle half of the years falls |
| Ratio | Value divided by median |
| Source | `MODIS` or `VIIRS × k` |
| Notes | The month's flags, if any |

### Notes

| Note | What it means |
|---|---|
| Terra only | Before July 2002 there was a single MODIS satellite; the month may undercount |
| MODIS outage | 3 or more days without Terra and Aqua; excluded from the median |
| VIIRS outage | 3 or more days without the reference VIIRS and its backup |
| Provisional | Near-real-time (NRT) data; may change |
| Partial month | Incomplete month; excluded from the median and given no level |
| No coverage | There are no files for that month |

## 6. Tasks

### Choosing an area

There are four ways:

1. **Example regions.** In the time console: Sierra Gorda, Querétaro Bajío or the full Querétaro box. You can also click a region on the map.
2. **Rectangle.** Rectangle tool, then click and drag on the map.
3. **Polygon.** Polygon tool, one click per vertex and a click on the first one to close. `Enter` closes, `Backspace` removes the last vertex, `Esc` cancels.
4. **Coordinates.** With the Coordinates tool: latitude, longitude and a radius of 25, 50 or 100 km. Or with the search box in the top strip (shortcut `/`): it accepts coordinates pasted from Google Maps, in decimal or in degrees, minutes and seconds.

The area must touch Mexico and be at most 200,000 km². **Fit** re-centers the map on the area.

### Choosing a month

- Click a tile in the calendar.
- Drag the timeline cursor, or use the arrows in the month readout.
- **Go to**, in the calendar: year and month, or a quick jump to a known episode.
- **Play** (▶) runs through time on its own.

When the month changes, the map shows that month's fire and the bottom bar counts its hot spots.

### Seeing fire on the map

The **Fire** button turns the layer on or off. Each point is a detection; its size and color depend on its power. Hovering over a point shows its card: satellite, date, radiative power (FRP, in MW), type (vegetation or static source) and coordinates.

If the area has more than 20,000 detections in the month, the bottom bar asks you to reduce the area.

**3D view** tilts the map and raises the terrain. Right-click and drag rotates and tilts. **North** straightens the map.

### Comparing raw and harmonized

The **Harmonized / Raw** switch in the time console:

- **Harmonized** (default): cell-days on the MODIS scale. This is the comparable series.
- **Raw:** the sum of all points from all satellites, as they arrive. It shows the problem: in 2012 the count jumps because VIIRS came in, not because there was more fire.

The two scales cannot be compared with each other.

### Simulating the end of MODIS

**Switch MODIS off**, at the end of the MODIS track in the time console, rebuilds the series using only VIIRS × k from February 2012 on. It answers what happens to the history when MODIS stops operating. The series with MODIS stays as a dashed line on the yearly bars for comparison.

The annual total changes little; the level of a single month can move one step. It is only available in harmonized mode.

### Checking how reliable the conversion is

The **k-factor inspector** button, in the month readout, shows:

| Item | Meaning |
|---|---|
| ΣMODIS and ΣVIIRS in the overlap | The two sums of cell-days when both sensors measured |
| Overlap months | How many months went into the calculation |
| k taken from | "this area" or "whole country" (if the area has little data) |
| Annual error (LOYO) | One year is removed, k is computed from the rest, and the error in predicting the removed year is measured. This is the typical error |
| Worst year (LOYO) | The year where that test came out worst |
| Monthly error | The typical error of a single month |

Rule of thumb: the annual total is reliable; a single month is approximate. That is why it is better to read the level than the exact figure.

### Downloading the data

The **Downloads** button, in the month readout:

| File | Contents |
|---|---|
| **Calendar CSV** | One row per month, 2000–2026, with the active basis (with or without MODIS) |
| **Hotspots CSV** | One row per detection of the selected month inside the area |
| **Area GeoJSON** | The queried polygon |

Columns of the calendar CSV:

`year, month, harmonized, source, raw_points, modis_cell_days, viirs_cell_days, baseline_median, baseline_p25, baseline_p75, baseline_p90, anomaly_ratio, status, flags`

Columns of the hot spots CSV:

`latitude, longitude, acq_date, acq_time, satellite, family, confidence, frp, daynight, type, source, is_vegetation_fire, cell_id`

In the CSVs, levels and notes are codes (`critical`, `modis_outage`), several notes are separated by `|`, and a month with no data is left empty, not 0.

| `status` | On screen |
|---|---|
| `below` | Low |
| `normal` | Normal |
| `above` | High |
| `critical` | Extreme |
| `no_data` | No data |
| `insufficient_baseline` | Not enough history |

## 7. Views

The **View** menu has two:

| View | For whom | Contents |
|---|---|---|
| **Expert** (initial) | Someone analyzing an area | Everything described in this guide |
| **Learn** | Someone who wants to understand the method | Four steps (raw, remove static sources, 1 km grid, factor k) with their charts, and a three-question quiz |

## 8. Accessibility and language

- **Language:** Spanish or English; everything is translated, including levels and notes. It is remembered between sessions.
- **Palettes:** Standard (thermal), Colorblind-safe (blue–yellow) and Extreme high contrast. They change the calendar and the fire on the map.
- **Level written out in addition to color:** the level always appears as a word, and High and Extreme carry their mark (dot and ring) inside the tile.
- **Sonification:** one tone per level as you move through the calendar.
- **Reduced motion:** if the system asks for it, animations and the fire flicker are removed.

### Keyboard

| Key | Where | Action |
|---|---|---|
| `Tab` | Whole app | Move through the controls; the first one is "Skip to content" |
| `/` | Whole app | Go to the coordinate search |
| Arrows | Calendar | Move between months and years |
| `Enter` or `Space` | Calendar | Select the month |
| `←` `→` | Timeline | One month back or forward |
| `Page Up` `Page Down` | Timeline | One year forward or back |
| `Enter` | Polygon drawing | Close the polygon |
| `Backspace` | Polygon drawing | Remove the last vertex |
| `Esc` | Drawing, menus, panels | Cancel or close |

## 9. Messages and common problems

| Message or symptom | Cause | What to do |
|---|---|---|
| "The area is outside the covered zone (Mexico)" | The area does not touch Mexico (sea or another country) | Choose an area inside Mexico |
| "The area is too large" | More than 200,000 km² | Draw a smaller area |
| "The polygon is not valid" | The outline crosses itself | Draw it again |
| "Cannot reach the API" | The API is not running | Start the API on port 8000; then Retry |
| "The database is not responding" | Postgres is off | `scripts/db_up.sh` |
| "over 20,000: reduce the area" | Too many points for the map in that month | Reduce the area; the calendar is not affected |
| The map background does not appear | No internet (the base map comes from outside) | The calendar and downloads keep working |
| The latest month shows "No data" with a value | It is a partial month: not complete yet | This is correct; a half-finished month is not compared against full months |
| k says "whole country" | The area has little overlap between sensors | Use a larger area if you want its own k |
| The bottom bar says "DEMO (mocks)" | `VITE_API_URL` is missing in `web/.env` | Set it and restart `pnpm dev` |

## 10. What to keep in mind when interpreting

- **Read levels, not exact figures.** The error of a single month is 33–37 %; a month near a threshold can fall into the neighboring level.
- **No data is not zero.** A hatched month says nothing about fire.
- **A cloudy month can look quiet.** The satellite cannot see through clouds.
- **Before July 2002 the values undercount:** there was only one satellite.
- **It does not measure intensity or burned area:** it counts where and on how many days there was a detection.
- **A point is not a fire:** it is a hot pixel.

Data source: NASA FIRMS (MODIS C6.1, VIIRS C2), part of NASA's LANCE.
