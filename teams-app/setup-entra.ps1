# Automates the Entra + Teams admin setup for the AAMC RPL Teams app.
#
# Prerequisites (run once as admin):
#   Install-Module Microsoft.Graph      -Scope CurrentUser -Force
#   Install-Module MicrosoftTeams       -Scope CurrentUser -Force
#
# Run (signed in as a Global/Cloud Application Administrator + Teams Admin):
#   cd teams-app
#   powershell -ExecutionPolicy Bypass -File .\setup-entra.ps1
#
# What it does:
#   1. Connects to Microsoft Graph and Microsoft Teams.
#   2. Updates the Entra app registration:
#        - Sets the Application ID URI to api://<host>/<clientId>
#        - Adds an "access_as_user" delegated scope
#        - Pre-authorises Teams desktop (1fec...) and Teams web (5e3c...) clients
#        - Adds the ?inTeams=1 SPA redirect URI
#   3. Grants admin consent for the Microsoft Graph delegated scopes the app uses.
#   4. Creates/updates a CsApplicationAccessPolicy so Graph transcript APIs work.
#
# Re-running is safe: each step detects existing values and skips or merges.

[CmdletBinding()]
param(
  [string]$ClientId    = '5c13413f-3311-4668-a3a3-e549bed05acd',
  [string]$TenantId    = '63871d3c-d05d-49fa-86b6-420054699fb4',
  [string]$AppHost     = 'aamc-rpl-live-ecgua6ceb4fkgfh0.australiaeast-01.azurewebsites.net',
  [string]$PolicyName  = 'AAMC-RPL-TranscriptReader',
  [switch]$SkipGraph,
  [switch]$SkipTeams
)

$ErrorActionPreference = 'Stop'
Write-Host ''
Write-Host '=== AAMC RPL Teams App — Entra & Teams setup ===' -ForegroundColor Cyan
Write-Host "ClientId : $ClientId"
Write-Host "TenantId : $TenantId"
Write-Host "Host     : $AppHost"
Write-Host ''

# Microsoft Graph client IDs for Teams clients (well-known constants).
$TeamsDesktopClientId = '1fec8e78-bce4-4aaf-ab1b-5451cc387264'
$TeamsWebClientId     = '5e3ce6c0-2b1f-4285-8d4b-75ee78787346'

# Delegated Graph scopes this app needs.
$RequiredGraphScopes = @(
  'User.Read',
  'Calendars.Read',
  'OnlineMeetings.Read',
  'OnlineMeetingTranscript.Read.All',
  'OnlineMeetingArtifact.Read.All'
)

