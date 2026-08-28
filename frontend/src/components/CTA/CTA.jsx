import "./CTA.css";
import { useNavigate } from "react-router-dom";
import { FaArrowRight, FaStethoscope } from "react-icons/fa";

function CTA() {
  const navigate = useNavigate();

  return (
    <section className="cta-section">
      <div className="cta-container">
        <div className="cta-card">
          <div className="cta-icon-badge">
            <FaStethoscope />
          </div>
          <h2>Ready To Evaluate Your Diabetes Risk Profile?</h2>
          <p>
            Takes less than 3 minutes. Receive instant AI classification, detailed contributing factor analysis, and tailored diet recommendations.
          </p>
          <div className="cta-button-group">
            <button className="cta-main-btn" onClick={() => navigate("/assessment")}>
              Start Risk Assessment Now <FaArrowRight />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CTA;