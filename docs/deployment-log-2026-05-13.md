# Penyzen Deployment Log — 2026-05-13 / 2026-05-14

This is the canonical record of the first successful AWS deployment of the
Penyzen backend. Every code fix, command, and resource ID is captured below
so the deployment can be reproduced, audited, or rolled back.

AWS Account: **343218222527**
Region: **us-east-1**
Environment: **dev**

---

## 0. Final state

All seven CDK stacks deployed and reachable:

| Stack | Key output |
|---|---|
| `penyzen-network-dev` | `vpc-06261fbaf8f0a69d5` |
| `penyzen-database-dev` | Aurora `penyzen-dev`, Proxy `penyzen-proxy-dev.proxy-ccfq2s4ocyk5.us-east-1.rds.amazonaws.com` |
| `penyzen-auth-dev` | UserPool `us-east-1_xeJagUO72`, Client `48d6sdei2i1itku2rfdu3ps2js` |
| `penyzen-storage-dev` | Media bucket `penyzen-media-dev-343218222527`, CDN `d3owxobwk7hj6k.cloudfront.net` |
| `penyzen-queues-dev` | Notification queue `penyzen-notifications-dev` |
| `penyzen-api-dev` | **API URL `https://mb9z793u94.execute-api.us-east-1.amazonaws.com`** |
| `penyzen-migrator-dev` | One-shot DB migration Lambda |

Smoke test confirming the entire path (API Gateway → Lambda → Prisma layer → RDS Proxy → Aurora):

```powershell
curl.exe -sS -i https://mb9z793u94.execute-api.us-east-1.amazonaws.com/v1/campaigns
# HTTP/1.1 200 OK
# {"success":true,"data":{"items":[],"total":0,"page":1,"limit":20,"totalPages":0}}
```

---

## 1. Code fixes applied (in order)

### 1.1 CDK type errors in `infra/`

**Symptom:** Red squiggles on every stack file and `bin/penyzen.ts`.

| File | Fix | Why |
|---|---|---|
| All 6 stack interfaces | Renamed `env: 'dev' \| 'prod'` → `envName` | `env` shadowed `cdk.StackProps.env: cdk.Environment`. `'dev' \| 'prod'` not assignable to `Environment`. |
| `bin/penyzen.ts` | `environment: awsEnv` → `env: awsEnv` (everywhere) | CDK's AWS environment field is `env`, not `environment`. The account/region were never being passed. |
| `lib/stacks/api-stack.ts` | `authorizers.HttpNoneAuthorizer()` → `apigatewayv2.HttpNoneAuthorizer()` | `HttpNoneAuthorizer` lives in `aws-cdk-lib/aws-apigatewayv2`, not `…-authorizers`. |
| `lib/stacks/api-stack.ts` | Removed `AWS_REGION` from `commonEnv` | Reserved Lambda env var; CloudFormation rejects it. |
| `lib/stacks/api-stack.ts` | Added `DB_PROXY_ENDPOINT` to `commonEnv` | Was declared in props but never propagated to Lambdas. |
| `lib/constructs/lambda-function.ts` | Replaced `RetentionDays['30_DAYS']` lookup with `props.logRetention ?? ONE_MONTH` | Enum has no `30_DAYS` key; lookup always returned `undefined`. |
| `lib/constructs/lambda-function.ts` | Removed unused `const errorAlarm =` | Construct registers itself in its scope; assignment was dead code. |
| `infra/tsconfig.json` | Added `"declarationMap": false` | Base tsconfig had `declarationMap: true`; child set `declaration: false`; TS5069 conflict. |
| `infra/package.json` | Added `source-map-support` + `@types/source-map-support` | `bin/penyzen.ts` imports `source-map-support/register` but the package was missing. |
| `lib/stacks/api-stack.ts` | `path.join(__dirname, '../../../../services')` → `'../../../services'` | Off by one — resolved to `C:\Users\fanet\services` instead of `…\penyzen\services`. |

### 1.2 Service build error

**Symptom:** `notification-service` esbuild failure — `Could not resolve "@aws-sdk/client-sesv2"`.

```
services/notification-service/package.json:
- "@aws-sdk/client-ses": "^3.635.0",
+ "@aws-sdk/client-sesv2": "^3.635.0",
```
Source code uses `SESv2Client` and `SendEmailCommand` — the v2 SDK. The v1 package name was a typo.

