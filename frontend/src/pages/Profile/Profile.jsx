import "./Profile.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaUser,
  FaEnvelope,
  FaCalendarAlt,
  FaVenusMars,
  FaKey,
  FaLock,
  FaShieldAlt,
  FaHeartbeat,
  FaCheckCircle,
  FaTimesCircle,
  FaIdBadge,
  FaEye,
  FaEyeSlash,
  FaNotesMedical,
  FaUtensils,
  FaCamera,
  FaArrowRight,
  FaGlobe,
  FaChartLine,
  FaMapMarkerAlt,
  FaCity,
  FaUndo,
  FaSave,
} from "react-icons/fa";

import { authService, userService } from "../../services/api";
import { useTranslation } from "../../context/LanguageContext";
import LanguageSelector from "../../components/LanguageSelector/LanguageSelector";

/**
 * Calculates whole years from an ISO date string (YYYY-MM-DD).
 * Validates that birth date is in the past.
 */
function calculateAgeFromDob(dobString) {
  if (!dobString || !dobString.trim()) return null;
  const parts = dobString.trim().split("-");
  if (parts.length !== 3) return null;
  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);
  const birthDate = new Date(birthYear, birthMonth, birthDay);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  if (birthDate > today) return null;

  let age = today.getFullYear() - birthYear;
  const m = today.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
    age--;
  }
  return age >= 0 && age <= 120 ? age : null;
}

