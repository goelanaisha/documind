"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { index: number; text: string; source: string }[];
}

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const docId = params.docId as string;
  const filename = searchParams.get("filename") ?? "Document";

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `I've read **${filename}** and I'm ready to answer your questions about it.`
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");
    setLoading(true);

    // Add user message immediately
    setMessages(prev => [...prev, { role: "user", content: question }]);

    // Add empty assistant message to fill with stream
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, docId })
      });

      if (!response.ok) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1]!.content = "Sorry, something went wrong. Please try again.";
          return updated;
        });
        return;
      }

      // Read the stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(line.slice(6));

            if (json.done) {
              // Stream complete — add sources
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1]!.sources = json.sources;
                return updated;
              });
            } else if (json.text) {
              // Append streamed text
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1]!.content += json.text;
                return updated;
              });
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1]!.content = "Connection error. Please try again.";
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <a href="/" className="text-gray-500 hover:text-white transition-colors text-sm">
          ← Back
        </a>
        <div>
          <h1 className="font-semibold">DocuMind</h1>
          <p className="text-gray-500 text-xs">{filename}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] ${msg.role === "user" ? "order-2" : "order-1"}`}>

                {/* Message bubble */}
                <div className={`rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-100"
                }`}>
                  {msg.content || (
                    <span className="text-gray-500 animate-pulse">Thinking...</span>
                  )}
                </div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-600 px-1">Sources from document:</p>
                    {msg.sources.map(source => (
                      <div
                        key={source.index}
                        className="text-xs bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-gray-400"
                      >
                        <span className="text-blue-400 font-medium">
                          [{source.index}] {source.source}
                        </span>
                        <p className="mt-1 text-gray-500">{source.text}</p>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Ask a question about your document..."
            disabled={loading}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>

    </main>
  );
}