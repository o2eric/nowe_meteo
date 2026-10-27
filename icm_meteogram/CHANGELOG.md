# Changelog

## 0.4.2

- Panel i lista wyników wyszukiwarki pokazują współrzędne z dokładnością
  do **4** miejsc po przecinku (tyle, ile add-on faktycznie używa),
  zamiast zaokrąglenia do 2.

## 0.4.1

- **Stan `sensor.icm_meteogram` i wartości `*_now` dotyczą bieżącej godziny**,
  a nie pierwszej godziny biegu modelu. Przy `um4_120` (biegi tylko 00Z/12Z)
  sensor pokazywał dotąd temperaturę sprzed nawet kilkunastu godzin. Nowy
  atrybut `now_time` mówi, której godziny prognozy dotyczy stan.

## 0.4.0

Dostosowanie do aktualnego frontendu www.meteo.pl/meteogramy (2026-10):

- **Lista biegów pobierana przez GET** (`/meteorograms/available`), tak jak robi
  to strona; stary POST zostaje jako zapas.
- **Sprawdzanie zasięgu modelu** (`/available_models/`): dla punktu poza
  obszarem UM 4 km add-on sam przechodzi na GFS zamiast zgłaszać błąd.
- **Nowy geokoder** — ten sam co na www.meteo.pl (`nom-proxy.dev.meteo.pl`,
  format Nominatim); Photon ICM i Open-Meteo zostają jako zapas. Gdy nazwa
  lokalizacji jest pusta, add-on ustala ją ze współrzędnych.
- **Śnieg**: opad przy temperaturze poniżej 0°C dostaje kod/ikonę śniegu
  (wcześniej zawsze „deszcz").
- **Nowe pola prognozy**: ciśnienie zredukowane do poziomu morza (hPa), punkt
  rosy, opad maksymalny w oczku siatki, widzialność, zachmurzenie ogólne (%),
  minimalna temperatura gruntu (przymrozki). W `/api/data` i `/api/series`;
  w sensorze serie `pressure` i `dew` oraz bieżące wartości `*_now`.
- Wartości „brak danych" z API ICM (`-327276480`) są odfiltrowywane.
- Opcja **`api_base`** — adres API do zmiany bez nowego wydania.
- Współrzędne ucinane do **4** miejsc po przecinku (wcześniej 2), tak jak
  zwraca je serwer ICM — przy 2 miejscach punkt mógł się przesunąć nawet
  o ~1 km i trafić w sąsiednie oczko siatki 4 km.

## 0.3.1

- **Strzałki kierunku wiatru w domyślnym widoku „Wszystko"** — wcześniej były
  tylko w zakładce „Wiatr", więc na starcie kierunku nie było widać. Teraz
  pojawiają się co 3 h nad linią wiatru także w widoku zbiorczym.

## 0.3.0

- **Wilgotność względna** (%) — nowe pole prognozy (`realhum_aver` z modelu ICM).
  Widoczna w dymku wykresu (zakładki Temperatura / Szansa opadów / Wszystko)
  oraz w nagłówku przy podsumowaniu „teraz". Dodana też do atrybutów
  `sensor.icm_meteogram` (seria `humid`) — do wykresów ApexCharts i automatyzacji.
- **Kierunek wiatru** czytelniejszy: dymek i nagłówek pokazują teraz zarówno
  różę (np. `NE`), jak i stopnie (`45°`). Strzałki kierunku w zakładce „Wiatr"
  bez zmian.

## 0.2.4

- Nazwa i logo przeformułowane na **„na podstawie ICM"** (zamiast „Meteogram
  ICM") — jaśniejsze, że projekt jedynie korzysta z danych ICM, a nie jest
  produktem ICM. Wielki wordmark to teraz „Meteogram".

## 0.2.3

- Zastrzeżenia prawne: dodano `DISCLAIMER.md` i `LICENSE` (MIT dla kodu,
  z wyłączeniem danych), wyraźne oznaczenie **projektu jako nieoficjalnego
  i niezależnego** (brak powiązania z ICM UW / meteo.pl) w README, dokumentacji,
  opisie add-onu i w stopce panelu. Logo bez wordmarku „meteo.pl".
- Dane pogodowe: © ICM UW, meteo.pl — pozostają ich własnością.

## 0.2.2

- Wyszukiwarka lokalizacji korzysta teraz z **geokodera meteo.pl (Photon)** —
  tego samego, którego używa aplikacja ICM. Wyniki obejmują tylko obszar
  meteo.pl (koniec z „Poznań, Ohio"), są sortowane względem bieżącej
  lokalizacji i pokazują typ miejsca (miasto/wieś) oraz powiat i województwo.
  Fallback na Open-Meteo, gdy meteo.pl niedostępne.

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