### 1.3 CDK dependency cycle

**Symptom:** `«DependencyCycle» ... PenyzenNetwork-dev → PenyzenDatabase-dev/AuroraCluster/Resource.Endpoint.Port` at synth time.

**Root cause:** `rdsSg` was created in `NetworkStack` but used by Aurora + RDS Proxy in `DatabaseStack`. CDK's `DatabaseProxy` constructor internally calls `cluster.connections.allowDefaultPortFrom(proxy)`, writing a token referencing `AuroraCluster.Endpoint.Port` into a security-group ingress rule in NetworkStack.

**Fix:** Moved `rdsSg` creation into `DatabaseStack`. NetworkStack now exports only `vpc` + `lambdaSg`. DatabaseStack adds the Lambda→DB ingress rule itself. All CDK-generated connection rules now stay within DatabaseStack — no cross-stack tokens, no cycle.

Also removed `proxy.connections.allowFrom(...)` from DatabaseStack (it was redundant with `rdsSg.addIngressRule(lambdaSg, …)`).

### 1.4 Lambda router TypeScript error

**Symptom:** `error TS2352: Conversion of type 'APIGatewayEventRequestContextV2' to type 'Record<string, unknown>' may be a mistake`.

**Fix:** Cast through `unknown` first:
```ts
const requestContext = event.requestContext as unknown as Record<string, unknown>;
```

### 1.5 Cross-platform build (Windows)

**Symptom:** `email-templates` build failed — `'cp' is not recognized as an internal or external command`.

**Fix:** Replaced shell `cp -r` with a Node one-liner using `fs.cpSync`. Same for `clean` (`rm -rf` → `fs.rmSync`).

```jsonc
"copy-templates": "node -e \"const fs=require('fs'),path=require('path');for(const d of ['templates','layouts']){fs.cpSync(path.join('src',d),path.join('dist',d),{recursive:true});}\"",
"clean": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\""
```

---

## 2. Deployment fixes encountered during `cdk deploy`

### 2.1 Non-ASCII security-group descriptions

**Symptom:** `Value (Lambda functions ? outbound only) for parameter GroupDescription is invalid. Character sets beyond ASCII are not supported.`

**Fix:** Replaced em-dashes (`—`) with hyphens (`-`) in `LambdaSg` and `RdsSg` descriptions.

### 2.2 Aurora PostgreSQL version 15.4 deprecated

**Symptom:** `Cannot find version 15.4 for aurora-postgresql`.

**Fix:** `database-stack.ts`:
```ts
- version: rds.AuroraPostgresEngineVersion.VER_15_4,
+ version: rds.AuroraPostgresEngineVersion.of('15.8', '15'),
```
`aws rds describe-db-engine-versions` showed 15.8 as the lowest available 15.x in us-east-1.

### 2.3 Concurrent `cdk deploy` contention

**Symptom:** `Other CLIs (PID=...) are currently reading from cdk.out`.

**Lesson:** Don't run multiple `cdk deploy` commands against the same `cdk.out` directory in parallel. Either run sequentially or pass `--output` with different paths. We just retried sequentially.

---

## 3. The migration Lambda (Option B from the deployment plan)

The Aurora cluster + RDS Proxy live in `PRIVATE_ISOLATED` subnets — unreachable from outside the VPC. To apply the initial schema we built a one-shot Lambda:

1. **Initial SQL generated locally** (no DB required):
   ```powershell
   cd packages/database
   npx prisma migrate diff `
     --from-empty `
     --to-schema-datamodel prisma/schema.prisma `
     --script `
     | Out-File ..\..\services\db-migrator\src\initial-schema.sql -Encoding utf8
   ```

2. **New service `services/db-migrator/`** — a 60-line handler that reads the SQL file, opens a `pg` connection through the RDS Proxy, and applies it inside a transaction. Idempotent (skips if the `User` table already exists).

3. **New stack `lib/stacks/migrator-stack.ts`** — VPC-attached Lambda using the existing `lambdaSg`, granted `secretsmanager:GetSecretValue` on the DB secret.

