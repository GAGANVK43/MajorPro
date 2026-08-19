import "./Contact.css";
import { useState } from "react";
import { toast } from "react-toastify";
import { FaEnvelope, FaUser, FaPaperPlane, FaCommentAlt, FaCheckCircle, FaHeadset } from "react-icons/fa";

import Navbar from "../../components/Navbar/Navbar";
import BackButton from "../../components/BackButton/BackButton";
import Footer from "../../components/Footer/Footer";
import { contactService } from "../../services/api";

function Contact() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast.error("Please fill in all required contact fields.");
      return;
    }

    setLoading(true);
    try {
      await contactService.submitContact({
        name: formData.name,
        email: formData.email,
        subject: formData.subject || "DiaSense Inquiry",
        message: formData.message,
      });

      toast.success("✅ Inquiry sent successfully to gagankamati643@gmail.com!");
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      toast.error(err.message || "Failed to submit contact request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <div className="contact-page">
        <div className="contact-container">
          <BackButton />

          <div className="contact-grid">
            {/* Left Info Card */}
            <div className="contact-info-card">
              <div className="badge-pill"><FaHeadset /> Technical Support</div>
              <h1>Get in Touch With DiaSense AI Team</h1>
              <p>
                Have questions regarding the machine learning model architecture, system integration, or clinical risk screening methodology? Reach out to us below.
              </p>

              <div className="info-points">
                <div className="info-point">
                  <FaCheckCircle className="info-icon" />
                  <div>
                    <h4>Fast Response Time</h4>
                    <p>Submissions are sent directly to <strong>gagankamati643@gmail.com</strong>.</p>
                  </div>
                </div>

                <div className="info-point">
                  <FaCheckCircle className="info-icon" />
                  <div>
                    <h4>Academic & Project Support</h4>
                    <p>Designed for CSE viva demonstrations and research reviews.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Contact Form */}
            <div className="contact-form-card">
              <h2>Send a Message</h2>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label><FaUser /> Your Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Alex Johnson"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label><FaEnvelope /> Email Address *</label>
                  <input
                    type="email"
                    placeholder="e.g. alex@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label><FaCommentAlt /> Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. ML Model Inquiry"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Message *</label>
                  <textarea
                    rows="4"
                    placeholder="Enter your message details..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </div>

                <button className="contact-submit-btn" type="submit" disabled={loading}>
                  {loading ? "Submitting..." : <><FaPaperPlane /> Submit Inquiry</>}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default Contact;