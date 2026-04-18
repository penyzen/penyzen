import type { Router } from '@penyzen/lambda-router';
import { requireAuth } from './middleware/requireAuth';
import * as authCtrl from './controllers/auth.controller';
import * as userCtrl from './controllers/user.controller';
import * as orgCtrl from './controllers/org.controller';
import * as kycCtrl from './controllers/kyc.controller';

export function registerRoutes(router: Router): void {
  // ── Auth (public) ──────────────────────────────────────────────────────────
  router.post('/v1/auth/register', authCtrl.register);
  router.post('/v1/auth/confirm', authCtrl.confirmRegistration);
  router.post('/v1/auth/login', authCtrl.login);
  router.post('/v1/auth/refresh', authCtrl.refreshToken);
  router.post('/v1/auth/forgot-password', authCtrl.forgotPassword);
  router.post('/v1/auth/reset-password', authCtrl.resetPassword);

  // ── Auth (protected) ───────────────────────────────────────────────────────
  router.post('/v1/auth/logout', requireAuth, authCtrl.logout);

  // ── Users ──────────────────────────────────────────────────────────────────
  router.get('/v1/users/me', requireAuth, userCtrl.getMe);
  router.patch('/v1/users/me', requireAuth, userCtrl.updateMe);
  router.get('/v1/users/{userId}', requireAuth, userCtrl.getUser);

  // ── Organizations ──────────────────────────────────────────────────────────
  router.post('/v1/organizations', requireAuth, orgCtrl.createOrg);
  router.get('/v1/organizations/mine', requireAuth, orgCtrl.listMyOrgs);
  router.get('/v1/organizations/{orgId}', requireAuth, orgCtrl.getOrg);
  router.patch('/v1/organizations/{orgId}', requireAuth, orgCtrl.updateOrg);
  router.post('/v1/organizations/{orgId}/members', requireAuth, orgCtrl.addMember);
  router.delete('/v1/organizations/{orgId}/members/{userId}', requireAuth, orgCtrl.removeMember);

  // ── KYC ────────────────────────────────────────────────────────────────────
  router.post('/v1/kyc/start', requireAuth, kycCtrl.startKyc);
  router.get('/v1/kyc/status', requireAuth, kycCtrl.getKycStatus);
  router.post('/v1/kyc/webhook', kycCtrl.kycWebhook); // No auth — Stripe signature verified separately
}
