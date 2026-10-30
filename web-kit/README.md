# Web-kit: widoki ICM Meteogram na własnej stronie

Widoki **pogoda** (styl iOS/Google) i **pełny** (meteogram w pasach) z dodatku
„Meteogram (na podstawie ICM)” do wklejenia na stronę w sieci domowej.
Czysty HTML + CSS + JS, bez bibliotek i bez budowania.

```
web-kit/
  pogoda.html    pelny.html      ← gotowe strony (przełączają się listą „Widok”)
  css/pogoda.css css/pelny.css   ← pełne style
  js/pogoda.js   js/pelny.js     ← logika widoków
  js/config.js                   ← adres danych i ustawienia
  data/sample.json               ← przykładowe dane (bieg ICM UM 4 km, 27.10.2026)
```

## 1. Włącz dane w dodatku (0.9.2+)

Home Assistant → Ustawienia → Dodatki → Meteogram → **Sieć** → przy `8099/tcp` wpisz port
(np. `8099`) → Zapisz. Dane: `http://<adres-HA>:8099/api/data` (JSON, tylko odczyt, CORS
otwarty). Zmiany modelu i lokalizacji przez ten port są zablokowane — robi się je w panelu HA.

## 2. Ustaw adres

W `js/config.js`:

```js
window.ICM_CONFIG = { dataUrl: 'http://192.168.1.10:8099/api/data', refreshMinutes: 30, modelSwitch: false };
```

## 3. Wgraj pliki

Skopiuj cały katalog na serwer strony (nginx, Apache, Caddy, `python -m http.server`).
Otwieranie bezpośrednio z dysku (`file://`) nie zadziała — przeglądarka blokuje wtedy `fetch`.
Test bez HA: zostaw `dataUrl: 'data/sample.json'` i uruchom w katalogu `python -m http.server 8000`,
potem otwórz `http://localhost:8000/pogoda.html`.

## Osadzanie w istniejącej stronie

- Najprościej: `<iframe src="/meteo/pogoda.html" style="width:100%;height:1500px;border:0"></iframe>`.
- Bezpośrednio: skopiuj zawartość `<body>` z `pogoda.html` w miejsce na stronie i dołącz
  `css/pogoda.css`, `js/config.js`, `js/pogoda.js`. Jeden widok na stronę (elementy mają stałe `id`).
- Widok „pogoda” ustawia tło całej strony (niebo). Do osadzenia w ramce lub jako sekcja
  zostaw go w `iframe`.

## Kolory i wygląd

Wszystkie kolory są zmiennymi CSS na początku pliku (`:root { --temp: …; --rain: …; }`).
„Pełny” ma wersję jasną i ciemną (wg ustawienia systemu albo `data-theme="dark|light"`
na `<html>`). „Pogoda” ma jeden wygląd — kolor nieba liczony z prognozy.

## Format danych

`/api/data` zwraca `{ name, lat, lon, model, model_id, fstart, hourly: { time[], temperature_2m[], … } }`
— pełna lista pól jest w `data/sample.json`. Brakujące pola widoki traktują jak brak danych.

Dane: © ICM UW, meteo.pl. Projekt nieoficjalny, niepowiązany z ICM UW.

## Karta Lovelace `icm-pogoda-card`

Widok „pogoda” jako karta na dashboard HA, bez iframe.

1. Skopiuj `icm-pogoda-card.js` do `/config/www/` (np. przez dodatek Samba albo Terminal).
2. Ustawienia → Dashboardy → ⋮ → Zasoby → Dodaj: URL `/local/icm-pogoda-card.js?v=1`,
   typ **Moduł JavaScript**. Po każdej podmianie pliku zwiększ `v=`.
3. Dodaj kartę (edytor YAML):

```yaml
type: custom:icm-pogoda-card
entity: sensor.icm_meteogram        # domyślnie
# name: Dom                         # nazwa w nagłówku (domyślnie z sensora)
# data_url: http://192.168.1.10:8099/api/data   # pełne dane z dodatku (port 8099 włączony)
# show_days: true
# show_charts: [temp, prob, wind]
# show_tiles: true
```

Bez `data_url` karta czyta atrybuty `sensor.icm_meteogram` i sensory `sensor.icm_*`
(chmury, mgła, burza, typ opadu i grunt są wtedy znane tylko dla bieżącej godziny,
więc ikony godzinowe pokazują się tylko przy opadzie). Z `data_url` ma komplet danych.
