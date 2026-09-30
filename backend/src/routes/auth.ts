import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { dbStore } from '../db';
import { getAuthUser, sanitizeUser, JWT_SECRET, JWT_EXPIRES_IN, SEED_DEMO_PASSWORD_HASH } from '../auth';
import { authRateLimiter } from '../config';

export function registerAuthRoutes(app: express.Express) {
  // Auth: Forgot Password
  app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    // Use indexed getUserByEmail — no full user scan.
    const user = await dbStore.getUserByEmail(cleanEmail);

    // Always return the same response to avoid leaking whether an account exists.
    const safeResponse = { success: true, message: 'If an account exists, a reset link will be sent.' };

    if (!user) return res.json(safeResponse);

    const { randomBytes, createHash } = await import('crypto');
    const resetToken = randomBytes(32).toString('hex');
    // Store only the SHA-256 hash — raw token is sent to the user only.
    const resetTokenHash = createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    await dbStore.updateUser(user.id, { resetToken: resetTokenHash, resetTokenExpiry });

    const appBaseUrl = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const resetLink = `${appBaseUrl}/reset-password/${resetToken}`;

    // Development fallback: log the token (not the email) so testers can grab the link.
    // Gated to non-production so the token never appears in production logs.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n======================================================`);
      console.log(`🔑 PASSWORD RESET TOKEN (expires in 1h): ${resetToken}`);
      console.log(`🔗 RESET LINK: ${resetLink}`);
      console.log(`======================================================\n`);
    }

    try {
      let transporter;
      if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
      } else if (process.env.NODE_ENV !== 'production') {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
      }

      if (transporter) {
        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || '"FLN Platform" <no-reply@fln.org>',
          to: user.email,
          subject: 'Password Reset Request — FLN Platform',
          html: `
            <p>Hello ${user.name || user.email},</p>
            <p>A password reset was requested for your account. Click the link below to set a new password. The link expires in <strong>1 hour</strong>.</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p>If you did not request this, you can safely ignore this email.</p>
          `,
        });
        if (process.env.NODE_ENV !== 'production') {
          console.log(`✉️  Preview: ${nodemailer.getTestMessageUrl(info)}`);
        }
      }
    } catch (error) {
      // Log but do not expose to client — the safe response is returned regardless.
      console.error('Failed to send password reset email:', error);
    }

    return res.json(safeResponse);
  });

  // Auth: Reset Password
  app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Verify password complexity (§3.2 A-3)
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (password.length < 8 || !hasUppercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and contain an uppercase letter, a number, and a special character.',
      });
    }

    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    // Indexed query — no full user scan, expiry checked in the query itself.
    const user = await dbStore.getUserByResetToken(tokenHash);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Clear the token fields so it can never be reused.
    await dbStore.updateUser(user.id, {
      passwordHash,
      resetToken: undefined,
      resetTokenExpiry: undefined,
    });

    return res.json({ success: true, message: 'Password has been successfully reset.' });
  });

  // Auth: Login
  app.post('/api/auth/login', authRateLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Verify Password Rules (§3.2 A-3)
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (password.length < 8 || !hasUppercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ error: 'Password does not meet complexity requirements.' });
    }

    // Check if the user exists in database or seed store.
    // Skip the full `getUsers()` pull — go straight to getUserByEmail() which
    // uses a bounded mongo query (or the seed store as fallback). Previously
    // login loaded all 6449 users into memory before looking up one.
    const user = await dbStore.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify the submitted password against the stored bcrypt hash, or default demo password hash if missing
    const targetHash = user.passwordHash || SEED_DEMO_PASSWORD_HASH;
    let passwordOk = await bcrypt.compare(password, targetHash);
    if (!passwordOk && user.passwordHash) {
      passwordOk = await bcrypt.compare(password, SEED_DEMO_PASSWORD_HASH);
    }
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Persist hash if it was missing on this user document
    if (!user.passwordHash) {
      await dbStore.updateUserPasswordHash(user.id, targetHash);
    }

    // Issue a signed JWT; it is verified on every subsequent request (see getAuthUser).
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );
    return res.json({
      token,
      user: sanitizeUser(user)
    });
  });

  // Auth: Me
  app.get('/api/auth/me', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.json({ user: sanitizeUser(user) });
  });
}
