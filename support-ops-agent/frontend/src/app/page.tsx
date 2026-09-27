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
    <div className="flex h-screen overflow-hidden bg-[#09090c] text-white">
      <Sidebar
        onNewChat={newChat}
        onSelectThread={selectThread}
        onDeleteThread={deleteThread}
        activeThreadId={activeThreadId}
        refreshTrigger={refreshTrigger}
      />

      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(164,35,31,0.30),_transparent_30%),radial-gradient(circle_at_50%_10%,_rgba(255,92,56,0.16),_transparent_18%)]" />

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex-1 overflow-y-auto px-4 md:px-8">
            {!hasMessages ? (
              <div className="mx-auto flex h-full max-w-6xl flex-col items-center justify-center text-center">
                <h3 className="mb-3 text-4xl font-semibold tracking-[-0.08em] text-white md:text-7xl">
                  How can I help you today?
                </h3>

                <p className="mb-8 max-w-2xl text-sm text-zinc-300 md:text-lg">
                  Manage your Github issues,Slack activity, and Notion database, all in one place
                </p>


                                 <div className="mb-8 grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      icon: FaGithub,
                      title: "GitHub Issues",
                      text: "List open issues or file a new one",
                    },
                    {
                      icon: FaSlack,
                      title: "Slack Updates",
                      text: "Catch up on recent team messages",
                    },
                    {
                      icon: SiNotion,
                      title: "Notion Tracker",
                      text: "See what’s logged and its status",
                    },
                    {
                      icon: AlertTriangle,
                      title: "Escalation Check",
                      text: "Ask if something needs the team’s attention",
                    },
                  ].map(({ icon: Icon, title, text }, i) => (
                    <button
                      key={title}
                      onClick={() =>
                        sendMessage(
                          i === 0
                            ? "List my open GitHub issues"
                            : i === 1
                              ? "What are the recent messages in Slack?"
                              : i === 2
                                ? "Show me everything in the Notion tracker"
                                : "A user says login is broken — what should I do?"
                        )
                      }
                      className="group rounded-[18px] border border-[#8d2d28]/55 bg-[linear-gradient(180deg,rgba(38,13,15,0.88),rgba(17,20,24,0.92))] p-4 text-left shadow-[0_0_30px_rgba(116,21,19,0.16)] transition-all duration-200 hover:-translate-y-1 hover:border-[#d95f3a]/60 hover:shadow-[0_0_28px_rgba(216,82,52,0.18)]"
                    >
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[#ff9d6b]/30 bg-[radial-gradient(circle,_rgba(255,154,110,0.22),_rgba(101,18,18,0.12))] text-[#ff9d6b]">
                        <Icon size={18} />
                      </div>

                      <div className="text-left text-base font-medium text-white">{title}</div>
                      <div className="mt-1 text-left text-sm text-zinc-300">{text}</div>
                    </button>
                  ))}
                </div>


                <div className="relative w-full max-w-5xl">
                  <div className="pointer-events-none absolute left-1/2 top-[-40px] h-56 w-56 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(255,130,87,0.95),_rgba(255,92,52,0.42)_25%,_transparent_68%)] blur-[46px]" />

                  <div className="relative mx-auto max-w-5xl">
                    <div className="relative overflow-hidden rounded-[28px] border border-[#a2362a]/60 bg-[#0a0d12]/95 p-3 shadow-[0_0_80px_rgba(123,19,18,0.28)]">
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ff8d62]/80 to-transparent" />
                      <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(255,137,84,0.95),_rgba(255,93,56,0.25)_28%,_transparent_68%)] blur-[28px]" />

                      <div className="relative mb-3 flex items-center gap-3 rounded-[16px] border border-white/10 bg-[#111316]/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#1a1d22] text-[#ff9f7d]">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="11" cy="11" r="6" />
                            <path d="M16 16L21 21" />
                          </svg>
                        </div>

                        <input
                          value={inputValue}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                          placeholder="Ask me anything, press '/' for prompt"
                          disabled={isStreaming}
                          className="flex-1 border-none bg-transparent text-base text-zinc-200 placeholder:text-zinc-500 outline-none"
                        />

                        <button
                          onClick={() => sendMessage()}
                          disabled={isStreaming}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#ffbe94] via-[#ff7c56] to-[#c3302a] text-white shadow-[0_0_24px_rgba(198,48,34,0.8)] transition hover:scale-105 disabled:opacity-40"
                        >
                          <ArrowUp size={18} />
                        </button>
                      </div>

                     
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl py-8 space-y-6">
                {messages.map((msg, i) => (
                  <div key={i} className={msg.role === "user" ? "text-right" : "text-left"}>
                    {msg.tools && msg.tools.length > 0 && (
                      <div className="mb-1 text-xs text-zinc-400">
                        {msg.tools.map((t, j) => (
                          <span key={j} className="mr-2 inline-flex items-center gap-1">
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
                          ? "bg-gradient-to-r from-[#ec6038] to-[#7e1d1f] text-white shadow-[0_0_24px_rgba(131,26,25,0.5)]"
                          : "border border-white/8 bg-[#101419] text-zinc-100"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        msg.content ? (
                          <div className="prose prose-sm max-w-none prose-invert prose-p:my-1 prose-headings:my-2">
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

          {!hasMessages && (
            <div className="px-4 pb-6 md:px-8" />
          )}

          {hasMessages && (
            <div className="px-4 pb-6 md:px-8">
              {(listening || isSpeaking) && (
                <div className="mb-3 flex justify-center">
                  <VoiceOrb
                    state={listening ? "listening" : isSpeaking ? "speaking" : "idle"}
                  />
                </div>
              )}

              <div className="mx-auto flex max-w-5xl items-center gap-2 rounded-[20px] border border-[#8e2d28]/70 bg-[#101317]/90 px-4 py-2 shadow-[0_0_26px_rgba(0,0,0,0.38)] backdrop-blur-sm">
                <button
                  onClick={toggleListening}
                  disabled={isClient ? !browserSupportsSpeechRecognition : true}
                  className={`rounded-full p-2 transition-colors ${
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
                  className="rounded-full bg-gradient-to-r from-[#f36b46] to-[#7f1b1d] p-2 text-white shadow-[0_0_22px_rgba(125,27,27,0.6)] transition hover:brightness-110 disabled:opacity-40"
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}