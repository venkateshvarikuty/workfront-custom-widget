# Deployment Scripts - Quick Reference

This directory contains automated deployment scripts for the Workfront Custom Widget. Choose the script that matches your deployment target.

## 📋 Quick Start

### For Local Development (Recommended for first-time setup)
```powershell
.\deploy.ps1 -Environment local
```
or simply:
```powershell
aio app run
```

### For Stage Deployment
```powershell
.\deploy-stage.ps1
```

### For Production Deployment
```powershell
.\deploy-prod.ps1
```

---

## 📜 Script Details

### 1. `deploy.ps1` - Master Deployment Orchestrator

**Purpose:** Central deployment manager that can handle all environments

**Usage:**
```powershell
# Local development (default)
.\deploy.ps1 -Environment local

# Stage deployment
.\deploy.ps1 -Environment stage

# Production deployment
.\deploy.ps1 -Environment prod

# Full deployment sequence (local → stage → prod)
.\deploy.ps1 -Environment all

# Skip confirmation prompts (use with caution)
.\deploy.ps1 -Environment stage -Force
```

**What it does:**
- ✓ Verifies all prerequisites (Node.js, npm, aio CLI)
- ✓ Checks dependencies are installed
- ✓ Builds the application
- ✓ Switches to appropriate workspace
- ✓ Deploys to selected environment
- ✓ Displays deployment URLs

---

### 2. `deploy-stage.ps1` - Stage Environment Deployment

**Purpose:** Deploy to the Stage workspace for pre-production testing

**Usage:**
```powershell
# Standard deployment
.\deploy-stage.ps1

# Skip rebuild (if already built)
.\deploy-stage.ps1 -SkipBuild

# Verbose output
.\deploy-stage.ps1 -Verbose
```

**What it does:**
- ✓ Builds the application
- ✓ Switches to Stage workspace
- ✓ Deploys all actions and UI
- ✓ Uploads to CDN
- ✓ Displays Stage deployment URLs

**When to use:**
- Testing before production
- Validating API integrations
- Staging user acceptance testing (UAT)
- Verifying deployment process

---

### 3. `deploy-prod.ps1` - Production Deployment

**⚠️ WARNING: This affects all live users**

**Usage:**
```powershell
# Standard deployment (requires confirmations)
.\deploy-prod.ps1

# Force deployment (skip confirmations - use with extreme caution)
.\deploy-prod.ps1 -Force

# Skip rebuild
.\deploy-prod.ps1 -SkipBuild
```

**What it does:**
- ✓ Displays pre-deployment checklist
- ✓ Builds the application
- ✓ Switches to Production workspace
- ✓ Requires multiple confirmations
- ✓ Deploys to production
- ✓ Displays production URLs

**When to use:**
- Deploying tested, approved code to production
- After successful Stage testing
- With stakeholder approval

**Safety features:**
- ✓ Pre-deployment checklist verification
- ✓ Multiple confirmation prompts
- ✓ Workspace verification before deployment
- ✓ Final deployment confirmation (requires exact text input)

---

## 🔄 Typical Deployment Workflow

### First Time Setup
```powershell
# 1. Verify local environment works
.\deploy.ps1 -Environment local

# 2. Test locally at http://localhost:9080

# 3. Deploy to Stage
.\deploy.ps1 -Environment stage

# 4. Test in Stage Workfront instance

# 5. Deploy to Production
.\deploy.ps1 -Environment prod
```

### Subsequent Deployments (Hotfix/Updates)
```powershell
# Update code and commit changes

# Test locally
aio app run

# Deploy to Stage
.\deploy-stage.ps1

# Test in Stage

# Deploy to Production
.\deploy-prod.ps1
```

---

## 🛠️ Prerequisites

Before running deployment scripts, ensure:

1. **Node.js & npm** installed
   ```powershell
   node --version
   npm --version
   ```

2. **Adobe App Builder CLI installed**
   ```powershell
   aio --version
   ```
   If not installed:
   ```powershell
   npm install -g @adobe/aio-cli
   ```

3. **Dependencies installed**
   ```powershell
   npm install
   ```

4. **Adobe I/O credentials configured**
   - `.env` file exists in project root
   - Contains valid `AIO_runtime_auth` and `AIO_runtime_namespace`
   - Run `aio app use` to set up if needed

