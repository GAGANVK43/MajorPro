import "./About.css";
import Navbar from "../../components/Navbar/Navbar";
import BackButton from "../../components/BackButton/BackButton";
import Footer from "../../components/Footer/Footer";
import { FaBrain, FaDatabase, FaShieldAlt, FaChartLine, FaCheckCircle } from "react-icons/fa";

function About() {
  return (
    <>
      <Navbar />

      <div className="about-page">
        <div className="about-container">
          <BackButton />

          {/* Hero */}
          <section className="about-hero text-center">
            <span className="badge-pill">Academic & Engineering Documentation</span>
            <h1>About DiaSense AI</h1>
            <p>
              An AI-assisted diabetes risk screening and personalized health guidance platform engineered with machine learning classification models.
            </p>
          </section>

          {/* Mission Card */}
          <section className="about-card">
            <h2><FaBrain /> System Purpose & Academic Scope</h2>
            <p>
              DiaSense AI was developed as an enterprise-grade full-stack computer science project demonstrating practical artificial intelligence applications in healthcare risk screening. 
              The application utilizes supervised machine learning (XGBoost) trained on physiological parameters to classify diabetes vulnerability, calculate risk probabilities, and provide clinical factor explainability.
            </p>
          </section>

          {/* Tech Stack Specs */}
          <section className="about-grid">
            <div className="spec-card">
              <div className="spec-icon"><FaBrain /></div>
              <h3>Machine Learning Architecture</h3>
              <p>
                <strong>Algorithm:</strong> XGBoost (Extreme Gradient Boosting)<br />
                <strong>Dataset:</strong> Expanded Diabetes Clinical Dataset (2,500 records)<br />
                <strong>Model Accuracy:</strong> 99.20% | ROC-AUC: 0.999<br />
                <strong>Evaluation:</strong> Stratified Train-Test Split with Feature Engineering & Sensitivity Metrics
              </p>
            </div>

            <div className="spec-card">
              <div className="spec-icon cyan"><FaDatabase /></div>
              <h3>Full-Stack Tech Architecture</h3>
              <p>
                <strong>Backend:</strong> FastAPI, Python 3.14, SQLAlchemy ORM, Pydantic<br />
                <strong>Frontend:</strong> React 19, Vite, Tailwind CSS, Framer Motion, Recharts<br />
                <strong>PDF Engine:</strong> ReportLab PDF Generation Service<br />
                <strong>Database:</strong> SQLite / MySQL ready schemas
              </p>
            </div>

            <div className="spec-card">
              <div className="spec-icon emerald"><FaShieldAlt /></div>
              <h3>Security & Data Protection</h3>
              <p>
                <strong>Authentication:</strong> OAuth2 Bearer Tokens (JWT)<br />
                <strong>Hashing:</strong> Bcrypt password hashing via Passlib<br />
                <strong>Authorization:</strong> Strict token-derived identity checks (IDOR security)<br />
                <strong>Validation:</strong> Pydantic input range enforcement
              </p>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default About;