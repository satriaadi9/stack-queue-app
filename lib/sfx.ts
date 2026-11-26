"use client";

import { useGame } from "./store";

/**
 * Tiny synthesized sound kit — no audio files to load. Kept short and quiet:
 * felt-table clacks and soft tones, not arcade bleeps.
 */
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (useGame.getState().muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(c: AudioContext, dur: number, freq: number, q: number, gain: number, when = 0) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(c.currentTime + when);
}

function tone(c: AudioContext, freq: number, dur: number, gain: number, when = 0, type: OscillatorType = "sine") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + when;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  chip() {
    const c = ac();
    if (!c) return;
    noise(c, 0.05, 3200, 6, 0.35);
    noise(c, 0.04, 2400, 8, 0.25, 0.045);
  },
  place() {
    const c = ac();
    if (!c) return;
    noise(c, 0.09, 900, 1.2, 0.3);
  },
  flip() {
    const c = ac();
    if (!c) return;
    noise(c, 0.12, 1800, 0.8, 0.22);
  },
  good() {
    const c = ac();
    if (!c) return;
    tone(c, 660, 0.25, 0.08);
    tone(c, 990, 0.3, 0.05, 0.06);
  },
  bad() {
    const c = ac();
    if (!c) return;
    tone(c, 220, 0.3, 0.09, 0, "triangle");
  },
  gold() {
    const c = ac();
    if (!c) return;
    [784, 988, 1175, 1568].forEach((f, i) => tone(c, f, 0.6, 0.06, i * 0.07));
  },
  bust() {
    const c = ac();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(180, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(45, c.currentTime + 0.6);
    g.gain.setValueAtTime(0.07, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.65);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.7);
  },
  tick() {
    const c = ac();
    if (!c) return;
    noise(c, 0.025, 4200, 10, 0.18);
  },
  cash() {
    const c = ac();
    if (!c) return;
    for (let i = 0; i < 6; i++) noise(c, 0.04, 2800 + i * 120, 7, 0.22, i * 0.045);
    tone(c, 1320, 0.35, 0.04, 0.28);
  },
};
