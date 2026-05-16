# MLW Implementation Breakdown — College-Launch Vertical

Concrete engineering plan for the Minimum Lovable Wedge:
**Verified Organizer + Direct-to-Institution Disbursement + Public
Fund-Usage Ledger**, mapped to the actual codebase.

Created: 2026-05-16. Companions: [`business-strategy.md`](./business-strategy.md),
[`gtm-college-launch.md`](./gtm-college-launch.md).

---

## 0. The core architectural shift (read this first)

The single biggest finding from the code: **the current money flow is
the opposite of what this vertical needs.**

Today (`services/payment-service/src/services/donation.service.ts`):
- `createDonation()` creates a Stripe PaymentIntent with
  `transfer_data.destination = campaign.organizer.stripeAccountId` and an
  `application_fee_amount`. This is a **Stripe Connect destination
  charge** — money lands in the *organizer's personal Express account*
  and Stripe pays it out to *their personal bank* on a daily schedule
  (`connect.service.ts`, `settings.payouts.schedule.interval: 'daily'`).
- That is exactly the "money hits a personal bank account" model the
  trust wedge exists to eliminate.

For the college-launch MLW we must invert this:
- Funds are **charged to the platform account and held** (no
  `transfer_data` to a personal account).
- Funds are **disbursed to a verified institution** (the school), never
  to the student/organizer.
- Every movement is recorded in an **immutable public ledger**.

This is a real money-flow rearchitecture, not a feature toggle, and it's
the same change that triggers the **money-transmitter / custodial-funds
compliance** question flagged in `business-strategy.md` §0/§6. Counsel
must run in parallel from day one.

**v1 vs v2 cut (decide up front):**
- **v1 (pilot, weeks):** platform holds funds; disbursement to the
  institution is **assisted/manual** (operator initiates ACH/check
  against held balance using the verified-payee instructions) but every
  step is *recorded* in the `Disbursement` + ledger models. Fully real
  to the donor and the school; just not yet automated.
- **v2 (scale):** automated ACH disbursement (Stripe payouts to a
  platform-owned institution payee, or a dedicated ACH provider).

Build v1. The models below are designed so v2 is a swap of the
disbursement *executor*, not a schema change.

---

## 1. Workstream A — Verified Organizer (smallest; mostly exists)

Already built: `user-service/src/services/kyc.service.ts`
(`startKyc`/`getKycStatus`/`handleKycWebhookEvent`) using Stripe
Identity; `User.kycStatus` enum (`NOT_STARTED|PENDING|APPROVED|REJECTED`)
in `schema.prisma`.

Gaps to close:
1. **Expose** organizer KYC on campaign reads — add `organizer.kycStatus`
   (and a derived `isVerifiedOrganizer` boolean) to the campaign
   serializer in `campaign-service` (controllers/services that return a
   campaign).
2. **Display** a "Verified Organizer" badge in `apps/web`
   (`/campaigns/[id]` and the campaign card).
3. **Gate**: for `DIRECT_TO_INSTITUTION` campaigns, require
   `kycStatus === APPROVED` before the campaign can move
   `DRAFT → PUBLISHED` (enforce in the campaign publish path in
   `campaign-service`).

No schema change. Effort: small.

---

## 2. Workstream B — Data model (`packages/database/prisma/schema.prisma`)

New enums:
```prisma
enum DisbursementMode {
  ORGANIZER_PAYOUT      // legacy/default: existing Connect destination flow
  DIRECT_TO_INSTITUTION // new: platform-held, paid to a verified payee
}

enum PayeeType { EDUCATION  MEDICAL  FUNERAL  OTHER }

enum PayeeStatus { UNVERIFIED  VERIFIED  REJECTED }

enum DisbursementStatus { PENDING  APPROVED  SENT  CONFIRMED  FAILED  REFUNDED }

enum LedgerEntryType { DONATION_RECEIVED  DISBURSEMENT_SENT  REFUND  ADJUSTMENT }
```

