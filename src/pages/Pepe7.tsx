import { Heart } from "lucide-react";
import { CardBack, PepeCard } from "@/pepe7/Card";
import {
  Action,
  BONUS,
  GOAL_OPTIONS,
  GameState,
  Player,
  actionLabel,
  bustOdds,
  isModifier,
  isNumber,
  playerName,
  roundScore,
  targetsFor,
  waitingOn,
} from "@/pepe7/engine";
import { pepe7 } from "@/pepe7/def";
import { FrogHead } from "@/pepudo/Die";
import { Controller } from "@/games/net";
import { GameMeta, GamePage, Rules, btn } from "@/games/shell";

type Ctl = Controller<GameState, Action>;

const rules = (
  <Rules>
    <li>
      Each round everyone gets one card, then in turn you <b>Hit</b> (take another card) or <b>Stay</b> (bank your
      points for this round and sit out the rest of it).
    </li>
    <li>
      Take a number you already have and you <b>bust</b>: nothing for this round.
    </li>
    <li>
      Collect <b>7 different numbers</b> and it's a <b>Pepe 7</b>: the round ends at once and you get {BONUS} extra
      points. The 7 card itself is a Pepe.
    </li>
    <li>
      Score = your numbers added up, doubled by a <b>×2</b>, plus any <b>+2 … +10</b> cards.
    </li>
    <li>
      <b>Freeze</b> ❄️ — give it to anyone still in (yourself too). They bank their points and are out of the round.
    </li>
    <li>
      <b>Flip Three</b> — give it to anyone still in. They must take the next three cards. Other action cards they draw
      wait until the three are done.
    </li>
    <li>
      <b>Second Chance</b> ♥ — keep it to cancel one bust. You can hold only one; a second goes to another player.
    </li>
    <li>
      The deck has more of the high numbers: twelve 12s, eleven 11s … one 1, and a single 0. First to {200} points at the
      end of a round wins (the host can change the goal).
    </li>
  </Rules>
);

const meta: GameMeta = {
  name: "Pepe 7",
  path: "/pepe7",
  tagline: "Push your luck. Seven different numbers wins the round — the 7 is a Pepe.",
  background: "radial-gradient(ellipse at top, #3b5a1c 0%, #22391a 55%, #101c0d 100%)",
  rules,
};

const LENGTHS: Record<number, string> = { 100: "Quick", 200: "Normal", 300: "Long" };

const LobbyOptions = ({ c, v }: { c: Ctl; v: GameState }) => (
  <div>
    <p className="mb-2 text-xs uppercase tracking-widest text-[#9fc79a]">Play to</p>
    <div className="grid grid-cols-3 gap-2">
      {GOAL_OPTIONS.map((n) => (
        <button
          key={n}
          disabled={!c.isHost}
          onClick={() => c.act({ type: "config", goal: n })}
          className={`rounded-xl border px-2 py-2 text-sm font-bold transition disabled:opacity-100 ${
            v.goal === n ? "border-[#b7f27a] bg-[#b7f27a]/20 text-[#d9f5bd]" : "border-white/15 bg-black/20 text-[#a9c7a0]"
          }`}
        >
          {LENGTHS[n]}
          <span className="block text-xs font-normal opacity-80">{n} points</span>
        </button>
      ))}
    </div>
  </div>
);

const STATUS: Record<Player["status"], { text: string; cls: string } | null> = {
  in: null,
  stayed: { text: "Stayed", cls: "bg-[#b7f27a]/20 text-[#d9f5bd]" },
  frozen: { text: "Frozen ❄️", cls: "bg-sky-400/20 text-sky-100" },
  bust: { text: "Bust 💥", cls: "bg-red-500/25 text-red-100" },
  pepe7: { text: "PEPE 7! 🐸", cls: "bg-[#ffd54a] text-[#3a2a00]" },
};

/** The cards in front of a player: numbers, then + cards, then a Second Chance. */
const Hand = ({ v, p, size }: { v: GameState; p: Player; size: "sm" | "md" }) => {
  const flash = v.flash?.pid === p.id && v.phase === "playing" ? v.flash.card : null;
  const freshNum = flash !== null && isNumber(flash) ? p.nums.length - 1 : -1;
  const freshMod = flash !== null && isModifier(flash) ? p.mods.lastIndexOf(flash) : -1;
  const dim = p.status === "bust";
  const empty = !p.nums.length && !p.mods.length && !p.chance && p.bustCard === null;
  return (
    <div className={`flex flex-wrap items-center ${size === "sm" ? "gap-1" : "gap-1.5"}`}>
      {p.nums.map((n, i) => (
        <PepeCard key={`n${i}`} card={n} size={size} fresh={i === freshNum} dim={dim} />
      ))}
      {p.bustCard !== null && <PepeCard card={p.bustCard} size={size} bad />}
      {p.mods.map((m, i) => (
        <PepeCard key={`m${i}`} card={m} size={size} fresh={i === freshMod} dim={dim} />
      ))}
      {p.chance && <PepeCard card="chance" size={size} fresh={flash === "chance"} />}
      {empty && <span className="text-xs italic text-white/40">no cards</span>}
    </div>
  );
};

