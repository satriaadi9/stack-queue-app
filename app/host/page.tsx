"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { useHydrated } from "@/components/Providers";
import { Card } from "@/components/table/Card";
import { Rail } from "@/components/table/Rail";
import { BOARD_SIZE, decodeDeck, encodeDeck, MODES, type DeckPreset, type Mode } from "@/lib/engine/deck-code";
import { formatOp, opToAscii, parseOp, type Op } from "@/lib/engine/ops";
import { drawOp, tierDef, tierOf, TIERS } from "@/lib/engine/pool";
import { mulberry32, newSeed } from "@/lib/engine/rng";
import { MODE_COPY } from "@/lib/modes";
import { useGame } from "@/lib/store";

const emptyDeck = (): DeckPreset => ({
  name: "",
  mode: null,
  slots: Array.from({ length: BOARD_SIZE }, () => null),
  maxPicks: 5,
  shuffle: false,
});

export default function Host() {
  const hydrated = useHydrated();
  const router = useRouter();
  const deckCode = useGame((s) => s.deckCode);
  const setDeck = useGame((s) => s.setDeck);

  const [deck, setDeckState] = useState<DeckPreset>(emptyDeck);
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  // Start from the house deck already in play, if there is one.
  useEffect(() => {
    if (!hydrated) return;
    setOrigin(window.location.origin);
    const existing = deckCode ? decodeDeck(deckCode) : null;
    if (existing) setDeckState(existing);
  }, [hydrated, deckCode]);

  const code = useMemo(() => encodeDeck(deck), [deck]);
  const link = origin ? `${origin}/?deck=${code}` : "";

  useEffect(() => {
    if (!link) return;
    let alive = true;
    QRCode.toDataURL(link, { margin: 1, width: 240, color: { dark: "#1b1b1b", light: "#f4eedf" } })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [link]);

  const setSlot = (i: number, op: Op | null) => {
    setDeckState((d) => ({ ...d, slots: d.slots.map((s, j) => (j === i ? op : s)) }));
    setSelected((i + 1) % BOARD_SIZE);
    setDraft("");
  };

  const draftOp = parseOp(draft);
  const fixed = deck.slots.filter(Boolean).length;

  return (
    <>
      <Rail />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:pt-12">
        <p className="felt-print">For lecturers &amp; event hosts</p>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Host a table</h1>
        <p className="mt-2 max-w-2xl text-card/65">
          Set the cards yourself so every player faces the same deck, which is great for showing how the same cards pay
          differently in a stack and a queue. Slots you leave on <span className="font-mono">?</span> are drawn from the
          gacha pool. Share the link or project the QR code.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="felt-print">Deck name</span>
                <input
                  value={deck.name}
                  maxLength={40}
                  onChange={(e) => setDeckState((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Data Structures, Week 6"
                  className="mt-2 w-full rounded-lg border border-felt-print/25 bg-black/20 px-3 py-2.5 text-card placeholder:text-card/30 focus:border-brass focus:outline-none"
                />
              </label>
              <div>
                <span className="felt-print">Cards per hand</span>
                <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Maximum picks">
                  {[3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={deck.maxPicks === n}
                      onClick={() => setDeckState((d) => ({ ...d, maxPicks: n }))}
                      className={`h-11 w-12 rounded-lg font-sans font-semibold ${
                        deck.maxPicks === n ? "bg-card text-ink" : "bg-black/20 text-card/70 hover:bg-black/30"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <span className="felt-print">Table</span>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Mode">
                {[null, ...MODES].map((m) => (
                  <button
                    key={m ?? "any"}
                    type="button"
                    role="radio"
                    aria-checked={deck.mode === m}
                    onClick={() => setDeckState((d) => ({ ...d, mode: m as Mode | null }))}
                    className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${
                      deck.mode === m ? "bg-card text-ink" : "bg-black/20 text-card/70 hover:bg-black/30"
                    }`}
                  >
                    {m ? `${MODE_COPY[m].structure} only` : "Player chooses"}
                  </button>
                ))}
              </div>
              {deck.mode === "recursion" && (
                <p className="mt-2 text-xs text-card/50">
                  Recursion deals slots 1–3 at depth 1, slots 4–6 at depth 2, and so on, wrapping after depth 4.
                </p>
              )}
            </div>

            <section aria-labelledby="slots-h">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="slots-h" className="felt-print">
                  The 12 slots · {fixed} set, {BOARD_SIZE - fixed} random
                </h2>
                <div className="flex gap-4 text-xs">
                  <button
                    type="button"
                    className="text-card/60 hover:text-card"
                    onClick={() => {
                      const r = mulberry32(newSeed());
                      setDeckState((d) => ({ ...d, slots: d.slots.map(() => drawOp(r)) }));
                    }}
                  >
                    Roll all from pool
                  </button>
                  <button
                    type="button"
                    className="text-card/60 hover:text-card"
                    onClick={() => setDeckState((d) => ({ ...d, slots: d.slots.map(() => null) }))}
                  >
                    Reset to random
                  </button>
                </div>
              </div>

              <div className="mx-auto mt-4 grid w-fit grid-cols-4 gap-3 sm:grid-cols-6 sm:gap-4">
                {deck.slots.map((op, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSelected(i);
                      setDraft(op ? opToAscii(op) : "");
                    }}
                    aria-label={`Slot ${i + 1}: ${op ? formatOp(op) : "random"}`}
                    aria-pressed={selected === i}
                    className={`rounded-[11px] p-0.5 ${selected === i ? "ring-2 ring-brass-hi" : ""}`}
                  >
                    {op ? (
                      <Card card={{ id: `h${i}`, slot: i + 1, op, tier: tierOf(op) }} faceUp layout={false} />
                    ) : (
                      <div className="relative grid h-[80px] w-[58px] place-items-center rounded-[9px] border border-dashed border-felt-print/40 sm:h-[100px] sm:w-[72px]">
                        <span className="font-display text-2xl text-felt-print/50">?</span>
                        <span className="absolute left-[7px] top-[5px] font-mono text-[9px] text-felt-print/50">{i + 1}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-black/20 p-5" aria-labelledby="edit-h">
              <h2 id="edit-h" className="font-display text-xl font-bold">
                Slot {selected + 1}
              </h2>
              <form
                className="mt-3 flex flex-wrap items-center gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draftOp) setSlot(selected, draftOp);
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="x1.5, /2, +2, -3"
                  aria-label="Custom operation"
                  aria-invalid={draft !== "" && !draftOp}
                  className="w-40 rounded-lg border border-felt-print/25 bg-black/20 px-3 py-2.5 font-mono text-card placeholder:text-card/30 focus:border-brass focus:outline-none aria-[invalid=true]:border-loss"
                />
                <button type="submit" disabled={!draftOp} className="plaque">
                  Set {draftOp ? formatOp(draftOp) : ""}
                </button>
                <button type="button" onClick={() => setSlot(selected, null)} className="plaque plaque-ghost">
                  Make random
                </button>
                {draftOp && <span className="text-xs text-card/50">{tierDef(tierOf(draftOp)).label} back</span>}
              </form>
              <p className="mt-4 text-xs text-card/45">Or pick from the pool:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TIERS.flatMap((t) =>
                  t.ops.map((op) => (
                    <button
                      key={`${t.tier}${opToAscii(op)}`}
                      type="button"
                      onClick={() => setSlot(selected, op)}
                      className={`rounded-md px-2.5 py-1.5 font-sans text-sm font-semibold back-${t.back}`}
                      title={t.label}
                    >
                      {formatOp(op)}
                    </button>
                  )),
                )}
              </div>
            </section>

            <label className="flex items-center gap-3 text-sm text-card/80">
              <input
                type="checkbox"
                checked={deck.shuffle}
                onChange={(e) => setDeckState((d) => ({ ...d, shuffle: e.target.checked }))}
                className="size-4 accent-brass"
              />
              Shuffle the card positions every round, so players can&apos;t memorise slot numbers
            </label>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl bg-black/25 p-5">
              <h2 className="felt-print">Share</h2>
              <div className="mt-4 grid place-items-center rounded-xl bg-card p-3">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="QR code for this deck" width={240} height={240} className="size-[240px]" />
                ) : (
                  <div className="size-[240px]" />
                )}
              </div>
              <div className="mt-4 break-all rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-card/70">{link}</div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="plaque flex-1"
                  onClick={() => {
                    void navigator.clipboard?.writeText(link).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    });
                  }}
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  className="plaque plaque-brass flex-1"
                  onClick={() => {
                    setDeck(code);
                    router.push("/");
                  }}
                >
                  Play it here
                </button>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-card/45">
                Everything is in the link, so there&apos;s no account or server. Balances stay on each player&apos;s own device.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
