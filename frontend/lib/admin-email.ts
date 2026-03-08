import axios from 'axios';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@swapsmith.io';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function sendBrevoEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY) {
    console.warn('[AdminEmail] BREVO_API_KEY not set, skipping email');
    return;
  }
  await axios.post(
    BREVO_API_URL,
    {
      sender: { email: BREVO_SENDER_EMAIL, name: 'SwapSmith Admin' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    },
    { headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' } }
  );
}

/** Sent to the master admin email when a new admin request arrives */
export async function sendAdminApprovalRequestEmail(opts: {
  masterAdminEmail: string;
  requesterName: string;
  requesterEmail: string;
  reason?: string;
  approvalToken: string;
}) {
  const approveUrl = `${APP_URL}/api/admin/approve?token=${opts.approvalToken}&action=approve`;
  const rejectUrl  = `${APP_URL}/api/admin/approve?token=${opts.approvalToken}&action=reject`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e4e4e7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #7c3aed 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
    .header h1 { margin: 0; color: white; font-size: 26px; }
    .content { background: #18181b; padding: 30px; border-radius: 12px; border: 1px solid #27272a; }
    .field { margin-bottom: 16px; }
    .label { color: #71717a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .value { color: #e4e4e7; font-size: 15px; }
    .reason-box { background: #09090b; border: 1px solid #3f3f46; padding: 16px; border-radius: 8px; color: #a1a1aa; line-height: 1.6; }
    .btn-group { display: flex; gap: 12px; margin-top: 28px; }
    .btn { display: inline-block; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; text-align: center; flex: 1; }
    .btn-approve { background: #16a34a; color: white; }
    .btn-reject  { background: #dc2626; color: white; }
    .footer { text-align: center; margin-top: 30px; color: #71717a; font-size: 13px; }
    .badge { display: inline-block; background: #f59e0b22; color: #f59e0b; border: 1px solid #f59e0b44; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚡ SwapSmith – Admin Access Request</h1>
    </div>
    <div class="content">
      <p style="color:#a1a1aa;margin-top:0;">A new admin privilege request requires your review.</p>
      <span class="badge">🔒 Action Required</span>

      <div class="field" style="margin-top:20px;">
        <div class="label">Name</div>
        <div class="value">${opts.requesterName}</div>
      </div>
      <div class="field">
        <div class="label">Email</div>
        <div class="value">${opts.requesterEmail}</div>
      </div>
      ${opts.reason ? `<div class="field">\n        <div class="label">Reason for Access</div>\n        <div class="reason-box">${opts.reason}</div>\n      </div>` : ''}

      <div class="btn-group">
        <a href="${approveUrl}" class="btn btn-approve">✅ Approve</a>
        <a href="${rejectUrl}"  class="btn btn-reject">❌ Reject</a>
      </div>

      <p style="color:#52525b;font-size:13px;margin-top:20px;">
        These links are single-use and expire in 72 hours. Only click if you are a SwapSmith super admin.
      </p>
    </div>
    <div class="footer">
      <p>SwapSmith · Admin Notification System</p>
    </div>
  </div>
</body>
</html>
  `;

  await sendBrevoEmail(
    opts.masterAdminEmail,
    '🔐 New Admin Access Request – SwapSmith',
    html
  );
}

/** Sent to the requester after approval */
export async function sendAdminApprovedEmail(to: string, name: string) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e4e4e7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { background: linear-gradient(135deg, #14532d 0%, #065f46 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
    .header h1 { margin: 0; color: white; font-size: 26px; }
    .content { background: #18181b; padding: 30px; border-radius: 12px; border: 1px solid #27272a; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; color: #71717a; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Admin Access Approved</h1>
    </div>
    <div class="content">
      <h2 style="margin-top:0;color:#e4e4e7;">Welcome, ${name}!</h2>
      <p style="color:#a1a1aa;line-height:1.6;">
        Your admin access request for SwapSmith has been approved. You now have access to the Admin Dashboard.
      </p>
      <ul style="color:#a1a1aa;line-height:1.8;">
        <li>📊 Platform analytics &amp; swap metrics</li>
        <li>👥 Active user monitoring</li>
        <li>🚨 Error log monitoring</li>
        <li>🔁 Real-time swap activity</li>
      </ul>
      <a href="${APP_URL}/admin/login" class="button">Go to Admin Dashboard</a>
    </div>
    <div class="footer"><p>SwapSmith · Admin System</p></div>
  </div>
</body>
</html>
  `;
  await sendBrevoEmail(to, '✅ Admin Access Approved – SwapSmith', html);
}

/** Sent to the requester after rejection */
export async function sendAdminRejectedEmail(to: string, name: string, reason?: string) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e4e4e7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { background: linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
    .header h1 { margin: 0; color: white; font-size: 26px; }
    .content { background: #18181b; padding: 30px; border-radius: 12px; border: 1px solid #27272a; }
    .footer { text-align: center; margin-top: 30px; color: #71717a; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>❌ Admin Request Not Approved</h1></div>
    <div class="content">
      <h2 style="margin-top:0;color:#e4e4e7;">Hi ${name},</h2>
      <p style="color:#a1a1aa;line-height:1.6;">
        Unfortunately, your admin access request for SwapSmith was not approved at this time.
      </p>
      ${reason ? `<p style="color:#71717a;font-size:14px;"><strong>Reason:</strong> ${reason}</p>` : ''}
      <p style="color:#a1a1aa;">If you believe this is a mistake, please contact the platform team.</p>
    </div>
    <div class="footer"><p>SwapSmith · Admin System</p></div>
  </div>
</body>
</html>
  `;
  await sendBrevoEmail(to, '❌ Admin Request Update – SwapSmith', html);
}
