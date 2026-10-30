#!/usr/bin/env python3
"""ICM Meteogram - Home Assistant add-on backend.

Pobiera prognoze godzinowa z nieoficjalnego API meteogramow ICM meteo.pl
(model UM 4 km) i wystawia:
  GET  /            -> interaktywny widget (panel ingress)
  GET  /api/data    -> JSON w formacie widgetu (hourly + daily) + coffee/name
  GET  /api/series  -> serie [[ts_ms, val], ...] pod ApexCharts
  GET  /api/health  -> status odswiezania
  GET  /api/geocode?q=... -> wyszukiwarka lokalizacji (geokoder meteo.pl)
  POST /api/setloc  -> ustaw lokalizacje {lat, lon, name}; zapisuje do opcji
  POST /api/refresh -> reczne odswiezenie = test lacznosci z API ICM
  POST /api/setmodel -> zmien model {model: um4_60|um4_120|gfs}; zapisuje do opcji

Przepis na API ICM (jak frontend www.meteo.pl/meteogramy, stan 2026-10):
  0) POST <api>/available_models/  body: {"lat": .., "lon": ..}
       -> {"available_models": ["um4", "gfs"]}  (brak "um4" = punkt poza UM)
  1) GET  <api>/meteorograms/available
       -> {"um4_60": [epoch, ...], "um4_120": [...], "gfs": [...]}
          (rosnaco: ostatni element = najnowszy bieg)
  2) POST <api>/meteorograms/<model>
       body: {"date": <ostatni epoch>, "point": {"lat": .., "lon": ..}}
<api> = opcja api_base (domyslnie https://devmgramapi.meteo.pl - z tego
samego hosta korzysta produkcyjna strona meteo.pl).
UWAGA: endpoint danych odpowiada tylko z polskich IP (spoza PL: 502).

Konfiguracja: /data/options.json (add-on) lub zmienne srodowiskowe (dev):
  ICM_LAT, ICM_LON, ICM_NAME, ICM_MODEL, ICM_MINUTES, ICM_PORT, ICM_COFFEE,
  ICM_API
Brak lat/lon -> wspolrzedne domu z API Home Assistant (SUPERVISOR_TOKEN).
Wspolrzedne sa ucinane do 4 miejsc po przecinku (tyle zwraca serwer ICM).
"""
import json
import os
import threading
from decimal import Decimal, ROUND_DOWN
import time
import traceback
import socket
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

DEFAULT_API = "https://devmgramapi.meteo.pl"
GEO_NOM = "https://nom-proxy.dev.meteo.pl/geo"           # geokoder www.meteo.pl
GEO_PHOTON = "https://photon.dev.meteo.pl/api"           # starszy geokoder ICM
GEO_OM = "https://geocoding-api.open-meteo.com/v1/search"  # ostatni fallback
MISSING = -1e6        # ICM oznacza brak wartosci jako -327276480.0
OPTIONS_FILE = os.environ.get("OPTIONS_FILE", "/data/options.json")
SUPERVISOR = "http://supervisor"
SUPERVISOR_TOKEN = (os.environ.get("SUPERVISOR_TOKEN")
                    or os.environ.get("HASSIO_TOKEN")
                    or os.environ.get("APP_TOKEN"))
CORE_API = os.environ.get("CORE_API", SUPERVISOR + "/core/api")
APP_DIR = os.path.dirname(os.path.abspath(__file__))

STATE = {"embed": None, "series": None, "error": None, "updated": None}
LOCK = threading.Lock()
REFRESH = threading.Event()      # wybudza petle po zmianie lokalizacji / recznym odswiezeniu
MANUAL = {"last": 0.0, "result": None}   # reczne odswiezenie (limit 1 / 60 s)
MANUAL_MIN_GAP = 60
CFG = {}                         # biezaca konfiguracja (mutowalna)
BG_TEMPLATES = ("krajobraz", "efekty", "niebo", "brak")   # tlo naglowka panelu (0.8.0)
OPTS = {}                        # pelne opcje (do zapisu przez Supervisor)


def log(*a):
    print("[icm-meteogram]", *a, flush=True)


def r2(v):
    """Obetnij wspolrzedna do 4 miejsc po przecinku (ku zeru, bez zaokraglania)
    - tak samo dokladnie jak punkt zwracany przez API ICM (~10 m).
    21.01229 -> 21.0122, 52.2296756 -> 52.2296. Decimal(str(...)) unika bledow float."""
    return float(Decimal(str(float(v))).quantize(Decimal("0.0001"), rounding=ROUND_DOWN))


# --------------------------------------------------------------------------- config

