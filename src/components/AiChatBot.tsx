import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelsContext";
import { calculateTimeFromChecklist, formatDuration } from "@/data/projectsData";
import { MessageCircle, X, Send, Loader2, Bot, CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type Msg = { role: "user" | "assistant"; content: string; time: string };

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { projects } = useProjects();
  const { currentUser } = useAuth();
  const { teamLabels, responsibilityLabels } = useLabels();
  const queryClient = useQueryClient();

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

  if (!currentUser) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full bg-[hsl(142,71%,45%)] text-white shadow-xl hover:shadow-2xl transition-all hover:scale-105 flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 left-6 z-50 w-[420px] h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 border border-border">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[hsl(142,71%,35%)] text-white">
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
