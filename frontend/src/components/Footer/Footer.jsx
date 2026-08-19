import "./Footer.css";
import { Link } from "react-router-dom";
import { FaHeartbeat, FaGithub, FaShieldAlt } from "react-icons/fa";

function Footer() {
  return (
    <footer className="footer-container">
      <div className="footer-content">
        <div className="footer-grid">
          {/* Brand Info */}
          <div className="footer-brand">
            <div className="footer-logo">
              <FaHeartbeat className="logo-icon" />
              <span>DiaSense <strong>AI</strong></span>
            </div>
            <p className="brand-desc">
              AI-assisted diabetes risk screening and personalized lifestyle guidance platform engineered with Machine Learning.
            </p>
            <div className="tech-badge">
              <FaShieldAlt /> Machine Learning Healthcare Engine
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-links-col">
            <h4>Platform</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/dashboard">Dashboard</Link></li>
              <li><Link to="/assessment">Start Assessment</Link></li>
              <li><Link to="/diet-plan">Diet Planner</Link></li>
            </ul>
          </div>

          {/* Resources & Info */}
          <div className="footer-links-col">
            <h4>Information</h4>
            <ul>
              <li><Link to="/about">About System</Link></li>
              <li><Link to="/contact">Contact Support</Link></li>
              <li><a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">API Documentation</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} DiaSense AI. All rights reserved. Final Year Engineering AI Project.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;