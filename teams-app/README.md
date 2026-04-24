# AAMC RPL Live Assessment — Teams App

This folder packages the hosted `public/Live Assessment.html` as a Microsoft Teams app.
It exposes the assessment experience as:

- A **Personal tab** in the Teams left rail.
- A **Meeting side panel** that opens beside the live video during a Teams call.
- A **Meeting chat tab** and **Meeting details tab** for post-meeting review.

No server-side code is added. The Teams app is a thin manifest that points at
the already-deployed Azure App Service URL:

```
https://aamc-rpl-live-ecgua6ceb4fkgfh0.australiaeast-01.azurewebsites.net/Live%20Assessment.html
```

## Folder contents

| File | Purpose |
| --- | --- |
| `appPackage/manifest.json` | Teams manifest declaring tabs + meeting surfaces |
| `appPackage/color.png` | 192×192 app icon (you must supply — see `ICONS.md`) |
| `appPackage/outline.png` | 32×32 outline icon (you must supply — see `ICONS.md`) |
| `README.md` | This file |

## One-time setup

### 1. Generate an app GUID

In the manifest, replace `REPLACE-WITH-GENERATED-GUID` with a new UUID:

```powershell
[guid]::NewGuid().ToString()
```

Paste the result into the `"id"` field of `appPackage/manifest.json`.

### 2. Add the app icons

Follow the instructions in [appPackage/ICONS.md](appPackage/ICONS.md). You need
`color.png` (192×192) and `outline.png` (32×32) sitting next to the manifest.

### 3. Update the Entra app registration for Teams SSO

The manifest references your existing Entra app (`5c13413f-3311-4668-a3a3-e549bed05acd`).
For the Teams app to load cleanly you must:

1. In the Entra app registration, go to **Expose an API** → **Set Application ID URI** to:
   `api://aamc-rpl-live-ecgua6ceb4fkgfh0.australiaeast-01.azurewebsites.net/5c13413f-3311-4668-a3a3-e549bed05acd`
2. Add a scope called `access_as_user` (admin + users can consent).
3. Under **Authentication**, add these SPA redirect URIs (keep the existing one too):
   - `https://aamc-rpl-live-ecgua6ceb4fkgfh0.australiaeast-01.azurewebsites.net/Live%20Assessment.html`
   - `https://aamc-rpl-live-ecgua6ceb4fkgfh0.australiaeast-01.azurewebsites.net/Live%20Assessment.html?inTeams=1`
4. Under **Expose an API → Authorized client applications**, pre-authorize the Teams client IDs so SSO works:
   - `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams mobile/desktop)
   - `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams web)

> Alternatively, scaffold a fresh Entra app with ATK (`atk provision`) and update
> `webApplicationInfo.id` + `webApplicationInfo.resource` in the manifest.

## Packaging the app

From this folder:

```powershell
Compress-Archive -Path appPackage\manifest.json, appPackage\color.png, appPackage\outline.png -DestinationPath AAMC-RPL-Teams.zip -Force
```

The resulting `AAMC-RPL-Teams.zip` is the **app package** you sideload or upload.

## Sideloading (developer test)

1. Open Teams → **Apps** → **Manage your apps** → **Upload an app** → **Upload a custom app**.
2. Select `AAMC-RPL-Teams.zip`.
3. Add it to yourself (personal scope), then open any Teams meeting you organize, click
   **Apps** in the meeting toolbar, and add **AAMC RPL** to the side panel.

Your tenant must allow custom app uploads (Teams Admin Center → Setup policies).

## Deploying to your tenant

When ready for broader roll-out, upload the same zip in
[Teams Admin Center](https://admin.teams.microsoft.com) → **Teams apps** → **Manage apps**
→ **Upload new app**, then assign it via a Teams app setup policy.

## How the HTML adapts to Teams

`public/Live Assessment.html` loads the Teams JS SDK and, when it detects a Teams
host, does the following automatically:

- Calls `microsoftTeams.app.initialize()` + `notifySuccess()` so Teams stops showing a loader.
- Pre-fills the **Assessor name** field from the signed-in Teams user.
- Detects meeting context (when opened from a Teams meeting) and stashes the meeting id for transcript lookup.
- Adds a `body.in-teams` class that you can hook with CSS tweaks later if needed.

The existing MSAL popup login still runs for Microsoft Graph (transcript) access.
A future enhancement is to replace that with `microsoftTeams.authentication.getAuthToken()`
for a fully silent SSO experience — see `TEAMS_LOGIN_SETUP.md` for the Entra prerequisites.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "App is invalid" on upload | Check `id` is a real GUID and both icons are present at the exact sizes. |
| Side panel never loads | Confirm the hosted URL responds 200 from outside Teams, and `validDomains` includes the App Service host. |
| Blank tab with spinner forever | The page must call `microsoftTeams.app.notifySuccess()` — it does, once the SDK script loads. If the SDK is blocked (CSP), the spinner persists. |
| "Your admin hasn't enabled" | Teams Admin Center → Manage apps → allow this app (or allow all custom apps for test users). |
