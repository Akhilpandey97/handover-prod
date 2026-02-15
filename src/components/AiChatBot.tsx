import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelsContext";
import { calculateTimeFromChecklist, formatDuration } from "@/data/projectsData";
import { MessageCircle, X, Send, Loader2, Bot, User, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string; time: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const getTime = () => {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const AiChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { projects } = useProjects();
  const { currentUser } = useAuth();
  const { teamLabels, responsibilityLabels } = useLabels();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const getProjectContext = useCallback(() => {
    if (!projects.length) return "";
    const summary = projects.slice(0, 20).map(p => {
      const time = calculateTimeFromChecklist(p.checklist);
      const completed = p.checklist.filter(c => c.completed).length;
      const total = p.checklist.length;
      return `- ${p.merchantName} (${p.mid}): Phase=${p.currentPhase}, State=${p.projectState}, Team=${teamLabels[p.currentOwnerTeam] || p.currentOwnerTeam}, Owner=${p.assignedOwnerName || "Unassigned"}, Tasks=${completed}/${total}, ${responsibilityLabels.gokwik}Time=${formatDuration(time.gokwik)}, ${responsibilityLabels.merchant}Time=${formatDuration(time.merchant)}, ARR=${p.arr}Cr`;
    }).join("\n");
    return `Total projects: ${projects.length}\n${summary}`;
  }, [projects, teamLabels, responsibilityLabels]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim(), time: getTime() };
    setInput("");
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = "auto";

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, projectContext: getProjectContext() }),
      });

      if (resp.status === 429) { toast.error("Rate limit exceeded. Please try again."); setIsLoading(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted."); setIsLoading(false); return; }
      if (!resp.ok || !resp.body) throw new Error("Failed to start stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      const assistantTime = getTime();

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar, time: assistantTime }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar, time: assistantTime }];
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error("Chat error:", e);
      toast.error("Failed to get AI response");
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again.", time: getTime() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaInput = () => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  };

  if (!currentUser) return null;

  return (
    <>
      {/* Floating Button — bottom LEFT, WhatsApp style green circle */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full bg-[hsl(142,71%,45%)] text-white shadow-xl hover:shadow-2xl transition-all hover:scale-105 flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat Panel — WhatsApp + ChatGPT fusion */}
      {isOpen && (
        <div className="fixed bottom-6 left-6 z-50 w-[420px] h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 border border-border">
          {/* Header — WhatsApp-green gradient */}
          <div className="flex items-center justify-between px-4 py-3 bg-[hsl(142,71%,35%)] text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">AI Assistant</p>
                <p className="text-[11px] text-white/70">
                  {isLoading ? "typing..." : "online"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => { setIsOpen(false); setMessages([]); }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Messages — WhatsApp chat wallpaper style */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              backgroundColor: "hsl(var(--background))",
            }}
          >
            {messages.length === 0 && (
              <div className="text-center py-6">
                <div className="h-16 w-16 mx-auto rounded-full bg-[hsl(142,71%,45%)]/10 flex items-center justify-center mb-3">
                  <Bot className="h-8 w-8 text-[hsl(142,71%,45%)]" />
                </div>
                <p className="text-sm font-semibold mb-1">Hey there! 👋</p>
                <p className="text-xs text-muted-foreground mb-4 max-w-[280px] mx-auto">
                  I'm your project AI assistant. Ask me about status, timelines, blockers, or workloads.
                </p>
                <div className="space-y-2">
                  {[
                    "Which projects are at risk?",
                    "Summarize team workloads",
                    "What's blocking progress?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-xl border bg-card hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      💬 {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed relative shadow-sm",
                    msg.role === "user"
                      ? "bg-[hsl(142,71%,90%)] dark:bg-[hsl(142,50%,25%)] text-foreground rounded-br-md"
                      : "bg-card border rounded-bl-md"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>p:last-child]:mb-0 [&>ul]:my-1 [&>ol]:my-1 text-sm">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                  <div className={cn(
                    "flex items-center gap-1 mt-1",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}>
                    <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                    {msg.role === "user" && (
                      <CheckCheck className="h-3 w-3 text-blue-500" />
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-card border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input — WhatsApp style bottom bar */}
          <div className="px-3 py-2.5 border-t bg-card">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleTextareaInput}
                placeholder="Type a message..."
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none rounded-2xl border bg-muted/50 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(142,71%,45%)]/30 disabled:opacity-50 max-h-[120px]"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="h-10 w-10 rounded-full bg-[hsl(142,71%,45%)] text-white flex items-center justify-center shrink-0 hover:bg-[hsl(142,71%,40%)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
