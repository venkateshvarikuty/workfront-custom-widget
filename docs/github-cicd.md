# GitHub CI/CD Configuration Guide

This document describes the CI/CD pipeline for the Workfront Custom Widget App Builder application using GitHub Actions.

---

## Architecture Overview

```
feature/* branch
    │
    │  Pull Request → main
    ▼
┌──────────────────────────┐
│  App Builder - PR        │   Validates build & tests
│  Validation              │   No deployment
└──────────────────────────┘
    │
    │  Merge to main
    ▼
┌──────────────────────────┐
│  App Builder - Deploy    │   Deploys to Adobe App Builder
│  Stage                   │   Stage workspace
│  (environment: stage)    │   Extensions not published
└──────────────────────────┘
    │
    │  QA / UAT
    │
    │  Create GitHub Release
    ▼
┌──────────────────────────┐
│  App Builder - Deploy    │   Requires approval
│  Production              │   Deploys to Production workspace
│  (environment: production│   Extensions published
└──────────────────────────┘
```

---

## GitHub Environments

Two GitHub Environments must be configured in the repository settings:

### `stage`

- **Purpose**: Holds all credentials for deploying to the Adobe App Builder **Stage** workspace.
- **Protection rules**: None required (deploys automatically on merge to `main`).

### `production`

- **Purpose**: Holds all credentials for deploying to the Adobe App Builder **Production** workspace.
- **Protection rules**:
  - ✅ **Required reviewers** — Add at least one team member who must approve before production deployment proceeds.
  - Optional: Wait timer (e.g., 5 minutes) for additional safety.

To configure environments:

1. Go to **Repository Settings → Environments**
2. Click **New environment** and create `stage`
3. Click **New environment** and create `production`
4. On `production`, click **Add protection rule → Required reviewers** and add approvers

---

## Required Secrets

### Stage Environment Secrets

Add these secrets under **Settings → Environments → stage → Environment secrets**:

| Secret Name | Description |
|---|---|
| `CLIENTID` | OAuth Server-to-Server Client ID (Stage workspace) |
| `CLIENTSECRET` | OAuth Server-to-Server Client Secret (Stage workspace) |
| `TECHNICALACCID` | Technical Account ID (Stage workspace) |
| `TECHNICALACCEMAIL` | Technical Account Email (Stage workspace) |
| `IMSORGID` | IMS Organization ID |
| `SCOPES` | OAuth scopes (JSON array string) |
| `AIO_RUNTIME_NAMESPACE` | Runtime namespace for Stage workspace |
| `AIO_RUNTIME_AUTH` | Runtime auth key for Stage workspace |
| `AIO_PROJECT_ID` | Adobe Developer Console Project ID |
| `AIO_PROJECT_NAME` | Project name |
| `AIO_PROJECT_ORG_ID` | Organization ID |
| `AIO_PROJECT_WORKSPACE_ID` | Stage Workspace ID |
| `AIO_PROJECT_WORKSPACE_NAME` | Stage Workspace name (e.g., `Stage`) |
| `AIO_PROJECT_WORKSPACE_DETAILS_SERVICES` | JSON string of workspace services |

### Production Environment Secrets

Add the same secret names under **Settings → Environments → production → Environment secrets**, but with **Production workspace** values:

| Secret Name | Description |
|---|---|
| `CLIENTID` | OAuth S2S Client ID (Production workspace) |
| `CLIENTSECRET` | OAuth S2S Client Secret (Production workspace) |
| `TECHNICALACCID` | Technical Account ID (Production workspace) |
| `TECHNICALACCEMAIL` | Technical Account Email (Production workspace) |
| `IMSORGID` | IMS Organization ID |
| `SCOPES` | OAuth scopes (JSON array string) |
| `AIO_RUNTIME_NAMESPACE` | Runtime namespace for Production workspace |
| `AIO_RUNTIME_AUTH` | Runtime auth key for Production workspace |
| `AIO_PROJECT_ID` | Adobe Developer Console Project ID |
| `AIO_PROJECT_NAME` | Project name |
| `AIO_PROJECT_ORG_ID` | Organization ID |
| `AIO_PROJECT_WORKSPACE_ID` | Production Workspace ID |
| `AIO_PROJECT_WORKSPACE_NAME` | Production Workspace name (e.g., `Production`) |
| `AIO_PROJECT_WORKSPACE_DETAILS_SERVICES` | JSON string of workspace services |

