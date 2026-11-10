// Multiplayer over WebRTC via PeerJS (uses the free public PeerJS broker for
// the handshake only; game traffic goes directly between browsers). The host's
// browser runs the game and sends every guest a view with only their own dice.
import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { DataConnection } from "peerjs";
import { toast } from "sonner";
import { Action, GameState, addPlayer, apply, newGame, removePlayer, setOnline, viewFor } from "./engine";
import { botMove, botName } from "./bot";

const PEER_PREFIX = "gligor-pepudo-";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ";

type ToHost = { t: "hello"; pid: string; name: string } | { t: "action"; action: Action };
type ToGuest = { t: "state"; state: GameState } | { t: "error"; msg: string };

export type NetStatus = "offline" | "connecting" | "open" | "error" | "closed";

export interface Controller {
  view: GameState | null;
  me: string;
  isHost: boolean;
  code: string | null;
  status: NetStatus;
  act: (a: Action) => void;
  addBot?: () => void;
  kick?: (id: string) => void;
  retry?: () => void;
}

// Optional self-hosted PeerJS broker (VITE_PEER_HOST=host[:port]); defaults to the free cloud one.
const peerOptions = () => {
  const env = import.meta.env.VITE_PEER_HOST as string | undefined;
  if (!env) return { debug: 1 };
  const [host, port] = env.split(":");
  const local = host === "localhost" || host === "127.0.0.1";
  return { debug: 1, host, port: port ? Number(port) : local ? 9000 : 443, secure: !local, path: "/" };
};

const FATAL = ["network", "server-error", "socket-error", "socket-closed", "browser-incompatible", "ssl-unavailable"];

const randomCode = () =>
  Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