const Bar = ({ value, goal }: { value: number; goal: number }) => (
  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/30">
    <div className="h-full rounded-full bg-[#b7f27a]" style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} />
  </div>
);

const Seat = ({ v, p, active, dealer }: { v: GameState; p: Player; active: boolean; dealer: boolean }) => {
  const chip = STATUS[p.status];
  return (
    <div
      className={`rounded-xl border px-3 py-2 transition ${
        active ? "border-[#ffd54a] bg-[#ffd54a]/10" : "border-white/10 bg-black/20"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-[#a9c7a0]">
        <span className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${p.bot || p.online ? "bg-[#7ee07e]" : "bg-red-400"}`} />
          <span className="truncate text-sm font-semibold text-[#eef3e6]">{p.name}</span>
          {dealer && <span className="rounded bg-white/10 px-1 text-[10px]">dealer</span>}
          {active && <span className="animate-pulse font-bold text-[#ffd54a]">thinking…</span>}
          {chip && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${chip.cls}`}>{chip.text}</span>}
        </span>
        <span className="shrink-0 text-right">
          <b className="text-base text-[#eef3e6]">{p.total}</b>
          {v.phase === "playing" && p.status !== "bust" && roundScore(p) > 0 && (
            <span className="ml-1 text-[#b7f27a]">+{roundScore(p)}</span>
          )}
        </span>
      </div>
      <Hand v={v} p={p} size="sm" />
      <Bar value={p.total} goal={v.goal} />
    </div>
  );
};

const Game = ({ c, v }: { c: Ctl; v: GameState }) => {
  const me = v.players.find((p) => p.id === c.me);
  const others = v.players.filter((p) => p.id !== c.me);
  const waiting = waitingOn(v);
  const task = v.tasks[0];
  const choosing = v.phase === "playing" && task?.k === "choose" ? task : null;
  const myChoice = choosing?.by === c.me ? choosing : null;
  const myTurn = !choosing && waiting === c.me;
  const dealerId = v.players[v.dealer]?.id;
  const odds = me && myTurn ? bustOdds(v, me) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-2 text-xs text-[#a9c7a0]">
        <span>
          Round <b className="text-[#eef3e6]">{v.round}</b> · to <b className="text-[#eef3e6]">{v.goal}</b>
        </span>
        <span className="flex items-center gap-2">
          <CardBack size="sm" />
          <span>
            <b className="text-[#eef3e6]">{v.deckLeft}</b> in the deck
          </span>
        </span>
      </div>

      <div className="space-y-2">
        {others.map((p) => (
          <Seat key={p.id} v={v} p={p} active={waiting === p.id} dealer={p.id === dealerId} />
        ))}
      </div>

      {/* someone is handing out an action card */}
      {choosing && !myChoice && (
        <p className="rounded-xl bg-black/30 p-3 text-center text-sm text-[#cfe0c4]">
          <span className="animate-pulse">
            {playerName(v, choosing.by)} is choosing who gets {actionLabel[choosing.card]}…
          </span>
        </p>
      )}
      {myChoice && (
        <div className="rounded-2xl border border-[#ffd54a]/70 bg-black/35 p-3 shadow-[0_0_16px_rgba(255,213,74,0.2)]">
          <div className="mb-2 flex items-center gap-3">
            <PepeCard card={myChoice.card} size="md" fresh />
            <p className="text-sm text-[#eef3e6]">
              <b className="text-[#ffd54a]">You drew {actionLabel[myChoice.card]}!</b>
              <span className="block text-xs text-[#cfe0c4]">
                {myChoice.card === "freeze"
                  ? "Who gets frozen? They keep this round's points but can't take more."
                  : myChoice.card === "flip3"
                    ? "Who has to take the next three cards?"
                    : "You already have one. Give this one to another player."}
              </span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {targetsFor(v, myChoice).map((id) => {
              const p = v.players.find((x) => x.id === id)!;
              return (
                <button
                  key={id}
                  className={`${btn} border border-white/20 bg-black/30 py-2 text-sm`}
                  onClick={() => c.act({ type: "target", to: id })}
                >
                  {id === c.me ? "Myself" : p.name}
                  <span className="block text-xs font-normal text-[#a9c7a0]">
                    {roundScore(p)} this round · {p.nums.length} numbers
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* round / game results */}
      {(v.phase === "roundEnd" || v.phase === "over") && (
        <div className="rounded-2xl border border-white/20 bg-black/30 p-4">
          <p className="text-center text-xl font-black text-[#ffd54a]">
            {v.phase === "over" ? `👑 ${playerName(v, v.winner)} wins!` : `Round ${v.round} done`}
          </p>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {[...v.players]
                .sort((a, b) => b.total - a.total)
                .map((p) => (
                  <tr key={p.id} className={p.id === c.me ? "text-[#d9f5bd]" : ""}>
                    <td className="truncate py-0.5">{p.name}</td>
                    <td className="py-0.5 text-right text-xs text-[#a9c7a0]">
                      {p.status === "bust" ? "bust" : p.status === "pepe7" ? "Pepe 7!" : ""}
                    </td>
                    <td className="w-14 py-0.5 text-right text-[#b7f27a]">+{p.last ?? 0}</td>
                    <td className="w-12 py-0.5 text-right font-bold">{p.total}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {v.phase === "over" ? (
            <button className={`${btn} mt-3 w-full bg-[#b7f27a] text-[#0d2b1b]`} onClick={() => c.act({ type: "rematch" })}>
              Rematch
            </button>
          ) : (
            <button className={`${btn} mt-3 w-full bg-[#b7f27a] text-[#0d2b1b]`} onClick={() => c.act({ type: "next" })}>
              Deal next round
            </button>
          )}
        </div>
      )}

      {/* me */}
      {me && (
        <div
          className={`rounded-2xl border p-3 transition ${
            myTurn ? "border-[#ffd54a]/70 bg-black/30 shadow-[0_0_16px_rgba(255,213,74,0.2)]" : "border-white/10 bg-black/20"
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className={`text-sm font-bold ${myTurn ? "text-[#ffd54a]" : "text-[#a9c7a0]"}`}>
                {myTurn ? "YOUR TURN" : "You"}
              </span>
              {me.id === dealerId && <span className="rounded bg-white/10 px-1 text-[10px] text-[#a9c7a0]">dealer</span>}
              {STATUS[me.status] && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS[me.status]!.cls}`}>
                  {STATUS[me.status]!.text}
                </span>
              )}
            </span>
            <span className="text-right text-xs text-[#a9c7a0]">
              <b className="text-lg text-[#eef3e6]">{me.total}</b>
              {v.phase === "playing" && me.status !== "bust" && (
                <span className="ml-1 text-sm font-bold text-[#b7f27a]">+{roundScore(me)}</span>
              )}
            </span>
          </div>
          <Hand v={v} p={me} size="md" />
          <Bar value={me.total} goal={v.goal} />

          {v.phase === "playing" && (
            <div className="mt-3 text-xs text-[#a9c7a0]">
              <span>
                {me.nums.length}/7 different numbers
                {me.chance && (
                  <span className="ml-2 text-[#f48fb1]">
                    <Heart size={12} className="mr-0.5 inline" fill="currentColor" />
                    protected
                  </span>
                )}
              </span>
            </div>
          )}

          {myTurn && (
            <>
              <p className="mt-1 text-xs text-[#cfe0c4]">
                Chance the next card busts you:{" "}
                <b className={odds > 0.3 ? "text-red-300" : odds > 0.15 ? "text-[#ffd54a]" : "text-[#b7f27a]"}>
                  {Math.round(odds * 100)}%
                </b>
                {me.chance && odds > 0 && " (your Second Chance would save you)"}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button className={`${btn} bg-[#b7f27a] text-lg text-[#0d2b1b]`} onClick={() => c.act({ type: "hit" })}>
                  Hit
                </button>
                <button
                  className={`${btn} border border-white/25 bg-black/30 text-lg`}
                  onClick={() => c.act({ type: "stay" })}
                >
                  Stay on {roundScore(me)}
                </button>
              </div>
            </>
          )}
          {v.phase === "playing" && !myTurn && !myChoice && me.status !== "in" && (
            <p className="mt-2 text-center text-xs text-[#a9c7a0]">
              {me.status === "bust" ? "Busted — wait for the next round." : "You're out of this round. Watch the others…"}
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl bg-black/20 p-3 text-xs text-[#a9c7a0]">
        {[...v.log]
          .reverse()
          .slice(0, 6)
          .map((l) => (
            <p key={l.id} className="py-0.5">
              {l.text}
            </p>
          ))}
      </div>
      <div className="flex items-center justify-center gap-2 text-[11px] text-white/40">
        <FrogHead size={18} /> 7 different numbers = Pepe 7 (+{BONUS})
      </div>
      {rules}
    </div>
  );
};

const Pepe7 = () => (
  <GamePage def={pepe7} meta={meta} lobbyExtra={(c, v) => <LobbyOptions c={c} v={v} />}>
    {(c, v) => <Game c={c} v={v} />}
  </GamePage>
);

export default Pepe7;
