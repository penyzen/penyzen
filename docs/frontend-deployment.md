# Penyzen Frontend Deployment Playbook

Canonical step-by-step guide for deploying the Next.js frontend in
`apps/web/` to AWS Amplify Hosting at `https://dev.penyzen.com`.

This is the *playbook* version — for the narrative log of the first
successful deploy, see [`deployment-log-2026-05-13.md`](./deployment-log-2026-05-13.md)
sections 9–10.

---

## Prerequisites

Before starting, confirm:

- [ ] Backend stacks already deployed (`PenyzenNetwork-dev` ... `PenyzenApi-dev`).
      Smoke-test: `curl https://<api-id>.execute-api.us-east-1.amazonaws.com/v1/campaigns`
      → returns `200 OK`.
- [ ] CDK code present at `infra/lib/stacks/web-stack.ts`.
- [ ] `apps/web/` exists and the frontend builds locally:
      `cd apps/web && npx next build` completes without errors.
- [ ] Route 53 hosted zone for `penyzen.com` exists
      (zone ID hard-coded in `infra/bin/penyzen.ts` —
      `Z04009072KRDXZRF0HM85`).
- [ ] AWS credentials configured for account `343218222527`, region `us-east-1`.
      Verify: `aws sts get-caller-identity`.

---

## Step 1 — Generate a GitHub Personal Access Token

Amplify needs to clone the repo on each build. The cleanest way to wire
this up is a classic Personal Access Token (PAT) stored on the Amplify
app config.

1. Open <https://github.com/settings/tokens/new>.
2. **Note**: `Amplify - penyzen-web-dev` (or similar).
3. **Expiration**: 90 days (rotate after).
4. **Scopes** (check exactly these two):
   - `repo` — full control of private repositories.
   - `admin:repo_hook` — read/write hooks (Amplify installs a webhook for
     auto-builds).
5. Click **Generate token**, copy the `ghp_...` value (only shown once).

> ⚠️ **Never commit the PAT.** It's only needed transiently — store it in
> the Amplify app config via the CLI in Step 3.

---

## Step 2 — Deploy the WebStack via CDK

The `WebStack` creates the Amplify App, branch, and custom-domain
mapping. The GitHub repository field is left blank intentionally
(we wire it up via CLI afterwards — see the gotcha in Step 3).

```powershell
cd C:\Users\fanet\penyzen\infra
$env:AWS_REGION       = 'us-east-1'
$env:AWS_ACCOUNT_ID   = '343218222527'

# Preview changes first
npx cdk diff PenyzenWeb-dev

# Deploy
npx cdk deploy PenyzenWeb-dev --require-approval never
```

**Expected outputs** (collect for the next steps):

| Output key            | Example value                          |
|-----------------------|----------------------------------------|
| `AmplifyAppId`        | `d36f230uhjp2x3`                       |
| `AmplifyDefaultDomain`| `d36f230uhjp2x3.amplifyapp.com`        |
| `CustomDomain`        | `https://dev.penyzen.com`              |
| `AmplifyConsoleUrl`   | direct link to the Amplify console     |

**Verify the domain provisioned correctly** (takes ~2–5 min after deploy):

```powershell
aws amplify get-domain-association `
  --app-id <AmplifyAppId> --domain-name penyzen.com `
  --region us-east-1 `
  --query 'domainAssociation.[domainStatus,subDomains[].subDomainSetting.prefix]'
# Expect: ["AVAILABLE", ["dev"]]
```

DNS propagation check:

```powershell
Resolve-DnsName dev.penyzen.com
# Expect: CNAME to <hash>.cloudfront.net
```

---

## Step 3 — Connect GitHub via CLI

> ⚠️ **Gotcha:** `aws amplify update-app --repository` **wipes**
> existing branches and the domain's `subDomainSettings`. The Amplify
> CDK constructs (`CfnBranch`, `CfnDomain`) are deleted from the live
> app even though CloudFormation still thinks they exist. We work
> around this by recreating them manually in Step 4.
>
> If you want to avoid the gotcha entirely, pass the PAT to the *first*
> `cdk deploy` instead of using `update-app` afterwards:
> ```powershell
> npx cdk deploy PenyzenWeb-dev `
>   -c github_repo=https://github.com/penyzen/penyzen `
>   -c github_token=ghp_xxx
> ```
> (The `WebStack` reads `github_repo` and `github_token` from CDK
> context — see `infra/bin/penyzen.ts` lines 111–112.)

If you didn't pre-wire the PAT, attach the repo after deploy:

```powershell
$pat = 'ghp_xxxxxxxxxxxxxxxxxxxxxx'

aws amplify update-app `
  --app-id d36f230uhjp2x3 `
  --region us-east-1 `
  --repository https://github.com/penyzen/penyzen `
  --access-token $pat

# Clear the variable so it doesn't linger in the shell
$pat = $null
```

Verify the repo is attached:

```powershell
aws amplify get-app --app-id d36f230uhjp2x3 --region us-east-1 `
  --query 'app.[repository,platform]'
# Expect: ["https://github.com/penyzen/penyzen", "WEB_COMPUTE"]
```

