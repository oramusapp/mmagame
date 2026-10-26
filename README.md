# SDCA · thenotoriousg

Aplikacja webowa do prowadzenia systemu wyceny **SDCA** opartego na Z-score wskaźników. Działa na wzór arkusza **„SDCA v2”** z pliku `thenotoriousg - SDCA - aktualny do pracy.xlsx`. Pozostałe arkusze uzupełniają opisy wskaźników, ich historię i bazę linków. **„Submission Checklist”** jest osobną zakładką.

Aplikacja jest w pełni statyczna (HTML + CSS + JS, bez builda i bez backendu). Działa offline i można ją zainstalować jako PWA.

## Funkcje

- **Logowanie hasłem przy każdym wejściu.** Hasła nie ma w kodzie. Dane z Excela są zaszyfrowane (`seed.enc.js`, PBKDF2-SHA256 + AES-GCM 256) i odszyfrowują się dopiero po wpisaniu poprawnego hasła. Twoje zmiany zapisują się w przeglądarce, też zaszyfrowane.
- **SDCA:** tabele Fundamental / Technical / Sentiment z kolumnami jak w arkuszu (Indicator, Result, Z Score, Provided by, Source oraz opisy Why / How / Positive & Negative Score).
  - Edycja Z-score: wpisanie wartości albo przyciski − / +.
  - Dodawanie, usuwanie i zmiana kolejności wskaźników.
  - **Avg Z Score**, **Market Value Z-score** (× −1), liczniki wymagań (15 / 5 / 5 / 2, Adam ≤ 5).
  - „Date updated”, eksport do CSV.
- **System wyceny (formuła z Excela):**
  `=IFS(Z<=-1.5,"No Value", AND(Z<0,Z>-1.5),"Low Value", Z=0,"Neutral", AND(0<Z,Z<1.5),"Value", Z>=1.5,"High Value")`
- **Wykres i aktualizacje (Forward Testing):** zapis bieżącego stanu jako aktualizacji, wykres Market Value Z-score / Avg Z w czasie, edycja, dodawanie ręczne i usuwanie wpisów z listy aktualizacji.
- **Baza linków:** wszystkie strony ze wskaźnikami i materiały z arkuszy. Wyszukiwarka, kategorie, lista szybkiego otwierania, dodawanie, edycja i usuwanie. Przy wskaźniku można wybrać źródło z tej listy.
- **Baza wskaźników:** wszystkie wskaźniki ze wszystkich arkuszy, z opisami i historią Z-score. Wskaźnik dodajesz do SDCA lub usuwasz z niego jednym kliknięciem.
- **Checklista** (Submission Checklist): statusy Complete / Agree i SUBMISSION STATUS (READY / NOT READY) liczony tak jak w Excelu, plus automatyczne podpowiedzi z danych.
- **Ustawienia:** motyw jasny / ciemny, eksport i import JSON, przywrócenie danych z Excela, blokada.

## Uruchomienie

- **GitHub Pages:** *Settings → Pages → Deploy from a branch → `main` / `(root)`*. Szyfrowanie wymaga HTTPS, a Pages je zapewnia.
- **Lokalnie:** `python3 -m http.server 8000`, potem `http://localhost:8000`.

## Aktualizacja danych z nowego pliku Excel

```bash
python3 -I tools/xlsx_to_seed.py "plik.xlsx" tools/seed.json
SDCA_PASSWORD='…' node tools/encrypt_seed.mjs tools/seed.json seed.enc.js
rm tools/seed.json   # niezaszyfrowanej wersji nie commituj
```

Nowe dane startowe są używane przy pierwszym wejściu albo po „Przywróć dane z Excela” w Ustawieniach.

## Pliki

- `index.html`, `style.css`, `app.js`: aplikacja
- `seed.enc.js`: zaszyfrowane dane z arkusza
- `tools/`: konwersja .xlsx → JSON i szyfrowanie
- `sw.js`, `manifest.webmanifest`, `icons/`: tryb offline i instalacja

---

© thenotoriousg. All rights reserved. Credits: The Real World · Prof Adam · Crypto Investing Campus
