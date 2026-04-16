"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, ArrowUp, Trash2, Sparkles, Stethoscope, Copy, Check } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  tools_used?: string[] | null;
  created_at?: string;
}

// ── Tool label mapping ───────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  search_daily_logs: "Daily Logs",
  search_symptoms: "Symptoms",
  get_lab_results: "Labs",
  get_oura_biometrics: "Oura",
  get_cycle_data: "Cycle",
  search_food_entries: "Food",
  search_pubmed: "PubMed",
  get_food_nutrients: "Nutrients",
  check_drug_interactions: "Drug Interactions",
  get_health_profile: "Health Profile",
  get_analysis_findings: "Analysis",
  get_hypothesis_status: "Hypotheses",
  get_next_best_actions: "Next Actions",
  get_research_context: "Research",
};

// ── Suggested starters ───────────────────────────────────────────────

const STARTERS = [
  // Accessible everyday questions
  "How has my pain been trending this month?",
  "What foods seem to trigger my symptoms?",
  "How is my sleep affecting my energy levels?",
  // Clinical deep-dive questions
  "What are my current diagnostic hypotheses and their confidence levels?",
  "What single test would most reduce my diagnostic uncertainty right now?",
];

const DOCTOR_PREP_PROMPT = `I have a doctor appointment coming up. Please use the hypothesis tracker and next best actions tools to:
1. Show me my current diagnostic hypotheses with their confidence levels
2. Pull the doctor visit brief for my upcoming appointment
3. List the specific tests I should request and why
4. Highlight what the Challenger found that I should bring up
5. Create a brief one-page summary I can show the doctor

Use the Clinical Intelligence Engine data, not generic advice.`;

// ── Markdown-lite renderer ───────────────────────────────────────────

function formatMessage(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4
          key={i}
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: "12px 0 4px",
          }}
        >
          {line.slice(4)}
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3
          key={i}
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: "14px 0 4px",
          }}
        >
          {line.slice(3)}
        </h3>
      );
      continue;
    }

    // Bullet points
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div
          key={i}
          style={{
            display: "flex",
            gap: 6,
            paddingLeft: 4,
            marginTop: 2,
          }}
        >
          <span
            style={{
              color: "var(--accent-sage)",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {"\u2022"}
          </span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Numbered lists
    const numMatch = line.match(/^(\d+)\.\s/);
    if (numMatch) {
      elements.push(
        <div
          key={i}
          style={{
            display: "flex",
            gap: 6,
            paddingLeft: 4,
            marginTop: 2,
          }}
        >
          <span
            style={{
              color: "var(--accent-sage)",
              fontWeight: 600,
              flexShrink: 0,
              minWidth: 18,
            }}
          >
            {numMatch[1]}.
          </span>
          <span>{renderInline(line.slice(numMatch[0].length))}</span>
        </div>
      );
      continue;
    }

    // Empty lines
    if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: 8 }} />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} style={{ margin: "2px 0" }}>
        {renderInline(line)}
      </p>
    );
  }

  return elements;
}

/** Confidence category badge colors */
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  ESTABLISHED: { bg: "#dcfce7", text: "#166534" },
  PROBABLE: { bg: "#dbeafe", text: "#1e40af" },
  POSSIBLE: { bg: "#fef3c7", text: "#92400e" },
  SPECULATIVE: { bg: "#ffedd5", text: "#9a3412" },
  INSUFFICIENT: { bg: "#f3f4f6", text: "#4b5563" },
};

const CATEGORY_RE = /\((ESTABLISHED|PROBABLE|POSSIBLE|SPECULATIVE|INSUFFICIENT)\)/g;

/** Render inline bold and confidence badges within a line */
function renderInline(text: string): React.ReactNode {
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Check for confidence category badges in non-bold text
    const re = new RegExp(CATEGORY_RE.source, "g");
    if (re.test(part)) {
      const re2 = new RegExp(CATEGORY_RE.source, "g");
      const segments: React.ReactNode[] = [];
      let lastIdx = 0;
      let match: RegExpExecArray | null;
      while ((match = re2.exec(part)) !== null) {
        if (match.index > lastIdx) {
          segments.push(part.slice(lastIdx, match.index));
        }
        const cat = match[1];
        const colors = CATEGORY_COLORS[cat];
        segments.push(
          <span
            key={`${i}-${match.index}`}
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 600,
              padding: "1px 7px",
              borderRadius: 8,
              backgroundColor: colors.bg,
              color: colors.text,
              lineHeight: 1.5,
              verticalAlign: "middle",
            }}
          >
            {cat}
          </span>
        );
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < part.length) {
        segments.push(part.slice(lastIdx));
      }
      return <span key={i}>{segments}</span>;
    }
    return part;
  });
}

// ── Loading dots animation ───────────────────────────────────────────

