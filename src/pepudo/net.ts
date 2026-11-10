// Online play. The host's browser runs the game; guests send their moves to
// the host and get back a view with only their own dice. Messages travel
// through a relay (see relay.ts) and are encrypted per guest (see crypto.ts).
//
// The link is built to survive phones: guests keep knocking until the host
// answers, both sides resync every few seconds, and sockets are re-opened
// when a backgrounded page comes back.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Action, GameState, addPlayer, apply, newGame, removePlayer, setOnline, viewFor } from "./engine";
import { botMove, botName } from "./bot";
import { Sealed, loadIdentity, pidOf, seal, sharedKey, unseal } from "./crypto";
import { Relay, openRelay } from "./relay";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ";
const hostTopic = (code: string) => `gligor-pepudo/v1/${code}/host`;
const guestTopic = (code: string, pid: string) => `gligor-pepudo/v1/${code}/p/${pid}`;

const SYNC_EVERY = 8000; // guest -> host heartbeat
const HOST_SILENT = 20000; // guest gives up waiting and knocks again
const GUEST_SILENT = 25000; // host marks a guest as gone
const GUEST_ACTIONS = ["bid", "dudo", "calza", "next", "rematch"];

// guest -> host (plain): knock on the door.  guest -> host (sealed): GuestBody.
type Hello = { t: "hello"; pid: string; pub: string; name: string; n: number };
type GuestBody = { n: number } & ({ k: "action"; action: Action } | { k: "sync"; sv: number } | { k: "bye" });
// host -> guest (plain): Welcome with the host's public key.  host -> guest (sealed): HostBody.
type HostBody = { v: number } & (
  | { k: "state"; sv: number; state: GameState }
  | { k: "ok" }
  | { k: "error"; msg: string }
  | { k: "reject"; msg: string }
);

/** offline = bots only · connecting = reaching the relay · no-host = relay ok, host silent */
export type NetStatus = "offline" | "connecting" | "open" | "no-host" | "error";

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

export function useHostGame(name: string, online: boolean): Controller {
  const [me] = useState(() => `host-${Math.random().toString(36).slice(2, 10)}`);
  const [state, setState] = useState<GameState>(() => addPlayer(newGame(), { id: me, name, bot: false }));
  const stateRef = useRef(state);
  const sv = useRef(0); // state version, so guests can tell if they're behind
  const seq = useRef(Date.now()); // message counter, to drop duplicates
  const guests = useRef(new Map<string, Guest>());
  const relay = useRef<Relay | null>(null);
  const codeRef = useRef("");
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<NetStatus>(online ? "connecting" : "offline");
  const [attempt, setAttempt] = useState(0);

  const sendTo = useCallback(async (pid: string, body: Record<string, unknown>) => {
    const g = guests.current.get(pid);
    if (!g || !relay.current) return;
    const sealed = await seal(g.key, { ...body, v: ++seq.current });
    relay.current?.publish(guestTopic(codeRef.current, pid), JSON.stringify({ t: "m", ...sealed }));
  }, []);

  const sendState = useCallback(
    (pid: string) => {
      const view = viewFor(stateRef.current, pid);
      return sendTo(pid, { k: "state", sv: sv.current, state: { ...view, log: view.log.slice(-12) } });
    },
    [sendTo],
  );

  const commit = useCallback(
    (next: GameState) => {
      stateRef.current = next;
      sv.current++;
      setState(next);
      guests.current.forEach((_, pid) => void sendState(pid));
    },
    [sendState],
  );

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
      commit(s.phase === "lobby" ? removePlayer(s, pid) : setOnline(s, pid, false));
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
      relay.current?.publish(guestTopic(room, msg.pid), JSON.stringify({ t: "welcome", pub }));

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
        commit(addPlayer(s, { id: msg.pid, name: guestName, bot: false }));
        toast(`${guestName} joined`);
      } catch (e) {
        await sendTo(msg.pid, { k: "reject", msg: errMsg(e) });
        guests.current.delete(msg.pid);
      }
    };

    const onSealed = async (msg: { pid: string } & Sealed) => {
      const g = guests.current.get(msg.pid);
      if (!g) return;
      let body: GuestBody;
      try {
        body = await unseal<GuestBody>(g.key, msg);
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
        const ok = body.action && GUEST_ACTIONS.includes(body.action.type);
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
      [hostTopic(room)],
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
  }, [online, attempt, commit, run, sendState, sendTo]);

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
        void sendTo(id, { k: "reject", msg: "The host removed you from the room." }).then(() =>
          guests.current.delete(id),
        );
        commit(removePlayer(stateRef.current, id));
      } catch (e) {
        toast.error(errMsg(e));
      }
    },
    [commit, sendTo],
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
  const [me, setMe] = useState("");
  const [view, setView] = useState<GameState | null>(null);
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
      const id = await loadIdentity("pepudo-id");
      if (dead) return;
      setMe(id.pid);
      const toHost = hostTopic(code);

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
        let body: HostBody;
        try {
          body = await unseal<HostBody>(key, msg);
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
        [guestTopic(code, id.pid)],
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
  }, [code, name, attempt]);

  const act = useCallback((a: Action) => {
    void (post.current?.({ k: "action", action: a }) ?? Promise.resolve(false)).then((sent) => {
      if (!sent) toast.error("Not connected — trying to reconnect…");
    });
  }, []);

  return { view, me, isHost: false, code, status, act, retry: () => setAttempt((n) => n + 1) };
}
