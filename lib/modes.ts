import type { Mode } from "./engine/deck-code";

export interface ModeCopy {
  name: string;
  structure: string;
  rule: string;
  pitch: string;
  how: string[];
  tip: string;
  takeVerb: string;
  putVerb: string;
}

export const MODE_COPY: Record<Mode, ModeCopy> = {
  stack: {
    name: "The Tower",
    structure: "Stack",
    rule: "Last in, first out",
    pitch: "Your last pick hits the pot first.",
    how: [
      "Pick 3–5 numbered cards. Each one is pushed onto the top of the tower.",
      "Pop takes the top card, flips it, and applies it to your pot.",
      "Cash out after any pop. Once per round you can pay a quarter of your wager to peek at the top card.",
    ],
    tip: "Multiplying works in any order, so what matters is which cards come out before you cash out. In a stack, that's the ones you picked last.",
    takeVerb: "Pop",
    putVerb: "push",
  },
  queue: {
    name: "The Conveyor",
    structure: "Queue",
    rule: "First in, first out",
    pitch: "Cards come out in the order you picked them.",
    how: [
      "Pick 3–5 numbered cards. Each one joins the back of the line.",
      "Dequeue takes the front card, flips it, and applies it to your pot.",
      "After each dequeue you may enqueue one more card from the board for a small fee. You get one peek per round.",
    ],
    tip: "In a queue, the cards you picked first come out first. Lead with the backs you trust most, and cash out before the risky ones arrive.",
    takeVerb: "Dequeue",
    putVerb: "enqueue",
  },
  recursion: {
    name: "The Rabbit Hole",
    structure: "Recursion",
    rule: "Calls go down, results come back up",
    pitch: "Dive deeper for more cards, but the stack can overflow.",
    how: [
      "Each call to dive(d) deals three cards. Choose one, and it's stored in that call's frame.",
      "Dive again to go one level deeper, or return to hit the base case.",
      "On return, frames unwind from the deepest up, each applying its card to the result.",
    ],
    tip: "Every level deeper adds 8% overflow risk. An overflow crashes the whole call stack.",
    takeVerb: "Unwind",
    putVerb: "call",
  },
};
