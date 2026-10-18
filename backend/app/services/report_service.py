import io
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.prediction import Prediction
from app.ml.prediction import analyze_contributing_factors


# ─── Colour Palette ──────────────────────────────────────────────────────────
C_TEAL      = "#0D9488"
C_NAVY      = "#0F172A"
C_SLATE     = "#1E293B"
C_BODY      = "#334155"
C_MUTED     = "#64748B"
C_BORDER    = "#CBD5E1"
C_LIGHT_BG  = "#F8FAFC"
C_TABLE_HDR = "#E2E8F0"
C_GREEN_BG  = "#DCFCE7"
C_GREEN_BOR = "#10B981"
C_RED_BG    = "#FEE2E2"
C_RED_BOR   = "#EF4444"
C_AMBER_BG  = "#FFFBEB"
C_AMBER_BOR = "#F59E0B"
C_WHITE     = "#FFFFFF"


def _risk_colors(prediction_label: str, risk_pct: float):
    """Return (bg, border, text) hex based on prediction label / risk %."""
    label = (prediction_label or "").lower()
    if "higher" in label or "diabetic" in label or risk_pct >= 50:
        return C_RED_BG, C_RED_BOR, "#991B1B"
    if risk_pct >= 30:
        return C_AMBER_BG, C_AMBER_BOR, "#92400E"
    return C_GREEN_BG, C_GREEN_BOR, "#065F46"