### Repository-Level Secrets (for PR Validation)

The PR validation workflow cannot access GitHub Environment secrets. These **repository-level** secrets are needed:

| Secret Name | Description |
|---|---|
| `CLIENTID_STAGE` | Same value as Stage environment `CLIENTID` |
| `CLIENTSECRET_STAGE` | Same value as Stage environment `CLIENTSECRET` |
| `TECHNICALACCID_STAGE` | Same value as Stage environment `TECHNICALACCID` |
| `TECHNICALACCEMAIL_STAGE` | Same value as Stage environment `TECHNICALACCEMAIL` |
| `IMSORGID_STAGE` | Same value as Stage environment `IMSORGID` |
| `SCOPES_STAGE` | Same value as Stage environment `SCOPES` |
| `AIO_RUNTIME_NAMESPACE_STAGE` | Same value as Stage environment `AIO_RUNTIME_NAMESPACE` |

> **Note**: These duplicates are necessary because GitHub Actions does not expose environment secrets to PR workflows. Only Stage (non-production) values are used here.

---

## Adobe Developer Console Prerequisites

Each workspace (Stage and Production) must have:

1. **I/O Management API** added as a service
2. **OAuth Server-to-Server** credential created
3. The credential must have scopes that allow interaction with:
   - Extension Registry API
   - Developer Console API

### Getting Secret Values from Adobe Developer Console