def load_options():
    opts = {}
    if os.path.exists(OPTIONS_FILE):
        with open(OPTIONS_FILE, encoding="utf-8") as f:
            opts = json.load(f) or {}
    env_map = {
        "ICM_LAT": ("latitude", float), "ICM_LON": ("longitude", float),
        "ICM_NAME": ("location_name", str), "ICM_MODEL": ("model", str),
        "ICM_MINUTES": ("update_minutes", int), "ICM_PORT": ("port", int),
        "ICM_COFFEE": ("coffee_url", str), "ICM_BG": ("background", str), "ICM_API": ("api_base", str),
    }
    for env, (key, cast) in env_map.items():
        if os.environ.get(env):
            opts[key] = cast(os.environ[env])
    opts.setdefault("model", "um4_60")
    opts.setdefault("update_minutes", 360)
    opts.setdefault("location_name", "")
    opts.setdefault("publish_sensor", True)
    opts.setdefault("coffee_url", "https://buycoffee.to/o2eric")
    opts.setdefault("publish_detail_sensors", True)
    if opts.get("background") not in BG_TEMPLATES:
        opts["background"] = "krajobraz"
    opts.setdefault("port", 8099)
    opts["api_base"] = ((opts.get("api_base") or "").strip().rstrip("/")
                        or DEFAULT_API)
    return opts


