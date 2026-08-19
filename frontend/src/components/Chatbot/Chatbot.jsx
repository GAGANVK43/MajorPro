import "./Chatbot.css";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { FaRobot, FaTimes, FaPaperPlane, FaLightbulb, FaUser, FaHeartbeat } from "react-icons/fa";
import { chatbotService } from "../../services/api";

const SUGGESTION_CHIPS = [
  "Why is my risk high?",
  "What should I eat today?",
  "Explain my report.",
  "How can I improve my health?",
  "What does BMI mean?",
];

function Chatbot() {
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "👋 Hi! I am **DiaSense AI Assistant**. How can I help you with your diabetes risk screening or health guidance today?",
      source: "DiaSense Healthcare Engine",
    },
  ]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // Restrict Chatbot widget visibility strictly to authenticated logged-in users
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const savedUser = localStorage.getItem("user");
    setIsLoggedIn(!!(token && savedUser));
  }, [location]);

  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // If user is not logged in, hide AI chatbot completely
  if (!isLoggedIn) {
    return null;
  }

  const handleSend = async (textToSend) => {
    const text = textToSend || inputMsg;
    if (!text.trim() || loading) return;

    // Append user message
    const userMessage = { sender: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputMsg("");
    setLoading(true);

    try {
      const response = await chatbotService.query(text);
      const botReply = response.data.reply;
      const source = response.data.source;

      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: botReply, source },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "I experienced a temporary network issue. Please try asking again.",
          source: "System Error",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="chatbot-floating-wrapper">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button className="chatbot-toggle-btn" onClick={() => setIsOpen(true)}>
          <FaRobot className="bot-icon" />
          <span className="btn-label">DiaSense AI</span>
          <span className="online-badge" />
        </button>
      )}

      {/* Floating Chat Window Panel */}
      {isOpen && (
        <div className="chatbot-window">
          {/* Header */}
          <div className="chatbot-header">
            <div className="header-title">
              <FaRobot className="bot-header-icon" />
              <div>
                <h4>DiaSense AI Assistant</h4>
                <p>24/7 Clinical & Health Guidance</p>
              </div>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              <FaTimes />
            </button>
          </div>

          {/* Messages Stream */}
          <div className="chatbot-body">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-bubble-row ${msg.sender === "user" ? "user-row" : "bot-row"}`}
              >
                <div className="avatar">
                  {msg.sender === "user" ? <FaUser /> : <FaHeartbeat />}
                </div>
                <div className="bubble-content">
                  <div className="bubble-text">
                    {msg.text.split("\n").map((line, lIdx) => (
                      <p key={lIdx}>{line}</p>
                    ))}
                  </div>
                  {msg.source && msg.sender === "bot" && (
                    <span className="source-tag">Powered by {msg.source}</span>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-bubble-row bot-row">
                <div className="avatar"><FaHeartbeat /></div>
                <div className="bubble-content">
                  <div className="typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Suggestion Chips */}
          <div className="chatbot-chips-bar">
            <span className="chips-label"><FaLightbulb /> Suggested Questions:</span>
            <div className="chips-scroll">
              {SUGGESTION_CHIPS.map((chip, cIdx) => (
                <button
                  key={cIdx}
                  className="chip-btn"
                  onClick={() => handleSend(chip)}
                  disabled={loading}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Input Box */}
          <div className="chatbot-footer">
            <input
              type="text"
              placeholder="Ask a question about your health or report..."
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <button
              className="send-btn"
              onClick={() => handleSend()}
              disabled={loading || !inputMsg.trim()}
            >
              <FaPaperPlane />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chatbot;