4. **BOM strip in the handler:** PowerShell's `Out-File -Encoding utf8` writes a UTF-8 BOM. Postgres rejected it with `syntax error at or near "ï»¿"`. Fix: `.replace(/^﻿/, '')` on the SQL string. (Long-term, switch to `Set-Content -Encoding utf8NoBOM` or pipe through `Out-File -Encoding ASCII`.)

5. **Invoke:**
   ```powershell
   aws lambda invoke `
     --function-name penyzen-db-migrator-dev `
     --region us-east-1 `
     --cli-binary-format raw-in-base64-out `
     migrate-result.json
   # First run: {"status":"migrated","appliedBytes":7719}
   # Subsequent runs: {"status":"already-migrated"}
   ```

---

## 4. The Prisma Lambda Layer

**Symptom:** `Cannot find module '@prisma/client'` in service Lambdas (all four `esbuild.config.js` mark `@prisma/client` and `.prisma/client` as `external`).

**Steps:**

1. **Schema engine target:** Lambdas run on ARM64 Graviton; the schema specified `rhel-openssl-3.0.x` (x86_64).
   ```diff
   - binaryTargets = ["native", "rhel-openssl-3.0.x"]
   + binaryTargets = ["native", "linux-arm64-openssl-3.0.x"]
   ```

2. **Regenerate:** `npm run db:generate` — downloads `libquery_engine-linux-arm64-openssl-3.0.x.so.node` into `node_modules/.prisma/client/`.

3. **Build the layer** at `infra/lambda-layers/prisma/nodejs/node_modules/`:
   - Copy `@prisma/client/` (JS runtime, ~1 MB)
   - Copy `.prisma/client/` (generated client + engine)
   - Delete the x86_64 engine + Windows engine + Deno builds
   - Final size: **22 MB** (well under the 250 MB unzipped layer limit)

4. **CDK wiring** (`api-stack.ts`):
   ```ts
   const prismaLayer = new lambda.LayerVersion(this, 'PrismaLayer', {
     code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-layers/prisma')),
     compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
     compatibleArchitectures: [lambda.Architecture.ARM_64],
   });
   ```
   Attached to `user-service`, `campaign-service`, `payment-service`. NOT attached to `notification-service` (no DB access).

5. **`PenyzenLambda` construct** got a new optional `layers?: lambda.ILayerVersion[]` prop.

---

## 5. Password rotation + `DATABASE_URL` injection

**Symptom (after Prisma layer loaded):** `Environment variable not found: DATABASE_URL`.

**Root cause:** Services use `new PrismaClient()` which reads `DATABASE_URL` from env. The original auto-generated Aurora password contained `^` — not URL-safe, would need percent-encoding, which CloudFormation tokens can't perform.

**Steps:**

1. Generate URL-safe password (32 alphanumeric chars):
   ```powershell
   $newPwd = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
   ```

2. Rotate Aurora master password:
   ```powershell
   aws rds modify-db-cluster `
     --db-cluster-identifier penyzen-dev `
     --master-user-password $newPwd `
     --apply-immediately `
     --region us-east-1
   ```

3. Update Secrets Manager with the new password (and preserve the merged Stripe placeholder values from step 6 below).

4. Add `DATABASE_URL` to `commonEnv` in `api-stack.ts`:
   ```ts
   const dbUsername = props.dbSecret.secretValueFromJson('username').unsafeUnwrap();
   const dbPassword = props.dbSecret.secretValueFromJson('password').unsafeUnwrap();
   const databaseUrl = `postgresql://${dbUsername}:${dbPassword}@${props.proxyEndpoint}:5432/penyzen?schema=public&sslmode=require`;
   ```

5. Redeploy `PenyzenApi-dev`.

---

## 6. Full command sequence (in order)

```powershell
# ─── Code fixes already covered in §1–§5 above; commits/edits not shown here. ───

# Type-check after CDK fixes
cd C:\Users\fanet\penyzen\infra
npx tsc --noEmit

# Install + Prisma client + build everything
cd C:\Users\fanet\penyzen
npm install
npm run db:generate
npm run build

# Bootstrap CDK (one-time per account/region)
cd C:\Users\fanet\penyzen\infra
cdk bootstrap

# Stack 1: Network
cdk deploy PenyzenNetwork-dev --require-approval never

# Stack 2: Database (~14 min)
cdk deploy PenyzenDatabase-dev --require-approval never

