# Changelog

## 0.2.1

- Współrzędne są **ucinane** do 2 miejsc po przecinku (a nie zaokrąglane):
  21.0122 → 21.01, 52.2296756 → 52.22.

## 0.2.0

- Wyszukiwarka lokalizacji w panelu (przycisk „Zmień lokalizację") —
  wpisujesz nazwę, wybierasz właściwą z listy z ujednoznacznieniem
  (powiat / województwo / kraj), bo nazwy się powtarzają. Wybór zapisuje
  się w opcjach add-onu i od razu przelicza prognozę.
- Współrzędne zaokrąglane do 2 miejsc po przecinku.
- Opcja „postaw kawę" (`coffee_url`) — po ustawieniu w panelu pojawia się
  przycisk wsparcia.

## 0.1.0

- Pierwsze wydanie.
- Panel ingress: interaktywny meteogram (model UM 4 km, ICM meteo.pl) —
  domyślny widok „Wszystko" (nałożone warstwy: szansa opadów w tle,
  temperatura i wiatr na wierzchu) + zakładki Temperatura / Szansa opadów /
  Wiatr, dymek z wartościami dla godziny, pasek dni, znacznik „teraz",
  motyw jasny/ciemny.
- `sensor.icm_meteogram` z seriami prognozy w atrybutach (ApexCharts,
  automatyzacje).
- Lokalizacja z opcji add-onu lub automatycznie ze współrzędnych domu
  w Home Assistant.
