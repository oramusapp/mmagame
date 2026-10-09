# 🥊 FIGHT CAMP – MMA Game

Twój tygodniowy plan treningowy MMA jako gra. Zadania, dziennik treningu, rywal tygodnia do znokautowania, XP, pasy, odznaki i sklep z nagrodami.

Aplikacja jest w 100% statyczna (HTML + CSS + JS, bez builda i bez backendu). Dane trzyma w przeglądarce (`localStorage`), działa offline i można ją zainstalować na telefonie jako aplikację (PWA).

## Jak uruchomić

- **Lokalnie:** w katalogu repo `python3 -m http.server 8000`, potem otwórz `http://localhost:8000`.
- **GitHub Pages:** *Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`*. Aplikacja będzie pod `https://<użytkownik>.github.io/mmagame/`.
- **Na telefonie:** otwórz stronę i wybierz „Dodaj do ekranu głównego”.

## Mechanika gry

| Element | Jak działa |
|---|---|
| 📋 **Karta walki** | Codzienny plan z arkusza (MMA pn/śr/pt, Siła A wt, Siła B czw, sprinty + kickboxing sob, niedziela odpoczynek i kościół). Odhaczasz punkty i dostajesz XP. |
| ⭐ **Main Event** | Priorytety: trening MMA i praca w domu (TRW) do 19:00. Dają więcej XP i odblokowują Torbę Trenera. |
| 🔥 **Warm-up Protocol** | Interaktywna checklista: przeskoki dostawne, stepy + rotacja bioder, naprzemiennie nogi, walka z cieniem, drabinka, Beterbiev pushups (+ mobility przed i po). |
| 🥊 **Rywal tygodnia** | Co tydzień nowy komiczny przeciwnik (Kanapa Kowalski, Scrollator 3000, Pizza Pete…). Każdy punkt XP to cios. KO przed końcem niedzieli = wygrana w rekordzie, inaczej porażka. |
| 🔥 **Seria i combo** | Aktywność dzień po dniu podbija mnożnik XP (do x1.5). |
| 🎒 **Torba Trenera** | Losowa nagroda za perfekcyjny dzień (monety, XP, jackpot albo rzadki awatar). |
| ✅ **Zadania** | Dodawanie, kategorie, termin, priorytet (Main Event), odhaczanie, edycja. Odznaczenie cofa XP. |
| 📓 **Dziennik** | Trening z serią × powtórzenia × kg (lista ćwiczeń z planu wczytuje się sama), RPE, samopoczucie, notatki. Podpowiedź „ostatnio”, wykrywanie rekordów (PR = bonus XP), wykres progresu, mapa aktywności z 12 tygodni. |
| ⏱️ **Zegar rund** | Timer MMA/boks/tabata z gongiem i sygnałem 10 s przed końcem rundy. Każda runda daje XP. |
| 🥋 **Zawodnik** | Karta zawodnika z OVR i statystykami (Siła, Kondycja, Technika, Dyscyplina), pasy od Świeżaka do GOAT, historia walk, ważenie. |
| 🛍️ **Sklep** | Monety wydajesz na awatary, tytuły i **własne nagrody z prawdziwego życia** (np. cheat meal). |
| 📜 **Kodeks** | Twoje zasady. Codziennie jedna z nich pokazuje się na Arenie. |

Plan tygodnia, listy ćwiczeń i zasady można edytować w aplikacji (Zawodnik → ⚙️). Dane można wyeksportować do pliku JSON i zaimportować na innym urządzeniu.

## Pliki

- `index.html` – szkielet aplikacji
- `style.css` – wygląd
- `app.js` – cała logika gry
- `sw.js`, `manifest.webmanifest`, `icons/` – tryb offline i instalacja jako aplikacja