# ---------------------------------------------------------------------------
# 1. Microsoft Graph: update app registration + grant admin consent
# ---------------------------------------------------------------------------
if (-not $SkipGraph) {
  Write-Host '[1/3] Connecting to Microsoft Graph...' -ForegroundColor Cyan
  if (-not (Get-Module -ListAvailable Microsoft.Graph.Applications)) {
    throw 'Microsoft.Graph module not installed. Run: Install-Module Microsoft.Graph -Scope CurrentUser'
  }
  Import-Module Microsoft.Graph.Applications -ErrorAction Stop
  Import-Module Microsoft.Graph.Identity.SignIns -ErrorAction Stop

  Connect-MgGraph -TenantId $TenantId -Scopes @(
    'Application.ReadWrite.All',
    'DelegatedPermissionGrant.ReadWrite.All',
    'AppRoleAssignment.ReadWrite.All'
  ) -NoWelcome

  Write-Host '      Fetching app registration...'
  $app = Get-MgApplication -Filter "appId eq '$ClientId'" -ErrorAction Stop | Select-Object -First 1
  if (-not $app) { throw "App registration with clientId $ClientId not found in tenant $TenantId." }
  $appObjectId = $app.Id

  $appIdUri  = "api://$AppHost/$ClientId"
  $scopeId   = [guid]::NewGuid().ToString()
  $redirect  = "https://$AppHost/Live%20Assessment.html?inTeams=1"

  # --- Identifier URI -------------------------------------------------------
  $identifierUris = @($app.IdentifierUris)
  if ($identifierUris -notcontains $appIdUri) {
    $identifierUris += $appIdUri
    Write-Host "      Adding identifier URI: $appIdUri"
  } else {
    Write-Host '      Identifier URI already set.'
  }

  # --- Scope: access_as_user -----------------------------------------------
  $api = $app.Api
  if (-not $api) { $api = @{ Oauth2PermissionScopes = @(); PreAuthorizedApplications = @() } }
  $existingScope = $api.Oauth2PermissionScopes | Where-Object { $_.Value -eq 'access_as_user' } | Select-Object -First 1
  if ($existingScope) {
    $scopeId = $existingScope.Id
    Write-Host '      Scope access_as_user already present.'
  } else {
    Write-Host '      Adding scope access_as_user...'
    $newScope = @{
      Id                      = $scopeId
      AdminConsentDescription = 'Allow the app to access the API as the signed-in user.'
      AdminConsentDisplayName = 'Access AAMC RPL as user'
      UserConsentDescription  = 'Allow the app to access the API on your behalf.'
      UserConsentDisplayName  = 'Access AAMC RPL as you'
      Value                   = 'access_as_user'
      Type                    = 'User'
      IsEnabled               = $true
    }
    $api.Oauth2PermissionScopes = @($api.Oauth2PermissionScopes) + $newScope
  }

  # --- Pre-authorised Teams clients ----------------------------------------
  $preAuth = @($api.PreAuthorizedApplications)
  foreach ($teamsId in @($TeamsDesktopClientId, $TeamsWebClientId)) {
    $match = $preAuth | Where-Object { $_.AppId -eq $teamsId }
    if ($match) {
      if ($match.DelegatedPermissionIds -notcontains $scopeId) {
        $match.DelegatedPermissionIds = @($match.DelegatedPermissionIds) + $scopeId
        Write-Host "      Added scope to pre-authorised Teams client $teamsId."
      }
    } else {
      $preAuth += @{ AppId = $teamsId; DelegatedPermissionIds = @($scopeId) }
      Write-Host "      Pre-authorising Teams client $teamsId."
    }
  }
  $api.PreAuthorizedApplications = $preAuth

  # --- SPA redirect URI -----------------------------------------------------
  $spa = $app.Spa
  if (-not $spa) { $spa = @{ RedirectUris = @() } }
  $spaUris = @($spa.RedirectUris)
  if ($spaUris -notcontains $redirect) {
    $spaUris += $redirect
    Write-Host "      Adding SPA redirect URI: $redirect"
  } else {
    Write-Host '      SPA redirect URI already present.'
  }
  $spa.RedirectUris = $spaUris

  Write-Host '      Applying changes...'
  Update-MgApplication -ApplicationId $appObjectId `
    -IdentifierUris $identifierUris `
    -Api $api `
    -Spa $spa

  # --- Admin consent for Graph scopes --------------------------------------
  Write-Host '[2/3] Granting tenant admin consent for Graph scopes...' -ForegroundColor Cyan
  $graphSp = Get-MgServicePrincipal -Filter "appId eq '00000003-0000-0000-c000-000000000000'" | Select-Object -First 1
  $appSp   = Get-MgServicePrincipal -Filter "appId eq '$ClientId'" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $appSp) {
    Write-Host '      Creating service principal for app...'
    $appSp = New-MgServicePrincipal -AppId $ClientId
  }

  $scopeString = ($RequiredGraphScopes -join ' ')
  $existingGrant = Get-MgOauth2PermissionGrant -Filter "clientId eq '$($appSp.Id)' and resourceId eq '$($graphSp.Id)' and consentType eq 'AllPrincipals'" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existingGrant) {
    $current = ($existingGrant.Scope -split ' ') | Where-Object { $_ }
    $missing = $RequiredGraphScopes | Where-Object { $current -notcontains $_ }
    if ($missing.Count -gt 0) {
      $merged = ($current + $missing | Sort-Object -Unique) -join ' '
      Update-MgOauth2PermissionGrant -OAuth2PermissionGrantId $existingGrant.Id -Scope $merged
      Write-Host "      Added scopes: $($missing -join ', ')"
    } else {
      Write-Host '      All required scopes already consented.'
    }
  } else {
    New-MgOauth2PermissionGrant -ClientId $appSp.Id -ResourceId $graphSp.Id -ConsentType 'AllPrincipals' -Scope $scopeString | Out-Null
    Write-Host "      Consent granted: $scopeString"
  }

  Disconnect-MgGraph | Out-Null
} else {
  Write-Host '[1-2/3] Skipped (Microsoft Graph steps).' -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 3. Microsoft Teams: application access policy for transcript APIs
# ---------------------------------------------------------------------------
if (-not $SkipTeams) {
  Write-Host '[3/3] Configuring Teams CsApplicationAccessPolicy...' -ForegroundColor Cyan
  if (-not (Get-Module -ListAvailable MicrosoftTeams)) {
    throw 'MicrosoftTeams module not installed. Run: Install-Module MicrosoftTeams -Scope CurrentUser'
  }
  Import-Module MicrosoftTeams -ErrorAction Stop
  Connect-MicrosoftTeams -TenantId $TenantId | Out-Null

  $policy = Get-CsApplicationAccessPolicy -Identity $PolicyName -ErrorAction SilentlyContinue
  if ($policy) {
    if ($policy.AppIds -notcontains $ClientId) {
      Set-CsApplicationAccessPolicy -Identity $PolicyName -AppIds (@($policy.AppIds) + $ClientId)
      Write-Host "      Added $ClientId to policy $PolicyName."
    } else {
      Write-Host "      Policy $PolicyName already contains $ClientId."
    }
  } else {
    New-CsApplicationAccessPolicy -Identity $PolicyName -AppIds $ClientId -Description 'AAMC RPL Live Assessment — transcript access' | Out-Null
    Write-Host "      Created policy $PolicyName."
  }

  $grant = Get-CsApplicationAccessPolicy -Identity Global -ErrorAction SilentlyContinue
  if ($grant -and $grant.PolicyName -eq $PolicyName) {
    Write-Host "      Policy $PolicyName already assigned globally."
  } else {
    Grant-CsApplicationAccessPolicy -PolicyName $PolicyName -Global -Force
    Write-Host "      Granted policy $PolicyName globally. Propagation can take up to an hour."
  }

  Disconnect-MicrosoftTeams | Out-Null
} else {
  Write-Host '[3/3] Skipped (Teams policy step).' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '=== Done ===' -ForegroundColor Green
Write-Host 'Next steps:'
Write-Host '  1. Run  .\build.ps1  to regenerate icons + AAMC-RPL-Teams.zip.'
Write-Host '  2. Teams -> Apps -> Manage your apps -> Upload a custom app -> pick the zip.'
Write-Host '  3. Open a Teams meeting -> + Apps -> add "AAMC RPL" to the meeting side panel.'
Write-Host ''
