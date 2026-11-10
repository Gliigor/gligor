import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, Stack } from "@/pepebo/Card";
import { Action, GameState, PILES, STOCK_SIZES, Source, WILD, fits, playerName, top } from "@/pepebo/engine";
import { pepebo } from "@/pepebo/def";
import { Controller } from "@/games/net";
import { GameMeta, GamePage, Rules, btn } from "@/games/shell";

type Ctl = Controller<GameState, Action>;

const rules = (
  <Rules>
    <li>
      Everyone has a face-down <b>stock pile</b> with only the top card showing. First to play their whole stock pile wins.
    </li>
    <li>
      The four <b>build piles</b> in the middle go up in order from 1 to 12. A pile that reaches 12 is cleared away.
    </li>
    <li>
      <b>Pepes are wild</b> — a Pepe counts as whatever number the pile needs, but you can't put a Pepe on top of
      another Pepe.
    </li>
    <li>
      Your turn starts with 5 cards in hand. Play as many as you like onto the build piles: from your hand, the top of
      your stock pile, or the top of one of your discard piles.
    </li>
    <li>Play all 5 hand cards and you draw 5 new ones and keep going.</li>
    <li>
      End your turn by putting one hand card on one of your 4 <b>discard piles</b>. Only the top card of each can be
      played later, so stack them wisely.
    </li>
    <li>To move a card: tap it, then tap where it should go.</li>
  </Rules>
);

const meta: GameMeta = {
  name: "Pepebo",
  path: "/pepebo",
  tagline: "Race to empty your stock pile. Pepes are wild.",
  background: "radial-gradient(ellipse at top, #1c5a5c 0%, #123c3a 55%, #0a211f 100%)",
  rules,
};

const LENGTHS: Record<number, string> = { 10: "Quick", 20: "Normal", 30: "Long" };

const LobbyOptions = ({ c, v }: { c: Ctl; v: GameState }) => (
  <div>
    <p className="mb-2 text-xs uppercase tracking-widest text-[#9fc79a]">Stock pile size</p>
    <div className="grid grid-cols-3 gap-2">
      {STOCK_SIZES.map((n) => (
        <button
          key={n}
          disabled={!c.isHost}
          onClick={() => c.act({ type: "config", stock: n })}
          className={`rounded-xl border px-2 py-2 text-sm font-bold transition disabled:opacity-100 ${
            v.stockSize === n ? "border-[#b7f27a] bg-[#b7f27a]/20 text-[#d9f5bd]" : "border-white/15 bg-black/20 text-[#a9c7a0]"
          }`}
        >
          {LENGTHS[n]}
          <span className="block text-xs font-normal opacity-80">{n} cards</span>
        </button>
      ))}
    </div>
  </div>
);

const sameSource = (a: Source | null, b: Source) =>
  !!a && a.from === b.from && (a.from === "stock" || a.i === (b as { i: number }).i);

