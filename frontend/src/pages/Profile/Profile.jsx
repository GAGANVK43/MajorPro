import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { 
  FaUser, 
  FaEnvelope, 
  FaLock, 
  FaCalendarAlt, 
  FaVenusMars, 
  FaShieldAlt, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaEye, 
  FaEyeSlash, 
  FaHeartbeat, 
  FaNotesMedical, 
  FaUtensils, 
  FaCamera, 
  FaArrowRight,
  FaKey,
  FaIdBadge
} from "react-icons/fa";
import { userService } from "../../services/api";
import "./Profile.css";

function Profile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("personal"); // "personal" | "security" | "health"
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  // Profile Form State
  const [userId, setUserId] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [memberSince, setMemberSince] = useState("");
  const [stats, setStats] = useState({
    totalAssessments: 0,
    latestPrediction: null,
    latestRiskScore: null,
    latestDate: null,
  });

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Password criteria check
  const criteria = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
  };
  const isNewPwValid = Object.values(criteria).every(Boolean);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const res = await userService.getProfile();
      const data = res.data;
      if (data) {
        const u = data.user;
        setUserId(u.id);
        setFullName(u.full_name || "");
        setEmail(u.email || "");
        setAge(u.age ? String(u.age) : "");
        setGender(u.gender || "Male");
        if (u.created_at) {
          setMemberSince(new Date(u.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          }));
        }
        setStats({
          totalAssessments: data.total_assessments || 0,
          latestPrediction: data.latest_prediction || null,
          latestRiskScore: data.latest_risk_score !== null ? data.latest_risk_score : null,
          latestDate: data.latest_assessment_date || null,
        });
      }
    } catch (err) {
      toast.error(err.message || "Failed to load user profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full Name cannot be empty.");
      return;
    }

    setSavingProfile(true);
    try {
      await userService.updateProfile({
        full_name: fullName.trim(),
        age: age ? parseInt(age, 10) : undefined,
        gender: gender || "Male",
      });

      // Update local storage user details
      const localUser = JSON.parse(localStorage.getItem("user") || "{}");
      localUser.full_name = fullName.trim();
      localStorage.setItem("user", JSON.stringify(localUser));

      toast.success("✅ Profile updated successfully in MySQL database!");
    } catch (err) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (!isNewPwValid) {
      toast.error("New password does not meet all security requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match. Please re-enter.");
      return;
    }

    setChangingPw(true);
    try {
      await userService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      toast.success("🔒 Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err.message || "Failed to change password. Check your current password.");
    } finally {
      setChangingPw(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <div className="profile-page-loading">
        <div className="profile-spinner" />
        <p>Loading your DiaSense AI profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-dashboard-container">
      {/* Background Decorative Lighting */}
      <div className="profile-ambient-glow-1" />
      <div className="profile-ambient-glow-2" />

      <div className="profile-dashboard-wrapper">
        {/* Header Hero Card */}
        <div className="profile-header-card">
          <div className="profile-user-identity">
            <div className="profile-avatar-capsule">
              <span className="avatar-initials">{getInitials(fullName)}</span>
              <div className="avatar-online-dot" />
            </div>

            <div className="profile-text-meta">
              <div className="name-role-row">
                <h2>{fullName || "DiaSense Patient"}</h2>
                <span className="patient-badge"><FaCheckCircle /> Verified Patient</span>
              </div>
              <p className="profile-email-sub">{email}</p>
              <div className="profile-pills-row">
                <span className="info-chip"><FaIdBadge /> Patient ID: #{userId || "1"}</span>
                <span className="info-chip"><FaCalendarAlt /> Member Since: {memberSince || "Recent"}</span>
                <span className="info-chip"><FaVenusMars /> {gender || "Male"} • {age ? `${age} Yrs` : "Age N/A"}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="profile-quick-stats">
            <div className="stat-mini-card">
              <span className="stat-mini-label">Total Screenings</span>
              <span className="stat-mini-val cyan">{stats.totalAssessments}</span>
            </div>
            <div className="stat-mini-card">
              <span className="stat-mini-label">Latest Risk Status</span>
              <span className={`stat-mini-val ${stats.latestPrediction === "Diabetic" ? "red" : "emerald"}`}>
                {stats.latestPrediction ? (stats.latestPrediction === "Diabetic" ? "Diabetic" : "Low Risk") : "Pending"}
              </span>
            </div>
            <div className="stat-mini-card">
              <span className="stat-mini-label">Risk Probability</span>
              <span className="stat-mini-val">
                {stats.latestRiskScore !== null ? `${stats.latestRiskScore}%` : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="profile-tab-bar">
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === "personal" ? "active" : ""}`}
            onClick={() => setActiveTab("personal")}
          >
            <FaUser /> Personal Information
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === "security" ? "active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            <FaKey /> Security & Password
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === "health" ? "active" : ""}`}
            onClick={() => setActiveTab("health")}
          >
            <FaHeartbeat /> Quick Health Shortcuts
          </button>
        </div>

        {/* Tab 1: Personal Profile Information */}
        {activeTab === "personal" && (
          <div className="profile-tab-pane">
            <div className="pane-header">
              <h3>Edit Personal Information</h3>
              <p>Update your name, age, and gender stored in your MySQL patient record.</p>
            </div>

            <form onSubmit={handleUpdateProfile} className="profile-form-grid">
              <div className="form-group-card">
                <label><FaUser className="form-lbl-icon" /> Full Name</label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-card">
                <label><FaEnvelope className="form-lbl-icon" /> Email Address</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  title="Email cannot be changed directly"
                  className="input-disabled"
                />
                <span className="field-hint">Email address is permanently bound to your account.</span>
              </div>

              <div className="form-row-2col">
                <div className="form-group-card">
                  <label><FaCalendarAlt className="form-lbl-icon" /> Age (Years)</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    placeholder="e.g. 35"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>

                <div className="form-group-card">
                  <label><FaVenusMars className="form-lbl-icon" /> Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-actions-row">
                <button type="submit" className="save-changes-btn" disabled={savingProfile}>
                  {savingProfile ? "Saving to MySQL..." : "💾 Save Profile Changes"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Security & Change Password */}
        {activeTab === "security" && (
          <div className="profile-tab-pane">
            <div className="pane-header">
              <h3>Change Account Password</h3>
              <p>Update your password to ensure secure, encrypted access to your health dashboard.</p>
            </div>

            <form onSubmit={handleChangePassword} className="security-form-container">
              <div className="form-group-card">
                <label><FaLock className="form-lbl-icon" /> Current Password</label>
                <div className="pw-input-wrapper">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    placeholder="Enter your current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="pw-toggle-btn"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                  >
                    {showCurrentPw ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="form-group-card">
                <label><FaKey className="form-lbl-icon" /> New Password</label>
                <div className="pw-input-wrapper">
                  <input
                    type={showNewPw ? "text" : "password"}
                    placeholder="Enter a strong new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="pw-toggle-btn"
                    onClick={() => setShowNewPw(!showNewPw)}
                  >
                    {showNewPw ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {/* Password Strength Checklist */}
              {newPassword.length > 0 && (
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

              <div className="form-group-card">
                <label><FaLock className="form-lbl-icon" /> Confirm New Password</label>
                <input
                  type={showNewPw ? "text" : "password"}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-actions-row">
                <button type="submit" className="save-changes-btn" disabled={changingPw}>
                  {changingPw ? "Updating Password..." : "🔒 Update Account Password"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Quick Health Actions */}
        {activeTab === "health" && (
          <div className="profile-tab-pane">
            <div className="pane-header">
              <h3>Quick Health Navigation</h3>
              <p>Direct shortcuts to all DiaSense AI diagnostic and nutritional tools.</p>
            </div>

            <div className="health-shortcuts-grid">
              <div className="shortcut-card" onClick={() => navigate("/assessment")}>
                <div className="shortcut-icon-circle cyan">
                  <FaNotesMedical />
                </div>
                <div className="shortcut-info">
                  <h4>Take New Assessment</h4>
                  <p>Input clinical biomarkers for instant 99.20% accurate XGBoost risk screening.</p>
                </div>
                <FaArrowRight className="shortcut-arrow" />
              </div>

              <div className="shortcut-card" onClick={() => navigate("/diet-plan")}>
                <div className="shortcut-icon-circle emerald">
                  <FaUtensils />
                </div>
                <div className="shortcut-info">
                  <h4>Daily Goals & Diet Plan</h4>
                  <p>View tailored low-GI Indian nutrition prescriptions and maintain your daily health streak.</p>
                </div>
                <FaArrowRight className="shortcut-arrow" />
              </div>

              <div className="shortcut-card" onClick={() => navigate("/food-analyzer")}>
                <div className="shortcut-icon-circle blue">
                  <FaCamera />
                </div>
                <div className="shortcut-info">
                  <h4>Food AI Vision Analyzer</h4>
                  <p>Upload a food image or search any meal to inspect calories, carbs, protein, and GI.</p>
                </div>
                <FaArrowRight className="shortcut-arrow" />
              </div>

              <div className="shortcut-card" onClick={() => navigate("/dashboard")}>
                <div className="shortcut-icon-circle indigo">
                  <FaHeartbeat />
                </div>
                <div className="shortcut-info">
                  <h4>Medical Analytics Dashboard</h4>
                  <p>Explore your historical assessment trends, biomarker gauges, and clinical reports.</p>
                </div>
                <FaArrowRight className="shortcut-arrow" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
