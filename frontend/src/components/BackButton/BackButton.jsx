import "./BackButton.css";
import { useNavigate } from "react-router-dom";

function BackButton() {

  const navigate = useNavigate();

  return (

    <div className="back-wrapper">

      <button
        className="back-btn"
        onClick={() => navigate(-1)}
      >
        ← Go Back
      </button>

    </div>

  );

}

export default BackButton;