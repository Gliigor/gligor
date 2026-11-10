// Pepe 7 — a push-your-luck card game where the 7 is a Pepe.
// Pure functions, no React. The host runs this; guests get a view without the
// order of the draw pile.
//
// Rules (the Flip 7 family):
// - 94 cards: number cards 0–12 where there are as many copies of a number as
//   its value (twelve 12s … one 1) plus a single 0; one each of +2, +4, +6, +8,
//   +10 and ×2; three each of Freeze, Flip Three and Second Chance.
// - The dealer gives everyone one card face up, then going round the table each
//   player still in chooses Hit (take one more card) or Stay (bank this round).
// - Take a number you already have and you bust: 0 points this round.
// - Collect 7 different numbers ("Pepe 7") and the round ends at once, +15.
// - Score: add your numbers, double that with ×2, then add the + cards.
// - Freeze: give it to any player still in (yourself too). They bank their
//   points and are out of the round.
// - Flip Three: give it to any player still in. They must take the next 3
//   cards one at a time. Action cards drawn meanwhile wait until the three are
//   done (they're lost if that player busts or makes Pepe 7). A Second Chance
//   is kept straight away.
// - Second Chance: keep it; it cancels one bust (both cards are thrown away).
//   You can hold only one; a second one goes to another player still in who
//   has none, or is thrown away.
// - Action cards in the opening deal are resolved on the spot.
// - Cards go to a discard pile after each round; it is reshuffled when the
//   draw pile runs out. The dealer moves one seat each round.
// - When someone has reached the goal (200) at the end of a round, the highest
//   total wins. A tie at the top means one more round.

import { BasePlayer } from "@/games/net";

export const MAX_PLAYERS = 6;
export const GOAL_OPTIONS = [100, 200, 300];
export const SET_SIZE = 7;
export const BONUS = 15;

export type Modifier = "+2" | "+4" | "+6" | "+8" | "+10" | "x2";
export type ActionCard = "freeze" | "flip3" | "chance";
export type Card = number | Modifier | ActionCard;

export const MODIFIERS: Modifier[] = ["+2", "+4", "+6", "+8", "+10", "x2"];
export const ACTIONS: ActionCard[] = ["freeze", "flip3", "chance"];

export const isNumber = (c: Card): c is number => typeof c === "number";
export const isModifier = (c: Card): c is Modifier => (MODIFIERS as Card[]).includes(c);
export const isAction = (c: Card): c is ActionCard => (ACTIONS as Card[]).includes(c);

export type Status = "in" | "stayed" | "frozen" | "bust" | "pepe7";

export interface Player extends BasePlayer {
  /** Number cards in front of the player this round, in the order taken. */
  nums: number[];
  mods: Modifier[];
  /** Holding a Second Chance. */
  chance: boolean;
  status: Status;
  /** The duplicate that busted them, for showing. */
  bustCard: number | null;
  total: number;
  /** Points from the round that just ended (shown between rounds). */
  last: number | null;
}

/** Something that has to be sorted out before play goes on. */
export type Task =
  | { k: "choose"; card: ActionCard; by: string }
  | { k: "flip"; target: string; left: number; held: ActionCard[] };

export type Phase = "lobby" | "playing" | "roundEnd" | "over";

export interface LogEntry {
  id: number;
  text: string;
}

export interface GameState {
  phase: Phase;
  players: Player[];
  goal: number;
  round: number;
  dealer: number;
  /** Seat order still waiting for their opening card. */
  dealing: string[];
  /** Whose Hit/Stay it is. */
  turn: string | null;
  /** True once `turn` has hit or stayed and play should move on. */
  advance: boolean;
  tasks: Task[];
  draw: Card[];
  discard: Card[];
  /** Cards in the draw pile; kept so guests can see it without seeing the cards. */
  deckLeft: number;
  /** Last card taken, for highlighting. */
  flash: { pid: string; seq: number; card: Card } | null;
  winner: string | null;
  log: LogEntry[];
  logSeq: number;
}

