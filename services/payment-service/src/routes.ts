import type { Router } from '@penyzen/lambda-router';
import { requireAuth } from './middleware/requireAuth';
import * as donationCtrl from './controllers/donation.controller';
import * as connectCtrl from './controllers/connect.controller';
import * as webhookCtrl from './controllers/webhook.controller';

export function registerRoutes(router: Router): void {
  // ── Donations ──────────────────────────────────────────────────────────────
  router.post('/v1/donations', requireAuth, donationCtrl.createDonation);
  router.get('/v1/donations/{donationId}', requireAuth, donationCtrl.getDonation);
  router.get('/v1/users/me/donations', requireAuth, donationCtrl.listMyDonations);
  router.get('/v1/campaigns/{campaignId}/donations', donationCtrl.listCampaignDonations); // public

  // ── Stripe Connect ─────────────────────────────────────────────────────────
  router.post('/v1/connect/onboard', requireAuth, connectCtrl.onboard);
  router.get('/v1/connect/status', requireAuth, connectCtrl.getStatus);
  router.get('/v1/connect/dashboard-link', requireAuth, connectCtrl.getDashboardLink);

  // ── Stripe Webhooks (no auth — verified by Stripe signature) ───────────────
  router.post('/v1/webhooks/stripe', webhookCtrl.stripeWebhook);
}