def _impact_color(impact: str) -> str:
    lo = impact.lower()
    if "high" in lo or "elevated" in lo:
        return "#EF4444"
    if "moderate" in lo:
        return "#F59E0B"
    return "#10B981"


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    # ─────────────────────────────────────────────────────────────────────────
    def generate_pdf_report(self, user: User, prediction_id: int) -> bytes:
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.lib import colors
            from reportlab.platypus import (
                SimpleDocTemplate, Paragraph, Spacer, Table,
                TableStyle, HRFlowable, KeepTogether,
            )
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import mm
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="PDF generator dependency (reportlab) is not installed.",
            )

        # ── Fetch data ────────────────────────────────────────────────────────
        prediction = self.db.query(Prediction).filter(Prediction.id == prediction_id).first()
        if not prediction:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

        assessment = prediction.assessment
        if not assessment or assessment.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        # ── Page setup ────────────────────────────────────────────────────────
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20 * mm,
            leftMargin=20 * mm,
            topMargin=18 * mm,
            bottomMargin=18 * mm,
        )
        W = A4[0] - 40 * mm   # usable width

        # ── Styles ────────────────────────────────────────────────────────────
        styles = getSampleStyleSheet()

        def sty(name, **kw):
            base = kw.pop("parent", "Normal")
            p = ParagraphStyle(name, parent=styles[base], **kw)
            return p

        title_sty  = sty("RPT_Title", parent="Heading1", fontSize=22, leading=27,
                         textColor=colors.HexColor(C_NAVY), spaceAfter=2)
        sub_sty    = sty("RPT_Sub",   fontSize=10, leading=13,
                         textColor=colors.HexColor(C_MUTED), spaceAfter=0)
        h2_sty     = sty("RPT_H2",    parent="Heading2", fontSize=13, leading=17,
                         textColor=colors.HexColor(C_SLATE), spaceBefore=14, spaceAfter=6)
        body_sty   = sty("RPT_Body",  fontSize=9.5, leading=13,
                         textColor=colors.HexColor(C_BODY))
        small_sty  = sty("RPT_Small", fontSize=8, leading=11,
                         textColor=colors.HexColor(C_MUTED))
        disc_sty   = sty("RPT_Disc",  fontSize=7.5, leading=10.5,
                         textColor=colors.HexColor(C_MUTED))

        def B(text): return f"<b>{text}</b>"
        def C(text, hex_color): return f'<font color="{hex_color}">{text}</font>'

        # ── Helpers ───────────────────────────────────────────────────────────
        def P(text, style=None): return Paragraph(text, style or body_sty)
        def HR(thick=1.5, color=C_TEAL): return HRFlowable(width="100%", thickness=thick,
                                                             color=colors.HexColor(color), spaceAfter=10)
        def SP(h=6): return Spacer(1, h)

        # ── Assessment field helpers ──────────────────────────────────────────
        def gv(attr, default=None):
            return getattr(assessment, attr, default) or default

        hba1c_val  = gv("hba1c", 5.7)
        glu_val    = gv("fasting_glucose") or gv("glucose", 100.0)
        bp_val     = gv("blood_pressure", 120.0)
        bmi_val    = gv("bmi", 22.0)
        sugar_val  = gv("daily_sugar_intake", 30.0)
        act_val    = gv("physical_activity_hours", 1.0)
        ff_val     = gv("fast_food_frequency", 2.0)
        sleep_val  = gv("sleep_hours", 7.0)
        fh_raw     = gv("family_history", 0)
        fh_str     = "Positive (Yes)" if fh_raw in (1, 1.0, True, "1") else "Negative (No)"
        age_val    = gv("age") or getattr(user, "age", "—")
        gender_val = gv("gender") or getattr(user, "gender", "—") or "—"
        pg_val     = gv("patient_group", "Urban")
        monthly_income = gv("monthly_income")

        pred_label  = prediction.prediction or "Unknown"
        risk_pct    = round(prediction.risk_percentage, 1)
        confidence  = round(prediction.confidence, 1)
        date_str    = (prediction.created_at.strftime("%B %d, %Y")
                       if prediction.created_at else datetime.utcnow().strftime("%B %d, %Y"))
        report_id   = f"REP-{prediction.id:05d}"

        risk_bg, risk_bor, risk_txt = _risk_colors(pred_label, risk_pct)

        # ═════════════════════════════════════════════════════════════════════
        elements = []

        # ── TITLE BLOCK ──────────────────────────────────────────────────────
        elements.append(P("DiaSense AI — Health Risk Screening Report", title_sty))
        elements.append(P("Artificial Intelligence Medical Assessment &amp; Clinical Insights", sub_sty))
        elements.append(SP(6))
        elements.append(HR(2.5, C_TEAL))

        # ── PATIENT INFO TABLE ───────────────────────────────────────────────
        ai_status = "Active (XGBoost)"
        pat_data = [
            [P(f"{B('Patient Name:')} {user.full_name}"),   P(f"{B('Report ID:')} {report_id}")],
            [P(f"{B('Email:')} {user.email}"),               P(f"{B('Assessment Date:')} {date_str}")],
            [P(f"{B('Age / Gender:')} {age_val} yrs / {gender_val}"),
             P(f"{B('AI Engine Status:')} {ai_status}")],
        ]
        pat_tbl = Table(pat_data, colWidths=[W * 0.50, W * 0.50])
        pat_tbl.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, -1), colors.HexColor(C_LIGHT_BG)),
            ("BOX",         (0, 0), (-1, -1), 1,   colors.HexColor(C_BORDER)),
            ("INNERGRID",   (0, 0), (-1, -1), 0.5, colors.HexColor(C_BORDER)),
            ("PADDING",     (0, 0), (-1, -1), 7),
            ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(pat_tbl)
        elements.append(SP(12))

        # ── SECTION 1: AI RISK SUMMARY ────────────────────────────────────────
        elements.append(P("1. AI Diabetes Risk Screening Summary", h2_sty))

        pred_display = pred_label.upper()
        risk_line   = f"{B(f'Risk Classification: {pred_display} ({risk_pct}% Risk Score)')}"
        conf_line   = f"Statistical Probability Score: {B(f'{risk_pct}%')} | Model Confidence: {confidence}%"

        sum_data = [
            [P(C(risk_line, risk_txt))],
            [P(conf_line)],
        ]
        sum_tbl = Table(sum_data, colWidths=[W])
        sum_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(risk_bg)),
            ("BOX",        (0, 0), (-1, -1), 1.5, colors.HexColor(risk_bor)),
            ("PADDING",    (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1),
             [colors.HexColor(risk_bg), colors.HexColor(risk_bg)]),
        ]))
        elements.append(sum_tbl)
        elements.append(SP(10))

        # ── SECTION 2: VITALS TABLE ────────────────────────────────────────────
        elements.append(P("2. Recorded Vitals &amp; Laboratory Metrics", h2_sty))

        vh = [P(B("Parameter")), P(B("Recorded Value")), P(B("Reference Threshold"))]
        vitals_rows = [vh,
            ["Fasting Blood Glucose",    f"{glu_val:.0f} mg/dL",      "< 100 mg/dL Normal"],
            ["HbA1c Level",              f"{hba1c_val:.1f}%",          "< 5.7% Normal"],
            ["Blood Pressure",           f"{bp_val:.0f} mmHg",         "< 80 mmHg Normal"],
            ["BMI (Body Mass Index)",    f"{bmi_val:.1f} kg/m²",       "18.5 – 24.9 Normal"],
            ["Physical Activity",        f"{act_val:.1f} hrs/week",    ">= 2.5 hrs/week"],
            ["Daily Sugar Intake",       f"{sugar_val:.0f} g/day",     "< 25–50 g/day"],
            ["Daily Sleep",              f"{sleep_val:.1f} hrs/night", "7 – 9 hrs Normal"],
            ["Fast Food Frequency",      f"{ff_val:.0f} meals/week",   "<= 1 meal/week"],
            ["Family History",           fh_str,                       "Genetic Risk Indicator"],
        ]

        # Convert string rows to Paragraphs
        vt_data = [vitals_rows[0]]
        for r in vitals_rows[1:]:
            vt_data.append([P(r[0]), P(B(r[1])), P(r[2])])

        vt_tbl = Table(vt_data, colWidths=[W * 0.38, W * 0.28, W * 0.34])
        vt_tbl.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, 0), colors.HexColor(C_TABLE_HDR)),
            ("GRID",        (0, 0), (-1, -1), 0.5, colors.HexColor(C_BORDER)),
            ("PADDING",     (0, 0), (-1, -1), 6),
            ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.HexColor(C_WHITE), colors.HexColor(C_LIGHT_BG)]),
        ]))
        elements.append(vt_tbl)
        elements.append(SP(10))

        # ── SECTION 3: RISK FACTOR ANALYSIS ──────────────────────────────────
        elements.append(P("3. Clinical Risk Factor Analysis &amp; Explainability", h2_sty))

        adict = {
            "patient_group": pg_val, "hba1c": hba1c_val,
            "fasting_glucose": glu_val, "glucose": glu_val,
            "bmi": bmi_val, "blood_pressure": bp_val,
            "daily_sugar_intake": sugar_val, "physical_activity_hours": act_val,
            "fast_food_frequency": ff_val, "family_history": fh_raw,
        }
        factors = analyze_contributing_factors(adict)

        fh = [P(B("Risk Factor")), P(B("Value")), P(B("Impact Level")), P(B("Description"))]
        f_data = [fh]
        for f in factors:
            ic = _impact_color(f["impact"])
            f_data.append([
                P(f["factor"]),
                P(f["value"]),
                P(C(B(f["impact"]), ic)),
                P(f["description"]),
            ])

        f_tbl = Table(f_data, colWidths=[W * 0.23, W * 0.14, W * 0.17, W * 0.46])
        f_tbl.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, 0), colors.HexColor(C_TABLE_HDR)),
            ("GRID",        (0, 0), (-1, -1), 0.5, colors.HexColor(C_BORDER)),
            ("PADDING",     (0, 0), (-1, -1), 6),
            ("VALIGN",      (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.HexColor(C_WHITE), colors.HexColor(C_LIGHT_BG)]),
        ]))
        elements.append(f_tbl)
        elements.append(SP(10))

        # ── SECTION 4: RECOMMENDATIONS ────────────────────────────────────────
        elements.append(P("4. Personalised Health Interventions &amp; Next Steps", h2_sty))

        recs = [
            ("🥗 Dietary Guidance",
             "Limit refined carbohydrates, sugary beverages, and deep-fried snacks. "
             "Emphasise low-GI Indian grains (Ragi, Bajra, Oats, Moong Dal) "
             "and increase fibre from fresh vegetables and legumes."),
            ("🏃 Physical Exercise",
             "Target ≥ 150 minutes of weekly moderate aerobic activity — brisk walking, "
             "cycling, or yoga — combined with light resistance training twice a week."),
            ("🩺 Clinical Follow-up",
             "Schedule a laboratory Fasting Blood Glucose and HbA1c test with a "
             "certified healthcare professional for a definitive clinical diagnosis."),
            ("😴 Lifestyle Optimisation",
             "Aim for 7–9 hours of quality sleep per night. Manage stress through "
             "mindfulness or relaxation techniques. Avoid tobacco and limit alcohol."),
        ]

        rec_data = []
        for icon_label, desc in recs:
            rec_data.append([P(B(icon_label)), P(desc)])

        rec_tbl = Table(rec_data, colWidths=[W * 0.30, W * 0.70])
        rec_tbl.setStyle(TableStyle([
            ("GRID",    (0, 0), (-1, -1), 0.5, colors.HexColor(C_BORDER)),
            ("PADDING", (0, 0), (-1, -1), 7),
            ("VALIGN",  (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor(C_LIGHT_BG)),
            ("ROWBACKGROUNDS", (1, 0), (1, -1),
             [colors.HexColor(C_WHITE), colors.HexColor(C_LIGHT_BG)]),
        ]))
        elements.append(rec_tbl)
        elements.append(SP(14))

        # ── FOOTER / DISCLAIMER ───────────────────────────────────────────────
        elements.append(HR(1, C_BORDER))
        elements.append(P(
            f"<b>Generated by DiaSense AI</b> &nbsp;|&nbsp; Report ID: {report_id} "
            f"&nbsp;|&nbsp; {date_str}",
            small_sty,
        ))
        elements.append(SP(4))
        elements.append(P(
            "<b>Medical Disclaimer:</b> DiaSense AI is an artificial-intelligence-assisted "
            "risk-screening platform for educational and preventive purposes only. "
            "This report does <b>NOT</b> constitute a clinical medical diagnosis or "
            "treatment plan. Always consult a licensed healthcare professional for "
            "formal clinical evaluation, diagnosis, and treatment.",
            disc_sty,
        ))

        # ── BUILD PDF ─────────────────────────────────────────────────────────
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    # ─────────────────────────────────────────────────────────────────────────
    def generate_latest_pdf_report(self, user: User) -> bytes:
        """Generate PDF for the user's most recent prediction with seamless auto-generation fallback."""
        from app.models.prediction import Prediction
        from app.models.assessment import Assessment

        latest = (
            self.db.query(Prediction)
            .join(Assessment, Prediction.assessment_id == Assessment.id)
            .filter(Assessment.user_id == user.id)
            .order_by(Prediction.created_at.desc())
            .first()
        )
        if latest:
            return self.generate_pdf_report(user, latest.id)

        # Fallback 1: User has an assessment but no prediction row yet
        latest_assessment = (
            self.db.query(Assessment)
            .filter(Assessment.user_id == user.id)
            .order_by(Assessment.created_at.desc())
            .first()
        )
        if latest_assessment:
            from app.ml.prediction_v2 import predict_diabetes_risk
            from app.services.prediction_service import PredictionService
            pred_svc = PredictionService(self.db)
            adict = pred_svc._extract_assessment_dict(latest_assessment)
            pred_label, risk_pct, confidence, rec, factors = predict_diabetes_risk(adict)
            new_pred = Prediction(
                assessment_id=latest_assessment.id,
                prediction=pred_label,
                risk_percentage=risk_pct,
                confidence=confidence,
            )
            self.db.add(new_pred)
            self.db.commit()
            self.db.refresh(new_pred)
            return self.generate_pdf_report(user, new_pred.id)

        # Fallback 2: Brand new user with no assessment record yet
        new_assessment = Assessment(
            user_id=user.id,
            patient_group="Urban",
            gender=user.gender or "Male",
            age=user.age or 35,
            bmi=24.5,
            blood_pressure=120.0,
            hba1c=5.7,
            fasting_glucose=100.0,
            glucose=100.0,
            physical_activity_hours=2.0,
            daily_sugar_intake=30.0,
            fast_food_frequency=2.0,
            sleep_hours=7.0,
            family_history=0.0,
        )
        self.db.add(new_assessment)
        self.db.commit()
        self.db.refresh(new_assessment)

        from app.ml.prediction_v2 import predict_diabetes_risk
        from app.services.prediction_service import PredictionService
        pred_svc = PredictionService(self.db)
        adict = pred_svc._extract_assessment_dict(new_assessment)
        pred_label, risk_pct, confidence, rec, factors = predict_diabetes_risk(adict)
        new_pred = Prediction(
            assessment_id=new_assessment.id,
            prediction=pred_label,
            risk_percentage=risk_pct,
            confidence=confidence,
        )
        self.db.add(new_pred)
        self.db.commit()
        self.db.refresh(new_pred)
        return self.generate_pdf_report(user, new_pred.id)