# Stacks 3–5 (sequential after the cdk.out contention lesson):
cdk deploy PenyzenAuth-dev --require-approval never
cdk deploy PenyzenStorage-dev --require-approval never
cdk deploy PenyzenQueues-dev --require-approval never

# Seed Stripe placeholder values INTO the existing DB secret
#   (we have to merge — never overwrite — to keep the DB credentials.)
$secretArn = 'arn:aws:secretsmanager:us-east-1:343218222527:secret:AuroraClusterSecret8E4F2BC8-342TkgTt3v3e-driZvq'
$current = aws secretsmanager get-secret-value --secret-id $secretArn --region us-east-1 --query SecretString --output text | ConvertFrom-Json
$current | Add-Member -NotePropertyName 'STRIPE_SECRET_KEY' -NotePropertyValue 'sk_test_placeholder' -Force
$current | Add-Member -NotePropertyName 'STRIPE_WEBHOOK_SECRET' -NotePropertyValue 'whsec_placeholder' -Force
$current | Add-Member -NotePropertyName 'STRIPE_IDENTITY_WEBHOOK_SECRET' -NotePropertyValue 'whsec_placeholder' -Force
$tmp = New-TemporaryFile
($current | ConvertTo-Json -Compress) | Out-File $tmp.FullName -Encoding ascii -NoNewline
aws secretsmanager put-secret-value --secret-id $secretArn --region us-east-1 --secret-string ("file://" + $tmp.FullName)
Remove-Item $tmp.FullName

# Stack 6: API (after secret has Stripe values)
cdk deploy PenyzenApi-dev --require-approval never

# Stack 7: Migrator
cdk deploy PenyzenMigrator-dev --require-approval never

# Run the migration
aws lambda invoke `
  --function-name penyzen-db-migrator-dev `
  --region us-east-1 `
  --cli-binary-format raw-in-base64-out `
  migrate-result.json

# Rotate DB password to URL-safe (see §5)
# Redeploy API with new password + DATABASE_URL env var
cd C:\Users\fanet\penyzen\infra
cdk deploy PenyzenApi-dev --require-approval never

# Smoke test
curl.exe -sS -i https://mb9z793u94.execute-api.us-east-1.amazonaws.com/v1/campaigns
```

---

## 7. Pending follow-ups

- **Frontend:** No web app exists yet. Decision pending: build Next.js in `apps/web/`, deploy to `dev.penyzen.com` via Amplify, swap with the static placeholder later.
- **Stripe:** Placeholder keys only. When integrating real payments, update the Secrets Manager values and configure the three webhook endpoints (payment + connect + identity).
- **SES:** Domain identity not yet verified for `penyzen.com`. Notification Lambda will deploy but fail to send until verified. If still in SES sandbox, only verified test recipients can receive mail.
- **Migrations:** The current migrator runs a single bundled SQL file. For ongoing schema changes, either (a) regenerate `initial-schema.sql` via `prisma migrate diff` and re-invoke, or (b) switch to bundling the full `prisma/migrations/` directory and shelling out to `prisma migrate deploy`.
- **Static-site teardown:** `penyzen.com` and `www.penyzen.com` S3 buckets (us-east-2) still host the Nov-2024 landing page. Keep until the new frontend is live, then retire.

---

## 8. Resource inventory (for cleanup if needed)

| Resource | Identifier |
|---|---|
| Aurora cluster | `penyzen-dev` |
| RDS Proxy | `penyzen-proxy-dev` |
| DB Secret ARN | `arn:aws:secretsmanager:us-east-1:343218222527:secret:AuroraClusterSecret8E4F2BC8-342TkgTt3v3e-driZvq` |
| Cognito User Pool | `us-east-1_xeJagUO72` |
| Cognito Client | `48d6sdei2i1itku2rfdu3ps2js` |
| Media S3 | `penyzen-media-dev-343218222527` |
| Receipts S3 | `penyzen-receipts-dev-343218222527` |
| Media CloudFront | `d3owxobwk7hj6k.cloudfront.net` |
| SQS notification | `https://sqs.us-east-1.amazonaws.com/343218222527/penyzen-notifications-dev` |
| API Gateway | `https://mb9z793u94.execute-api.us-east-1.amazonaws.com` |
| Lambda functions | `penyzen-{user,campaign,payment,notification,db-migrator}-service-dev` |
| Prisma layer | `penyzen-prisma-dev` (LayerVersion) |
| Route 53 zone | `Z04009072KRDXZRF0HM85` (`penyzen.com`) |

