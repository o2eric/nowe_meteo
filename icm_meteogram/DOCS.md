# Meteogram ICM — dokumentacja

Add-on pobiera prognozę godzinową z **nieoficjalnego** API meteogramów ICM
meteo.pl (model UM 4 km — ten sam, który rysuje meteogramy na meteo.pl
i w aplikacji Meteo ICM) i udostępnia ją na dwa sposoby:

1. **Panel w bocznym menu** (ingress) — interaktywny meteogram w stylu
   godzinowego widgetu pogodowego: zakładki *Temperatura / Szansa opadów /
   Wiatr / Wszystko / Pełny*, najazd kursorem/palcem pokazuje wartości dla
   konkretnej godziny, pasek dni, znacznik „teraz", motyw jasny/ciemny.
   Widok **Pełny** pokazuje wszystkie wartości ICM w pasach: temperatury
   (z min/max, odczuwalną, punktem rosy i gruntem), opad z typem
   (deszcz / śnieg / deszcz ze śniegiem) i wilgotność, szansę opadu
   z burzami, ciśnienie, wiatr z porywami i kierunkiem, piętra chmur z mgłą
   oraz podstawę i wierzchołek chmur z widzialnością. W nagłówku można
   przełączyć **model prognozy** (zapisuje się w opcjach add-onu).
2. **Sensor `sensor.icm_meteogram`** — stan = aktualna temperatura, a w
   atrybutach pełne serie prognozy (`temp`, `apparent`, `prob`, `precip`,
   `wind`, `gust`, `dir`, `humid`, `pressure` [hPa], `dew` [punkt rosy °C])
   jako pary `[timestamp_ms, wartość]` — gotowe pod kartę ApexCharts
   i automatyzacje — oraz bieżące wartości `pressure_now`, `dew_point_now`,
   `visibility_now` [m], `cloud_cover_now` [%].

## Konfiguracja

| Opcja | Domyślnie | Opis |
|---|---|---|
| `location_name` | *(puste)* | Nazwa pokazywana w panelu; puste = nazwa z HA |
| `latitude` / `longitude` | *(puste)* | Puste = współrzędne domu z HA. Ucinane do 4 miejsc |
| `model` | `um4_60` | `um4_60` (60 h), `um4_120` (120 h), `gfs` (eksperymentalnie). Można też przełączać w panelu. Poza obszarem UM add-on sam przechodzi na `gfs` |
| `update_minutes` | `360` | Interwał pobierania prognozy (10–720 min); sensory przeliczają się co pełną godzinę |
| `publish_sensor` | `true` | Czy tworzyć `sensor.icm_meteogram` |
| `background` | `krajobraz` | Tło nagłówka panelu: `krajobraz` (niebo + krajobraz pory roku w ruchu), `efekty` (niebo z efektami), `niebo` (sam kolor nieba), `brak` (klasyczny wygląd). W panelu można to zmienić dla danej przeglądarki |
| `coffee_url` | `https://buycoffee.to/o2eric` | Link przycisku „Postaw kawę” w panelu (wsparcie autora); pusty = przycisk ukryty |
| `publish_detail_sensors` | `true` | Osobne sensory `sensor.icm_*` z wartością dla bieżącej godziny |
| `api_base` | *(puste)* | Adres API ICM; puste = `https://devmgramapi.meteo.pl` |

## Tło w ruchu (0.8.0)

Nagłówek panelu pokazuje scenę liczoną z prognozy dla bieżącej godziny:

- **pora dnia** — świt i zmierzch to ±45 min od wschodu/zachodu słońca wyliczonego
  ze współrzędnych; słońce idzie po łuku, nocą księżyc, a przy zachmurzeniu < 50% gwiazdy;
- **pora roku** (z daty) — krajobraz: wiosną drzewa w kwiatach i płatki, latem pyłki
  i świetliki nocą, jesienią kolorowe korony i liście niesione wiatrem, zimą nagie
  drzewa, a przy gruncie ≤ 0 °C śnieżna pokrywa i szron;
- **chmury** — liczba z zachmurzenia ogólnego, prędkość z wiatru; ≥ 85% = szare niebo;
- **opad** — typ z ICM (deszcz / śnieg / deszcz ze śniegiem), gęstość z mm/h,
  pochylenie z wiatru; < 0,5 mm/h = mżawka;
- **mgła** ≥ 15% = pasma mgły, ≥ 50% = mglisty kolor nieba;
- **burza** (kod pogody 95: burza > 0,01 lub wyładowania > 0) = błyski;
- **silny wiatr** ≥ 35 km/h lub porywy ≥ 55 km/h = smugi wiatru.

Lista „Tło” w nagłówku zmienia szablon tylko w tej przeglądarce (np. `brak`
na słabym tablecie). Przy systemowym ustawieniu „ogranicz ruch” animacje stoją.

## Zmiana lokalizacji

Najszybciej: w panelu kliknij **„Zmień lokalizację"**, wpisz nazwę
miejscowości i wybierz właściwą z listy (pokazuje powiat / województwo /
kraj, bo nazwy się powtarzają). Wybór zapisuje się w opcjach add-onu
i od razu przelicza prognozę. Możesz też wpisać `latitude`/`longitude`
ręcznie w Konfiguracji, albo zostawić puste, by użyć współrzędnych domu
z Home Assistant.

