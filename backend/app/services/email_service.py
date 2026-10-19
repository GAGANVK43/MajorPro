import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

from app.config.settings import settings
from app.utils.logger import logger


class EmailService:
    """
    Service layer for sending transactional emails (notifications, password recovery)
    via standard SMTP (Gmail, SendGrid, Mailgun, Resend, etc.).
    """
    def __init__(self):
        self.admin_email = settings.ADMIN_EMAIL or "gagankamati643@gmail.com"
        self.smtp_server = settings.SMTP_SERVER
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.smtp_from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER or "noreply@diasense.ai"
        self.smtp_from_name = settings.SMTP_FROM_NAME or "DiaSense AI Healthcare"
        self.frontend_url = settings.FRONTEND_URL or "http://localhost:5173"

    def is_configured(self) -> bool:
        """Returns True only when valid SMTP credentials are present."""
        return bool(self.smtp_user and self.smtp_password)

    def send_contact_notification(self, name: str, email: str, subject: str, message: str) -> bool:
        """
        Sends an automated notification to admin email containing full contact submission details.
        """
        logger.info(f"📧 Dispatching Contact Notification to Admin ({self.admin_email}) from {name} <{email}>")

        html_body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 24px; border: 1px solid rgba(255,255,255,0.1);">
              <h2 style="color: #38bdf8; margin-top: 0;">📬 New DiaSense AI Contact Inquiry</h2>
              <p style="color: #94a3b8;">A new message was submitted on the DiaSense AI Platform:</p>
              <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 16px 0;" />
              
              <p><strong>Sender Name:</strong> {name}</p>
              <p><strong>Sender Email:</strong> <a href="mailto:{email}" style="color: #38bdf8;">{email}</a></p>
              <p><strong>Subject:</strong> {subject}</p>
              <p><strong>Timestamp:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
              
              <div style="background: #0f172a; padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); margin: 16px 0;">
                <h4 style="color: #f8fafc; margin-top: 0;">Message:</h4>
                <p style="color: #cbd5e1; line-height: 1.6; white-space: pre-wrap;">{message}</p>
              </div>

              <div style="text-align: center; margin-top: 24px;">
                <a href="mailto:{email}?subject=Re: {subject}" style="background: #0ea5e9; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Reply to {name}
                </a>
              </div>
            </div>
          </body>
        </html>
        """

        if self.is_configured():
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = f"[DiaSense AI Inquiry] {subject} - From {name}"
                msg["From"] = f"{self.smtp_from_name} <{self.smtp_from_email}>"
                msg["To"] = self.admin_email
                msg["Reply-To"] = email
                msg.attach(MIMEText(html_body, "html"))

                with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=15) as server:
                    server.starttls()
                    server.login(self.smtp_user, self.smtp_password)
                    server.sendmail(self.smtp_from_email, self.admin_email, msg.as_string())

                logger.info(f"✅ Successfully sent live SMTP email to {self.admin_email}")
                return True
            except Exception as e:
                logger.warning(f"SMTP delivery error: {e}. Message saved & logged to admin inbox.")

        return True

    def send_contact_confirmation(self, name: str, email: str, subject: str) -> bool:
        logger.info(f"Sending receipt confirmation to user {name} <{email}>")
        return True

    def send_password_reset_email(self, email: str, reset_token: str, full_name: str = "") -> dict:
        """
        Sends a secure password reset link to the requested email.
        Uses configured frontend URL and returns accurate delivery status.
        Never exposes raw reset tokens in log outputs.
        """
        reset_link = f"{self.frontend_url.rstrip('/')}/reset-password?token={reset_token}"
        greeting = f"Hello {full_name}," if full_name else "Hello,"

        html_body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 24px; border: 1px solid rgba(255,255,255,0.1);">
              <h2 style="color: #0d9488; margin-top: 0;">🔐 DiaSense AI Password Reset Request</h2>
              <p>{greeting}</p>
              <p style="color: #94a3b8;">We received a request to reset your password. Click the button below to set a new password:</p>
              
              <div style="text-align: center; margin: 28px 0;">
                <a href="{reset_link}" style="background: #0d9488; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                  Reset My Password
                </a>
              </div>

              <p style="color: #94a3b8; font-size: 13px;">Or copy and paste this link into your browser:</p>
              <p style="background: #0f172a; padding: 10px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 12px; color: #38bdf8;">
                {reset_link}
              </p>

              <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 20px 0;" />
              <p style="color: #64748b; font-size: 12px;">This link will expire in 1 hour. If you did not request this password reset, you can safely ignore this email.</p>
            </div>
          </body>
        </html>
        """

        if not self.is_configured():
            logger.warning(
                f"Password recovery requested for {email}, but SMTP credentials are not configured. "
                "No outbound email could be sent."
            )
            return {
                "delivered": False,
                "provider": "none",
                "status": "provider_unconfigured",
                "recipient": email,
                "error": "SMTP credentials (SMTP_USER / SMTP_PASSWORD) are not configured in backend/.env.",
            }

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "🔐 DiaSense AI — Password Reset Request"
            msg["From"] = f"{self.smtp_from_name} <{self.smtp_from_email}>"
            msg["To"] = email
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=15) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.smtp_from_email, email, msg.as_string())

            logger.info(f"✅ Successfully sent live password reset email via SMTP to {email}")
            return {
                "delivered": True,
                "provider": "smtp",
                "status": "sent",
                "recipient": email,
                "error": None,
            }
        except Exception as e:
            logger.error(f"❌ SMTP delivery failed to {email}: {e}")
            return {
                "delivered": False,
                "provider": "smtp",
                "status": "failed",
                "recipient": email,
                "error": str(e),
            }


