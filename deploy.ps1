# Workfront Custom Widget - Complete Deployment Orchestration
# Handles Local, Stage, and Production deployments in sequence

param(
    [ValidateSet("local", "stage", "prod", "all")]
    [string]$Environment = "local",
    [switch]$SkipTests = $false,
    [switch]$Force = $false
)

$projectRoot = Get-Location
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

Write-Host "`n╔═══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ Workfront Custom Widget - Deployment Manager  ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Color functions
function Write-Success { Write-Host $args[0] -ForegroundColor Green }
function Write-Error-Custom { Write-Host $args[0] -ForegroundColor Red }
function Write-Warning-Custom { Write-Host $args[0] -ForegroundColor Yellow }
function Write-Info { Write-Host $args[0] -ForegroundColor Cyan }

function Deploy-Local {
    Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
    Write-Host "STEP 1: LOCAL DEVELOPMENT SERVER" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host ""

    Write-Info "Starting local development server..."
    Write-Info "This will serve the UI locally while using Runtime actions"
    Write-Info ""
    Write-Info "Your app will be available at: http://localhost:9080"
    Write-Info "Press Ctrl+C to stop the server"
    Write-Info ""
    Write-Warning-Custom "Make sure no other process is using port 9080`n"

    & aio app run
}

function Deploy-Stage {
    Write-Host "`n" + ("=" * 60) -ForegroundColor Yellow
    Write-Host "STEP 2: STAGE ENVIRONMENT DEPLOYMENT" -ForegroundColor Yellow
    Write-Host ("=" * 60) -ForegroundColor Yellow
    Write-Host ""

    Write-Info "Building and deploying to Stage environment..."

    # Run the stage deployment script
    if (Test-Path "deploy-stage.ps1") {
        & .\deploy-stage.ps1
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Stage deployment failed"
            return $false
        }
    } else {
        Write-Error-Custom "deploy-stage.ps1 not found"
        return $false
    }

    return $true
}

function Deploy-Prod {
    Write-Host "`n" + ("=" * 60) -ForegroundColor Red
    Write-Host "STEP 3: PRODUCTION ENVIRONMENT DEPLOYMENT" -ForegroundColor Red
    Write-Host ("=" * 60) -ForegroundColor Red
    Write-Host ""

    Write-Warning-Custom "⚠️  PRODUCTION DEPLOYMENT - AFFECTS ALL LIVE USERS ⚠️`n"

    if (-not $Force) {
        Write-Info "Verifying Stage deployment was successful before proceeding..."
        $confirm = Read-Host "Did Stage deployment complete successfully? (yes/no)"
        if ($confirm -ne "yes") {
            Write-Warning-Custom "Skipping Production deployment`n"
            return $false
        }
    }

    # Run the production deployment script
    if (Test-Path "deploy-prod.ps1") {
        & .\deploy-prod.ps1
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Production deployment failed"
            return $false
        }
    } else {
        Write-Error-Custom "deploy-prod.ps1 not found"
        return $false
    }

    return $true
}

# Main execution
Write-Info "Environment selected: $Environment"
Write-Host ""

switch ($Environment) {
    "local" {
        Deploy-Local
    }
    "stage" {
        $success = Deploy-Stage
        if ($success) {
            Write-Success "`n✓ Stage deployment ready for testing"
        }
    }
    "prod" {
        $success = Deploy-Prod
        if ($success) {
            Write-Success "`n✓ Production deployment complete"
        }
    }
    "all" {
        Write-Warning-Custom "`n⚠️  Full deployment will proceed in these steps:`n"
        Write-Info "  1. LOCAL - Start development server"
        Write-Info "  2. STAGE - Deploy to stage environment"
        Write-Info "  3. PROD  - Deploy to production environment`n"

        $confirm = Read-Host "Continue with full deployment sequence? (yes/no)"
        if ($confirm -eq "yes") {
            # Stage
            $stageSuccess = Deploy-Stage
            if (-not $stageSuccess) {
                Write-Error-Custom "Stage deployment failed. Aborting production deployment."
                exit 1
            }

            # Prod
            $prodSuccess = Deploy-Prod
            if ($prodSuccess) {
                Write-Success "`n✓ Complete deployment sequence finished successfully"
            }
        } else {
            Write-Info "Deployment cancelled`n"
        }
    }
}

Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Info "Deployment manager finished"
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host ""

