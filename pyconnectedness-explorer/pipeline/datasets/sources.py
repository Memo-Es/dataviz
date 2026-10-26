"""
Public datasets for the explorer's dataset selector, one function per API.

Each `fetch_*` returns a DataFrame of observed values: a DatetimeIndex and one column per
variable. `prepare_*` turns that into the series PyConnectedness models (changes or anomalies).
The connectedness numbers themselves are always computed by the library's own functions, in
compute.py; nothing here estimates anything.

The stock-market dataset is not here: it's built by the authors' demo, examples/Demo.ipynb
(run_demo.py). Its descriptor lives in DESCRIPTORS below so the app can list it alongside.
"""
from __future__ import annotations

import io
import json
import time
import urllib.error
import urllib.request
import zipfile
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd

UA = {"User-Agent": "pyconnectedness-explorer/0.1 (+https://github.com/Memo-Es/dataviz)"}


def get(url: str, *, tries: int = 5, timeout: int = 60) -> bytes:
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = e
            # rate limited: wait as long as the server asks, or a full minute
            wait = int(e.headers.get("Retry-After") or 0) or 60 if e.code == 429 else 2 * 2**i
            time.sleep(wait)
        except Exception as e:  # network hiccups: back off and retry
            last = e
            time.sleep(2 * 2**i)
    raise RuntimeError(f"GET {url} failed: {last}")


def weekly_last(df: pd.DataFrame) -> pd.DataFrame:
    return df.resample("W-FRI").last().ffill()


def log_changes(levels: pd.DataFrame) -> pd.DataFrame:
    return np.log(levels).diff().mul(100).dropna()


def seasonal_anomaly(weekly: pd.DataFrame) -> pd.DataFrame:
    """Subtract each week-of-year's long-run mean, so the seasons don't count as 'connectedness'."""
    woy = weekly.index.isocalendar().week.clip(upper=52).to_numpy()
    clim = weekly.groupby(woy).transform("mean")
    return (weekly - clim).dropna()


# ---------------------------------------------------------------------------------------------
# FRED (Federal Reserve Bank of St. Louis): daily exchange rates, no API key needed for CSV
# ---------------------------------------------------------------------------------------------
# code: (FRED series, +1 if quoted USD per unit of the currency, -1 if units per USD, group)
FX = {
    "EUR": ("DEXUSEU", +1, "Europe"), "GBP": ("DEXUSUK", +1, "Europe"),
    "CHF": ("DEXSZUS", -1, "Europe"), "SEK": ("DEXSDUS", -1, "Europe"),
    "NOK": ("DEXNOUS", -1, "Europe"), "ZAR": ("DEXSFUS", -1, "Europe"),
    "CAD": ("DEXCAUS", -1, "Americas"), "MXN": ("DEXMXUS", -1, "Americas"),
    "BRL": ("DEXBZUS", -1, "Americas"),
    "JPY": ("DEXJPUS", -1, "Asia Pacific"), "AUD": ("DEXUSAL", +1, "Asia Pacific"),
    "NZD": ("DEXUSNZ", +1, "Asia Pacific"), "CNY": ("DEXCHUS", -1, "Asia Pacific"),
    "INR": ("DEXINUS", -1, "Asia Pacific"), "KRW": ("DEXKOUS", -1, "Asia Pacific"),
    "SGD": ("DEXSIUS", -1, "Asia Pacific"), "THB": ("DEXTHUS", -1, "Asia Pacific"),
    "TWD": ("DEXTAUS", -1, "Asia Pacific"),
}
FX_NAMES = {
    "EUR": "Euro", "GBP": "Pound", "CHF": "Swiss franc", "SEK": "Swedish krona",
    "NOK": "Norwegian krone", "ZAR": "South African rand", "CAD": "Canadian dollar",
    "MXN": "Mexican peso", "BRL": "Brazilian real", "JPY": "Yen", "AUD": "Australian dollar",
    "NZD": "New Zealand dollar", "CNY": "Yuan", "INR": "Indian rupee", "KRW": "Won",
    "SGD": "Singapore dollar", "THB": "Baht", "TWD": "Taiwan dollar",
}


