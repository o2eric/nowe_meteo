#!/usr/bin/env python3
"""ICM Meteogram - Home Assistant add-on backend.

Pobiera prognoze godzinowa z nieoficjalnego API meteogramow ICM meteo.pl
(model UM 4 km) i wystawia:
  GET  /            -> interaktywny widget (panel ingress)
  GET  /api/data    -> JSON w formacie widgetu (hourly + daily) + coffee/name
  GET  /api/series  -> serie [[ts_ms, val], ...] pod ApexCharts
  GET  /api/health  -> status odswiezania
  GET  /api/geocode?q=... -> wyszukiwarka lokalizacji (Open-Meteo geocoding)
  POST /api/setloc  -> ustaw lokalizacje {lat, lon, name}; zapisuje do opcji

Przepis na API ICM (za repo dzemchmielewski/homectrl):
  1) POST https://devmgramapi.meteo.pl/meteorograms/available
       -> {"um4_60": [epoch, ...], "um4_120": [...], "gfs": [...]}
  2) POST https://devmgramapi.meteo.pl/meteorograms/<model>
       body: {"date": <ostatni epoch>, "point": {"lat": .., "lon": ..}}
UWAGA: endpoint danych odpowiada tylko z polskich IP (spoza PL: 502).

Konfiguracja: /data/options.json (add-on) lub zmienne srodowiskowe (dev):
  ICM_LAT, ICM_LON, ICM_NAME, ICM_MODEL, ICM_MINUTES, ICM_PORT, ICM_COFFEE
Brak lat/lon -> wspolrzedne domu z API Home Assistant (SUPERVISOR_TOKEN).
Wspolrzedne sa zaokraglane do 2 miejsc po przecinku.
"""
import json
import os
import threading
from decimal import Decimal, ROUND_DOWN
import time
import traceback
import urllib.parse
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

BASE = "https://devmgramapi.meteo.pl/meteorograms"
GEO = "https://geocoding-api.open-meteo.com/v1/search"
OPTIONS_FILE = os.environ.get("OPTIONS_FILE", "/data/options.json")
SUPERVISOR = "http://supervisor"
SUPERVISOR_TOKEN = (os.environ.get("SUPERVISOR_TOKEN")
                    or os.environ.get("HASSIO_TOKEN")
                    or os.environ.get("APP_TOKEN"))
CORE_API = os.environ.get("CORE_API", SUPERVISOR + "/core/api")
APP_DIR = os.path.dirname(os.path.abspath(__file__))

STATE = {"embed": None, "series": None, "error": None, "updated": None}
LOCK = threading.Lock()
REFRESH = threading.Event()      # wybudza petle po zmianie lokalizacji
CFG = {}                         # biezaca konfiguracja (mutowalna)
OPTS = {}                        # pelne opcje (do zapisu przez Supervisor)


def log(*a):
    print("[icm-meteogram]", *a, flush=True)


def r2(v):
    """Obetnij wspolrzedna do 2 miejsc po przecinku (ku zeru, bez zaokraglania).
    21.0122 -> 21.01, 52.2296756 -> 52.22. Decimal(str(...)) unika bledow float."""
    return float(Decimal(str(float(v))).quantize(Decimal("0.01"), rounding=ROUND_DOWN))


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
        "ICM_COFFEE": ("coffee_url", str),
    }
    for env, (key, cast) in env_map.items():
        if os.environ.get(env):
            opts[key] = cast(os.environ[env])
    opts.setdefault("model", "um4_60")
    opts.setdefault("update_minutes", 30)
    opts.setdefault("location_name", "")
    opts.setdefault("publish_sensor", True)
    opts.setdefault("coffee_url", "")
    opts.setdefault("port", 8099)
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

def geocode(query):
    q = (query or "").strip()
    if len(q) < 2:
        return []
    url = GEO + "?" + urllib.parse.urlencode(
        {"name": q, "count": 8, "language": "pl", "format": "json"})
    with urllib.request.urlopen(url, timeout=15) as r:
        data = json.loads(r.read().decode())
    out = []
    for it in data.get("results", []):
        detail = ", ".join(x for x in (it.get("admin2"), it.get("admin1"),
                                       it.get("country")) if x)
        out.append({"name": it.get("name"), "detail": detail,
                    "lat": r2(it["latitude"]), "lon": r2(it["longitude"])})
    return out