const Game = ({ c, v }: { c: Ctl; v: GameState }) => {
  const me = v.players.find((p) => p.id === c.me);
  const others = v.players.filter((p) => p.id !== c.me);
  const myTurn = v.phase === "playing" && v.turn === c.me;
  const [sel, setSel] = useState<Source | null>(null);

  // Any change at the table drops the current pick, so it can never point at a card that moved.
  const stamp = `${v.turn}|${me?.hand.join(",")}|${me?.stock.length}|${me?.discards.map((d) => d.length).join(",")}`;
  useEffect(() => setSel(null), [stamp]);

  const picked = !sel || !me ? undefined : sel.from === "hand" ? me.hand[sel.i] : sel.from === "stock" ? top(me.stock) : top(me.discards[sel.i]);
  const pick = (s: Source) => {
    if (!myTurn) return toast("Not your turn yet", { id: "pepebo-hint" });
    setSel(sameSource(sel, s) ? null : s);
  };

  const onBuild = (to: number) => {
    if (!myTurn) return;
    if (!sel || picked === undefined) return toast("Tap one of your cards first", { id: "pepebo-hint" });
    const need = v.builds[to].length + 1;
    if (picked === WILD && top(v.builds[to]) === WILD)
      return toast.error("A Pepe can't go on another Pepe", { id: "pepebo-hint" });
    if (!fits(picked, need, top(v.builds[to]))) return toast.error(`That pile needs a ${need}`, { id: "pepebo-hint" });
    c.act({ type: "play", to, ...sel });
  };

  const onDiscardPile = (i: number) => {
    if (!me) return;
    if (sel?.from === "hand") return c.act({ type: "discard", i: sel.i, to: i });
    if (me.discards[i].length) pick({ from: "discard", i });
    else if (myTurn) toast("Pick a hand card first, then tap here to discard it", { id: "pepebo-hint" });
  };

  const hint = !myTurn
    ? null
    : !sel
      ? "Tap a card to pick it up."
      : sel.from === "hand"
        ? "Tap a build pile to play it — or one of your discard piles to end your turn."
        : "Tap a build pile to play it.";

  return (
    <div className="space-y-3">
      {/* opponents */}
      <div className="space-y-2">
        {others.map((p) => {
          const turn = v.turn === p.id;
          return (
            <div
              key={p.id}
              className={`rounded-xl border px-3 py-2 transition ${
                turn ? "border-[#ffd54a] bg-[#ffd54a]/10" : "border-white/10 bg-black/20"
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-[#a9c7a0]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${p.bot || p.online ? "bg-[#7ee07e]" : "bg-red-400"}`} />
                  <span className="truncate text-sm font-semibold text-[#eef3e6]">{p.name}</span>
                  {turn && <span className="animate-pulse font-bold text-[#ffd54a]">playing…</span>}
                </span>
                <span className="shrink-0">{p.hand.length} in hand</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Card card={top(p.stock)} size="sm" />
                  <span className="text-xs text-[#a9c7a0]">
                    <b className="text-base text-[#eef3e6]">{p.stock.length}</b> left
                  </span>
                </span>
                <span className="flex gap-1">
                  {p.discards.map((d, i) => (
                    <Card key={i} card={top(d)} size="sm" />
                  ))}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* build piles */}
      <div className="rounded-2xl bg-black/25 p-3">
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-[#9fc79a]">
          <span>Build piles</span>
          <span>{v.draw.length} in the deck</span>
        </div>
        <div className="flex justify-between">
          {v.builds.map((b, i) => {
            const need = b.length + 1;
            const t = top(b);
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <Card
                  card={t === undefined ? undefined : t === WILD ? WILD : b.length}
                  as={t === WILD ? b.length : undefined}
                  size="lg"
                  empty="1"
                  glow={myTurn && picked !== undefined && fits(picked, need, t)}
                  onClick={myTurn ? () => onBuild(i) : undefined}
                  label={`Build pile ${i + 1}, needs ${need}`}
                />
                <span className={`text-[11px] ${v.last?.to === i ? "font-bold text-[#ffd54a]" : "text-[#a9c7a0]"}`}>
                  needs {need}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {v.phase === "over" && (
        <div className="rounded-2xl border border-white/20 bg-black/30 p-4 text-center">
          <p className="text-2xl font-black text-[#ffd54a]">👑 {playerName(v, v.winner)} wins!</p>
          {v.players.every((p) => p.stock.length > 0) && (
            <p className="mt-1 text-sm text-[#cfe0c4]">Nobody could move any more — the smallest stock pile wins.</p>
          )}
          <p className="mt-1 text-sm text-[#a9c7a0]">
            {v.players
              .filter((p) => p.id !== v.winner)
              .map((p) => `${p.name}: ${p.stock.length} left`)
              .join(" · ")}
          </p>
          <button className={`${btn} mt-3 w-full bg-[#b7f27a] text-[#0d2b1b]`} onClick={() => c.act({ type: "rematch" })}>
            Rematch
          </button>
        </div>
      )}

      {/* me */}
      {me && (
        <div
          className={`rounded-2xl border p-3 transition ${
            myTurn ? "border-[#ffd54a]/70 bg-black/30 shadow-[0_0_16px_rgba(255,213,74,0.2)]" : "border-white/10 bg-black/20"
          }`}
        >
          <p className={`mb-2 text-center text-sm font-bold ${myTurn ? "text-[#ffd54a]" : "text-[#a9c7a0]"}`}>
            {v.phase === "over" ? "Game over" : myTurn ? "YOUR TURN" : `${playerName(v, v.turn)} is playing…`}
            {hint && <span className="block text-xs font-normal text-[#cfe0c4]">{hint}</span>}
          </p>

          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-widest text-[#9fc79a]">Stock</span>
              <Card
                card={top(me.stock)}
                size="lg"
                selected={sel?.from === "stock"}
                onClick={me.stock.length ? () => pick({ from: "stock" }) : undefined}
                label="Your stock pile"
              />
              <span className="text-xs text-[#a9c7a0]">
                <b className="text-base text-[#eef3e6]">{me.stock.length}</b> left
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-widest text-[#9fc79a]">Your discard piles</span>
              <div className="flex gap-2">
                {Array.from({ length: PILES }, (_, i) => (
                  <Stack
                    key={i}
                    pile={me.discards[i]}
                    selected={sel?.from === "discard" && sel.i === i}
                    glow={myTurn && sel?.from === "hand"}
                    onClick={() => onDiscardPile(i)}
                    label={`Your discard pile ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <p className="mb-1 mt-3 text-center text-[10px] uppercase tracking-widest text-[#9fc79a]">Your hand</p>
          <div className="flex min-h-[90px] items-end justify-center gap-1.5">
            {me.hand.map((card, i) => (
              <Card
                key={i}
                card={card}
                size="lg"
                selected={sel?.from === "hand" && sel.i === i}
                onClick={() => pick({ from: "hand", i })}
                label={`Hand card ${card === WILD ? "Pepe" : card}`}
              />
            ))}
            {me.hand.length === 0 && v.phase === "playing" && (
              <div className="pb-4 text-center text-sm text-[#a9c7a0]">
                No cards in hand.
                {myTurn && (
                  <button className={`${btn} ml-2 bg-white/10 py-1.5 text-sm`} onClick={() => c.act({ type: "pass" })}>
                    Pass
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-black/20 p-3 text-xs text-[#a9c7a0]">
        {[...v.log]
          .reverse()
          .slice(0, 5)
          .map((l) => (
            <p key={l.id} className="py-0.5">
              {l.text}
            </p>
          ))}
      </div>
      {rules}
    </div>
  );
};

const Pepebo = () => (
  <GamePage def={pepebo} meta={meta} lobbyExtra={(c, v) => <LobbyOptions c={c} v={v} />}>
    {(c, v) => <Game c={c} v={v} />}
  </GamePage>
);

export default Pepebo;
