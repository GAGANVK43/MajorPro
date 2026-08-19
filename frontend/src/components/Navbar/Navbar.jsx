import "./Navbar.css";
import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { FaHeartbeat, FaUser, FaSignOutAlt, FaBars, FaTimes, FaCircle, FaCog } from "react-icons/fa";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const savedUser = localStorage.getItem("user");
    if (token && savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        setCurrentUser(null);
      }
    } else {
      setCurrentUser(null);
    }
    setMenuOpen(false);
    setUserDropdown(false);
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("latest_prediction");
    setCurrentUser(null);
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <nav className="navbar-container">
      <div className="navbar-content">
        {/* Brand Logo */}
        <NavLink to="/" className="brand-logo">
          <div className="logo-icon-wrapper">
            <FaHeartbeat className="logo-icon" />
          </div>
          <div className="brand-text">
            <span className="brand-title">DiaSense <span className="brand-ai">AI</span></span>
            <span className="brand-subtitle">
              <FaCircle className="pulse-dot" /> Engine Active
            </span>
          </div>
        </NavLink>

        {/* Desktop Navigation Links */}
        <ul className={`nav-links ${menuOpen ? "mobile-open" : ""}`}>
          <li>
            <NavLink to="/" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Home
            </NavLink>
          </li>
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/assessment" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Assessment
            </NavLink>
          </li>
          <li>
            <NavLink to="/diet-plan" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Diet Plan
            </NavLink>
          </li>
          <li>
            <NavLink to="/food-analyzer" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Food Analyzer
            </NavLink>
          </li>
          <li>
            <NavLink to="/profile" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Profile
            </NavLink>
          </li>
          <li>
            <NavLink to="/about" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              About
            </NavLink>
          </li>
          <li>
            <NavLink to="/contact" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Contact
            </NavLink>
          </li>

          {/* Mobile Auth Button */}
          {menuOpen && (
            <li className="mobile-auth-item">
              {currentUser ? (
                <button className="nav-btn logout" onClick={handleLogout}>
                  <FaSignOutAlt /> Logout ({currentUser.full_name?.split(" ")[0] || "User"})
                </button>
              ) : (
                <NavLink to="/login" className="nav-btn primary">
                  Login / Register
                </NavLink>
              )}
            </li>
          )}
        </ul>

        {/* User Auth Section */}
        <div className="auth-section">
          {currentUser ? (
            <div className="user-profile-wrapper">
              <div
                className="user-avatar"
                onClick={() => setUserDropdown(!userDropdown)}
                title="Account & Profile Settings"
              >
                {getInitials(currentUser.full_name)}
              </div>

              {userDropdown && (
                <div className="user-dropdown-menu">
                  <div className="dropdown-user-info">
                    <p className="user-name">{currentUser.full_name || "User"}</p>
                    <p className="user-email">{currentUser.email}</p>
                  </div>
                  <hr className="dropdown-divider" />
                  <NavLink to="/profile" className="dropdown-item" onClick={() => setUserDropdown(false)}>
                    <FaUser /> Profile & Password
                  </NavLink>
                  <NavLink to="/dashboard" className="dropdown-item" onClick={() => setUserDropdown(false)}>
                    <FaHeartbeat /> Health Dashboard
                  </NavLink>
                  <button className="dropdown-item logout" onClick={handleLogout}>
                    <FaSignOutAlt /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <NavLink to="/login">
              <button className="nav-btn primary">Sign In</button>
            </NavLink>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
          >
            {menuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;