# Flight delays

From Miljana's own Demo Day package (18 Nov 2026 WeTransfer), itself a copy of PyConnectedness's
own `examples/data/` for `demo_flight_delays.ipynb` (not yet pushed to `main` as of that date).

- `us_flight_delays_2010_2013.csv`: daily total delay minutes (arrivals plus departures) at the
  20 busiest US airports, 2010-2013. US Bureau of Transportation Statistics (public domain), via
  the R package `graphicalExtremes` (GPL-3).
- `us_airports.csv`: airport code, name, city, latitude, longitude. OpenFlights (ODbL 1.0), via
  the same package.
- `us_flight_routes.csv`: total flights between each pair of these airports, for the "busiest
  routes" backdrop behind the causal links. US Bureau of Transportation Statistics, same source.

`pipeline/run_flights.py` fits `MaxLinear(delays).fit(k=100, k_order=250)` (Klüppelberg and
Krali, 2021, 2025 -- the "scaling" method, a general DAG rather than Danube's single tree), then
sweeps `k_order` 100-500 to check how stable that order is.
