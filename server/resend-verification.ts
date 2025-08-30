import { db } from './db';
import { users, emailVerifications } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function resendVerificationEmail(email: string): Promise<boolean> {
  try {
    // Find the user
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (!user) {
      console.log(`User not found: ${email}`);
      return false;
    }

    if (user.emailVerified) {
      console.log(`User already verified: ${email}`);
      return true;
    }

    // Delete any existing verification tokens for this user
    await db.delete(emailVerifications).where(eq(emailVerifications.userId, user.id));

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Insert new verification token
    await db.insert(emailVerifications).values({
      userId: user.id,
      token: verificationToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Send verification email via SendGrid
    const { sendEmailViaSendGrid } = await import('./sendgrid');
    
    // Always use the production URL for email links
    const baseUrl = process.env.BASE_URL || "https://photo-pairs.chrismcnulty.net";
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5f3f;">Welcome to Cascadia Oceanic Photo Pairs!</h2>
        <p>Thank you for signing up. Please verify your email address to complete your registration.</p>
        <div style="margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #2d5f3f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${verificationUrl}" style="color: #2d5f3f;">${verificationUrl}</a>
        </p>
        <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
      </div>
    `;

    const success = await sendEmailViaSendGrid(email, "Verify your Cascadia Oceanic account", html);
    
    if (success) {
      console.log(`Verification email sent to ${email}`);
    } else {
      console.error(`Failed to send verification email to ${email}`);
    }
    
    return success;
  } catch (error) {
    console.error('Error resending verification email:', error);
    return false;
  }
}