# Danube reference data (not from PyConnectedness)

PyConnectedness's own `examples/data/danube_log_discharges.csv` and `danube_network.csv` (the
model's input and the paper's ground-truth tree) carry no station coordinates or names. These
two files supply only that: where each of the library's 31 stations is, and how to draw the
rivers between them. Nothing here feeds the model; `run_danube.py` reads them only to label and
place what the library already computed.

## `stations.csv`

The `info` table of the R package **graphicalExtremes**'s Upper Danube dataset (Asadi, Peiman;
Davison, Anthony C.; Engelke, Sebastian, 2015), commit `ba40aec100826e54b36cc5c10d511a30e816f203`
of https://github.com/sebastian-engelke/graphicalextremes, `data/danube.rda`. Column `station` is
the table's row number (1-indexed), which **is** the library's own numbering: `flow_edges` in
that file names its 30 edges by these same row numbers, and that edge set is identical, pair for
pair, to PyConnectedness's `examples/data/danube_network.csv` — confirmed by direct comparison,
not assumed. `river`, `lat`, `lon` are `info$RivNames`, `info$Lat`, `info$Long`; `altitude_m` and
`catchment_area_km2` are `info$Alt` and `info$Area`, kept only as extra labels.

Four columns were added on 2026-11-18 from Miljana's own Demo Day package
(`repo/examples/data/danube_stations.csv` there): `yearly_flood_peak` and `mean_flow` (the
median of annual maxima and the long-run mean, both from the Bavarian Environment Agency's daily
series, CC BY 4.0, via graphicalExtremes), and `river_lat`/`river_lon` (the same gauge snapped
onto `rivers.geojson`'s traced line, for placing the station dot exactly on the river rather than
~0.1-0.2km off it; `lat`/`lon` stay the true gauge position for citation and the hover detail).
Checked against this file's own `lat`/`lon`/`river` before merging — all 31 stations matched.

Extracted with the `rdata` Python package (R has no CRAN access here); re-derive the original six
columns with:

```r
load("data/danube.rda")
write.csv(danube$info[, c("RivNames","Lat","Long","Alt","Area")], "stations.csv")
```

## `danube_flood_events.csv`

Daily discharge at every gauge for the days around 4 historical floods (May 1999, Aug 2002, Aug
2005, Jun 2013) — real data, not model output. From the same package as above
(`repo/examples/data/danube_flood_events.csv` there), the Bavarian Environment Agency's daily
series (CC BY 4.0, via graphicalExtremes), re-dated the same way the main daily series was
(see the package's own README: `graphicalExtremes::danube$data_raw` stores every gauge from
1900-11-01 regardless of its true start, found instead by cross-correlating day-to-day log
changes against the 9 gauges that are dated correctly). Column 1 (Passau-Achleiten) ends
2010-12-31, so it carries no 2013 values — blank in the CSV, `null` in `danube.json`.
`run_danube.py` divides each value by that gauge's own `yearly_flood_peak` from `stations.csv`,
for the Historical floods mode on the page.

## `bavaria_relief_10arcmin.csv`

A 21×34 grid of mean elevation (metres), 10 arc-minutes apart, lon 9.0–14.5 and lat 46.83–50.17
— wider than the basin's own bounding box, for context around its edges. From the same package
(`repo/examples/data/bavaria_relief_10arcmin.csv` there): ETOPO1 10' (NOAA, public domain) and
the Natural Earth 2' shaded relief from `basemap-data` (public domain), averaged onto this
coarser grid. Grounds the tilted map's terrain backdrop (danube-map.ts's `reliefDataUrl`) in
real elevation instead of a hand-picked gradient.

## `rivers.geojson`

One LineString per edge of `danube$flow_edges` (the same 30 pairs as above), for the map
background. Replaced 2026-11-18 with Miljana's own Demo Day package's traced lines
(`repo/examples/data/danube_river_paths.csv` there, 2826 points across all 30 edges, every edge
now `"drawn": "traced"` — the previous version below couldn't trace 10 of the 30 and fell back to
a straight line for those).

Per that package's own README: World Data Bank II via `basemap-data` (public domain) wherever a
named river passes near both endpoint stations; the Iller, Naab, Regen and Saalach — the four
rivers the original Natural Earth pass below couldn't find at all — are instead smooth lines
drawn through their own gauges and river towns, not traced from a published river-line dataset.
`source` records which (`WDB_II_via_basemap-data` or `...+hand-smoothed`); `river` names the
matched river where both endpoints share one, `null` at a confluence into a different named
river. Checked: every edge's first/last point lands within ~0.002 degrees of its station's own
`lat`/`lon` (not `river_lat`/`river_lon`), and every coordinate falls inside the basin's known
bounding box (lon 9.98-13.51, lat 47.52-49.23).

License note from the same package: this and the other new CSVs are flagged there as "to check
before [they] go into the public repo" — worth confirming with Miljana's side before this
reaches the public GitHub Pages deploy, even though WDB II, like the sources below, is itself
public domain.

<details>
<summary>Previous version (Natural Earth, 20/30 edges traced), for history</summary>

Traced from Natural Earth's 10m rivers (`ne_10m_rivers_lake_centerlines` and its Europe supplement
`ne_10m_rivers_europe`, public domain, naturalearthdata.com, version 5.0.0 — the current release —
via the official S3 mirror) wherever a named river passes near both endpoint stations: the
Danube, Inn, Isar, Salzach/Saalach and Naab (as "Waldnaab"), **20 of the 30 edges**. That count
includes three reaches recovered by matching across a river's own split parts, and at a
tributary's confluence into another named river (not just a shapefile part's own endpoint) — e.g.
where the Waldnaab's drawn line ends at an interior point of the Danube's line, not at a vertex
the Danube record calls its own endpoint.

OpenStreetMap, the other source this was asked to consider, was not reachable from this
environment (its Overpass API and bulk Geofabrik extracts were both blocked by this session's
network policy). Checked carefully against round 2's expectation that the Europe supplement
would include the Iller, Lech, Naab and Regen: **the Iller, Lech and Regen genuinely are not in
either Natural Earth file** — every vertex (named or not) within 20km of every station on those
rivers was checked, and the nearest unrelated river line is 11-85km away. Only the Naab is
present, under the name "Waldnaab." The other 10 edges were drawn as a straight line between the
two real station coordinates instead (12-11, 11-10, 22-21, 21-20, 20-7, 29-28, 28-31, 27-26,
26-25, 25-4).

Re-derive from `https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_rivers_lake_centerlines.zip`
and `.../ne_10m_rivers_europe.zip`: for each `flow_edges` pair, first search both shapefiles'
named line parts for one with a vertex within 0.08 degrees of each station, taking the sub-line
between those two vertices, oriented from the upstream to the downstream station. Where that
fails, fall back to a looser cross-part/cross-record match (0.02 degrees): a station's own nearby
vertex on one line part, bridged to any vertex — not necessarily an endpoint — on another part or
record, which is what recovers the three confluence/split-record cases above. Otherwise fall back
to the straight pair.

</details>
