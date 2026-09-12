import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { dbStore } from '../db';
import { getAuthUser, sanitizeUser, JWT_SECRET, JWT_EXPIRES_IN, SEED_DEMO_PASSWORD_HASH } from '../auth';
import { authRateLimiter } from '../config';

export function registerAuthRoutes(app: express.Express) {
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
      {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        schoolId: user.schoolId,
        stateCode: user.stateCode,
        districtCode: user.districtCode,
        blockCode: user.blockCode,
        assignedSchools: user.assignedSchools,
      },
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
