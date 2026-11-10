// Shared screens for the frog games: name + create/join, the room lobby,
// connection banners and the page frame. Each game supplies its rules and
// renders its own table once the game has started.
import { ReactNode, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Bot, Copy, Share2, Users, X } from "lucide-react";
import { FrogHead } from "@/pepudo/Die";
import { BaseState, Controller, GameDef, useGuestGame, useHostGame } from "./net";

export interface GameMeta {
  /** Display name, e.g. "Pepudo". */
  name: string;
  /** Route without the hash, e.g. "/pepudo". */
  path: string;
  tagline: string;
  /** CSS background for the page. */
  background: string;
  rules: ReactNode;
}

type Mode = { kind: "home" } | { kind: "host"; online: boolean } | { kind: "guest"; code: string };
type AnyAction = { type: string };

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

export const btn =
  "rounded-xl px-4 py-3 font-bold tracking-wide transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100";

export const Felt = ({ children, background }: { children: ReactNode; background: string }) => (
  <div
    className="min-h-screen px-4 py-5 pb-16 text-[#eef3e6]"
    style={{ background, fontFamily: "'Exo 2', sans-serif" }}
  >
    <div className="mx-auto w-full max-w-md">{children}</div>
  </div>
);

export const Title = ({ name, small = false }: { name: string; small?: boolean }) => (
  <div className={`flex items-center justify-center gap-2 ${small ? "" : "mt-6 mb-2"}`}>
    <FrogHead size={small ? 30 : 56} />
    <h1
      className={`${small ? "text-xl" : "text-4xl"} font-black uppercase tracking-widest text-[#b7f27a]`}
      style={{ fontFamily: "'Orbitron', sans-serif", textShadow: "0 2px 0 #0a2117" }}
    >
      {name}
    </h1>
  </div>
);

export const Rules = ({ children }: { children: ReactNode }) => (
  <details className="mt-6 rounded-xl bg-black/20 px-4 py-3 text-sm text-[#cfe0c4]">
    <summary className="cursor-pointer font-semibold text-[#eef3e6]">How to play</summary>
    <ul className="mt-2 list-disc space-y-1.5 pl-5">{children}</ul>
  </details>
);

// ---------------------------------------------------------------- home

const Home = ({
  meta,
  onStart,
  initialRoom,
}: {
  meta: GameMeta;
  onStart: (m: Mode, name: string) => void;
  initialRoom: string;
}) => {
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
    <Felt background={meta.background}>
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-[#9fc79a] hover:text-white">
        <ArrowLeft size={16} /> gligor.xyz
      </Link>
      <Title name={meta.name} />
      <p className="text-center text-sm text-[#a9c7a0]">{meta.tagline}</p>

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

      {meta.rules}
    </Felt>
  );
};

// ---------------------------------------------------------------- lobby

