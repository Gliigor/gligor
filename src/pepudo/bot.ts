import { Action, GameState, countFace, minQty, totalDice } from "./engine";

const BOT_NAMES = ["Kek", "Feels", "Smug", "Rare", "Monka", "Sadge", "Peepo", "Hop", "Ribbit", "Croaky"];

export const botName = (taken: string[]) => {
  const free = BOT_NAMES.filter((n) => !taken.includes(`${n} 🤖`));
  const pick = free.length ? free[Math.floor(Math.random() * free.length)] : `Bot${taken.length + 1}`;
  return `${pick} 🤖`;
};

function binomPmf(n: number, p: number, k: number) {
  if (k < 0 || k > n) return 0;
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return c * p ** k * (1 - p) ** (n - k);
}

function binomAtLeast(n: number, p: number, k: number) {
  if (k <= 0) return 1;
  let sum = 0;
  for (let i = k; i <= n; i++) sum += binomPmf(n, p, i);
  return sum;
}

/** Decide a move for player `id`. Uses its own dice + simple probability, with a bit of noise. */
export function botMove(s: GameState, id: string): Action {
  const me = s.players.find((p) => p.id === id)!;
  const total = totalDice(s);
  const unknown = total - me.dice.length;
  const pFace = (face: number) => (face === 1 ? 1 / 6 : 1 / 3);
  const pAtLeast = (qty: number, face: number) => binomAtLeast(unknown, pFace(face), qty - countFace(me.dice, face));
  const pExact = (qty: number, face: number) => binomPmf(unknown, pFace(face), qty - countFace(me.dice, face));
  const noise = () => (Math.random() - 0.5) * 0.12;

  if (!s.bid) {
    // Open on the face we hold most of, around the expected count.
    let best = { face: 2, own: -1 };
    for (let f = 2; f <= 6; f++) {
      const own = countFace(me.dice, f) + Math.random() * 0.5;
      if (own > best.own) best = { face: f, own };
    }
    const expected = countFace(me.dice, best.face) + unknown * pFace(best.face);
    const qty = Math.max(1, Math.min(total, Math.round(expected * (0.6 + Math.random() * 0.3))));
    return { type: "bid", qty, face: best.face };
  }

  const bid = s.bid;
  const pTrue = pAtLeast(bid.qty, bid.face);

  // Best raise: the smallest valid amount for each face, scored by how likely it holds.
  let best: { qty: number; face: number; p: number } | null = null;
  for (let face = 1; face <= 6; face++) {
    const min = minQty(bid, face);
    if (min === null || min > total) continue;
    for (let qty = min; qty <= Math.min(total, min + 1); qty++) {
      const p = pAtLeast(qty, face);
      const score = p + noise() - (qty - min) * 0.04;
      if (!best || score > best.p) best = { qty, face, p: score };
    }
  }

  const exact = pExact(bid.qty, bid.face);
  if (exact > 0.45 && Math.random() < 0.7 && me.count < 5) return { type: "calza" };
  if (!best || 1 - pTrue + noise() > best.p + 0.05) return { type: "dudo" };
  return { type: "bid", qty: best.qty, face: best.face };
}
