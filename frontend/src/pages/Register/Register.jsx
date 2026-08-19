import "../Login/Login.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaUser, FaEnvelope, FaLock, FaHeartbeat, FaEye, FaEyeSlash, FaCheckCircle, FaTimesCircle, FaArrowLeft, FaShieldAlt } from "react-icons/fa";
import { authService } from "../../services/api";

function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Real-time password criteria validations
  const criteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const isPasswordValid = Object.values(criteria).every(Boolean);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      toast.error("Please fill in all required registration fields.");
      return;
    }

    if (!isPasswordValid) {
      toast.error("Password does not meet all security criteria.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    try {
      const response = await authService.register({
        full_name: fullName,
        email: email,
        password: password,
      });

      const authData = response.data;
      localStorage.setItem("access_token", authData.access_token);
      localStorage.setItem("user", JSON.stringify(authData));

      toast.success("✅ Account created successfully! Welcome to DiaSense AI.");
      setTimeout(() => {
        navigate("/dashboard");
      }, 700);
    } catch (err) {
      toast.error(err.message || "Registration failed. Email may already be registered.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-page">
      {/* Background Glow Accents */}
      <div className="auth-bg-glow-1" />
      <div className="auth-bg-glow-2" />

      <div className="auth-split-container">
        {/* Floating Back Button */}
        <button className="auth-back-floating-btn" onClick={() => navigate("/")}>
          <FaArrowLeft /> Go Back to Home
        </button>

        {/* Left Side Brand Showcase */}
        <div className="auth-left-showcase">
          <div className="showcase-content-wrapper">
            <div className="showcase-logo">
              <FaHeartbeat className="logo-icon" />
              <span>DiaSense <strong>AI</strong></span>
            </div>

            <h2>Join DiaSense AI Platform</h2>
            <p>
              Create an account to access your secure diabetes risk screening dashboard, track historical assessments, and download clinical PDF reports.
            </p>

            <div className="showcase-features">
              <div className="sc-feature">
                <FaCheckCircle className="sc-icon" />
                <span>Full Historical Assessment Tracking</span>
              </div>
              <div className="sc-feature">
                <FaCheckCircle className="sc-icon" />
                <span>Tailored Low-GI Diet Prescriptions</span>
              </div>
              <div className="sc-feature">
                <FaCheckCircle className="sc-icon" />
                <span>Encrypted Account Security & JWT Protection</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Registration Form */}
        <div className="auth-right-form">
          <div className="auth-form-card">
            <div className="form-header">
              <h1>Create Account 🚀</h1>
              <p>Register for your AI-powered diabetes risk account.</p>
            </div>

            <form onSubmit={handleRegister}>
              <div className="form-input-group">
                <label><FaUser /> Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-input-group">
                <label><FaEnvelope /> Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-input-group">
                <label><FaLock /> Create Password</label>
                <div className="password-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter a secure password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              {/* Password Criteria Real-Time Checklist */}
              {password.length > 0 && (
                <div className="password-criteria-box">
                  <div className="criteria-title"><FaShieldAlt /> Password Requirements:</div>
                  <div className="criteria-list">
                    <div className={`criteria-item ${criteria.length ? "valid" : "invalid"}`}>
                      {criteria.length ? <FaCheckCircle className="crit-icon" /> : <FaTimesCircle className="crit-icon" />}
                      At least 8 characters
                    </div>
                    <div className={`criteria-item ${criteria.uppercase ? "valid" : "invalid"}`}>
                      {criteria.uppercase ? <FaCheckCircle className="crit-icon" /> : <FaTimesCircle className="crit-icon" />}
                      At least 1 uppercase letter (A-Z)
                    </div>
                    <div className={`criteria-item ${criteria.lowercase ? "valid" : "invalid"}`}>
                      {criteria.lowercase ? <FaCheckCircle className="crit-icon" /> : <FaTimesCircle className="crit-icon" />}
                      At least 1 lowercase letter (a-z)
                    </div>
                    <div className={`criteria-item ${criteria.number ? "valid" : "invalid"}`}>
                      {criteria.number ? <FaCheckCircle className="crit-icon" /> : <FaTimesCircle className="crit-icon" />}
                      At least 1 number (0-9)
                    </div>
                    <div className={`criteria-item ${criteria.special ? "valid" : "invalid"}`}>
                      {criteria.special ? <FaCheckCircle className="crit-icon" /> : <FaTimesCircle className="crit-icon" />}
                      At least 1 special character (!@#$%^&*)
                    </div>
                  </div>
                </div>
              )}

              <div className="form-input-group">
                <label><FaLock /> Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button className="auth-submit-btn" type="submit" disabled={loading}>
                {loading ? "Creating Account..." : "Create Account →"}
              </button>
            </form>

            <div className="auth-footer-link">
              Already have an account? <Link to="/login">Sign In</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;