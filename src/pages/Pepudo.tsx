import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Bot, Copy, Minus, Plus, Share2, Users, X } from "lucide-react";
import { Die, FrogHead } from "@/pepudo/Die";
import {
  GameState,
  MAX_PLAYERS,
  bidText,
  countFace,
  faceName,
  minQty,
  playerName,
  totalDice,
} from "@/pepudo/engine";
import { Controller, useGuestGame, useHostGame } from "@/pepudo/net";

type Mode = { kind: "home" } | { kind: "host"; online: boolean } | { kind: "guest"; code: string };

const loadName = () => {
  try {
    return localStorage.getItem("pepudo-name") ?? "";
  } catch {
    return "";
  }
};
const saveName = (n: string) => {
  try {
    localStorage.setItem("pepudo-name", n);
  } catch {
    /* ignore */
  }
};

const Felt = ({ children }: { children: React.ReactNode }) => (
  <div
    className="min-h-screen text-[#eef3e6] px-4 py-5 pb-16"
    style={{
      background: "radial-gradient(ellipse at top, #1f5a3c 0%, #123726 55%, #0a2117 100%)",
      fontFamily: "'Exo 2', sans-serif",
    }}
  >
    <div className="mx-auto w-full max-w-md">{children}</div>
  </div>
);

const Title = ({ small = false }: { small?: boolean }) => (
  <div className={`flex items-center justify-center gap-2 ${small ? "" : "mt-6 mb-2"}`}>
    <FrogHead size={small ? 30 : 56} />
    <h1
      className={`${small ? "text-xl" : "text-4xl"} font-black tracking-widest text-[#b7f27a]`}
      style={{ fontFamily: "'Orbitron', sans-serif", textShadow: "0 2px 0 #0a2117" }}
    >
      PEPUDO
    </h1>
  </div>
);

const btn =
  "rounded-xl px-4 py-3 font-bold tracking-wide transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100";

const Rules = () => (
  <details className="mt-6 rounded-xl bg-black/20 px-4 py-3 text-sm text-[#cfe0c4]">
    <summary className="cursor-pointer font-semibold text-[#eef3e6]">How to play</summary>
    <ul className="mt-2 list-disc space-y-1.5 pl-5">
      <li>Everyone has 5 hidden dice. Each round, take turns bidding how many dice of a face are on the whole table.</li>
      <li>
        <b>Pepes are wild</b> — they count as every other face.
      </li>
      <li>Raise with more dice, or the same amount of a higher face.</li>
      <li>Switching to Pepes: half the amount (rounded up) is enough. Back from Pepes: double + 1. You can't open on Pepes.</li>
      <li>
        <b>Dudo!</b> = "I doubt it". All dice are shown: if there are fewer than bid, the bidder loses a die, otherwise you do.
      </li>
      <li>
        <b>Calza!</b> = "exactly right". If spot on, you win a die back (max 5); otherwise you lose one.
      </li>
      <li>Whoever lost (or won) a die starts the next round. Last frog standing wins.</li>
    </ul>
  </details>
);

// ---------------------------------------------------------------- home

