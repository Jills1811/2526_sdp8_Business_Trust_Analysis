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
    const userMessage = { type: "user", text: message };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setLoading(true);

    try {
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
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      // Log error for debugging
      console.error("Chatbot error:", error);
      
      // Add error message with more details in development
      const errorMessage = {
        type: "bot",
        text: error.message || "I'm sorry, I'm having trouble right now. Please try again later or contact the business directly.",
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

  return (
    <div style={chatContainerStyle}>
      <div style={messagesStyle}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={msg.type === "user" ? userMessageStyle : botMessageStyle}
          >
            {msg.text}
          </div>
        ))}
        {loading && (
          <div style={botMessageStyle}>
            <em style={{ color: "#6b7280", fontStyle: "normal" }}>💭 Thinking...</em>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div style={inputContainerStyle}>
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

