import { Action, GameState, STORE, ownPits, seatOf, sow } from "./engine";

export { botName } from "@/pepe7/bot";

/** Store difference from `me`'s point of view, searched a few moves ahead (extra turns don't use up depth). */
function search(pits: number[], seat: number, me: number, depth: number, alpha: number, beta: number): number {
  const moves = ownPits(seat).filter((i) => pits[i] > 0);
  if (depth === 0 || moves.length === 0) return pits[STORE[me]] - pits[STORE[1 - me]];
  const maxing = seat === me;
  let best = maxing ? -Infinity : Infinity;
  for (const m of moves) {
    const r = sow(pits, seat, m);
    const score = r.over
      ? (r.pits[STORE[me]] - r.pits[STORE[1 - me]]) * 100
      : search(r.pits, r.again ? seat : 1 - seat, me, r.again ? depth : depth - 1, alpha, beta);
    if (maxing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, score);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function botMove(s: GameState, id: string): Action {
  const seat = seatOf(s, id);
  const moves = ownPits(seat).filter((i) => s.pits[i] > 0);
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const r = sow(s.pits, seat, m);
    const score =
      (r.over
        ? (r.pits[STORE[seat]] - r.pits[STORE[1 - seat]]) * 100
        : search(r.pits, r.again ? seat : 1 - seat, seat, 5, -Infinity, Infinity)) + Math.random() * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return { type: "sow", pit: best };
}

export function safeMove(s: GameState, id: string): Action {
  const seat = seatOf(s, id);
  return { type: "sow", pit: ownPits(seat).find((i) => s.pits[i] > 0) ?? ownPits(seat)[0] };
}
