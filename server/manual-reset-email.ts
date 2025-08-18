import { sendEmailViaSendGrid } from './sendgrid';

export async function sendManualPasswordResetEmail(email: string, resetCode: string): Promise<boolean> {
  // Always use the production URL for email links
  const baseUrl = "https://cascadia-oceanic-photo-voting-app.replit.app";
  
  const resetUrl = `${baseUrl}/reset-password?token=${resetCode}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2d5f3f;">Password Reset Code</h2>
      
      <p>Hi Chris,</p>
      
      <p>You requested to reset your password for your Cascadia Oceanic account.</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="margin: 0 0 10px 0; color: #666;">Your reset code is:</p>
        <h1 style="color: #2d5f3f; margin: 10px 0; font-size: 36px; letter-spacing: 5px;">${resetCode}</h1>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">This code expires in 1 hour</p>
      </div>
      
      <p>You can also click the button below to reset your password directly:</p>
      
      <div style="margin: 30px 0; text-align: center;">
        <a href="${resetUrl}" 
           style="background-color: #2d5f3f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${resetUrl}" style="color: #2d5f3f; word-break: break-all;">${resetUrl}</a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      
      <p style="color: #999; font-size: 12px;">
        If you didn't request this reset, you can safely ignore this email.
      </p>
    </div>
  `;
  
  const success = await sendEmailViaSendGrid(
    email, 
    "Password Reset Code: " + resetCode, 
    html
  );
  
  console.log(`Password reset email sent to ${email}: ${success ? 'Success' : 'Failed'}`);
  return success;
}