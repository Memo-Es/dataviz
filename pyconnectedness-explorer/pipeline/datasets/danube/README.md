# Danube reference data (not from PyConnectedness)

PyConnectedness's own `examples/data/danube_log_discharges.csv` and `danube_network.csv` (the
model's input and the paper's ground-truth tree) carry no station coordinates or names. These
two files supply only that: where each of the library's 31 stations is, and how to draw the
rivers between them. Nothing here feeds the model; `run_danube.py` reads them only to label and
place what the library already computed.

## `stations.csv`

The `info` table of the R package **graphicalExtremes** (Asadi, Davison and Engelke 2015's Upper
Danube dataset), commit `ba40aec100826e54b36cc5c10d511a30e816f203` of
https://github.com/sebastian-engelke/graphicalextremes, `data/danube.rda`. Column `station` is
the table's row number (1-indexed), which **is** the library's own numbering: `flow_edges` in
that file names its 30 edges by these same row numbers, and that edge set is identical, pair for
pair, to PyConnectedness's `examples/data/danube_network.csv` -- confirmed by direct comparison,
not assumed. `river`, `lat`, `lon` are `info$RivNames`, `info$Lat`, `info$Long`; `altitude_m` and
`catchment_area_km2` are `info$Alt` and `info$Area`, kept only as extra labels.

Extracted with the `rdata` Python package (R has no CRAN access here); re-derive with:

```r
load("data/danube.rda")
write.csv(danube$info[, c("RivNames","Lat","Long","Alt","Area")], "stations.csv")
```

## `rivers_natural_earth.geojson`

One LineString per edge of `danube$flow_edges` (the same 30 pairs as above), for the map
background. Traced from Natural Earth's 10m rivers (`ne_10m_rivers_lake_centerlines` and its
Europe supplement `ne_10m_rivers_europe`, public domain, naturalearthdata.com, version 5.0.0 —
the current release — via the official S3 mirror) wherever a named river passes near both
endpoint stations: the Danube, Inn, Isar, Salzach/Saalach and Naab (as "Waldnaab"), **20 of the
30 edges**. That count includes three reaches recovered by matching across a river's own split
parts, and at a tributary's confluence into another named river (not just a shapefile part's own
endpoint) — e.g. where the Waldnaab's drawn line ends at an interior point of the Danube's line,
not at a vertex the Danube record calls its own endpoint.

OpenStreetMap, the other source this was asked to consider, was not reachable from this
environment (its Overpass API and bulk Geofabrik extracts were both blocked by this session's
network policy). Checked carefully against round 2's expectation that the Europe supplement
would include the Iller, Lech, Naab and Regen: **the Iller, Lech and Regen genuinely are not in
either Natural Earth file** — every vertex (named or not) within 20km of every station on those
rivers was checked, and the nearest unrelated river line is 11–85km away. Only the Naab is
present, under the name "Waldnaab." The other 10 edges are drawn as a straight line between the
two real station coordinates instead:

| From | River | To | River |
|---|---|---|---|
| 12 | Iller | 11 | Iller |
| 11 | Iller | 10 | Donau |
| 22 | Lech | 21 | Lech |
| 21 | Lech | 20 | Lech |
| 20 | Lech | 7 | Donau |
| 29 | Saalach | 28 | Saalach |
| 28 | Saalach | 31 | Salzach |
| 27 | Regen | 26 | Regen |
| 26 | Regen | 25 | Regen |
| 25 | Regen | 4 | Donau |

Each feature's `drawn` property says which ("traced" or "straight"), and `river` names the
matched line where there is one, so the map (and anyone printing it) can tell real river geometry
from a straight stand-in.

Re-derive from `https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_rivers_lake_centerlines.zip`
and `.../ne_10m_rivers_europe.zip`: for each `flow_edges` pair, first search both shapefiles'
named line parts for one with a vertex within 0.08 degrees of each station, taking the sub-line
between those two vertices, oriented from the upstream to the downstream station. Where that
fails, fall back to a looser cross-part/cross-record match (0.02 degrees): a station's own nearby
vertex on one line part, bridged to any vertex — not necessarily an endpoint — on another part or
record, which is what recovers the three confluence/split-record cases above. Otherwise fall back
to the straight pair.
