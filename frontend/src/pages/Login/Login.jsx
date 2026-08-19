import "./Login.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaEnvelope, FaLock, FaHeartbeat, FaEye, FaEyeSlash, FaShieldAlt, FaCheckCircle, FaArrowLeft } from "react-icons/fa";
import { authService } from "../../services/api";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await authService.login({ email, password });
      const authData = response.data;

      localStorage.setItem("access_token", authData.access_token);
      localStorage.setItem("user", JSON.stringify(authData));

      toast.success("✅ Signed in successfully!");
      setTimeout(() => {
        navigate("/dashboard");
      }, 700);
    } catch (err) {
      toast.error(err.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-page">
      {/* Background Decorative Elements */}
      <div className="auth-bg-glow-1" />
      <div className="auth-bg-glow-2" />

      <div className="auth-split-container">
        {/* Back Button Floating Header */}
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

            <h2>Enterprise Medical AI Platform</h2>
            <p>
              Access your secure, isolated diabetes risk prediction dashboard powered by machine learning algorithms.
            </p>

            <div className="showcase-features">
              <div className="sc-feature">
                <FaCheckCircle className="sc-icon" />
                <span>XGBoost Clinical Risk Screening</span>
              </div>
              <div className="sc-feature">
                <FaCheckCircle className="sc-icon" />
                <span>Tailored Low-GI Diet Prescriptions</span>
              </div>
              <div className="sc-feature">
                <FaCheckCircle className="sc-icon" />
                <span>Protected JWT Encrypted Sessions</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Form Card */}
        <div className="auth-right-form">
          <div className="auth-form-card">
            <div className="form-header">
              <h1>Welcome Back 👋</h1>
              <p>Sign in to continue to your DiaSense AI dashboard.</p>
            </div>

            <form onSubmit={handleLogin}>
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
                <label><FaLock /> Password</label>
                <div className="password-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
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

              <button className="auth-submit-btn" type="submit" disabled={loading}>
                {loading ? "Authenticating..." : "Sign In →"}
              </button>
            </form>

            <div className="auth-footer-link">
              Don't have an account? <Link to="/register">Create Account</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;