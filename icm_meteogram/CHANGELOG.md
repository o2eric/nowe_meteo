# Changelog

## 0.9.2

- **Dane dla własnej strony:** opcjonalny port 8099 (domyślnie wyłączony — włącz w zakładce
  „Sieć” dodatku). `GET /api/data` i `/api/series` mają nagłówek CORS, więc strona w sieci
  domowej może je czytać. Zmiany (`POST`: model, lokalizacja, odświeżenie) przyjmowane są
  tylko z panelu HA (ingress) — przez wystawiony port zwracają 403.
- Zestaw `web-kit/` w repo: CSS i JS widoków „pogoda” i „pełny” do osadzenia na własnej stronie.

## 0.9.1

- Wybór modelu (UM 4 km 60 h / 120 h, GFS 240 h) także w widokach `pogoda` i `pelny` — lista obok „Widok”.

## 0.9.0

- **Szablony panelu** — opcja `view` i lista „Widok” w panelu (zapamiętana w przeglądarce):
  - `klasyczny` — dotychczasowy panel,
  - `pelny` — nowy meteogram: wszystkie wartości ICM w pasach na jednej osi czasu, jedna skala
    na pas, stała lewa kolumna z odczytem godziny pod kursorem (zamiast dymka), przekrój chmur,
    pasy przy gruncie / widzialność / wilgotność, noc wg wschodu i zachodu słońca, zwijanie
    pustych pasów, wybór pasów i tryb zwarty,
  - `pogoda` — widok w stylu iOS/Google: blok „teraz”, pasek dni, wykresy dnia z wartościami
    nad linią, kafle szczegółów; niebo i krajobraz pory roku zmieniają się z wybraną godziną.
- Adresy `pelny`, `pogoda`, `klasyczny` otwierają dany szablon bezpośrednio.

## 0.8.0

- **Tło w ruchu w nagłówku panelu** — scena liczona z prognozy na bieżącą
  godzinę: pora dnia (wschód/zachód słońca ze współrzędnych), pora roku
  (krajobraz: kwiaty, zieleń, kolorowe liście, śnieg przy gruncie ≤ 0 °C),
  chmury z zachmurzenia i wiatru, deszcz / śnieg / deszcz ze śniegiem wg typu
  opadu ICM, mgła, błyski burzy, smugi silnego wiatru, gwiazdy i świetliki nocą.
- Nowa opcja `background`: `krajobraz` (domyślnie), `efekty`, `niebo`, `brak`
  (klasyczny wygląd). Lista „Tło” w panelu nadpisuje ją w danej przeglądarce.
- Animacje respektują systemowe „ogranicz ruch”; scena odświeża się co 10 min.

## 0.7.0

- **Widok „Pełny”** w panelu — wszystkie wartości ICM w siedmiu pasach:
  temperatura (min/max w godzinie, odczuwalna z zakresem, punkt rosy,
  temperatura gruntu min–max), opad średni i maksymalny w kolorze typu
  (deszcz / śnieg / deszcz ze śniegiem) z wilgotnością, szansa opadu
  z burzami (kolor wg natężenia wyładowań), ciśnienie, wiatr z porywami
  i kierunkiem, piętra chmur z mgłą, podstawa i wierzchołek chmur
  z widzialnością (skale nieliniowe). Dymek pokazuje komplet danych dla godziny.
- **Wybór modelu w panelu** (UM 4 km 60 h / 120 h, GFS 240 h) — zapis do
  opcji add-onu i natychmiastowe pobranie; model poza zasięgiem jest
  zablokowany. Endpoint `POST /api/setmodel`.
- **Typ opadu** odczytywany wg kodów frontendu meteo.pl (1 deszcz, 2 śnieg,
  3 deszcz ze śniegiem): `sensor.icm_typ_opadu` pokazuje tekst, kod pogody
  rozróżnia śnieg i deszcz ze śniegiem (WMO 68).
- **Poprawka: wyładowania** (`flash_max`) to wskaźnik natężenia (progi strony
  10 / 30), a nie ułamek — `sensor.icm_wyladowania` bez mnożenia ×100 i bez „%”.
- **Burza** od `storm > 0,01` lub wyładowań > 0 (jak na meteo.pl; wcześniej
  od 0,5).
- **NaN w odpowiedzi API** traktowane jak brak danych (wcześniej mogło
  przerwać całe pobranie).
- Panel deklaruje `charset=utf-8`; nagłówek pokazuje aktywny model.

## 0.6.2

- Link wsparcia autora: [buycoffee.to/o2eric](https://buycoffee.to/o2eric) — w README, na GitHubie
  (przycisk „Sponsor”) i jako domyślna wartość `coffee_url` (przycisk
  „Postaw kawę” w panelu). Istniejące instalacje zachowują swoją wartość;
  pusty `coffee_url` ukrywa przycisk.

## 0.6.1

- **Domyślny interwał pobierania: 360 min (6 h)** zamiast 30 min — zgodnie z
  cyklem modelu UM (nowy bieg co 6 h, `um4_120` co 12 h). Częstsze pobieranie
  zwracało te same dane. Świeże dane od razu: przycisk „⟳ Odśwież”.
  Istniejące instalacje zachowują swoją wartość `update_minutes`.
- README, dokumentacja i opis opcji wyjaśniają, dlaczego interwał jest długi.

## 0.6.0

- **Przycisk „⟳ Odśwież” w panelu** — pobiera prognozę od razu i jest
  przy okazji testem łączności z API ICM (cała ścieżka: zasięg modelu →
  lista biegów → dane punktu). Przy problemie pokazuje komunikat, który
  odróżnia brak sieci/DNS, odrzucenie przez API (np. HTTP 502 spoza Polski)
  i nieczytelne dane. Limit: jedno pobranie na 60 s. Endpoint
  `POST /api/refresh`.
- **Dłuższy cykl pobierania**: `update_minutes` do 720 min (np. 360 = co 6 h,
  zgodnie z biegami UM).
- **Sensory przeliczane co pełną godzinę** z danych w pamięci (bez zapytań do
  ICM), więc przy długim cyklu stan „teraz” się nie rozjeżdża.
- Ręczne odświeżenie i zmiana lokalizacji nie powodują już podwójnego
  pobrania (pętla zaczyna nowy cykl od tej chwili).

## 0.5.0

- **Wszystkie wartości publikowane przez ICM**: dodane pozostałe pola
  odpowiedzi API — temperatura powietrza i odczuwalna min/max w godzinie,
  temperatura gruntu max, ciśnienie na poziomie stacji, piętra chmur
  (bardzo niskie/niskie/średnie/wysokie), podstawa chmur (pokrycie 1/25/45/
  65/79%), wierzchołek chmur, mgła, burza, wyładowania i typ opadu (surowy
  kod ICM). Pełne serie w `/api/data` i `/api/series`.
- **Sensory szczegółowe `sensor.icm_*`** (29 encji, opcja
  `publish_detail_sensors`, domyślnie włączona): wartość dla bieżącej
  godziny z jednostką i `device_class`, więc HA zapisuje historię i rysuje
  wykresy. Główny `sensor.icm_meteogram` bez zmian.

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
