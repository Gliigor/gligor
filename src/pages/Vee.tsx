import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, LogOut, RotateCcw, SlidersHorizontal, Square } from "lucide-react";
import VeeAvatar, { type AvatarState } from "@/vee/VeeAvatar";
import VeeLogin from "@/vee/VeeLogin";
import VeeCustomize from "@/vee/VeeCustomize";
import { AccessCodeRequired, fetchHealth, setAccessCode, streamChat, type Message, type RoutingMode } from "@/vee/api";
import { DEFAULT_PROFILE, isLoggedIn, loadProfile, saveProfile, setLoggedIn, type VeeProfile } from "@/vee/profile";
import "@/vee/vee.css";

const TIER_LABEL = { fast: "quick brain", smart: "deep brain" } as const;

const SUGGESTIONS = [
  "What can you do?",
  "Help me write a polite reminder to a friend",
  "Plan a simple three-day trip to Lisbon",
];

let idCounter = 0;
const nextId = () => `m${Date.now()}-${idCounter++}`;

type Stage = "loading" | "login" | "customize" | "chat";

/**
 * The /vee route: log in, customize your Vee, then chat. Settings live in
 * this browser (see src/vee/profile.ts) until real accounts arrive.
 */
export default function Vee() {
  const [stage, setStage] = useState<Stage>("loading");
  const [profile, setProfile] = useState<VeeProfile | null>(() => loadProfile());
  const [codeRequired, setCodeRequired] = useState(false);
  const [mock, setMock] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    document.title = "Vee";
    fetchHealth().then((h) => {
      setMock(Boolean(h?.mock));
      setUnavailable(Boolean(h?.unavailable));
      setCodeRequired(Boolean(h?.accessCodeRequired));
      if (!isLoggedIn()) setStage("login");
      else setStage(loadProfile() ? "chat" : "customize");
    });
  }, []);

  function logOut() {
    setLoggedIn(false);
    setAccessCode("");
    setStage("login");
  }

  const color = profile?.color ?? DEFAULT_PROFILE.color;

  if (stage === "loading") {
    return (
      <div className="vee min-h-screen flex items-center justify-center">
        <VeeAvatar state="thinking" size={80} color={color} interactive={false} />
      </div>
    );
  }

  if (stage === "login") {
    return (
      <VeeLogin
        codeRequired={codeRequired}
        initialName={profile?.userName ?? ""}
        color={color}
        onLoggedIn={(userName) => {
          setLoggedIn(true);
          // Returning visitors keep their Vee; new ones go to customize first.
          if (profile) {
            const updated = { ...profile, userName };
            saveProfile(updated);
            setProfile(updated);
            setStage("chat");
          } else {
            setProfile({ ...DEFAULT_PROFILE, userName });
            setStage("customize");
          }
        }}
      />
    );
  }

  if (stage === "customize" || !profile) {
    const firstTime = !loadProfile();
    return (
      <VeeCustomize
        profile={profile ?? DEFAULT_PROFILE}
        firstTime={firstTime}
        onSave={(p) => {
          saveProfile(p);
          setProfile(p);
          setStage("chat");
        }}
        onCancel={firstTime ? undefined : () => setStage("chat")}
      />
    );
  }

  return <VeeChat
      profile={profile}
      mock={mock}
      unavailable={unavailable}
      onCustomize={() => setStage("customize")} onLogOut={logOut} />;
}

interface ChatProps {
  profile: VeeProfile;
  mock: boolean;
  /** Live site without an API key: show a friendly "taking a break" note. */
  unavailable: boolean;
  onCustomize: () => void;
  onLogOut: () => void;
}

/**
 * Chat screen: one input box, streaming replies, and a small toggle to force
 * the quick or deep model so routing can be tested by hand.
 */
