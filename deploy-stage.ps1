# Workfront Custom Widget - Deployment Script for Stage
# This script builds and deploys to the Stage environment

param(
    [switch]$SkipBuild = $false,
    [switch]$Verbose = $false
)

$projectRoot = Get-Location
$projectName = "workfrontwidget"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "STAGE ENVIRONMENT DEPLOYMENT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Color functions
function Write-Success { Write-Host $args[0] -ForegroundColor Green }
function Write-Error-Custom { Write-Host $args[0] -ForegroundColor Red }
function Write-Warning-Custom { Write-Host $args[0] -ForegroundColor Yellow }
function Write-Info { Write-Host $args[0] -ForegroundColor Cyan }

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

# Switch to Stage workspace
Write-Info "`nSwitching to STAGE workspace..."
$stageSelect = & aio app use --list 2>&1

if ($stageSelect -match "Stage") {
    Write-Warning-Custom "Select 'Stage' workspace from the list below:"
    & aio app use
} else {
    Write-Error-Custom "Stage workspace not found. Available workspaces:"
    & aio app use
    exit 1
}

# Verify we're on Stage
Write-Info "`nVerifying Stage workspace selection..."
$currentNS = & aio runtime namespace get 2>&1 | Select-Object -First 1
Write-Info "Current namespace: $currentNS"

if ($currentNS -notmatch "stage") {
    Write-Warning-Custom "WARNING: You may not be on the Stage workspace"
    $confirm = Read-Host "Continue with deployment? (yes/no)"
    if ($confirm -ne "yes") {
        exit 1
    }
}

# Deploy to Stage
Write-Info "`nDeploying to STAGE environment..."
Write-Info "This may take a few minutes..."
Write-Host ""

$deployOutput = & aio app deploy 2>&1
Write-Host $deployOutput

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Deployment failed"
    exit 1
}

Write-Success "`n✓ STAGE deployment completed successfully!`n"

# Extract and display deployment URLs
Write-Info "Deployment URLs:"
$urls = $deployOutput | Select-String -Pattern "https://" | Select-Object -Unique
if ($urls) {
    foreach ($url in $urls) {
        Write-Success "  $url"
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Info "1. Test the widget in your Stage Workfront instance"
Write-Info "2. Verify all API calls are working correctly"
Write-Info "3. Test all user workflows"
Write-Info "4. When ready, run deploy-prod.ps1 for production deployment"
Write-Info ""

Write-Success "✓ Stage deployment ready for testing!`n"

