import nodemailer from 'nodemailer';

export interface EmailNotification {
  to: string;
  subject: string;
  html: string;
  type: 'wallet' | 'price' | 'general';
}

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

// Email templates
const templates = {
  walletReminder: (userName: string) => ({
    subject: '🔗 Connect Your Wallet - SwapSmith',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e4e4e7; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; color: white; font-size: 28px; }
            .content { background: #18181b; padding: 30px; border-radius: 12px; border: 1px solid #27272a; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #71717a; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚡ SwapSmith</h1>
            </div>
            <div class="content">
              <h2 style="margin-top: 0; color: #e4e4e7;">Hi ${userName}! 👋</h2>
              <p style="color: #a1a1aa; line-height: 1.6;">
                We noticed you haven't connected your wallet yet. Connect your wallet to unlock the full power of SwapSmith:
              </p>
              <ul style="color: #a1a1aa; line-height: 1.8;">
                <li>🔄 Execute AI-powered crypto swaps</li>
                <li>💰 Track your portfolio in real-time</li>
                <li>📊 Get personalized yield recommendations</li>
                <li>⚡ Lightning-fast transaction execution</li>
              </ul>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/terminal" class="button">Connect Wallet Now</a>
            </div>
            <div class="footer">
              <p>SwapSmith - AI-Powered Crypto Trading Terminal</p>
              <p style="font-size: 12px; margin-top: 10px;">You're receiving this because you have an account with SwapSmith.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  priceAlert: (cryptoName: string, price: string, change: string, userName: string) => ({
    subject: `📈 ${cryptoName} Price Update - SwapSmith`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e4e4e7; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; color: white; font-size: 28px; }
            .content { background: #18181b; padding: 30px; border-radius: 12px; border: 1px solid #27272a; }
            .price-card { background: #09090b; border: 1px solid #27272a; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .price { font-size: 32px; font-weight: bold; color: #2563eb; margin: 10px 0; }
            .change { display: inline-block; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 14px; }
            .change.positive { background: #10b98133; color: #10b981; }
            .change.negative { background: #ef444433; color: #ef4444; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #71717a; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚡ SwapSmith</h1>
            </div>
            <div class="content">
              <h2 style="margin-top: 0; color: #e4e4e7;">Hi ${userName}! 📊</h2>
              <p style="color: #a1a1aa; line-height: 1.6;">
                Here's your daily crypto price update:
              </p>
              <div class="price-card">
                <h3 style="margin-top: 0; color: #e4e4e7;">${cryptoName}</h3>
                <div class="price">$${price}</div>
                <span class="change ${parseFloat(change) >= 0 ? 'positive' : 'negative'}">
                  ${parseFloat(change) >= 0 ? '▲' : '▼'} ${Math.abs(parseFloat(change))}%
                </span>
              </div>
              <p style="color: #a1a1aa; line-height: 1.6;">
                Ready to make a move? Use our AI-powered terminal to execute smart swaps at the best rates.
              </p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/terminal" class="button">Trade Now</a>
            </div>
            <div class="footer">
              <p>SwapSmith - AI-Powered Crypto Trading Terminal</p>
              <p style="font-size: 12px; margin-top: 10px;">You're receiving this because you enabled price notifications.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  generalNotification: (title: string, message: string, userName: string, ctaText?: string, ctaUrl?: string) => ({
    subject: `🔔 ${title} - SwapSmith`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e4e4e7; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; color: white; font-size: 28px; }
            .content { background: #18181b; padding: 30px; border-radius: 12px; border: 1px solid #27272a; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #71717a; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚡ SwapSmith</h1>
            </div>
            <div class="content">
              <h2 style="margin-top: 0; color: #e4e4e7;">Hi ${userName}! 👋</h2>
              <p style="color: #a1a1aa; line-height: 1.6;">${message}</p>
              ${ctaText && ctaUrl ? `<a href="${ctaUrl}" class="button">${ctaText}</a>` : ''}
            </div>
            <div class="footer">
              <p>SwapSmith - AI-Powered Crypto Trading Terminal</p>
              <p style="font-size: 12px; margin-top: 10px;">You're receiving this because you have an account with SwapSmith.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),
};

// Send email function
export async function sendEmail(notification: EmailNotification) {
  try {
    const transporter = createTransporter();
    
    const info = await transporter.sendMail({
      from: `"SwapSmith" <${process.env.EMAIL_USER}>`,
      to: notification.to,
      subject: notification.subject,
      html: notification.html,
    });

    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper functions to send specific notification types
export async function sendWalletReminderEmail(userEmail: string, userName: string) {
  const template = templates.walletReminder(userName);
  return sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html,
    type: 'wallet',
  });
}

export async function sendPriceAlertEmail(
  userEmail: string,
  userName: string,
  cryptoName: string,
  price: string,
  change: string
) {
  const template = templates.priceAlert(cryptoName, price, change, userName);
  return sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html,
    type: 'price',
  });
}

export async function sendGeneralNotification(
  userEmail: string,
  userName: string,
  title: string,
  message: string,
  ctaText?: string,
  ctaUrl?: string
) {
  const template = templates.generalNotification(title, message, userName, ctaText, ctaUrl);
  return sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html,
    type: 'general',
  });
}
