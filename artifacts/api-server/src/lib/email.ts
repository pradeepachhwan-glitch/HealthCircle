import { logger } from "./logger";

interface SendArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const FROM_DEFAULT = process.env.EMAIL_FROM ?? "HealthCircle <onboarding@resend.dev>";
const APP_NAME = "HealthCircle";

export async function sendEmail({ to, subject, text, html }: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev / unconfigured mode: print to server logs so the developer can copy
    // the OTP from console output. We log even when Resend IS configured so
    // there's an audit trail.
    logger.warn(
      { to, subject, text },
      "[email] RESEND_API_KEY not set — printing email to console instead of sending",
    );
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_DEFAULT,
        to: [to],
        subject,
        text,
        html: html ?? undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body, to }, "[email] Resend send failed");
      throw new Error(`Resend send failed: ${res.status}`);
    }
  } catch (err) {
    logger.error({ err, to }, "[email] send threw");
    throw err;
  }
}

type OtpPurposeLabel = "login" | "signup" | "reset";

const PURPOSE_COPY: Record<OtpPurposeLabel, { headline: string; subjectVerb: string; intro: string }> = {
  login: {
    headline: "Your sign-in code",
    subjectVerb: "sign-in",
    intro: "Enter this code in the app to finish signing in. It expires in 10 minutes.",
  },
  signup: {
    headline: "Verify your email",
    subjectVerb: "verification",
    intro: "Enter this code in the app to verify your email and finish creating your account. It expires in 10 minutes.",
  },
  reset: {
    headline: "Reset your password",
    subjectVerb: "password reset",
    intro: "Enter this code in the app to reset your password. It expires in 10 minutes. If you did not request a reset, ignore this email and your password will stay unchanged.",
  },
};

export function buildOtpEmail(code: string, purpose: OtpPurposeLabel = "login") {
  const copy = PURPOSE_COPY[purpose] ?? PURPOSE_COPY.login;
  const subject = `${code} is your ${APP_NAME} ${copy.subjectVerb} code`;
  const text = `Your ${APP_NAME} ${copy.subjectVerb} code is ${code}.\n\nIt expires in 10 minutes. If you did not request this, you can ignore this email.`;
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;margin:0;padding:32px 16px;">
  <table role="presentation" align="center" style="max-width:480px;background:#fff;border-radius:14px;padding:32px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
    <tr><td>
      <p style="margin:0 0 8px;color:#0f172a;font-size:14px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">${APP_NAME}</p>
      <h1 style="margin:0 0 8px;color:#0f172a;font-size:22px;line-height:1.3;">${copy.headline}</h1>
      <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">${copy.intro}</p>
      <div style="text-align:center;background:#eef2ff;border-radius:10px;padding:18px 0;font-size:30px;letter-spacing:0.4em;font-weight:700;color:#1e293b;">${code}</div>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">If you did not request this, you can safely ignore this email.</p>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}
