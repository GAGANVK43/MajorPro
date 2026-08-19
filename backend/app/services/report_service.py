import io
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.models.user import User
from app.models.prediction import Prediction
from app.ml.prediction import analyze_contributing_factors


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def generate_pdf_report(self, user: User, prediction_id: int) -> bytes:
        prediction = self.db.query(Prediction).filter(Prediction.id == prediction_id).first()
        if not prediction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Prediction report record not found",
            )

        assessment = prediction.assessment
        if not assessment or assessment.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to requested health report",
            )

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        
        # Custom Styles
        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Heading1"],
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=4,
        )
        subtitle_style = ParagraphStyle(
            "ReportSubtitle",
            parent=styles["Normal"],
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#64748b"),
            spaceAfter=15,
        )
        h2_style = ParagraphStyle(
            "SectionHeader",
            parent=styles["Heading2"],
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#1e293b"),
            spaceBefore=12,
            spaceAfter=8,
        )
        body_style = ParagraphStyle(
            "ReportBody",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#334155"),
        )
        alert_style = ParagraphStyle(
            "RiskAlert",
            parent=styles["Normal"],
            fontSize=12,
            leading=16,
            fontName="Helvetica-Bold",
            textColor=colors.HexColor("#991b1b") if prediction.prediction == "Diabetic" else colors.HexColor("#065f46"),
        )

        elements = []

        # Header
        elements.append(Paragraph("DiaSense AI — Health Risk Screening Report", title_style))
        elements.append(Paragraph("Artificial Intelligence Medical Assessment & Clinical Insights", subtitle_style))
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#0ea5e9"), spaceAfter=15))

        # Patient Info & Summary Box
        date_str = prediction.created_at.strftime("%B %d, %Y") if prediction.created_at else datetime.utcnow().strftime("%B %d, %Y")
        patient_data = [
            [
                Paragraph(f"<b>Patient Name:</b> {user.full_name}", body_style),
                Paragraph(f"<b>Report ID:</b> REP-{prediction.id:05d}", body_style),
            ],
            [
                Paragraph(f"<b>Email:</b> {user.email}", body_style),
                Paragraph(f"<b>Assessment Date:</b> {date_str}", body_style),
            ],
            [
                Paragraph(f"<b>Age / Gender:</b> {assessment.age} yrs / {user.gender or 'Unspecified'}", body_style),
                Paragraph(f"<b>AI Engine Status:</b> Active (XGBoost)", body_style),
            ]
        ]
        info_table = Table(patient_data, colWidths=[270, 270])
        info_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
            ("PADDING", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 15))

        # AI Prediction Summary
        elements.append(Paragraph("1. AI Diabetes Risk Screening Summary", h2_style))
        risk_color = "#fee2e2" if prediction.prediction == "Diabetic" else "#dcfce7"
        risk_border = "#ef4444" if prediction.prediction == "Diabetic" else "#10b981"
        
        pred_text = f"Risk Classification: {prediction.prediction.upper()} ({prediction.risk_percentage}% Risk Score)"
        conf_text = f"Model Confidence: {prediction.confidence}%"
        
        summary_data = [
            [Paragraph(f"<b>{pred_text}</b>", alert_style)],
            [Paragraph(f"Statistical Probability Score: <b>{prediction.risk_percentage}%</b> | {conf_text}", body_style)]
        ]
        summary_table = Table(summary_data, colWidths=[540])
        summary_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(risk_color)),
            ("BOX", (0, 0), (-1, -1), 1.5, colors.HexColor(risk_border)),
            ("PADDING", (0, 0), (-1, -1), 10),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 15))

        # Clinical Vitals Matrix
        elements.append(Paragraph("2. Recorded Vitals & Laboratory Metrics", h2_style))
        vitals_headers = [Paragraph("<b>Parameter</b>", body_style), Paragraph("<b>Recorded Value</b>", body_style), Paragraph("<b>Reference Threshold</b>", body_style)]
        vitals_data = [vitals_headers]
        
        metrics_list = [
            ("Fasting Blood Glucose", f"{assessment.glucose} mg/dL", "< 100 mg/dL Normal"),
            ("Blood Pressure (Diastolic)", f"{assessment.blood_pressure} mmHg", "< 80 mmHg Normal"),
            ("BMI (Body Mass Index)", f"{assessment.bmi} kg/m²", "18.5 – 24.9 Normal"),
            ("Insulin Level", f"{assessment.insulin} μU/mL", "16 – 166 μU/mL Normal"),
            ("Skin Thickness", f"{assessment.skin_thickness} mm", "10 – 30 mm Normal"),
            ("Diabetes Pedigree Score", f"{assessment.diabetes_pedigree_function:.2f}", "< 0.50 Normal"),
        ]
        for name, val, ref in metrics_list:
            vitals_data.append([
                Paragraph(name, body_style),
                Paragraph(f"<b>{val}</b>", body_style),
                Paragraph(ref, body_style)
            ])

        vitals_table = Table(vitals_data, colWidths=[180, 180, 180])
        vitals_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(vitals_table)
        elements.append(Spacer(1, 15))

        # Contributing Risk Factors
        elements.append(Paragraph("3. Clinical Risk Factor Analysis & Explainability", h2_style))
        assessment_dict = {
            "glucose": assessment.glucose,
            "bmi": assessment.bmi,
            "age": assessment.age,
            "blood_pressure": assessment.blood_pressure,
            "diabetes_pedigree_function": assessment.diabetes_pedigree_function,
            "insulin": assessment.insulin
        }
        factors = analyze_contributing_factors(assessment_dict)
        
        factor_rows = [[Paragraph("<b>Risk Factor</b>", body_style), Paragraph("<b>Value</b>", body_style), Paragraph("<b>Impact Level</b>", body_style), Paragraph("<b>Description</b>", body_style)]]
        for f in factors:
            factor_rows.append([
                Paragraph(f["factor"], body_style),
                Paragraph(f["value"], body_style),
                Paragraph(f"<b>{f['impact']}</b>", body_style),
                Paragraph(f["description"], body_style)
            ])

        factor_table = Table(factor_rows, colWidths=[130, 80, 100, 230])
        factor_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(factor_table)
        elements.append(Spacer(1, 15))

        # Lifestyle & Medical Recommendations
        elements.append(Paragraph("4. Recommended Personalized Interventions", h2_style))
        rec_p1 = "• <b>Dietary Guidance:</b> Limit refined sugars, simple carbohydrates, and processed foods. Increase intake of high-fiber greens, legumes, and lean protein."
        rec_p2 = "• <b>Physical Activity:</b> Aim for at least 150 minutes per week of moderate aerobic exercise (brisk walking, cycling) combined with twice-weekly resistance training."
        rec_p3 = "• <b>Clinical Follow-up:</b> Schedule a formal Fasting Blood Glucose & HbA1c test with a certified healthcare provider."
        
        elements.append(Paragraph(rec_p1, body_style))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(rec_p2, body_style))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(rec_p3, body_style))
        elements.append(Spacer(1, 20))

        # Disclaimer
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=10))
        disclaimer_text = (
            "<b>Medical Disclaimer:</b> DiaSense AI is an artificial intelligence-assisted risk screening platform intended for educational "
            "and risk assessment purposes only. This report does NOT constitute a clinical medical diagnosis or treatment plan. "
            "Always consult a licensed medical professional for formal clinical evaluation."
        )
        elements.append(Paragraph(disclaimer_text, ParagraphStyle("Disclaimer", parent=styles["Normal"], fontSize=8, leading=11, textColor=colors.HexColor("#64748b"))))

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
