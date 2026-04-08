import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelsContext";
import { calculateTimeFromChecklist, formatDuration } from "@/data/projectsData";
import { MessageCircle, X, Send, Loader2, Bot, CheckCheck, Trash2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type Msg = { role: "user" | "assistant"; content: string; time: string };
type ChatPosition = { x: number; y: number };

const CHAT_BUTTON_SIZE = 56;
const CHAT_PANEL_WIDTH = 420;
const CHAT_PANEL_HEIGHT = 600;
const CHAT_MARGIN = 24;
const CHAT_POSITION_KEY = "ai_chat_position";

const QUICK_ACTIONS = [
  { icon: "👤", label: "Assign Owner", prompt: "Assign an owner to an unassigned project." },
  { icon: "✏️", label: "Update Project", prompt: "Update a project's state, phase, platform, category, ARR, notes, or go-live date." },
  { icon: "⚙️", label: "Create Workflow", prompt: "Create a workflow using a supported trigger and action." },
  { icon: "🆕", label: "New Project Alert", prompt: "Create a workflow to notify me by email whenever a new project is created." },
  { icon: "✅", label: "Checklist Workflow", prompt: "Create a workflow for checklist completion, checklist comments, or all checklist items completed." },
  { icon: "🧪", label: "Sample Workflow Pack", prompt: "Create sample workflows for my tenant using my email address." },
  { icon: "📋", label: "List Workflows", prompt: "List all active workflows and explain what each one does." },
  { icon: "📊", label: "Project Risks", prompt: "Which projects are at risk right now, and why?" },
  { icon: "👥", label: "Team Workloads", prompt: "Summarize current team workloads, owners with the most projects, and handoff bottlenecks." },
  { icon: "🩺", label: "Health Check", prompt: "Run a health check on all projects. Identify stale, blocked, or critical projects and suggest next actions for each." },
  { icon: "📈", label: "Pipeline Forecast", prompt: "Forecast our revenue pipeline. Which projects are closest to going live and what's the projected ARR impact?" },
  { icon: "🔄", label: "Handoff Analysis", prompt: "Analyze recent project handoffs between teams. Are there bottlenecks or rejected transfers? Suggest improvements." },
] as const;

const getTime = () => {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const AiChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [chatPosition, setChatPosition] = useState<ChatPosition | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dragStateRef = useRef<{ offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const suppressOpenRef = useRef(false);
  const { projects } = useProjects();
  const { currentUser } = useAuth();
  const { teamLabels, responsibilityLabels } = useLabels();
  const queryClient = useQueryClient();
  const { isListening, isSpeaking, transcript, isSupported: voiceSupported, startListening, stopListening, speak, stopSpeaking } = useVoiceAssistant();
  const [autoSpeak, setAutoSpeak] = useState(true);

  const getBounds = useCallback((open: boolean) => {
    const width = open ? Math.min(CHAT_PANEL_WIDTH, window.innerWidth - CHAT_MARGIN) : CHAT_BUTTON_SIZE;
    const height = open ? CHAT_PANEL_HEIGHT : CHAT_BUTTON_SIZE;
    return {
      maxX: Math.max(CHAT_MARGIN, window.innerWidth - width - CHAT_MARGIN),
      maxY: Math.max(CHAT_MARGIN, window.innerHeight - height - CHAT_MARGIN),
    };
  }, []);

  const clampPosition = useCallback((position: ChatPosition, open: boolean) => {
    if (typeof window === "undefined") return position;
    const { maxX, maxY } = getBounds(open);
    return {
      x: Math.min(Math.max(CHAT_MARGIN, position.x), maxX),
      y: Math.min(Math.max(CHAT_MARGIN, position.y), maxY),
    };
  }, [getBounds]);

  // Load chat history from DB
  useEffect(() => {
    if (!currentUser || historyLoaded) return;
    const loadHistory = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;
      const { data } = await supabase
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("user_id", session.session.user.id)
        .order("created_at", { ascending: true })
        .limit(50);
      if (data && data.length > 0) {
        setMessages(
          data.map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }))
        );
      }
      setHistoryLoaded(true);
    };
    loadHistory();
  }, [currentUser, historyLoaded]);

  const saveMessage = async (role: "user" | "assistant", content: string) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) return;
    await supabase.from("chat_messages").insert({
      user_id: session.session.user.id,
      role,
      content,
    });
  };

  const clearHistory = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) return;
    await supabase.from("chat_messages").delete().eq("user_id", session.session.user.id);
    setMessages([]);
    toast.success("Chat history cleared");
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined" || chatPosition) return;
    const saved = window.localStorage.getItem(CHAT_POSITION_KEY);
    if (saved) {
      try {
        setChatPosition(clampPosition(JSON.parse(saved), false));
        return;
      } catch {
        window.localStorage.removeItem(CHAT_POSITION_KEY);
      }
    }
    setChatPosition({
      x: window.innerWidth - CHAT_BUTTON_SIZE - CHAT_MARGIN,
      y: window.innerHeight - CHAT_BUTTON_SIZE - CHAT_MARGIN,
    });
  }, [chatPosition, clampPosition]);

  useEffect(() => {
    if (!chatPosition || typeof window === "undefined") return;
    window.localStorage.setItem(CHAT_POSITION_KEY, JSON.stringify(chatPosition));
  }, [chatPosition]);

  useEffect(() => {
    if (!chatPosition || typeof window === "undefined") return;
    const handleResize = () => {
      setChatPosition((current) => current ? clampPosition(current, isOpen) : current);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [chatPosition, clampPosition, isOpen]);

  useEffect(() => {
    setChatPosition((current) => current ? clampPosition(current, isOpen) : current);
  }, [isOpen, clampPosition]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const getProjectContext = useCallback(() => {
    if (!projects.length) return "";

    // Fetch profiles for owner mapping
    const summary = projects.slice(0, 20).map(p => {
      const time = calculateTimeFromChecklist(p.checklist);
      const completed = p.checklist.filter(c => c.completed).length;
      const total = p.checklist.length;
      return `- ${p.merchantName} (ID=${p.id}, MID=${p.mid}): Phase=${p.currentPhase}, State=${p.projectState}, Team=${teamLabels[p.currentOwnerTeam] || p.currentOwnerTeam}, Owner=${p.assignedOwnerName || "Unassigned"} (OwnerID=${p.assignedOwner || "none"}), Tasks=${completed}/${total}, ${responsibilityLabels.gokwik}Time=${formatDuration(time.gokwik)}, ${responsibilityLabels.merchant}Time=${formatDuration(time.merchant)}, ARR=${p.arr}Cr`;
    }).join("\n");
    return `Total projects: ${projects.length}\n${summary}`;
  }, [projects, teamLabels, responsibilityLabels]);

  const sendMessage = async (overrideContent?: string) => {
    const messageContent = (overrideContent ?? input).trim();
    if (!messageContent || isLoading) return;
    const userMsg: Msg = { role: "user", content: messageContent, time: getTime() };
    if (!overrideContent) setInput("");
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    saveMessage("user", userMsg.content);

    if (inputRef.current) inputRef.current.style.height = "auto";

    const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: allMessages, projectContext: getProjectContext() },
      });

      if (error) {
        if (error.message?.includes("429")) {
          toast.error("Rate limit exceeded. Please try again.");
          return;
        }
        if (error.message?.includes("402")) {
          toast.error("AI credits exhausted.");
          return;
        }
        throw error;
      }

      const content = data.choices?.[0]?.message?.content || "I couldn't generate a response.";
      const actions = data.actions as string[] | undefined;

      const assistantMsg: Msg = { role: "assistant", content, time: getTime() };
      setMessages(prev => [...prev, assistantMsg]);
      saveMessage("assistant", content);

      // Auto-speak AI response
      if (autoSpeak) {
        speak(content);
      }

      // If actions were taken, refresh project data
      if (actions && actions.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        toast.success("AI action completed", { description: actions.join(", ") });
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

  const beginDrag = (clientX: number, clientY: number) => {
    if (!chatPosition) return;
    dragStateRef.current = {
      offsetX: clientX - chatPosition.x,
      offsetY: clientY - chatPosition.y,
      moved: false,
    };

    const handlePointerMove = (moveX: number, moveY: number) => {
      setChatPosition((current) => {
        if (!current || !dragStateRef.current) return current;
        const next = clampPosition(
          {
            x: moveX - dragStateRef.current.offsetX,
            y: moveY - dragStateRef.current.offsetY,
          },
          isOpen
        );
        if (Math.abs(next.x - current.x) > 2 || Math.abs(next.y - current.y) > 2) {
          dragStateRef.current.moved = true;
          suppressOpenRef.current = true;
        }
        return next;
      });
    };

    const onPointerMove = (event: PointerEvent) => handlePointerMove(event.clientX, event.clientY);
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (dragStateRef.current?.moved) {
        window.setTimeout(() => {
          suppressOpenRef.current = false;
        }, 0);
      } else {
        suppressOpenRef.current = false;
      }
      dragStateRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleLauncherPress = (event: React.PointerEvent<HTMLButtonElement>) => {
    beginDrag(event.clientX, event.clientY);
  };

  const handleHeaderPress = (event: React.PointerEvent<HTMLDivElement>) => {
    beginDrag(event.clientX, event.clientY);
  };

  if (!currentUser) return null;
  if (!chatPosition) return null;

  return (
    <>
      {!isOpen && (
        <button
          onPointerDown={handleLauncherPress}
          onClick={() => {
            if (suppressOpenRef.current) return;
            setIsOpen(true);
          }}
          className="fixed z-[85] flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(142,71%,45%)] text-white shadow-xl transition-all hover:scale-105 hover:shadow-2xl cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ left: chatPosition.x, top: chatPosition.y }}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {isOpen && (
        <div
          className="fixed z-[85] flex h-[600px] w-[420px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
          style={{ left: chatPosition.x, top: chatPosition.y }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 bg-[hsl(142,71%,35%)] text-white cursor-grab active:cursor-grabbing touch-none select-none"
            onPointerDown={handleHeaderPress}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">AI Assistant</p>
                <p className="text-[11px] text-white/70">
                  {isLoading ? "thinking..." : "online · can take actions"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={clearHistory}
                  onPointerDown={(event) => event.stopPropagation()}
                  title="Clear chat history"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={() => setIsOpen(false)}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Messages */}
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
                  I can answer questions and <strong>take actions</strong> - assign owners, update projects, create real workflows, trigger checklist automations, and surface project risks.
                </p>
                <div className="space-y-1.5">
                  {QUICK_ACTIONS.map((q) => (
                    <button
                      key={q.label}
                      onClick={() => void sendMessage(q.prompt)}
                      disabled={isLoading}
                      className="block w-full text-left text-xs px-3 py-2 rounded-xl border bg-card hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {q.icon} {q.label}
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

            {isLoading && (
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

          {/* Input */}
          <div className="px-3 py-2.5 border-t bg-card">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleTextareaInput}
                placeholder="Ask a question or give an action..."
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none rounded-2xl border bg-muted/50 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(142,71%,45%)]/30 disabled:opacity-50 max-h-[120px]"
              />
              <button
                onClick={() => sendMessage()}
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
