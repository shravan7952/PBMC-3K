# CodeCell.ai — scRNA Explorer
# ──────────────────────────────────────────────────────────────────
# Startup script: launches FastAPI backend in background, then
# opens the React dev server in a second terminal window.
# Run from the project root: c:\antigravity projects\PBMC 3K\
# ──────────────────────────────────────────────────────────────────

$nodeDir = "C:\Users\shravan\node"
$env:PATH = "$nodeDir;$env:PATH"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── Load .env file if present ─────────────────────────────────────────────────
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
    Write-Host "🔑 Loading .env file..." -ForegroundColor Cyan
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
            $key   = $Matches[1].Trim()
            $value = $Matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
            Write-Host "   ✓ $key loaded" -ForegroundColor DarkGreen
        }
    }
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       CodeCell.ai – scRNA Explorer       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Start Backend ──────────────────────────────────────────────
Write-Host "🚀 Starting FastAPI backend..." -ForegroundColor Green
$backendScript = @"
cd '$root\backend'
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript -WindowStyle Normal

Start-Sleep -Seconds 3

# ── 2. Install frontend deps if needed ────────────────────────────
$nodeModules = Join-Path $root "frontend\node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "📦 Installing frontend dependencies (first run)..." -ForegroundColor Yellow
    Push-Location "$root\frontend"
    & npm install
    Pop-Location
}

# ── 3. Start Frontend ─────────────────────────────────────────────
Write-Host "⚛️  Starting React dev server..." -ForegroundColor Green
$frontendScript = @"
`$env:PATH = '$nodeDir;' + `$env:PATH
cd '$root\frontend'
npm run dev
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript -WindowStyle Normal

Write-Host ""
Write-Host "✅ Both servers are starting up!" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend  → http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "  Frontend → http://localhost:5173"  -ForegroundColor Cyan
Write-Host ""
Write-Host "⏳ The backend needs ~60s to preprocess PBMC 3K data on first run." -ForegroundColor Yellow
Write-Host ""

# Open browser after a delay
Start-Sleep -Seconds 8
Start-Process "http://localhost:5173"