New models:
```prisma
model Payee {                       // a verified institution
  id              String      @id @default(uuid())
  type            PayeeType
  name            String
  ein             String?
  // Payment instructions are sensitive — store encrypted / tokenized,
  // not raw bank numbers in plaintext.
  payInstructions Json
  status          PayeeStatus @default(UNVERIFIED)
  verifiedAt      DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  campaignPayees  CampaignPayee[]
  disbursements   Disbursement[]
  @@index([type, status])
}

model CampaignPayee {               // links a campaign to its institution
  id            String   @id @default(uuid())
  campaignId    String   @unique    // 1 payee per campaign for the MLW
  payeeId       String
  // e.g. student ID / bursar account ref the school needs to apply funds
  beneficiaryRef String?
  campaign      Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  payee         Payee    @relation(fields: [payeeId], references: [id])
  @@index([payeeId])
}

model Disbursement {
  id            String             @id @default(uuid())
  campaignId    String
  payeeId       String
  amountCents   Int
  status        DisbursementStatus @default(PENDING)
  method        String?            // "ACH" | "CHECK" | "stripe_payout"
  externalRef   String?            // ACH trace / check # / payout id
  proofUrl      String?            // receipt in the existing receipts S3 bucket
  initiatedById String?            // operator (v1) / system (v2)
  sentAt        DateTime?
  confirmedAt   DateTime?
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
  campaign      Campaign           @relation(fields: [campaignId], references: [id])
  payee         Payee              @relation(fields: [payeeId], references: [id])
  @@index([campaignId, status])
  @@index([payeeId])
}

model LedgerEntry {                 // append-only, public
  id            String          @id @default(uuid())
  campaignId    String
  type          LedgerEntryType
  amountCents   Int             // signed: + in, - out
  donationId    String?
  disbursementId String?
  proofUrl      String?
  occurredAt    DateTime        @default(now())
  campaign      Campaign        @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  @@index([campaignId, occurredAt])
}
```

`Campaign` additions:
```prisma
  disbursementMode  DisbursementMode @default(ORGANIZER_PAYOUT)
  heldAmountCents   Int              @default(0) // platform-held, not yet disbursed
  campaignPayee     CampaignPayee?
  disbursements     Disbursement[]
  ledgerEntries     LedgerEntry[]
```

Migration: regenerate `services/db-migrator/src/initial-schema.sql` via
`prisma migrate diff` and invoke the existing `penyzen-db-migrator-dev`
Lambda (process already documented in `deployment-log-2026-05-13.md` §3).

---

## 3. Workstream C — Direct-to-institution money flow (`payment-service`)

**C1. Branch the donation path** in `donation.service.ts` `createDonation()`:
- If `campaign.disbursementMode === ORGANIZER_PAYOUT` → existing code
  (unchanged; preserves legacy/other verticals).
- If `DIRECT_TO_INSTITUTION` → create the PaymentIntent **without**
  `transfer_data` (charge to the platform account; funds stay on the
  platform balance). Keep `application_fee`/fee accounting via the
  existing `calculatePlatformFee`/`calculateNetAmount` helpers.

**C2. On payment success** (`handlePaymentSucceeded`):
- Existing: flips donation → SUCCEEDED, increments
  `raisedAmountCents`/`donorCount`, `checkMilestones`.
- Add for DIRECT_TO_INSTITUTION: increment `campaign.heldAmountCents`,
  and **write a `LedgerEntry` (`DONATION_RECEIVED`, +amount)** in the
  same `prisma.$transaction`.

**C3. Disbursement service** (new
`payment-service/src/services/disbursement.service.ts`):
- `createDisbursement(campaignId)` — preconditions: campaign has a
  `VERIFIED` payee, `heldAmountCents > 0`, organizer KYC `APPROVED`.
  Creates a `Disbursement` (PENDING) for the disbursable amount.
- `approveDisbursement` / `markSent` / `confirmDisbursement` — the v1
  operator state machine (`PENDING→APPROVED→SENT→CONFIRMED`). Each
  transition: update `heldAmountCents`, write the matching
  `LedgerEntry` (`DISBURSEMENT_SENT`, -amount, with `proofUrl`),
  fire a notification event.
- v2 swap-in: a `sendDisbursement` executor that calls ACH/Stripe
  payout instead of the manual `markSent`. Same states, same ledger.

**C4. Overfund / underfund / refund policy** (define + implement;
required for trust and the GTM risk table):
- Overfunded (raised > goal/cost): policy choice surfaced on the
  campaign — refund pro-rata, redirect to a persistence fund, or hold.
- Student doesn't enroll / switches: refund path → `Disbursement`/
  `LedgerEntry` `REFUND`; reuse Stripe refunds keyed by
  `stripePaymentIntentId`.
- Make the chosen policy explicit on every campaign page (GTM §7).

**C5. Webhooks** (`webhook.service.ts`): no new Stripe events for v1
(still `payment_intent.succeeded/failed`). Ensure the
DIRECT_TO_INSTITUTION branch is covered by the same idempotent handling.

---

## 4. Workstream D — Verified-payee directory

Where: extend `user-service` (it already owns orgs/KYC) **or** a small
new `payee` module in `campaign-service`. Recommend `user-service` for
proximity to verification logic.

- Admin/operator endpoints: create payee, submit verification, mark
  `VERIFIED` (v1 = manual operator check: confirm the institution and
  its real bursar/AP payment instructions — this *is* the trust core).
