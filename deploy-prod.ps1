# Workfront Custom Widget - Deployment Script for Production
# This script builds and deploys to the Production environment
# ⚠️ WARNING: This affects all live users - use with caution!

param(
    [switch]$SkipBuild = $false,
    [switch]$Force = $false,
    [switch]$Verbose = $false
)

$projectRoot = Get-Location
$projectName = "workfrontwidget"

Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Red
Write-Host "║ PRODUCTION ENVIRONMENT DEPLOYMENT      ║" -ForegroundColor Red
Write-Host "║ ⚠️  WARNING: AFFECTS ALL LIVE USERS ⚠️ ║" -ForegroundColor Red
Write-Host "╚════════════════════════════════════════╝`n" -ForegroundColor Red

# Color functions
function Write-Success { Write-Host $args[0] -ForegroundColor Green }
function Write-Error-Custom { Write-Host $args[0] -ForegroundColor Red }
function Write-Warning-Custom { Write-Host $args[0] -ForegroundColor Yellow }
function Write-Info { Write-Host $args[0] -ForegroundColor Cyan }

# Pre-deployment checks
Write-Warning-Custom "`n⚠️  PRODUCTION DEPLOYMENT CHECKLIST:`n"
Write-Info "Please verify the following before proceeding:`n"

$checks = @(
    "✓ All code changes are committed to Git",
    "✓ All development testing is complete",
    "✓ All Stage testing has passed",
    "✓ Stakeholder approval has been obtained",
    "✓ Rollback/backup plan is in place",
    "✓ This is NOT a development/test deployment",
    "✓ Workfront API endpoints are for PRODUCTION",
    "✓ You understand this affects ALL live users"
)

foreach ($check in $checks) {
    Write-Host "  $check"
}

Write-Host ""
if (-not $Force) {
    $confirm = Read-Host "Do you confirm all items above? (type 'yes-deploy' to proceed)"
    if ($confirm -ne "yes-deploy") {
        Write-Warning-Custom "`n❌ Deployment cancelled`n"
        exit 0
    }
}

Write-Success "`n✓ Proceeding with Production deployment...`n"

# Check if aio CLI is installed
Write-Info "Checking Adobe App Builder CLI..."
$aioCheck = & aio --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "ERROR: Adobe App Builder CLI (aio) is not installed or not in PATH"
    Write-Info "Install it with: npm install -g @adobe/aio-cli"
    exit 1
}
Write-Success "✓ Adobe CLI found: $aioCheck"

# Check if npm dependencies are installed
Write-Info "`nChecking Node.js dependencies..."
if (-not (Test-Path "node_modules")) {
    Write-Warning-Custom "node_modules not found. Installing dependencies..."
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Failed to install dependencies"
        exit 1
    }
    Write-Success "✓ Dependencies installed"
}
Write-Success "✓ Dependencies ready"

# Build the app (optional)
if (-not $SkipBuild) {
    Write-Info "`nBuilding application..."
    & aio app build
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Build failed"
        exit 1
    }
    Write-Success "✓ Build completed successfully"
}

# Display current workspace info
Write-Info "`nCurrent workspace information:"
$wsInfo = & aio console workspace select 2>&1 | Select-Object -First 10
Write-Host $wsInfo

# Switch to Production workspace
Write-Info "`nSwitching to PRODUCTION workspace..."
Write-Warning-Custom "Select 'Production' workspace from the list below:`n"
& aio app use

# Verify we're on Production
Write-Info "`nVerifying Production workspace selection..."
$currentNS = & aio runtime namespace get 2>&1 | Select-Object -First 1
Write-Info "Current namespace: $currentNS"

if ($currentNS -notmatch "prod") {
    Write-Error-Custom "ERROR: You do not appear to be on the Production workspace"
    $confirm = Read-Host "Continue anyway? (yes/no)"
    if ($confirm -ne "yes") {
        exit 1
    }
}

# Final confirmation before deploy
Write-Host ""
Write-Warning-Custom "⚠️  FINAL WARNING: About to deploy to PRODUCTION`n"
$finalConfirm = Read-Host "Type 'DEPLOY-TO-PRODUCTION' to confirm"
if ($finalConfirm -ne "DEPLOY-TO-PRODUCTION") {
    Write-Warning-Custom "`n❌ Deployment cancelled`n"
    exit 0
}

# Deploy to Production
Write-Info "`n" + ("=" * 50)
Write-Info "Deploying to PRODUCTION environment..."
Write-Info "This may take a few minutes..."
Write-Info ("=" * 50)
Write-Host ""

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Info "Deployment started at: $timestamp"

$deployOutput = & aio app deploy 2>&1
Write-Host $deployOutput

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "`n❌ PRODUCTION deployment failed!`n"
    exit 1
}

$endTimestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Success "`n✓ PRODUCTION deployment completed successfully!`n"
Write-Info "Deployment completed at: $endTimestamp"

# Extract and display deployment URLs
Write-Host ""
Write-Success "📍 Production Deployment URLs:"
$urls = $deployOutput | Select-String -Pattern "https://" | Select-Object -Unique
if ($urls) {
    foreach ($url in $urls) {
        Write-Success "   $url"
    }
}

Write-Host "`n" + ("=" * 50) -ForegroundColor Cyan
Write-Host "Post-Deployment Actions" -ForegroundColor Cyan
Write-Host ("=" * 50) -ForegroundColor Cyan
Write-Host ""
Write-Info "1. ✓ Test the widget in your Production Workfront instance"
Write-Info "2. ✓ Verify all API calls are working correctly"
Write-Info "3. ✓ Monitor application logs for errors"
Write-Info "4. ✓ Communicate deployment to your team"
Write-Info "5. ✓ Monitor user feedback for any issues"
Write-Info ""
Write-Info "To view logs:"
Write-Info "   aio app logs"
Write-Info "   aio app logs -f  (follow mode)`n"

Write-Success "✓ Production deployment complete!`n"

