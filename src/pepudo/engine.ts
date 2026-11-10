// Pepudo game engine — pure functions, no React. The host runs this; guests
// only ever see a sanitized view (their own dice, everyone's dice counts).
//
// Rules (classic Perudo/Dudo, without palifico):
// - Everyone starts with 5 dice, rolled in secret each round.
// - 1s (the Pepe face) are wild and count towards any other face.
// - On your turn: raise the bid, call "Dudo" (doubt) or "Calza" (spot on).
// - Raise = more dice of any face, or the same amount of a higher face.
//   Switching to Pepes: at least half the amount (rounded up).
//   Switching away from Pepes: at least double + 1.
//   You can't open a round on Pepes.
// - Dudo: if there are fewer than bid, the bidder loses a die, otherwise the caller.
// - Calza: if exactly right, the caller wins a die back (max 5), otherwise loses one.
// - The player who lost (or won) the die starts the next round. Last one standing wins.

export const MAX_DICE = 5;
export const MAX_PLAYERS = 8;

export interface Bid {
  qty: number;
  face: number;
  by: string;
}

export interface Player {
  id: string;
  name: string;
  dice: number[];
  count: number;
  bot: boolean;
  online: boolean;
}

export type Phase = "lobby" | "bidding" | "reveal" | "over";

export interface Reveal {
  kind: "dudo" | "calza";
  caller: string;
  bid: Bid;
  actual: number;
  loser: string | null;
  gainer: string | null;
  dice: Record<string, number[]>;
}

export interface LogEntry {
  id: number;
  text: string;
}

export interface GameState {
  phase: Phase;
  players: Player[];
  turn: string | null;
  bid: Bid | null;
  round: number;
  reveal: Reveal | null;
  winner: string | null;
  nextStarter: string | null;
  log: LogEntry[];
  logSeq: number;
}

export type Action =
  | { type: "bid"; qty: number; face: number }
  | { type: "dudo" }
  | { type: "calza" }
  | { type: "next" }
  | { type: "start" }
  | { type: "rematch" };

export const newGame = (): GameState => ({
  phase: "lobby",
  players: [],
  turn: null,
  bid: null,
  round: 0,
  reveal: null,
  winner: null,
  nextStarter: null,
  log: [],
  logSeq: 0,
});

const roll = () => 1 + Math.floor(Math.random() * 6);

export const faceName = (face: number, qty = 2) =>
  face === 1 ? (qty === 1 ? "Pepe" : "Pepes") : `${face}${qty === 1 ? "" : "s"}`;

export const bidText = (b: { qty: number; face: number }) => `${b.qty} × ${faceName(b.face, b.qty)}`;

export const alive = (s: GameState) => s.players.filter((p) => p.count > 0);

export const totalDice = (s: GameState) => alive(s).reduce((n, p) => n + p.count, 0);

export const playerName = (s: GameState, id: string | null) =>
  s.players.find((p) => p.id === id)?.name ?? "?";

/** Minimal quantity allowed for `face` given the current bid, or null if not allowed. */
export function minQty(prev: Bid | null, face: number): number | null {
  if (!prev) return face === 1 ? null : 1;
  if (prev.face !== 1) {
    if (face === 1) return Math.ceil(prev.qty / 2);
    return face > prev.face ? prev.qty : prev.qty + 1;
  }
  return face === 1 ? prev.qty + 1 : prev.qty * 2 + 1;
}

export function isValidBid(prev: Bid | null, qty: number, face: number, total: number) {
  if (!Number.isInteger(qty) || !Number.isInteger(face)) return false;
  if (face < 1 || face > 6 || qty < 1 || qty > total) return false;
  const min = minQty(prev, face);
  return min !== null && qty >= min;
}

export const countFace = (dice: number[], face: number) =>
  dice.filter((d) => d === face || (face !== 1 && d === 1)).length;

function nextAliveAfter(s: GameState, id: string): string | null {
  const n = s.players.length;
  const start = s.players.findIndex((p) => p.id === id);
  for (let i = 1; i <= n; i++) {
    const p = s.players[(start + i + n) % n];
    if (p.count > 0) return p.id;
  }
  return null;
}

function log(s: GameState, text: string): GameState {
  const entry = { id: s.logSeq + 1, text };
  return { ...s, logSeq: entry.id, log: [...s.log, entry].slice(-40) };
}

function startRound(s: GameState, starter: string): GameState {
  const players = s.players.map((p) => ({
    ...p,
    dice: Array.from({ length: p.count }, roll).sort((a, b) => a - b),
  }));
  const round = s.round + 1;
  return log(
    { ...s, players, phase: "bidding", turn: starter, bid: null, reveal: null, round, nextStarter: null },
    `Round ${round} — ${playerName(s, starter)} starts.`,
  );
}

