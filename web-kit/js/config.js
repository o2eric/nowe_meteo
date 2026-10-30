/* Ustawienia web-kitu ICM Meteogram.
   dataUrl        — adres danych: dodatek HA z włączonym portem 8099, np. http://192.168.1.10:8099/api/data
                    (do testu bez HA: 'data/sample.json', strona musi być serwowana przez http, nie file://)
   refreshMinutes — co ile minut przeładować stronę (dodatek pobiera nowy bieg co 6 h)
   modelSwitch    — false: model tylko jako napis (przełączanie działa wyłącznie w panelu HA) */
window.ICM_CONFIG = {
  dataUrl: 'data/sample.json',
  refreshMinutes: 30,
  modelSwitch: false
};
