import "./Features.css";
import { FaBrain, FaChartPie, FaUtensils, FaRunning, FaFilePdf, FaLock } from "react-icons/fa";

function Features() {
  const featuresList = [
    {
      icon: <FaBrain />,
      title: "XGBoost Risk Classifier",
      desc: "Supervised machine learning model trained on physiological markers to screen for early diabetes vulnerability."
    },
    {
      icon: <FaChartPie />,
      title: "Clinical Risk Explainability",
      desc: "Detailed parameter breakdown highlighting high-impact risk factors such as Glucose, BMI, Age, and Insulin."
    },
    {
      icon: <FaUtensils />,
      title: "Personalized Diet Planner",
      desc: "Tailored meal plans providing low-glycemic dietary guidance customized to your risk level and preferences."
    },
    {
      icon: <FaRunning />,
      title: "Exercise Intelligence",
      desc: "Risk-aware physical workout plans designed to improve insulin sensitivity and glycemic stability."
    },
    {
      icon: <FaFilePdf />,
      title: "Downloadable PDF Reports",
      desc: "Generate and download official PDF health risk assessment reports for clinical reviews."
    },
    {
      icon: <FaLock />,
      title: "Protected & Secure Data",
      desc: "JWT authentication, bcrypt password hashing, and user-isolated authorization (IDOR security)."
    }
  ];

  return (
    <section className="features-section">
      <div className="features-container">
        <div className="section-header text-center">
          <span className="section-subtitle">Core Platform Capabilities</span>
          <h2 className="section-title">Engineered For Clinical Screening Excellence</h2>
          <p className="section-desc">
            DiaSense AI integrates machine learning inference with comprehensive clinical health analytics.
          </p>
        </div>

        <div className="features-grid">
          {featuresList.map((item, idx) => (
            <div className="feature-card" key={idx}>
              <div className="feature-icon-box">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;