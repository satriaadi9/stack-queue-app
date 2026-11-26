# Stack & Deal

A casino-table card game for learning **stack**, **queue** and **recursion**. Players wager virtual chips, pick face-down cards holding operations (×20, −21, +5 …), and the data structure decides the order those operations hit the pot. Same cards, different structure, different payout.

- **The Tower (stack, LIFO):** the last card picked is applied first.
- **The Conveyor (queue, FIFO):** cards are applied in the order picked; you can enqueue more mid-round.
- **The Rabbit Hole (recursion):** dive deeper for more cards, risk a stack overflow, and results unwind deepest-first.

After every round, a "what if" panel replays the same cards in the other order, so players can see what the structure was worth.

Hosts (e.g. lecturers) can build a fixed deck at `/host` and share it as a link or QR code. Chips are virtual only and are stored in each player's browser (localStorage). There is no backend.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine unit tests (Vitest)
npm run build && npm run e2e   # browser smoke tests (Playwright, desktop + mobile)
```

The game rules live in `lib/engine/` as pure TypeScript with no React, so they can be unit-tested. Odds and card values are in `lib/engine/pool.ts`.

## Deploy to Vercel

Push the repo to GitHub, then import it at vercel.com/new. No environment variables are needed. Alternatively, run `npx vercel` from this folder.
