"use client";

import { useState } from "react";
import { Plus, MessageSquare, Menu, X } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

const RECENT_CHATS = [
  "Escalate login issue",
  "Weekly issue digest",
  "Notion ticket sync",
];

export default function Sidebar({ onNewChat }: { onNewChat: () => void }) {
  const [open, setOpen] = useState(false);

  const content = (
    <div className="flex flex-col h-full bg-[#0E0E12] text-zinc-300 w-64 p-4">


      <div className="flex items-center justify-between mb-6">
        <span className="text-lg font-semibold tracking-tight text-white transition-all duration-300 hover:bg-gradient-to-r hover:from-violet-400 hover:to-fuchsia-400 hover:bg-clip-text hover:text-transparent cursor-default">
          Support-Ops
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
        {RECENT_CHATS.map((chat, i) => (
          <button
            key={i}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-white/5 hover:text-white transition-colors text-left"
          >
            <MessageSquare size={14} />
            <span className="truncate">{chat}</span>
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
      {/* Mobile toggle */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 text-zinc-700 bg-white/80 backdrop-blur rounded-lg p-2 shadow"
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
      </button>

      {/* Desktop sidebar */}
      <div className="hidden md:block h-screen shrink-0">{content}</div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="h-full">{content}</div>
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
   
   
    </>
  );
}