function LoadingDots() {
  return (
    <div style={{ display: "flex", gap: 4, padding: "4px 0" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--accent-sage)",
            animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes dotPulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Copy button for AI messages ─────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: copied ? "var(--accent-sage-muted)" : "transparent",
        border: `1px solid ${copied ? "var(--accent-sage)" : "var(--border)"}`,
        borderRadius: 8,
        padding: "4px 10px",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 500,
        color: copied ? "var(--accent-sage)" : "var(--text-muted)",
        transition: "all 150ms ease",
        marginTop: 8,
        alignSelf: "flex-end",
      }}
      onMouseEnter={(e) => {
        if (!copied) {
          e.currentTarget.style.borderColor = "var(--accent-sage)";
          e.currentTarget.style.color = "var(--accent-sage)";
        }
      }}
      onMouseLeave={(e) => {
        if (!copied) {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.color = "var(--text-muted)";
        }
      }}
      title="Copy to clipboard"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── Main Chat Page ───────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Load history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/chat/history");
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(
              data.messages.map(
                (m: {
                  id: string;
                  role: string;
                  content: string;
                  tools_used: string[] | null;
                  created_at: string;
                }) => ({
                  id: m.id,
                  role: m.role as "user" | "assistant",
                  content: m.content,
                  tools_used: m.tools_used,
                  created_at: m.created_at,
                })
              )
            );
          }
        }
      } catch {
        // Silently fail - history is nice-to-have
      } finally {
        setHistoryLoaded(true);
      }
    }
    loadHistory();
  }, []);

  // Auto-resize textarea
  const handleTextareaChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px"; // max ~4 lines
  };

  // Send message
  const sendMessage = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || loading) return;

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Optimistically add user message
    const userMsg: ChatMessage = { role: "user", content: messageText };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.response,
        tools_used: data.toolsUsed,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: `Sorry, something went wrong: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Clear history
  const clearHistory = async () => {
    try {
      await fetch("/api/chat/history", { method: "DELETE" });
      setMessages([]);
    } catch {
      // Silently fail
    }
  };

  const showStarters = historyLoaded && messages.length === 0 && !loading;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - var(--nav-height) - var(--safe-bottom))",
        maxWidth: 640,
        marginLeft: "auto",
        marginRight: "auto",
        width: "100%",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-light)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MessageSquare
            size={20}
            style={{ color: "var(--accent-sage)" }}
            strokeWidth={2}
          />
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            AI Research
          </h1>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              borderRadius: 8,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              transition: "color 150ms ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--pain-severe)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
            title="Clear conversation"
          >
            <Trash2 size={14} />
            Clear
          </button>
        )}
      </div>

      {/* ── Messages ────────────────────────────────────────────── */}
      <div
        className="hide-scrollbar"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Suggested starters */}
        {showStarters && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              flex: 1,
              padding: "0 8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Sparkles
                size={20}
                style={{ color: "var(--accent-sage)" }}
              />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                Ask me anything about your health data
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                width: "100%",
                maxWidth: 400,
              }}
            >
              {/* Doctor Visit Prep card */}
              <button
                onClick={() => sendMessage(DOCTOR_PREP_PROMPT)}
                style={{
                  background: "var(--accent-sage-muted)",
                  border: "1.5px solid var(--accent-sage)",
                  borderRadius: 14,
                  padding: "14px 16px",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  transition: "box-shadow 150ms ease, transform 150ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "none";
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "var(--accent-sage)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Stethoscope size={20} style={{ color: "var(--text-inverse)" }} strokeWidth={2} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      lineHeight: 1.3,
                    }}
                  >
                    Prepare for a Doctor Visit
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      lineHeight: 1.4,
                      marginTop: 2,
                    }}
                  >
                    Get a health summary, talking points, and questions to ask
                  </div>
                </div>
              </button>

              {/* Regular starter questions */}
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  onClick={() => sendMessage(starter)}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "12px 16px",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "var(--text-primary)",
                    lineHeight: 1.4,
                    transition: "border-color 150ms ease, box-shadow 150ms ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent-sage)";
                    e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, idx) => (
          <div
            key={msg.id || idx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              gap: 4,
            }}
          >
            <div
              style={{
                maxWidth: msg.role === "user" ? "85%" : "92%",
                padding: msg.role === "user" ? "10px 14px" : "12px 16px",
                borderRadius:
                  msg.role === "user"
                    ? "16px 16px 4px 16px"
                    : "16px 16px 16px 4px",
                background:
                  msg.role === "user"
                    ? "var(--accent-sage)"
                    : "var(--bg-card)",
                color:
                  msg.role === "user"
                    ? "var(--text-inverse)"
                    : "var(--text-primary)",
                fontSize: 14,
                lineHeight: 1.55,
                boxShadow: "var(--shadow-sm)",
                border:
                  msg.role === "assistant"
                    ? "1px solid var(--border-light)"
                    : "none",
                wordBreak: "break-word",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div>{msg.role === "assistant"
                ? formatMessage(msg.content)
                : msg.content}</div>
              {msg.role === "assistant" && msg.content.length > 200 && (
                <CopyButton text={msg.content} />
              )}
            </div>

            {/* Tool use pills */}
            {msg.role === "assistant" &&
              msg.tools_used &&
              msg.tools_used.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    paddingLeft: 4,
                  }}
                >
                  {msg.tools_used.map((tool) => (
                    <span
                      key={tool}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--accent-sage-muted)",
                        color: "var(--accent-sage)",
                        fontWeight: 500,
                      }}
                    >
                      {TOOL_LABELS[tool] || tool}
                    </span>
                  ))}
                </div>
              )}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 4,
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "16px 16px 16px 4px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-light)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <LoadingDots />
            </div>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                paddingLeft: 4,
              }}
            >
              Searching your health data...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          padding: "8px 12px 12px",
          borderTop: "1px solid var(--border-light)",
          background: "var(--bg-primary)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            background: "var(--bg-input)",
            borderRadius: 20,
            padding: "6px 6px 6px 16px",
            border: "1px solid var(--border)",
            transition: "border-color 150ms ease",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your health data..."
            rows={1}
            disabled={loading}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              resize: "none",
              outline: "none",
              fontSize: 14,
              lineHeight: 1.4,
              color: "var(--text-primary)",
              padding: "6px 0",
              maxHeight: 96,
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              background:
                loading || !input.trim()
                  ? "var(--bg-elevated)"
                  : "var(--accent-sage)",
              color:
                loading || !input.trim()
                  ? "var(--text-muted)"
                  : "var(--text-inverse)",
              cursor:
                loading || !input.trim() ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background 150ms ease, color 150ms ease",
            }}
            aria-label="Send message"
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
