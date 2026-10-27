# Meteogram ICM — dokumentacja

Add-on pobiera prognozę godzinową z **nieoficjalnego** API meteogramów ICM
meteo.pl (model UM 4 km — ten sam, który rysuje meteogramy na meteo.pl
i w aplikacji Meteo ICM) i udostępnia ją na dwa sposoby:

1. **Panel w bocznym menu** (ingress) — interaktywny meteogram w stylu
   godzinowego widgetu pogodowego: zakładki *Temperatura / Szansa opadów /
   Wiatr*, najazd kursorem/palcem pokazuje wartości dla konkretnej godziny,
   pasek dni, znacznik „teraz", motyw jasny/ciemny.
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
| `model` | `um4_60` | `um4_60` (60 h), `um4_120` (120 h), `gfs` (eksperymentalnie). Poza obszarem UM add-on sam przechodzi na `gfs` |
| `update_minutes` | `30` | Interwał odświeżania (10–180) |
| `publish_sensor` | `true` | Czy tworzyć `sensor.icm_meteogram` |
| `coffee_url` | *(puste)* | Link „postaw kawę" (buycoffee.to itp.); pusty = ukryty |
| `publish_detail_sensors` | `true` | Osobne sensory `sensor.icm_*` z wartością dla bieżącej godziny |
| `api_base` | *(puste)* | Adres API ICM; puste = `https://devmgramapi.meteo.pl` |

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
- `GET /api/health` — status ostatniego odświeżenia.

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
- Trzymaj rozsądny interwał odświeżania (domyślne 30 min to i tak dużo —
  nowy bieg modelu pojawia się co ~6 h).

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
