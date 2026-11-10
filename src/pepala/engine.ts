// Pepala — mancala (the Kalah rules) with frog eggs for stones and a frog at each end.
// Pure functions, no React. The host runs this; nothing is hidden, so every
// player sees the whole board.
//
// Board: 14 holes. 0–5 are the first player's pits and 6 their store (frog);
// 7–12 are the second player's pits and 13 their store. Eggs move upwards
// (counter-clockwise), round and round, skipping the other player's store.
//
// Rules:
// - Every pit starts with 4 eggs (the host can pick 3, 4 or 5).
// - On your turn, scoop up all the eggs from one of your pits and drop them one
//   by one into the following holes, your own store included.
// - Last egg in your store: you go again.
// - Last egg in an empty pit on your side, with eggs opposite: your frog gulps
//   both that egg and everything opposite.
// - When one side has no eggs left, the other player puts all their remaining
//   eggs in their own store. Most eggs in your store wins.

import { BasePlayer } from "@/games/net";

export const PITS = 6;
export const STORE = [6, 13];
export const MAX_PLAYERS = 2;
export const EGG_OPTIONS = [3, 4, 5];

export type Phase = "lobby" | "playing" | "over";

/** One move, as played out on both screens. */
export interface Anim {
  seq: number;
  seat: number;
  from: number;
  /** Board before the move. */
  before: number[];
  /** Every hole an egg was dropped in, in order. */
  path: number[];
  /** Last egg landed in an empty pit of the mover with eggs opposite. */
  capture: { pit: number; opposite: number; eggs: number } | null;
  again: boolean;
  /** The game ended: leftover eggs went to their owners' stores. */
  sweep: boolean;
  /** Last log entry from before this move, so the screens can hold back news until it has played out. */
  logFrom: number;
}

export interface LogEntry {
  id: number;
  text: string;
}

export interface GameState {
  phase: Phase;
  players: BasePlayer[];
  eggs: number;
  pits: number[];
  /** Seat (0 or 1) to move. */
  seat: number;
  /** Who opened the last game, so a rematch swaps it. */
  opener: number;
  anim: Anim | null;
  /** Seat index of the winner, -1 for a draw, null while playing. */
  winner: number | null;
  log: LogEntry[];
  logSeq: number;
}

export type Action = { type: "config"; eggs: number } | { type: "start" } | { type: "sow"; pit: number } | { type: "rematch" };

export const newGame = (): GameState => ({
  phase: "lobby",
  players: [],
  eggs: 4,
  pits: Array(14).fill(0),
  seat: 0,
  opener: 0,
  anim: null,
  winner: null,
  log: [],
  logSeq: 0,
});

// ---------------------------------------------------------------- helpers

export const ownPits = (seat: number) => Array.from({ length: PITS }, (_, i) => seat * 7 + i);
export const isOwnPit = (seat: number, hole: number) => hole >= seat * 7 && hole < seat * 7 + PITS;
export const opposite = (hole: number) => 12 - hole;
export const seatOf = (s: GameState, pid: string) => s.players.findIndex((p) => p.id === pid);

function log(s: GameState, text: string): GameState {
  const entry = { id: s.logSeq + 1, text };
  return { ...s, logSeq: entry.id, log: [...s.log, entry].slice(-40) };
}

export interface SowResult {
  pits: number[];
  path: number[];
  capture: Anim["capture"];
  again: boolean;
  sweep: boolean;
  over: boolean;
}

/** Plays pit `from` for `seat` on board `pits`. Doesn't check that the move is allowed. */
export function sow(pits: number[], seat: number, from: number): SowResult {
  const b = [...pits];
  let hand = b[from];
  b[from] = 0;
  const skip = STORE[1 - seat];
  const path: number[] = [];
  let at = from;
  while (hand > 0) {
    at = (at + 1) % 14;
    if (at === skip) continue;
    b[at]++;
    hand--;
    path.push(at);
  }
  let capture: Anim["capture"] = null;
  if (isOwnPit(seat, at) && b[at] === 1 && b[opposite(at)] > 0) {
    const eggs = b[at] + b[opposite(at)];
    capture = { pit: at, opposite: opposite(at), eggs };
    b[STORE[seat]] += eggs;
    b[at] = 0;
    b[opposite(at)] = 0;
  }
  const again = at === STORE[seat];
  const empty = (side: number) => ownPits(side).every((i) => b[i] === 0);
  const over = empty(0) || empty(1);
  let sweep = false;
  if (over) {
    for (const side of [0, 1]) {
      for (const i of ownPits(side)) {
        if (b[i]) sweep = true;
        b[STORE[side]] += b[i];
        b[i] = 0;
      }
    }
  }
  return { pits: b, path, capture, again: again && !over, sweep, over };
}