const Home = ({ onStart, initialRoom }: { onStart: (m: Mode, name: string) => void; initialRoom: string }) => {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(initialRoom);
  const cleanName = name.trim().slice(0, 16);
  const go = (m: Mode) => {
    if (!cleanName) {
      toast.error("Pick a name first");
      return;
    }
    saveName(cleanName);
    onStart(m, cleanName);
  };

  return (
    <Felt>
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-[#9fc79a] hover:text-white">
        <ArrowLeft size={16} /> gligor.xyz
      </Link>
      <Title />
      <p className="text-center text-sm text-[#a9c7a0]">Liar's dice with frogs. Bluff your colleagues.</p>

      <label className="mt-8 block text-xs font-semibold uppercase tracking-widest text-[#9fc79a]">Your name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={16}
        placeholder="e.g. Gligor"
        className="mt-1 w-full rounded-xl border border-[#3c6b4b] bg-black/30 px-4 py-3 text-lg outline-none focus:border-[#b7f27a]"
      />

      {initialRoom && (
        <div className="mt-6 rounded-2xl border border-[#b7f27a]/40 bg-black/20 p-4">
          <p className="text-sm text-[#cfe0c4]">
            You've been invited to room <b className="tracking-widest text-[#b7f27a]">{initialRoom}</b>
          </p>
          <button
            className={`${btn} mt-3 w-full bg-[#b7f27a] text-[#0d2b1b]`}
            onClick={() => go({ kind: "guest", code: initialRoom })}
          >
            Join game
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-3">
        <button className={`${btn} bg-[#b7f27a] text-[#0d2b1b]`} onClick={() => go({ kind: "host", online: true })}>
          <Users className="mr-2 inline" size={18} />
          Create online room
        </button>
        <button
          className={`${btn} border border-[#b7f27a]/50 bg-black/20 text-[#d9f5bd]`}
          onClick={() => go({ kind: "host", online: false })}
        >
          <Bot className="mr-2 inline" size={18} />
          Play against bots
        </button>
      </div>

      <div className="mt-6 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
          placeholder="ROOM"
          className="w-28 rounded-xl border border-[#3c6b4b] bg-black/30 px-3 py-3 text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-[#b7f27a]"
        />
        <button
          className={`${btn} flex-1 border border-[#b7f27a]/50 bg-black/20 text-[#d9f5bd]`}
          disabled={code.length !== 4}
          onClick={() => go({ kind: "guest", code })}
        >
          Join with code
        </button>
      </div>

      <Rules />
    </Felt>
  );
};

// ---------------------------------------------------------------- table

const DiceRow = ({ dice, count, size, face }: { dice: number[]; count: number; size: number; face?: number }) => (
  <div className="flex flex-wrap gap-1">
    {Array.from({ length: Math.max(count, dice.length) }, (_, i) => {
      const d = dice[i];
      const match = face !== undefined && d !== undefined && countFace([d], face) === 1;
      return <Die key={i} face={d} size={size} highlight={match} dim={face !== undefined && d !== undefined && !match} />;
    })}
  </div>
);

const Players = ({ v, me, isHost, kick }: { v: GameState; me: string; isHost: boolean; kick?: (id: string) => void }) => {
  const reveal = v.phase === "reveal" || v.phase === "over" ? v.reveal : null;
  return (
    <div className="space-y-2">
      {v.players.map((p) => {
        const turn = v.turn === p.id;
        const out = v.phase !== "lobby" && p.count === 0 && !(reveal && reveal.loser === p.id);
        const shown = reveal ? reveal.dice[p.id] ?? [] : p.dice;
        const shownCount = reveal ? shown.length : p.count;
        return (
          <div
            key={p.id}
            className={`rounded-xl border px-3 py-2 transition ${
              turn ? "border-[#ffd54a] bg-[#ffd54a]/10 shadow-[0_0_16px_rgba(255,213,74,0.25)]" : "border-white/10 bg-black/20"
            } ${out ? "opacity-40" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${p.bot || p.online ? "bg-[#7ee07e]" : "bg-red-400"}`} />
                <span className="truncate font-semibold">
                  {p.name}
                  {p.id === me && <span className="text-[#9fc79a]"> (you)</span>}
                </span>
                {turn && <span className="animate-pulse text-xs font-bold text-[#ffd54a]">thinking…</span>}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-[#a9c7a0]">
                {v.bid?.by === p.id && v.phase === "bidding" && (
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[#eef3e6]">{bidText(v.bid)}</span>
                )}
                {v.phase === "lobby" ? (
                  isHost && p.id !== me && kick && (
                    <button onClick={() => kick(p.id)} className="rounded-md p-1 hover:bg-white/10" aria-label="Remove">
                      <X size={16} />
                    </button>
                  )
                ) : (
                  <span>{out ? "out" : `${p.count} 🎲`}</span>
                )}
              </div>
            </div>
            {v.phase !== "lobby" && shownCount > 0 && p.id !== me && (
              <div className="mt-1.5">
                <DiceRow dice={shown} count={shownCount} size={22} face={reveal?.bid.face} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const BidControls = ({ v, act }: { v: GameState; act: Controller["act"] }) => {
  const total = totalDice(v);
  const me = v.players.find((p) => p.id === v.turn)!;
  const defaultFace = useMemo(() => {
    if (v.bid) return v.bid.face;
    let best = 2;
    for (let f = 2; f <= 6; f++) if (countFace(me.dice, f) > countFace(me.dice, best)) best = f;
    return best;
  }, [v.bid, me.dice]);

  const [face, setFace] = useState(defaultFace);
  const min = minQty(v.bid, face);
  const [qty, setQty] = useState(min ?? 1);

  useEffect(() => {
    let f = defaultFace;
    let m = minQty(v.bid, f);
    if (m === null || m > total) {
      for (let x = 2; x <= 6 && (m === null || m > total); x++) {
        f = x;
        m = minQty(v.bid, x);
      }
    }
    setFace(f);
    setQty(m ?? 1);
  }, [v.bid, defaultFace, total]);

  const pickFace = (f: number) => {
    const m = minQty(v.bid, f);
    if (m === null || m > total) return;
    setFace(f);
    setQty(m);
  };

  const canBid = min !== null && qty >= min && qty <= total;

  return (
    <div className="rounded-2xl border border-[#ffd54a]/50 bg-black/30 p-4">
      <p className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-[#ffd54a]">Your turn</p>

      <div className="flex items-center justify-center gap-3">
        <button
          className="rounded-full bg-white/10 p-3 disabled:opacity-30"
          disabled={min === null || qty <= min}
          onClick={() => setQty((q) => q - 1)}
          aria-label="Less"
        >
          <Minus size={20} />
        </button>
        <div className="flex items-center gap-2 text-4xl font-black tabular-nums">
          {qty} <span className="text-2xl text-[#a9c7a0]">×</span> <Die face={face} size={48} />
        </div>
        <button
          className="rounded-full bg-white/10 p-3 disabled:opacity-30"
          disabled={qty >= total}
          onClick={() => setQty((q) => q + 1)}
          aria-label="More"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="mt-4 flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5, 6].map((f) => {
          const m = minQty(v.bid, f);
          const ok = m !== null && m <= total;
          return (
            <button
              key={f}
              disabled={!ok}
              onClick={() => pickFace(f)}
              className={`rounded-xl p-1 transition disabled:opacity-25 ${face === f ? "bg-[#ffd54a]/30 ring-2 ring-[#ffd54a]" : ""}`}
            >
              <Die face={f} size={38} />
            </button>
          );
        })}
      </div>

      <button
        className={`${btn} mt-4 w-full bg-[#b7f27a] text-lg text-[#0d2b1b]`}
        disabled={!canBid}
        onClick={() => act({ type: "bid", qty, face })}
      >
        Bid {bidText({ qty, face })}
      </button>

      {v.bid && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button className={`${btn} bg-[#e2483d] text-white`} onClick={() => act({ type: "dudo" })}>
            DUDO!
            <span className="block text-[11px] font-normal opacity-80">that's a lie</span>
          </button>
          <button className={`${btn} bg-[#e6a23c] text-[#2a1a05]`} onClick={() => act({ type: "calza" })}>
            CALZA!
            <span className="block text-[11px] font-normal opacity-80">exactly right</span>
          </button>
        </div>
      )}
    </div>
  );
};

const RevealPanel = ({ v, act }: { v: GameState; act: Controller["act"] }) => {
  const r = v.reveal!;
  const over = v.phase === "over";
  const won = r.actual >= r.bid.qty;
  return (
    <div className="rounded-2xl border border-white/20 bg-black/30 p-4 text-center">
      <p className="text-sm text-[#a9c7a0]">
        {playerName(v, r.caller)} called <b className="text-white">{r.kind === "dudo" ? "DUDO" : "CALZA"}</b> on{" "}
        {playerName(v, r.bid.by)}'s {bidText(r.bid)}
      </p>
      <p className="mt-2 flex items-center justify-center gap-2 text-3xl font-black">
        There {r.actual === 1 ? "was" : "were"} {r.actual} <Die face={r.bid.face} size={36} />
      </p>
      <p className="mt-1 text-xs text-[#a9c7a0]">{r.bid.face !== 1 && "(Pepes count as wild)"}</p>
      <p className={`mt-3 text-lg font-bold ${r.gainer ? "text-[#b7f27a]" : "text-[#ff8a80]"}`}>
        {r.loser
          ? `${playerName(v, r.loser)} loses a die${r.kind === "dudo" ? (won ? " — the bid was good!" : " — caught bluffing!") : ""}`
          : `Spot on! ${playerName(v, r.gainer)} wins a die`}
      </p>
      {over ? (
        <div className="mt-4">
          <p className="text-2xl font-black text-[#ffd54a]">👑 {playerName(v, v.winner)} wins!</p>
          <button className={`${btn} mt-3 w-full bg-[#b7f27a] text-[#0d2b1b]`} onClick={() => act({ type: "rematch" })}>
            Rematch
          </button>
        </div>
      ) : (
        <button className={`${btn} mt-4 w-full bg-[#b7f27a] text-[#0d2b1b]`} onClick={() => act({ type: "next" })}>
          Next round →
        </button>
      )}
    </div>
  );
};

const Lobby = ({ c, v, onLeave }: { c: Controller; v: GameState; onLeave: () => void }) => {
  const link = c.code ? `${window.location.origin}${window.location.pathname}#/pepudo?room=${c.code}` : "";
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Pepudo", text: "Come play Pepudo 🐸🎲", url: link });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast(link);
    }
  };
  const online = c.status !== "offline";

  return (
    <div className="space-y-4">
      {online && (
        <div className="rounded-2xl border border-[#b7f27a]/40 bg-black/25 p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-[#9fc79a]">Room code</p>
          <p className="my-1 text-5xl font-black tracking-[0.3em] text-[#b7f27a]">{c.code ?? "····"}</p>
          {c.isHost && (
            <>
              <p className="text-xs text-[#a9c7a0]">
                {c.code ? "Send your colleague the link (or the code)." : "Opening room…"}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className={`${btn} bg-[#b7f27a] py-2 text-[#0d2b1b]`} disabled={!c.code} onClick={share}>
                  <Share2 size={16} className="mr-1 inline" /> Share link
                </button>
                <button
                  className={`${btn} border border-white/20 py-2`}
                  disabled={!c.code}
                  onClick={() => navigator.clipboard?.writeText(c.code!).then(() => toast.success("Code copied"))}
                >
                  <Copy size={16} className="mr-1 inline" /> Copy code
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs uppercase tracking-widest text-[#9fc79a]">
          Players ({v.players.length}/{MAX_PLAYERS})
        </p>
        <Players v={v} me={c.me} isHost={c.isHost} kick={c.kick} />
      </div>

      {c.isHost ? (
        <div className="grid gap-2">
          <button
            className={`${btn} border border-white/20 bg-black/20`}
            disabled={v.players.length >= MAX_PLAYERS}
            onClick={c.addBot}
          >
            <Bot size={18} className="mr-1 inline" /> Add a bot
          </button>
          <button
            className={`${btn} bg-[#b7f27a] text-lg text-[#0d2b1b]`}
            disabled={v.players.length < 2}
            onClick={() => c.act({ type: "start" })}
          >
            {v.players.length < 2 ? "Waiting for players…" : "Start game"}
          </button>
        </div>
      ) : (
        <p className="animate-pulse text-center text-[#a9c7a0]">Waiting for the host to start…</p>
      )}
      <button className="w-full text-center text-sm text-[#9fc79a] underline" onClick={onLeave}>
        Leave
      </button>
    </div>
  );
};

const Table = ({ c, onLeave }: { c: Controller; onLeave: () => void }) => {
  const v = c.view;
  const myTurn = v?.phase === "bidding" && v.turn === c.me;

  useEffect(() => {
    if (!myTurn) return;
    const prev = document.title;
    document.title = "🐸 Your turn! — Pepudo";
    try {
      navigator.vibrate?.(120);
    } catch {
      /* ignore */
    }
    return () => {
      document.title = prev;
    };
  }, [myTurn]);

  const statusBar =
    c.status === "connecting" ? (
      <p className="rounded-xl bg-black/30 p-3 text-center text-sm">Connecting…</p>
    ) : c.status === "error" || c.status === "closed" ? (
      <div className="rounded-xl border border-red-400/40 bg-red-900/30 p-3 text-center text-sm">
        {c.status === "closed" ? "Lost connection to the host." : "Couldn't connect."}{" "}
        <button className="font-bold underline" onClick={c.retry}>
          Retry
        </button>
      </div>
    ) : null;

  if (!v) {
    return (
      <Felt>
        <Title small />
        <div className="mt-8 space-y-3">
          {statusBar ?? <p className="text-center">Joining room {c.code}…</p>}
          <button className="w-full text-center text-sm text-[#9fc79a] underline" onClick={onLeave}>
            Back
          </button>
        </div>
      </Felt>
    );
  }

  const meP = v.players.find((p) => p.id === c.me);
  const reveal = v.phase === "reveal" || v.phase === "over";
  const myDice = reveal && v.reveal ? v.reveal.dice[c.me] ?? [] : meP?.dice ?? [];

  return (
    <Felt>
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onLeave} className="rounded-lg p-1 text-[#9fc79a] hover:text-white" aria-label="Leave">
          <ArrowLeft size={20} />
        </button>
        <Title small />
        <span className="w-12 text-right text-xs font-bold tracking-wider text-[#9fc79a]">{c.code ?? ""}</span>
      </div>
      {statusBar && <div className="mb-3">{statusBar}</div>}

      {v.phase === "lobby" ? (
        <Lobby c={c} v={v} onLeave={onLeave} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-[#9fc79a]">
            <span>Round {v.round}</span>
            <span>{totalDice(v)} {totalDice(v) === 1 ? "die" : "dice"} on the table</span>
          </div>

          {v.phase === "bidding" && (
            <div className="rounded-2xl bg-black/25 p-3 text-center">
              {v.bid ? (
                <>
                  <p className="text-xs uppercase tracking-widest text-[#9fc79a]">{playerName(v, v.bid.by)} bids</p>
                  <p className="mt-1 flex items-center justify-center gap-2 text-4xl font-black">
                    {v.bid.qty} <span className="text-2xl text-[#a9c7a0]">×</span> <Die face={v.bid.face} size={44} />
                  </p>
                </>
              ) : (
                <p className="py-3 text-[#cfe0c4]">{playerName(v, v.turn)} opens the bidding…</p>
              )}
            </div>
          )}

          {reveal && v.reveal && <RevealPanel v={v} act={c.act} />}

          {meP && (myDice.length > 0 || meP.count > 0) && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-xs uppercase tracking-widest text-[#9fc79a]">Your dice</p>
              <DiceRow dice={myDice} count={myDice.length} size={46} face={reveal ? v.reveal?.bid.face : undefined} />
            </div>
          )}
          {meP && meP.count === 0 && !reveal && (
            <p className="text-center text-[#a9c7a0]">You're out — enjoy the show 🐸</p>
          )}

          {myTurn && <BidControls key={v.round} v={v} act={c.act} />}

          <Players v={v} me={c.me} isHost={c.isHost} />

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
          <Rules />
        </div>
      )}
    </Felt>
  );
};

const HostTable = ({ name, online, onLeave }: { name: string; online: boolean; onLeave: () => void }) => {
  const c = useHostGame(name, online);
  return <Table c={c} onLeave={onLeave} />;
};

const GuestTable = ({ name, code, onLeave }: { name: string; code: string; onLeave: () => void }) => {
  const c = useGuestGame(name, code);
  return <Table c={c} onLeave={onLeave} />;
};

const Pepudo = () => {
  const [params, setParams] = useSearchParams();
  const room = (params.get("room") ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  const [mode, setMode] = useState<Mode>({ kind: "home" });
  const [name, setName] = useState("");

  useEffect(() => {
    const prev = document.title;
    document.title = "Pepudo 🐸";
    return () => {
      document.title = prev;
    };
  }, []);

  const leave = () => {
    if (mode.kind !== "home" && !window.confirm("Leave this game?")) return;
    setMode({ kind: "home" });
    if (room) setParams({});
  };

  if (mode.kind === "host") return <HostTable name={name} online={mode.online} onLeave={leave} />;
  if (mode.kind === "guest") return <GuestTable name={name} code={mode.code} onLeave={leave} />;
  return (
    <Home
      initialRoom={room}
      onStart={(m, n) => {
        setName(n);
        setMode(m);
      }}
    />
  );
};

export default Pepudo;