function VeeChat({ profile, mock, unavailable, onCustomize, onLogOut }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<RoutingMode>("auto");
  const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState<AvatarState>("idle");

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || unavailable) return;

    const userMsg: Message = { id: nextId(), role: "user", content: trimmed };
    const replyId = nextId();
    const history = [...messages, userMsg];

    setMessages([...history, { id: replyId, role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setAvatar("thinking");

    const controller = new AbortController();
    abortRef.current = controller;

    const patchReply = (patch: Partial<Message>) =>
      setMessages((prev) => prev.map((m) => (m.id === replyId ? { ...m, ...patch } : m)));

    try {
      await streamChat(
        history,
        mode,
        {
          onMeta: ({ tier }) => patchReply({ tier }),
          onText: (chunk) => {
            setAvatar("talking");
            setMessages((prev) => prev.map((m) => (m.id === replyId ? { ...m, content: m.content + chunk } : m)));
          },
        },
        controller.signal,
        profile,
      );
    } catch (err) {
      if (err instanceof AccessCodeRequired) {
        // The code changed on the server: log in again.
        onLogOut();
        return;
      } else if ((err as Error).name === "AbortError") {
        patchReply({ error: "Stopped." });
      } else {
        patchReply({ error: (err as Error).message || "Something went wrong." });
      }
    } finally {
      setBusy(false);
      setAvatar("idle");
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function stop() {
    abortRef.current?.abort();
  }

  function reset() {
    stop();
    setMessages([]);
    inputRef.current?.focus();
  }

  const empty = messages.length === 0;

  return (
    <div className="vee min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 backdrop-blur bg-[#fff8f3]/80 border-b border-[#2c2c2a]/10">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <a href="/#/" className="text-sm font-bold text-[#2c2c2a]/60 hover:text-[#2c2c2a]">
            ← gligor.xyz
          </a>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-[#5DCAA5]/20 text-[#1f6b52] px-2.5 py-1 font-semibold">tryout</span>
            {mock && (
              <span className="rounded-full bg-[#EF9F27]/20 text-[#7a4d05] px-2.5 py-1 font-semibold" title="No API key on the server yet">
                mock mode
              </span>
            )}
            <button
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-[#2c2c2a]/60 hover:bg-[#2c2c2a]/5"
              title="Start over"
            >
              <RotateCcw size={14} /> <span className="hidden sm:inline">New chat</span>
            </button>
            <button
              onClick={onCustomize}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-[#2c2c2a]/60 hover:bg-[#2c2c2a]/5"
              title={`Customize ${profile.veeName}`}
            >
              <SlidersHorizontal size={14} /> <span className="hidden sm:inline">Customize</span>
            </button>
            <button
              onClick={onLogOut}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-[#2c2c2a]/60 hover:bg-[#2c2c2a]/5"
              title="Log out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Conversation */}
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 pt-6 pb-40">
        <div className="flex flex-col items-center text-center mb-8">
          <VeeAvatar state={avatar} size={empty ? 128 : 80} color={profile.color} />
          {empty ? (
            <>
              <h1 className="mt-4 text-2xl font-extrabold">
                Hi{profile.userName ? ` ${profile.userName}` : ""}, I'm {profile.veeName}.
              </h1>
              <p className="mt-1 text-[#2c2c2a]/60 max-w-sm">
                Ask me anything. I'm a friendly helper that will soon be able to sort your email, keep your notes and
                plan your day.
              </p>
              <p className="mt-2 text-xs font-semibold text-[#2c2c2a]/40">Psst, you can poke me.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-[#2c2c2a]/15 bg-white px-3.5 py-1.5 text-sm hover:border-[#F0997B] hover:text-[#b85b3c] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs font-semibold text-[#2c2c2a]/50">
              {avatar === "thinking"
                ? `${profile.veeName} is thinking…`
                : avatar === "talking"
                  ? `${profile.veeName} is answering…`
                  : profile.veeName}
            </p>
          )}
        </div>

        <ol className="space-y-4">
          {messages.map((m) => (
            <li key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-md bg-[#F0997B] text-white px-4 py-2.5 whitespace-pre-wrap"
                    : "max-w-[85%] rounded-2xl rounded-bl-md bg-white border border-[#2c2c2a]/10 px-4 py-2.5 whitespace-pre-wrap"
                }
              >
                {m.content || (m.role === "assistant" && !m.error ? <span className="text-[#2c2c2a]/40">…</span> : null)}
                {m.error && <p className="mt-1 text-sm text-[#b23b3b]">{m.error}</p>}
                {m.role === "assistant" && m.tier && (
                  <p className="mt-1.5 text-[10px] uppercase tracking-wide font-bold text-[#2c2c2a]/40">
                    {TIER_LABEL[m.tier]}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#fff8f3] via-[#fff8f3] to-transparent pt-6 pb-4">
        <form onSubmit={onSubmit} className="mx-auto max-w-2xl px-4">
          {unavailable && (
            <p className="mb-2 rounded-2xl bg-white border border-[#EF9F27]/40 px-4 py-2.5 text-center text-sm text-[#7a4d05]">
              {profile.veeName} is taking a little break right now. Please come back a bit later.
            </p>
          )}
          <div className="rounded-3xl bg-white border border-[#2c2c2a]/15 shadow-sm focus-within:border-[#F0997B] transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={`Ask ${profile.veeName} anything…`}
              className="w-full resize-none bg-transparent px-4 pt-3 pb-1 outline-none placeholder:text-[#2c2c2a]/40"
              autoFocus
            />
            <div className="flex items-center justify-between px-2 pb-2">
              <ModeToggle mode={mode} onChange={setMode} />
              {busy ? (
                <button
                  type="button"
                  onClick={stop}
                  className="h-9 w-9 rounded-full bg-[#2c2c2a] text-white inline-flex items-center justify-center"
                  title="Stop"
                >
                  <Square size={14} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || unavailable}
                  className="h-9 w-9 rounded-full bg-[#F0997B] text-white inline-flex items-center justify-center disabled:opacity-40"
                  title="Send"
                >
                  <ArrowUp size={18} />
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-[#2c2c2a]/45">
            Your messages are never used to train AI models.
          </p>
        </form>
      </div>

    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: RoutingMode; onChange: (m: RoutingMode) => void }) {
  const options: { value: RoutingMode; label: string; hint: string }[] = [
    { value: "auto", label: "Auto", hint: "Vee picks the right brain for each message" },
    { value: "fast", label: "Quick", hint: "Always use the fast, cheap model" },
    { value: "smart", label: "Deep", hint: "Always use the smart model" },
  ];
  return (
    <div className="inline-flex rounded-full bg-[#2c2c2a]/5 p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Model">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={
            "rounded-full px-3 py-1 transition-colors " +
            (mode === o.value ? "bg-white shadow-sm text-[#2c2c2a]" : "text-[#2c2c2a]/50 hover:text-[#2c2c2a]")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
