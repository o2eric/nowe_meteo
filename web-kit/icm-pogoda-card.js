/* icm-pogoda-card — karta Lovelace w stylu „Pogoda” (iOS + Google) dla dodatku ICM Meteogram.
   Zrodla danych: atrybuty sensor.icm_meteogram (domyslnie) albo pelne /api/data dodatku (data_url).
   Dane: © ICM UW, meteo.pl — projekt nieoficjalny. */
(() => {
const VERSION = '1.0.0';
const DOW = ['niedziela','poniedziałek','wtorek','środa','czwartek','piątek','sobota'], DS = ['niedz.','pon.','wt.','śr.','czw.','pt.','sob.'], MON = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
const num = v => (v == null || v === '' || v !== v || isNaN(+v)) ? null : +v;
const pl = (v, d) => v == null ? '—' : (+v).toFixed(d == null ? 1 : d).replace('.', ',');
const hh = h => String(h).padStart(2, '0') + ':00';
const fmtT = h => { const m = Math.round(h * 60); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

// ---- slonce (NOAA), wynik w godzinach lokalnych przegladarki ----
function sun(dt, lat, lon) {
  const s = new Date(dt.getFullYear(), 0, 0), doy = Math.floor((dt - s) / 864e5), g = 2 * Math.PI / 365 * (doy - 1), r = Math.PI / 180;
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const de = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  let c = Math.cos(90.833 * r) / (Math.cos(lat * r) * Math.cos(de)) - Math.tan(lat * r) * Math.tan(de); c = Math.max(-1, Math.min(1, c));
  const ha = Math.acos(c) / r, off = -dt.getTimezoneOffset() / 60;
  return [(720 - 4 * (lon + ha) - eq) / 60 + off, (720 - 4 * (lon - ha) - eq) / 60 + off];
}
// ---- stan pogody z wartosci godziny (progi ICM) ----
function code(H, i) {
  const p = num(H.precipitation[i]) || 0, t = num(H.precip_type[i]) || 0, c = num(H.cloud_cover[i]);
  if ((num(H.storm[i]) || 0) > 1 || (num(H.lightning[i]) || 0) > 0) return 'storm';
  if ((num(H.fog[i]) || 0) >= 50) return 'fog';
  if (p >= 0.1) return t === 2 ? 'snow' : t === 3 ? 'mix' : p < 0.5 ? 'drizzle' : 'rain';
  if (c == null) return null;                       // brak danych o chmurach -> bez ikony
  return c < 20 ? 'clear' : c < 60 ? 'part' : c < 85 ? 'most' : 'cloud';
}
const LABEL = { clear: 'Bezchmurnie', part: 'Częściowe zachmurzenie', most: 'Przewaga chmur', cloud: 'Pochmurno', fog: 'Mgła', drizzle: 'Mżawka', rain: 'Deszcz', snow: 'Śnieg', mix: 'Deszcz ze śniegiem', storm: 'Burza' };
const SEV = { clear: 0, part: 1, most: 2, cloud: 3, fog: 4, drizzle: 5, rain: 6, mix: 7, snow: 7, storm: 9 };
let gid = 0;
// ---- ikony w stylu Google (miekkie gradienty), viewBox 64x68 ----
function icon(c, night) {
  if (!c) return '';
  const id = 'ip' + (gid++);
  const defs = `<defs><radialGradient id="${id}s" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffd86b"/><stop offset=".6" stop-color="#ffa41c"/><stop offset="1" stop-color="#ef7d00"/></radialGradient><linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#cfd6df"/></linearGradient><linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d0da"/><stop offset="1" stop-color="#8d97a5"/></linearGradient><radialGradient id="${id}m" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fdfbe8"/><stop offset="1" stop-color="#c9cfdb"/></radialGradient></defs>`;
  const sunP = night ? `<path d="M30 8a17 17 0 1 0 14 26 14 14 0 0 1-14-26z" fill="url(#${id}m)"/>` : `<circle cx="26" cy="24" r="15" fill="url(#${id}s)"/>`;
  const cloud = (f, dx, dy, s) => `<g transform="translate(${dx || 0},${dy || 0}) scale(${s || 1})"><path d="M18 52h28a11 11 0 0 0 1-22 15 15 0 0 0-28.5 4.5A9 9 0 0 0 18 52Z" fill="url(#${id}${f})"/></g>`;
  const drops = (col, n) => [24, 34, 44].slice(0, n || 3).map(x => `<path d="M${x} 56 l-3 7" stroke="${col}" stroke-width="3.2" stroke-linecap="round"/>`).join('');
  let b = '';
  if (c === 'clear') b = night ? `<path d="M36 8a22 22 0 1 0 18 34 18 18 0 0 1-18-34z" fill="url(#${id}m)"/>` : `<circle cx="32" cy="32" r="20" fill="url(#${id}s)"/>`;
  else if (c === 'part') b = sunP + cloud('c', 4, 6, .95);
  else if (c === 'most') b = sunP + cloud('c', 2, 2, 1.05);
  else if (c === 'cloud') b = cloud('d', -2, -2, 1.1);
  else if (c === 'fog') b = cloud('c', 0, -6, 1) + [50, 57].map(y => `<path d="M12 ${y}h40" stroke="#e8edf3" stroke-width="3.4" stroke-linecap="round"/>`).join('');
  else if (c === 'drizzle') b = cloud('c', 0, -8, 1) + drops('#5aa0ff', 2);
  else if (c === 'rain') b = cloud('d', 0, -8, 1) + drops('#4b93ff');
  else if (c === 'snow') b = cloud('c', 0, -8, 1) + [26, 38].map(x => `<circle cx="${x}" cy="59" r="2.6" fill="#fff"/>`).join('') + `<circle cx="32" cy="62" r="2.2" fill="#fff"/>`;
  else if (c === 'mix') b = cloud('d', 0, -8, 1) + `<path d="M26 56 l-3 7" stroke="#4b93ff" stroke-width="3.2" stroke-linecap="round"/><circle cx="40" cy="59" r="2.6" fill="#fff"/>`;
  else if (c === 'storm') b = cloud('d', 0, -8, 1) + `<path d="M34 46l-8 11h6l-3 9 11-13h-6l4-7z" fill="#ffc21a"/>`;
  return `<svg viewBox="0 0 64 68" aria-hidden="true">${defs}${b}</svg>`;
}
// ---- niebo z pory dnia i pogody ----
function sky(t, c, cloud, lat, lon) {
  const [sr, ss] = sun(t, lat, lon), h = t.getHours() + .5;
  const tod = (h >= sr - .75 && h < sr + .75) ? 'dawn' : (h >= ss - .75 && h < ss + .75) ? 'dusk' : (h > sr && h < ss) ? 'day' : 'night';
  const over = (cloud || 0) >= 70 || (SEV[c] || 0) >= 4;
  const S = { day: c === 'storm' ? ['#2a3442', '#45505f', '#66717f'] : over ? ['#55708f', '#7a8ea6', '#9fb0c2'] : ['#2f6bb8', '#5a8fd0', '#a9c1de'],
    dawn: over ? ['#4b5670', '#8f8798', '#c9a99a'] : ['#2c4a8a', '#b98aa6', '#f4b183'], dusk: over ? ['#3e475d', '#7d6f86', '#b88f84'] : ['#1f3b73', '#8a5a9e', '#f08a5d'],
    night: over ? ['#141b27', '#253043', '#36435a'] : ['#081530', '#16305e', '#284c84'] }[tod];
  return { tod, sr, ss, bg: `linear-gradient(180deg,${S[0]} 0%,${S[1]} 45%,${S[2]} 100%)` };
}
// ---- krajobraz pory roku (pas 1000x86) ----
function land(night, frost, month) {
  const se = month >= 2 && month <= 4 ? 'spring' : month >= 5 && month <= 7 ? 'summer' : month >= 8 && month <= 10 ? 'autumn' : 'winter';
  const far = x => 48 + Math.sin(x / 120) * 8 + Math.sin(x / 47 + 1.1) * 3, near = x => 66 + Math.sin(x / 160 + .6) * 5;
  const hill = fn => { let d = 'M0 ' + fn(0).toFixed(1); for (let x = 10; x <= 1000; x += 10) d += 'L' + x + ' ' + fn(x).toFixed(1); return d + 'L1000 86L0 86Z'; };
  const snow = frost && se === 'winter';
  const col = snow ? ['#dbe4ee', '#f2f5f9', '#5b4636'] : se === 'winter' ? ['#8f957f', '#77806a', '#4a3b2e'] : se === 'spring' ? ['#93bd83', '#6aa65a', '#5b4636'] : se === 'summer' ? ['#5e9149', '#3e7b33', '#4a3b2e'] : ['#b08a52', '#857041', '#5b4636'];
  const crowns = se === 'winter' ? null : se === 'spring' ? ['#7bb86a', '#f4b6cf', '#8cc47a'] : se === 'summer' ? ['#2f6b2e', '#336f30', '#2b6229'] : ['#d97706', '#b45309', '#ca8a04', '#c2410c', '#ea580c'];
  let s = `<g style="filter:${night ? 'brightness(.42) saturate(.7)' : 'none'}"><path d="${hill(far)}" fill="${col[0]}"/>`;
  [40, 95, 170, 260, 330, 420, 505, 590, 660, 740, 820, 905, 960].forEach((x, k) => {
    const b = far(x) + 2, sc = .8 + (k % 3) * .15;
    s += `<path d="M${x} ${b + 8}V${b - 10 * sc}" stroke="${col[2]}" stroke-width="${2.4 * sc}" stroke-linecap="round"/>`;
    s += crowns ? `<ellipse cx="${x}" cy="${b - 15 * sc}" rx="${8 * sc}" ry="${10 * sc}" fill="${crowns[k % crowns.length]}"/>` : `<path d="M${x} ${b - 4}l-7 -9M${x} ${b - 8}l6 -10" stroke="${col[2]}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  });
  return s + `<path d="${hill(near)}" fill="${col[1]}"/></g>`;
}
function smooth(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${(+p2[1]).toFixed(1)}`;
  }
  return d;
}
const KEYS = ['time', 'temperature_2m', 'apparent_temperature', 'dew_point_2m', 'soil_temperature_min', 'precipitation', 'precip_type', 'precipitation_probability', 'storm', 'lightning', 'pressure_msl', 'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'cloud_cover', 'fog', 'visibility', 'relative_humidity_2m'];
// atrybuty sensor.icm_meteogram -> uklad hourly z /api/data (serie [[ms, v], ...])
function fromSensor(st, hass, pre) {
  const a = st.attributes || {}, ser = k => Array.isArray(a[k]) ? a[k] : [];
  const base = ser('temp'); const n = base.length;
  const H = { time: base.map(p => { const d = new Date(p[0]); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`; }) };
  const col = k => ser(k).map(p => p[1]);
  Object.assign(H, { temperature_2m: col('temp'), apparent_temperature: col('apparent'), precipitation_probability: col('prob'), precipitation: col('precip'), wind_speed_10m: col('wind'), wind_gusts_10m: col('gust'), wind_direction_10m: col('dir'), relative_humidity_2m: col('humid'), pressure_msl: col('pressure'), dew_point_2m: col('dew') });
  KEYS.forEach(k => { if (!Array.isArray(H[k]) || H[k].length !== n) H[k] = new Array(n).fill(null); });
  // biezaca godzina: uzupelnij z sensorow szczegolowych sensor.<prefix>_*
  const i = H.time.indexOf(a.now_time); const s = k => { const e = hass.states[`sensor.${pre}_${k}`]; return e ? num(e.state) : null; };
  if (i >= 0) {
    H.cloud_cover[i] = num(a.cloud_cover_now) ?? s('zachmurzenie'); H.visibility[i] = num(a.visibility_now) ?? s('widzialnosc');
    H.fog[i] = s('mgla'); H.storm[i] = s('burza'); H.lightning[i] = s('wyladowania'); H.soil_temperature_min[i] = s('temp_gruntu_min');
    const tp = hass.states[`sensor.${pre}_typ_opadu`]; H.precip_type[i] = tp ? ({ deszcz: 1, 'śnieg': 2, 'deszcz ze śniegiem': 3 }[tp.state] || 0) : null;
  }
  return { name: a.friendly_name ? a.friendly_name.replace(/^Meteogram ICM\s*/, '') : '', lat: num(a.latitude), lon: num(a.longitude), model: a.model || '', hourly: H, partial: true };
}

const CSS = `
:host{--ink:#fff;--ink2:rgba(255,255,255,.82);--muted:rgba(255,255,255,.62);--glass:rgba(12,28,58,.24);--glass-line:rgba(255,255,255,.2);--glass-hi:rgba(255,255,255,.16);
 --temp:#ffd166;--temp-fill:rgba(255,209,102,.28);--rain:#a9cbff;--rain-fill:rgba(169,203,255,.32);--wind:#86ecd9;--frost:#9fd0ff;--fog:#ffd9a0;display:block}
ha-card{display:block;overflow:hidden;color:var(--ink);border-radius:var(--ha-card-border-radius,22px);transition:background .6s;font-variant-numeric:tabular-nums}
.wrap{display:flex;flex-direction:column;gap:12px;padding:14px}
.glass{background:var(--glass);border:1px solid var(--glass-line);border-radius:18px;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.hero{position:relative;overflow:hidden;padding:16px 18px 82px;min-height:200px}
.hero svg.land{position:absolute;left:0;right:0;bottom:0;width:100%;height:74px;display:block}
.top{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.loc{font-size:17px;font-weight:600;margin-right:4px}.pill{font-size:12px;font-weight:600;border:1px solid var(--glass-line);background:var(--glass-hi);border-radius:999px;padding:4px 11px}
.main{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 20px;margin-top:10px}
.now{display:flex;align-items:center;gap:12px}.now .ico svg{width:80px;height:80px;display:block;filter:drop-shadow(0 6px 14px rgba(0,0,0,.18))}
.big{font-size:72px;font-weight:300;line-height:.9;letter-spacing:-.03em}.big sup{font-size:22px;vertical-align:top;position:relative;top:8px}
.stats{display:flex;flex-direction:column;gap:1px;color:var(--ink2);font-size:14px}.stats b{color:var(--ink);font-weight:600}
.side{text-align:right}.side .c{font-size:17px}.side .r{font-size:13px;color:var(--muted)}
.days{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(78px,1fr);gap:6px;overflow-x:auto;padding:6px;scrollbar-width:none}
.day{appearance:none;font:inherit;color:inherit;border:1px solid transparent;background:none;border-radius:14px;padding:6px 4px 8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:1px}
.day[aria-pressed="true"]{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.35)}.day:focus-visible{outline:2px solid #fff;outline-offset:2px}
.day .dn{font-size:14px;font-weight:600}.day .dd{font-size:11px;color:var(--muted)}.day svg{width:38px;height:38px}.day .hl i{font-style:normal;color:var(--muted);margin-left:5px}.day .pp{font-size:11px;color:var(--rain);font-weight:600;min-height:14px}
.card{padding:12px 14px 8px}.card h3{margin:0;font-size:11.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);display:flex;justify-content:space-between}
.card h3 span:last-child{letter-spacing:0;text-transform:none;color:var(--ink2);font-weight:500;font-size:12.5px}
svg.ch{display:block;width:100%;cursor:pointer;touch-action:pan-y}
.tiles{display:grid;grid-template-columns:repeat(var(--cols,2),minmax(0,1fr));gap:12px}
.tile{padding:12px 13px;display:flex;flex-direction:column;gap:3px;min-height:118px}.tile h3{margin:0;font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.tile .v{font-size:28px;line-height:1.05}.tile .v small{font-size:14px;color:var(--ink2);margin-left:3px}.tile .d{font-size:12.5px;color:var(--ink2);margin-top:auto}
.foot{font-size:11.5px;color:var(--ink2);padding:0 4px}
.err{padding:18px;font-size:14px}
text{font-family:inherit}
@media (prefers-reduced-motion:reduce){ha-card{transition:none}}`;

class IcmPogodaCard extends HTMLElement {
  static getStubConfig() { return { entity: 'sensor.icm_meteogram' }; }
  setConfig(config) {
    this._cfg = Object.assign({ entity: 'sensor.icm_meteogram', prefix: 'icm', show_days: true, show_charts: ['temp', 'prob', 'wind'], show_tiles: true }, config || {});
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._key = null; this._sel = null; this._day = 0;
  }
  getCardSize() { return 12; }
  set hass(hass) {
    this._hass = hass;
    if (this._cfg.data_url) { if (!this._fetched || Date.now() - this._fetched > 10 * 60e3) this._fetch(); return; }
    const st = hass.states[this._cfg.entity];
    if (!st) return this._error(`Brak encji ${this._cfg.entity} — sprawdź, czy dodatek ICM Meteogram działa i publikuje sensor.`);
    const key = st.last_updated + (hass.states[`sensor.${this._cfg.prefix}_zachmurzenie`] || {}).last_updated;
    if (key === this._key) return;
    this._key = key; this._data = fromSensor(st, hass, this._cfg.prefix); this._render();
  }
  _fetch() {
    this._fetched = Date.now();
    fetch(this._cfg.data_url, { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(d => { KEYS.forEach(k => { if (!Array.isArray(d.hourly[k])) d.hourly[k] = new Array(d.hourly.time.length).fill(null); }); this._data = d; this._render(); })
      .catch(e => this._error('Nie udało się pobrać danych z ' + this._cfg.data_url + ': ' + e.message));
  }
  _error(msg) { this.shadowRoot.innerHTML = `<style>${CSS}</style><ha-card style="background:#3a4556"><div class="err">${msg}</div></ha-card>`; }
  _render() {
    const D = this._data, H = D.hourly, N = H.time.length; if (!N) return this._error('Sensor nie zawiera jeszcze prognozy.');
    const T = H.time.map(s => new Date(s + ':00')), now = new Date();
    const nowIdx = Math.max(0, Math.min(N - 1, Math.round((now - T[0]) / 36e5)));
    const lat = D.lat ?? this._hass.config.latitude, lon = D.lon ?? this._hass.config.longitude;
    const days = []; const map = {};
    T.forEach((t, i) => { const k = t.toDateString(); if (!map[k]) { map[k] = { t, idx: [] }; days.push(map[k]); } map[k].idx.push(i); });
    days.forEach(d => { const tv = d.idx.map(i => num(H.temperature_2m[i])).filter(v => v != null); d.max = Math.max(...tv); d.min = Math.min(...tv);
      let w = null; d.idx.forEach(i => { const c = code(H, i), h = T[i].getHours(); if (c && h >= 8 && h <= 20 && (w == null || SEV[c] > SEV[w])) w = c; });
      d.code = w || (d.idx.some(i => (num(H.precipitation[i]) || 0) >= .1) ? 'rain' : 'part'); d.prob = Math.max(...d.idx.map(i => num(H.precipitation_probability[i]) || 0)); d.sum = d.idx.reduce((a, i) => a + (num(H.precipitation[i]) || 0), 0); });
    if (this._day >= days.length) this._day = 0;
    const I = days[this._day].idx; const sel = this._sel != null && I.includes(this._sel) ? this._sel : (I.includes(nowIdx) ? nowIdx : I[Math.floor(I.length / 2)]);
    this._ctx = { D, H, N, T, nowIdx, lat, lon, days, I, sel };
    const c = this._cfg;
    this.shadowRoot.innerHTML = `<style>${CSS}</style><ha-card><div class="wrap">
      <section class="hero glass"><div class="top"><span class="loc">${c.name || D.name || 'Pogoda'}</span><span class="pill" id="when"></span><span class="pill">ICM ${D.model || ''}</span></div>
        <div class="main"><div class="now"><span class="ico" id="ico"></span><div class="big" id="t"></div><div class="stats" id="st"></div></div>
        <div class="side"><div class="c" id="cond"></div><div class="r" id="rng"></div></div></div>
        <svg class="land" id="land" viewBox="0 0 1000 86" preserveAspectRatio="none" aria-hidden="true"></svg></section>
      ${c.show_days ? '<nav class="days glass" id="days" aria-label="Dzień"></nav>' : ''}
      ${c.show_charts.map(k => `<section class="card glass"><h3><span>${{ temp: 'Temperatura', prob: 'Szansa opadów', wind: 'Wiatr' }[k]}</span><span id="s_${k}"></span></h3><svg class="ch" id="c_${k}"></svg></section>`).join('')}
      ${c.show_tiles ? `<div class="tiles" id="tiles" style="--cols:${this.clientWidth >= 560 ? 4 : 2}"></div>` : ''}
      <div class="foot">Dane: © ICM UW, meteo.pl · nieoficjalne${D.partial ? ' · ikony godzinowe tylko dla opadu (pełne dane: opcja data_url)' : ''}</div></div></ha-card>`;
    if (c.show_days) this._days();
    requestAnimationFrame(() => { this._charts(); this._hour(sel); });
  }
  _days() {
    const { days } = this._ctx, box = this.shadowRoot.getElementById('days');
    days.forEach((d, k) => { const b = document.createElement('button'); b.className = 'day'; b.type = 'button'; b.setAttribute('aria-pressed', String(k === this._day));
      b.innerHTML = `<span class="dn">${k === 0 ? 'Dziś' : DS[d.t.getDay()]}</span><span class="dd">${d.t.getDate()} ${MON[d.t.getMonth()]}</span>${icon(d.code, false)}<span class="hl">${Math.round(d.max)}°<i>${Math.round(d.min)}°</i></span><span class="pp">${d.prob >= 20 ? Math.round(d.prob) + '%' : ''}</span>`;
      b.onclick = () => { this._day = k; this._sel = null; this._render(); }; box.appendChild(b); });
  }
  _charts() {
    const { H, T, I } = this._ctx, R = this.shadowRoot, n = I.length, NS = 'http://www.w3.org/2000/svg';
    const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); p && p.appendChild(e); return e; };
    const tx = (p, x, y, s, a) => { const e = el('text', Object.assign({ x, y, 'font-size': 12, fill: 'rgba(255,255,255,.82)', 'text-anchor': 'middle' }, a || {}), p); e.textContent = s; return e; };
    const ev = () => (R.host.clientWidth < 460 ? 6 : 3);
    this._marks = [];
    const frame = (svg, h) => { const w = Math.max(240, svg.clientWidth || 600); svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('height', h); svg.innerHTML = ''; const pad = 24; return { w, X: j => pad + (n <= 1 ? 0 : j * (w - 2 * pad) / (n - 1)) }; };
    const hook = (svg, X, top, bot) => { const step = n > 1 ? X(1) - X(0) : 20, m = el('rect', { y: top, height: bot - top, rx: 8, fill: 'rgba(255,255,255,.14)', width: 0 }); svg.insertBefore(m, svg.firstChild); this._marks.push({ m, X, step });
      const pick = e => { const r = svg.getBoundingClientRect(), cx = (e.clientX - r.left) * svg.viewBox.baseVal.width / r.width; let b = 0, bd = 1e9; I.forEach((_, j) => { const d = Math.abs(X(j) - cx); if (d < bd) { bd = d; b = j; } }); this._hour(I[b]); };
      svg.onpointermove = pick; svg.onpointerdown = pick; svg.onclick = e => { pick(e); this._sel = this._ctx.sel; }; svg.onpointerleave = e => { if (e.pointerType === 'mouse') this._hour(this._sel ?? this._ctx.sel0); }; };
    const hours = (svg, X, y) => I.forEach((i, j) => { if (T[i].getHours() % ev() === 0) tx(svg, X(j), y, hh(T[i].getHours()), { fill: 'rgba(255,255,255,.66)' }); });
    this._ctx.sel0 = this._ctx.sel;
    const cT = R.getElementById('c_temp');
    if (cT) { const { X } = frame(cT, 180), tv = I.map(i => num(H.temperature_2m[i])), av = I.map(i => num(H.apparent_temperature[i])); const all = tv.concat(av).filter(v => v != null), lo = Math.min(...all) - 1.5, hi = Math.max(...all) + 1.5, fy = v => 146 - (v - lo) / (hi - lo) * 92;
      const pts = tv.map((v, j) => [X(j), fy(v ?? lo)]); el('path', { d: smooth(pts) + `L${X(n - 1)},154L${X(0)},154Z`, fill: 'var(--temp-fill)' }, cT);
      if (av.some(v => v != null)) el('path', { d: smooth(av.map((v, j) => [X(j), fy(v ?? lo)])), fill: 'none', stroke: 'rgba(255,255,255,.55)', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, cT);
      el('path', { d: smooth(pts), fill: 'none', stroke: 'var(--temp)', 'stroke-width': 2.6, 'stroke-linecap': 'round' }, cT);
      I.forEach((i, j) => { if (T[i].getHours() % ev()) return; if (tv[j] != null) tx(cT, X(j), fy(tv[j]) - 10, Math.round(tv[j]) + '°', { fill: '#fff', 'font-size': 13.5, 'font-weight': 600 });
        const ic = icon(code(H, i), this._night(i)); if (ic) { const g = el('g', { transform: `translate(${X(j) - 12},2)` }, cT); g.innerHTML = ic.replace('<svg', '<svg width="24" height="26"'); } });
      hours(cT, X, 172); hook(cT, X, 2, 178); R.getElementById('s_temp').textContent = `maks. ${Math.round(this._ctx.days[this._day].max)}° · min. ${Math.round(this._ctx.days[this._day].min)}°`; }
    const cP = R.getElementById('c_prob');
    if (cP) { const { X } = frame(cP, 150), step = n > 1 ? X(1) - X(0) : 20, fy = v => 108 - v / 100 * 78; let d = '';
      I.forEach((i, j) => { const v = num(H.precipitation_probability[i]) || 0; d += (j ? 'L' : 'M') + (X(j) - step / 2).toFixed(1) + ',' + fy(v).toFixed(1) + 'L' + (X(j) + step / 2).toFixed(1) + ',' + fy(v).toFixed(1); });
      el('path', { d: d + `L${(X(n - 1) + step / 2).toFixed(1)},108L${(X(0) - step / 2).toFixed(1)},108Z`, fill: 'var(--rain-fill)' }, cP); el('path', { d, fill: 'none', stroke: 'var(--rain)', 'stroke-width': 2.4 }, cP);
      I.forEach((i, j) => { const mm = num(H.precipitation[i]) || 0; if (mm > 0) { const bh = Math.min(14, 4 + mm * 3); el('rect', { x: X(j) - step * .32, y: 108 - bh, width: step * .64, height: bh, rx: 2, fill: '#fff', opacity: .85 }, cP); }
        if (T[i].getHours() % ev()) return; tx(cP, X(j), 20, Math.round(num(H.precipitation_probability[i]) || 0) + '%', { fill: 'var(--rain)', 'font-size': 13.5, 'font-weight': 700 });
        if (mm >= .1) tx(cP, X(j), 124, pl(mm) + ' mm', { 'font-size': 11 }); });
      hours(cP, X, 142); hook(cP, X, 2, 146); const s = this._ctx.days[this._day].sum; R.getElementById('s_prob').textContent = s >= .1 ? `suma ${pl(s)} mm` : 'bez opadu'; }
    const cW = R.getElementById('c_wind');
    if (cW) { const { X } = frame(cW, 136), S = I.map(i => num(H.wind_speed_10m[i]) || 0), mx = Math.max(20, ...I.map(i => num(H.wind_gusts_10m[i]) || 0)), fy = v => 106 - v / mx * 36;
      el('path', { d: smooth(S.map((v, j) => [X(j), fy(v)])) + `L${X(n - 1)},106L${X(0)},106Z`, fill: 'rgba(134,236,217,.18)' }, cW); el('path', { d: smooth(S.map((v, j) => [X(j), fy(v)])), fill: 'none', stroke: 'var(--wind)', 'stroke-width': 2 }, cW);
      I.forEach((i, j) => { if (T[i].getHours() % ev()) return; const v = S[j], sc = .7 + Math.min(1, v / 40) * .7, g = el('g', { transform: `translate(${X(j)},26) rotate(${(num(H.wind_direction_10m[i]) || 0) + 180}) scale(${sc})` }, cW); el('path', { d: 'M0 -11 L7 7 L0 3 L-7 7 Z', fill: '#fff' }, g);
        tx(cW, X(j), 56, Math.round(v) + ' km/h', { fill: '#fff', 'font-weight': 600 }); const gu = num(H.wind_gusts_10m[i]); if (gu != null) tx(cW, X(j), 71, 'porywy ' + Math.round(gu), { 'font-size': 10.5, fill: 'rgba(255,255,255,.66)' }); });
      hours(cW, X, 128); hook(cW, X, 2, 132); R.getElementById('s_wind').textContent = `porywy do ${Math.round(Math.max(...I.map(i => num(H.wind_gusts_10m[i]) || 0)))} km/h`; }
  }
  _night(i) { const { T, lat, lon } = this._ctx, [sr, ss] = sun(T[i], lat, lon), h = T[i].getHours() + .5; return h < sr || h > ss; }
  _hour(i) {
    if (i == null) return; const X = this._ctx; X.sel = i; const { H, T, nowIdx, lat, lon } = X, R = this.shadowRoot, t = T[i], c = code(H, i) || (i === nowIdx ? null : null);
    const sk = sky(t, c, num(H.cloud_cover[i]), lat, lon); R.querySelector('ha-card').style.background = sk.bg;
    R.getElementById('when').textContent = i === nowIdx ? 'Teraz' : `${DS[t.getDay()]} ${hh(t.getHours())}`;
    R.getElementById('ico').innerHTML = icon(c || 'part', sk.tod === 'night');
    R.getElementById('t').innerHTML = Math.round(num(H.temperature_2m[i])) + '<sup>°C</sup>';
    R.getElementById('st').innerHTML = `<span>Szansa opadów: <b>${Math.round(num(H.precipitation_probability[i]) || 0)}%</b></span><span>Wilgotność: <b>${Math.round(num(H.relative_humidity_2m[i]) || 0)}%</b></span><span>Wiatr: <b>${Math.round(num(H.wind_speed_10m[i]) || 0)} km/h</b></span>`;
    R.getElementById('cond').textContent = `${DOW[t.getDay()]}, ${hh(t.getHours())}${c ? ' · ' + LABEL[c] : ''}`;
    const d = X.days[this._day]; R.getElementById('rng').textContent = `Maks. ${Math.round(d.max)}°  Min. ${Math.round(d.min)}°`;
    R.getElementById('land').innerHTML = land(sk.tod === 'night', (num(H.soil_temperature_min[i]) ?? 5) <= 0, t.getMonth());
    (this._marks || []).forEach(m => { const j = X.I.indexOf(i); if (j < 0) { m.m.setAttribute('width', 0); return; } m.m.setAttribute('x', m.X(j) - m.step / 2); m.m.setAttribute('width', m.step); });
    if (this._cfg.show_tiles) this._tiles(i, sk);
  }
  _tiles(i, sk) {
    const { H, I } = this._ctx, q = k => num(H[k][i]), box = this.shadowRoot.getElementById('tiles');
    const ap = q('apparent_temperature'), tt = q('temperature_2m'), hum = q('relative_humidity_2m'), dew = q('dew_point_2m'), vis = q('visibility'), p = q('pressure_msl'), p3 = num(H.pressure_msl[Math.max(0, i - 3)]), g = q('soil_temperature_min'), cl = q('cloud_cover');
    const dp = p != null && p3 != null ? p - p3 : 0, vk = vis == null ? null : vis / 1000;
    const T = [
      ['Odczuwalna', `${pl(ap, 0)}°`, ap != null && tt != null && ap < tt - 1.5 ? 'Wiatr sprawia, że jest chłodniej.' : 'Podobnie do rzeczywistej.'],
      ['Wilgotność', `${hum == null ? '—' : Math.round(hum)}<small>%</small>`, dew != null ? `Punkt rosy ${pl(dew, 0)}°.` : ''],
      ['Ciśnienie', `${pl(p, 0)}<small>hPa</small>`, Math.abs(dp) < .5 ? 'Stałe w ostatnich 3 h.' : (dp > 0 ? 'Rośnie' : 'Spada') + ` o ${pl(Math.abs(dp))} hPa w 3 h.`],
      ['Widzialność', vk == null ? '—' : `${vk < 1 ? pl(vk, 1) : Math.round(vk)}<small>km</small>`, vk == null ? 'Brak danych dla tej godziny.' : vk < 1 ? 'Mgła — bardzo słaba widoczność.' : vk < 5 ? 'Zamglenie.' : vk < 10 ? 'Umiarkowana.' : 'Dobra widoczność.'],
      ['Przy gruncie', g == null ? '—' : `${pl(g)}°`, g == null ? 'Brak danych dla tej godziny.' : g <= 0 ? 'Przymrozek przy gruncie.' : 'Bez przymrozku.'],
      ['Słońce', sk.tod === 'night' && t0(i, this) ? `${fmtT(sk.sr)}<small>wschód</small>` : `${fmtT(sk.ss)}<small>zachód</small>`, `Wschód ${fmtT(sk.sr)} · zachód ${fmtT(sk.ss)}`],
      ['Opady w dniu', `${pl(this._ctx.days[this._day].sum)}<small>mm</small>`, this._ctx.days[this._day].sum >= .1 ? `Szansa do ${Math.round(this._ctx.days[this._day].prob)}%.` : 'Sucho przez cały dzień.'],
      ['Chmury', cl == null ? '—' : `${Math.round(cl)}<small>%</small>`, cl == null ? 'Brak danych dla tej godziny.' : cl < 20 ? 'Prawie bezchmurnie.' : cl < 85 ? 'Częściowe zachmurzenie.' : 'Pełne zachmurzenie.']];
    box.style.setProperty('--cols', this.getBoundingClientRect().width >= 560 ? 4 : 2);
    box.innerHTML = T.map(([h, v, d]) => `<section class="tile glass"><h3>${h}</h3><div class="v">${v}</div><div class="d">${d}</div></section>`).join('');
    function t0(i, self) { const t = self._ctx.T[i]; return t.getHours() + .5 < sk.sr; }
  }
}
if (!customElements.get('icm-pogoda-card')) customElements.define('icm-pogoda-card', IcmPogodaCard);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'icm-pogoda-card')) window.customCards.push({ type: 'icm-pogoda-card', name: 'ICM Pogoda', description: 'Prognoza ICM w stylu „Pogoda” (niebo, krajobraz, wykresy dnia, kafle).', preview: false });
console.info(`%c ICM-POGODA-CARD %c ${VERSION} `, 'background:#2f6bb8;color:#fff', 'background:#ffd166;color:#000');
})();
