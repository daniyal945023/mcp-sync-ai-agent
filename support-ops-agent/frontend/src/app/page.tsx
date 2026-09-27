"use client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

import { useState, useRef, useEffect } from "react";
import { Mic, ArrowUp, FileStack, AlertTriangle, MessagesSquare } from "lucide-react";
import { SiGithub } from "@icons-pack/react-simple-icons";
import Sidebar from "@/components/Sidebar";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import VoiceOrb from "@/components/VoiceOrb";
import { Volume2, VolumeX } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useAuth } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Paperclip, X } from "lucide-react";
import Image from 'next/image'
import { FaGithub, FaSlack } from 'react-icons/fa6';
import { SiNotion } from 'react-icons/si';



type ToolEvent = { name: string; status: "running" | "done" };
type Message = {
  role: "user" | "assistant";
  content: string;
  tools?: ToolEvent[];
};

const SUGGESTIONS = [
  {
    icon: FaGithub,
    title: "GitHub Issues",
    desc: "List open issues or file a new one",
    prompt: "List my open GitHub issues",
  },
  {
    icon: FaSlack,
    title: "Slack Updates",
    desc: "Catch up on recent team messages",
    prompt: "What are the recent messages in Slack?",
  },
  {
    icon: SiNotion,
    title: "Notion Tracker",
    desc: "See what's logged and its status",
    prompt: "Show me everything in the Notion tracker",
  },
  {
    icon: AlertTriangle,
    title: "Escalation Check",
    desc: "Ask if something needs the team's attention",
    prompt: "A user says login is broken — what should I do?",
  },
];

function getThreadId(): string {
  const key = "ops-agent-thread-id";
  let id = typeof window !== "undefined" ? localStorage.getItem(key) : null;
  if (!id) {
    id = crypto.randomUUID();
    if (typeof window !== "undefined") localStorage.setItem(key, id);
  }
  return id;
}


const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,  // Client value
    () => false  // Server value
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const key = "ops-agent-thread-id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  });
  const threadIdRef = useRef<string>(activeThreadId);

  useEffect(() => {
    threadIdRef.current = activeThreadId;
  }, [activeThreadId]);



  const bottomRef = useRef<HTMLDivElement>(null);
  const isStreamingRef = useRef(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const { speak, stop: stopSpeaking, isSpeaking } = useTextToSpeech();
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const isClient = useIsClient();
  const { getToken } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
const [pendingImage, setPendingImage] = useState<string | null>(null);


  // Keep the input box synced with live transcript while listening
  const inputValue = listening ? transcript : input;

  function toggleListening() {
  if (listening) {
    SpeechRecognition.stopListening();
    if (transcript.trim()) {
      sendMessage(normalizeVoiceTranscript(transcript));
      resetTranscript();
    }
  } else {
    stopSpeaking();
    resetTranscript();
    setInput(""); // clear prior manual input
    SpeechRecognition.startListening({ continuous: true });
  }
}

  

  useEffect(() => {
    threadIdRef.current = getThreadId();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function newChat() {
  const newId = crypto.randomUUID();
  localStorage.setItem("ops-agent-thread-id", newId);
  setActiveThreadId(newId);
  setMessages([]);
}

async function selectThread(threadId: string) {
  localStorage.setItem("ops-agent-thread-id", threadId);
  setActiveThreadId(threadId);

  const token = await getToken();
  const res = await fetch(`${API_URL}/threads/${threadId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const history = await res.json();
    setMessages(history);
  }
}

useEffect(() => {
  if (!activeThreadId) return;
  let isCancelled = false;

  async function loadThreadHistory() {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/threads/${activeThreadId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok && !isCancelled) {
        const history = await res.json();
        setMessages(history);
      }
    } catch (error) {
console.error("Failed to load thread history:", error);
    }
  }

  loadThreadHistory();

  return () => {
    isCancelled = true;
  };
}, [activeThreadId, getToken]);


  async function sendMessage(overrideText?: string) {
  const text = normalizeVoiceTranscript(overrideText ?? input);
  if (!text.trim() || isStreamingRef.current) return;

  isStreamingRef.current = true;
  setIsStreaming(true);

  const userMessage: Message = { role: "user", content: text };
  const assistantMessage: Message = { role: "assistant", content: "", tools: [] };
  setMessages((prev) => [...prev, userMessage, assistantMessage]);
  setInput("");
  setIsStreaming(true);

  const token = await getToken();

  const response = await fetch(`${API_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
     },
    body: JSON.stringify({ message: text, thread_id: threadIdRef.current, image: pendingImage }),
  });
  setPendingImage(null)

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullAssistantText = ""; // Track full content for TTS

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const event = JSON.parse(line.slice(6));
      const content = normalizeContent(event.content); //new code

      if (event.type === "token" || event.type === "final_message") {
         fullAssistantText += content;
        //fullAssistantText += event.content; // Accumulate text as it streams
      }

     setMessages((prev) => {
  const last = prev[prev.length - 1];
  let updatedLast = last;

  if (event.type === "final_message") {
    updatedLast = { ...last, content };  //content: event.content
  } else if (event.type === "tool_start") {
    updatedLast = {
      ...last,
      tools: [...(last.tools || []), { name: event.name, status: "running" }],
    };
  } else if (event.type === "tool_end") {
    updatedLast = {
      ...last,
      tools: (last.tools || []).map((t) =>
        t.name === event.name ? { ...t, status: "done" } : t
      ),
    };
  }

  return [...prev.slice(0, -1), updatedLast];
});
    }
  }

  isStreamingRef.current = false;
  setIsStreaming(false);
  setRefreshTrigger((n) => n + 1);

  // Speak only after stream ends
  if (voiceEnabled && fullAssistantText.trim()) {
    speak(fullAssistantText);
  }
}

  const hasMessages = messages.length > 0;

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setPendingImage(reader.result as string);
  reader.readAsDataURL(file);
}

function normalizeContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return JSON.stringify(content);
  if (content && typeof content === "object") {
    const obj = content as Record<string, unknown>;
    return typeof obj.text === "string"
      ? obj.text
      : JSON.stringify(obj);
  }
  return String(content ?? "");
}

async function deleteThread(threadId: string) {
  const token = await getToken();
  const res = await fetch(`${API_URL}/threads/${threadId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    console.error("Failed to delete thread", await res.text());
    return;
  }

  if (threadId === activeThreadId) {
    newChat();
  }

  setRefreshTrigger((n) => n + 1);
}

function normalizeVoiceTranscript(text: string): string {
  if (!text) return text;

  const cleaned = text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bget[\s-]*hub\b/gi, "GitHub")
    .replace(/\bslap\b/gi, "Slack")
    .replace(/\bslackk\b/gi, "Slack")
    .replace(/\bgethub\b/gi, "GitHub")
    .replace(/\bgether\b/gi, "GitHub")
    .replace(/\bget her\b/gi, "GitHub")
    .replace(/\bget-hub\b/gi, "GitHub")
    .replace(/\bguitar\b/gi, "GitHub")
    .replace(/\blockk\b/gi, "log")
    .replace(/\block\b/gi, "log");

  return cleaned;
}

    return (
    <div className="flex h-screen bg-[#0b0b0d] text-white">
      <Sidebar
        onNewChat={newChat}
        onSelectThread={selectThread}
        onDeleteThread={deleteThread}
        activeThreadId={activeThreadId}
        refreshTrigger={refreshTrigger}
      />

      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,109,58,0.18),_transparent_28%),radial-gradient(circle_at_75%_20%,_rgba(255,130,80,0.16),_transparent_24%)]" />

        <div className="relative flex h-full flex-col">
          <header className="flex items-center justify-between px-6 pt-6 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff9b66] via-[#ff6f42] to-[#ff4d2d] font-black text-white shadow-[0_0_26px_rgba(255,106,61,0.8)]">
                A
              </div>
              <span className="text-lg font-semibold tracking-[-0.05em] text-white">
                Lumix AI
              </span>
            </div>

            <nav className="hidden items-center gap-7 text-sm text-zinc-300 md:flex">
              <a href="#" className="transition hover:text-white">Home</a>
              <a href="#" className="transition hover:text-white">Features</a>
              <a href="#" className="transition hover:text-white">Workflow</a>
              <a href="#" className="transition hover:text-white">Pricing</a>
            </nav>

            <div className="flex items-center gap-3">
              <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-[#ff7a52]/40 hover:text-white">
                Sign In
              </button>
              <button className="rounded-full bg-gradient-to-r from-[#ff8d5e] to-[#ff5b38] px-4 py-2 text-sm font-medium text-white shadow-[0_0_24px_rgba(255,92,58,0.55)] transition hover:brightness-110">
                Get Started
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 md:px-8">
            {!hasMessages ? (
              <div className="mx-auto flex h-full max-w-5xl flex-col items-center justify-center text-center">
                <h1 className="mb-3 text-4xl font-semibold tracking-[-0.08em] text-white md:text-6xl">
                  Experience the Next Era of AI Productivity.
                </h1>

                <p className="mb-10 max-w-2xl text-sm text-zinc-300 md:text-lg">
                  Build smarter workflows effortlessly. Connect AI to automate tasks,
                  and boost productivity in a sleek, modern workspace.
                </p>

                <div className="hero-shell mx-auto w-full max-w-5xl rounded-[32px] border border-[#ff7d55]/30 bg-[#0d0d10]/90 p-4 shadow-[0_0_80px_rgba(255,105,56,0.2)] backdrop-blur-xl">
                  <div className="glass-panel relative overflow-hidden rounded-[26px] border border-white/10 bg-[#0a0d12]/90 p-4">
                    <div className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(255,110,60,0.9),_rgba(255,110,60,0.24)_26%,_transparent_68%)] blur-2xl" />

                    <div className="relative flex items-center gap-3 rounded-[18px] border border-white/10 bg-[#111418]/80 px-4 py-3 shadow-inner shadow-black/30">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#1a1d22] text-[#ff9a61]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="11" cy="11" r="6" />
                          <path d="M16 16L21 21" />
                        </svg>
                      </div>

                      <input
                        value={inputValue}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Ask me anything, press '/' to prompt"
                        disabled={isStreaming}
                        className="flex-1 border-none bg-transparent text-base text-zinc-200 placeholder:text-zinc-500 outline-none"
                      />

                      <button
                        onClick={() => sendMessage()}
                        disabled={isStreaming}
                        className="glow-orb flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#ffb07a] via-[#ff7d52] to-[#ff5b38] text-white shadow-[0_0_24px_rgba(255,120,74,0.85)] transition hover:scale-105 disabled:opacity-40"
                      >
                        <ArrowUp size={18} />
                      </button>
                    </div>

                    <div className="relative mt-4 flex items-center justify-between px-2 text-[11px] text-zinc-400">
                      <div className="flex items-center gap-3">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">%</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">⌘</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">✦</span>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                        GPT-4
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto py-8 space-y-6">
                {messages.map((msg, i) => (
                  <div key={i} className={msg.role === "user" ? "text-right" : "text-left"}>
                    {msg.tools && msg.tools.length > 0 && (
                      <div className="text-xs text-zinc-400 mb-1 space-x-2">
                        {msg.tools.map((t, j) => (
                          <span key={j} className="inline-flex items-center gap-1">
                            <span
                              className={
                                t.status === "running"
                                  ? "animate-pulse text-violet-500"
                                  : "text-emerald-500"
                              }
                            >
                              {t.status === "running" ? "●" : "✓"}
                            </span>
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div
                      className={`inline-block max-w-lg rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-gradient-to-r from-[#ff8b5e] to-[#ff5d38] text-white shadow-[0_0_24px_rgba(255,105,56,0.4)]"
                          : "bg-[#121519] text-zinc-100 border border-white/8"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        msg.content ? (
                          <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-invert">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          isStreaming && "…"
                        )
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="px-4 pb-6 md:px-8">
            {(listening || isSpeaking) && (
              <div className="mb-3 flex justify-center">
                <VoiceOrb
                  state={listening ? "listening" : isSpeaking ? "speaking" : "idle"}
                />
              </div>
            )}

            <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-full border border-white/10 bg-[#111318]/90 px-4 py-2 shadow-[0_0_26px_rgba(0,0,0,0.28)] backdrop-blur-sm">
              <input
                className="flex-1 border-none bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
                value={inputValue}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type your prompt here"
                disabled={isStreaming}
              />

              {pendingImage && (
                <div className="relative w-fit">
                  <Image
                    src={pendingImage}
                    alt="attached"
                    width={200}
                    height={200}
                    className="h-16 rounded-lg border border-zinc-700"
                  />
                  <button
                    onClick={() => setPendingImage(null)}
                    className="absolute -top-2 -right-2 rounded-full bg-zinc-800 p-0.5 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <button
                onClick={toggleListening}
                disabled={isClient ? !browserSupportsSpeechRecognition : true}
                className={`transition-colors ${
                  listening ? "text-[#ff8e64]" : "text-zinc-400 hover:text-[#ff8e64]"
                }`}
                title={
                  isClient && browserSupportsSpeechRecognition
                    ? "Voice input"
                    : "Not supported in this browser"
                }
              >
                <Mic size={18} />
              </button>

              <button
                onClick={() => setVoiceEnabled((v) => !v)}
                className="text-zinc-400 transition-colors hover:text-[#ff8e64]"
                title={voiceEnabled ? "Mute voice output" : "Enable voice output"}
              >
                {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>

              <label className="cursor-pointer text-zinc-400 transition-colors hover:text-[#ff8e64]">
                <Paperclip size={18} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </label>

              <button
                onClick={() => sendMessage()}
                disabled={isStreaming}
                className="rounded-full bg-gradient-to-r from-[#ff8d5e] to-[#ff5b38] p-2 text-white shadow-[0_0_22px_rgba(255,92,58,0.5)] transition hover:brightness-110 disabled:opacity-40"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}