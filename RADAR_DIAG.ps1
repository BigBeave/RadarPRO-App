# RADAR_DIAG.ps1
# Run from: D:\RadarPRO-App
# Output: D:\RadarPRO-App\RADAR_DIAG_REPORT.txt

$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$report = Join-Path $root "RADAR_DIAG_REPORT.txt"
"RADAR PRO DIAG REPORT" | Out-File $report -Encoding utf8
("Timestamp: " + (Get-Date)) | Out-File $report -Append
("Root: " + $root) | Out-File $report -Append
"=========================================" | Out-File $report -Append

# 1) Local structure
"LOCAL STRUCTURE (top level)" | Out-File $report -Append
Get-ChildItem -Force $root | Select-Object Name,Mode | Format-Table -AutoSize | Out-String | Out-File $report -Append
"-----------------------------------------" | Out-File $report -Append

"LOCAL FRONTEND LISTING" | Out-File $report -Append
if (Test-Path "$root\frontend") {
  Get-ChildItem -Force "$root\frontend" -Recurse | Select-Object FullName,Length | Format-Table -AutoSize | Out-String | Out-File $report -Append
} else {
  "MISSING: $root\frontend" | Out-File $report -Append
}
"-----------------------------------------" | Out-File $report -Append

"LOCAL BACKEND LISTING" | Out-File $report -Append
if (Test-Path "$root\backend") {
  Get-ChildItem -Force "$root\backend" | Select-Object Name,Length | Format-Table -AutoSize | Out-String | Out-File $report -Append
} else {
  "MISSING: $root\backend" | Out-File $report -Append
}
"=========================================" | Out-File $report -Append

# 2) Git status + branch
"GIT STATUS" | Out-File $report -Append
git status | Out-String | Out-File $report -Append
"-----------------------------------------" | Out-File $report -Append

"GIT BRANCH + REMOTES" | Out-File $report -Append
git branch -vv | Out-String | Out-File $report -Append
git remote -v | Out-String | Out-File $report -Append
"-----------------------------------------" | Out-File $report -Append

# 3) Does Git still contain ghost folders?
"GIT TRACKED PATH CHECK" | Out-File $report -Append
"Looking for tracked 'frontend/frontend'..." | Out-File $report -Append
git ls-files | Select-String -SimpleMatch "frontend/frontend" | Out-String | Out-File $report -Append
"-----------------------------------------" | Out-File $report -Append

"HEAD TREE (frontend)" | Out-File $report -Append
git ls-tree -r --name-only HEAD frontend | Out-String | Out-File $report -Append
"-----------------------------------------" | Out-File $report -Append

# 4) Show the first 80 lines of frontend/index.html locally (fingerprint)
"LOCAL frontend/index.html (first 80 lines)" | Out-File $report -Append
if (Test-Path "$root\frontend\index.html") {
  Get-Content "$root\frontend\index.html" -TotalCount 80 | Out-String | Out-File $report -Append
} else {
  "MISSING: $root\frontend\index.html" | Out-File $report -Append
}
"=========================================" | Out-File $report -Append

# 5) Try to detect service worker / PWA cache indicators in local index
"PWA/SERVICE WORKER INDICATORS (local index)" | Out-File $report -Append
if (Test-Path "$root\frontend\index.html") {
  $idx = Get-Content "$root\frontend\index.html" -Raw
  if ($idx -match "serviceWorker|navigator\.serviceWorker|register\(") {
    "FOUND: service worker registration code in index.html" | Out-File $report -Append
  } else {
    "NOT FOUND: service worker registration code in index.html" | Out-File $report -Append
  }
} else {
  "SKIP: index missing" | Out-File $report -Append
}
"=========================================" | Out-File $report -Append

# 6) Live fetch fingerprints (YOU MUST EDIT THESE URLs)
$FRONTEND_URL = "https://radarpro-dashboard.onrender.com"
$API_URL      = "https://radarpro-api.onrender.com/data"

"LIVE CHECKS" | Out-File $report -Append
("FRONTEND_URL: " + $FRONTEND_URL) | Out-File $report -Append
("API_URL: " + $API_URL) | Out-File $report -Append
"-----------------------------------------" | Out-File $report -Append

"FETCH LIVE FRONTEND HTML (first 60 lines)" | Out-File $report -Append
try {
  $live = Invoke-WebRequest -UseBasicParsing $FRONTEND_URL -TimeoutSec 20
  $lines = ($live.Content -split "`n")[0..59] -join "`n"
  $lines | Out-File $report -Append
} catch {
  ("FAILED to fetch FRONTEND: " + $_.Exception.Message) | Out-File $report -Append
}
"-----------------------------------------" | Out-File $report -Append

"FETCH LIVE API SAMPLE (first 1200 chars)" | Out-File $report -Append
try {
  $api = Invoke-WebRequest -UseBasicParsing $API_URL -TimeoutSec 20
  $txt = $api.Content
  if ($txt.Length -gt 1200) { $txt = $txt.Substring(0,1200) }
  $txt | Out-File $report -Append
} catch {
  ("FAILED to fetch API: " + $_.Exception.Message) | Out-File $report -Append
}
"=========================================" | Out-File $report -Append

"DONE. Report saved to: $report" | Out-File $report -Append
Write-Host "DONE. Open: $report"