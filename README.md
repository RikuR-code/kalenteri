# Keräävä tapahtumakalenteri

React/Vite-pohjainen ensimmäinen versio webäpistä, joka näyttää kuukausikalenterin, päivän tapahtumat ja hallitsee tapahtumalähteitä.

## Ajaminen

Asenna riippuvuudet ja käynnistä kehityspalvelin:

```powershell
npm install
npm run dev
```

Sovellus tallentaa lähteet ja tapahtumat selaimen `localStorage`-muistiin.

## Nykyiset ominaisuudet

- Kuukausikalenteri
- Päivän tapahtumalista
- Käsin lisättävät tapahtumat
- Tapahtumalähteiden tallennus
- RSS/Atom- ja ICS-lähteiden selaintuonti silloin, kun lähde sallii CORS-lukemisen
- Duplikaattien kevyt poisto tuonnissa

## Seuraava järkevä askel

Oikea eri sivustojen keruu kannattaa tehdä backendissä:

- selain törmää CORS-rajoituksiin monilla sivustoilla
- HTML-sivujen rakenne vaihtelee ja vaatii lähdekohtaisia parsereita
- ajastettu päivitys vaatii palvelinpuolen cronin tai job-jonon
- Android-versio hyötyy samasta API:sta kuin web

Suositeltu seuraava pino:

- Frontend: React + Vite
- Mobile wrapper: Capacitor
- Backend: Node/Fastify tai Python/FastAPI
- Tietokanta: SQLite alussa, myöhemmin PostgreSQL
- Tuontiformaatit ensin: ICS, RSS/Atom, sen jälkeen sivustokohtaiset HTML-parserit