export type Action =
  | { type: "config"; goal: number }
  | { type: "start" }
  | { type: "hit" }
  | { type: "stay" }
  | { type: "target"; to: string }
  | { type: "next" }
  | { type: "rematch" };

export const newGame = (): GameState => ({
  phase: "lobby",
  players: [],
  goal: 200,
  round: 0,
  dealer: 0,
  dealing: [],
  turn: null,
  advance: false,
  tasks: [],
  draw: [],
  discard: [],
  deckLeft: 0,
  flash: null,
  winner: null,
  log: [],
  logSeq: 0,
});

// ---------------------------------------------------------------- helpers

export const playerName = (s: GameState, id: string | null) => s.players.find((p) => p.id === id)?.name ?? "?";
export const isIn = (p: Player) => p.status === "in";

export const actionLabel: Record<ActionCard, string> = { freeze: "Freeze", flip3: "Flip Three", chance: "Second Chance" };

export const cardName = (c: Card): string => {
  if (isNumber(c)) return c === 7 ? "the Pepe 7" : `a ${c}`;
  if (c === "x2") return "×2";
  if (isModifier(c)) return c;
  return actionLabel[c];
};

/** Points the player would bank if the round ended now. */
export function roundScore(p: Player): number {
  if (p.status === "bust") return 0;
  let sum = p.nums.reduce((a, b) => a + b, 0);
  if (p.mods.includes("x2")) sum *= 2;
  for (const m of p.mods) if (m !== "x2") sum += Number(m.slice(1));
  if (p.status === "pepe7") sum += BONUS;
  return sum;
}