def fetch_fx() -> pd.DataFrame:
    cols = {}
    for code, (series, sign, _) in FX.items():
        raw = pd.read_csv(io.BytesIO(get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}")))
        raw.columns = ["date", "value"]
        s = pd.to_numeric(raw["value"], errors="coerce")
        s.index = pd.to_datetime(raw["date"])
        cols[code] = s if sign > 0 else 1 / s  # always: US dollars per unit of the currency
    return pd.DataFrame(cols)


def prepare_fx(levels: pd.DataFrame) -> pd.DataFrame:
    # from 2006: the yuan was pegged to the dollar before July 2005, a constant series
    return log_changes(weekly_last(levels.loc["2006":])).dropna()


# ---------------------------------------------------------------------------------------------
# ECB Data Portal: euro-area 10-year government bond yields (convergence criterion), monthly
# ---------------------------------------------------------------------------------------------
YIELDS = {
    "DE": ("Germany", "Core"), "FR": ("France", "Core"), "NL": ("Netherlands", "Core"),
    "BE": ("Belgium", "Core"), "AT": ("Austria", "Core"), "FI": ("Finland", "Core"),
    "IT": ("Italy", "Periphery"), "ES": ("Spain", "Periphery"), "PT": ("Portugal", "Periphery"),
    "IE": ("Ireland", "Periphery"), "GR": ("Greece", "Periphery"),
}


def fetch_yields() -> pd.DataFrame:
    key = "+".join(YIELDS)
    url = f"https://data-api.ecb.europa.eu/service/data/IRS/M.{key}.L.L40.CI.0000.EUR.N.Z?format=csvdata"
    raw = pd.read_csv(io.BytesIO(get(url)))
    wide = raw.pivot_table(index="TIME_PERIOD", columns="REF_AREA", values="OBS_VALUE")
    wide.index = pd.PeriodIndex(wide.index, freq="M").to_timestamp(how="end").normalize()
    return wide.rename(columns={k: v[0] for k, v in YIELDS.items()})


def prepare_yields(levels: pd.DataFrame) -> pd.DataFrame:
    return levels.diff().mul(100).dropna()  # monthly change, in basis points


# ---------------------------------------------------------------------------------------------
# Coinbase Exchange: daily candles, public market-data endpoint
# ---------------------------------------------------------------------------------------------
COINS = {
    "Bitcoin": ("BTC-USD", "Payments"), "Litecoin": ("LTC-USD", "Payments"),
    "Bitcoin Cash": ("BCH-USD", "Payments"), "Stellar": ("XLM-USD", "Payments"),
    "Dogecoin": ("DOGE-USD", "Payments"),
    "Ethereum": ("ETH-USD", "Platforms"), "Ethereum Classic": ("ETC-USD", "Platforms"),
    "Cardano": ("ADA-USD", "Platforms"), "Solana": ("SOL-USD", "Platforms"),
    "Avalanche": ("AVAX-USD", "Platforms"), "Polkadot": ("DOT-USD", "Platforms"),
    "Chainlink": ("LINK-USD", "Platforms"),
}


def fetch_crypto() -> pd.DataFrame:
    end = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    cols = {}
    for name, (product, _) in COINS.items():
        rows = []
        stop = end
        for _ in range(40):  # 300 candles per request, walk back up to ~30 years
            start = stop - timedelta(days=299)
            url = (f"https://api.exchange.coinbase.com/products/{product}/candles?granularity=86400"
                   f"&start={start:%Y-%m-%dT%H:%M:%SZ}&end={stop:%Y-%m-%dT%H:%M:%SZ}")
            chunk = json.loads(get(url))
            if not chunk:
                break
            rows.extend(chunk)
            stop = start - timedelta(days=1)
            time.sleep(0.35)  # public rate limit
        if rows:
            df = pd.DataFrame(rows, columns=["t", "low", "high", "open", "close", "volume"])
            s = df.drop_duplicates("t").set_index(pd.to_datetime(df["t"].drop_duplicates(), unit="s"))["close"]
            cols[name] = s.sort_index()
    return pd.DataFrame(cols)


def prepare_crypto(levels: pd.DataFrame) -> pd.DataFrame:
    return log_changes(levels.dropna())  # daily, balanced: from when the last coin listed


# ---------------------------------------------------------------------------------------------
# Kenneth French Data Library: 30 US industry portfolios, daily (the extreme-risk paper's data)
# ---------------------------------------------------------------------------------------------
INDUSTRIES = {
    "Food": ("Food products", "Consumer"), "Beer": ("Beer & liquor", "Consumer"),
    "Smoke": ("Tobacco", "Consumer"), "Games": ("Recreation", "Consumer"),
    "Books": ("Printing & publishing", "Consumer"), "Hshld": ("Consumer goods", "Consumer"),
    "Clths": ("Apparel", "Consumer"), "Hlth": ("Healthcare", "Consumer"),
    "Rtail": ("Retail", "Consumer"), "Meals": ("Restaurants & hotels", "Consumer"),
    "Chems": ("Chemicals", "Industry & energy"), "Txtls": ("Textiles", "Industry & energy"),
    "Cnstr": ("Construction", "Industry & energy"), "Steel": ("Steel", "Industry & energy"),
    "FabPr": ("Fabricated products", "Industry & energy"), "ElcEq": ("Electrical equipment", "Industry & energy"),
    "Autos": ("Autos", "Industry & energy"), "Carry": ("Aircraft, ships, rail", "Industry & energy"),
    "Mines": ("Mining", "Industry & energy"), "Coal": ("Coal", "Industry & energy"),
    "Oil": ("Oil & gas", "Industry & energy"), "Paper": ("Business supplies", "Industry & energy"),
    "Util": ("Utilities", "Services & finance"), "Telcm": ("Telecoms", "Services & finance"),
    "Servs": ("Business services", "Services & finance"), "BusEq": ("Business equipment", "Services & finance"),
    "Trans": ("Transportation", "Services & finance"), "Whlsl": ("Wholesale", "Services & finance"),
    "Fin": ("Finance", "Services & finance"), "Other": ("Everything else", "Services & finance"),
}


def fetch_industries() -> pd.DataFrame:
    url = "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/30_Industry_Portfolios_daily_CSV.zip"
    with zipfile.ZipFile(io.BytesIO(get(url, timeout=120))) as z:
        text = z.read(z.namelist()[0]).decode("latin-1")
    lines = text.splitlines()
    head = next(i for i, l in enumerate(lines) if l.strip().startswith(",Food") or l.replace(" ", "").startswith(",Food"))
    rows = []
    for l in lines[head + 1:]:
        parts = [p.strip() for p in l.split(",")]
        if len(parts) < 31 or not parts[0].isdigit():
            break  # end of the first block: value-weighted daily returns
        rows.append(parts[:31])
    cols = [c.strip() for c in lines[head].split(",")[1:31]]
    df = pd.DataFrame([r[1:] for r in rows], columns=cols, index=pd.to_datetime([r[0] for r in rows], format="%Y%m%d"))
    df = df.apply(pd.to_numeric, errors="coerce").replace(-99.99, np.nan)
    return df.rename(columns=lambda c: c.strip())


def prepare_industries(daily_pct: pd.DataFrame) -> pd.DataFrame:
    r = daily_pct.loc["1990":] / 100
    weekly = (1 + r).resample("W-FRI").prod().sub(1).mul(100)  # compounded weekly return, %
    return weekly.dropna()


# ---------------------------------------------------------------------------------------------
# USGS Water Services: daily mean discharge at gauges along the Mississippi system
# ---------------------------------------------------------------------------------------------
GAUGES = {
    "05331000": ("Mississippi · St. Paul", "Upper Mississippi"),
    "05587450": ("Mississippi · Grafton", "Upper Mississippi"),
    "06934500": ("Missouri · Hermann", "Missouri & Arkansas"),
    "07263450": ("Arkansas · Little Rock", "Missouri & Arkansas"),
    "03294500": ("Ohio · Louisville", "Ohio"),
    "03611500": ("Ohio · Metropolis", "Ohio"),
    "07010000": ("Mississippi · St. Louis", "Middle & lower Mississippi"),
    "07022000": ("Mississippi · Thebes", "Middle & lower Mississippi"),
    "07289000": ("Mississippi · Vicksburg", "Middle & lower Mississippi"),
}


def fetch_rivers() -> pd.DataFrame:
    url = ("https://waterservices.usgs.gov/nwis/dv/?format=json&parameterCd=00060&statCd=00003"
           f"&startDT=1990-01-01&endDT={date.today():%Y-%m-%d}&sites=" + ",".join(GAUGES))
    data = json.loads(get(url, timeout=180))
    cols = {}
    for ts in data["value"]["timeSeries"]:
        site = ts["sourceInfo"]["siteCode"][0]["value"]
        # a site can return several series (e.g. per method): keep its fullest one
        vals = max((v["value"] for v in ts["values"]), key=len, default=[])
        s = pd.Series({pd.Timestamp(v["dateTime"][:10]): float(v["value"]) for v in vals}, dtype=float)
        s = s.where(s > 0)  # USGS marks missing values with negative sentinels
        name = GAUGES[site][0]
        if name not in cols or s.count() > cols[name].count():
            cols[name] = s
    df = pd.DataFrame(cols).sort_index()
    print("    rivers: days per gauge", df.count().to_dict(), flush=True)
    return df


def prepare_rivers(daily: pd.DataFrame) -> pd.DataFrame:
    weekly = np.log(daily.resample("W-FRI").mean())
    # drop gauges that miss more than a tenth of the weeks, then keep weeks where all report
    weekly = weekly.loc[:, weekly.notna().mean() >= 0.9]
    return seasonal_anomaly(weekly.dropna())  # log-flow anomaly: wetter or drier than usual for the week


# ---------------------------------------------------------------------------------------------
# Open-Meteo historical weather (ERA5 reanalysis): daily mean temperature in European capitals
# ---------------------------------------------------------------------------------------------
CITIES = {
    "London": (51.51, -0.13, "West"), "Dublin": (53.35, -6.26, "West"), "Paris": (48.86, 2.35, "West"),
    "Brussels": (50.85, 4.35, "West"), "Amsterdam": (52.37, 4.90, "West"),
    "Oslo": (59.91, 10.75, "North"), "Stockholm": (59.33, 18.07, "North"), "Helsinki": (60.17, 24.94, "North"),
    "Berlin": (52.52, 13.40, "Centre & east"), "Vienna": (48.21, 16.37, "Centre & east"),
    "Warsaw": (52.23, 21.01, "Centre & east"),
    "Lisbon": (38.72, -9.14, "South"), "Madrid": (40.42, -3.70, "South"), "Rome": (41.90, 12.50, "South"),
    "Athens": (37.98, 23.73, "South"),
}


def fetch_climate() -> pd.DataFrame:
    end = date(date.today().year - 1, 12, 31)
    cols = {}
    for city, (lat, lon, _) in CITIES.items():
        url = ("https://archive-api.open-meteo.com/v1/archive?"
               f"latitude={lat}&longitude={lon}&start_date=1995-01-01&end_date={end:%Y-%m-%d}"
               "&daily=temperature_2m_mean&timezone=UTC")
        d = json.loads(get(url, timeout=120, tries=6))["daily"]
        cols[city] = pd.Series(d["temperature_2m_mean"], index=pd.to_datetime(d["time"]), dtype=float)
        time.sleep(15)  # the free tier weighs long histories heavily: stay well under its rate limit
    return pd.DataFrame(cols)


def prepare_climate(daily: pd.DataFrame) -> pd.DataFrame:
    return seasonal_anomaly(daily.resample("W-FRI").mean())  # °C above or below normal for the week


# ---------------------------------------------------------------------------------------------
# What the app shows for each dataset. `model` follows the authors' demo (generalized, VAR(2),
# 10-step horizon) with a rolling window sized to the data.
# ---------------------------------------------------------------------------------------------

DESCRIPTORS = {
    "stocks": {
        "title": "World stock markets",
        "headline": "How shocks travel between the world's stock markets",
        "items": "stock markets", "item": "market",
        "source": "Yahoo Finance", "api": "Yahoo Finance chart API, via yfinance",
        "api_url": "https://finance.yahoo.com",
        "step": "week", "steps": "weeks",
        "series": "returns (the weekly % change) and volatility (the weekly high–low swing) per market",
        "built_by": "the authors' demo, examples/Demo.ipynb, run unchanged",
        "measures": {"returns": "Returns", "volatility": "Volatility"},
        "episodes": {"2001-09-30": "Dot-com", "2008-10-31": "Lehman", "2011-09-30": "Euro-area crisis",
                     "2015-08-31": "China devaluation", "2020-03-31": "COVID crash", "2022-09-30": "Inflation shock"},
        "groups": {
            "US": "Americas", "Canada": "Americas", "Mexico": "Americas", "Brazil": "Americas", "Argentina": "Americas",
            "UK": "Europe", "Germany": "Europe", "France": "Europe", "Switzerland": "Europe", "Spain": "Europe",
            "Turkey": "Europe", "Japan": "Asia Pacific", "South Korea": "Asia Pacific", "China": "Asia Pacific",
            "Hong Kong": "Asia Pacific", "Taiwan": "Asia Pacific", "Singapore": "Asia Pacific",
            "Malaysia": "Asia Pacific", "Indonesia": "Asia Pacific", "Australia": "Asia Pacific"},
        "group_order": ["Americas", "Europe", "Asia Pacific"],
        "labels": {"Australia": "All Ordinaries", "Japan": "Nikkei 225", "Hong Kong": "Hang Seng", "Germany": "DAX",
                   "France": "CAC 40", "UK": "FTSE 100", "Canada": "S&P/TSX Composite", "US": "S&P 500",
                   "Switzerland": "SMI", "Singapore": "Straits Times", "Indonesia": "Jakarta Composite",
                   "Mexico": "IPC", "Brazil": "Bovespa", "Spain": "IBEX 35", "Malaysia": "FTSE Bursa Malaysia KLCI",
                   "Argentina": "MERVAL", "South Korea": "KOSPI", "Turkey": "BIST 100", "China": "SSE Composite",
                   "Taiwan": "TAIEX"},
    },
    "fx": {
        "title": "Currencies",
        "headline": "How shocks travel between the world's currencies",
        "items": "currencies", "item": "currency",
        "source": "FRED, Federal Reserve Bank of St. Louis", "api": "FRED series download",
        "api_url": "https://fred.stlouisfed.org/categories/94",
        "step": "week", "steps": "weeks",
        "series": "the weekly % change in each currency's value in US dollars",
        "built_by": "pipeline/datasets/sources.py, then the library's own functions",
        "measures": {"returns": "Weekly change"},
        "episodes": {"2008-10-31": "Lehman", "2011-09-30": "Euro-area crisis", "2015-08-31": "China devaluation",
                     "2020-03-31": "COVID crash", "2022-09-30": "Inflation shock"},
        "groups": {c: g for c, (_, _, g) in FX.items()},
        "group_order": ["Americas", "Europe", "Asia Pacific"],
        "labels": FX_NAMES,
        "window": 200,
    },
    "yields": {
        "title": "Euro-area government bonds",
        "headline": "How shocks travel between euro-area government bonds",
        "items": "countries", "item": "country",
        "source": "European Central Bank Data Portal", "api": "ECB Data Portal API (dataset IRS)",
        "api_url": "https://data.ecb.europa.eu/data/datasets/IRS",
        "step": "month", "steps": "months",
        "series": "the monthly change in each country's 10-year government bond yield, in basis points",
        "built_by": "pipeline/datasets/sources.py, then the library's own functions",
        "measures": {"returns": "Yield change"},
        "episodes": {"2008-10-31": "Lehman", "2010-05-31": "Greek bailout", "2012-07-31": "“Whatever it takes”",
                     "2020-03-31": "COVID crash", "2022-07-31": "ECB hikes"},
        "groups": {v[0]: v[1] for v in YIELDS.values()},
        "group_order": ["Core", "Periphery"],
        "labels": {v[0]: f"{k} 10-year" for k, v in YIELDS.items()},
        "window": 120,
    },
    "crypto": {
        "title": "Crypto",
        "headline": "How shocks travel between cryptocurrencies",
        "items": "coins", "item": "coin",
        "source": "Coinbase Exchange", "api": "Coinbase Exchange public market data API",
        "api_url": "https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductcandles",
        "step": "day", "steps": "days",
        "series": "the daily % change in each coin's US-dollar price",
        "built_by": "pipeline/datasets/sources.py, then the library's own functions",
        "measures": {"returns": "Daily change"},
        "episodes": {"2022-05-12": "Terra collapse", "2022-11-11": "FTX collapse", "2024-01-11": "Bitcoin ETFs"},
        "groups": {k: v[1] for k, v in COINS.items()},
        "group_order": ["Payments", "Platforms"],
        "labels": {k: v[0].split("-")[0] for k, v in COINS.items()},
        "window": 200,
    },
    "industries": {
        "title": "US industries",
        "headline": "How shocks travel between US industries",
        "items": "industries", "item": "industry",
        "source": "Kenneth French Data Library, Dartmouth", "api": "Data Library download (30 industry portfolios)",
        "api_url": "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html",
        "step": "week", "steps": "weeks",
        "series": "the weekly return of each of 30 value-weighted industry portfolios, in %",
        "built_by": "pipeline/datasets/sources.py, then the library's own functions",
        "measures": {"returns": "Returns"},
        "episodes": {"2001-09-30": "Dot-com", "2008-10-31": "Lehman", "2020-03-31": "COVID crash",
                     "2022-09-30": "Inflation shock"},
        "groups": {k: v[1] for k, v in INDUSTRIES.items()},
        "group_order": ["Consumer", "Industry & energy", "Services & finance"],
        "labels": {k: v[0] for k, v in INDUSTRIES.items()},
        "window": 200,
    },
    "rivers": {
        "title": "Rivers",
        "headline": "How floods travel through the Mississippi river system",
        "items": "river gauges", "item": "gauge",
        "source": "US Geological Survey", "api": "USGS Water Services daily values API",
        "api_url": "https://waterservices.usgs.gov/docs/dv-service/",
        "step": "week", "steps": "weeks",
        "series": "each gauge's weekly flow, as how much wetter or drier it is than usual for that week (log)",
        "built_by": "pipeline/datasets/sources.py, then the library's own functions",
        "measures": {"returns": "Flow anomaly"},
        "episodes": {"1993-07-31": "Great Flood of 1993", "2011-05-15": "2011 floods", "2019-06-01": "2019 floods"},
        "groups": {v[0]: v[1] for v in GAUGES.values()},
        "group_order": ["Upper Mississippi", "Missouri & Arkansas", "Ohio", "Middle & lower Mississippi"],
        "labels": {v[0]: f"USGS {k}" for k, v in GAUGES.items()},
        "window": 200,
    },
    "climate": {
        "title": "European temperatures",
        "headline": "How heat and cold travel across Europe",
        "items": "cities", "item": "city",
        "source": "Open-Meteo, ERA5 reanalysis (Copernicus)", "api": "Open-Meteo Historical Weather API",
        "api_url": "https://open-meteo.com/en/docs/historical-weather-api",
        "step": "week", "steps": "weeks",
        "series": "each city's weekly mean temperature, as °C above or below normal for that week",
        "built_by": "pipeline/datasets/sources.py, then the library's own functions",
        "measures": {"returns": "Temperature anomaly"},
        "episodes": {"2003-08-10": "2003 heatwave", "2010-01-15": "2010 cold winter", "2018-07-27": "2018 heatwave",
                     "2022-07-19": "2022 heatwave"},
        "groups": {k: v[2] for k, v in CITIES.items()},
        "group_order": ["West", "North", "Centre & east", "South"],
        "labels": {k: f"{v[0]:.1f}°, {v[1]:.1f}°" for k, v in CITIES.items()},
        "window": 200,
    },
}

FETCH = {
    "fx": (fetch_fx, prepare_fx), "yields": (fetch_yields, prepare_yields),
    "crypto": (fetch_crypto, prepare_crypto), "industries": (fetch_industries, prepare_industries),
    "rivers": (fetch_rivers, prepare_rivers), "climate": (fetch_climate, prepare_climate),
}
