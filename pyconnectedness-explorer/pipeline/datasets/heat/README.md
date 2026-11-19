# Heat waves

From Miljana's own Demo Day package (18 Nov 2026 WeTransfer), itself a copy of PyConnectedness's
own `examples/data/` for `demo_us_heat.ipynb` (not yet pushed to `main` as of that date).

- `us_tmax_1990_1993.csv`: daily maximum temperature (°F) at 137 NOAA stations in the central
  and eastern US, 1990-1993. NOAA (public domain), via the R package `STRbook` (Wikle, Zammit-
  Mangion and Cressie, 2019; GPL >= 2.1).
- `us_tmax_stations.csv`: station id, latitude, longitude.

`pipeline/run_heat.py` computes each station's anomaly against a 31-day-smoothed day-of-year
climatology, replays the May 1991 heat wave day by day, then fits
`MaxLinear(regional_summer_anomaly).fit(k=50, k_order=100)` on nine regions (three latitude
bands x three longitude bands, summer months only) and sweeps `k_order` 40-300 to check how
stable that order is -- the same "scaling" method as Flights and Vitamin A.