export function fullDeck(): Card[] {
  const deck: Card[] = [0];
  for (let n = 1; n <= 12; n++) for (let k = 0; k < n; k++) deck.push(n);
  deck.push(...MODIFIERS);
  for (const a of ACTIONS) deck.push(a, a, a);
  return deck;
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function log(s: GameState, text: string): GameState {
  const entry = { id: s.logSeq + 1, text };
  return { ...s, logSeq: entry.id, log: [...s.log, entry].slice(-40) };
}

const patch = (s: GameState, id: string, f: (p: Player) => Player): GameState => ({
  ...s,
  players: s.players.map((p) => (p.id === id ? f(p) : p)),
});

const find = (s: GameState, id: string) => s.players.find((p) => p.id === id)!;

/** Seats starting just after `from` (an index), going round once. */
function seatsAfter(s: GameState, from: number): Player[] {
  const n = s.players.length;
  return Array.from({ length: n }, (_, k) => s.players[(from + 1 + k) % n]);
}

/** Who may receive an action card that `by` has to hand out. */
export function targetsFor(s: GameState, t: Extract<Task, { k: "choose" }>): string[] {
  const active = s.players.filter(isIn);
  if (t.card === "chance") return active.filter((p) => p.id !== t.by && !p.chance).map((p) => p.id);
  return active.map((p) => p.id);
}

/** The player the game is waiting on: someone handing out a card, or whoever's turn it is. */
export function waitingOn(s: GameState): string | null {
  if (s.phase !== "playing") return null;
  const t = s.tasks[0];
  if (t) return t.k === "choose" ? t.by : null;
  if (s.dealing.length || s.advance) return null;
  return s.turn;
}

// ---------------------------------------------------------------- drawing

function takeTop(s: GameState): [GameState, Card | null] {
  let draw = s.draw;
  let discard = s.discard;
  if (draw.length === 0) {
    if (discard.length === 0) return [s, null];
    draw = shuffle(discard);
    discard = [];
    s = log(s, "The draw pile ran out — the discard pile is shuffled in.");
  }
  const card = draw[draw.length - 1];
  draw = draw.slice(0, -1);
  return [{ ...s, draw, discard, deckLeft: draw.length }, card];
}

/**
 * Gives player `pid` the top card. `flip` is the Flip Three in progress for
 * them, if any: action cards then wait in its `held` list.
 */
function giveCard(s: GameState, pid: string, flip: Extract<Task, { k: "flip" }> | null): GameState {
  const [s1, card] = takeTop(s);
  if (card === null) return log(s1, "No cards left to draw!");
  let next: GameState = { ...s1, flash: { pid, seq: (s1.flash?.seq ?? 0) + 1, card } };
  const p = find(next, pid);

  if (isNumber(card)) {
    if (p.nums.includes(card)) {
      if (p.chance) {
        next = patch(next, pid, (x) => ({ ...x, chance: false }));
        next = { ...next, discard: [...next.discard, card, "chance"] };
        return log(next, `${p.name} drew another ${card} — Second Chance saves them!`);
      }
      next = patch(next, pid, (x) => ({ ...x, status: "bust", bustCard: card }));
      next = { ...next, discard: [...next.discard, card] };
      return log(next, `${p.name} drew a second ${card} and busts! 💥`);
    }
    const nums = [...p.nums, card];
    next = patch(next, pid, (x) => ({ ...x, nums }));
    if (nums.length >= SET_SIZE) {
      next = patch(next, pid, (x) => ({ ...x, status: "pepe7" }));
      return log(next, `🐸 ${p.name} has seven different numbers — PEPE 7! +${BONUS}`);
    }
    return log(next, `${p.name} drew ${cardName(card)}.`);
  }

  if (isModifier(card)) {
    next = patch(next, pid, (x) => ({ ...x, mods: [...x.mods, card] }));
    return log(next, `${p.name} drew ${cardName(card)}.`);
  }

  // Action cards.
  if (card === "chance" && !p.chance) {
    next = patch(next, pid, (x) => ({ ...x, chance: true }));
    return log(next, `${p.name} drew a Second Chance.`);
  }
  if (flip) {
    flip.held.push(card);
    return log(next, `${p.name} drew ${cardName(card)} — it waits until the Flip Three is done.`);
  }
  next = { ...next, tasks: [{ k: "choose", card, by: pid }, ...next.tasks] };
  return log(next, `${p.name} drew ${cardName(card)}.`);
}

/** Hands an action card from `by` to `to` and sets its effect going. */
function resolve(s: GameState, card: ActionCard, by: string, to: string): GameState {
  const giver = find(s, by).name;
  const who = to === by ? "themselves" : find(s, to).name;
  if (card === "freeze") {
    const next = patch(s, to, (x) => ({ ...x, status: "frozen" }));
    return log({ ...next, discard: [...next.discard, "freeze"] }, `${giver} freezes ${who}. ❄️`);
  }
  if (card === "flip3") {
    const next: GameState = {
      ...s,
      discard: [...s.discard, "flip3"],
      tasks: [{ k: "flip", target: to, left: 3, held: [] }, ...s.tasks],
    };
    return log(next, `${giver} makes ${who} flip three!`);
  }
  const next = patch(s, to, (x) => ({ ...x, chance: true }));
  return log(next, `${giver} gives their spare Second Chance to ${who}.`);
}

// ---------------------------------------------------------------- the flow

function nextActive(s: GameState, fromId: string): string | null {
  const i = s.players.findIndex((p) => p.id === fromId);
  return seatsAfter(s, i).find(isIn)?.id ?? null;
}

function endRound(s: GameState): GameState {
  const scored = s.players.map((p) => {
    const pts = roundScore(p);
    return { ...p, last: pts, total: p.total + pts };
  });
  const onTable: Card[] = [];
  for (const p of s.players) {
    onTable.push(...p.nums, ...p.mods);
    if (p.chance) onTable.push("chance");
  }
  // Action cards still waiting to be handed out are lost.
  for (const t of s.tasks) {
    if (t.k === "flip") onTable.push(...t.held);
    else onTable.push(t.card);
  }
  let next: GameState = {
    ...s,
    players: scored,
    discard: [...s.discard, ...onTable],
    tasks: [],
    dealing: [],
    turn: null,
    advance: false,
    phase: "roundEnd",
  };
  const best = Math.max(...scored.map((p) => p.total));
  if (best >= s.goal) {
    const top = scored.filter((p) => p.total === best);
    if (top.length === 1) {
      return log({ ...next, phase: "over", winner: top[0].id }, `${top[0].name} wins with ${best} points! 👑`);
    }
    next = log(next, `Tied at ${best} — one more round!`);
  }
  return log(next, `End of round ${s.round}.`);
}

/** Runs everything that needs no decision, until someone has to choose or the round is over. */
function settle(s: GameState): GameState {
  for (let guard = 0; guard < 500; guard++) {
    if (s.phase !== "playing") return s;
    if (s.players.some((p) => p.status === "pepe7")) return endRound(s);

    const t = s.tasks[0];
    if (t?.k === "choose") {
      const options = targetsFor(s, t);
      if (options.length === 0) {
        s = { ...s, tasks: s.tasks.slice(1), discard: [...s.discard, t.card] };
        s = log(s, `Nobody can take ${playerName(s, t.by)}'s ${cardName(t.card)}; it's thrown away.`);
        continue;
      }
      if (options.length === 1) {
        s = resolve({ ...s, tasks: s.tasks.slice(1) }, t.card, t.by, options[0]);
        continue;
      }
      return s; // waiting for `by` to pick
    }
    if (t?.k === "flip") {
      const target = find(s, t.target);
      if (!isIn(target) || t.left === 0) {
        // Done (or stopped by a bust / freeze / Pepe 7). Held action cards follow if they're still in.
        const rest = s.tasks.slice(1);
        if (isIn(target) && t.held.length) {
          s = { ...s, tasks: [...t.held.map((card) => ({ k: "choose" as const, card, by: t.target })), ...rest] };
        } else {
          s = { ...s, tasks: rest, discard: [...s.discard, ...t.held] };
        }
        continue;
      }
      const flip = { ...t, left: t.left - 1, held: [...t.held] };
      s = { ...s, tasks: [flip, ...s.tasks.slice(1)] };
      s = giveCard(s, t.target, flip);
      continue;
    }

    if (s.dealing.length) {
      const [pid, ...rest] = s.dealing;
      s = { ...s, dealing: rest };
      if (isIn(find(s, pid))) s = giveCard(s, pid, null);
      if (rest.length === 0) {
        // Opening deal done: the player left of the dealer starts.
        const first = seatsAfter(s, s.dealer).find(isIn);
        s = { ...s, turn: first?.id ?? null, advance: false };
      }
      continue;
    }

    if (!s.players.some(isIn)) return endRound(s);
    if (s.draw.length === 0 && s.discard.length === 0) return endRound(log(s, "The cards ran out."));

    if (s.advance || !s.turn || !isIn(find(s, s.turn))) {
      const from = s.turn ?? s.players[s.dealer].id;
      s = { ...s, turn: nextActive(s, from), advance: false };
      continue;
    }
    return s; // waiting for `turn` to hit or stay
  }
  return s;
}

function startRound(s: GameState, dealer: number): GameState {
  const players = s.players.map((p) => ({
    ...p,
    nums: [],
    mods: [],
    chance: false,
    status: "in" as Status,
    bustCard: null,
    last: null,
  }));
  let next: GameState = {
    ...s,
    players,
    phase: "playing",
    round: s.round + 1,
    dealer,
    dealing: seatsAfter({ ...s, players }, dealer).map((p) => p.id),
    turn: null,
    advance: false,
    tasks: [],
    flash: null,
    winner: null,
  };
  next = log(next, `Round ${next.round} — ${players[dealer].name} deals.`);
  return settle(next);
}

function startGame(s: GameState): GameState {
  const draw = shuffle(fullDeck());
  const players = s.players.map((p) => ({ ...p, total: 0, last: null }));
  const dealer = Math.floor(Math.random() * players.length);
  return startRound({ ...s, players, draw, discard: [], deckLeft: draw.length, round: 0, log: [] }, dealer);
}

// ---------------------------------------------------------------- moves

const blank = { nums: [], mods: [], chance: false, status: "in" as Status, bustCard: null, total: 0, last: null };

export function addPlayer(s: GameState, p: { id: string; name: string; bot: boolean }): GameState {
  if (s.phase !== "lobby") throw new Error("The game has already started.");
  if (s.players.length >= MAX_PLAYERS) throw new Error("The table is full.");
  if (s.players.some((x) => x.id === p.id)) return s;
  return { ...s, players: [...s.players, { ...p, online: true, ...blank }] };
}

export function removePlayer(s: GameState, id: string): GameState {
  if (s.phase !== "lobby") throw new Error("Can only remove players in the lobby.");
  return { ...s, players: s.players.filter((p) => p.id !== id) };
}

export function apply(s: GameState, pid: string, a: Action): GameState {
  switch (a.type) {
    case "config": {
      if (s.phase !== "lobby") throw new Error("Already started.");
      if (!GOAL_OPTIONS.includes(a.goal)) throw new Error("Unknown goal.");
      return { ...s, goal: a.goal };
    }
    case "start": {
      if (s.phase !== "lobby") throw new Error("Already started.");
      if (s.players.length < 2) throw new Error("Need at least 2 players.");
      return startGame(s);
    }
    case "rematch": {
      if (s.phase !== "over") throw new Error("The game isn't over yet.");
      return startGame(s);
    }
    case "next": {
      if (s.phase !== "roundEnd") return s; // someone else already dealt
      return startRound(s, (s.dealer + 1) % s.players.length);
    }
    case "hit":
    case "stay": {
      if (waitingOn(s) !== pid || s.tasks.length) throw new Error("It's not your turn.");
      if (a.type === "stay") {
        const me = find(s, pid);
        const next = patch(s, pid, (x) => ({ ...x, status: "stayed" }));
        return settle(log({ ...next, advance: true }, `${me.name} stays on ${roundScore(me)}.`));
      }
      return settle({ ...giveCard(s, pid, null), advance: true });
    }
    case "target": {
      const t = s.tasks[0];
      if (s.phase !== "playing" || t?.k !== "choose" || t.by !== pid) throw new Error("You have nothing to give.");
      if (!targetsFor(s, t).includes(a.to)) throw new Error("You can't give it to that player.");
      return settle(resolve({ ...s, tasks: s.tasks.slice(1) }, t.card, pid, a.to));
    }
  }
}

/** Everything is face up except the order of the draw pile. */
export function viewFor(s: GameState): GameState {
  return { ...s, draw: [], deckLeft: s.draw.length };
}

/** Chance that the next card busts this player, counting every card that has been seen. */
export function bustOdds(s: GameState, p: Player): number {
  if (!p.nums.length) return 0;
  // Unseen cards = the full deck minus everything face up (tables, cards being handed out, discard pile).
  // A reshuffle empties the discard pile into the deck, so this stays right after one.
  const unseen = new Map<Card, number>();
  for (const c of fullDeck()) unseen.set(c, (unseen.get(c) ?? 0) + 1);
  const seen: Card[] = [...s.discard];
  for (const x of s.players) {
    seen.push(...x.nums, ...x.mods);
    if (x.chance) seen.push("chance");
  }
  for (const t of s.tasks) {
    if (t.k === "flip") seen.push(...t.held);
    else seen.push(t.card);
  }
  for (const c of seen) unseen.set(c, Math.max(0, (unseen.get(c) ?? 0) - 1));
  const total = [...unseen.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const bad = p.nums.reduce((a, n) => a + (unseen.get(n) ?? 0), 0);
  return Math.min(1, bad / total);
}