## Endpointy (dla zaawansowanych)

Pod portem ingress (lub po wystawieniu portu 8099):

- `GET /` — panel,
- `GET /api/data` — JSON `hourly` + `daily` (format zbliżony do Open-Meteo),
- `GET /api/series` — serie `[[ts_ms, val], ...]` pod ApexCharts (także
  `precip_max`, `visibility`, `cloud`, `ground_min`, których nie ma w sensorze),
- `GET /api/health` — status ostatniego odświeżenia,
- `POST /api/setmodel` — zmień model `{"model": "um4_60" | "um4_120" | "gfs"}`;
  zapisuje opcję i od razu pobiera prognozę,
- `POST /api/refresh` — pobierz prognozę teraz; działa też jako test łączności
  z API ICM (odpowiedź `{"ok": true, ...}` albo HTTP 502 z opisem problemu).
  Limit: jedno pobranie na 60 s.

## Sensory szczegółowe (`sensor.icm_*`)

Wartość dla bieżącej godziny prognozy (atrybut `now_time`), odświeżana razem
z prognozą. Encje: `temperatura`, `temp_max`, `temp_min`, `temp_odczuwalna`,
`punkt_rosy`, `temp_gruntu_min`, `temp_gruntu_max`, `wilgotnosc`,
`cisnienie` (poziom morza), `cisnienie_stacji`, `opad`, `opad_max`,
`szansa_opadu`, `typ_opadu` (surowy kod ICM), `wiatr`, `porywy`,
`kierunek_wiatru`, `zachmurzenie`, `chmury_bardzo_niskie`, `chmury_niskie`,
`chmury_srednie`, `chmury_wysokie`, `podstawa_chmur`, `wierzcholek_chmur`,
`widzialnosc`, `mgla`, `burza`, `wyladowania`, `kod_pogody`.
Dla GFS część pól nie istnieje — te sensory mają stan `unknown`.
Encje są tworzone przez API stanów, więc nie mają `unique_id` (nie da się
ich edytować w UI) i po restarcie HA pojawiają się przy pierwszym
odświeżeniu add-onu.

## Przykład karty ApexCharts (dane z sensora)

```yaml
type: custom:apexcharts-card
header: { show: true, title: Meteogram ICM }
graph_span: 60h
span: { start: hour }
series:
  - entity: sensor.icm_meteogram
    name: Temperatura
    data_generator: return entity.attributes.temp;
  - entity: sensor.icm_meteogram
    name: Szansa opadów
    type: column
    y_axis_id: prob
    data_generator: return entity.attributes.prob;
yaxis:
  - id: temp
  - id: prob
    opposite: true
    max: 100
```

## Recorder

Atrybuty sensora zawierają ~60-godzinne serie i zmieniają się przy każdym
odświeżeniu. Jeśli dbasz o rozmiar bazy, wyklucz atrybuty z recordera:

```yaml
recorder:
  exclude:
    entities:
      - sensor.icm_meteogram
```

(Karta ApexCharts z `data_generator` czyta stan na żywo, nie historię.)

## Ograniczenia techniczne

- API jest **nieoficjalne** (backend aplikacji mobilnej Meteo ICM). Może się
  zmienić lub zniknąć bez zapowiedzi.
- Endpoint danych odpowiada tylko z **polskich adresów IP** — spoza Polski
  dostaniesz błąd 502.
- Trzymaj rzadki interwał pobierania. Domyślne 360 min (6 h) wynika z cyklu
  modelu: UM liczy nowy bieg co 6 h (`um4_120` co 12 h), więc częstsze
  zapytania zwracają te same dane i tylko obciążają nieoficjalne API ICM.
  Stan sensorów przelicza się co pełną godzinę bez zapytań do ICM, a gdy
  potrzebujesz świeżych danych od razu, użyj przycisku **„⟳ Odśwież”**.

## Zastrzeżenia prawne (ważne)

To **nieoficjalny, niezależny** projekt — **niepowiązany** z ICM UW ani
meteo.pl i przez nie **niewspierany**. Prognozy są **własnością ICM UW /
meteo.pl** (© ICM UW, meteo.pl) i pozostają objęte ich prawami autorskimi
oraz regulaminem; add-on jedynie pobiera prognozę dla Twojej lokalizacji na
użytek osobisty i **nie nadaje** żadnych praw do danych. Korzysta z
**nieoficjalnego API** — używaj odpowiedzialnie, z niskim obciążeniem, do
celów niekomercyjnych. Oprogramowanie „AS IS", bez gwarancji; nie opieraj na
nim decyzji krytycznych. Znaki „ICM", „meteo.pl", „UM" należą do właścicieli
i użyto ich wyłącznie opisowo.

Pełny tekst: [DISCLAIMER.md](https://github.com/o2eric/nowe_meteo/blob/main/DISCLAIMER.md).
O oficjalną zgodę na wykorzystanie prognoz ICM pytaj: **meteo@icm.edu.pl**.
