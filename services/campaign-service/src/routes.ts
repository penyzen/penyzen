import type { Router } from '@penyzen/lambda-router';
import { requireAuth } from './middleware/requireAuth';
import * as campaignCtrl from './controllers/campaign.controller';
import * as milestoneCtrl from './controllers/milestone.controller';
import * as updateCtrl from './controllers/update.controller';

export function registerRoutes(router: Router): void {
  // ── Campaigns ──────────────────────────────────────────────────────────────
  router.get('/v1/campaigns', campaignCtrl.listCampaigns);                              // public
  router.post('/v1/campaigns', requireAuth, campaignCtrl.createCampaign);
  router.get('/v1/campaigns/{campaignId}', campaignCtrl.getCampaign);                   // public
  router.patch('/v1/campaigns/{campaignId}', requireAuth, campaignCtrl.updateCampaign);
  router.delete('/v1/campaigns/{campaignId}', requireAuth, campaignCtrl.deleteCampaign);
  router.post('/v1/campaigns/{campaignId}/publish', requireAuth, campaignCtrl.publishCampaign);
  router.post('/v1/campaigns/{campaignId}/unpublish', requireAuth, campaignCtrl.unpublishCampaign);
  router.post('/v1/campaigns/{campaignId}/media-upload-url', requireAuth, campaignCtrl.getMediaUploadUrl);

  // ── User's own campaigns ───────────────────────────────────────────────────
  router.get('/v1/users/me/campaigns', requireAuth, campaignCtrl.listMyCampaigns);

  // ── Milestones ─────────────────────────────────────────────────────────────
  router.get('/v1/campaigns/{campaignId}/milestones', milestoneCtrl.listMilestones);    // public
  router.post('/v1/campaigns/{campaignId}/milestones', requireAuth, milestoneCtrl.createMilestone);
  router.patch('/v1/campaigns/{campaignId}/milestones/{milestoneId}', requireAuth, milestoneCtrl.updateMilestone);
  router.delete('/v1/campaigns/{campaignId}/milestones/{milestoneId}', requireAuth, milestoneCtrl.deleteMilestone);

  // ── Campaign updates ───────────────────────────────────────────────────────
  router.get('/v1/campaigns/{campaignId}/updates', updateCtrl.listUpdates);             // public
  router.post('/v1/campaigns/{campaignId}/updates', requireAuth, updateCtrl.createUpdate);
}
