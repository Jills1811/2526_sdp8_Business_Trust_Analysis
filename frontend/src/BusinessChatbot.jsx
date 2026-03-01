import React, { useState, useRef, useEffect } from "react";

const BASE_URL = "http://localhost:8000";

const chatContainerStyle = {
  display: "flex",
  flexDirection: "column",
  height: "500px",
  border: "1px solid #e5e7eb",
  borderRadius: "0.75rem",
  background: "#ffffff",
  overflow: "hidden",
  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
};

const messagesStyle = {
  flex: 1,
  overflowY: "auto",
  padding: "1.25rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  background: "#fafafa",
};

const messageStyle = {
  padding: "0.75rem 1rem",
  borderRadius: "0.75rem",
  maxWidth: "80%",
  wordWrap: "break-word",
  fontSize: "0.95rem",
  lineHeight: "1.5",
};

const userMessageStyle = {
  ...messageStyle,
  background: "#2563eb",
  color: "#ffffff",
  alignSelf: "flex-end",
  marginLeft: "auto",
  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.2)",
};

const botMessageStyle = {
  ...messageStyle,
  background: "#ffffff",
  color: "#1f2937",
  alignSelf: "flex-start",
  border: "1px solid #e5e7eb",
  boxShadow: "0 2px 4px rgba(15,23,42,0.05)",
};

const inputContainerStyle = {
  display: "flex",
  gap: "0.5rem",
  padding: "1rem",
  borderTop: "1px solid #e5e7eb",
  background: "#ffffff",
};

const inputStyle = {
  flex: 1,
  padding: "0.75rem",
  border: "1px solid #d1d5db",
  borderRadius: "0.5rem",
  fontSize: "0.95rem",
  outline: "none",
  fontFamily: "inherit",
};

const inputStyleFocus = {
  ...inputStyle,
  borderColor: "#2563eb",
  boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.1)",
};

const buttonStyle = {
  padding: "0.75rem 1.5rem",
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: "0.5rem",
  cursor: "pointer",
  fontSize: "0.95rem",
  fontWeight: 600,
  transition: "background 0.15s ease, transform 0.1s ease",
};

const buttonDisabledStyle = {
  ...buttonStyle,
  background: "#9ca3af",
  cursor: "not-allowed",
};

