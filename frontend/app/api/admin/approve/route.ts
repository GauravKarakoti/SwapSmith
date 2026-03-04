import { NextRequest } from 'next/server';
import {
  getPendingRequestByToken,
  approveAdminRequest,
  rejectAdminRequest,
  createAdminUser,
  getAdminByEmail,
} from '@/lib/admin-service';
import {
  sendAdminApprovedEmail,
  sendAdminRejectedEmail,
} from '@/lib/admin-email';

const MASTER_ADMIN_EMAIL = process.env.ADMIN_MASTER_EMAIL || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * GET /api/admin/approve?token=xxx&action=approve|reject
 * Called via email link by the master admin.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token  = searchParams.get('token');
  const action = searchParams.get('action'); // 'approve' | 'reject'

  if (!token || !action || !['approve', 'reject'].includes(action)) {
    return new Response(renderPage('error', 'Invalid request. Missing token or action.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    const request = await getPendingRequestByToken(token);
    if (!request) {
      return new Response(renderPage('error', 'This token is invalid, expired, or has already been used.'), {
        status: 410,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const reviewerEmail = MASTER_ADMIN_EMAIL;

    if (action === 'approve') {
      // Check not already an admin
      const existing = await getAdminByEmail(request.email);
      if (!existing) {
        await approveAdminRequest(token, reviewerEmail);
        await createAdminUser({
          firebaseUid: request.firebaseUid,
          email:       request.email,
          name:        request.name,
          approvedBy:  reviewerEmail,
        });
        await sendAdminApprovedEmail(request.email, request.name);
      }
      return new Response(
        renderPage('success', `✅ Access approved for ${request.name} (${request.email}). An email has been sent to them.`),
        { headers: { 'Content-Type': 'text/html' } }
      );
    } else {
      await rejectAdminRequest(token, reviewerEmail);
      await sendAdminRejectedEmail(request.email, request.name);
      return new Response(
        renderPage('rejected', `❌ Request from ${request.name} (${request.email}) has been rejected.`),
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
  } catch (err) {
    console.error('[Admin Approve API]', err);
    return new Response(renderPage('error', 'Internal server error. Please try again.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

function renderPage(type: 'success' | 'rejected' | 'error', message: string) {
  const colors = {
    success:  { bg: '#14532d', icon: '✅', title: 'Request Approved' },
    rejected: { bg: '#450a0a', icon: '❌', title: 'Request Rejected' },
    error:    { bg: '#1c1917', icon: '⚠️', title: 'Error' },
  };
  const c = colors[type];
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Admin Action – SwapSmith</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#09090b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    .card{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:48px 40px;max-width:480px;text-align:center;}
    .icon{font-size:56px;margin-bottom:16px;}
    .header{background:${c.bg};padding:20px;border-radius:10px;margin-bottom:24px;}
    .header h1{font-size:22px;color:white;}
    .msg{color:#a1a1aa;line-height:1.6;font-size:15px;}
    .btn{display:inline-block;margin-top:28px;background:#2563eb;color:white;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${c.icon}</div>
    <div class="header"><h1>${c.title}</h1></div>
    <p class="msg">${message}</p>
    <a href="${APP_URL}/admin/dashboard" class="btn">Go to Dashboard</a>
  </div>
</body>
</html>`;
}
