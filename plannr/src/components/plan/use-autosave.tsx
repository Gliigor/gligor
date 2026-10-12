"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

type Job = () => Promise<{ ok: boolean } | void>;

/**
 * Debounced autosave with a single in-flight request at a time.
 * Jobs are keyed (e.g. "inputs", "asset:<id>"): a newer job for the same key
 * replaces an older one that has not started yet, so the last state wins and
 * responses can never arrive out of order.
 */
export function useAutosave(delay = 600) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingJobs = useRef(new Map<string, Job>());
  const queue = useRef(new Map<string, Job>());
  const running = useRef(false);

  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    let failed = false;
    while (queue.current.size > 0) {
      const [key, job] = queue.current.entries().next().value as [string, Job];
      queue.current.delete(key);
      setStatus("saving");
      try {
        const res = await job();
        if (res && res.ok === false) failed = true;
      } catch {
        failed = true;
      }
    }
    running.current = false;
    setStatus(failed ? "error" : pendingJobs.current.size > 0 ? "pending" : "saved");
  }, []);

  const enqueue = useCallback(
    (key: string, job: Job) => {
      pendingJobs.current.delete(key);
      queue.current.set(key, job);
      void drain();
    },
    [drain],
  );

  const schedule = useCallback(
    (key: string, job: Job, immediate = false) => {
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      if (immediate) {
        timers.current.delete(key);
        enqueue(key, job);
        return;
      }
      pendingJobs.current.set(key, job);
      setStatus("pending");
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);
          enqueue(key, job);
        }, delay),
      );
    },
    [delay, enqueue],
  );

  // Flush debounced saves when the step unmounts (e.g. jumping to another step)
  // and warn before closing the tab with unsaved changes.
  useEffect(() => {
    const timerMap = timers.current;
    const pending = pendingJobs.current;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.size > 0 || running.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      for (const t of timerMap.values()) clearTimeout(t);
      timerMap.clear();
      for (const job of pending.values()) void job();
      pending.clear();
    };
  }, []);

  return { status, schedule };
}

export function SaveIndicator({ status }: { status: SaveStatus }) {
  const text =
    status === "pending" || status === "saving"
      ? "Opslaan…"
      : status === "saved"
        ? "Alle wijzigingen opgeslagen"
        : status === "error"
          ? "Opslaan mislukt — controleer je verbinding"
          : "Wijzigingen worden automatisch opgeslagen";
  const color = status === "error" ? "text-danger-600" : status === "saved" ? "text-ok-600" : "text-ink-500";
  return (
    <span className={`text-xs ${color}`} role="status" aria-live="polite">
      {text}
    </span>
  );
}
