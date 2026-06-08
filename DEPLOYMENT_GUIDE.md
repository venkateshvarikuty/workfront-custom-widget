# Workfront Custom Widget - Deployment Guide

This guide covers deploying the Workfront Custom Widget to Local, Stage, and Production environments following Adobe App Builder best practices.

## Prerequisites

- Adobe App Builder CLI (`aio`) installed: `@adobe/aio-cli/11.1.2` ✓
- Node.js and npm configured
- Adobe I/O credentials and Runtime access
- `.env` file configured with workspace credentials

## Deployment Environments

Your Adobe App Builder project has three deployment targets:

### 1. **LOCAL ENVIRONMENT** (Development)
- **Purpose**: Local testing and development
- **URL**: `http://localhost:9080`
- **Commands Used**: 
  - `aio app run` - Start local dev server with deployed actions
  - `aio app dev` - Run both UI and actions locally (for debugging)
- **Status**: Currently running locally

### 2. **STAGE ENVIRONMENT** 
- **Purpose**: Pre-production testing
- **Workspace**: Stage (from Adobe Developer Console)
- **Last Modified**: Jun 5, 2026
- **Status**: Adobe Runtime enabled
- **Deployment Command**: `aio app deploy`

### 3. **PRODUCTION ENVIRONMENT**
- **Purpose**: Live production deployment
- **Workspace**: Production (in development mode)
- **Last Modified**: Jun 4, 2026
- **Status**: Adobe Runtime enabled
- **Deployment Command**: `aio app deploy`

---

## Step-by-Step Deployment Process

### Step 1: LOCAL BUILD & TEST ✓ (COMPLETED)

The local dev server is now running:

```bash
aio app run
```

**What this does:**
- Serves the UI locally on `http://localhost:9080`
- Deploys actions to Adobe I/O Runtime (Stage environment by default)
- Watches for file changes and reloads automatically
- Perfect for development and testing

**Local Access:**
- **Main App**: http://localhost:9080
- **Widget 1**: Generic Form widget
- **Widget 2**: Another Widget

---

### Step 2: DEPLOY TO STAGE ENVIRONMENT

To deploy to the Stage workspace:

```bash
# 1. Switch to Stage workspace (if needed)
aio app use

# 2. Select "Stage" workspace from the list

# 3. Build and deploy to Stage
aio app deploy
```

**What `aio app deploy` does:**
- Builds all actions
- Packages the UI (web-src)
- Deploys actions to Adobe I/O Runtime
- Uploads static files to CDN
- Generates deployment URLs

**Expected Output:**
```
✔ Building Web Assets
✔ Bundling actions
✔ Deploying to Adobe I/O Runtime
✔ Deployment complete
```

**Stage Access:**
- Your app will be available at a CDN URL provided in the deploy output
- Test the widget in your Stage Workfront instance
- Verify API integration with Stage Workfront server

---

### Step 3: DEPLOY TO PRODUCTION ENVIRONMENT

To deploy to Production:

```bash
# 1. Switch to Production workspace
aio app use

# 2. Select "Production" workspace from the list

# 3. Build and deploy to Production
aio app deploy
```

**Important Notes:**
- ⚠️ Make sure all testing is complete in Stage
- ⚠️ Verify all credentials and configurations are correct
- Production deployment affects all live users

**Production Access:**
- Your app will be available at a production CDN URL
- Users can access the widget from the Workfront main menu
- Monitor logs and errors after deployment

---

## Environment Configuration

### Current Environment (.env)

```dotenv
AIO_runtime_auth=[YOUR_AUTH_TOKEN]
AIO_runtime_namespace=774367-workfrontwidget-stage
AIO_runtime_apihost=https://adobeioruntime.net
SERVICE_API_KEY=[IF_NEEDED]
```

**To use different environments:**
- After running `aio app use`, the `.env` file will be automatically updated
- The `AIO_runtime_namespace` will change to match the selected workspace

