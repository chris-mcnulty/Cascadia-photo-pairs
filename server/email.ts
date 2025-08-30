import nodemailer from "nodemailer";
import type { SendMailOptions } from "nodemailer";

// Email configuration - can be set via environment variables
const EMAIL_HOST = process.env.EMAIL_HOST || "smtp.gmail.com";
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || "587");
const EMAIL_USER = process.env.EMAIL_USER || "";
const EMAIL_PASS = process.env.EMAIL_PASS || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "cascadia@chrismcnulty.net";

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_PORT === 465,
  auth: EMAIL_USER && EMAIL_PASS ? {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  } : undefined,
});

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    if (!EMAIL_USER || !EMAIL_PASS) {
      console.log("Email not configured - would send to:", to);
      console.log("Subject:", subject);
      console.log("Content:", html);
      return true; // In development, just log
    }

    const mailOptions: SendMailOptions = {
      from: EMAIL_FROM,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  // Use correct production domain - check both possible domains
  const baseUrl = process.env.BASE_URL || "https://photo-pairs.chrismcnulty.net";
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  
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

  // Use SendGrid if available, otherwise fall back to nodemailer
  const { sendEmailViaSendGrid } = await import('./sendgrid');
  return await sendEmailViaSendGrid(email, "Verify your Cascadia Oceanic account", html);
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  // Use correct production domain - check both possible domains  
  const baseUrl = process.env.BASE_URL || "https://photo-pairs.chrismcnulty.net";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2d5f3f;">Password Reset Request</h2>
      <p>We received a request to reset your password for your Cascadia Oceanic account.</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="margin: 0 0 10px 0; color: #666;">Your password reset code is:</p>
        <h1 style="color: #2d5f3f; margin: 10px 0; font-size: 36px; letter-spacing: 5px;">${token}</h1>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">This code expires in 1 hour</p>
      </div>
      
      <p>You can enter this code on the password reset page, or click the button below:</p>
      
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
      <p style="color: #666; font-size: 14px;">If you didn't request this reset, you can safely ignore this email.</p>
    </div>
  `;

  // Use SendGrid if available, otherwise fall back to nodemailer
  const { sendEmailViaSendGrid } = await import('./sendgrid');
  return await sendEmailViaSendGrid(email, "Reset your Cascadia Oceanic password", html);
}

export async function sendWelcomeEmail(email: string, firstName?: string): Promise<boolean> {
  const name = firstName || "Photo Enthusiast";
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2d5f3f;">Welcome to Cascadia Oceanic Photo Pairs, ${name}!</h2>
      <p>Your account has been successfully created and verified.</p>
      
      <h3 style="color: #2d5f3f;">Here's what you can do:</h3>
      <ul style="line-height: 1.8;">
        <li>Vote on beautiful landscape photography pairs</li>
        <li>Track your voting statistics and favorites</li>
        <li>Enter monthly and quarterly contests to win free prints</li>
        <li>Build your personal collection of favorite photos</li>
      </ul>
      
      <div style="margin: 30px 0;">
        <a href="${process.env.APP_URL || "http://localhost:5000"}" 
           style="background-color: #2d5f3f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Start Voting Now
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        If you have any questions, feel free to reach out to our support team.
      </p>
    </div>
  `;

  return sendEmail(email, "Welcome to Cascadia Oceanic!", html);
}

export async function sendContestWinnerEmail(email: string, firstName: string, contestType: string, period: string): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2d5f3f;">🎉 Congratulations, ${firstName}!</h2>
      <p style="font-size: 18px;">You've won the ${contestType} voting contest for ${period}!</p>
      
      <div style="background-color: #f0f8f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; font-size: 16px;">
          As our top voter, you've earned a <strong>free print of your choice</strong> from our gallery!
        </p>
      </div>
      
      <p>To claim your prize:</p>
      <ol style="line-height: 1.8;">
        <li>Browse our photo collection</li>
        <li>Choose your favorite image</li>
        <li>Reply to this email with your selection and shipping address</li>
      </ol>
      
      <div style="margin: 30px 0;">
        <a href="${process.env.APP_URL || "http://localhost:5000"}/leaderboard" 
           style="background-color: #2d5f3f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Leaderboard
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        Thank you for being an active member of our community!
      </p>
    </div>
  `;

  return sendEmail(email, `🏆 You won the ${contestType} contest!`, html);
}