1. Open your project in [Adobe Developer Console](https://developer.adobe.com/console/)
2. Select the appropriate workspace (Stage or Production)
3. Go to **Credentials → OAuth Server-to-Server**
4. Copy the Client ID, Client Secret, Technical Account Email, Technical Account ID, Organization ID, and Scopes
5. Go to **Workspace overview** to find Workspace ID, Project ID, etc.
6. Download the workspace configuration JSON for the full set of values

---

## How PR Validation Works

**Trigger**: Any pull request opened, synchronized, or reopened against `main`.

**Workflow file**: `.github/workflows/pr_test.yml`

**What it does**:
1. Checks out the PR branch
2. Sets up Node.js 20
3. Runs `npm ci` for reproducible dependency installation
4. Installs AIO CLI v11
5. Authenticates with Adobe using **Stage** credentials (build-only, no deploy)
6. Runs `aio app build` to verify the application compiles
7. Runs `aio app test` to execute the test suite

**What it does NOT do**:
- ❌ Deploy to any environment
- ❌ Access production secrets

**Concurrency**: Superseded PR runs are automatically cancelled.

---

## How Stage Deployment Works

**Trigger**: Push (merge) to `main` branch.

**Workflow file**: `.github/workflows/deploy_stage.yml`

**What it does**:
1. Checks out `main`
2. Sets up Node.js 20
3. Runs `npm ci`
4. Installs AIO CLI v11
5. Authenticates with Adobe using Stage environment credentials
6. Builds the application
7. Deploys to the **Stage workspace** with `--no-publish` (extensions are deployed but not published to the Exchange)

**Concurrency**: Only one Stage deployment can run at a time. Queued deployments wait rather than cancel the active one.

---

## How Production Deployment Works

**Trigger**: A GitHub Release is **published**.

**Workflow file**: `.github/workflows/deploy_prod.yml`

**What it does**:
1. Checks out the **exact release tag** (not `main` HEAD)
2. Sets up Node.js 20
3. Runs `npm ci`
4. Installs AIO CLI v11
5. Authenticates with Adobe using Production environment credentials
6. Builds the application
7. Deploys to the **Production workspace** (extensions are published)

**Approval**: The `production` environment requires reviewer approval before the deployment job starts.

**Concurrency**: Only one Production deployment can run at a time. No automatic cancellation.

---

## How to Create a Release

1. Complete QA/UAT on the Stage deployment
2. Go to the repository on GitHub
3. Click **Releases → Draft a new release**
4. Click **Choose a tag** and type a new semantic version tag (e.g., `v1.0.0`)
5. Select **Target: main** (or the specific commit you validated)
6. Add release notes describing changes
7. Click **Publish release**

This triggers the `App Builder - Deploy Production` workflow.

### Semantic Versioning

Follow semantic versioning (`vMAJOR.MINOR.PATCH`):

| Change Type | Example |
|---|---|
| Breaking changes | `v1.0.0` → `v2.0.0` |
| New features | `v1.0.0` → `v1.1.0` |
| Bug fixes | `v1.0.0` → `v1.0.1` |

---

## How Production Approval Works

1. The release triggers the production workflow
2. GitHub detects the `environment: production` declaration
3. The workflow **pauses** and requests approval from configured reviewers
4. Reviewers receive a notification and can:
   - ✅ **Approve** → deployment proceeds
   - ❌ **Reject** → deployment is cancelled
5. Only after approval does the build and deploy execute

To check pending approvals:
- Go to **Actions** tab → find the running workflow → click **Review deployments**

---

## How to Rotate Credentials

When credentials expire or need rotation:

1. Generate new credentials in [Adobe Developer Console](https://developer.adobe.com/console/)
2. Update the corresponding GitHub Environment secrets:
   - **Settings → Environments → [stage/production] → Environment secrets**
3. Update repository-level secrets if the rotated credential is used by the PR workflow
4. Trigger a test deployment to verify:
   - Stage: push a change to `main`
   - Production: create a new release

### Which secrets to update per credential type

| Credential Change | Secrets to Update |
|---|---|
| OAuth Client ID/Secret rotated | `CLIENTID`, `CLIENTSECRET` (+ `CLIENTID_STAGE`, `CLIENTSECRET_STAGE` at repo level) |
| Technical Account changed | `TECHNICALACCID`, `TECHNICALACCEMAIL` (+ repo-level equivalents) |
| Runtime auth key changed | `AIO_RUNTIME_AUTH` |
| Workspace changed | `AIO_PROJECT_WORKSPACE_ID`, `AIO_PROJECT_WORKSPACE_NAME`, `AIO_RUNTIME_NAMESPACE` |

---

## Troubleshooting

### Build fails with "Missing IMS context"

**Cause**: OAuth authentication step failed or secrets are misconfigured.

**Fix**:
- Verify `CLIENTID`, `CLIENTSECRET`, `TECHNICALACCID`, `TECHNICALACCEMAIL`, `IMSORGID`, and `SCOPES` are correctly set in the appropriate environment
- Ensure the OAuth Server-to-Server credential has **I/O Management API** scope in Adobe Developer Console

### Build fails with "Namespace not found"

**Cause**: `AIO_RUNTIME_NAMESPACE` is missing or incorrect.

**Fix**:
- Verify the secret value matches the workspace's Runtime namespace (e.g., `774367-wfpopup`)
- This value is visible in Adobe Developer Console under the workspace

### Deploy fails with "Unauthorized" or 403

**Cause**: The OAuth credential lacks required permissions.

**Fix**:
- In Adobe Developer Console, verify the credential has **I/O Management API** service added
- Verify scopes include `adobeio_api`, `read_client_secret`, `manage_client_secrets`

### Deploy fails with "Extension Registry" error

**Cause**: The credential or workspace is not properly configured for extensions.

**Fix**:
- Ensure the workspace has the correct services configured
- Verify `AIO_PROJECT_WORKSPACE_DETAILS_SERVICES` contains the correct JSON

### PR workflow fails but deploy works

**Cause**: Repository-level secrets (`*_STAGE`) are out of sync with environment secrets.

**Fix**:
- Update the repo-level `CLIENTID_STAGE`, `CLIENTSECRET_STAGE`, etc. to match the Stage environment secrets

### "npm ci" fails with lockfile mismatch

**Cause**: `package-lock.json` is out of sync with `package.json`.

**Fix**:
- Run `npm install` locally to regenerate `package-lock.json`
- Commit the updated lockfile

### Production deployment not requesting approval

**Cause**: The `production` GitHub Environment does not have required reviewers configured.

**Fix**:
- Go to **Settings → Environments → production**
- Add **Required reviewers** under protection rules

### Concurrent deployment conflict

**Cause**: Two deployments to the same environment are queued.

**Fix**: The concurrency configuration ensures only one deployment runs per environment. Queued deployments will wait. No action needed — this is by design.

---

## Workflow Files Reference

| File | Trigger | Environment | Deploys? |
|---|---|---|---|
| `.github/workflows/pr_test.yml` | Pull Request → `main` | None (repo secrets) | ❌ |
| `.github/workflows/deploy_stage.yml` | Push to `main` | `stage` | ✅ Stage |
| `.github/workflows/deploy_prod.yml` | GitHub Release published | `production` | ✅ Production |