# --------------------------------------------------------------------------- ICM

def post(url, payload=None, timeout=40):
    body = json.dumps(payload).encode() if payload is not None else b""
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def wcode(cldt, prob, prec, storm, fog):
    if storm >= 0.5:
        return 95
    if fog >= 0.5:
        return 45
    if prob >= 40 and prec > 0.05:
        return 61
    if cldt >= 0.8:
        return 3
    if cldt >= 0.4:
        return 2
    return 0


def fetch_icm(lat, lon, model, tzname, name):
    avail = post(f"{BASE}/available")
    if model not in avail or not avail[model]:
        raise RuntimeError(f"model {model} niedostepny w /available: {list(avail)}")
    date = avail[model][-1]
    resp = post(f"{BASE}/{model}", {"date": date, "point": {"lat": lat, "lon": lon}})
    data = resp["data"]
    meta = data["airtmp_point"]
    n = len(meta["data"])

    def g(field, scale=1.0, default=0.0):
        node = data.get(field)
        if not node or "data" not in node:
            return [default] * n
        return [v * scale for v in node["data"]]

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
    cldt = g("cldtot_aver", default=0.5)
    storm = g("storm_max")
    fog = g("fog_max")
    codes = [wcode(cldt[i], prob[i], prec[i], storm[i], fog[i]) for i in range(n)]

    days = {}
    for i, t in enumerate(times):
        days.setdefault(t[:10], []).append(i)
    sev = {95: 5, 61: 4, 45: 3, 3: 2, 2: 1, 0: 0}
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
        "model": "UM 4 km · ICM" if model.startswith("um4") else model.upper(),
        "node": f"{point.get('row', '?')}/{point.get('col', '?')}",
        "tz": tzname, "fstart": resp.get("fstart"), "updated": now_iso,
        "hourly": {
            "time": times, "temperature_2m": temp, "apparent_temperature": app,
            "precipitation": prec, "precipitation_probability": prob,
            "weather_code": codes, "wind_speed_10m": wspd,
            "wind_gusts_10m": wgst, "wind_direction_10m": wdir},
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
    }
    return embed, series


def do_fetch():
    """Pobierz dla biezacej lokalizacji z CFG i zapisz do STATE."""
    embed, series = fetch_icm(CFG["lat"], CFG["lon"], CFG["model"],
                              CFG["tzname"], CFG["name"])
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


# --------------------------------------------------------------------------- HA sensor

def push_sensor(embed, series):
    if not SUPERVISOR_TOKEN:
        return
    h = embed["hourly"]
    body = {
        "state": h["temperature_2m"][0],
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
        },
    }
    req = urllib.request.Request(
        f"{CORE_API}/states/sensor.icm_meteogram",
        data=json.dumps(body).encode(), method="POST",
        headers={"Authorization": f"Bearer {SUPERVISOR_TOKEN}",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        log("sensor.icm_meteogram ->", r.status)


# --------------------------------------------------------------------------- loop + http

def refresher():
    while True:
        try:
            do_fetch()
        except Exception as e:
            with LOCK:
                STATE["error"] = str(e)
            log("blad odswiezania:", e)
            traceback.print_exc()
        # spij do nastepnego cyklu, ale wybudz sie po zmianie lokalizacji
        REFRESH.wait(timeout=max(10, int(CFG["minutes"])) * 60)
        REFRESH.clear()


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
                return self._send(200, {**embed, "coffee": CFG.get("coffee_url", "")})
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
               coffee_url=OPTS.get("coffee_url", ""))
    log(f"start: {name or 'lokalizacja'} {lat},{lon} model={CFG['model']} "
        f"co {CFG['minutes']} min, port {OPTS['port']}")
    threading.Thread(target=refresher, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", int(OPTS["port"])), Handler).serve_forever()


if __name__ == "__main__":
    main()
