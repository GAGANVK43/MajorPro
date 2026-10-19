import "./ResetPassword.css";
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaLock,
  FaEye,
  FaEyeSlash,
  FaArrowLeft,
  FaShieldAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaKey,
} from "react-icons/fa";
import { authService } from "../../services/api";
import AuthShowcase from "../../components/AuthShowcase/AuthShowcase";
import LanguageSelector from "../../components/LanguageSelector/LanguageSelector";
import { useTranslation } from "../../context/LanguageContext";

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const urlToken = searchParams.get("token") || "";
  const [token, setToken] = useState(urlToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
    }
  }, [urlToken]);

  const criteria = {
    length: newPassword.length >= 6,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
  };

  const isPasswordValid = criteria.length;

  const handleReset = async (e) => {
    e.preventDefault();

    if (!token.trim()) {
      toast.error(t("auth.enterResetToken") || "A valid reset token is required.");
      return;
    }

    if (!newPassword) {
      toast.error(t("auth.enterNewPassword") || "Please enter your new password.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error(t("auth.pwLengthError") || "Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("auth.pwMatchError") || "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({
        token: token.trim(),
        new_password: newPassword,
      });

      toast.success(
        t("auth.passwordResetSuccess") || "Password reset successful! Please sign in with your new password."
      );
      setTimeout(() => {
        navigate("/login");
      }, 1000);
    } catch (err) {
      toast.error(err.message || "Failed to reset password. The link or token may be expired.");
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
          <FaArrowLeft /> {t("common.backToSignIn") || "Back to Sign In"}
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
                <FaShieldAlt size={26} />
              </div>
              <h1>{t("auth.setNewPasswordTitle") || "Set New Password"}</h1>
              <p>
                {t("auth.setNewPasswordSubtitle") ||
                  "Create a strong, secure password to protect your DiaSense AI health data."}
              </p>
            </div>

            <form onSubmit={handleReset}>
              {!urlToken && (
                <div className="form-input-group">
                  <label><FaKey /> {t("auth.resetTokenLabel") || "Reset Security Token"}</label>
                  <input
                    type="text"
                    placeholder={t("auth.resetTokenPlaceholder") || "Paste your reset token here"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-input-group">
                <label><FaLock /> {t("auth.newPasswordLabel") || "New Password"}</label>
                <div className="password-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={t("auth.newPasswordPlaceholder") || "Enter at least 6 characters"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-pw-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {/* Password Criteria Checklist */}
              {newPassword.length > 0 && (
                <div className="password-criteria-box">
                  <div className="criteria-title"><FaShieldAlt /> Password Strength</div>
                  <div className="criteria-list">
                    <div className={`criteria-item ${criteria.length ? "valid" : "invalid"}`}>
                      {criteria.length ? <FaCheckCircle className="crit-icon" /> : <FaTimesCircle className="crit-icon" />}
                      At least 6 characters
                    </div>
                    <div className={`criteria-item ${criteria.uppercase ? "valid" : "invalid"}`}>
                      {criteria.uppercase ? <FaCheckCircle className="crit-icon" /> : <FaTimesCircle className="crit-icon" />}
                      Contains uppercase letter
                    </div>
                    <div className={`criteria-item ${criteria.lowercase ? "valid" : "invalid"}`}>
                      {criteria.lowercase ? <FaCheckCircle className="crit-icon" /> : <FaTimesCircle className="crit-icon" />}
                      Contains lowercase letter
                    </div>
                    <div className={`criteria-item ${criteria.number ? "valid" : "invalid"}`}>
                      {criteria.number ? <FaCheckCircle className="crit-icon" /> : <FaTimesCircle className="crit-icon" />}
                      Contains a number
                    </div>
                  </div>
                </div>
              )}

              <div className="form-input-group">
                <label><FaLock /> {t("auth.confirmPasswordLabel") || "Confirm New Password"}</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.confirmPasswordPlaceholder") || "Re-enter new password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button className="auth-submit-btn" type="submit" disabled={loading}>
                {loading ? t("common.loading") : `${t("auth.updatePasswordBtn") || "Update Password"} →`}
              </button>
            </form>

            <div className="auth-footer-link">
              <Link to="/login">{t("auth.backToSignIn") || "Back to Sign In"}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
