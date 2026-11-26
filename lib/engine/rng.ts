/** Small, fast, seedable PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Independent stream derived from the round seed. Every random decision in a
 * round reads from (seed, stream), so a round is fully reproducible and its
 * state stays serialisable — no hidden RNG position to persist.
 */
export function rngFor(seed: number, stream: number): () => number {
  return mulberry32((seed ^ Math.imul(stream + 1, 0x9e3779b1)) >>> 0);
}

export function newSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0];
}

export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const seedLabel = (seed: number) => seed.toString(16).toUpperCase().padStart(8, "0");
