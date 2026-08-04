param(
  [ValidateSet('list', 'apply', 'verify')]
  [string]$Action = 'list'
)

$ErrorActionPreference = 'Stop'
$token = [Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN', 'User')
if (-not $token) {
  throw 'SUPABASE_ACCESS_TOKEN não está definido no ambiente do usuário.'
}

$endpoint = 'https://mcp.supabase.com/mcp?project_ref=xdeyoxdtfbueuymvbsbl'
$headers = @{
  Authorization = "Bearer $token"
  Accept = 'application/json, text/event-stream'
}
$script:sessionId = $null

function ConvertFrom-McpResponse {
  param([string]$Content)

  if (-not $Content) {
    return $null
  }
  if ($Content.TrimStart().StartsWith('{')) {
    return $Content | ConvertFrom-Json
  }

  $data = @(
    $Content -split "`r?`n" |
      ForEach-Object {
        if ($_ -match '^data:\s*(.+)$') {
          $Matches[1]
        }
      }
  )
  if (-not $data.Count) {
    throw 'Resposta MCP não reconhecida.'
  }
  return $data[-1] | ConvertFrom-Json
}

function Invoke-Mcp {
  param(
    [string]$Method,
    [object]$Params,
    [int]$Id,
    [switch]$Notification
  )

  $requestHeaders = @{} + $headers
  if ($script:sessionId) {
    $requestHeaders['Mcp-Session-Id'] = $script:sessionId
  }

  $payload = [ordered]@{
    jsonrpc = '2.0'
    method = $Method
  }
  if (-not $Notification) {
    $payload.id = $Id
  }
  if ($null -ne $Params) {
    $payload.params = $Params
  }

  $response = Invoke-WebRequest `
    -Uri $endpoint `
    -Method Post `
    -Headers $requestHeaders `
    -ContentType 'application/json' `
    -Body ($payload | ConvertTo-Json -Depth 20 -Compress) `
    -UseBasicParsing

  if (-not $script:sessionId -and $response.Headers['Mcp-Session-Id']) {
    $script:sessionId = $response.Headers['Mcp-Session-Id']
  }
  return ConvertFrom-McpResponse -Content $response.Content
}

$initialize = Invoke-Mcp `
  -Method 'initialize' `
  -Params @{
    protocolVersion = '2025-03-26'
    capabilities = @{}
    clientInfo = @{
      name = 'prumoq-migration'
      version = '1.0.0'
    }
  } `
  -Id 1

if ($initialize.error) {
  throw "Falha ao inicializar MCP: $($initialize.error.message)"
}

Invoke-Mcp `
  -Method 'notifications/initialized' `
  -Params @{} `
  -Id 0 `
  -Notification | Out-Null

if ($Action -eq 'list') {
  $tools = Invoke-Mcp -Method 'tools/list' -Params @{} -Id 2
  if ($tools.error) {
    throw "Falha ao listar ferramentas: $($tools.error.message)"
  }
  $tools.result.tools |
    Select-Object name, description |
    ConvertTo-Json -Depth 5
  exit 0
}

if ($Action -eq 'apply') {
  $sql = Get-Content `
    -Raw `
    -Encoding utf8 `
    -LiteralPath 'supabase/migrations/021_fvs_report_attachments.sql'
  $result = Invoke-Mcp `
    -Method 'tools/call' `
    -Params @{
      name = 'apply_migration'
      arguments = @{
        name = 'fvs_report_attachments_021'
        query = $sql
      }
    } `
    -Id 3
  if ($result.error) {
    throw "Falha ao aplicar migration: $($result.error.message)"
  }
  $result.result | ConvertTo-Json -Depth 10
  exit 0
}

$verificationSql = @'
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.provolatile as volatility
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_fvs_attachments';
'@

$verification = Invoke-Mcp `
  -Method 'tools/call' `
  -Params @{
    name = 'execute_sql'
    arguments = @{
      query = $verificationSql
    }
  } `
  -Id 4
if ($verification.error) {
  throw "Falha ao verificar migration: $($verification.error.message)"
}
$verification.result | ConvertTo-Json -Depth 10
