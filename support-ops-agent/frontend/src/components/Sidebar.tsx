"use client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

import { useState, useEffect, useCallback } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { Plus, MessageSquare, Menu, X, Trash2 } from "lucide-react";
import { getApiToken } from "@/lib/apiAuth";

type Thread = { thread_id: string; title: string; created_at: string };

export default function Sidebar({
  onNewChat,
  onSelectThread,
  onDeleteThread,
  activeThreadId,
  refreshTrigger,
}: {
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  activeThreadId: string;
  refreshTrigger: number;
}) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const { getToken, isSignedIn } = useAuth();


  useEffect(() => {
    let isCancelled = false;

    async function loadThreads() {
      try {
        const token = await getApiToken(getToken)
        if (!token) return;
        const res = await fetch(`${API_URL}/threads`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !isCancelled) {
          const data = await res.json();
          setThreads(data);
        }
      } catch (error) {
        console.error("Failed to fetch threads:", error);
      }
    }
    loadThreads();

    return () => {
      isCancelled = true;
    };
  }, [getToken, refreshTrigger]);


     const content = (
    <div className="flex h-full w-64 flex-col bg-[radial-gradient(circle_at_top,_rgba(255,122,76,0.18),_transparent_26%),linear-gradient(180deg,#0b090d_0%,#120d11_42%,#090b0e_100%)] p-4 text-zinc-300">
      <div className="mb-6 flex items-center justify-between">
        <span className="cursor-default bg-gradient-to-r from-[#ff9a67] via-[#d94d3d] to-[#701a1a] bg-clip-text text-lg font-semibold tracking-tight text-transparent">
          ProjectManagerAI
        </span>
        <button
          className="text-zinc-400 transition-colors hover:text-white md:hidden"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
      </div>

      <button
        onClick={onNewChat}
        className="mb-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#f36b46] to-[#7f1b1d] px-3 py-2 text-sm font-medium text-white shadow-[0_0_20px_rgba(153,31,28,0.5)] transition hover:brightness-110"
      >
        <Plus size={16} />
        New Chat
      </button>

      <div className="mb-2 px-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
        Recent
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {threads.length === 0 && (
          <div className="px-3 py-2 text-xs text-zinc-600">No conversations yet</div>
        )}

        {threads.map((t) => (
          <div
            key={t.thread_id}
            className={`flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
              t.thread_id === activeThreadId
                ? "bg-white/8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                onSelectThread(t.thread_id);
                setOpen(false);
              }}
              className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left"
            >
              <MessageSquare size={14} className="shrink-0" />
              <span className="min-w-0 truncate whitespace-nowrap">{t.title}</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm("Delete this conversation?")) {
                  onDeleteThread(t.thread_id);
                }
              }}
              className="shrink-0 text-zinc-400 transition hover:text-rose-400"
              aria-label={`Delete conversation ${t.title}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-white/10 pt-4">
        {isSignedIn ? <UserButton /> : <span className="text-xs text-zinc-500">Demo session</span>}
      </div>
    </div>
  );
  return (
    <>
      <button
        className="md:hidden fixed top-4 left-4 z-50 text-zinc-700 bg-white/80 backdrop-blur rounded-lg p-2 shadow"
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
      </button>
      <div className="hidden md:block h-screen shrink-0">{content}</div>
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="h-full">{content}</div>
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}