function Lobby<S extends BaseState, A extends AnyAction>({
  c,
  v,
  meta,
  maxPlayers,
  extra,
  onLeave,
}: {
  c: Controller<S, A>;
  v: S;
  meta: GameMeta;
  maxPlayers: number;
  extra?: ReactNode;
  onLeave: () => void;
}) {
  const link = c.code ? `${window.location.origin}${window.location.pathname}#${meta.path}?room=${c.code}` : "";
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: meta.name, text: `Come play ${meta.name} 🐸`, url: link });
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
                {c.code
                  ? "Send your colleague the link (or the code), then come back to this page — the game runs here."
                  : "Opening room…"}
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
          Players ({v.players.length}/{maxPlayers})
        </p>
        <div className="space-y-2">
          {v.players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${p.bot || p.online ? "bg-[#7ee07e]" : "bg-red-400"}`} />
                <span className="truncate font-semibold">
                  {p.name}
                  {p.id === c.me && <span className="text-[#9fc79a]"> (you)</span>}
                </span>
              </div>
              {c.isHost && p.id !== c.me && c.kick && (
                <button onClick={() => c.kick!(p.id)} className="rounded-md p-1 hover:bg-white/10" aria-label="Remove">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {extra}

      {c.isHost ? (
        <div className="grid gap-2">
          <button
            className={`${btn} border border-white/20 bg-black/20`}
            disabled={v.players.length >= maxPlayers}
            onClick={c.addBot}
          >
            <Bot size={18} className="mr-1 inline" /> Add a bot
          </button>
          <button
            className={`${btn} bg-[#b7f27a] text-lg text-[#0d2b1b]`}
            disabled={v.players.length < 2}
            onClick={() => c.act({ type: "start" } as A)}
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
}

// ---------------------------------------------------------------- table frame

interface TableProps<S extends BaseState, A extends AnyAction> {
  def: GameDef<S, A>;
  meta: GameMeta;
  /** Extra lobby controls (e.g. game length). */
  lobbyExtra?: (c: Controller<S, A>, v: S) => ReactNode;
  /** The game itself, once started. */
  children: (c: Controller<S, A>, v: S) => ReactNode;
}

function Table<S extends BaseState, A extends AnyAction>({
  c,
  def,
  meta,
  lobbyExtra,
  children,
  onLeave,
}: TableProps<S, A> & { c: Controller<S, A>; onLeave: () => void }) {
  const v = c.view;
  const myTurn = !!v && v.phase !== "lobby" && def.toMove(v) === c.me;

  useEffect(() => {
    if (!myTurn) return;
    const prev = document.title;
    document.title = `🐸 Your turn! — ${meta.name}`;
    try {
      navigator.vibrate?.(120);
    } catch {
      /* ignore */
    }
    return () => {
      document.title = prev;
    };
  }, [myTurn, meta.name]);

  const statusBar =
    c.status === "connecting" ? (
      <p className="animate-pulse rounded-xl bg-black/30 p-3 text-center text-sm">
        {c.isHost ? (v && c.code ? "Reconnecting…" : "Opening room…") : v ? "Reconnecting…" : "Connecting…"}
      </p>
    ) : c.status === "no-host" ? (
      <p className="rounded-xl border border-[#e6a23c]/50 bg-[#e6a23c]/10 p-3 text-center text-sm">
        {v ? "Waiting for the host to come back…" : `Looking for room ${c.code}…`}
        <span className="mt-1 block text-xs text-[#cfe0c4]">
          The host needs to have the {meta.name} page open on their screen. Still trying.
        </span>
      </p>
    ) : c.status === "error" ? (
      <div className="rounded-xl border border-red-400/40 bg-red-900/30 p-3 text-center text-sm">
        {c.isHost ? "Couldn't open a room. Check your internet connection." : "Couldn't join this room."}{" "}
        <button className="font-bold underline" onClick={c.retry}>
          Try again
        </button>
      </div>
    ) : null;

  if (!v) {
    return (
      <Felt background={meta.background}>
        <Title name={meta.name} small />
        <div className="mt-8 space-y-3">
          {statusBar ?? <p className="animate-pulse text-center">Joining room {c.code}…</p>}
          <button className="w-full text-center text-sm text-[#9fc79a] underline" onClick={onLeave}>
            Back
          </button>
        </div>
      </Felt>
    );
  }

  return (
    <Felt background={meta.background}>
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onLeave} className="w-12 rounded-lg p-1 text-left text-[#9fc79a] hover:text-white" aria-label="Leave">
          <ArrowLeft size={20} />
        </button>
        <Title name={meta.name} small />
        <span className="w-12 text-right text-xs font-bold tracking-wider text-[#9fc79a]">{c.code ?? ""}</span>
      </div>
      {statusBar && <div className="mb-3">{statusBar}</div>}

      {v.phase === "lobby" ? (
        <Lobby c={c} v={v} meta={meta} maxPlayers={def.maxPlayers} extra={lobbyExtra?.(c, v)} onLeave={onLeave} />
      ) : (
        children(c, v)
      )}
    </Felt>
  );
}

function HostTable<S extends BaseState, A extends AnyAction>(
  props: TableProps<S, A> & { name: string; online: boolean; onLeave: () => void },
) {
  const c = useHostGame(props.def, props.name, props.online);
  return <Table {...props} c={c} />;
}

function GuestTable<S extends BaseState, A extends AnyAction>(
  props: TableProps<S, A> & { name: string; code: string; onLeave: () => void },
) {
  const c = useGuestGame(props.def, props.name, props.code);
  return <Table {...props} c={c} />;
}

/** A whole game page: home screen, then the lobby, then the game's own table. */
export function GamePage<S extends BaseState, A extends AnyAction>(props: TableProps<S, A>) {
  const { meta } = props;
  const [params, setParams] = useSearchParams();
  const room = (params.get("room") ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  const [mode, setMode] = useState<Mode>({ kind: "home" });
  const [name, setName] = useState("");

  useEffect(() => {
    const prev = document.title;
    document.title = `${meta.name} 🐸`;
    return () => {
      document.title = prev;
    };
  }, [meta.name]);

  const leave = () => {
    if (mode.kind !== "home" && !window.confirm("Leave this game?")) return;
    setMode({ kind: "home" });
    if (room) setParams({});
  };

  if (mode.kind === "host") return <HostTable {...props} name={name} online={mode.online} onLeave={leave} />;
  if (mode.kind === "guest") return <GuestTable {...props} name={name} code={mode.code} onLeave={leave} />;
  return (
    <Home
      meta={meta}
      initialRoom={room}
      onStart={(m, n) => {
        setName(n);
        setMode(m);
      }}
    />
  );
}