def core_get(path):
    req = urllib.request.Request(
        f"{CORE_API}/{path}",
        headers={"Authorization": f"Bearer {SUPERVISOR_TOKEN}"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def persist_options():
    """Zapisz biezace opcje do Supervisora (zmiana lat/lon przetrwa restart)."""
    if not SUPERVISOR_TOKEN:
        return False
    body = {"options": {k: OPTS[k] for k in OPTS if k != "port"}}
    req = urllib.request.Request(
        f"{SUPERVISOR}/addons/self/options",
        data=json.dumps(body).encode(), method="POST",
        headers={"Authorization": f"Bearer {SUPERVISOR_TOKEN}",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status in (200, 201)


def resolve_location(opts):
    lat, lon = opts.get("latitude"), opts.get("longitude")
    name = (opts.get("location_name") or "").strip()
    tzname = "Europe/Warsaw"
    if SUPERVISOR_TOKEN:
        try:
            cfg = core_get("config")
            tzname = cfg.get("time_zone") or tzname
            if lat is None or lon is None:
                lat, lon = cfg.get("latitude"), cfg.get("longitude")
                name = name or (cfg.get("location_name") or "")
                log(f"lokalizacja z Home Assistant: {lat}, {lon} ({name})")
        except Exception as e:
            log("nie udalo sie pobrac konfiguracji HA:", e)
    if lat is None or lon is None:
        raise SystemExit(
            "Brak lokalizacji: ustaw latitude/longitude w opcjach add-onu "
            "albo skonfiguruj wspolrzedne domu w Home Assistant.")
    return r2(lat), r2(lon), name, tzname


# --------------------------------------------------------------------------- geocoding

# osm_value -> polska etykieta typu miejsca
OSM_PL = {"city": "miasto", "town": "miasto", "village": "wieś",
          "hamlet": "przysiółek", "borough": "dzielnica", "suburb": "dzielnica",
          "neighbourhood": "osiedle", "quarter": "osiedle",
          "municipality": "gmina", "county": "powiat"}


def geocode(query):
    """Geokoder jak na www.meteo.pl (Nominatim proxy); potem Photon ICM,
    na koncu Open-Meteo."""
    q = (query or "").strip()
    if len(q) < 2:
        return []
    for fn in (geocode_nominatim, geocode_photon):
        try:
            res = fn(q)
            if res:
                return res
        except Exception as e:
            log(f"{fn.__name__} blad, probuje dalej:", e)
    return geocode_openmeteo(q)


NOM_HEADERS = {"Accept-Language": "pl-PL, pl", "User-Agent": "icm-meteogram-ha"}


def geocode_nominatim(q):
    params = {"q": q, "format": "json", "addressdetails": 1, "polygon_svg": 0,
              "various_place": "city", "limit": 8}
    url = GEO_NOM + "/search.php?" + urllib.parse.urlencode(params)
    data = get_json(url, NOM_HEADERS, timeout=15)
    out = []
    for it in data or []:
        a = it.get("address") or {}
        name = (a.get("city") or a.get("town") or a.get("village")
                or a.get("hamlet") or (it.get("display_name") or q).split(",")[0])
        typ = OSM_PL.get(it.get("type"), it.get("type") or "")
        parts = [typ] if typ else []
        for k in ("county", "state"):
            if a.get(k):
                parts.append(a[k])
        if a.get("country") and a.get("country_code") != "pl":
            parts.append(a["country"])
        out.append({"name": name, "detail": ", ".join(parts),
                    "lat": r2(it["lat"]), "lon": r2(it["lon"])})
    return out


def reverse_name(lat, lon):
    """Nazwa miejscowosci dla wspolrzednych (jak getCityByLocation na meteo.pl)."""
    url = GEO_NOM + "/reverse.php?" + urllib.parse.urlencode(
        {"lat": lat, "lon": lon, "lang": "pl", "format": "json"})
    a = (get_json(url, NOM_HEADERS, timeout=15) or {}).get("address") or {}
    for k in ("city", "village", "town", "hamlet", "county", "state"):
        if a.get(k):
            return a[k]
    return ""


def geocode_photon(q):
    params = {"q": q, "limit": 10, "osm_tag": "place"}
    if CFG.get("lat") is not None:              # bias na biezaca lokalizacje
        params["lat"], params["lon"] = CFG["lat"], CFG["lon"]
    url = GEO_PHOTON + "/?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=15) as r:
        data = json.loads(r.read().decode())
    out = []
    for f in data.get("features", []):
        p = f.get("properties", {})
        coords = f.get("geometry", {}).get("coordinates")
        if not coords or len(coords) < 2:
            continue
        typ = OSM_PL.get(p.get("osm_value"), p.get("osm_value") or "")
        parts = [typ] if typ else []
        if p.get("city") and p["city"] != p.get("name"):
            parts.append(p["city"])
        for k in ("county", "state"):
            if p.get(k):
                parts.append(p[k])
        if p.get("country") and p["country"] != "Polska":
            parts.append(p["country"])
        out.append({"name": p.get("name") or q,
                    "detail": ", ".join(parts),
                    "lat": r2(coords[1]), "lon": r2(coords[0])})
    return out


def geocode_openmeteo(q):
    url = GEO_OM + "?" + urllib.parse.urlencode(
        {"name": q, "count": 8, "language": "pl", "format": "json"})
    with urllib.request.urlopen(url, timeout=15) as r:
        data = json.loads(r.read().decode())
    return [{"name": it.get("name"),
             "detail": ", ".join(x for x in (it.get("admin2"), it.get("admin1"),
                                             it.get("country")) if x),
             "lat": r2(it["latitude"]), "lon": r2(it["longitude"])}
            for it in data.get("results", [])]


# --------------------------------------------------------------------------- ICM

def post(url, payload=None, timeout=40):
    body = json.dumps(payload).encode() if payload is not None else b""
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def get_json(url, headers=None, timeout=40):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


# Typ opadu ICM (pcpttl_type_max) - kody z frontendu www.meteo.pl:
# 1 = deszcz, 2 = snieg, 3 = deszcz ze sniegiem, 0 = brak opadu.
PRECIP_TYPES = {0: "brak", 1: "deszcz", 2: "śnieg", 3: "deszcz ze śniegiem"}


def wcode(cldt, prob, prec, storm, fog, temp, ptype=None, flash=None):
    # meteo.pl zaznacza burze przy storm > 0; wyladowania (flash) to wskaznik
    # natezenia (progi strony 10 / 30), nie ulamek
    if storm > 0.01 or (flash or 0) > 0:
        return 95
    if fog >= 0.5:
        return 45
    if prob >= 40 and prec > 0.05:
        if ptype == 2:
            return 71                      # snieg
        if ptype == 3:
            return 68                      # deszcz ze sniegiem
        if ptype == 1:
            return 61
        return 71 if temp < 0 else 61      # brak typu: jak meteo.pl, t<0 = snieg
    if cldt >= 0.8:
        return 3
    if cldt >= 0.4:
        return 2
    return 0


MODELS = {"um4_60": "UM 4 km · 60 h", "um4_120": "UM 4 km · 120 h",
          "gfs": "GFS · 240 h"}


def model_choices():
    """Lista modeli dla panelu: dostepnosc wg ostatniego /available_models/."""
    avail = STATE.get("models_avail")
    out = []
    for mid, label in MODELS.items():
        fam = "um4" if mid.startswith("um4") else mid
        out.append({"id": mid, "label": label,
                    "ok": True if avail is None else fam in avail})
    return out


def pick_model(api, lat, lon, model):
    """Sprawdz /available_models/ - poza obszarem UM zostaje tylko GFS."""
    try:
        models = post(f"{api}/available_models/",
                      {"lat": lat, "lon": lon}, timeout=20).get("available_models")
    except Exception as e:
        log("available_models niedostepne, zostaje", model, "-", e)
        return model
    if not models:
        return model
    STATE["models_avail"] = list(models)
    if model.startswith("um4") and "um4" not in models and "gfs" in models:
        log(f"punkt {lat},{lon} poza obszarem UM ({models}) -> gfs")
        return "gfs"
    return model


def fetch_available(api):
    """Lista biegow: GET jak frontend meteo.pl, fallback POST (stary sposob)."""
    try:
        return get_json(f"{api}/meteorograms/available")
    except Exception as e:
        log("GET /available blad, probuje POST:", e)
        return post(f"{api}/meteorograms/available")


def fetch_icm(lat, lon, model, tzname, name, api=DEFAULT_API):
    requested = model
    model = pick_model(api, lat, lon, model)
    avail = fetch_available(api)
    if model not in avail or not avail[model]:
        raise RuntimeError(f"model {model} niedostepny w /available: {list(avail)}")
    date = max(avail[model])                 # najnowszy bieg (lista rosnaca)
    resp = post(f"{api}/meteorograms/{model}",
                {"date": date, "point": {"lat": lat, "lon": lon}})
    data = resp["data"]
    meta = data["airtmp_point"]
    n = len(meta["data"])

    def g(field, scale=1.0, default=0.0):
        node = data.get(field)
        if not node or "data" not in node:
            return [default] * n
        return [default if (v is None or v != v or v < MISSING) else v * scale
                for v in node["data"]]

    def opt(field, scale=1.0, nd=1):
        """Pole opcjonalne: None gdy brak w odpowiedzi (np. GFS) lub brak danych."""
        node = data.get(field)
        if not node or "data" not in node:
            return [None] * n
        return [None if (v is None or v != v or v < MISSING)
                else (int(round(v * scale)) if nd == 0 else round(v * scale, nd))
                for v in node["data"]]

    first = int(meta["first_timestamp"])
    interval = int(meta["interval"])
    tz = ZoneInfo(tzname) if ZoneInfo else None
    ts = [first + i * interval for i in range(n)]
    times = [datetime.fromtimestamp(t, tz).strftime("%Y-%m-%dT%H:%M") for t in ts]

    temp = [round(v, 1) for v in g("airtmp_point")]
    app = [round(v, 1) for v in g("wchill_point")]
    prec = [round(v, 2) for v in g("pcpttl_aver")]
    prob = [int(round(v)) for v in g("pcpttlprob_point")]
    wspd = [round(v, 1) for v in g("wind10_sd_true_prev_point", 3.6)]
    wgst = [round(v, 1) for v in g("wind_gust_max", 3.6)]
    wdir = [int(round(v)) % 360 for v in g("wind10_dr_deg_true_prev_point")]
    humid = [max(0, min(100, int(round(v)))) for v in g("realhum_aver")]
    cldt = g("cldtot_aver", default=0.5)
    storm = g("storm_max")
    fog = g("fog_max")
    # nowe w 0.4.0 (jednostki API: Pa, Celsius, kg/m2 = mm, m, ulamek 0-1)
    press = opt("slpres_point", 0.01)          # cisnienie zredukowane, hPa
    dew = opt("dwptmp_point")                  # punkt rosy, C
    pmax = opt("pcpttl_max", 1.0, 2)           # opad maks. w oczku, mm/h
    vis = opt("visibl_min", 1.0, 0)            # widzialnosc min., m
    cloud = opt("cldtot_aver", 100, 0)         # zachmurzenie ogolne, %
    grdmin = opt("grdtmp_min")                 # temp. gruntu min (przymrozki)
    extra = {k: opt(f, sc, nd) for k, f, sc, nd in EXTRA_FIELDS}
    ptype = extra["precip_type"]
    flash = extra["lightning"]
    extra["precip_type_text"] = [PRECIP_TYPES.get(v, None) if v is not None else None
                                 for v in ptype]
    codes = [wcode(cldt[i], prob[i], prec[i], storm[i], fog[i], temp[i],
                   ptype[i], flash[i]) for i in range(n)]

    days = {}
    for i, t in enumerate(times):
        days.setdefault(t[:10], []).append(i)
    sev = {95: 5, 71: 4, 68: 4, 61: 4, 45: 3, 3: 2, 2: 1, 0: 0}
    dtime, dmax, dmin, dcode = [], [], [], []
    for day in sorted(days):
        idx = days[day]
        daylight = [i for i in idx if 9 <= int(times[i][11:13]) <= 18] or idx
        dtime.append(day)
        dmax.append(round(max(temp[i] for i in idx)))
        dmin.append(round(min(temp[i] for i in idx)))
        dcode.append(max((codes[i] for i in daylight), key=lambda c: sev[c]))

    point = meta.get("point", {})
    now_iso = datetime.now(tz).isoformat(timespec="seconds")
    embed = {
        "lat": r2(lat), "lon": r2(lon), "name": name,
        "model": MODELS.get(model, model.upper()),
        "model_id": model, "model_requested": requested,
        "node": f"{point.get('row', '?')}/{point.get('col', '?')}",
        "tz": tzname, "fstart": resp.get("fstart"), "updated": now_iso,
        "hourly": {
            "time": times, "temperature_2m": temp, "apparent_temperature": app,
            "precipitation": prec, "precipitation_probability": prob,
            "weather_code": codes, "wind_speed_10m": wspd,
            "wind_gusts_10m": wgst, "wind_direction_10m": wdir,
            "relative_humidity_2m": humid, "pressure_msl": press,
            "dew_point_2m": dew, "precipitation_max": pmax,
            "visibility": vis, "cloud_cover": cloud,
            "soil_temperature_min": grdmin, **extra},
        "daily": {
            "time": dtime, "weather_code": dcode,
            "temperature_2m_max": dmax, "temperature_2m_min": dmin},
    }
    tsm = [t * 1000 for t in ts]
    series = {
        "fstart": resp.get("fstart"), "updated": now_iso,
        "temp": [[tsm[i], temp[i]] for i in range(n)],
        "apparent": [[tsm[i], app[i]] for i in range(n)],
        "prob": [[tsm[i], prob[i]] for i in range(n)],
        "precip": [[tsm[i], prec[i]] for i in range(n)],
        "wind": [[tsm[i], wspd[i]] for i in range(n)],
        "gust": [[tsm[i], wgst[i]] for i in range(n)],
        "dir": [[tsm[i], wdir[i]] for i in range(n)],
        "humid": [[tsm[i], humid[i]] for i in range(n)],
        "pressure": [[tsm[i], press[i]] for i in range(n)],
        "dew": [[tsm[i], dew[i]] for i in range(n)],
        "precip_max": [[tsm[i], pmax[i]] for i in range(n)],
        "visibility": [[tsm[i], vis[i]] for i in range(n)],
        "cloud": [[tsm[i], cloud[i]] for i in range(n)],
        "ground_min": [[tsm[i], grdmin[i]] for i in range(n)],
        **{k: [[tsm[i], v[i]] for i in range(n)] for k, v in extra.items()},
    }
    return embed, series


def do_fetch():
    """Pobierz dla biezacej lokalizacji z CFG i zapisz do STATE."""
    embed, series = fetch_icm(CFG["lat"], CFG["lon"], CFG["model"],
                              CFG["tzname"], CFG["name"], CFG["api"])
    with LOCK:
        STATE.update(embed=embed, series=series, error=None,
                     updated=embed["updated"])
    log(f"odswiezono: {CFG['name'] or 'lokalizacja'} {CFG['lat']},{CFG['lon']} "
        f"bieg {embed['fstart']}, {len(embed['hourly']['time'])} h, "
        f"wezel {embed['node']}")
    if CFG.get("publish_sensor"):
        try:
            push_sensor(embed, series)
        except Exception as e:
            log("blad publikacji sensora:", e)
    return embed


def set_location(lat, lon, name):
    """Ustaw nowa lokalizacje: zaokraglij, pobierz od razu, zapisz opcje."""
    lat, lon, name = r2(lat), r2(lon), (name or "").strip()
    CFG["lat"], CFG["lon"], CFG["name"] = lat, lon, name
    OPTS["latitude"], OPTS["longitude"], OPTS["location_name"] = lat, lon, name
    embed = do_fetch()                      # natychmiastowy efekt
    persisted = False
    try:
        persisted = persist_options()       # przetrwa restart + widoczne w UI HA
    except Exception as e:
        log("nie zapisano opcji (dziala tymczasowo):", e)
    REFRESH.set()                           # zresetuj timer petli
    return embed, persisted


def set_model(model):
    """Zmien model z panelu: sprawdz dostepnosc, pobierz od razu, zapisz opcje."""
    if model not in MODELS:
        raise ValueError(f"nieznany model: {model}")
    avail = STATE.get("models_avail")
    fam = "um4" if model.startswith("um4") else model
    if avail is not None and fam not in avail:
        raise ValueError("Model UM nie obejmuje tej lokalizacji - dostępny jest tylko GFS.")
    old = CFG["model"]
    CFG["model"] = OPTS["model"] = model
    try:
        embed = do_fetch()
    except Exception:
        CFG["model"] = OPTS["model"] = old
        raise
    persisted = False
    try:
        persisted = persist_options()
    except Exception as e:
        log("nie zapisano opcji (dziala tymczasowo):", e)
    REFRESH.set()
    return embed, persisted


# --------------------------------------------------------------------------- HA sensor

# Pozostale pola odpowiedzi ICM (0.5.0): klucz, pole API, mnoznik, miejsca.
# Jednostki API: C, Pa, ulamek 0-1, km. Brak pola (np. GFS) lub brak danych
# (-327276480) -> None.
EXTRA_FIELDS = [
    ("temp_max", "airtmp_max", 1, 1),            # temp. powietrza max w godzinie, C
    ("temp_min", "airtmp_min", 1, 1),
    ("apparent_max", "wchill_max", 1, 1),        # temp. odczuwalna max/min, C
    ("apparent_min", "wchill_min", 1, 1),
    ("ground_max", "grdtmp_max", 1, 1),          # temp. gruntu max, C
    ("pressure_surface", "trpres_point", 0.01, 1),  # cisnienie na wys. stacji, hPa
    ("cloud_very_low", "cldvlow_aver", 100, 0),  # pietra chmur, %
    ("cloud_low", "cldlow_aver", 100, 0),
    ("cloud_mid", "cldmed_aver", 100, 0),
    ("cloud_high", "cldhigh_aver", 100, 0),
    ("cloud_base_1", "cldbse01", 1000, 0),       # podstawa chmur o pokryciu >=1%, m
    ("cloud_base_25", "cldbse25", 1000, 0),
    ("cloud_base_45", "cldbse45", 1000, 0),
    ("cloud_base_65", "cldbse65", 1000, 0),
    ("cloud_base_79", "cldbse79", 1000, 0),
    ("cloud_top", "cldtop", 1000, 0),            # wierzcholek chmur, m
    ("fog", "fog_max", 100, 0),                  # mgla, %
    ("storm", "storm_max", 100, 0),              # burza, %
    ("lightning", "flash_max", 1, 1),            # wyladowania - wskaznik ICM (0 / <10 / <30 / >=30)
    ("precip_type", "pcpttl_type_max", 1, 0),    # typ opadu: 1 deszcz, 2 snieg, 3 mieszany
]

# Sensory z wartoscia dla biezacej godziny: (sufiks encji, nazwa, klucz w
# hourly, jednostka, device_class)
DETAIL_SENSORS = [
    ("temperatura", "Temperatura", "temperature_2m", "°C", "temperature"),
    ("temp_max", "Temperatura max (godz.)", "temp_max", "°C", "temperature"),
    ("temp_min", "Temperatura min (godz.)", "temp_min", "°C", "temperature"),
    ("temp_odczuwalna", "Temperatura odczuwalna", "apparent_temperature", "°C", "temperature"),
    ("punkt_rosy", "Punkt rosy", "dew_point_2m", "°C", "temperature"),
    ("temp_gruntu_min", "Temperatura gruntu min", "soil_temperature_min", "°C", "temperature"),
    ("temp_gruntu_max", "Temperatura gruntu max", "ground_max", "°C", "temperature"),
    ("wilgotnosc", "Wilgotność względna", "relative_humidity_2m", "%", "humidity"),
    ("cisnienie", "Ciśnienie (poziom morza)", "pressure_msl", "hPa", "atmospheric_pressure"),
    ("cisnienie_stacji", "Ciśnienie (poziom stacji)", "pressure_surface", "hPa", "atmospheric_pressure"),
    ("opad", "Opad", "precipitation", "mm/h", "precipitation_intensity"),
    ("opad_max", "Opad maksymalny", "precipitation_max", "mm/h", "precipitation_intensity"),
    ("szansa_opadu", "Szansa opadu", "precipitation_probability", "%", None),
    ("typ_opadu", "Typ opadu", "precip_type_text", None, None),
    ("wiatr", "Wiatr", "wind_speed_10m", "km/h", "wind_speed"),
    ("porywy", "Porywy wiatru", "wind_gusts_10m", "km/h", "wind_speed"),
    ("kierunek_wiatru", "Kierunek wiatru", "wind_direction_10m", "°", None),
    ("zachmurzenie", "Zachmurzenie ogólne", "cloud_cover", "%", None),
    ("chmury_bardzo_niskie", "Chmury bardzo niskie", "cloud_very_low", "%", None),
    ("chmury_niskie", "Chmury niskie", "cloud_low", "%", None),
    ("chmury_srednie", "Chmury średnie", "cloud_mid", "%", None),
    ("chmury_wysokie", "Chmury wysokie", "cloud_high", "%", None),
    ("podstawa_chmur", "Podstawa chmur", "cloud_base_1", "m", "distance"),
    ("wierzcholek_chmur", "Wierzchołek chmur", "cloud_top", "m", "distance"),
    ("widzialnosc", "Widzialność", "visibility", "m", "distance"),
    ("mgla", "Mgła", "fog", "%", None),
    ("burza", "Burza", "storm", "%", None),
    ("wyladowania", "Wyładowania (wskaźnik ICM)", "lightning", None, None),
    ("kod_pogody", "Kod pogody (WMO)", "weather_code", None, None),
]


def now_index(series):
    """Indeks godziny prognozy najblizszej chwili obecnej. Bieg modelu startuje
    nawet kilkanascie godzin wczesniej (um4_120: tylko 00Z/12Z), wiec pierwszy
    element serii to zwykle przeszlosc."""
    ts = [p[0] for p in series["temp"]]
    if not ts:
        return 0
    now_ms = time.time() * 1000
    return min(range(len(ts)), key=lambda i: abs(ts[i] - now_ms))


def push_sensor(embed, series):
    if not SUPERVISOR_TOKEN:
        return
    h = embed["hourly"]
    i = now_index(series)
    body = {
        "state": h["temperature_2m"][i],
        "attributes": {
            "unit_of_measurement": "°C",
            "friendly_name": ("Meteogram ICM " + (embed.get("name") or "")).strip(),
            "icon": "mdi:chart-bell-curve-cumulative",
            "attribution": "Dane: ICM UW, meteo.pl (nieoficjalne API)",
            "model": embed["model"], "node": embed["node"],
            "latitude": embed["lat"], "longitude": embed["lon"],
            "fstart": embed.get("fstart"), "updated": embed.get("updated"),
            "forecast_hours": len(h["time"]),
            "temp": series["temp"], "apparent": series["apparent"],
            "prob": series["prob"], "precip": series["precip"],
            "wind": series["wind"], "gust": series["gust"], "dir": series["dir"],
            "humid": series["humid"],
            "pressure": series["pressure"], "dew": series["dew"],
            # biezace wartosci (bez serii - atrybuty musza zmiescic sie
            # w limicie 16 KB recordera HA)
            "now_time": h["time"][i],
            "pressure_now": h["pressure_msl"][i],
            "dew_point_now": h["dew_point_2m"][i],
            "visibility_now": h["visibility"][i],
            "cloud_cover_now": h["cloud_cover"][i],
            "model_id": embed.get("model_id"),
        },
    }
    req = urllib.request.Request(
        f"{CORE_API}/states/sensor.icm_meteogram",
        data=json.dumps(body).encode(), method="POST",
        headers={"Authorization": f"Bearer {SUPERVISOR_TOKEN}",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        log("sensor.icm_meteogram ->", r.status)
    if CFG.get("detail_sensors", True):
        push_detail_sensors(embed, i)


def push_detail_sensors(embed, i):
    """Osobny sensor na kazda wartosc ICM dla biezacej godziny (male stany -
    pelna historia w recorderze, jednostki i device_class HA)."""
    h = embed["hourly"]
    ok = 0
    for suffix, name, key, unit, dclass in DETAIL_SENSORS:
        vals = h.get(key)
        val = vals[i] if vals and i < len(vals) else None
        attrs = {"friendly_name": f"ICM {name}",
                 "attribution": "Dane: ICM UW, meteo.pl (nieoficjalne API)",
                 "now_time": h["time"][i], "model": embed.get("model_id")}
        if unit:
            attrs["unit_of_measurement"] = unit
            attrs["state_class"] = "measurement"
        if dclass:
            attrs["device_class"] = dclass
        body = {"state": "unknown" if val is None else val, "attributes": attrs}
        req = urllib.request.Request(
            f"{CORE_API}/states/sensor.icm_{suffix}",
            data=json.dumps(body).encode(), method="POST",
            headers={"Authorization": f"Bearer {SUPERVISOR_TOKEN}",
                     "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=20):
                ok += 1
        except Exception as e:
            log(f"sensor.icm_{suffix} blad:", e)
    log(f"sensory szczegolowe: {ok}/{len(DETAIL_SENSORS)}")


# --------------------------------------------------------------------------- loop + http

def republish():
    """Przelicz "teraz" sensorow z danych w pamieci (bez zapytania do ICM)."""
    with LOCK:
        embed, series = STATE["embed"], STATE["series"]
    if embed and CFG.get("publish_sensor"):
        try:
            push_sensor(embed, series)
        except Exception as e:
            log("blad publikacji sensora:", e)


def refresher():
    """Pobiera prognoze co update_minutes, a co pelna godzine przelicza stan
    sensorow, zeby "teraz" nie rozjezdzalo sie przy dlugim cyklu (np. 6 h).
    Reczne odswiezenie / zmiana lokalizacji wybudza petle i resetuje cykl."""
    next_fetch = 0.0
    while True:
        now = time.time()
        if now >= next_fetch:
            try:
                do_fetch()
            except Exception as e:
                with LOCK:
                    STATE["error"] = str(e)
                log("blad odswiezania:", e)
                traceback.print_exc()
            next_fetch = time.time() + max(10, int(CFG["minutes"])) * 60
        else:
            republish()
        next_hour = (int(time.time() // 3600) + 1) * 3600 + 30
        timeout = max(5.0, min(next_fetch, next_hour) - time.time())
        if REFRESH.wait(timeout=timeout):        # pobrano recznie przed chwila
            REFRESH.clear()
            next_fetch = time.time() + max(10, int(CFG["minutes"])) * 60


def describe_error(e):
    """Czytelny komunikat dla panelu: lacznosc vs. odpowiedz API vs. dane."""
    if isinstance(e, urllib.error.HTTPError):
        if e.code in (403, 502, 503, 504):
            return ("api", f"API ICM odrzuciło zapytanie (HTTP {e.code}). API odpowiada "
                           "tylko z polskich adresów IP albo serwer ma przerwę.")
        return ("api", f"API ICM zwróciło błąd HTTP {e.code}.")
    if isinstance(e, (urllib.error.URLError, socket.timeout, TimeoutError,
                      ConnectionError, OSError)):
        reason = getattr(e, "reason", e)
        return ("network", f"Brak łączności z API ICM ({urllib.parse.urlparse(CFG.get('api') or DEFAULT_API).hostname}): {reason}. "
                           "Sprawdź połączenie internetowe Home Assistant i DNS.")
    return ("data", f"API ICM odpowiedziało, ale danych nie udało się odczytać: {e}")


def manual_refresh():
    """Reczne odswiezenie = test lacznosci z API ICM (pelna sciezka:
    available_models -> available -> dane punktu)."""
    now = time.time()
    if now - MANUAL["last"] < MANUAL_MIN_GAP and MANUAL["result"]:
        res = dict(MANUAL["result"])
        res["cached"] = True
        res["retry_in"] = int(MANUAL_MIN_GAP - (now - MANUAL["last"]))
        return res
    t0 = time.time()
    try:
        embed = do_fetch()
        res = {"ok": True, "fstart": embed.get("fstart"), "model": embed.get("model_id"),
               "node": embed.get("node"), "hours": len(embed["hourly"]["time"]),
               "took_ms": int((time.time() - t0) * 1000)}
        REFRESH.set()                       # nowy cykl liczony od teraz
    except Exception as e:
        kind, msg = describe_error(e)
        with LOCK:
            STATE["error"] = msg
        log("reczne odswiezenie - blad:", kind, e)
        res = {"ok": False, "kind": kind, "error": msg,
               "took_ms": int((time.time() - t0) * 1000)}
    MANUAL["last"], MANUAL["result"] = now, res
    return res


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        payload = body if isinstance(body, bytes) else json.dumps(
            body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path in ("/", "/index.html"):
            with open(os.path.join(APP_DIR, "widget.html"), "rb") as f:
                return self._send(200, f.read(), "text/html; charset=utf-8")
        if path == "/api/geocode":
            q = urllib.parse.parse_qs(parsed.query).get("q", [""])[0]
            try:
                return self._send(200, {"results": geocode(q)})
            except Exception as e:
                return self._send(502, {"error": str(e)})
        with LOCK:
            embed, series, err = STATE["embed"], STATE["series"], STATE["error"]
        if path == "/api/data":
            if embed:
                return self._send(200, {**embed, "coffee": CFG.get("coffee_url", ""),
                                        "models": model_choices(),
                                        "bg": OPTS.get("background", "krajobraz")})
            return self._send(503, {"error": err or "jeszcze brak danych"})
        if path == "/api/series":
            if series:
                return self._send(200, series)
            return self._send(503, {"error": err or "jeszcze brak danych"})
        if path == "/api/health":
            return self._send(200, {"ok": embed is not None, "error": err,
                                    "updated": STATE["updated"]})
        return self._send(404, {"error": "not found"})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path == "/api/setmodel":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
                embed, persisted = set_model(str(body.get("model", "")))
                return self._send(200, {"ok": True, "model": embed.get("model_id"),
                                        "label": embed.get("model"),
                                        "persisted": persisted})
            except ValueError as e:
                return self._send(400, {"ok": False, "error": str(e)})
            except Exception as e:
                kind, msg = describe_error(e)
                return self._send(502, {"ok": False, "kind": kind, "error": msg})
        if path == "/api/refresh":
            res = manual_refresh()
            return self._send(200 if res.get("ok") else 502, res)
        if path != "/api/setloc":
            return self._send(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
            lat, lon = float(body["lat"]), float(body["lon"])
        except Exception as e:
            return self._send(400, {"error": f"zle dane: {e}"})
        try:
            embed, persisted = set_location(lat, lon, body.get("name", ""))
            return self._send(200, {"ok": True, "persisted": persisted,
                                    "lat": embed["lat"], "lon": embed["lon"],
                                    "name": embed["name"], "node": embed["node"]})
        except Exception as e:
            log("setloc blad:", e)
            traceback.print_exc()
            return self._send(502, {"error": str(e)})

    def log_message(self, fmt, *args):
        pass


def main():
    log("token API:", "jest" if SUPERVISOR_TOKEN else "BRAK")
    OPTS.update(load_options())
    lat, lon, name, tzname = resolve_location(OPTS)
    CFG.update(lat=lat, lon=lon, name=name, tzname=tzname,
               model=OPTS["model"], minutes=OPTS["update_minutes"],
               publish_sensor=OPTS.get("publish_sensor", True),
               detail_sensors=OPTS.get("publish_detail_sensors", True),
               coffee_url=OPTS.get("coffee_url", ""), api=OPTS["api_base"])
    if not CFG["name"]:
        try:
            CFG["name"] = reverse_name(lat, lon)
            log("nazwa z geokodera:", CFG["name"])
        except Exception as e:
            log("reverse geocode blad:", e)
    log(f"start: {CFG['name'] or 'lokalizacja'} {lat},{lon} model={CFG['model']} "
        f"co {CFG['minutes']} min, port {OPTS['port']}, api {CFG['api']}")
    threading.Thread(target=refresher, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", int(OPTS["port"])), Handler).serve_forever()


if __name__ == "__main__":
    main()
