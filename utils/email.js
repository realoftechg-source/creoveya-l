const nodemailer = require('nodemailer');

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: Number(port) === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

async function sendMail({ to, subject, text, html }) {
  const transport = getTransport();
  if (!transport) {
    console.log(`[email] SMTP not configured. Skipping email to ${to}`);
    return { skipped: true };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const info = await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return { skipped: false, info };
}

async function sendWelcomeEmail(user) {
  if (!user || !user.email) return { skipped: true };
  return sendMail({
    to: user.email,
    subject: 'Welcome to Creoveya',
    text: `Hi ${user.username},\n\nWelcome to Creoveya. Your account has been created successfully.\n\nYou can now log in and activate your access plan.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #10193a; line-height: 1.6;">
        <h2 style="margin-bottom: 12px; color: #0f2c66;">Welcome to Creoveya</h2>
        <p>Hi <strong>${user.username}</strong>,</p>
        <p>Your account has been created successfully.</p>
        <p>You can now log in to your dashboard and choose or upgrade your activation plan.</p>
        <p>Regards,<br/>The Creoveya Team</p>
      </div>
    `,
  });
}

async function sendApprovalEmail(user, plan) {
  if (!user || !user.email) return { skipped: true };
  const planName = plan?.name || 'Activation plan';
  return sendMail({
    to: user.email,
    subject: 'Your Creoveya payment has been approved',
    text: `Hi ${user.username},\n\nYour payment for ${planName} has been approved. Your account access has been activated and your balance has been updated.\n\nYou can now continue using the studio.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #10193a; line-height: 1.6;">
        <h2 style="margin-bottom: 12px; color: #0f2c66;">Payment Approved</h2>
        <p>Hi <strong>${user.username}</strong>,</p>
        <p>Your payment for <strong>${planName}</strong> has been approved.</p>
        <p>Your account access, credits, and usage balance have been updated successfully.</p>
        <p>You can continue using Creoveya normally.</p>
        <p>Regards,<br/>The Creoveya Team</p>
      </div>
    `,
  });
}

async function sendTopUpEmail(user, plan) {
  if (!user || !user.email) return { skipped: true };
  const planName = plan?.name || 'Top-up plan';
  return sendMail({
    to: user.email,
    subject: 'Your Creoveya top-up has been added',
    text: `Hi ${user.username},\n\nYour ${planName} top-up has been approved and added to your account. Your credits and usage balance have been updated.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #10193a; line-height: 1.6;">
        <h2 style="margin-bottom: 12px; color: #0f2c66;">Top-Up Added</h2>
        <p>Hi <strong>${user.username}</strong>,</p>
        <p>Your <strong>${planName}</strong> top-up has been approved and applied to your account.</p>
        <p>Your credits and streaming time have been updated.</p>
        <p>Regards,<br/>The Creoveya Team</p>
      </div>
    `,
  });
}

async function sendRejectionEmail(user, plan, note) {
  if (!user || !user.email) return { skipped: true };
  const planName = plan?.name || 'your submitted plan';
  return sendMail({
    to: user.email,
    subject: 'Your Creoveya payment could not be approved',
    text: `Hi ${user.username},\n\nYour payment submission for ${planName} was not approved.${note ? `\n\nReason: ${note}` : ''}\n\nPlease double-check your receipt and resubmit, or contact support if you believe this is a mistake.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #10193a; line-height: 1.6;">
        <h2 style="margin-bottom: 12px; color: #b91c1c;">Payment Not Approved</h2>
        <p>Hi <strong>${user.username}</strong>,</p>
        <p>Your payment submission for <strong>${planName}</strong> was not approved.</p>
        ${note ? `<p><strong>Reason:</strong> ${note}</p>` : ''}
        <p>Please double-check your receipt and resubmit, or contact support if you believe this is a mistake.</p>
        <p>Regards,<br/>The Creoveya Team</p>
      </div>
    `,
  });
}

/**
 * Notifies the admin by email the moment a user submits a payment for
 * review — since an admin won't be watching the dashboard every minute,
 * this is what actually prompts them to go approve/reject it.
 * ADMIN_NOTIFICATION_EMAIL is a plain environment variable (see
 * .env.example) rather than a database setting, by design — it's simple
 * to set once and doesn't need its own admin-dashboard UI.
 */
async function sendAdminPaymentNotification({ user, plan, planType, amount, methodLabel, submissionId }) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) {
    console.log('[email] ADMIN_NOTIFICATION_EMAIL not set — skipping admin notification email.');
    return { skipped: true };
  }
  const planLabel = planType === 'topup' ? 'Top-Up' : 'Activation';
  const planName = plan?.name || 'Unknown plan';
  return sendMail({
    to: adminEmail,
    subject: `New Creoveya payment awaiting review — ${user.username}`,
    text: `A new payment was just submitted and needs your review.\n\nUser: ${user.username} (${user.email || 'no email on file'})\nType: ${planLabel}\nPlan: ${planName}\nAmount: $${amount}\nMethod: ${methodLabel || 'N/A'}\n\nReview it here: (open /admin_dashboard → Payment Approvals)`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #10193a; line-height: 1.6;">
        <h2 style="margin-bottom: 12px; color: #0f2c66;">New Payment Awaiting Review</h2>
        <p>A new payment was just submitted and needs your review.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding:4px 12px 4px 0; color:#4b5875;">User</td><td><strong>${user.username}</strong> (${user.email || 'no email on file'})</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#4b5875;">Type</td><td>${planLabel}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#4b5875;">Plan</td><td>${planName}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#4b5875;">Amount</td><td>$${amount}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#4b5875;">Method</td><td>${methodLabel || 'N/A'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#4b5875;">Submission #</td><td>${submissionId}</td></tr>
        </table>
        <p>Log in to <strong>/admin_dashboard → Payment Approvals</strong> to review the receipt and approve or reject it.</p>
      </div>
    `,
  });
}

module.exports = { sendMail, sendWelcomeEmail, sendApprovalEmail, sendTopUpEmail, sendRejectionEmail, sendAdminPaymentNotification };