- Encrypt `payInstructions` (KMS or app-layer); never log raw bank data.
- Pilot scope: seed 2–5 real institutions by hand (matches GTM pilot
  "verify the institution payee for each" step).

---

## 5. Workstream E — Public Fund-Usage Ledger (`campaign-service` + web)

- **Public read endpoint**: `GET /v1/campaigns/:id/ledger` — returns
  ordered `LedgerEntry` list (donation in / disbursement out / refund),
  amounts, dates, and `proofUrl` links. No auth (public trust artifact).
  Add to `campaign-service` routes/controller.
- **Web**: a "Where the money went" timeline on
  `apps/web/src/app/campaigns/[id]/page.tsx` — raised vs held vs
  disbursed, each disbursement with payee name + receipt link. This is
  the headline trust UI; make it prominent, not buried.
- Proof storage: reuse the existing **receipts S3 bucket** (already
  provisioned, see `deployment-log-2026-05-13.md` §8) for disbursement
  receipts; `proofUrl` points there.

---

## 6. Workstream F — Notifications & badges

- New `NotificationEvent` types (pattern: `@penyzen/shared`
  `NotificationEvent`, consumed by `notification-service` processors):
  `DISBURSEMENT_SENT` (donors: "your gift was paid to [school]"),
  `CAMPAIGN_FULLY_FUNDED`. Add processors under
  `services/notification-service/src/processors/` mirroring the existing
  ones (`donationReceived.ts`, etc.).
- The `DISBURSEMENT_SENT`-to-all-donors email is itself a re-engagement
  / virality moment — ties back to the K-factor loop.

---

## 7. Build sequence & dependencies

1. **B** (schema + migration) — unblocks everything. Ship first.
2. **A** (verified organizer) — parallel with B; small.
3. **C1–C2** (donation branch + held funds + ledger-on-donation).
4. **D** (payee directory; seed pilot institutions by hand).
5. **C3–C4** (disbursement state machine + refund/overfund policy).
6. **E** (public ledger endpoint + web timeline).
7. **F** (notifications) — last; not blocking.

Critical path: **B → C1/C2 → D → C3 → E**. A and F are parallel/non-blocking.

Pilot-ready definition (matches GTM "20 campaigns in 30 days"):
B + A + C1–C4 + D + E, with disbursement in **v1 assisted mode**. v2
(automated ACH) is post-pilot.

---

## 8. Compliance gate (do not skip)

Platform-held funds + disbursing to third parties = custodial / money-
transmitter territory (per `business-strategy.md` §0). Engage fintech
counsel **before C1 ships to real money**, in parallel with B/A. The v1
"assisted disbursement" model is partly a way to stay deliberate while
counsel and the money-transmitter posture are sorted — do not flip real
donor money through this path until that's cleared.

---

## 9. Concrete task list

| # | Task | Area |
|---|---|---|
| 1 | Add enums + `Payee`/`CampaignPayee`/`Disbursement`/`LedgerEntry` models + `Campaign` fields | `packages/database` |
| 2 | Regenerate `initial-schema.sql`, invoke db-migrator Lambda | `services/db-migrator` |
| 3 | Expose `organizer.kycStatus`/`isVerifiedOrganizer` on campaign reads | `campaign-service` |
| 4 | Verified-Organizer badge + KYC publish gate (DIRECT_TO_INSTITUTION) | `campaign-service`, `apps/web` |
| 5 | Branch `createDonation()` on `disbursementMode` (no transfer_data path) | `payment-service` |
| 6 | `handlePaymentSucceeded`: held funds + `DONATION_RECEIVED` ledger entry | `payment-service` |
| 7 | New `disbursement.service.ts` + operator state machine endpoints | `payment-service` |
| 8 | Overfund/underfund/refund policy logic + per-campaign disclosure | `payment-service`, `apps/web` |
| 9 | Payee directory: create/verify endpoints, encrypted `payInstructions` | `user-service` |
| 10 | Seed 2–5 real pilot institution payees by hand | ops |
| 11 | Public `GET /campaigns/:id/ledger` endpoint | `campaign-service` |
| 12 | "Where the money went" timeline UI | `apps/web` |
| 13 | `DISBURSEMENT_SENT`/`CAMPAIGN_FULLY_FUNDED` events + processors | `shared`, `notification-service` |
| 14 | Counsel engagement on custodial-funds posture (parallel) | legal |

---

## Change log
- **2026-05-16**: Initial breakdown. Identified the destination-charge →
  platform-held-escrow rearchitecture as the core of the work; defined
  the data model, the v1 assisted / v2 automated disbursement cut, the
  build sequence, and the compliance gate.