5. **Adobe Developer Console access**
   - Stage workspace created and enabled
   - Production workspace created and enabled
   - Both workspaces have Adobe Runtime enabled

---

## 📋 Pre-Deployment Checklist

### Before Any Deployment
- [ ] All code changes committed to Git
- [ ] No uncommitted changes in working directory
- [ ] All dependencies installed (`npm install`)
- [ ] Local testing completed
- [ ] No console errors or warnings
- [ ] Environment-specific configuration verified

### Before Stage Deployment
- [ ] Stage Workfront instance URL verified
- [ ] Workfront API credentials current
- [ ] Workspace switched to "Stage"

### Before Production Deployment
- [ ] Stage testing completed successfully
- [ ] All stakeholders approved
- [ ] Rollback plan in place
- [ ] Backup of current production state
- [ ] Team notified of deployment
- [ ] Monitoring/alerting configured
- [ ] Workspace switched to "Production"

---

## 📊 Deployment Environments

### Local (Development)
```
URL: http://localhost:9080
Purpose: Development and testing
Actions: Deployed to Runtime (default workspace)
UI: Served locally
Auto-reload: Yes
Duration: Until Ctrl+C
```

### Stage (Pre-Production)
```
Environment: Adobe Runtime Stage
Workspace: Stage
Purpose: Testing and UAT
Actions: Deployed to Runtime
UI: CDN deployed
URL: Provided after `aio app deploy`
Duration: Permanent (until undeployed)
```

### Production (Live)
```
Environment: Adobe Runtime Production
Workspace: Production
Purpose: Live user access
Actions: Deployed to Runtime
UI: CDN deployed
URL: Provided after `aio app deploy`
Duration: Permanent (until undeployed)
Affects: All production users
```

---

## 🔍 Viewing Deployment Logs

After deployment, view logs with:

```powershell
# View recent logs
aio app logs

# Follow logs in real-time
aio app logs -f

# View specific action logs
aio app logs --action <action-name>
```

---

## 🔗 Useful Commands

```powershell
# List all actions in current workspace
aio runtime action list

# Invoke an action directly
aio runtime action invoke <action-name>

# Get current workspace info
aio runtime namespace get

# Switch workspace
aio app use

# List available workspaces
aio app use --list

# Undeploy (removes from current workspace)
aio app undeploy

# Check deployment status
aio console workspace select
```

---

## ❌ Troubleshooting

### Scripts won't run
```powershell
# Enable script execution (one time)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Port 9080 already in use
```powershell
# Find and kill process using port 9080
Get-NetTCPConnection -LocalPort 9080 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

### Deployment fails
```powershell
# Clear cache and rebuild
Remove-Item -Recurse -Force dist, .parcel-cache
npm install
.\deploy-stage.ps1
```

### Workspace not found
```powershell
# List available workspaces
aio app use --list

# Re-authenticate if needed
aio app use
```

---

## 📞 Support

For issues or questions:
1. Check deployment logs: `aio app logs`
2. Review DEPLOYMENT_GUIDE.md for detailed information
3. Check Adobe App Builder documentation
4. Review your `.env` file configuration

---

## 🔐 Security Notes

⚠️ **IMPORTANT:**

1. **Never commit sensitive credentials** (`.env` should be in `.gitignore`)
2. **Keep access tokens current** - Request fresh ones periodically
3. **Use different credentials** for stage and production
4. **Rotate credentials regularly** - Follow your security policy
5. **Monitor deployment logs** - Check for unauthorized changes
6. **Restrict production access** - Limited deploy permissions

Current security issue in code (needs fixing):
- Hardcoded Workfront credentials in `CustomwidgetMainMenuItem.js`
- Move to environment variables before production deployment
- Use Adobe Secrets Management for sensitive data

---

## 📚 References

- [Adobe App Builder CLI Documentation](https://github.com/adobe/aio-cli)
- [Workfront UI Extensibility Guide](https://experienceleague.adobe.com/en/docs/workfront/using/app-builder/app-builder)
- [Adobe I/O Runtime](https://developer.adobe.com/runtime/)
- [React Spectrum Components](https://react-spectrum.adobe.com/)

---

**Last Updated:** June 8, 2026
**Version:** 1.0

