// Pepebo — a frog-themed stockpile racing card game (Spite & Malice family).
// Pure functions, no React. The host runs this; guests get a view where
// everything they shouldn't see is replaced by HIDDEN.
//
// Rules:
// - The deck has the numbers 1–12 twelve times, plus 18 wild Pepe cards.
// - Everyone gets a face-down stock pile; only its top card is visible.
//   First to play their whole stock pile wins.
// - In the middle are 4 build piles, each built up in order from 1 to 12.
//   A finished pile (12) is cleared away. Pepes count as any number, but a
//   Pepe can't go on top of another Pepe.
// - On your turn, fill your hand to 5 cards, then play as many cards as you
//   like onto the build piles: from your hand, the top of your stock pile, or
//   the top of one of your 4 discard piles.
// - Play all 5 hand cards and you draw 5 more and carry on.
// - End your turn by discarding one hand card onto one of your discard piles.
// - If the deck runs dry and a whole round passes with nobody able to move,
//   the smallest stock pile wins.

import { BasePlayer } from "@/games/net";

export const WILD = 0;
export const HIDDEN = -1;
export const TOP = 12;
export const HAND_SIZE = 5;
export const PILES = 4;
export const MAX_PLAYERS = 4;
export const STOCK_SIZES = [10, 20, 30];

export interface Player extends BasePlayer {
  /** Stock pile, top card last. */
  stock: number[];
  hand: number[];
  /** Discard piles, top card last. */
  discards: number[][];
}

export type Phase = "lobby" | "playing" | "over";

export interface LogEntry {
  id: number;
  text: string;
}

export interface GameState {
  phase: Phase;
  players: Player[];
  turn: string | null;
  /** Build piles; the pile's value is its length, the next card needed is length + 1. */
  builds: number[][];
  draw: number[];
  /** Cards from finished build piles, reshuffled into the draw pile when it runs out. */
  done: number[];
  stockSize: number;
  winner: string | null;
  /** Turns in a row in which nobody could play or discard anything. */
  idle: number;
  /** Last card played onto a build pile, for highlighting. */
  last: { by: string; to: number } | null;
  log: LogEntry[];
  logSeq: number;
}

export type Source = { from: "hand"; i: number } | { from: "stock" } | { from: "discard"; i: number };

export type Action =
  | { type: "config"; stock: number }
  | { type: "start" }
  | ({ type: "play"; to: number } & Source)
  | { type: "discard"; i: number; to: number }
  | { type: "pass" }
  | { type: "rematch" };

export const newGame = (): GameState => ({
  phase: "lobby",
  players: [],
  turn: null,
  builds: [[], [], [], []],
  draw: [],
  done: [],
  stockSize: 20,
  winner: null,
  idle: 0,
  last: null,
  log: [],
  logSeq: 0,
});

export const cardName = (c: number) => (c === WILD ? "a Pepe" : `a ${c}`);
export const top = (pile: number[]): number | undefined => pile[pile.length - 1];
export const needs = (s: GameState) => s.builds.map((b) => b.length + 1);
/** Can `card` go on a build pile that needs `need` and has `onTop` as its top card? A Pepe can't go on a Pepe. */
export const fits = (card: number, need: number, onTop?: number) => (card === WILD ? onTop !== WILD : card === need);
export const tops = (s: GameState) => s.builds.map((b) => top(b));
export const playerName = (s: GameState, id: string | null) => s.players.find((p) => p.id === id)?.name ?? "?";

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function freshDeck(): number[] {
  const deck: number[] = [];
  for (let n = 1; n <= TOP; n++) for (let k = 0; k < 12; k++) deck.push(n);
  for (let k = 0; k < 18; k++) deck.push(WILD);
  return shuffle(deck);
}

function log(s: GameState, text: string): GameState {
  const entry = { id: s.logSeq + 1, text };
  return { ...s, logSeq: entry.id, log: [...s.log, entry].slice(-40) };
}

const patch = (s: GameState, id: string, f: (p: Player) => Player): GameState => ({
  ...s,
  players: s.players.map((p) => (p.id === id ? f(p) : p)),
});

/** Fill a player's hand up to 5, reshuffling finished piles into the draw pile if needed. */
function refill(s: GameState, id: string): GameState {
  let draw = s.draw;
  let done = s.done;
  const hand = [...s.players.find((p) => p.id === id)!.hand];
  while (hand.length < HAND_SIZE) {
    if (draw.length === 0) {
      if (done.length === 0) break;
      draw = shuffle(done);
      done = [];
    }
    hand.push(draw[draw.length - 1]);
    draw = draw.slice(0, -1);
  }
  hand.sort((a, b) => (a || 99) - (b || 99)); // numbers low to high, Pepes last
  return patch({ ...s, draw, done }, id, (p) => ({ ...p, hand }));
}

function deal(s: GameState): GameState {
  let deck = freshDeck();
  const players = s.players.map((p) => {
    const stock = deck.slice(0, s.stockSize);
    deck = deck.slice(s.stockSize);
    return { ...p, stock, hand: [], discards: [[], [], [], []] };
  });
  const starter = players[Math.floor(Math.random() * players.length)].id;
  const next: GameState = {
    ...s,
    players,
    builds: [[], [], [], []],
    draw: deck,
    done: [],
    phase: "playing",
    turn: starter,
    winner: null,
    idle: 0,
    last: null,
    log: [],
  };
  return refill(log(next, `${playerName(next, starter)} starts.`), starter);
}

