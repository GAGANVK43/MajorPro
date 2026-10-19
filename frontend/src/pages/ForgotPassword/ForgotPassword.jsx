import "./ForgotPassword.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaEnvelope, FaArrowLeft, FaKey, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import { authService } from "../../services/api";
import AuthShowcase from "../../components/AuthShowcase/AuthShowcase";
import LanguageSelector from "../../components/LanguageSelector/LanguageSelector";
import { useTranslation } from "../../context/LanguageContext";

function ForgotPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resetToken, setResetToken] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error(t("auth.enterEmail") || "Please enter your registered email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await authService.forgotPassword({ email });
      setSubmitted(true);
      if (response?.data?.reset_token) {
        setResetToken(response.data.reset_token);
      }
      toast.success(
        t("auth.resetLinkSent") || "If an account with that email exists, reset instructions have been sent."
      );
    } catch (err) {
      toast.error(err.message || "Failed to process password recovery. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-page">
      <div className="auth-bg-glow-1" />
      <div className="auth-bg-glow-2" />

      <div className="auth-split-container">
        {/* Floating Back Button */}
        <button className="auth-back-floating-btn" onClick={() => navigate("/login")}>
          <FaArrowLeft /> {t("auth.backToSignIn") || "Back to Sign In"}
        </button>

        {/* Floating Language Switcher */}
        <div className="auth-lang-floating-btn">
          <LanguageSelector />
        </div>

        {/* Left Side Showcase */}
        <AuthShowcase />

        {/* Right Side Form Card */}
        <div className="auth-right-form">
          <div className="auth-form-card">
            <div className="form-header">
              <div className="auth-icon-badge" style={{ marginBottom: "1rem", display: "inline-flex", padding: "12px", borderRadius: "16px", background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8" }}>
                <FaKey size={26} />
              </div>
              <h1>{t("auth.forgotPasswordTitle") || "Reset Password"}</h1>
              <p>
                {t("auth.forgotPasswordSubtitle") ||
                  "Enter your registered email address and we will help you regain secure access to your account."}
              </p>
            </div>

            {!submitted ? (
              <form onSubmit={handleSubmit}>
                <div className="form-input-group">
                  <label><FaEnvelope /> {t("auth.emailLabel") || "Email Address"}</label>
                  <input
                    type="email"
                    placeholder={t("auth.emailPlaceholder") || "Enter your registered email"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <button className="auth-submit-btn" type="submit" disabled={loading}>
                  {loading ? t("common.loading") : `${t("auth.sendResetLink") || "Send Reset Link"} →`}
                </button>
              </form>
            ) : (
              <div className="password-reset-success-box" style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "16px", padding: "1.5rem", marginTop: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#34d399", fontWeight: "600", marginBottom: "0.75rem" }}>
                  <FaCheckCircle size={20} />
                  <span>{t("auth.requestReceived") || "Instructions Dispatched"}</span>
                </div>
                <p style={{ color: "#cbd5e1", fontSize: "0.92rem", lineHeight: "1.5", margin: 0 }}>
                  If an account exists for <strong style={{ color: "#f8fafc" }}>{email}</strong>, you will receive password reset instructions.
                </p>

                {resetToken && (
                  <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px dashed rgba(255, 255, 255, 0.15)" }}>
                    <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.75rem" }}>
                      ⚡ <strong>Development Quick Link:</strong> Reset token generated for local testing:
                    </p>
                    <button
                      type="button"
                      className="auth-submit-btn"
                      onClick={() => navigate(`/reset-password?token=${resetToken}`)}
                      style={{ background: "linear-gradient(135deg, #0d9488 0%, #0284c7 100%)", marginTop: "0.5rem" }}
                    >
                      {t("auth.continueToReset") || "Set New Password Now"} →
                    </button>
                  </div>
                )}

                <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={() => { setSubmitted(false); setResetToken(null); }}
                    style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "0.88rem" }}
                  >
                    Try another email address
                  </button>
                </div>
              </div>
            )}

            <div className="auth-footer-link" style={{ marginTop: "2rem" }}>
              {t("auth.rememberPassword") || "Remember your password?"}{" "}
              <Link to="/login">{t("auth.loginLink") || "Sign In"}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
