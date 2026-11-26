import nodemailer from "nodemailer";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

export const sendPasswordResetEmail = async ({
  email,
  name,
  resetUrl,
}) => {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
  } = process.env;

  if (
    !SMTP_HOST ||
    !SMTP_PORT ||
    !SMTP_USER ||
    !SMTP_PASS ||
    !SMTP_FROM
  ) {
    throw new Error("Email service is not configured");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(resetUrl);

  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "Reset your CIRQL password",

    text: [
      `Hello ${name},`,
      "",
      "We received a request to reset your CIRQL password.",
      "",
      `Reset your password using this link: ${resetUrl}`,
      "",
      "This link expires in 15 minutes and can only be used once.",
      "",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),

    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#1f2937">
        <h1 style="color:#6366f1">CIRQL</h1>
        <h2>Password reset request</h2>
        <p>Hello ${safeName},</p>
        <p>We received a request to reset your CIRQL account password.</p>
        <p>Click below to choose a new password.</p>
        <a href="${safeResetUrl}"
          style="display:inline-block;padding:14px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:10px;font-weight:bold">
          Reset password
        </a>
        <p style="margin-top:24px">This link expires in <strong>15 minutes</strong> and can only be used once.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
        <p style="color:#6b7280;font-size:12px">CIRQL — Connect. Collaborate. Create.</p>
      </div>
    `,
  });
};