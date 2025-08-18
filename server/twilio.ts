import twilio from 'twilio';

// Check if Twilio is configured
const twilioConfigured = !!(
  process.env.TWILIO_ACCOUNT_SID && 
  process.env.TWILIO_AUTH_TOKEN && 
  process.env.TWILIO_PHONE_NUMBER
);

let twilioClient: any = null;

if (twilioConfigured) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );
  console.log('Twilio configured for SMS sending');
} else {
  console.log('Twilio credentials not configured - SMS features will be disabled');
}

// Twilio SMS sending function
export async function sendSMS(
  phoneNumber: string,
  message: string
): Promise<boolean> {
  if (!twilioConfigured || !twilioClient) {
    console.log(`[Twilio Not Configured] Would send SMS to: ${phoneNumber}`);
    console.log(`Message: ${message}`);
    return false;
  }

  try {
    // Ensure phone number is in E.164 format
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}`;
    
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });
    
    console.log(`SMS sent successfully via Twilio to: ${formattedPhone}, SID: ${result.sid}`);
    return true;
  } catch (error: any) {
    console.error('Twilio SMS error:', error);
    if (error.message) {
      console.error('Twilio error details:', error.message);
    }
    return false;
  }
}

// Send 2FA verification code via SMS
export async function send2FACode(
  phoneNumber: string,
  code: string
): Promise<boolean> {
  const message = `Your Cascadia Oceanic admin verification code is: ${code}. This code expires in 5 minutes.`;
  return sendSMS(phoneNumber, message);
}

// Send contest winner notification via SMS
export async function sendContestWinnerSMS(
  phoneNumber: string,
  userName: string,
  contestQuarter: string
): Promise<boolean> {
  const message = `Congratulations ${userName}! You've won the ${contestQuarter} Cascadia Oceanic photo contest! Check your email for details.`;
  return sendSMS(phoneNumber, message);
}

// Test SMS function
export async function sendTestSMS(phoneNumber: string): Promise<boolean> {
  const message = 'Test SMS from Cascadia Oceanic. Your Twilio integration is working correctly!';
  return sendSMS(phoneNumber, message);
}

export function isSMSConfigured(): boolean {
  return twilioConfigured;
}