import "./HowItWorks.css";
import { FaUserEdit, FaMicrochip, FaChartBar, FaFileDownload } from "react-icons/fa";

function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: <FaUserEdit />,
      title: "Input Health Data",
      desc: "Provide physiological markers including Fasting Glucose, Blood Pressure, BMI, Insulin, and Family History."
    },
    {
      number: "02",
      icon: <FaMicrochip />,
      title: "AI Inference Engine",
      desc: "Our pre-trained XGBoost Classifier analyzes your input features against clinical decision thresholds."
    },
    {
      number: "03",
      icon: <FaChartBar />,
      title: "Risk & Factor Analysis",
      desc: "View your risk classification, statistical probability score, and high-impact contributing factor breakdowns."
    },
    {
      number: "04",
      icon: <FaFileDownload />,
      title: "Plan & Download Report",
      desc: "Access your tailored diet/exercise recommendations and download an official PDF medical summary."
    }
  ];

  return (
    <section className="how-it-works-section">
      <div className="how-container">
        <div className="section-header text-center">
          <span className="section-subtitle">Workflow Journey</span>
          <h2 className="section-title">How DiaSense AI Works</h2>
          <p className="section-desc">
            A seamless four-step screening process connecting patient inputs to clinical machine learning insights.
          </p>
        </div>

        <div className="steps-grid">
          {steps.map((s, idx) => (
            <div className="step-card" key={idx}>
              <div className="step-header">
                <span className="step-number">{s.number}</span>
                <div className="step-icon">{s.icon}</div>
              </div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;