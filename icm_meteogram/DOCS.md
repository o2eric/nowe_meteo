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
   `wind`, `gust`, `dir`) jako pary `[timestamp_ms, wartość]` — gotowe pod
   kartę ApexCharts i automatyzacje.

## Konfiguracja

| Opcja | Domyślnie | Opis |
|---|---|---|
| `location_name` | *(puste)* | Nazwa pokazywana w panelu; puste = nazwa z HA |
| `latitude` / `longitude` | *(puste)* | Puste = współrzędne domu z HA. Ucinane do 2 miejsc |
| `model` | `um4_60` | `um4_60` (60 h), `um4_120` (120 h), `gfs` (eksperymentalnie) |
| `update_minutes` | `30` | Interwał odświeżania (10–180) |
| `publish_sensor` | `true` | Czy tworzyć `sensor.icm_meteogram` |
| `coffee_url` | *(puste)* | Link „postaw kawę" (buycoffee.to itp.); pusty = ukryty |

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
- `GET /api/series` — serie `[[ts_ms, val], ...]` pod ApexCharts,
- `GET /api/health` — status ostatniego odświeżenia.

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

## Ograniczenia i uczciwość wobec ICM

- API jest **nieoficjalne** (backend aplikacji mobilnej Meteo ICM). Może się
  zmienić lub zniknąć bez zapowiedzi.
- Endpoint danych odpowiada tylko z **polskich adresów IP** — spoza Polski
  dostaniesz błąd 502.
- Trzymaj rozsądny interwał odświeżania (domyślne 30 min to i tak dużo —
  nowy bieg modelu pojawia się co ~6 h). Dane: © ICM UW, meteo.pl.
