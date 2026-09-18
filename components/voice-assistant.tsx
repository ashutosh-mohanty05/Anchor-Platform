"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Send, X, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Minimal ambient typing for the Web Speech API, which isn't in the
// standard TS lib. Support varies by browser (notably absent in Firefox).
type SpeechRecognitionLike = {
  start: () => void;
  stop: () => void;
  onresult: (event: { results: { transcript: string }[][] }) => void;
  onerror: () => void;
  onend: () => void;
  lang: string;
  interimResults: boolean;
};

export default function VoiceAssistant({ onClose }: { onClose: () => void }) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [engine, setEngine] = useState<"ai" | "fallback" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const text = event.results[0]?.[0]?.transcript ?? "";
        setTranscript((prev) => (prev ? `${prev} ${text}` : text));
      };
      recognition.onerror = () => setListening(false);
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function toggleListening() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setError(null);
      recognitionRef.current.start();
      setListening(true);
    }
  }

  async function submit() {
    const text = transcript.trim();
    if (!text) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setTranscript("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      setEngine(data.engine ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const examples = [
    "Add a confirmed wedding on 28 September at 7pm",
    "Add a tentative birthday tomorrow evening",
    "Night shift tomorrow",
    "Is 5 October evening free?",
    "What's confirmed this month?",
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="stage-card flex w-full max-w-md flex-col rounded-t-3xl p-6 md:rounded-3xl"
        style={{ maxHeight: "85vh" }}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Ask Vaishnavi&apos;s Stage</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-secondary" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex flex-col items-center">
          <button
            onClick={toggleListening}
            disabled={!speechSupported}
            className={`flex h-16 w-16 items-center justify-center rounded-full transition-colors ${
              listening ? "bg-primary text-primary-foreground animate-pulse" : "bg-primary/15 text-primary"
            } disabled:opacity-40`}
            aria-label="Start listening"
          >
            <Mic className="h-7 w-7" />
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            {speechSupported
              ? listening
                ? "I'm listening... tell me what you need!"
                : "Tap to speak, or type below"
              : "Voice input isn't supported in this browser — please type instead"}
          </p>
        </div>

        {messages.length > 0 && (
          <div ref={scrollRef} className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-secondary/40 p-3" style={{ minHeight: "80px" }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-card px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Type or edit your request..."
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button size="icon" onClick={submit} disabled={loading || !transcript.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        {messages.length === 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => setTranscript(ex)}
                className="rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground hover:opacity-80"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-4 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        )}

        {engine === "fallback" && messages.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Running on the free assistant — always on, no account or cost. Say "confirmed" or "tentative" to set the status directly.
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
