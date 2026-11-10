import { Action, GameState, Player, bustOdds, isIn, roundScore, targetsFor, waitingOn } from "./engine";

const BOT_NAMES = ["Kek", "Feels", "Smug", "Rare", "Monka", "Sadge", "Peepo", "Hop", "Ribbit", "Croaky"];

export const botName = (taken: string[]) => {
  const free = BOT_NAMES.filter((n) => !taken.includes(`${n} 🤖`));
  const pick = free.length ? free[Math.floor(Math.random() * free.length)] : `Bot${taken.length + 1}`;
  return `${pick} 🤖`;
};

/** Each bot has its own appetite for risk, fixed by its id. */
const nerve = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return 0.8 + (Math.abs(h) % 41) / 100; // 0.8 … 1.2
};

function wantsToHit(s: GameState, me: Player): boolean {
  const now = roundScore(me);
  if (me.nums.length === 0) return true;
  const others = s.players.filter((p) => p.id !== me.id);
  const bestOther = Math.max(...others.map((p) => p.total + (p.status === "bust" ? 0 : roundScore(p))));

  // Staying now wins the game: take it.
  if (me.total + now >= s.goal && me.total + now > bestOther) return false;
  // Last one in and already ahead of everyone this round: no need to risk it.
  const stillIn = s.players.filter(isIn);
  if (stillIn.length === 1 && me.total + now > bestOther + 20) return false;
  // Way behind with the game nearly over: go for it.
  const behind = bestOther >= s.goal * 0.8 && me.total + now < bestOther;

  if (me.chance) return true;
  const p = bustOdds(s, me);
  const doubled = me.mods.includes("x2") ? 2 : 1;
  const gain = 6.5 * doubled + (me.nums.length === 6 ? 15 : 0);
  const value = (1 - p) * gain * nerve(me.id) * (behind ? 1.6 : 1) - p * now;
  return value > 0;
}

/** Bust odds for the next three cards, roughly. */
const odds3 = (s: GameState, p: Player) => (p.chance ? 0.4 : 1) * (1 - (1 - bustOdds(s, p)) ** 3);

export function botMove(s: GameState, id: string): Action {
  const t = s.tasks[0];
  if (t?.k === "choose" && t.by === id) {
    const options = targetsFor(s, t).map((pid) => s.players.find((p) => p.id === pid)!);
    const leader = Math.max(...s.players.filter((p) => p.id !== id).map((p) => p.total));
    const rate = (p: Player): number => {
      const pts = roundScore(p);
      const threat = (p.total - leader) / 20; // the overall leader is the one to hurt
      if (t.card === "freeze") {
        // Freeze yourself when you have a good hand at risk; freeze others while their hand is small.
        if (p.id === id) return pts * bustOdds(s, p) * 0.5 - 2;
        return 8 - pts / 3 + threat;
      }
      if (t.card === "flip3") {
        if (p.id === id) return -5 + (p.nums.length <= 1 ? 4 : 0) - odds3(s, p) * pts;
        return odds3(s, p) * pts / 3 + threat;
      }
      // A spare Second Chance: give it to whoever is furthest behind.
      return -p.total / 10 - pts / 5;
    };
    const best = options.reduce((a, b) => (rate(b) > rate(a) ? b : a));
    return { type: "target", to: best.id };
  }
  const me = s.players.find((p) => p.id === id)!;
  return { type: wantsToHit(s, me) ? "hit" : "stay" };
}

/** Always legal: used if a bot move is ever rejected, or for a player who has gone away. */
export function safeMove(s: GameState, id: string): Action {
  const t = s.tasks[0];
  if (t?.k === "choose" && t.by === id) return { type: "target", to: targetsFor(s, t)[0] };
  if (waitingOn(s) === id) return { type: "stay" };
  return { type: "next" };
}