### Workfront Integration

**⚠️ IMPORTANT - Security Configuration Needed:**

Your current implementation has hardcoded credentials in `CustomwidgetMainMenuItem.js`:

```javascript
const WORKFRONT_API_BASE_URL = 'https://origin-dluxtechapacptrsdwf.my.workfront.com/attask/api/v21.0';
const WORKFRONT_SESSION_ID = '094fe1b2fdbc498eaaace42bfe6467c3';
```

**Recommendation:**
1. Move these to environment variables
2. Store sensitive credentials in Adobe Secret Management
3. Use different Workfront instances for Stage and Production

**To fix this:**
```javascript
// Use environment-specific configs
const WORKFRONT_API_BASE_URL = process.env.WORKFRONT_API_BASE_URL || 'https://your-workfront-instance.com/attask/api/v21.0';
const WORKFRONT_SESSION_ID = process.env.WORKFRONT_SESSION_ID;
```

---

## Deployment Checklist

### Pre-Deployment (All Environments)
- [ ] All code changes committed to Git
- [ ] No console errors or warnings
- [ ] All dependencies installed (`npm install`)
- [ ] Environment-specific credentials set
- [ ] Workfront API endpoints are correct

### Pre-Stage Deployment
- [ ] All development testing complete
- [ ] Local build successful
- [ ] No security issues in code

### Pre-Production Deployment
- [ ] All Stage testing passed
- [ ] Stakeholder approval obtained
- [ ] Backup/rollback plan in place
- [ ] Monitoring configured
- [ ] Credentials rotated if needed

### Post-Deployment (All Environments)
- [ ] Verify deployment URLs are accessible
- [ ] Test widget in Workfront menu
- [ ] Check browser console for errors
- [ ] Verify API calls are successful
- [ ] Test all user workflows

---

## Troubleshooting

### Common Issues

#### 1. Local Server Not Starting
```bash
# Kill existing processes
lsof -i :9080 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Clear cache and rebuild
rm -rf dist/ .parcel-cache/
npm install
aio app run
```

#### 2. Deployment Fails
```bash
# Check current workspace
aio app list extension

# Verify credentials
aio console workspace select

# Rebuild before deploy
aio app build
aio app deploy
```

#### 3. Widget Not Appearing in Workfront
- Verify `extension-manifest.json` configuration
- Check that mainMenuItems are properly defined
- Ensure deployment to correct workspace
- Clear Workfront browser cache
- Test in Incognito/Private mode

#### 4. API Integration Not Working
- Verify `WORKFRONT_API_BASE_URL` is correct for environment
- Check `WORKFRONT_SESSION_ID` is valid and not expired
- Verify network requests in browser DevTools
- Check Adobe I/O Runtime logs: `aio app logs`

---

## View Logs

### Local Development Logs
```bash
# View runtime logs
aio app logs

# Follow logs in real-time
aio app logs -f
```

### Production Logs
```bash
# After deployment to a workspace
aio app logs
```

---

## Useful Commands

```bash
# List all actions
aio runtime action list

# Invoke an action directly
aio runtime action invoke <action-name>

# View runtime namespace
aio runtime namespace get

# Get deployment history
aio console workspace select

# Undeploy (removes from Production/Stage)
aio app undeploy

# Help with commands
aio app --help
aio app deploy --help
```

---

## Next Steps

1. **✓ DONE**: Local build and testing
2. **NEXT**: Deploy to Stage workspace
3. **FINAL**: Deploy to Production workspace

Start with Step 2 (Stage Deployment) and run the commands listed above.

---

## References

- [Adobe App Builder Documentation](https://developer.adobe.com/app-builder/docs/)
- [Workfront UI Extensibility](https://experienceleague.adobe.com/en/docs/workfront/using/app-builder/app-builder#test-the-app-in-workfront)
- [React Spectrum Components](https://react-spectrum.adobe.com/)