To tear everything down:
```powershell
cd C:\Users\fanet\penyzen\infra
cdk destroy --all
```
(Aurora has `RemovalPolicy.DESTROY` in dev, so this is destructive.)

---

## 9. Frontend foundation (2026-05-14)

Per the Option C plan: build the Next.js app, deploy to `dev.penyzen.com` first, swap with the static placeholder later.

### 9.1 Workspace setup

`package.json` (root) — added `apps/*` to `workspaces`. New workspace: `apps/web/` as `@penyzen/web`.

Stack:
- **Next.js 14.2** (App Router, RSC)
- **React 18.3**
- **TypeScript** (extends nothing — has its own strict config because Next.js plugin handles a lot)
- **Tailwind CSS 3.4** + **lucide-react** for icons
- **AWS Amplify v6** (`aws-amplify`) for Cognito auth
- **Zod** for client-side form validation (deferred to next iteration)

### 9.2 Files created

```
apps/web/
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── .eslintrc.json            # isolates from root @typescript-eslint strict rules
├── .gitignore
├── .env.example
├── .env.local                # points at deployed dev API + Cognito IDs
└── src/
    ├── lib/
    │   ├── utils.ts                  # cn(), formatCents()
    │   ├── amplify-config.ts         # Cognito User Pool config
    │   ├── api.ts                    # apiFetch<T>() with JWT injection
    │   └── types.ts                  # mirrors @penyzen/shared types (Campaign, User, etc.)
    ├── components/layout/
    │   ├── header.tsx
    │   └── footer.tsx
    └── app/
        ├── globals.css
        ├── providers.tsx             # Amplify.configure({ ssr: true })
        ├── layout.tsx                # root layout: Header + main + Footer
        ├── page.tsx                  # marketing home
        ├── campaigns/page.tsx        # public browse — server fetch, ISR 60s
        └── (auth)/                   # route group
            ├── layout.tsx
            ├── login/page.tsx
            ├── register/page.tsx
            ├── confirm/page.tsx      # email verification code entry
            └── forgot-password/page.tsx
```

### 9.3 ESLint isolation

The root `.eslintrc.js` enables `@typescript-eslint/recommended-requiring-type-checking`, which flags every `await res.json()` as unsafe (since `json()` returns `any`). For an SPA where we layer types over fetched JSON, this is noise.

`apps/web/.eslintrc.json`:
```json
{ "root": true, "extends": ["next/core-web-vitals"] }
```
`root: true` stops ESLint from walking up to the workspace root. Type safety is still enforced by `tsc --noEmit`.

### 9.4 Build + smoke test

```powershell
cd C:\Users\fanet\penyzen
npm install                           # picks up new web workspace deps
cd apps\web
npx next build                        # 7 routes, all statically prerendered
npx next dev -p 3000                  # local at http://localhost:3000
```

Verified routes (all `200 OK`):
- `/` — marketing landing
- `/campaigns` — server-rendered list, fetches `https://mb9z793u94.execute-api.us-east-1.amazonaws.com/v1/campaigns`, renders empty-state
- `/login`, `/register`, `/confirm`, `/forgot-password` — Amplify Auth wired to the deployed Cognito User Pool

### 9.5 Phase 1 — Protected dashboard route group (2026-05-14)

**Amplify SSR auth setup:**
- `src/lib/amplify-server.ts` — exports `runWithAmplifyServerContext` from `@aws-amplify/adapter-nextjs`. Used by RSC and route handlers to read auth state from cookies.
- `src/lib/auth-server.ts` — `getServerUser()` returns the Cognito user from cookies (or `null`); `getServerIdToken()` returns the JWT for forwarding to backend APIs from RSC fetches.
- `src/app/providers.tsx` — switched token storage from `localStorage` to `CookieStorage` so the server can read the same session.
- `src/components/auth/sign-out-button.tsx` — client component calling `aws-amplify/auth.signOut()`.

