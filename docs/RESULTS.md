# Results

Figures measured with the real API over the full Mexico database. They are regenerated with `python3 scripts/pitch_numbers.py` (with the API on port 8000). Last run: Nov 15, 2026.

## The false jump disappears

Comparing 2011 (MODIS only) with 2019 (MODIS and VIIRS), raw points multiply while the harmonized series barely changes:

| Region | Raw points 2011 → 2019 | Harmonized 2011 → 2019 |
|---|---|---|
| Sierra Gorda | 175 → 2,167 (×12.4) | 167 → 154 (×0.92) |
| Querétaro Bajío | 349 → 5,137 (×14.7) | 243 → 260 (×1.07) |
| Querétaro (full box) | 524 → 7,304 (×13.9) | 410 → 414 (×1.01) |

## Factor k and its error

| Region | Area (km²) | k | Overlap months | Annual error (one year out) | Worst year | Monthly error |
|---|---:|---:|---:|---:|---:|---:|
| Sierra Gorda | 14,706 | 0.260 | 167 | 17.2 % | 55.2 % | 36.9 % |
| Querétaro Bajío | 16,636 | 0.304 | 167 | 10.1 % | 43.6 % | 37.3 % |
| Querétaro (full box) | 31,342 | 0.290 | 167 | 5.9 % | 15.4 % | 33.2 % |

The annual total is reliable; a single month is approximate. That is why each month's level is given by percentiles.

## Season and highest months

| Region | Peak | Months that concentrate the fire | Highest complete years |
|---|---|---|---|
| Sierra Gorda | May | April, May and June: 62 % | 2011 (167), 2019 (154), 2013 (123) |
| Querétaro Bajío | March | January, February and March: 46 % | 2025 (447), 2017 (317), 2016 (295) |
| Querétaro (full box) | March | March, April and May: 43 % | 2025 (561), 2017 (416), 2019 (414) |

The five highest months in 26 years (MODIS-equivalent cell-days and times the median):

| Sierra Gorda | Querétaro Bajío | Querétaro (full box) |
|---|---|---|
| May 2024 · 64 · 3.37× | Feb 2026 · 150 · 5.0× | Feb 2026 · 166 · 5.03× |
| Apr 2011 · 61 · 5.55× | Apr 2025 · 113 · 7.29× | Apr 2025 · 149 · 5.05× |
| May 2019 · 61 · 3.21× | Mar 2025 · 91 · 2.53× | Mar 2025 · 107 · 2.3× |
| Mar 2013 · 57 · 6.71× | Feb 2016 · 80 · 2.67× | Mar 2022 · 93 · 2.0× |
| May 2009 · 50 · 2.63× | Jan 2026 · 79 · 3.59× | Mar 2021 · 91 · 1.96× |

February 2026 is the month with the most activity in the series in the Bajío and in the full Querétaro box.

## Without MODIS

With "Simulate the end of MODIS" (the series uses VIIRS × k from February 2012 on), against the series with MODIS over 2012–2025:

| Region | Annual change (median) | Worst year | Same monthly level | Within one level |
|---|---:|---:|---:|---:|
| Sierra Gorda | 16 % | 51 % | 56 % | 90 % |
| Querétaro Bajío | 9 % | 37 % | 55 % | 89 % |
| Querétaro (full box) | 6 % | 14 % | 55 % | 93 % |

The annual history is preserved; the level of a single month can move one step.

## Other places in Mexico

Rectangles drawn against the real API. `k` changes with the place, which is why it is computed for each area:

| Place | Box (W, S, E, N) | Response | k | Highest month in 26 years | Season peak |
|---|---|---:|---:|---|---|
| Ajusco / south of Mexico City | -99.40, 19.10, -99.05, 19.30 | 0.21 s | 0.24 | Mar 2011 (10.8×) | March |
| La Primavera, Jalisco | -103.70, 20.55, -103.45, 20.75 | 0.19 s | 0.69 | Apr 2012 (11.8×) | April |
| Lacandon Jungle, Chiapas | -91.60, 16.20, -90.60, 17.00 | 0.22 s | 0.34 | May 2003 (3.5×) | April |
| Sierra Tarahumara | -108.20, 27.00, -107.00, 28.20 | 0.24 s | 0.28 | May 2011 (11.7×) | May |
| Yucatán Peninsula (center) | -89.50, 19.50, -88.00, 20.80 | 0.28 s | 0.40 | Apr 2011 (2.9×) | April |
| Chimalapas, Oaxaca | -94.60, 16.60, -94.00, 17.20 | 0.22 s | 0.34 | Apr 2024 (5.1×) | April |

The months listed are what the application shows; they have not been checked against external fire reports.

Method and limits: [`contracts/harmonization.md`](contracts/harmonization.md). Control figures used to verify the system: [`contracts/acceptance.md`](contracts/acceptance.md).