---

## Step 4 — Recreate the branch and subdomain mapping

After `update-app --repository`, both are wiped. Recreate via CLI:

```powershell
# Recreate the master branch
aws amplify create-branch `
  --app-id d36f230uhjp2x3 --region us-east-1 `
  --branch-name master `
  --stage DEVELOPMENT `
  --framework "Next.js - SSR" `
  --enable-auto-build `
  --no-enable-performance-mode

# Reattach the dev subdomain
aws amplify update-domain-association `
  --app-id d36f230uhjp2x3 --region us-east-1 `
  --domain-name penyzen.com `
  --sub-domain-settings 'prefix=dev,branchName=master'
```

For `prod`, use `--stage PRODUCTION` and `--sub-domain-settings 'prefix=www,branchName=master'`.

Verify both:

```powershell
aws amplify list-branches --app-id d36f230uhjp2x3 --region us-east-1 `
  --query 'branches[].[branchName,stage,enableAutoBuild]'
# Expect: master | DEVELOPMENT | True

aws amplify get-domain-association `
  --app-id d36f230uhjp2x3 --domain-name penyzen.com --region us-east-1 `
  --query 'domainAssociation.subDomains[].[subDomainSetting.prefix,subDomainSetting.branchName,verified]'
# Expect: ["dev", "master", true]
```

> ℹ️ **CloudFormation drift:** CFN doesn't know the branch was recreated
> out-of-band, so `cdk diff` will report "no differences". Future
> `cdk deploy PenyzenWeb-dev` calls should still be idempotent (the
> construct logical IDs are the same), but it's worth running
> `aws cloudformation detect-stack-drift --stack-name penyzen-web-dev`
> once you're stable and either accepting the drift or reconciling.

---

## Step 5 — Trigger the first build

With auto-build enabled, any push to `master` triggers a build via the
webhook installed by the PAT. To start one manually:

```powershell
aws amplify start-job `
  --app-id d36f230uhjp2x3 --region us-east-1 `
  --branch-name master --job-type RELEASE `
  --query 'jobSummary.[jobId,status]'
# Returns: jobId="N", status="PENDING"
```

---

## Step 6 — Monitor the build

Builds typically take 4–6 minutes (Next.js 14 monorepo with `npm ci`).
Poll until terminal status:

```powershell
$jobId = '<from-step-5>'
$appId = 'd36f230uhjp2x3'
$deadline = (Get-Date).AddMinutes(15)
while ((Get-Date) -lt $deadline) {
  $j = aws amplify get-job `
    --app-id $appId --branch-name master --job-id $jobId `
    --region us-east-1 --query 'job.summary' --output json | ConvertFrom-Json
  $elapsed = if ($j.startTime) { ((Get-Date) - [DateTime]$j.startTime).TotalSeconds } else { 0 }
  Write-Output ("[{0:N0}s] status={1}" -f $elapsed, $j.status)
  if ($j.status -in @('SUCCEED','FAILED','CANCELLED')) { break }
  Start-Sleep -Seconds 30
}
```

### Fetch build logs on failure

```powershell
$logUrl = aws amplify get-job `
  --app-id d36f230uhjp2x3 --branch-name master --job-id $jobId `
  --region us-east-1 `
  --query 'job.steps[?stepName==`BUILD`].logUrl | [0]' --output text

$log = (Invoke-WebRequest -Uri $logUrl -UseBasicParsing).Content
[System.IO.File]::WriteAllText("$(Get-Location)\build-$jobId-log.txt", $log)

# Tail
Get-Content "build-$jobId-log.txt" -Tail 80
```

---

## Step 7 — Verify the live site

```powershell
# Status codes for key routes
foreach ($p in @('/','/campaigns','/login','/register','/dashboard','/dashboard/campaigns/new')) {
  try {
    $r = Invoke-WebRequest -Uri "https://dev.penyzen.com$p" `
      -MaximumRedirection 0 -UseBasicParsing -ErrorAction SilentlyContinue
    "{0,-30} {1}" -f $p, $r.StatusCode
  } catch {
    "{0,-30} {1}" -f $p, $_.Exception.Response.StatusCode.value__
  }
}
```

**Expected:**

| Route                          | Status         | Meaning                                          |
|--------------------------------|----------------|--------------------------------------------------|
| `/`                            | 200            | Marketing home renders                           |
| `/campaigns`                   | 200            | SSR list fetched `/v1/campaigns` from API        |
| `/login`, `/register`          | 200            | Cognito auth pages                               |
| `/dashboard`                   | 307 → `/login` | Auth guard redirects unauthenticated users       |
| `/dashboard/campaigns/new`     | 307 → `/login` | Auth guard redirects                             |

Then browse the site manually:
- Register a new account at `/register`
- Confirm via the verification code emailed by Cognito
- Sign in, land on `/dashboard`
- Create a test campaign at `/dashboard/campaigns/new`
- Verify it appears at `/campaigns`

---

## Troubleshooting

### Build fails: `Artifacts base directory not found in build output`

**Cause:** The `amplify.yml` build spec uses `appRoot: apps/web` but
the `artifacts.baseDirectory` or `cache.paths` entries are absolute
from the repo root. Amplify resolves these **relative to the appRoot**.

**Fix:** All paths in `artifacts` and `cache` must be relative to
`apps/web`. Correct values:

```yaml
artifacts:
  baseDirectory: .next         # not apps/web/.next
  files:
    - '**/*'
