/**
 * Admin notification hook for certification transitions (SRS R-7, Phase 6).
 *
 * Called from `certificationRecords.ts` when a `Certification` row transitions
 * from `active` to `review_needed`. Fires two notifications in parallel:
 *
 *   1. In-app logbook entry — always written via `dbStore.addLog()`. Visible
 *      to Admin / Block Admin / Superadmin via `/api/logbook`.
 *   2. Email to all SUPERADMIN + ADMIN users — sent via nodemailer when
 *      SMTP_HOST is set; otherwise the email payload is logged to stdout
 *      for inspection (so the demo runs end-to-end without SMTP credentials).
 *
 * Both calls are fire-and-forget — failures are logged but never block the
 * cert transition itself. The notification is observability, not a hard gate.
 */
import { dbStore, Certification, UserRole } from '../../../db';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'fln-cert-bot@fln.org';

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

/**
 * Return every SUPERADMIN / ADMIN user's email. These are the roles the
 * Certification Reviews panel is gated to, so they're the right recipients
 * for review-needed alerts.
 */
export async function getAdminEmails(): Promise<string[]> {
  try {
    const users = await dbStore.getUsers();
    return users
      .filter((u) => u.role === UserRole.SUPERADMIN || u.role === UserRole.ADMIN)
      .map((u) => u.email);
  } catch (err) {
    console.error('[cert-notify] failed to load admin emails:', err);
    return [];
  }
}

/**
 * Build a human-readable email payload describing the cert that needs review.
 */
export function buildEmailPayload(cert: Certification, reason: string): EmailPayload {
  return {
    to: '(recipients resolved by sendEmail)',
    subject: `[FLN] Certification needs review — student ${cert.studentId} (class ${cert.classNumber})`,
    body: [
      `A student's certification has been flagged for admin review.`,
      ``,
      `Student ID:    ${cert.studentId}`,
      `Class / level: ${cert.classNumber} / ${cert.level}`,
      `Cert ID:       ${cert.id}`,
      `Reason:        ${reason}`,
      ``,
      `Review at:     POST /api/certification/review/${cert.id}`,
      `              (decision: 'confirm' | 'revoke')`,
      ``,
      `— FLN certification engine`,
    ].join('\n'),
  };
}

/**
 * Send an email. With SMTP configured, this would use nodemailer. Without
 * it, we log the payload to stdout so the demo still shows the notification
 * firing. Either path satisfies the "admin is notified" contract for tests.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!SMTP_HOST) {
    console.log(`[cert-notify] (no SMTP configured) email payload:`);
    console.log(`  to:      ${payload.to}`);
    console.log(`  subject: ${payload.subject}`);
    return;
  }
  // Real SMTP path — wired but unused in dev. Production deployments set
  // SMTP_HOST etc. in backend/.env and this branch activates.
  try {
    // Lazy-require so dev installs without nodemailer don't crash.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
    await transporter.sendMail({
      from: SMTP_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
    });
    console.log(`[cert-notify] email sent to ${payload.to}`);
  } catch (err) {
    console.error(`[cert-notify] SMTP send failed for ${payload.to}:`, err);
  }
}

/**
 * Main entry — fire both notifications when a cert transitions to
 * `review_needed`. Never throws; logs and continues on error.
 */
export async function notifyCertificationReviewNeeded(
  cert: Certification,
  reason: string
): Promise<void> {
  const stamp = new Date().toISOString();
  console.log(`[cert-notify] cert ${cert.id} for student ${cert.studentId} needs review: ${reason}`);

  // 1. In-app logbook entry — visible in the admin Logbook view.
  try {
    await dbStore.addLog({
      id: `log_cert_review_${cert.id}_${Date.now()}`,
      timestamp: stamp,
      schoolId: '',
      schoolName: 'Certification Engine',
      userId: 'system',
      userEmail: 'system@fln.org',
      userRole: UserRole.SUPERADMIN, // system-emitted; logged as superadmin for visibility
      activityType: 'verify',
      status: 'Success',
      details: `[cert-notify] cert ${cert.id} for student ${cert.studentId} (class ${cert.classNumber}, level ${cert.level}) transitioned to review_needed — ${reason}`,
    });
  } catch (err) {
    console.error('[cert-notify] logbook write failed:', err);
  }

  // 2. Email to all admins — fire-and-forget per recipient.
  const recipients = await getAdminEmails();
  if (recipients.length === 0) {
    console.log('[cert-notify] no admin recipients found; skipping email');
    return;
  }
  const basePayload = buildEmailPayload(cert, reason);
  await Promise.all(
    recipients.map((email) => sendEmail({ ...basePayload, to: email }))
  );
}