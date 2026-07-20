# Meteogram (nieoficjalny) — repozytorium add-onów Home Assistant

[![Add repository to my Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fo2eric%2Fnowe_meteo)

> ⚠️ **Projekt nieoficjalny i niezależny.** Nie jest powiązany z ICM UW ani
> meteo.pl, ani przez nie wspierany. Dane pogodowe są własnością **ICM UW /
> meteo.pl** i pozostają objęte ich prawami autorskimi i regulaminem; add-on
> korzysta z ich **nieoficjalnego API** i jedynie pobiera prognozę dla
> lokalizacji użytkownika, na użytek osobisty. Pełne zastrzeżenia:
> [DISCLAIMER.md](./DISCLAIMER.md). Kod: [MIT](./LICENSE) (nie obejmuje danych).

## Add-ony

### [Meteogram ICM](./icm_meteogram)

Interaktywny meteogram godzinowy z modelu **UM 4 km ICM meteo.pl** (ten sam,
który rysuje meteogramy na meteo.pl): panel w bocznym menu + sensor z seriami
prognozy pod ApexCharts/automatyzacje. Lokalizacja z opcji add-onu albo
automatycznie ze współrzędnych domu w Home Assistant.

**Wszystko wbudowane** — add-on nie wymaga żadnych zewnętrznych serwisów
poza publicznym API meteo.pl. Uwaga: API jest nieoficjalne i odpowiada tylko
z polskich adresów IP.

## Instalacja

1. Ustawienia → Dodatki → Sklep → ⋮ → *Repozytoria* → wklej adres tego repo.
2. Zainstaluj **Meteogram ICM**, uzupełnij opcje (lub zostaw puste = dom z HA).
3. Uruchom — panel „Meteogram ICM" pojawi się w bocznym menu.

## Licencja / dane

Dane pogodowe: © ICM UW, [meteo.pl](https://www.meteo.pl) (nieoficjalne API).
Add-on nie jest powiązany z ICM UW. Szanuj serwery źródła — domyślny
interwał odświeżania (30 min) jest w zupełności wystarczający.
