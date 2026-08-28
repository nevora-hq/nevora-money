$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null
Set-Location "c:\Users\kokim\OneDrive\デスクトップ\各種サイト\お金サイト"

$logDir = "c:\Users\kokim\OneDrive\デスクトップ\各種サイト\お金サイト\.claude\scripts\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir ("run_{0}.log" -f (Get-Date -Format "yyyyMMdd_HHmmss"))

$prompt = "project-managerサブエージェントに、記事制作サイクル(標準ワークフロー: SEOキーワード調査→執筆→レビュー・法務→編集長→公開)を実行するよう依頼してください。"

try {
    $output = "" | & claude -p $prompt --dangerously-skip-permissions 2>&1 | Out-String
    Set-Content -Path $logFile -Value $output -Encoding UTF8
} catch {
    Add-Content -Path $logFile -Value "ERROR: $_" -Encoding UTF8
}