function Profile() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Active tab: 'personal' | 'security' | 'health'
  const [activeTab, setActiveTab] = useState("personal");

  // Profile data
  const [userId, setUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("India");
  const [memberSince, setMemberSince] = useState("");
  const [stats, setStats] = useState({
    totalAssessments: 0,
    latestPrediction: null,
    latestRiskScore: null,
    latestDate: null,
  });

  // Snapshot of loaded data for Cancel / Revert action
  const [originalData, setOriginalData] = useState(null);

  // Email Change sub-section
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  // Password update form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const res = await authService.getProfile();
      // Handle both nested { user: {...} } and direct flat responses robustly
      const payload = res?.data || res;
      const u = payload?.user || payload;

      if (u) {
        const idVal = u.id || payload?.id || "";
        const nameVal = u.full_name || payload?.full_name || "";
        const emailVal = u.email || payload?.email || "";
        const dobVal = u.date_of_birth || payload?.date_of_birth || "";
        const ageVal = u.age !== null && u.age !== undefined
          ? String(u.age)
          : payload?.age !== null && payload?.age !== undefined
          ? String(payload.age)
          : "";
        const genderVal = u.gender || payload?.gender || "Male";
        const addrVal = u.address || payload?.address || "";
        const cityVal = u.city || payload?.city || "";
        const stateVal = u.state || payload?.state || "";
        const postalVal = u.postal_code || payload?.postal_code || "";
        const countryVal = u.country || payload?.country || "India";

        setUserId(idVal);
        setFullName(nameVal);
        setEmail(emailVal);
        setDateOfBirth(dobVal);
        setAge(ageVal);
        setGender(genderVal);
        setAddress(addrVal);
        setCity(cityVal);
        setStateName(stateVal);
        setPostalCode(postalVal);
        setCountry(countryVal);

        setOriginalData({
          fullName: nameVal,
          dateOfBirth: dobVal,
          age: ageVal,
          gender: genderVal,
          address: addrVal,
          city: cityVal,
          stateName: stateVal,
          postalCode: postalVal,
          country: countryVal,
        });

        const createdDate = u.created_at || payload?.created_at;
        if (createdDate) {
          const d = new Date(createdDate);
          setMemberSince(
            d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
          );
        }

        setStats({
          totalAssessments: payload?.total_assessments || 0,
          latestPrediction: payload?.latest_prediction || null,
          latestRiskScore: payload?.latest_risk_score !== null && payload?.latest_risk_score !== undefined
            ? payload.latest_risk_score
            : null,
          latestDate: payload?.latest_assessment_date || null,
        });
      }
    } catch (err) {
      // Offline / fallback to stored auth session
      try {
        const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
        if (savedUser.full_name || savedUser.email) {
          setFullName(savedUser.full_name || "");
          setEmail(savedUser.email || "");
          setUserId(savedUser.id || savedUser.user_id || "");
          setAge(savedUser.age ? String(savedUser.age) : "");
          setGender(savedUser.gender || "Male");
          setCountry(savedUser.country || "India");
        }
      } catch (e) {}
      toast.error(err.message || "Failed to load user profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleDobChange = (e) => {
    const val = e.target.value;
    setDateOfBirth(val);
    if (val) {
      const computedAge = calculateAgeFromDob(val);
      if (computedAge !== null) {
        setAge(String(computedAge));
      } else {
        toast.warning("Date of birth cannot be in the future.");
      }
    }
  };

  const handleCancelEdit = () => {
    if (originalData) {
      setFullName(originalData.fullName);
      setDateOfBirth(originalData.dateOfBirth);
      setAge(originalData.age);
      setGender(originalData.gender);
      setAddress(originalData.address);
      setCity(originalData.city);
      setStateName(originalData.stateName);
      setPostalCode(originalData.postalCode);
      setCountry(originalData.country);
      toast.info("Profile changes reverted.");
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full name cannot be blank.");
      return;
    }

    if (dateOfBirth) {
      const computedAge = calculateAgeFromDob(dateOfBirth);
      if (computedAge === null) {
        toast.error("Please enter a valid Date of Birth that is not in the future.");
        return;
      }
    } else if (age) {
      const parsedAge = parseInt(age, 10);
      if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
        toast.error("Age must be between 1 and 120 years.");
        return;
      }
    }

    setSavingProfile(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth ? dateOfBirth.trim() : null,
        age: age ? parseInt(age, 10) : undefined,
        gender: gender,
        address: address.trim() || null,
        city: city.trim() || null,
        state: stateName.trim() || null,
        postal_code: postalCode.trim() || null,
        country: country.trim() || "India",
      };

      const res = await userService.updateProfile(payload);
      const updatedUser = res?.data || res;

      // Update snapshot of original data
      setOriginalData({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth ? dateOfBirth.trim() : "",
        age: age,
        gender: gender,
        address: address.trim(),
        city: city.trim(),
        stateName: stateName.trim(),
        postalCode: postalCode.trim(),
        country: country.trim(),
      });

      // Update local storage user cache
      try {
        const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
        savedUser.full_name = fullName.trim();
        savedUser.age = age ? parseInt(age, 10) : undefined;
        savedUser.gender = gender;
        savedUser.date_of_birth = dateOfBirth;
        savedUser.country = country;
        localStorage.setItem("user", JSON.stringify(savedUser));
      } catch (err) {}

      toast.success(`✅ ${t("profile.profileUpdated") || "Profile updated successfully!"}`);
    } catch (err) {
      // Crucial: preserve user's typed changes so no draft data is lost on failure
      toast.error(err.message || "Failed to update profile. Your edits have been preserved.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    if (!newEmail.trim() || !emailPassword) {
      toast.error("Please provide both new email address and current password.");
      return;
    }

    if (newEmail.trim().toLowerCase() === email.toLowerCase()) {
      toast.warning("New email must be different from your current email.");
      return;
    }

    setChangingEmail(true);
    try {
      const res = await userService.changeEmail({
        new_email: newEmail.trim(),
        current_password: emailPassword,
      });

      const data = res?.data || res;
      setEmail(data.email || newEmail.trim().toLowerCase());
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
      }
      try {
        const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
        savedUser.email = data.email || newEmail.trim().toLowerCase();
        localStorage.setItem("user", JSON.stringify(savedUser));
      } catch (err) {}

      toast.success("✅ Email address updated successfully!");
      setShowEmailChange(false);
      setNewEmail("");
      setEmailPassword("");
    } catch (err) {
      toast.error(err.message || "Failed to update email. Please check your password.");
    } finally {
      setChangingEmail(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields.");
      return;
    }

    if (!isNewPwValid) {
      toast.error(t("profile.passCriteriaTitle") || "Password does not meet requirements.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("auth.validationPasswordMatch") || "Passwords do not match.");
      return;
    }

    setChangingPw(true);
    try {
      await userService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      toast.success(`✅ ${t("profile.passwordUpdated") || "Password updated successfully!"}`);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err.message || "Failed to update password. Verify current password.");
    } finally {
      setChangingPw(false);
    }
  };

  // Password criteria check
  const criteria = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
  };
  const isNewPwValid = Object.values(criteria).every(Boolean);

  const getInitials = (name) => {
    if (!name) return "DS";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="profile-loading-screen">
        <div className="profile-spinner" />
        <p>{t("common.loading") || "Loading profile data..."}</p>
      </div>
    );
  }

  return (
    <div className="profile-page-container">
      {/* Background Ambience Lighting */}
      <div className="profile-ambient-glow-1" />
      <div className="profile-ambient-glow-2" />

      <div className="profile-content-wrapper">
        {/* Top Floating Navigation Header */}
        <div className="profile-top-bar">
          <button className="profile-back-btn" onClick={() => navigate(-1)}>
            ← {t("common.goBack") || "Back"}
          </button>
          <div className="profile-breadcrumb">
            <span>{t("nav.home") || "Home"}</span> / <span className="current">{t("nav.profile") || "Profile"}</span>
          </div>
        </div>

        {/* 1. Compact Unified Profile Header Card */}
        <div className="profile-compact-header-card">
          <div className="profile-header-identity">
            <div className="profile-avatar-wrapper">
              <span className="avatar-letters">{getInitials(fullName)}</span>
              <span className="avatar-status-dot" title="Online" />
            </div>

            <div className="profile-header-text">
              <div className="profile-name-badge-row">
                <h2>{fullName || t("profile.defaultPatient") || "DiaSense Patient"}</h2>
                <span className="verified-patient-badge">
                  <FaCheckCircle className="badge-icon" /> {t("profile.verifiedPatient") || "Verified Patient"}
                </span>
              </div>
              <div className="profile-meta-subrow">
                <span className="meta-email">{email}</span>
                <span className="meta-dot">•</span>
                <span className="meta-chip">
                  <FaCalendarAlt className="meta-icon" /> {t("profile.memberSince") || "Member Since"}: {memberSince || t("profile.recent") || "Recent"}
                </span>
                <span className="meta-dot">•</span>
                <span className="meta-chip">
                  <FaVenusMars className="meta-icon" /> {gender === "Female" ? t("auth.female") || "Female" : gender === "Other" ? t("auth.other") || "Other" : t("auth.male") || "Male"} {age ? `(${age} ${t("profile.years") || "yrs"})` : ""}
                </span>
                {city && (
                  <>
                    <span className="meta-dot">•</span>
                    <span className="meta-chip">
                      <FaMapMarkerAlt className="meta-icon" /> {city}, {country}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Modern 2-Column Responsive Dashboard Layout */}
        <div className="profile-main-grid">
          {/* LEFT COLUMN: Clean Active Tab Form Section */}
          <div className="profile-left-col">
            {/* Compact Tabs Bar */}
            <div className="profile-nav-tabs">
              <button
                type="button"
                className={`tab-btn-pill ${activeTab === "personal" ? "active" : ""}`}
                onClick={() => setActiveTab("personal")}
              >
                <FaUser className="tab-icon" />
                <span>{t("profile.tabPersonal") || "Personal Information"}</span>
              </button>
              <button
                type="button"
                className={`tab-btn-pill ${activeTab === "security" ? "active" : ""}`}
                onClick={() => setActiveTab("security")}
              >
                <FaKey className="tab-icon" />
                <span>{t("profile.tabSecurity") || "Security & Password"}</span>
              </button>
              <button
                type="button"
                className={`tab-btn-pill ${activeTab === "health" ? "active" : ""}`}
                onClick={() => setActiveTab("health")}
              >
                <FaHeartbeat className="tab-icon" />
                <span>{t("profile.tabHealth") || "Health Navigation"}</span>
              </button>
            </div>

            {/* TAB 1: Personal Information Form */}
            {activeTab === "personal" && (
              <div className="profile-pane-card">
                <div className="pane-title-box">
                  <h3>{t("profile.editPersonalTitle") || "Patient Details & Demographics"}</h3>
                  <p>{t("profile.editPersonalDesc") || "Update your identity, physiological details, and contact address."}</p>
                </div>

                <form onSubmit={handleUpdateProfile} className="compact-profile-form">
                  {/* Full Name */}
                  <div className="form-field-group">
                    <label>
                      <FaUser className="field-lbl-icon" /> {t("auth.fullNameLabel") || "Full Name"} <span className="req-star">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={t("auth.fullNamePlaceholder") || "Enter your full name"}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Primary Email with Secure Update Action */}
                  <div className="form-field-group">
                    <label>
                      <FaEnvelope className="field-lbl-icon" /> {t("auth.emailLabel") || "Email Address (Authentication ID)"}
                    </label>
                    <div className="email-input-action-row">
                      <input
                        type="email"
                        value={email}
                        disabled
                        className="input-field-disabled"
                      />
                      <button
                        type="button"
                        className="btn-email-change-pill"
                        onClick={() => setShowEmailChange(!showEmailChange)}
                      >
                        {showEmailChange ? "Hide" : "Change Email"}
                      </button>
                    </div>
                    <span className="field-sub-hint">
                      Email is your primary login credential. Changes require current password authorization.
                    </span>

                    {/* Expandable Secure Email Change Form */}
                    {showEmailChange && (
                      <div className="email-change-subpanel">
                        <h4>🔒 Secure Email Update</h4>
                        <div className="email-change-inputs">
                          <input
                            type="email"
                            placeholder="New email address"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            required
                          />
                          <input
                            type="password"
                            placeholder="Current account password"
                            value={emailPassword}
                            onChange={(e) => setEmailPassword(e.target.value)}
                            required
                          />
                        </div>
                        <div className="email-change-actions">
                          <button
                            type="button"
                            className="btn-confirm-email-change"
                            onClick={handleChangeEmail}
                            disabled={changingEmail}
                          >
                            {changingEmail ? "Verifying..." : "Verify & Save New Email"}
                          </button>
                          <button
                            type="button"
                            className="btn-cancel-email-change"
                            onClick={() => {
                              setShowEmailChange(false);
                              setNewEmail("");
                              setEmailPassword("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Date of Birth & Age (Auto-calculated) */}
                  <div className="form-two-cols">
                    <div className="form-field-group">
                      <label>
                        <FaCalendarAlt className="field-lbl-icon" /> Date of Birth
                      </label>
                      <input
                        type="date"
                        max={new Date().toISOString().split("T")[0]}
                        value={dateOfBirth}
                        onChange={handleDobChange}
                      />
                      <span className="field-sub-hint">
                        {dateOfBirth ? "Age is synchronized from DOB" : "Optional (helps calculate precise age)"}
                      </span>
                    </div>

                    <div className="form-field-group">
                      <label>
                        <FaCalendarAlt className="field-lbl-icon" /> {t("auth.ageLabel") || "Age (Years)"}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        placeholder="e.g. 35"
                        value={age}
                        readOnly={Boolean(dateOfBirth)}
                        className={dateOfBirth ? "input-field-calculated" : ""}
                        onChange={(e) => setAge(e.target.value)}
                      />
                      <span className="field-sub-hint">
                        {dateOfBirth ? "Auto-computed from Date of Birth" : "Direct age screening input"}
                      </span>
                    </div>
                  </div>

                  {/* Gender and Country */}
                  <div className="form-two-cols">
                    <div className="form-field-group">
                      <label>
                        <FaVenusMars className="field-lbl-icon" /> {t("auth.genderLabel") || "Gender"}
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                      >
                        <option value="Male">{t("auth.male") || "Male"}</option>
                        <option value="Female">{t("auth.female") || "Female"}</option>
                        <option value="Other">{t("auth.other") || "Other"}</option>
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label>
                        <FaGlobe className="field-lbl-icon" /> Country
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. India"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Address Section */}
                  <div className="address-section-header">
                    <h4><FaMapMarkerAlt /> Residential Address (Optional)</h4>
                    <span className="field-sub-hint">Used for matching nearby healthcare facilities without needing device GPS</span>
                  </div>

                  <div className="form-field-group">
                    <label>Street Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 124, 4th Cross, Indiranagar"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>

                  <div className="form-three-cols">
                    <div className="form-field-group">
                      <label><FaCity /> City</label>
                      <input
                        type="text"
                        placeholder="e.g. Bengaluru"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>

                    <div className="form-field-group">
                      <label>State</label>
                      <input
                        type="text"
                        placeholder="e.g. Karnataka"
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                      />
                    </div>

                    <div className="form-field-group">
                      <label>Postal / PIN Code</label>
                      <input
                        type="text"
                        placeholder="e.g. 560038"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Preferred Language Selector */}
                  <div className="form-field-group">
                    <label>
                      <FaGlobe className="field-lbl-icon" /> {t("profile.preferredLanguage") || "Preferred Display & Audio Language"}
                    </label>
                    <div className="profile-lang-selector-box">
                      <LanguageSelector />
                    </div>
                  </div>

                  {/* Primary Save & Cancel Action Buttons */}
                  <div className="form-save-action-box">
                    <button
                      type="submit"
                      className="btn-primary-save"
                      disabled={savingProfile}
                    >
                      {savingProfile ? (
                        <>
                          <span className="btn-spinner" />
                          <span>{t("profile.updatingBtn") || "Saving..."}</span>
                        </>
                      ) : (
                        <>
                          <FaSave />
                          <span>{t("profile.updateBtn") || "Save Profile Changes"}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary-cancel"
                      onClick={handleCancelEdit}
                      disabled={savingProfile}
                    >
                      <FaUndo />
                      <span>Cancel</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 2: Security & Change Password */}
            {activeTab === "security" && (
              <div className="profile-pane-card">
                <div className="pane-title-box">
                  <h3>{t("profile.changePasswordTitle") || "Security & Password Management"}</h3>
                  <p>{t("profile.changePasswordDesc") || "Ensure your account has a strong password with at least 8 characters."}</p>
                </div>

                <form onSubmit={handleChangePassword} className="compact-profile-form">
                  <div className="form-field-group">
                    <label>
                      <FaLock className="field-lbl-icon" /> {t("profile.currentPassword") || "Current Password"}
                    </label>
                    <div className="input-pw-wrapper">
                      <input
                        type={showCurrentPw ? "text" : "password"}
                        placeholder={t("profile.currentPassword") || "Enter current password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="btn-pw-eye"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        aria-label="Toggle password visibility"
                      >
                        {showCurrentPw ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  <div className="form-field-group">
                    <label>
                      <FaKey className="field-lbl-icon" /> {t("profile.newPassword") || "New Password"}
                    </label>
                    <div className="input-pw-wrapper">
                      <input
                        type={showNewPw ? "text" : "password"}
                        placeholder={t("profile.newPassword") || "Enter new password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="btn-pw-eye"
                        onClick={() => setShowNewPw(!showNewPw)}
                        aria-label="Toggle password visibility"
                      >
                        {showNewPw ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  {/* Compact Security Criteria Checklist */}
                  {newPassword.length > 0 && (
                    <div className="compact-pw-criteria">
                      <div className="criteria-head">
                        <FaShieldAlt className="crit-shield" />
                        <span>{t("profile.passCriteriaTitle") || "Password Security Criteria"}</span>
                      </div>
                      <div className="criteria-grid">
                        <div className={`crit-pill ${criteria.length ? "pass" : "fail"}`}>
                          {criteria.length ? <FaCheckCircle className="crit-chk" /> : <FaTimesCircle className="crit-chk" />}
                          <span>{t("profile.critLength") || "8+ Characters"}</span>
                        </div>
                        <div className={`crit-pill ${criteria.uppercase ? "pass" : "fail"}`}>
                          {criteria.uppercase ? <FaCheckCircle className="crit-chk" /> : <FaTimesCircle className="crit-chk" />}
                          <span>{t("profile.critUpper") || "Uppercase Letter"}</span>
                        </div>
                        <div className={`crit-pill ${criteria.lowercase ? "pass" : "fail"}`}>
                          {criteria.lowercase ? <FaCheckCircle className="crit-chk" /> : <FaTimesCircle className="crit-chk" />}
                          <span>{t("profile.critLower") || "Lowercase Letter"}</span>
                        </div>
                        <div className={`crit-pill ${criteria.number ? "pass" : "fail"}`}>
                          {criteria.number ? <FaCheckCircle className="crit-chk" /> : <FaTimesCircle className="crit-chk" />}
                          <span>{t("profile.critNumber") || "Number (0-9)"}</span>
                        </div>
                        <div className={`crit-pill ${criteria.special ? "pass" : "fail"}`}>
                          {criteria.special ? <FaCheckCircle className="crit-chk" /> : <FaTimesCircle className="crit-chk" />}
                          <span>{t("profile.critSpecial") || "Special Symbol"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="form-field-group">
                    <label>
                      <FaLock className="field-lbl-icon" /> {t("profile.confirmNewPassword") || "Confirm New Password"}
                    </label>
                    <input
                      type={showNewPw ? "text" : "password"}
                      placeholder={t("profile.confirmNewPassword") || "Repeat new password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-save-action-box">
                    <button
                      type="submit"
                      className="btn-primary-save"
                      disabled={changingPw}
                    >
                      {changingPw ? (
                        <>
                          <span className="btn-spinner" />
                          <span>{t("profile.updatingBtn") || "Updating Password..."}</span>
                        </>
                      ) : (
                        <>
                          <FaLock />
                          <span>{t("profile.changePasswordBtn") || "Update Account Password"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 3: Quick Health Shortcuts */}
            {activeTab === "health" && (
              <div className="profile-pane-card">
                <div className="pane-title-box">
                  <h3>{t("profile.quickHealthNav") || "Health Navigation & Records"}</h3>
                  <p>{t("profile.quickHealthDesc") || "Quickly jump to screening assessments, customized diet plans, or vision analysis."}</p>
                </div>

                <div className="compact-shortcuts-grid">
                  <div
                    className="shortcut-tile"
                    onClick={() => navigate("/assessment")}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="shortcut-icon-box cyan">
                      <FaNotesMedical />
                    </div>
                    <div className="shortcut-text-box">
                      <h4>{t("dashboard.startNewAssessment") || "Health Assessment"}</h4>
                      <p>{t("nav.assessment") || "Screen for diabetes biomarkers"}</p>
                    </div>
                    <FaArrowRight className="tile-arrow" />
                  </div>

                  <div
                    className="shortcut-tile"
                    onClick={() => navigate("/diet-plan")}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="shortcut-icon-box emerald">
                      <FaUtensils />
                    </div>
                    <div className="shortcut-text-box">
                      <h4>{t("nav.dietPlan") || "Diet & Lifestyle Plan"}</h4>
                      <p>{t("dietPlan.headerBadge") || "Personalized 7-day nutrition"}</p>
                    </div>
                    <FaArrowRight className="tile-arrow" />
                  </div>

                  <div
                    className="shortcut-tile"
                    onClick={() => navigate("/food-analyzer")}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="shortcut-icon-box purple">
                      <FaCamera />
                    </div>
                    <div className="shortcut-text-box">
                      <h4>{t("nav.foodAnalyzer") || "AI Food Analyzer"}</h4>
                      <p>{t("home.featuresSubtitle") || "Nutritional vision scanning"}</p>
                    </div>
                    <FaArrowRight className="tile-arrow" />
                  </div>

                  <div
                    className="shortcut-tile"
                    onClick={() => navigate("/dashboard")}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="shortcut-icon-box blue">
                      <FaHeartbeat />
                    </div>
                    <div className="shortcut-text-box">
                      <h4>{t("nav.healthDashboard") || "Health Dashboard"}</h4>
                      <p>{t("nav.dashboard") || "Overview of metrics & history"}</p>
                    </div>
                    <FaArrowRight className="tile-arrow" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Compact Health Summary & Quick Info Sidebar */}
          <div className="profile-right-col">
            <div className="health-summary-sidebar-card">
              <div className="summary-card-header">
                <FaHeartbeat className="header-heart-icon" />
                <h3>{t("result.patientSummary") || "Patient Summary"}</h3>
              </div>

              {/* 3 Compact Metric Tiles */}
              <div className="compact-stats-stack">
                <div className="compact-stat-row">
                  <span className="stat-name">{t("profile.totalAssessments") || "Screenings Completed"}</span>
                  <span className="stat-number cyan">{stats.totalAssessments}</span>
                </div>

                <div className="compact-stat-row">
                  <span className="stat-name">{t("profile.latestRisk") || "Latest Status"}</span>
                  <span
                    className={`risk-status-pill ${
                      (stats.latestPrediction === "Diabetic" || stats.latestPrediction === "Higher Risk Pattern") ? "diabetic" : "non-diabetic"
                    }`}
                  >
                    {stats.latestPrediction
                      ? (stats.latestPrediction === "Diabetic" || stats.latestPrediction === "Higher Risk Pattern")
                        ? t("result.diabetic") || "Elevated Risk"
                        : t("result.nonDiabetic") || "Non-Diabetic"
                      : t("profile.pending") || "No Screenings Yet"}
                  </span>
                </div>

                <div className="compact-stat-row">
                  <span className="stat-name">{t("dashboard.probability") || "Risk Probability"}</span>
                  <span className="stat-number">
                    {stats.latestRiskScore !== null && stats.latestRiskScore !== undefined
                      ? `${stats.latestRiskScore}%`
                      : "N/A"}
                  </span>
                </div>
              </div>

              {/* Patient Quick Info List */}
              <div className="sidebar-info-divider" />
              <div className="sidebar-patient-details">
                <div className="detail-item-line">
                  <span className="item-key"><FaIdBadge /> {t("profile.patientId") || "Patient ID"}:</span>
                  <span className="item-val">#{userId || "1"}</span>
                </div>
                <div className="detail-item-line">
                  <span className="item-key"><FaCalendarAlt /> {t("profile.memberSince") || "Member Since"}:</span>
                  <span className="item-val">{memberSince || "Recent"}</span>
                </div>
                {dateOfBirth && (
                  <div className="detail-item-line">
                    <span className="item-key"><FaCalendarAlt /> DOB:</span>
                    <span className="item-val">{dateOfBirth}</span>
                  </div>
                )}
                {city && (
                  <div className="detail-item-line">
                    <span className="item-key"><FaMapMarkerAlt /> City:</span>
                    <span className="item-val">{city}</span>
                  </div>
                )}
              </div>

              {/* Sidebar Quick Action CTAs */}
              <div className="sidebar-action-buttons">
                <button
                  onClick={() => navigate("/assessment")}
                  className="btn-sidebar-cta primary"
                >
                  <FaNotesMedical />
                  <span>{t("dashboard.startNewAssessment") || "Start Screening"}</span>
                </button>
                <button
                  onClick={() => navigate("/diet-plan")}
                  className="btn-sidebar-cta secondary"
                >
                  <FaUtensils />
                  <span>View Diet Plan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
