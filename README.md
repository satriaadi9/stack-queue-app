# Stack & Deal

A casino-table card game for learning **stack**, **queue** and **recursion**. Players wager virtual chips, pick face-down cards holding operations (×1.5, ÷2, +2 …), and the data structure decides the order those operations hit the pot. Same cards, different structure, different payout.

- **The Tower (stack, LIFO):** the last card picked is applied first.
- **The Conveyor (queue, FIFO):** cards are applied in the order picked; you can enqueue more mid-round.
- **The Rabbit Hole (recursion):** dive deeper for more cards, risk a stack overflow, and results unwind deepest-first.
- **Surprise me:** the house draws one of the three tables at random.

After every round, a "what if" panel replays the cards you took in the other order, so players can see what the structure was worth. Cards you didn't open are turned face up, showing what continuing would have done.

Chips are virtual only and are stored in each player's browser (localStorage). There is no backend.

## How a round works

The lobby walks through four short steps:

1. **Table:** stack, queue, recursion, or a random one.
2. **Clock & fee:** time to pick cards and time to open them (Relaxed 30/60s, Standard 20/30s, Blitz 10/15s, off, or custom). When the pick clock runs out, random cards are picked for you; when the open clock runs out, you cash out at the current pot. Every round also pays a **10% admin fee** (at least 1 chip) on top of the wager.
3. **Wager:** chips of 10 / 50 / 100 / 250 / all in, or any typed amount you can afford with the fee.
4. **Luck (optional):** buy one charm that tilts the odds of the face-down cards for that round.

| Charm | Effect | Price |
|---|---|---|
| Steady hand | Half the epic, gold and cursed cards: smaller swings, fewer busts | 2% of wager |
| Teal charm | Rare cards 25% → 45% | 5% |
| Ward | No cursed cards, so every gold back is ×3 | 8% |
| Oxblood charm | Epic cards 13% → 25% | 10% |
| Gold charm | Legendary ×3 cards 5% → 15% | 40% |

Charms only take odds from common cards and only affect randomly drawn cards, never ones a host set. Like the admin fee, each price was set by simulating 100k rounds: a charm costs about what it adds to a typical round, so it buys a better shot at a big win, not a free edge. The numbers are in `lib/engine/charms.ts`.

Each round allows one **peek** (25% of the wager). Wager, fee and charm leave the balance when the round starts, so reloading the page can't dodge a bust.

## Players on a device

- Players sign in with three-letter initials. Several players can share one device, and the **Regulars** page ranks them.
- New players start with **1,000 chips** by default. On the home page you can change this to 500, 2,500, 5,000, 10,000 or any amount from 10 to 1,000,000. Existing players keep their chips.
- **Reset all players** on the home page deletes every player, with their chips and records, after a confirmation. Settings are kept.
- A player who runs out can take a 500-chip house loan, which shows on the leaderboard.

## Hosting a table

Hosts (e.g. lecturers) can build a deck at `/host` and share it as a link or QR code. A deck can set:

- any of the 12 card slots (others are drawn at random), and whether positions are shuffled each round
- the table (or let players choose, or random each round) and cards per hand
- the admin fee, the clock, and the **starting chips** for new players at that table

Everything is encoded in the link itself, so there is no account or server.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine and store unit tests (Vitest)
npm run build && npm run e2e   # browser smoke tests (Playwright, desktop + mobile)
```

The game rules live in `lib/engine/` as pure TypeScript with no React, so they can be unit-tested. Card values and odds are in `lib/engine/pool.ts`, fee and clocks in `lib/engine/rules.ts`, charms in `lib/engine/charms.ts`.

## Deploy to Vercel

Push the repo to GitHub, then import it at vercel.com/new. No environment variables are needed. Alternatively, run `npx vercel` from this folder.

---

© 2026 Stack & Deal · Created by [satriaadi9](https://github.com/satriaadi9)