export function addPlayer(s: GameState, p: { id: string; name: string; bot: boolean }): GameState {
  if (s.phase !== "lobby") throw new Error("The game has already started.");
  if (s.players.length >= MAX_PLAYERS) throw new Error("The table is full.");
  if (s.players.some((x) => x.id === p.id)) return s;
  return { ...s, players: [...s.players, { ...p, online: true, stock: [], hand: [], discards: [[], [], [], []] }] };
}

export function removePlayer(s: GameState, id: string): GameState {
  if (s.phase !== "lobby") throw new Error("Can only remove players in the lobby.");
  return { ...s, players: s.players.filter((p) => p.id !== id) };
}

function endTurn(s: GameState, pid: string): GameState {
  const i = s.players.findIndex((p) => p.id === pid);
  const next = s.players[(i + 1) % s.players.length].id;
  return refill({ ...s, turn: next }, next);
}

export function apply(s: GameState, pid: string, a: Action): GameState {
  switch (a.type) {
    case "config": {
      if (s.phase !== "lobby") throw new Error("Already started.");
      if (!STOCK_SIZES.includes(a.stock)) throw new Error("Unknown game length.");
      return { ...s, stockSize: a.stock };
    }
    case "start": {
      if (s.phase !== "lobby") throw new Error("Already started.");
      if (s.players.length < 2) throw new Error("Need at least 2 players.");
      return deal(s);
    }
    case "rematch": {
      if (s.phase !== "over") throw new Error("The game isn't over yet.");
      return deal(s);
    }
    case "play": {
      if (s.phase !== "playing" || s.turn !== pid) throw new Error("It's not your turn.");
      const me = s.players.find((p) => p.id === pid)!;
      const build = s.builds[a.to];
      if (!build) throw new Error("No such pile.");
      const src = a.from === "hand" ? me.hand : a.from === "stock" ? me.stock : me.discards[a.i];
      const card = a.from === "hand" ? src?.[a.i] : src && top(src);
      if (card === undefined) throw new Error("There's no card there.");
      const need = build.length + 1;
      if (card === WILD && top(build) === WILD) throw new Error("A Pepe can't go on another Pepe.");
      if (!fits(card, need, top(build))) throw new Error(`That pile needs ${cardName(need)}.`);

      let next = patch(s, pid, (p) => {
        if (a.from === "hand") return { ...p, hand: p.hand.filter((_, i) => i !== a.i) };
        if (a.from === "stock") return { ...p, stock: p.stock.slice(0, -1) };
        return { ...p, discards: p.discards.map((d, i) => (i === a.i ? d.slice(0, -1) : d)) };
      });
      const pile = [...build, card];
      const finished = pile.length === TOP;
      next = {
        ...next,
        builds: next.builds.map((b, i) => (i === a.to ? (finished ? [] : pile) : b)),
        done: finished ? [...next.done, ...pile] : next.done,
        idle: 0,
        last: { by: pid, to: a.to },
      };
      if (a.from === "stock") next = log(next, `${me.name} played ${cardName(need)} from their stock pile.`);
      if (finished) next = log(next, `${me.name} finished a pile.`);

      const after = next.players.find((p) => p.id === pid)!;
      if (after.stock.length === 0) {
        return log({ ...next, phase: "over", winner: pid, turn: null }, `${me.name} wins the game! 👑`);
      }
      if (a.from === "hand" && after.hand.length === 0) {
        next = refill(log(next, `${me.name} played their whole hand and draws again.`), pid);
      }
      return next;
    }
    case "discard": {
      if (s.phase !== "playing" || s.turn !== pid) throw new Error("It's not your turn.");
      const me = s.players.find((p) => p.id === pid)!;
      const card = me.hand[a.i];
      if (card === undefined || !me.discards[a.to]) throw new Error("You can only discard a card from your hand.");
      const next = patch(s, pid, (p) => ({
        ...p,
        hand: p.hand.filter((_, i) => i !== a.i),
        discards: p.discards.map((d, i) => (i === a.to ? [...d, card] : d)),
      }));
      return endTurn({ ...next, idle: 0 }, pid);
    }
    case "pass": {
      if (s.phase !== "playing" || s.turn !== pid) throw new Error("It's not your turn.");
      if (s.players.find((p) => p.id === pid)!.hand.length > 0) throw new Error("Discard a card to end your turn.");
      // The deck has run dry. If a whole round goes by with nobody able to do anything, call it.
      const idle = s.idle + 1;
      if (idle >= s.players.length) {
        const leader = [...s.players].sort((x, y) => x.stock.length - y.stock.length)[0];
        return log(
          { ...s, phase: "over", winner: leader.id, turn: null, idle },
          `Nobody can move. ${leader.name} has the smallest stock pile and wins! 👑`,
        );
      }
      return endTurn({ ...s, idle }, pid);
    }
  }
}

/** What a player may see: their own hand, and only the top card of every stock pile. */
export function viewFor(s: GameState, pid: string): GameState {
  const hide = (cards: number[]) => cards.map(() => HIDDEN);
  return {
    ...s,
    draw: hide(s.draw),
    done: hide(s.done),
    players: s.players.map((p) => ({
      ...p,
      hand: p.id === pid ? p.hand : hide(p.hand),
      stock: p.stock.map((c, i) => (i === p.stock.length - 1 ? c : HIDDEN)),
    })),
  };
}