**Dashboard layout:**
- `src/app/(dashboard)/layout.tsx` — server component, calls `getServerUser()`, redirects to `/login` if no session. Renders sidebar (Overview / My campaigns / Profile) + main content area.
- `src/app/(dashboard)/dashboard/page.tsx` — overview with action cards.
- `src/app/(dashboard)/dashboard/profile/page.tsx` — read-only profile from Cognito claims.

### 9.6 Phase 2 — Create-campaign form (2026-05-14)

- `src/app/(dashboard)/dashboard/campaigns/page.tsx` — placeholder list (empty-state until backend supports `?organizerId=` filter).
- `src/app/(dashboard)/dashboard/campaigns/new/page.tsx` — client form. Fields: title, story (≥100 chars), category (7 enum values), goal in dollars (converted to cents), optional end date. Submits via `apiFetch('/v1/campaigns', { method: 'POST' })`. On success, redirects to the new campaign's detail page.

### 9.7 Phase 3 — Public campaign detail (2026-05-14)

- `src/app/campaigns/[id]/page.tsx` — server component. Fetches `/v1/campaigns/{id}` with ISR (revalidate 30s). Renders cover image, story (paragraph-split), and a sticky donation card with progress bar, donor count, and end date. Donate button is disabled until Stripe is configured.
- Includes `generateMetadata()` for proper SEO on individual campaign pages (title + description from story).

### 9.8 Phase 4 — Amplify Hosting CDK stack

**Files added:**
- `amplify.yml` (repo root) — build spec for monorepo: `npm ci` at root, then `npm run build` in `apps/web`, output `apps/web/.next`.
- `infra/lib/stacks/web-stack.ts` — new CDK stack creating:
  - IAM service role (`AdministratorAccess-Amplify` managed policy)
  - `CfnApp` with `platform: 'WEB_COMPUTE'` (Next.js SSR), inline build spec, monorepo env (`AMPLIFY_MONOREPO_APP_ROOT=apps/web`)
  - All `NEXT_PUBLIC_*` env vars wired from the deployed API + Cognito stacks
  - `CfnBranch` for `master` (DEVELOPMENT stage in dev)
  - `CfnDomain` mapping `dev.penyzen.com` → branch `master` (existing Route 53 zone `Z04009072KRDXZRF0HM85`)
  - Outputs: app ID, default amplifyapp.com domain, custom domain URL, console URL
- `infra/bin/penyzen.ts` — instantiates `WebStack`, reads optional `github_repo` + `github_token` from CDK context.

**Source connection options** (Amplify needs source code to build):

1. **GitHub via CDK** (most automated):
   ```powershell
   cdk deploy PenyzenWeb-dev `
     -c github_repo=https://github.com/<user>/penyzen `
     -c github_token=<github-pat-with-repo-scope>
   ```
   Token requires `repo` and `admin:repo_hook` scopes.

2. **GitHub via Amplify Console** (post-deploy click-through):
   ```powershell
   cdk deploy PenyzenWeb-dev   # creates the App without a connection
   ```
   Then in the Amplify Console → click the app → "Connect repository" → OAuth into GitHub.

3. **Manual deploys** (no Git): build locally and upload a zip via the Amplify Console's "Deploy without Git" path, or use the AWS CLI's `start-deployment` API.

**Status:** WebStack is *not yet deployed* — pending decision on which source path to use.

---

## 10. Frontend deployment (2026-05-14, follow-up session)

### 10.1 WebStack deployed via CDK

`cdk deploy PenyzenWeb-dev` succeeded at 2026-05-14T05:59 UTC. Outputs:

| Output | Value |
|---|---|
| `AmplifyAppId` | `d36f230uhjp2x3` |
| `AmplifyDefaultDomain` | `d36f230uhjp2x3.amplifyapp.com` |
| `CustomDomain` | `https://dev.penyzen.com` |

Domain association: status `AVAILABLE`, ACM cert validated, `dev` subdomain verified, DNS `dev → d2ahhep3nf9rqv.cloudfront.net`.

### 10.2 GitHub source connection via CLI (not console)

Initial attempt was to connect GitHub via the Amplify Console's "Connect repository" flow, but the current console UI doesn't expose that path for CDK-created apps. Switched to CLI:

```powershell
$pat = '<github-pat-with-repo+admin:repo_hook scopes>'
aws amplify update-app `
  --app-id d36f230uhjp2x3 `
  --region us-east-1 `
  --repository https://github.com/penyzen/penyzen `
  --access-token $pat
```

**Side effect (gotcha):** `update-app --repository` on an Amplify app wipes the existing `branches` AND the `subDomainSettings` mappings on the domain association. After the call:
- `list-branches` returned empty
- `get-domain-association` showed `subDomains: []`

CDK CloudFormation state did not auto-reconcile (it sees no drift unless you run `detect-stack-drift`).

### 10.3 Manual recreation of branch + subdomain mapping

```powershell
# Recreate the master branch
aws amplify create-branch `
  --app-id d36f230uhjp2x3 --region us-east-1 `
  --branch-name master --stage DEVELOPMENT `
  --framework "Next.js - SSR" --enable-auto-build

# Reattach dev subdomain
aws amplify update-domain-association `
  --app-id d36f230uhjp2x3 --region us-east-1 `
  --domain-name penyzen.com `
  --sub-domain-settings 'prefix=dev,branchName=master'
```

This created drift between CloudFormation and reality. Future `cdk deploy PenyzenWeb-dev` calls should still be idempotent (the CDK constructs reference the same names) but watch for replace-on-update warnings.

### 10.4 Build #1 failed: artifact path resolution

```
!!! CustomerError: Artifacts base directory not found in build output, please check your buildSpec
```

**Root cause:** The buildSpec used `appRoot: apps/web` with `artifacts.baseDirectory: apps/web/.next` — Amplify resolves `baseDirectory` *relative to* `appRoot`, so it was looking for `apps/web/apps/web/.next` (doesn't exist).

**Fix (commit `7fd7fbd`):**
- `amplify.yml`: `baseDirectory: apps/web/.next` → `.next`, `cache.paths: apps/web/.next/cache/**/*` → `.next/cache/**/*`
- `infra/lib/stacks/web-stack.ts`: same edits to the inline `BUILD_SPEC` constant (CDK source of truth)

### 10.5 Build #2 succeeded (auto-triggered by push)

After `git push origin master`, the GitHub webhook installed by the PAT auto-triggered build #2. Completed in ~5 minutes (job duration 299s).

```
Route (app)                                Size     First Load JS
┌ ○ /                                     189 B          94.2 kB
├ ○ /_not-found                           873 B          88.1 kB
├ ○ /campaigns                            189 B          94.2 kB
├ ƒ /campaigns/[id]                       189 B          94.2 kB
├ ○ /confirm                              3.93 kB         112 kB
├ ƒ /dashboard                            189 B          94.2 kB
├ ƒ /dashboard/campaigns                  189 B          94.2 kB
├ ƒ /dashboard/campaigns/new              2.36 kB         111 kB
├ ƒ /dashboard/profile                    138 B          87.3 kB
├ ○ /forgot-password                      3.18 kB         118 kB
├ ○ /login                                1.16 kB         138 kB
└ ○ /register                             2.66 kB         139 kB
```

### 10.6 Verification

| Route | Status | Notes |
|---|---|---|
| `https://dev.penyzen.com/` | 200 (17 KB) | Marketing home |
| `/campaigns` | 200 (10.5 KB) | SSR — server hit `/v1/campaigns` API, rendered empty-state |
| `/login`, `/register` | 200 | Cognito auth pages |
| `/dashboard`, `/dashboard/campaigns/new` | 307 → `/login` | Auth guard working — no Cognito cookie, redirect issued |

Full chain proven: browser → CloudFront → Amplify → Next.js SSR → Cognito (auth guard) → API Gateway → Lambda → Prisma layer → RDS Proxy → Aurora.

### 10.7 Still pending

- **CloudFormation drift on `PenyzenWeb-dev`**: branch + subdomain mapping recreated out-of-band. Run `aws cloudformation detect-stack-drift --stack-name penyzen-web-dev` to confirm, and decide whether to re-import or accept drift.
- **GitHub PAT lifecycle**: token is stored on the Amplify app config (encrypted). Revoke/rotate when no longer needed.
- **Stripe**: still placeholder. When integrating real payments, update Secrets Manager + configure the three webhook endpoints.
- **SES**: domain identity not yet verified — notification Lambda will deploy but emails will fail to send.