// ---------------------------------------------------------------- animation timing (shared with the screens)

export const PICK_MS = 450;
export const CAPTURE_MS = 1100;
export const SWEEP_MS = 900;
export const stepMs = (n: number) => Math.max(150, Math.min(340, 3000 / Math.max(1, n)));

/** How long a move takes to play out on screen. */
export function animMs(a: Anim | null): number {
  if (!a) return 0;
  return PICK_MS + a.path.length * stepMs(a.path.length) + (a.capture ? CAPTURE_MS : 0) + (a.sweep ? SWEEP_MS : 0) + 250;
}

// ---------------------------------------------------------------- moves

function startGame(s: GameState, opener: number): GameState {
  const pits = Array.from({ length: 14 }, (_, i) => (STORE.includes(i) ? 0 : s.eggs));
  const next: GameState = { ...s, phase: "playing", pits, seat: opener, opener, winner: null, log: [] };
  return log(next, `${s.players[opener].name} goes first.`);
}

export function addPlayer(s: GameState, p: { id: string; name: string; bot: boolean }): GameState {
  if (s.phase !== "lobby") throw new Error("The game has already started.");
  if (s.players.length >= MAX_PLAYERS) throw new Error("Pepala is for two players.");
  if (s.players.some((x) => x.id === p.id)) return s;
  return { ...s, players: [...s.players, { ...p, online: true }] };
}

export function removePlayer(s: GameState, id: string): GameState {
  if (s.phase !== "lobby") throw new Error("Can only remove players in the lobby.");
  return { ...s, players: s.players.filter((p) => p.id !== id) };
}

export function apply(s: GameState, pid: string, a: Action): GameState {
  switch (a.type) {
    case "config": {
      if (s.phase !== "lobby") throw new Error("Already started.");
      if (!EGG_OPTIONS.includes(a.eggs)) throw new Error("Unknown setting.");
      return { ...s, eggs: a.eggs };
    }
    case "start": {
      if (s.phase !== "lobby") throw new Error("Already started.");
      if (s.players.length !== 2) throw new Error("Need two players.");
      return startGame(s, Math.random() < 0.5 ? 0 : 1);
    }
    case "rematch": {
      if (s.phase !== "over") throw new Error("The game isn't over yet.");
      return startGame(s, 1 - s.opener);
    }
    case "sow": {
      const seat = seatOf(s, pid);
      if (s.phase !== "playing" || seat !== s.seat) throw new Error("It's not your turn.");
      if (!isOwnPit(seat, a.pit)) throw new Error("That's not your pit.");
      if (s.pits[a.pit] === 0) throw new Error("That pit is empty.");

      const r = sow(s.pits, seat, a.pit);
      const name = s.players[seat].name;
      const anim: Anim = {
        seq: (s.anim?.seq ?? 0) + 1,
        seat,
        from: a.pit,
        before: s.pits,
        path: r.path,
        capture: r.capture,
        again: r.again,
        sweep: r.sweep,
        logFrom: s.logSeq,
      };
      let next: GameState = { ...s, pits: r.pits, anim, seat: r.again ? seat : 1 - seat };
      if (r.capture) next = log(next, `${name}'s frog gulps ${r.capture.eggs} eggs! 🐸`);
      if (r.again) next = log(next, `${name} lands in their frog and goes again.`);
      if (r.over) {
        const [a0, a1] = [r.pits[STORE[0]], r.pits[STORE[1]]];
        const winner = a0 === a1 ? -1 : a0 > a1 ? 0 : 1;
        next = { ...next, phase: "over", winner };
        next = log(next, winner < 0 ? `It's a draw, ${a0}–${a1}.` : `${s.players[winner].name} wins ${Math.max(a0, a1)}–${Math.min(a0, a1)}! 👑`);
      }
      return next;
    }
  }
}

export const viewFor = (s: GameState): GameState => s;
export const toMove = (s: GameState): string | null => (s.phase === "playing" ? (s.players[s.seat]?.id ?? null) : null);