cache:
  paths:
    - node_modules/**/*
    - .next/cache/**/*          # not apps/web/.next/cache/**/*
```

Keep both `amplify.yml` (repo root — what Amplify reads at build time)
and the inline `BUILD_SPEC` constant in `infra/lib/stacks/web-stack.ts`
in sync. Amplify prefers `amplify.yml` from the repo if present;
the inline spec is the create-time fallback.

### Build fails: `npm ci` errors with peer-dependency conflicts

**Cause:** workspace dependency resolution.

**Check:** Run `npm ci` locally at the repo root to reproduce. The
build runs `cd ../.. && npm ci` from `apps/web`, so the install hits
the root `package-lock.json`.

### Build succeeds but routes return 5xx

Most often a runtime env-var mismatch. The `WebStack` injects:

- `NEXT_PUBLIC_API_URL` — public API Gateway URL (used by client RSC fetches)
- `PENYZEN_API_URL` — same value, used by server components
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`, `NEXT_PUBLIC_COGNITO_REGION`

Verify on the running app:

```powershell
aws amplify get-app --app-id d36f230uhjp2x3 --region us-east-1 `
  --query 'app.environmentVariables'
```

### Domain stuck in `PENDING_VERIFICATION`

ACM certificate DNS validation can take 10–30 min. Confirm the
validation CNAME exists:

```powershell
aws amplify get-domain-association `
  --app-id d36f230uhjp2x3 --domain-name penyzen.com --region us-east-1 `
  --query 'domainAssociation.certificateVerificationDNSRecord'

# Compare against what's in Route 53
aws route53 list-resource-record-sets `
  --hosted-zone-id Z04009072KRDXZRF0HM85 `
  --query "ResourceRecordSets[?Type=='CNAME']"
```

The Amplify CDK construct creates the validation record automatically,
so this is usually just a propagation wait.

### Build #1 succeeded but subsequent builds fail with cache errors

Clear the build cache via the console (Amplify → app → Hosting →
Build settings → Clear cache), then start a fresh `RELEASE` job.

---

## Operational reference

| Resource           | Value                                                       |
|--------------------|-------------------------------------------------------------|
| Amplify App ID     | `d36f230uhjp2x3`                                            |
| Amplify console    | <https://us-east-1.console.aws.amazon.com/amplify/home?region=us-east-1#/d36f230uhjp2x3> |
| Default domain     | `d36f230uhjp2x3.amplifyapp.com`                             |
| Custom domain      | `https://dev.penyzen.com`                                   |
| Source repo        | `https://github.com/penyzen/penyzen`                        |
| Source branch      | `master` (DEVELOPMENT stage, auto-build enabled)            |
| Build spec source  | `amplify.yml` (repo root) + inline copy in `web-stack.ts`   |
| Backend API        | `https://mb9z793u94.execute-api.us-east-1.amazonaws.com`    |
| Cognito User Pool  | `us-east-1_xeJagUO72`                                       |
| Cognito Client ID  | `48d6sdei2i1itku2rfdu3ps2js`                                |
| Route 53 zone      | `Z04009072KRDXZRF0HM85`                                     |

### Common operations

**Trigger a manual build:**
```powershell
aws amplify start-job --app-id d36f230uhjp2x3 --branch-name master `
  --region us-east-1 --job-type RELEASE
```

**Rotate the GitHub PAT:**
1. Generate new PAT (Step 1 procedure).
2. `aws amplify update-app --app-id d36f230uhjp2x3 --access-token <new-pat> --region us-east-1`
3. Revoke the old PAT at <https://github.com/settings/tokens>.
4. Re-run Step 4 *only if* `list-branches` and the domain mapping went empty (check first).

**Promote to production (`www.penyzen.com`):**
- Deploy `PenyzenWeb-prod` with `-c env=prod`.
- Repeat Steps 3–7 with the prod app ID, `--stage PRODUCTION`,
  `prefix=www`.

**Tear down (DESTRUCTIVE):**
```powershell
cd C:\Users\fanet\penyzen\infra
npx cdk destroy PenyzenWeb-dev
```
The Amplify App is removed but the GitHub repo is untouched. The
PAT must be revoked separately on GitHub.

---

## Change log

- **2026-05-14**: Initial deploy. App created, branch wiped on
  `update-app`, recreated, build #1 failed on artifact paths, build #2
  succeeded after `7fd7fbd` fix. Site live at `https://dev.penyzen.com`.
