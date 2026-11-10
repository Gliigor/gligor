import { useCallback, useState } from "react";
import { Board, Egg } from "@/pepala/Board";
import { Action, EGG_OPTIONS, GameState, STORE, seatOf } from "@/pepala/engine";
import { pepala } from "@/pepala/def";
import { Controller } from "@/games/net";
import { GameMeta, GamePage, Rules, btn } from "@/games/shell";

type Ctl = Controller<GameState, Action>;

const rules = (
  <Rules>
    <li>
      Each side has <b>6 pits</b> of frog eggs and a <b>frog</b> at its end. Your pits are on the right, your frog is at
      the bottom.
    </li>
    <li>
      On your turn, tap one of your pits: all its eggs are scooped up and dropped one by one into the next holes, your
      own frog included (never the other frog).
    </li>
    <li>
      Last egg in <b>your frog</b>? Go again.
    </li>
    <li>
      Last egg in an <b>empty pit on your side</b> with eggs opposite? Your frog <b>gulps</b> that egg and everything
      across from it.
    </li>
    <li>
      When one side runs out of eggs, the other player's leftover eggs go to their own frog. Most eggs in your frog
      wins.
    </li>
  </Rules>
);

const meta: GameMeta = {
  name: "Pepala",
  path: "/pepala",
  tagline: "Mancala in the pond: sow frog eggs, feed your frog, gulp your colleague's eggs.",
  background: "radial-gradient(ellipse at top, #1d5a49 0%, #133d33 55%, #0a201b 100%)",
  rules,
};

const LENGTHS: Record<number, string> = { 3: "Quick", 4: "Classic", 5: "Long" };

const LobbyOptions = ({ c, v }: { c: Ctl; v: GameState }) => (
  <div>
    <p className="mb-2 text-xs uppercase tracking-widest text-[#9fc79a]">Eggs per pit</p>
    <div className="grid grid-cols-3 gap-2">
      {EGG_OPTIONS.map((n) => (
        <button
          key={n}
          disabled={!c.isHost}
          onClick={() => c.act({ type: "config", eggs: n })}
          className={`rounded-xl border px-2 py-2 text-sm font-bold transition disabled:opacity-100 ${
            v.eggs === n ? "border-[#b7f27a] bg-[#b7f27a]/20 text-[#d9f5bd]" : "border-white/15 bg-black/20 text-[#a9c7a0]"
          }`}
        >
          {LENGTHS[n]}
          <span className="block text-xs font-normal opacity-80">{n} eggs</span>
        </button>
      ))}
    </div>
  </div>
);

const Game = ({ c, v }: { c: Ctl; v: GameState }) => {
  const mine = seatOf(v, c.me);
  const seat = mine < 0 ? 0 : mine;
  const other = 1 - seat;
  const [busy, setBusy] = useState(false);
  const onBusy = useCallback((b: boolean) => setBusy(b), []);
  const myTurn = v.phase === "playing" && v.seat === mine;
  const name = (s: number) => v.players[s]?.name ?? "?";
  const mover = v.anim ? name(v.anim.seat) : "";
  const over = v.phase === "over" && !busy;

  const banner = busy
    ? v.anim?.capture
      ? `${mover}'s frog is hungry…`
      : `${mover} is sowing…`
    : over
      ? v.winner === -1
        ? "It's a draw!"
        : v.winner === mine
          ? "👑 You win!"
          : `👑 ${name(v.winner ?? 0)} wins!`
      : myTurn
        ? v.anim?.again && v.anim.seat === mine
          ? "Your frog says: go again!"
          : "Your turn — tap one of your pits"
        : `${name(v.seat)} is thinking…`;

  const scoreRow = (s: number) => (
    <div className="flex items-center justify-between text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${v.players[s]?.bot || v.players[s]?.online ? "bg-[#7ee07e]" : "bg-red-400"}`}
        />
        <span className={`truncate font-semibold ${s === seat ? "text-[#d9f5bd]" : "text-[#e4d9ff]"}`}>
          {name(s)}
          {s === mine && <span className="font-normal text-[#9fc79a]"> (you)</span>}
        </span>
        {!busy && v.phase === "playing" && v.seat === s && (
          <span className="animate-pulse text-xs font-bold text-[#ffd54a]">to move</span>
        )}
      </span>
      <span className="flex items-center gap-1 font-black">
        <Egg size={16} /> {busy && v.anim ? v.anim.before[STORE[s]] : v.pits[STORE[s]]}
      </span>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-black/25 px-3 py-2">{scoreRow(other)}</div>

      <p
        className={`rounded-xl px-3 py-2 text-center text-sm font-bold transition ${
          myTurn && !busy ? "bg-[#ffd54a]/15 text-[#ffd54a]" : "bg-black/20 text-[#cfe0c4]"
        }`}
      >
        {banner}
      </p>

      <Board v={v} seat={seat} canPlay={myTurn} onSow={(pit) => c.act({ type: "sow", pit })} onBusy={onBusy} />

      <div className="rounded-xl bg-black/25 px-3 py-2">{scoreRow(seat)}</div>

      {over && (
        <div className="rounded-2xl border border-white/20 bg-black/30 p-4 text-center">
          <p className="text-2xl font-black text-[#ffd54a]">{banner}</p>
          <p className="mt-1 text-sm text-[#cfe0c4]">
            {name(seat)} {v.pits[STORE[seat]]} — {v.pits[STORE[other]]} {name(other)}
          </p>
          <button className={`${btn} mt-3 w-full bg-[#b7f27a] text-[#0d2b1b]`} onClick={() => c.act({ type: "rematch" })}>
            Rematch
          </button>
        </div>
      )}

      <div className="rounded-xl bg-black/20 p-3 text-xs text-[#a9c7a0]">
        {v.log
          .filter((l) => !busy || !v.anim || l.id <= v.anim.logFrom)
          .reverse()
          .slice(0, 4)
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

const Pepala = () => (
  <GamePage def={pepala} meta={meta} lobbyExtra={(c, v) => <LobbyOptions c={c} v={v} />}>
    {(c, v) => <Game c={c} v={v} />}
  </GamePage>
);

export default Pepala;