export default function BusinessChatbot({ companyId, businessName }) {
  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: `Hello! I'm here to help answer questions about ${businessName || "this business"}. What would you like to know?`,
      // intent: "help",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const message = inputValue.trim();
    if (!message || loading) return;

    // Add user message
    const userMessage = { type: "user", text: message, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setLoading(true);

    try {
      const start = Date.now();
      const response = await fetch(`${BASE_URL}/api/company/${companyId}/chatbot/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Log error details for debugging
        console.error("Chatbot API error:", data);
        throw new Error(data.error || data.detail || "Failed to get response");
      }

      // Add bot response
      const botMessage = {
        type: "bot",
        text: data.response || "I'm sorry, I couldn't process that question.",
        intent: data.intent || undefined,
        data: data.data || undefined,
        timestamp: new Date().toISOString(),
      };
      // Natural typing delay so responses feel human
      const minThink = 700; // ms
      const jitter = Math.floor(Math.random() * 500); // 0-500ms
      const elapsed = Date.now() - start;
      const waitMs = Math.max(0, minThink + jitter - elapsed);
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      // Log error for debugging
      console.error("Chatbot error:", error);
      
      // Add error message with more details in development
      const errorMessage = {
        type: "bot",
        text: error.message || "I'm sorry, I'm having trouble right now. Please try again later or contact the business directly.",
        intent: undefined,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickAsk = async (preset) => {
    if (loading) return;
    setInputValue(preset);
    await handleSend();
  };

  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };



  const extractPhone = (text) => {
    try {
      const match = text.match(/(\+?\d[\d\s-]{7,}\d)/);
      if (!match) return null;
      const raw = match[1];
      return raw.replace(/[^\d+]/g, "");
    } catch {
      return null;
    }
  };

  const mapsUrlFromText = (text) => {
    try {
      const lower = text.toLowerCase();
      const key = "located at";
      const idx = lower.indexOf(key);
      let query = idx !== -1 ? text.substring(idx + key.length).trim() : text;
      query = query.replace(/^[.:\-\s]+/, "").replace(/[.]$/, "");
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    } catch {
      return null;
    }
  };

  const resetConversation = () => {
    setMessages([
      {
        type: "bot",
        text: `Restarted. Ask me about ${businessName || "this business"}.`,
        intent: undefined,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div style={chatContainerStyle}>
      <div style={messagesStyle}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={msg.type === "user" ? userMessageStyle : botMessageStyle}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {msg.type === "bot" ? (
                // Intent-aware rendering with structured cards
                msg.intent === "hours" && msg.data ? (
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <div><strong>Open:</strong> {msg.data.opening_time || "Not available"}</div>
                      <div><strong>Close:</strong> {msg.data.closing_time || "Not available"}</div>
                    </div>
                    <div style={{ marginTop: "0.25rem" }}>
                      <strong>Days:</strong> {Array.isArray(msg.data.working_days) && msg.data.working_days.length > 0 ? msg.data.working_days.join(", ") : "Not specified"}
                    </div>
                  </div>
                ) : msg.intent === "services" && msg.data ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {(msg.data.services || []).length > 0 ? (
                      (msg.data.services).map((s, i) => (
                        <span key={`${s}-${i}`} style={{
                          padding: "0.2rem 0.5rem",
                          background: "#f3f4f6",
                          border: "1px solid #e5e7eb",
                          borderRadius: "999px",
                          fontSize: "0.85rem",
                          color: "#374151",
                        }}>{s}</span>
                      ))
                    ) : (
                      <span>No services listed.</span>
                    )}
                  </div>
                ) : msg.intent === "location" && msg.data ? (
                  <div style={{ width: "100%" }}>
                    <div>
                      <strong>Address:</strong> {[msg.data.address, msg.data.city, msg.data.country].filter(Boolean).join(", ") || "Not available"}
                    </div>
                    <div style={{ marginTop: "0.35rem" }}>
                      <a
                        href={mapsUrlFromText([msg.data.address, msg.data.city, msg.data.country].filter(Boolean).join(", ")) || "#"}
                        target="_blank"
                        rel="noreferrer"
                        title="Open in Maps"
                        style={{ textDecoration: "none", color: "#3b82f6", fontSize: "0.9rem" }}
                      >
                        Open in Maps
                      </a>
                    </div>
                  </div>
                ) : msg.intent === "contact" && msg.data ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span><strong>Phone:</strong> {msg.data.phone || "Not available"}</span>
                    {msg.data.phone && (
                      <button
                        onClick={() => {
                          const phone = (msg.data.phone || "").replace(/[^\d+]/g, "");
                          if (phone) window.location.href = `tel:${phone}`;
                        }}
                        title="Call"
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#10b981",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                        }}
                      >
                        Call
                      </button>
                    )}
                  </div>
                ) : msg.intent === "name" ? (
                  <span>{msg.text}</span>
                ) : msg.intent === "description" && msg.data ? (
                  <div>{msg.data.description || msg.text}</div>
                ) : (
                  <span>{msg.text}</span>
                )
              ) : (
                <span>{msg.text}</span>
              )}
              {/* All copy and intent badges removed as requested */}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
              {formatTime(msg.timestamp)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={botMessageStyle}>
            <em style={{ color: "#6b7280", fontStyle: "normal" }}>💭 Thinking...</em>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ ...inputContainerStyle, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", width: "100%", marginBottom: "0.5rem" }}>
          {[
            "What is your shop name?",
            "Describe the company.",
            "What services do you offer?",
            "What are your business hours?",
            "Where are you located?",
            "How can I contact you?",
          ].map((label) => (
            <button
              key={label}
              disabled={loading}
              onClick={() => quickAsk(label)}
              style={{
                padding: "0.4rem 0.6rem",
                background: "#f3f4f6",
                color: "#374151",
                border: "1px solid #e5e7eb",
                borderRadius: "999px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "0.85rem",
              }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={resetConversation}
            disabled={loading}
            style={{
              padding: "0.4rem 0.6rem",
              background: "#fff",
              color: "#ef4444",
              border: "1px solid #fecaca",
              borderRadius: "999px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "0.85rem",
            }}
          >
            Reset
          </button>
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="Ask a question about this business..."
          style={inputFocused ? inputStyleFocus : inputStyle}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !inputValue.trim()}
          style={loading || !inputValue.trim() ? buttonDisabledStyle : buttonStyle}
          onMouseEnter={(e) => {
            if (!loading && inputValue.trim()) {
              e.target.style.background = "#1d4ed8";
              e.target.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && inputValue.trim()) {
              e.target.style.background = "#2563eb";
              e.target.style.transform = "translateY(0)";
            }
          }}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}

