import nodemailer from "nodemailer";

const SUBJECT = "Your Suruur E Man Contributor Application Has Been Approved";
const SENDER_EMAIL = "info@suruureman.com";
const SENDER_NAME = "Suruur E Man";
const EMAIL_TIMEOUT_MS = 15_000;

export type ContributorApprovalEmailResult =
  | { status: "sent" }
  | { status: "failed"; reason: string };

interface ContributorApprovalEmailInput {
  applicantName: string;
  recipientEmail: string;
  activationUrl: string;
  statusUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const portValue = process.env.SMTP_PORT?.trim();
  const secureValue = process.env.SMTP_SECURE?.trim().toLowerCase();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.MAIL_FROM?.trim();
  const fromName = process.env.MAIL_FROM_NAME?.trim() || SENDER_NAME;

  if (!host || !portValue || !secureValue || !user || !password || !from) {
    return { error: "SMTP configuration is incomplete." as const };
  }

  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !["true", "false"].includes(secureValue)) {
    return { error: "SMTP configuration is invalid." as const };
  }

  return {
    host,
    port,
    secure: secureValue === "true",
    user,
    password,
    from,
    fromName,
  };
}

function buildHtmlEmail({ applicantName, activationUrl, statusUrl }: Omit<ContributorApprovalEmailInput, "recipientEmail">): string {
  const safeName = escapeHtml(applicantName);
  const safeActivationUrl = escapeHtml(activationUrl);
  const safeStatusUrl = escapeHtml(statusUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#11100f;color:#f5f1e8;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#11100f;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#1b1917;border:1px solid #806a32;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;background:#171513;border-bottom:1px solid #5d4c29;text-align:center;">
                <div style="color:#d1ad53;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Suruur E Man</div>
                <h1 style="margin:12px 0 0;color:#f5f1e8;font-size:24px;line-height:1.25;">Contributor Application Approved</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;">Dear ${safeName},</p>
                <p style="margin:0 0 20px;">We are pleased to inform you that your Contributor application for Suruur E Man has been approved.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#2a2112;border:1px solid #a9812e;border-radius:10px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <strong style="color:#e0b84f;">Important: Approval does not automatically activate your account.</strong>
                      <div style="margin-top:8px;color:#e8dfcf;">Use the secure activation button below to create your Contributor password and activate your account manually.</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 12px;text-align:center;">
                  <a href="${safeActivationUrl}" style="display:inline-block;background:#d1ad53;color:#171513;text-decoration:none;font-weight:bold;letter-spacing:1px;padding:14px 22px;border-radius:7px;">ACTIVATE MY CONTRIBUTOR ACCOUNT</a>
                </p>
                <p style="margin:0 0 24px;text-align:center;color:#b8ad9a;font-size:13px;">This secure link expires after 72 hours and can be used only once.</p>
                <p style="margin:0 0 16px;">After activation, you can sign in to your Contributor account. If you cannot use this email link, visit the <a href="${safeStatusUrl}" style="color:#e0b84f;">Contributor Status page</a> and check your application using your first name, date of birth, and email address.</p>
                <p style="margin:24px 0 0;">Suruur E Man Team</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background:#171513;border-top:1px solid #3f3525;color:#9e9587;font-size:12px;text-align:center;">
                Suruureman.com · Contributor onboarding
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildTextEmail({ applicantName, activationUrl, statusUrl }: Omit<ContributorApprovalEmailInput, "recipientEmail">): string {
  return `SURUUR E MAN
CONTRIBUTOR APPLICATION APPROVED

Dear ${applicantName},

We are pleased to inform you that your Contributor application for Suruur E Man has been approved.

Important: Approval does not automatically activate your account.

Please activate your Contributor account using the link below:
${activationUrl}

This activation link:
- Expires after 72 hours
- Can be used only once
- Uses the existing secure activation system

After activation, you will create your Contributor password and can then access your Contributor account.

If you cannot use the email link, visit the Contributor Status page:
${statusUrl}

Suruur E Man Team
`;
}

export async function sendContributorApprovalEmail(input: ContributorApprovalEmailInput): Promise<ContributorApprovalEmailResult> {
  const config = getSmtpConfig();
  if ("error" in config) return { status: "failed", reason: config.error ?? "SMTP configuration is invalid." };

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: EMAIL_TIMEOUT_MS,
      greetingTimeout: EMAIL_TIMEOUT_MS,
      socketTimeout: EMAIL_TIMEOUT_MS,
    });

    await transporter.sendMail({
      from: `"${config.fromName}" <${config.from || SENDER_EMAIL}>`,
      to: input.recipientEmail,
      subject: SUBJECT,
      text: buildTextEmail(input),
      html: buildHtmlEmail(input),
    });
    return { status: "sent" };
  } catch {
    return { status: "failed", reason: "SMTP delivery failed." };
  }
}