import "../Login/Login.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaCheckCircle, FaTimesCircle, FaArrowLeft, FaShieldAlt, FaCalendarAlt, FaVenusMars } from "react-icons/fa";
import { authService } from "../../services/api";
import AuthShowcase from "../../components/AuthShowcase/AuthShowcase";

function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
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
        age: age ? parseInt(age, 10) : undefined,
        gender: gender || "Male",
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

        {/* Left Side Designed Medical AI Showcase */}
        <AuthShowcase />

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

              {/* Age and Gender Inputs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div className="form-input-group">
                  <label><FaCalendarAlt /> Age (Years)</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    placeholder="e.g. 35"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>

                <div className="form-input-group">
                  <label><FaVenusMars /> Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.85rem 1rem",
                      borderRadius: "12px",
                      background: "#0f172a",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#f8fafc",
                      fontSize: "0.95rem"
                    }}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
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