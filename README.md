# Fantacalcio Auction Helper

Single-page React application pensata per l'asta a chiamata con busta chiusa di **Soze Heaven**.

## Funzioni incluse

- Import del file Excel FantaMaster dal foglio `Tutti`.
- Persistenza locale completa tramite IndexedDB.
- Tier delle squadre Serie A estratte dal distinct dei giocatori importati.
- Preferenze personali per ogni giocatore: mi piace / neutro / evita, Tier 1-3 e scelta pianificata.
- Rollover automatico: i target non presi nelle scelte precedenti restano nel basket delle scelte successive.
- 9 squadre, 500 crediti iniziali, rose 3P / 8D / 8C / 6A.
- Budget live ordinato in modo decrescente, spesa, rosa e budget libero stimato.
- Profili psicologici e squadre tifate modificabili live.
- Algoritmo euristico per papabili avversari e rischio collisione, limitato alle squadre ancora attive nel sottoround.
- Registrazione acquisti con minimo pari alla quotazione FantaMaster.
- Backup e ripristino JSON dell'intero IndexedDB.
- Tema chiaro/scuro.
- Deploy automatico su GitHub Pages tramite GitHub Actions.

## Stato

Prima MVP completa pubblicata su `main`. La GitHub Action verifica la build e pubblica la SPA su GitHub Pages.

## Avvio locale

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Logica dell'algoritmo

Le previsioni non pretendono di conoscere la busta avversaria: ordinano i giocatori probabili combinando forza/quotazione, tier della squadra reale, fase della scelta, budget residuo, tifo e profilo psicologico. Il rischio collisione dei nostri target deriva solo dagli avversari ancora attivi nel sottoround.

L'algoritmo è volutamente isolato in `src/lib/strategy.ts` per poterlo tarare rapidamente durante le prove dell'asta.
