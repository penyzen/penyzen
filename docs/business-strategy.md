# Penyzen Business & Product Strategy

Living strategy reference. Captures the strategic analysis worked through
for Penyzen — positioning vs. incumbents, differentiators, go-to-market,
and the differentiator-to-roadmap mapping.

Started: 2026-05-15. This is a working document — revise as the thesis
sharpens. Sibling docs: [`deployment-log-2026-05-13.md`](./deployment-log-2026-05-13.md),
[`frontend-deployment.md`](./frontend-deployment.md).

---

## 0. TL;DR (the load-bearing conclusions)

1. **Do not compete on fees.** GoFundMe charges a **0% platform fee** in
   the US (monetizes via optional donor tips + payment processing). A
   "cheaper" pitch against a free incumbent has no story. This was an
   early assumption that had to be killed.
2. **The only uncontested ground is trust-as-product** (verified
   identity + milestone escrow + public fund-usage ledger) **combined
   with vertical channel distribution.** Every other axis has a strong,
   funded incumbent.
3. **The leapfrog is distribution, not features.** GoFundMe acquires
   donors one campaign at a time; Penyzen should acquire *channels and
   organizations* (funeral homes, hospital billing, churches, employers)
   that each refer thousands of campaigns at ~zero CAC.
4. **Sequence: defensibility → margin → expansion.** Ship the trust
   wedge first (it's the only non-knife-fight), then recurring/embedded
   (margin), then DAF/B2B (sticky, high-value).
5. **Minimum Lovable Wedge** = Verified Organizer + Milestone Escrow +
   Public Fund-Usage Ledger. Mostly extends code that already exists.
6. **Week-1 vertical = college-launch** (reframed from "grad party").
   Memorial = expansion vertical #2. Medical = the long-term prize, *not*
   the starting wedge (it's GoFundMe's fortress). See §5.
7. **Direct-to-institution disbursement** ("pay the bill, not the
   person") is elevated to a Phase-A trust pillar — the purest
   expression of the wedge, and central to the college-launch MLW.

---

## 1. Q: "How do we make this a hot startup, go viral, pull VC fast?"

**Reframe:** "Viral" and "raise fast" are *outputs*, not strategies.
Crowdfunding has a built-in viral loop (every campaign is shared by the
organizer to their network) — the job is to engineer that loop and pick
a wedge where the incumbent is weak.

Key points:
- **Pick a vertical**; don't be "GoFundMe but better" horizontally.
  Candidates: medical, memorial/funeral, mutual aid/community,
  nonprofit+DAF. Density in one niche → word of mouth → category default.
- **The viral loop is the product**: zero-friction donation (guest
  checkout, Apple/Google Pay, <10s), real-time social proof, match
  multipliers, recurring, frictionless updates.
- **Trust as the headline**, not a feature — it's the PR narrative and
  the structural switching reason.
- **What pulls VC** = traction metrics (GMV growth, K-factor > 1,
  CAC ≈ 0, organizer retention, take rate) + a crisp "why now" + a
  structural answer to "why won't GoFundMe just copy this?"
- **Tradeoffs**: payments/escrow compliance (money-transmitter), T&S
  cost, thin margins (recurring + B2B are how economics close).

### The 90-day execution plan

- **Week 1 (decision):** pick the vertical by the rule *"which channel
  can I personally get 20 real campaigns from in 30 days?"* Reversible;
  not picking is not.
- **Phase 1 — Instrument the funnel (Wk 1–2, do FIRST):** log 6 events —
  `campaign_created`, `campaign_shared`, `campaign_viewed` (+ referrer),
  `donation_started`, `donation_completed`, `donor_shared`. Build a
  one-page dashboard: K-factor, GMV, WoW growth, visit→donate conversion,
  organizer repeat rate. **No new feature before these 6 events log.**
- **Phase 2 — Minimum viral loop (Wk 2–5):** in priority order —
  (1) zero-friction donation, (2) real-time social proof,
  (3) match multiplier, (4) recurring, (5) frictionless updates.
- **Phase 3 — Seed real campaigns (Wk 4–9):** concierge-onboard 20–50
  campaigns in the chosen vertical only; lock the channel partner; lead
  with the trust message.
- **Phase 4 — The raise (Wk 9–12):** trigger = GMV growing >40% MoM for
  2+ months with K-factor > 1. Deck = 3 substance slides (flywheel +
  funnel numbers; wedge + channel; structural moat answer).
- **Parallel from Wk 1–2:** fintech-savvy lawyer (6–8 wk lead time;
  fundraising blocker if started late).

---

## 2. Q: "Key offerings & differentiators vs. GoFundMe?"

**GoFundMe's exploitable weaknesses:** trust/accountability (scam
stories, no escrow, frozen payouts, poor support); weak orgs/recurring
(Classy bolt-on is clunky); thin organizer tooling.

**The fee trap (killed assumption):** GoFundMe is 0% platform fee. Don't
lead with price. Compete on trust and outcomes.

**Differentiators, ranked by defensibility:**
1. **Trust-as-product** — verified organizers, milestone/escrow release,
   public "where the money went" ledger. Category-defining; attacks
   GoFundMe's deepest wound; the PR story.
2. **Embedded & recurring giving rails** — APIs/widgets for nonprofits,
   churches, employers, creators; recurring; employer match; DAF/payroll.
   The margin engine; defensible via integration lock-in.
3. **Organizer experience** — instant payouts, transparent holds, real
   support, rich updates. Table stakes individually; compounds.
4. **DAF + nonprofit tooling** — native DAF granting + auto tax receipts;
   ~$230B in DAFs, growing, hard to give from today.

**Why now:** payment rails commoditized (Stripe Connect), AI fraud
detection viable, post-pandemic distrust high, DAFs exploding, embedded
fintech proven.

---

## 3. Q: "Pressure-test vs. other competitors"

Conclusion: **the user was over-indexed on GoFundMe.** Most dangerous
competitors are the modern, loved, freemium players.

| Competitor | Owns | Weak on | Threat |
|---|---|---|---|
| **GoFundMe** | Personal-cause brand + SEO; 0% fee, tips | Trust, orgs, recurring, support | High brand; structurally can't tell a trust/escrow story |
| **Classy** (GFM-owned) | Enterprise nonprofit SaaS | Expensive, RFP cycle, ignores long tail | Low directly; their ignored SMB tail is the opening |
| **Givebutter** | Modern, *loved*, free all-in-one for small orgs | Tip margin, no escrow, light compliance | **Highest underrated threat** — can't out-"free-friendly" them |
| **Donorbox** | Embeddable recurring donation forms | Just a form, no verification/escrow | **Direct threat to "embedded rails"** — differentiate via trust + verticals |
| **Daffy** | Consumer DAF app | Charities only, not campaigns | Not a competitor — a **partner/inflow rail** |
| **Kickstarter / Indiegogo** | Creative/product rewards | Not cause/donation, no recurring | Different category; a boundary, not a rival |
| **Pledge / Percent / Groundswell** | B2B embedded-giving / CSR infra | Generic APIs, no trust/escrow | "Embedded giving" alone is **not a moat** — must pair with trust |
| **Meta Fundraisers / Venmo / Cash App** | Social-graph & informal P2P | No structure/accountability/receipt | Win on legitimacy/structure above friends-and-family asks |

**Sharpened positioning:**
> "The only crowdfunding platform where donors can verify the money is
> real and see where it went — starting in [memorial/medical], expanding
> via the channels that already refer every case."

---

## 4. Differentiators → product roadmap (mapped to services)

Existing scaffolding that accelerates this: `campaign-service` has
milestones + updates + media; `user-service` has KYC (Stripe Identity) +
organizations; `payment-service` has Stripe Connect; a `receipts` S3
bucket already exists.

Sequencing: **defensibility → margin → expansion. Do not reorder.**

### Phase A — Trust layer (the wedge) ~6–10 wks
| Capability | Service(s) | Build | Exists |
|---|---|---|---|
| Verified Organizer | user-service + web | Finish Stripe Identity KYC; Verified badge | KYC stubs |
| Milestone escrow | payment + campaign + database | Funds held in Connect; release on milestone complete + proof + approval; payout state machine + escrow ledger | Milestones; Connect |
| Public fund-usage ledger | campaign-service + web | Per-campaign immutable audit timeline (release + receipt) | updates + receipts bucket |
| **Direct-to-institution disbursement** | payment + campaign + database | Verified-payee directory; pay institution (school/provider/funeral home) directly, never a personal account; restricted-fund accounting + overfund/underfund/refund policy | Connect; receipts bucket |
| T&S data model | campaign + database | Stub anomaly-flag fields (velocity, organizer history) | — |

**Gating:** escrow = custodial funds = money-transmitter questions.
Engage fintech counsel at the *start* of Phase A, in parallel.

### Phase B — Recurring & embedded rails (margin) ~6–8 wks
| Capability | Service(s) | Build |
|---|---|---|
| Recurring donations | payment-service | Stripe subscriptions; donor mgmt; dunning |
| Embeddable widget + API keys | user-service (key auth in lambda-router) + apps/web | Key-scoped auth; embed JS; scoped public endpoints |
| Employer match | campaign + payment | Match-rule engine (cap/ratio/sponsor) + "next $X matched" UI |

### Phase C — DAF + nonprofit/tax tooling (sticky) ~4–6 wks
| Capability | Service(s) | Build |
|---|---|---|
| Auto tax receipts | notification + payment | IRS-compliant PDF receipts → receipts bucket; auto-email |
| DAF inflow rail | payment-service | DAF grants as donation method (manual recon v1 → integrations v2) |
| Org dashboards | user-service + web | Org campaign/donor/recurring views |

### Phase D — Organizer experience (continuous, overlaps B–C)
Instant/next-day payouts (Connect instant payouts), payout-status
transparency UI, rich video updates → donor re-engagement emails
(campaign updates + notification-service + SQS, already wired).

### Minimum Lovable Wedge (ship before anything else)
**Verified Organizer + Milestone Escrow + Public Fund-Usage Ledger.**
The entire defensible story; mostly extends existing code; the one thing
no competitor can copy without undermining their own model.

For the **college-launch vertical specifically**, the MLW is sharpened
to: **Verified Organizer + Direct-to-Institution Disbursement (tuition
paid to the school) + Public Fund-Usage Ledger.** Milestone escrow
becomes less central when the money never touches a personal account at
all — direct-to-institution *is* the escrow story for this vertical.

---

## 5. Feature triage & vertical selection (2026-05-16)

Explored three feature ideas; two of them sharpened the core thesis
rather than drifting from it.

### Feature triage

| Idea | Verdict | Rationale |
|---|---|---|
| Physical-goods logistics (cars, used computers) | **Reject** | Ops beast (title, towing, valuation, 1098-C, appraisals); no rail synergy; not software margin |
| Buy-a-specific-item registry (ships direct to recipient/institution) | **Adopt (light)** | Near-zero logistics (retailer fulfills); pure trust play; synergizes with direct-to-institution |
| Professional time / pro bono | **Park** | Separate two-sided marketplace (Catchafire/Taproot); brutal cold-start; doesn't use the rails |
| "Grad party" (as framed) | **Reject as framed** | Frivolity problem; seasonal; low AOV; no VC/community narrative |
| **College-launch fund** (reframe) | **Elevate → Week-1 vertical** | Renewable annual cohort; school channel; aspirational K-factor; perfect trust showcase |
| **Direct-to-institution disbursement** | **Elevate → Phase-A core pillar** | "Pay the bill, not the person." The sharpest possible form of the trust wedge |

The non-obvious synthesis: **"college-launch vertical + direct-to-
institution disbursement + buy-the-laptop-direct" is one coherent
product** — a verified, can't-be-scammed way for a community to launch a
kid into college, distributed through schools.

### Why direct-to-institution is strategically central (not a feature)

- It's milestone escrow taken to its endpoint: money never touches a
  personal account; it pays the school/provider/funeral home directly.
  Structurally eliminates GoFundMe's biggest wound *by design*.
- Turns the institution into both the **trust anchor and the
  distribution channel** — they refer families *because* you pay them
  cleanly.
- **Tax angle (validate with counsel, not advice):** IRC §2503(e)
  excludes from gift tax amounts paid *directly to an educational
  institution for tuition* or *directly to a provider for medical
  care* — a benefit that vanishes the moment money routes through a
  personal account. Caveats: gift-tax exclusion ≠ income-tax
  deductibility (still needs a 501(c)(3) path); tuition/medical-specific.
- Hard parts = the moat: verified-payee directory, restricted-fund
  accounting, overfund/underfund/refund policy, payee acceptance
  (student ID / FERPA-adjacent), ACH/check rails to institutions.

### Week-1 vertical pressure-test — college-launch vs memorial vs medical

| Criterion | Memorial | Medical | College-launch |
|---|---|---|---|
| Built-in channel (low CAC) | Strong (funeral homes, perpetual) | Medium (hospitals slow, HIPAA) | Strong (one counselor = many students) |
| Cohort renewability | Strong (continuous) | Strong (continuous, huge) | Medium (predictable but **seasonal spike**) |
| Shareability / K-factor | Medium (somber, short window) | Strong (sustained updates) | **Strongest** (aspirational, joyful) |
| Trust-wedge fit | Strong (pay funeral home) | Strong but **ops-messy** (billing moves) | **Strongest** (pay tuition; cleanest §2503(e); enrollment verifiable) |
| Fraud surface (lower better) | Low (home verifies) | **High** (most-publicized scams) | Low (school verifies; direct-pay blocks diversion) |
| Compliance load (lower better) | Low–Med | **High** (HIPAA, billing) | Low–Med (tuition direct-pay clean) |
| Founder 30-day cold-start | Medium (B2B handshake) | **Weak** (hospital cycles) | **Strong** (concentrated cohort; grad season is now) |
| Incumbent whitespace | Good | **Poor** (GoFundMe fortress) | **Largest** (no structured product) |
| Expansion adjacency | → emergency → medical | → broad | → college-persistence → education → medical/memorial |

**Decision:**
- **College-launch = Week-1 vertical.** Best founder cold-start, K-factor,
  fraud profile, and whitespace; purest trust-wedge showcase.
- **Memorial = expansion vertical #2** (best non-seasonal channel; second move).
- **Medical = long-term prize, not the start** (highest compliance/fraud;
  GoFundMe's fortress — earn the right to it later).
- **Known weakness — seasonality.** Spring/summer spike, off-season
  trough. Mitigation: embrace the seasonal campaign nature, use the
  off-season for channel/product build, and expand into year-round
  **college-persistence / emergency retention funds** to smooth the
  curve. State this openly in the deck.

---

## 6. Open decisions / next steps

- [x] **Vertical selected (recommended): college-launch** — pending
      founder ratification. Memorial = #2, Medical = later.
- [ ] Ratify the vertical and line up the first school/counselor channel
      partner (grad season is the window — act now).
- [ ] Engage fintech/payments counsel (parallel; long lead time).
- [ ] Break the Minimum Lovable Wedge into concrete implementation tasks
      against `payment-service` / `campaign-service` / `user-service`
      (escrow state machine, ledger schema in `database` package,
      payout-release flow). ← *natural next technical step*
- [ ] Instrument the 6 funnel events + dashboard.

---

## Change log
- **2026-05-15**: Initial document. Captures the startup/viral/VC
  discussion, the 90-day plan, GoFundMe differentiators + fee-trap
  correction, the full competitor pressure-test, and the
  differentiator→roadmap mapping with the Minimum Lovable Wedge.
- **2026-05-16**: Added §5 (feature triage + Week-1 vertical
  pressure-test). College-launch selected as Week-1 vertical (memorial
  #2, medical later). Direct-to-institution disbursement elevated to a
  Phase-A core pillar and into the college-launch MLW. Updated §0 TL;DR
  (points 6–7), Phase A roadmap table, MLW section, and renumbered Open
  decisions to §6.
