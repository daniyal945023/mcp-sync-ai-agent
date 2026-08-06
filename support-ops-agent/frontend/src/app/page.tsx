"use client";

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

type ToolEvent = { name: string; status: "running" | "done" };
type Message = {
  role: "user" | "assistant";
  content: string;
  tools?: ToolEvent[];
};

const SUGGESTIONS = [
  {
    icon: SiGithub,
    title: "GitHub Issues",
    desc: "List open issues or file a new one",
    prompt: "List my open GitHub issues",
  },
  {
    icon: MessagesSquare,
    title: "Slack Updates",
    desc: "Catch up on recent team messages",
    prompt: "What are the recent messages in Slack?",
  },
  {
    icon: FileStack,
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



  // Keep the input box synced with live transcript while listening
  const inputValue = listening ? transcript : input;

  function toggleListening() {
  if (listening) {
    SpeechRecognition.stopListening();
    if (transcript.trim()) {
      sendMessage(transcript);
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
  const res = await fetch(`http://localhost:8000/threads/${threadId}/messages`, {
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
      const res = await fetch(`http://localhost:8000/threads/${activeThreadId}/messages`, {
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
  const text = overrideText ?? input;
  if (!text.trim() || isStreamingRef.current) return;

  isStreamingRef.current = true;
  setIsStreaming(true);

  const userMessage: Message = { role: "user", content: text };
  const assistantMessage: Message = { role: "assistant", content: "", tools: [] };
  setMessages((prev) => [...prev, userMessage, assistantMessage]);
  setInput("");
  setIsStreaming(true);

  const token = await getToken();

  const response = await fetch("http://localhost:8000/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
     },
    body: JSON.stringify({ message: text, thread_id: threadIdRef.current }),
  });

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

      if (event.type === "token") {
        fullAssistantText += event.content; // Accumulate text as it streams
      }

      setMessages((prev) => {
        if (prev.length === 0) return prev;

        const lastIndex = prev.length - 1;
        const last = prev[lastIndex];

        let updatedLast = { ...last };

        if (event.type === "token") {
          updatedLast = {
            ...updatedLast,
            content: updatedLast.content + event.content,
          };
        } else if (event.type === "tool_start") {
          updatedLast = {
            ...updatedLast,
            tools: [...(updatedLast.tools || []), { name: event.name, status: "running" }],
          };
        } else if (event.type === "tool_end") {
          updatedLast = {
            ...updatedLast,
            tools: (updatedLast.tools || []).map((t) =>
              t.name === event.name ? { ...t, status: "done" } : t
            ),
          };
        }

        const newMessages = [...prev];
        newMessages[lastIndex] = updatedLast;
        return newMessages;
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

  return (
    <div className="flex h-screen bg-white">
      <Sidebar onNewChat={newChat}
  onSelectThread={selectThread}
  activeThreadId={activeThreadId}
  refreshTrigger={refreshTrigger}
 />

      <div className="flex-1 flex flex-col bg-gradient-to-b from-violet-50 via-white to-white">
        <div className="flex-1 overflow-y-auto px-4 md:px-8">
          {!hasMessages ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900 mb-2">
                How can I help you today?
              </h1>
              <p className="text-zinc-500 mb-10">
                Ask about GitHub issues, Slack activity, or your Notion tracker.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s.prompt)}
                    className="group text-left p-4 rounded-xl border border-zinc-200 bg-white hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <s.icon
                      size={18}
                      className="text-violet-600 mb-2 group-hover:scale-110 transition-transform"
                    />
                    <div className="font-medium text-zinc-900 text-sm">{s.title}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{s.desc}</div>
                  </button>
                ))}
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
                              t.status === "running" ? "animate-pulse text-violet-500" : "text-emerald-500"
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
                    className={`inline-block px-4 py-2.5 rounded-2xl max-w-lg text-sm leading-relaxed ${msg.role === "user"
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-100 text-zinc-900"
                      }`}
                  >
                    {msg.content || (isStreaming && msg.role === "assistant" ? "…" : "")}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>


        <div className="px-4 md:px-8 pb-6">
          {(listening || isSpeaking) && (
  <div className="flex justify-center mb-3">
    <VoiceOrb state={listening ? "listening" : isSpeaking ? "speaking" : "idle"} />
  </div>
)}
          <div className="max-w-2xl mx-auto flex items-center gap-2 bg-white border border-zinc-200 rounded-full px-4 py-2 shadow-sm focus-within:border-violet-400 transition-colors">
            <input
              className="flex-1 outline-none text-sm placeholder:text-zinc-400"
              value={inputValue}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type your prompt here"
              disabled={isStreaming}
            />
             <button
    onClick={toggleListening}
    disabled={isClient ? !browserSupportsSpeechRecognition : true}
    className={`transition-colors ${
      listening ? "text-fuchsia-600" : "text-zinc-400 hover:text-violet-600"
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
              className="text-zinc-400 hover:text-violet-600 transition-colors"
              title={voiceEnabled ? "Mute voice output" : "Enable voice output"}
            >
              {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              onClick={() => sendMessage()}
              disabled={isStreaming}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-full p-2 transition-colors"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}