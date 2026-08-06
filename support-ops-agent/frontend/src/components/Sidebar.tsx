"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { Plus, MessageSquare, Menu, X } from "lucide-react";

type Thread = { thread_id: string; title: string; created_at: string };

export default function Sidebar({
  onNewChat,
  onSelectThread,
  activeThreadId,
  refreshTrigger,
}: {
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  activeThreadId: string;
  refreshTrigger: number;
}) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const { getToken } = useAuth();


  useEffect(() => {
    let isCancelled = false;

    async function loadThreads() {
      try {
        const token = await getToken();
        const res = await fetch("http://localhost:8000/threads", {
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
    <div className="flex flex-col h-full bg-[#0E0E12] text-zinc-300 w-64 p-4">
      <div className="flex items-center justify-between mb-6">
        <span className="text-lg font-semibold tracking-tight text-white transition-all duration-300 hover:bg-gradient-to-r hover:from-violet-400 hover:to-fuchsia-400 hover:bg-clip-text hover:text-transparent cursor-default">
          ConduitAI
        </span>
        <button
          className="md:hidden text-zinc-400 hover:text-white transition-colors"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
      </div>

      <button
        onClick={onNewChat}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors mb-6"
      >
        <Plus size={16} />
        New Chat
      </button>

      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2 px-1">
        Recent
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto">
        {threads.length === 0 && (
          <div className="text-xs text-zinc-600 px-3 py-2">No conversations yet</div>
        )}
        {threads.map((t) => (
          <button
            key={t.thread_id}
            onClick={() => {
              onSelectThread(t.thread_id);
              setOpen(false);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${t.thread_id === activeThreadId
                ? "bg-white/10 text-white"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
          >
            <MessageSquare size={14} />
            <span className="truncate">{t.title}</span>
          </button>
        ))}
      </div>
      <div className="mt-auto pt-4 border-t border-white/10">
        <UserButton />
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