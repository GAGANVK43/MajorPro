import "./ForgotPassword.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaEnvelope,
  FaArrowLeft,
  FaKey,
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
} from "react-icons/fa";
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
  const [deliveryInfo, setDeliveryInfo] = useState({
    emailDispatched: false,
    deliveryStatus: "unverified",
    devDiagnostic: null,
    devResetToken: null,
  });

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

      const data = response?.data || {};
      setDeliveryInfo({
        emailDispatched: Boolean(data.email_dispatched),
        deliveryStatus: data.delivery_status || "unverified",
        devDiagnostic: data.dev_diagnostic || null,
        devResetToken: data.dev_reset_token || null,
      });

      if (data.email_dispatched) {
        toast.success(
          t("auth.resetLinkSent") || "Password reset instructions dispatched to your inbox."
        );
      } else {
        toast.info(
          data.message || "If an account with that email exists, recovery has been initiated."
        );
      }
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
              <div
                className="auth-icon-badge"
                style={{
                  marginBottom: "1rem",
                  display: "inline-flex",
                  padding: "12px",
                  borderRadius: "16px",
                  background: "rgba(14, 165, 233, 0.15)",
                  color: "#38bdf8",
                }}
              >
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
              <div
                className="password-reset-success-box"
                style={{
                  background: deliveryInfo.emailDispatched
                    ? "rgba(16, 185, 129, 0.1)"
                    : "rgba(14, 165, 233, 0.08)",
                  border: `1px solid ${
                    deliveryInfo.emailDispatched
                      ? "rgba(16, 185, 129, 0.3)"
                      : "rgba(14, 165, 233, 0.25)"
                  }`,
                  borderRadius: "16px",
                  padding: "1.5rem",
                  marginTop: "1rem",
                }}
              >
                {/* Status Indicator */}
                {deliveryInfo.emailDispatched ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      color: "#34d399",
                      fontWeight: "600",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <FaCheckCircle size={20} />
                    <span>Email Sent to Mailbox</span>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      color: "#38bdf8",
                      fontWeight: "600",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <FaInfoCircle size={20} />
                    <span>Recovery Request Processed</span>
                  </div>
                )}

                <p style={{ color: "#cbd5e1", fontSize: "0.92rem", lineHeight: "1.5", margin: 0 }}>
                  {deliveryInfo.emailDispatched ? (
                    <>
                      A secure password reset link has been dispatched to{" "}
                      <strong style={{ color: "#f8fafc" }}>{email}</strong>. Please check your inbox
                      and spam folder.
                    </>
                  ) : (
                    <>
                      If an account exists for <strong style={{ color: "#f8fafc" }}>{email}</strong>,
                      password reset instructions have been recorded.
                    </>
                  )}
                </p>

                {/* Safe Developer Diagnostic when SMTP is unconfigured */}
                {deliveryInfo.devDiagnostic && (
                  <div
                    style={{
                      marginTop: "1.25rem",
                      padding: "1rem",
                      background: "rgba(245, 158, 11, 0.1)",
                      border: "1px solid rgba(245, 158, 11, 0.25)",
                      borderRadius: "12px",
                      fontSize: "0.85rem",
                      color: "#fde68a",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold", marginBottom: "4px" }}>
                      <FaExclamationTriangle />
                      <span>Notice for Developer:</span>
                    </div>
                    <p style={{ margin: "4px 0 8px 0", color: "#e2e8f0", lineHeight: "1.4" }}>
                      {deliveryInfo.devDiagnostic}
                    </p>
                    {deliveryInfo.devResetToken && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <button
                          type="button"
                          className="auth-submit-btn"
                          onClick={() => navigate(`/reset-password?token=${deliveryInfo.devResetToken}`)}
                          style={{
                            background: "linear-gradient(135deg, #0d9488 0%, #0284c7 100%)",
                            padding: "0.6rem 1rem",
                            fontSize: "0.88rem",
                            margin: 0,
                          }}
                        >
                          ⚡ Test Reset Link (Local Dev Mode) →
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setDeliveryInfo({
                        emailDispatched: false,
                        deliveryStatus: "unverified",
                        devDiagnostic: null,
                        devResetToken: null,
                      });
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#38bdf8",
                      cursor: "pointer",
                      fontSize: "0.88rem",
                    }}
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