/** Stable per-tab player id, so a page reload rejoins the same seat. */
export function getPid(): string {
  const make = () => `p-${Math.random().toString(36).slice(2, 10)}`;
  try {
    let id = sessionStorage.getItem("pepudo-pid");
    if (!id) {
      id = make();
      sessionStorage.setItem("pepudo-pid", id);
    }
    return id;
  } catch {
    return make();
  }
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useHostGame(name: string, online: boolean): Controller {
  const [me] = useState(getPid);
  const [state, setState] = useState<GameState>(() => addPlayer(newGame(), { id: me, name, bot: false }));
  const stateRef = useRef(state);
  const conns = useRef(new Map<string, DataConnection>());
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<NetStatus>(online ? "connecting" : "offline");
  const [attempt, setAttempt] = useState(0);

  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
    conns.current.forEach((c, pid) => {
      if (c.open) c.send({ t: "state", state: viewFor(next, pid) } satisfies ToGuest);
    });
  }, []);

  const run = useCallback(
    (pid: string, a: Action): string | null => {
      try {
        commit(apply(stateRef.current, pid, a));
        return null;
      } catch (e) {
        return errMsg(e);
      }
    },
    [commit],
  );

  // Network: open a room and accept guests.
  useEffect(() => {
    if (!online) return;
    let destroyed = false;
    const roomCode = randomCode();
    const peer = new Peer(PEER_PREFIX + roomCode, peerOptions());
    let opened = false;
    let reconnects = 0;
    setStatus("connecting");

    peer.on("open", () => {
      opened = true;
      reconnects = 0;
      setCode(roomCode);
      setStatus("open");
    });
    // Lost the broker (not the players): try to get back so new guests can still join.
    peer.on("disconnected", () => {
      if (!destroyed && opened && reconnects++ < 5) setTimeout(() => !destroyed && peer.reconnect(), 1500);
    });
    peer.on("error", (err) => {
      if (err.type === "unavailable-id") {
        peer.destroy();
        setAttempt((n) => n + 1);
        return;
      }
      if (err.type === "peer-unavailable") return; // a guest vanished; harmless
      if (destroyed) return;
      if (FATAL.includes(err.type) && !opened) {
        setStatus("error");
        toast.error("Couldn't open a room — the network may block it. Try again or use another connection.");
      } else if (!FATAL.includes(err.type)) {
        toast.error(`Connection problem: ${err.message}`);
      }
    });

    peer.on("connection", (conn) => {
      let pid: string | null = null;
      const send = (m: ToGuest) => conn.open && conn.send(m);

      conn.on("data", (raw) => {
        const msg = raw as ToHost;
        if (msg?.t === "hello" && typeof msg.pid === "string") {
          const guestName = String(msg.name || "Guest").slice(0, 16);
          const s = stateRef.current;
          const existing = s.players.find((p) => p.id === msg.pid);
          if (existing) {
            pid = msg.pid;
            conns.current.get(pid)?.close();
            conns.current.set(pid, conn);
            commit(setOnline(s, pid, true, s.phase === "lobby" ? guestName : undefined));
          } else {
            try {
              const next = addPlayer(s, { id: msg.pid, name: guestName, bot: false });
              pid = msg.pid;
              conns.current.set(pid, conn);
              commit(next);
              toast(`${guestName} joined`);
            } catch (e) {
              send({ t: "error", msg: errMsg(e) });
              setTimeout(() => conn.close(), 500);
            }
          }
        } else if (msg?.t === "action" && pid) {
          const err = run(pid, msg.action);
          if (err) send({ t: "error", msg: err });
        }
      });

      conn.on("close", () => {
        if (!pid || conns.current.get(pid) !== conn) return;
        conns.current.delete(pid);
        const s = stateRef.current;
        const who = s.players.find((p) => p.id === pid);
        if (!who) return;
        commit(s.phase === "lobby" ? removePlayer(s, pid) : setOnline(s, pid, false));
        toast(`${who.name} left`);
      });
    });

    const map = conns.current;
    return () => {
      destroyed = true;
      map.forEach((c) => c.close());
      map.clear();
      peer.destroy();
    };
  }, [online, attempt, commit, run]);

  // Bots play their turns; a disconnected human gets auto-played after a while.
  useEffect(() => {
    if (state.phase !== "bidding" || !state.turn) return;
    const p = state.players.find((x) => x.id === state.turn);
    if (!p || (!p.bot && p.online)) return;
    const delay = p.bot ? 900 + Math.random() * 1300 : 12000;
    const t = setTimeout(() => {
      const s = stateRef.current;
      if (s.phase !== "bidding" || s.turn !== p.id) return;
      if (run(p.id, botMove(s, p.id))) run(p.id, { type: "dudo" });
    }, delay);
    return () => clearTimeout(t);
  }, [state, run]);

  const act = useCallback(
    (a: Action) => {
      const err = run(me, a);
      if (err) toast.error(err);
    },
    [run, me],
  );

  const addBot = useCallback(() => {
    const s = stateRef.current;
    try {
      const id = `bot-${Math.random().toString(36).slice(2, 8)}`;
      commit(addPlayer(s, { id, name: botName(s.players.map((p) => p.name)), bot: true }));
    } catch (e) {
      toast.error(errMsg(e));
    }
  }, [commit]);

  const kick = useCallback(
    (id: string) => {
      try {
        conns.current.get(id)?.close();
        conns.current.delete(id);
        commit(removePlayer(stateRef.current, id));
      } catch (e) {
        toast.error(errMsg(e));
      }
    },
    [commit],
  );

  return {
    view: viewFor(state, me),
    me,
    isHost: true,
    code,
    status,
    act,
    addBot,
    kick,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function useGuestGame(name: string, code: string): Controller {
  const [me] = useState(getPid);
  const [view, setView] = useState<GameState | null>(null);
  const [status, setStatus] = useState<NetStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  const connRef = useRef<DataConnection | null>(null);

  useEffect(() => {
    let destroyed = false;
    setStatus("connecting");
    const peer = new Peer(peerOptions());

    peer.on("open", () => {
      const conn = peer.connect(PEER_PREFIX + code, { reliable: true });
      connRef.current = conn;
      conn.on("open", () => {
        setStatus("open");
        conn.send({ t: "hello", pid: me, name } satisfies ToHost);
      });
      conn.on("data", (raw) => {
        const msg = raw as ToGuest;
        if (msg?.t === "state") setView(msg.state);
        else if (msg?.t === "error") toast.error(msg.msg);
      });
      conn.on("close", () => {
        if (!destroyed) setStatus("closed");
      });
    });
    peer.on("error", (err) => {
      if (destroyed) return;
      if (err.type === "disconnected" || (connRef.current?.open && FATAL.includes(err.type))) return; // broker hiccup; the game link is direct
      toast.error(err.type === "peer-unavailable" ? `Room ${code} not found (or the host left).` : `Connection problem: ${err.message}`);
      setStatus("error");
    });

    return () => {
      destroyed = true;
      connRef.current = null;
      peer.destroy();
    };
  }, [code, name, me, attempt]);

  const act = useCallback((a: Action) => {
    const c = connRef.current;
    if (c?.open) c.send({ t: "action", action: a } satisfies ToHost);
    else toast.error("Not connected to the host.");
  }, []);

  return { view, me, isHost: false, code, status, act, retry: () => setAttempt((n) => n + 1) };
}
