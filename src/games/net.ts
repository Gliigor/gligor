// Online play, shared by all the games. The host's browser runs the game; guests send their moves to
// the host and get back a view with only their own dice. Messages travel
// through a relay (see relay.ts) and are encrypted per guest (see crypto.ts).
//
// The link is built to survive phones: guests keep knocking until the host
// answers, both sides resync every few seconds, and sockets are re-opened
// when a backgrounded page comes back.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sealed, loadIdentity, pidOf, seal, sharedKey, unseal } from "./crypto";
import { Relay, openRelay } from "./relay";

export interface BasePlayer {
  id: string;
  name: string;
  bot: boolean;
  online: boolean;
}

export interface BaseState {
  /** "lobby" before the game starts; anything else once it's running. */
  phase: string;
  players: BasePlayer[];
}

/** Everything the networking needs to know about a game. */
export interface GameDef<S extends BaseState, A extends { type: string }> {
  /** Short id, used for relay topics. */
  id: string;
  maxPlayers: number;
  create: () => S;
  addPlayer: (s: S, p: { id: string; name: string; bot: boolean }) => S;
  removePlayer: (s: S, id: string) => S;
  /** Applies a move; throws an Error with a friendly message if it isn't allowed. */
  apply: (s: S, pid: string, a: A) => S;
  /** What one player is allowed to see. */
  viewFor: (s: S, pid: string) => S;
  /** Action types only the host may send. */
  hostOnly: string[];
  /** The player the game is waiting on right now, or null. */
  toMove: (s: S) => string | null;
  botMove: (s: S, pid: string) => A;
  /** A move that is always legal, in case the bot picks a bad one. */
  safeMove: (s: S, pid: string) => A;
  botName: (taken: string[]) => string;
  /** How long a bot "thinks", in ms. Gets the state so it can wait for an animation to finish. */
  botDelay: (s: S) => number;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ";

const SYNC_EVERY = 8000; // guest -> host heartbeat
const HOST_SILENT = 20000; // guest gives up waiting and knocks again
const GUEST_SILENT = 25000; // host marks a guest as gone
const AWAY_GRACE = 12000; // a disconnected player's turn is auto-played after this

// guest -> host (plain): knock on the door.  guest -> host (sealed): GuestBody.
type Hello = { t: "hello"; pid: string; pub: string; name: string; n: number };
type GuestBody<A> = { n: number } & ({ k: "action"; action: A } | { k: "sync"; sv: number } | { k: "bye" });
// host -> guest (plain): Welcome with the host's public key.  host -> guest (sealed): HostBody.
type HostBody<S> = { v: number } & (
  | { k: "state"; sv: number; state: S }
  | { k: "ok" }
  | { k: "error"; msg: string }
  | { k: "reject"; msg: string }
);

/** offline = bots only · connecting = reaching the relay · no-host = relay ok, host silent */
export type NetStatus = "offline" | "connecting" | "open" | "no-host" | "error";

export interface Controller<S extends BaseState, A extends { type: string }> {
  view: S | null;
  me: string;
  isHost: boolean;
  code: string | null;
  status: NetStatus;
  act: (a: A) => void;
  addBot?: () => void;
  kick?: (id: string) => void;
  retry?: () => void;
}

const setOnline = <S extends BaseState>(s: S, id: string, online: boolean, name?: string): S => ({
  ...s,
  players: s.players.map((p) => (p.id === id ? { ...p, online, name: name ?? p.name } : p)),
});

const trimLog = <S,>(view: S): S => {
  const log = (view as { log?: unknown }).log;
  return Array.isArray(log) ? { ...view, log: log.slice(-12) } : view;
};

const hostTopic = (game: string, code: string) => `gligor-${game}/v1/${code}/host`;
const guestTopic = (game: string, code: string, pid: string) => `gligor-${game}/v1/${code}/p/${pid}`;

const randomCode = () =>
  Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const parse = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

interface Guest {
  key: CryptoKey;
  lastN: number;
  seen: number;
}

export function useHostGame<S extends BaseState, A extends { type: string }>(
  def: GameDef<S, A>,
  name: string,
  online: boolean,
): Controller<S, A> {
  const [me] = useState(() => `host-${Math.random().toString(36).slice(2, 10)}`);
  const [state, setState] = useState<S>(() => def.addPlayer(def.create(), { id: me, name, bot: false }));
  const stateRef = useRef(state);
  const sv = useRef(0); // state version, so guests can tell if they're behind
  const seq = useRef(Date.now()); // message counter, to drop duplicates
  const guests = useRef(new Map<string, Guest>());
  const relay = useRef<Relay | null>(null);
  const codeRef = useRef("");
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<NetStatus>(online ? "connecting" : "offline");
  const [attempt, setAttempt] = useState(0);

  const sendTo = useCallback(
    async (pid: string, body: Record<string, unknown>) => {
    const g = guests.current.get(pid);
    if (!g || !relay.current) return;
    const sealed = await seal(g.key, { ...body, v: ++seq.current });
    relay.current?.publish(guestTopic(def.id, codeRef.current, pid), JSON.stringify({ t: "m", ...sealed }));
    },
    [def],
  );

  const sendState = useCallback(
    (pid: string) => {
      return sendTo(pid, { k: "state", sv: sv.current, state: trimLog(def.viewFor(stateRef.current, pid)) });
    },
    [sendTo, def],
  );

  const commit = useCallback(
    (next: S) => {
      stateRef.current = next;
      sv.current++;
      setState(next);
      guests.current.forEach((_, pid) => void sendState(pid));
    },
    [sendState],
  );

  const run = useCallback(
    (pid: string, a: A): string | null => {
      try {
        commit(def.apply(stateRef.current, pid, a));
        return null;
      } catch (e) {
        return errMsg(e);
      }
    },
    [commit, def],
  );

  // Network: open a room and listen for guests.
  useEffect(() => {
    if (!online) return;
    let dead = false;
    const room = randomCode();
    codeRef.current = room;
    setStatus("connecting");
    const identity = loadIdentity();
    const helloSeen = new Map<string, number>();

    const drop = (pid: string) => {
      guests.current.delete(pid);
      const s = stateRef.current;
      const who = s.players.find((p) => p.id === pid);
      if (!who) return;
      commit(s.phase === "lobby" ? def.removePlayer(s, pid) : setOnline(s, pid, false));
      toast(`${who.name} left`);
    };

    const onHello = async (msg: Hello) => {
      if (typeof msg.pid !== "string" || typeof msg.pub !== "string" || typeof msg.n !== "number") return;
      if (msg.n <= (helloSeen.get(msg.pid) ?? 0)) return; // same knock via another broker
      if ((await pidOf(msg.pub)) !== msg.pid) return;
      helloSeen.set(msg.pid, msg.n);
      const { pub, priv } = await identity;
      const key = await sharedKey(priv, msg.pub);
      if (dead) return;
      const known = guests.current.get(msg.pid);
      // Anything the guest sealed before this knock is stale (e.g. a late "bye" from a previous visit).
      guests.current.set(msg.pid, { key, lastN: Math.max(known?.lastN ?? 0, msg.n), seen: Date.now() });
      relay.current?.publish(guestTopic(def.id, room, msg.pid), JSON.stringify({ t: "welcome", pub }));

      const guestName = String(msg.name || "Guest").slice(0, 16);
      const s = stateRef.current;
      const existing = s.players.find((p) => p.id === msg.pid);
      if (existing) {
        const rename = s.phase === "lobby" && existing.name !== guestName;
        if (!existing.online || rename) commit(setOnline(s, msg.pid, true, rename ? guestName : undefined));
        else void sendState(msg.pid);
        return;
      }
      try {
        commit(def.addPlayer(s, { id: msg.pid, name: guestName, bot: false }));
        toast(`${guestName} joined`);
      } catch (e) {
        await sendTo(msg.pid, { k: "reject", msg: errMsg(e) });
        guests.current.delete(msg.pid);
      }
    };

    const onSealed = async (msg: { pid: string } & Sealed) => {
      const g = guests.current.get(msg.pid);
      if (!g) return;
      let body: GuestBody<A>;
      try {
        body = await unseal<GuestBody<A>>(g.key, msg);
      } catch {
        return;
      }
      if (dead || !(body.n > g.lastN)) return;
      g.lastN = body.n;
      g.seen = Date.now();
      const s = stateRef.current;
      const player = s.players.find((p) => p.id === msg.pid);
      if (!player) return;
      if (body.k === "bye") return drop(msg.pid);
      if (!player.online) commit(setOnline(s, msg.pid, true));
      if (body.k === "action") {
        const ok = body.action && typeof body.action.type === "string" && !def.hostOnly.includes(body.action.type);
        const err = ok ? run(msg.pid, body.action) : "Only the host can do that.";
        if (err) void sendTo(msg.pid, { k: "error", msg: err });
      } else if (body.k === "sync") {
        if (body.sv !== sv.current) void sendState(msg.pid);
        else void sendTo(msg.pid, { k: "ok" });
      }
    };

    // Handle messages strictly one at a time, so a join and a move can't interleave.
    let queue: Promise<unknown> = Promise.resolve();
    const r = openRelay(
      [hostTopic(def.id, room)],
      (_topic, payload) => {
        const msg = parse(payload);
        if (!msg || dead) return;
        queue = queue
          .then(() => (msg.t === "hello" ? onHello(msg) : msg.t === "m" ? onSealed(msg) : undefined))
          .catch(() => undefined);
      },
      (links) => {
        if (dead) return;
        if (links > 0) {
          setCode(room);
          setStatus("open");
          guests.current.forEach((_, pid) => void sendState(pid)); // catch everyone up after a reconnect
        } else {
          setStatus((s) => (s === "error" ? s : "connecting"));
        }
      },
    );
    relay.current = r;

    const giveUp = setTimeout(() => setStatus((s) => (s === "connecting" ? "error" : s)), 15000);
    const sweep = setInterval(() => {
      const s = stateRef.current;
      guests.current.forEach((g, pid) => {
        if (Date.now() - g.seen < GUEST_SILENT) return;
        const p = s.players.find((x) => x.id === pid);
        if (s.phase === "lobby") drop(pid);
        else if (p?.online) commit(setOnline(stateRef.current, pid, false));
      });
    }, 5000);

    const all = guests.current;
    return () => {
      dead = true;
      clearTimeout(giveUp);
      clearInterval(sweep);
      const goodbyes = [...all.keys()].map((pid) => sendTo(pid, { k: "reject", msg: "The host closed the room." }));
      void Promise.allSettled(goodbyes).then(() => {
        all.clear();
        r.close();
        if (relay.current === r) relay.current = null;
      });
    };
  }, [online, attempt, commit, run, sendState, sendTo, def]);

  // Bots play their turns; a disconnected human gets auto-played after a while.
  const takenOver = useRef<string | null>(null);
  useEffect(() => {
    if (state.phase === "lobby") return;
    const turn = def.toMove(state);
    const p = state.players.find((x) => x.id === turn);
    if (!p || (!p.bot && p.online)) {
      takenOver.current = null;
      return;
    }
    const delay = p.bot || takenOver.current === p.id ? def.botDelay(state) : AWAY_GRACE;
    const t = setTimeout(() => {
      const s = stateRef.current;
      if (def.toMove(s) !== p.id) return;
      takenOver.current = p.id;
      if (run(p.id, def.botMove(s, p.id))) run(p.id, def.safeMove(s, p.id));
    }, delay);
    return () => clearTimeout(t);
  }, [state, run, def]);

  const act = useCallback(
    (a: A) => {
      const err = run(me, a);
      if (err) toast.error(err);
    },
    [run, me],
  );

  const addBot = useCallback(() => {
    const s = stateRef.current;
    try {
      const id = `bot-${Math.random().toString(36).slice(2, 8)}`;
      commit(def.addPlayer(s, { id, name: def.botName(s.players.map((p) => p.name)), bot: true }));
    } catch (e) {
      toast.error(errMsg(e));
    }
  }, [commit, def]);

  const kick = useCallback(
    (id: string) => {
      try {
        void sendTo(id, { k: "reject", msg: "The host removed you from the room." }).then(() =>
          guests.current.delete(id),
        );
        commit(def.removePlayer(stateRef.current, id));
      } catch (e) {
        toast.error(errMsg(e));
      }
    },
    [commit, sendTo, def],
  );

  return {
    view: def.viewFor(state, me),
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

export function useGuestGame<S extends BaseState, A extends { type: string }>(
  def: GameDef<S, A>,
  name: string,
  code: string,
): Controller<S, A> {
  const [me, setMe] = useState("");
  const [view, setView] = useState<S | null>(null);
  const [status, setStatus] = useState<NetStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  const post = useRef<((body: Record<string, unknown>) => Promise<boolean>) | null>(null);

  useEffect(() => {
    let dead = false;
    let done = false; // rejected / room closed: stop knocking
    let key: CryptoKey | null = null;
    let hostPub = "";
    let lastV = 0;
    let sv = -1;
    let n = Date.now();
    let heard = 0;
    let lastSync = 0;
    let linkedAt = 0;
    let links = 0;
    let r: Relay | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    setStatus("connecting");
    setView(null);

    void (async () => {
      const id = await loadIdentity("pepe-games-id");
      if (dead) return;
      setMe(id.pid);
      const toHost = hostTopic(def.id, code);

      const send = async (body: Record<string, unknown>) => {
        if (!key || !r || links === 0) return false;
        const sealed = await seal(key, { ...body, n: ++n });
        r.publish(toHost, JSON.stringify({ t: "m", pid: id.pid, ...sealed }));
        return true;
      };
      post.current = send;

      const tick = () => {
        if (dead || done || !r || links === 0) return;
        const now = Date.now();
        const silent = now - Math.max(heard, linkedAt) > (key ? HOST_SILENT : 8000);
        if (silent) setStatus("no-host");
        if (!key || silent) {
          r.publish(toHost, JSON.stringify({ t: "hello", pid: id.pid, pub: id.pub, name, n: ++n } satisfies Hello));
        } else if (now - lastSync >= SYNC_EVERY) {
          lastSync = now;
          void send({ k: "sync", sv });
        }
      };

      const onMessage = async (payload: string) => {
        const msg = parse(payload);
        if (!msg || dead || done) return;
        if (msg.t === "welcome" && typeof msg.pub === "string") {
          if (!hostPub) {
            hostPub = msg.pub;
            key = await sharedKey(id.priv, msg.pub);
          }
          if (msg.pub === hostPub) heard = Date.now();
          return;
        }
        if (msg.t !== "m" || !key) return;
        let body: HostBody<S>;
        try {
          body = await unseal<HostBody<S>>(key, msg);
        } catch {
          return;
        }
        if (dead || !(body.v > lastV)) return; // duplicate via another broker, or out of date
        lastV = body.v;
        heard = Date.now();
        if (body.k === "state") {
          sv = body.sv;
          setView(body.state);
          setStatus("open");
        } else if (body.k === "ok") {
          setStatus("open");
        } else if (body.k === "error") {
          toast.error(body.msg);
        } else if (body.k === "reject") {
          done = true;
          setStatus("error");
          toast.error(body.msg);
        }
      };

      let queue: Promise<unknown> = Promise.resolve();
      r = openRelay(
        [guestTopic(def.id, code, id.pid)],
        (_topic, payload) => {
          queue = queue.then(() => onMessage(payload)).catch(() => undefined);
        },
        (count) => {
          if (dead || done) return;
          const was = links;
          links = count;
          if (count === 0) return setStatus("connecting");
          if (was === 0) {
            // (Re)connected: knock or resync right away instead of waiting for the timer.
            linkedAt = Date.now();
            lastSync = 0;
            setStatus((s) => (!key ? "connecting" : s === "connecting" || s === "error" ? "open" : s));
          }
          tick();
        },
      );
      timer = setInterval(tick, 2500);
    })();

    const giveUp = setTimeout(() => setStatus((s) => (s === "connecting" ? "error" : s)), 15000);

    return () => {
      dead = true;
      clearTimeout(giveUp);
      clearInterval(timer);
      const leaving = post.current;
      post.current = null;
      const relayToClose = r;
      void Promise.resolve(done ? false : leaving?.({ k: "bye" }))
        .catch(() => false)
        .then(() => setTimeout(() => relayToClose?.close(), 300));
    };
  }, [code, name, attempt, def]);

  const act = useCallback((a: A) => {
    void (post.current?.({ k: "action", action: a }) ?? Promise.resolve(false)).then((sent) => {
      if (!sent) toast.error("Not connected — trying to reconnect…");
    });
  }, []);

  return { view, me, isHost: false, code, status, act, retry: () => setAttempt((n) => n + 1) };
}
