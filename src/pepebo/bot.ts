import { Action, GameState, PILES, Source, WILD, fits, needs, top, tops } from "./engine";

type Step = Source & { to: number };

/**
 * Finds the cards needed to raise build pile `to` until the stock card fits,
 * using hand cards first, then discard tops, then Pepes (never two Pepes in a row). Returns the steps or null.
 */
function chainToStock(s: GameState, id: string, to: number, target: number): Step[] | null {
  const me = s.players.find((p) => p.id === id)!;
  const hand = me.hand.map((card, i) => ({ card, i, used: false }));
  const discards = me.discards.map((d) => [...d]);
  const steps: Step[] = [];
  let prev = top(s.builds[to]); // card on top of the pile so far
  for (let need = s.builds[to].length + 1; need < target; need++) {
    const wildOk = prev !== WILD;
    const exact = hand.find((h) => !h.used && h.card === need);
    const pile = discards.findIndex((d) => top(d) === need);
    const wild = wildOk ? hand.find((h) => !h.used && h.card === WILD) : undefined;
    const wildPile = wildOk ? discards.findIndex((d) => top(d) === WILD) : -1;
    prev = exact || pile >= 0 ? need : WILD;
    if (exact) {
      exact.used = true;
      steps.push({ from: "hand", i: exact.i, to });
    } else if (pile >= 0) {
      discards[pile].pop();
      steps.push({ from: "discard", i: pile, to });
    } else if (wild) {
      wild.used = true;
      steps.push({ from: "hand", i: wild.i, to });
    } else if (wildPile >= 0) {
      discards[wildPile].pop();
      steps.push({ from: "discard", i: wildPile, to });
    } else {
      return null;
    }
  }
  return steps;
}

/** One move for player `id`: get rid of the stock card if possible, otherwise keep cards moving, then discard. */
export function botMove(s: GameState, id: string): Action {
  const me = s.players.find((p) => p.id === id)!;
  const need = needs(s);
  const onTop = tops(s);
  /** A pile a Pepe may go on, preferring ones that don't help the next player; -1 if none. */
  const pepePile = () => {
    const open = need.map((n, i) => i).filter((i) => onTop[i] !== WILD);
    return open.find((i) => !gifts(need[i])) ?? open[0] ?? -1;
  };
  const stock = top(me.stock)!;
  const idx = s.players.findIndex((p) => p.id === id);
  const rival = top(s.players[(idx + 1) % s.players.length].stock);
  // Would raising a pile to `value` hand the next player their stock card?
  const gifts = (value: number) => rival !== undefined && rival !== WILD && rival === (value % 12) + 1;

  // 1. Stock card fits right now.
  if (stock === WILD) {
    const to = pepePile();
    if (to >= 0) return { type: "play", from: "stock", to };
  }
  const direct = need.indexOf(stock);
  if (direct >= 0) return { type: "play", from: "stock", to: direct };

  // 2. A run of cards that makes the stock card fit: take the shortest.
  let best: Step[] | null = null;
  for (let to = 0; to < PILES; to++) {
    if (need[to] >= stock) continue;
    const steps = chainToStock(s, id, to, stock);
    if (steps && (!best || steps.length < best.length)) best = steps;
  }
  if (best?.length) return { type: "play", ...best[0] };

  // 3. Keep cards moving: emptying the hand draws 5 new ones, and finished piles refill the deck.
  //    Prefer plays that don't hand the next player their stock card.
  const scarce = s.draw.length + s.done.length < 8;
  const options: { step: Step; cost: number }[] = [];
  me.hand.forEach((card, i) => {
    if (card === WILD) {
      // Pepes are worth keeping; only spend one when the deck is drying up.
      const to = pepePile();
      if (scarce && to >= 0) options.push({ step: { from: "hand", i, to }, cost: 3 });
      return;
    }
    const to = need.indexOf(card);
    if (to >= 0) options.push({ step: { from: "hand", i, to }, cost: gifts(card) ? 2 : 0 });
  });
  me.discards.forEach((pile, i) => {
    const card = top(pile);
    if (card === undefined || card === WILD) return;
    const to = need.indexOf(card);
    if (to >= 0 && (scarce || !gifts(card))) options.push({ step: { from: "discard", i, to }, cost: gifts(card) ? 2 : 1 });
  });
  if (options.length) {
    options.sort((x, y) => x.cost - y.cost);
    return { type: "play", ...options[0].step };
  }

  // 4. Discard: keep Pepes, stack equal numbers, otherwise keep piles in descending order.
  if (me.hand.length === 0) return { type: "pass" };
  let pick = { i: 0, to: 0, score: -Infinity };
  me.hand.forEach((card, i) => {
    me.discards.forEach((pile, to) => {
      const t = top(pile);
      let score = card === WILD ? -100 : card / 10; // rather throw high cards, never a Pepe
      if (t === undefined) score += 3;
      else if (t === card) score += 5;
      else if (t === card + 1) score += 4;
      else if (t > card) score += 2 - (t - card) / 12;
      else score -= (card - t) / 4; // buries a lower card we'd need first
      if (score > pick.score) pick = { i, to, score };
    });
  });
  return { type: "discard", i: pick.i, to: pick.to };
}

/** Always legal: used if a bot move is ever rejected. */
export function safeMove(s: GameState, id: string): Action {
  const me = s.players.find((p) => p.id === id)!;
  const stock = top(me.stock);
  const onTop = tops(s);
  const to = stock === undefined ? -1 : needs(s).findIndex((n, i) => fits(stock, n, onTop[i]));
  if (to >= 0) return { type: "play", from: "stock", to };
  return me.hand.length ? { type: "discard", i: 0, to: 0 } : { type: "pass" };
}
