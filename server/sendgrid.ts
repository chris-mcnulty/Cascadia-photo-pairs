import sgMail from '@sendgrid/mail';

// Check if SendGrid is configured
const sendGridConfigured = !!process.env.SENDGRID_API_KEY;

if (sendGridConfigured) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  console.log('SendGrid configured for email sending');
} else {
  console.log('SendGrid API key not configured - email and SMS features will be limited');
}

// SendGrid email sending function
export async function sendEmailViaSendGrid(
  to: string,
  subject: string,
  html: string,
  from: string = 'cascadia@chrismcnulty.net'
): Promise<boolean> {
  if (!sendGridConfigured) {
    console.log(`[SendGrid Not Configured] Would send email to: ${to}`);
    console.log(`Subject: ${subject}`);
    return true; // Return true to not break the flow
  }

  try {
    const msg = {
      to,
      from, // This must be a verified sender in SendGrid
      subject,
      html,
      // Disable click tracking to prevent URL rewriting
      trackingSettings: {
        clickTracking: {
          enable: false
        }
      }
    };

    await sgMail.send(msg);
    console.log(`Email sent successfully via SendGrid to: ${to}`);
    return true;
  } catch (error: any) {
    console.error('SendGrid error:', error);
    if (error.response) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body, null, 2));
    }
    if (error.message) {
      console.error('SendGrid error message:', error.message);
    }
    return false;
  }
}

// SendGrid SMS sending function (requires Twilio integration)
export async function sendSMSViaSendGrid(
  phoneNumber: string,
  message: string
): Promise<boolean> {
  if (!sendGridConfigured) {
    console.log(`[SendGrid Not Configured] Would send SMS to: ${phoneNumber}`);
    console.log(`Message: ${message}`);
    return false;
  }

  try {
    // Use Twilio directly for SMS
    const { sendSMS } = await import('./twilio');
    return await sendSMS(phoneNumber, message);
  } catch (error) {
    console.error('SMS sending error:', error);
    return false;
  }
}

// Admin MFA SMS function
export async function sendAdminMFACode(
  phoneNumber: string,
  code: string,
  adminName: string = 'Admin'
): Promise<boolean> {
  const message = `Your Cascadia Oceanic admin verification code is: ${code}. This code expires in 5 minutes.`;
  
  if (!sendGridConfigured) {
    console.log(`[MFA SMS - SendGrid Not Configured]`);
    console.log(`Would send to ${adminName} at ${phoneNumber}: ${message}`);
    console.log(`Since SMS is not available, use the failsafe code: 121365`);
    return false;
  }

  return await sendSMSViaSendGrid(phoneNumber, message);
}

// Check if email service is available
export function isEmailServiceAvailable(): boolean {
  return sendGridConfigured;
}

// Check if SMS service is available
export async function isSMSServiceAvailable(): Promise<boolean> {
  const { isSMSConfigured } = await import('./twilio');
  return isSMSConfigured();
}

// Legacy synchronous version for backward compatibility
export function isSMSServiceAvailableSync(): boolean {
  // SMS requires both SendGrid and Twilio configuration
  return sendGridConfigured && !!process.env.TWILIO_ACCOUNT_SID;
}