function freshStart(s: GameState): GameState {
  const players = s.players.map((p) => ({ ...p, count: MAX_DICE, dice: [] }));
  const starter = players[Math.floor(Math.random() * players.length)].id;
  return startRound({ ...s, players, round: 0, winner: null, log: [] }, starter);
}

export function addPlayer(s: GameState, p: { id: string; name: string; bot: boolean }): GameState {
  if (s.phase !== "lobby") throw new Error("The game has already started.");
  if (s.players.length >= MAX_PLAYERS) throw new Error("The table is full.");
  if (s.players.some((x) => x.id === p.id)) return s;
  return { ...s, players: [...s.players, { ...p, dice: [], count: MAX_DICE, online: true }] };
}

export function removePlayer(s: GameState, id: string): GameState {
  if (s.phase !== "lobby") throw new Error("Can only remove players in the lobby.");
  return { ...s, players: s.players.filter((p) => p.id !== id) };
}

export function setOnline(s: GameState, id: string, online: boolean, name?: string): GameState {
  return {
    ...s,
    players: s.players.map((p) => (p.id === id ? { ...p, online, name: name ?? p.name } : p)),
  };
}

export function apply(s: GameState, pid: string, a: Action): GameState {
  switch (a.type) {
    case "start": {
      if (s.phase !== "lobby") throw new Error("Already started.");
      if (s.players.length < 2) throw new Error("Need at least 2 players.");
      return freshStart(s);
    }
    case "rematch": {
      if (s.phase !== "over") throw new Error("The game isn't over yet.");
      return freshStart(s);
    }
    case "next": {
      if (s.phase !== "reveal") throw new Error("Nothing to continue.");
      return startRound(s, s.nextStarter ?? alive(s)[0].id);
    }
    case "bid": {
      if (s.phase !== "bidding" || s.turn !== pid) throw new Error("It's not your turn.");
      if (!isValidBid(s.bid, a.qty, a.face, totalDice(s))) throw new Error("That bid isn't high enough.");
      const bid = { qty: a.qty, face: a.face, by: pid };
      const next = nextAliveAfter(s, pid);
      return log({ ...s, bid, turn: next }, `${playerName(s, pid)} bids ${bidText(bid)}.`);
    }
    case "dudo":
    case "calza": {
      if (s.phase !== "bidding" || s.turn !== pid) throw new Error("It's not your turn.");
      const bid = s.bid;
      if (!bid) throw new Error("There's no bid to call yet.");
      const actual = s.players.reduce((n, p) => n + countFace(p.dice, bid.face), 0);
      const dice: Record<string, number[]> = {};
      s.players.forEach((p) => (dice[p.id] = p.dice));

      let loser: string | null = null;
      let gainer: string | null = null;
      if (a.type === "dudo") loser = actual >= bid.qty ? pid : bid.by;
      else if (actual === bid.qty) gainer = pid;
      else loser = pid;

      const players = s.players.map((p) => {
        if (p.id === loser) return { ...p, count: p.count - 1 };
        if (p.id === gainer) return { ...p, count: Math.min(MAX_DICE, p.count + 1) };
        return p;
      });
      let next: GameState = {
        ...s,
        players,
        turn: null,
        phase: "reveal",
        reveal: { kind: a.type, caller: pid, bid, actual, loser, gainer, dice },
      };

      const callerName = playerName(s, pid);
      const call = a.type === "dudo" ? "Dudo" : "Calza";
      const outcome = loser
        ? `${playerName(s, loser)} loses a die.`
        : `${playerName(s, gainer)} wins a die${players.find((p) => p.id === gainer)!.count === s.players.find((p) => p.id === gainer)!.count ? " (already at 5)" : ""}.`;
      next = log(next, `${callerName} calls ${call} on ${bidText(bid)} — there were ${actual}. ${outcome}`);

      const focus = (loser ?? gainer)!;
      const focusPlayer = players.find((p) => p.id === focus)!;
      if (loser && focusPlayer.count === 0) next = log(next, `${focusPlayer.name} is out! 🐸`);
      next.nextStarter = focusPlayer.count > 0 ? focus : nextAliveAfter(next, focus);

      const left = alive(next);
      if (left.length === 1) {
        next = log({ ...next, phase: "over", winner: left[0].id }, `${left[0].name} wins the game! 👑`);
      }
      return next;
    }
  }
}

/** What a given player is allowed to see: only their own dice until the reveal. */
export function viewFor(s: GameState, pid: string): GameState {
  return {
    ...s,
    players: s.players.map((p) => (p.id === pid ? p : { ...p, dice: [] })),
  };
}
