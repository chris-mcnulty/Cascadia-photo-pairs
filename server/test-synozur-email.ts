import { sendEmailViaSendGrid } from './sendgrid';

export async function sendTestEmailToSynozur(): Promise<boolean> {
  const email = 'chris.mcnulty@synozur.com';
  const subject = 'Cascadia Oceanic - Email Verification (Test)';
  
  // Simpler HTML that's less likely to trigger spam filters
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <p>Hello Chris,</p>
      
      <p>This is a test email from Cascadia Oceanic Photo Voting App to verify email delivery to Synozur.</p>
      
      <p>If you receive this email, it means SendGrid is working correctly with your Synozur email address.</p>
      
      <p>Your verification link would normally appear here.</p>
      
      <p>Best regards,<br>
      Cascadia Oceanic Team</p>
      
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
      <p style="font-size: 12px; color: #666;">
        This email was sent from cascadia@chrismcnulty.net via SendGrid.
      </p>
    </div>
  `;
  
  const success = await sendEmailViaSendGrid(email, subject, html);
  console.log(`Test email to Synozur: ${success ? 'Sent successfully' : 'Failed'}`);
  return success;
}