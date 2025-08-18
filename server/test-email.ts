import { sendEmailViaSendGrid } from './sendgrid';

// Test email function
export async function sendTestEmail(recipientEmail: string): Promise<boolean> {
  const subject = 'Test Email from Cascadia Oceanic';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2d5f3f;">SendGrid Email Test Successful!</h2>
      <p>This is a test email from your Cascadia Oceanic Photo Voting App.</p>
      <p>Your SendGrid integration is working correctly with the verified sender:</p>
      <p style="background: #f5f5f5; padding: 10px; border-radius: 5px;">
        <strong>From:</strong> cascadia@chrismcnulty.net
      </p>
      <p>Email features now available:</p>
      <ul>
        <li>Welcome emails for new users</li>
        <li>Password reset emails</li>
        <li>Email verification</li>
        <li>Contest winner notifications</li>
      </ul>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 14px;">
        Cascadia Oceanic - Images of the Pacific & Atlantic coasts, and the land in between.
      </p>
    </div>
  `;
  
  return await sendEmailViaSendGrid(recipientEmail, subject, html);
}