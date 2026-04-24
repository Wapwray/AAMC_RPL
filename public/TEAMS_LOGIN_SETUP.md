# Teams Login Setup (100% Web, No Local Server)

This app is a pure static web page. Teams sign-in happens in the browser via MSAL.js against Microsoft Entra ID, and Microsoft Graph is called directly from the browser. No Node server is required.

## 1. Host the `public/` folder

Recommended: **GitHub Pages**.

1. In the repo settings → Pages, set the source to branch `main` and folder `/public` (or move the files to `/docs` and select `/docs`).
2. Note the published URL, e.g. `https://wapwray.github.io/AAMC_RPL/Live%20Assessment.html`.

## 2. Create an Entra App Registration (SPA)

1. Go to <https://entra.microsoft.com> → **Identity** → **Applications** → **App registrations** → **New registration**.
2. Name: `AAMC RPL Live Assessment`.
3. Supported account types: **Accounts in this organizational directory only**.
4. Redirect URI → platform **Single-page application (SPA)** → enter the full page URL from step 1 (exactly, including `Live%20Assessment.html`). You can add more than one (e.g., a staging URL).
5. After creation, copy the **Application (client) ID**.

### API permissions (delegated, Microsoft Graph)

Add these and click **Grant admin consent**:

- `User.Read`
- `Calendars.Read`
- `OnlineMeetings.Read`
- `OnlineMeetingTranscript.Read.All`
- `OnlineMeetingArtifact.Read.All`

> `OnlineMeetingTranscript.Read.All` and `OnlineMeetingArtifact.Read.All` require a tenant policy that allows the app to read meetings for the signed-in user. Your Teams admin may need to run the `New-CsApplicationAccessPolicy` cmdlet or enable the equivalent policy. See: <https://learn.microsoft.com/graph/cloud-communication-online-meeting-artifacts>.

### Authentication settings

- Platform: **Single-page application** (already set above).
- **Do not** enable "Allow public client flows".
- Leave "ID tokens" / "Access tokens" implicit flow checkboxes **unchecked** (SPA uses auth code + PKCE).

## 3. Publish the clientId

Edit [`public/teams-auth-config.json`](teams-auth-config.json):

```json
{
  "clientId": "<PASTE-APPLICATION-CLIENT-ID-HERE>",
  "tenantId": "63871d3c-d05d-49fa-86b6-420054699fb4",
  "redirectUri": ""
}
```

- `redirectUri` can stay empty — the page uses its own URL.
- Commit and push. GitHub Pages will redeploy automatically.

### Alternative: URL override (no commit needed)

Append query params:

```
?teamsClientId=<guid>&teamsTenantId=63871d3c-d05d-49fa-86b6-420054699fb4
```

Useful for quick testing.

## 4. Verify

1. Open the hosted `Live Assessment.html` URL.
2. Click **Login to Teams** → Microsoft sign-in popup appears → consent if prompted.
3. Your upcoming Teams meetings load in the dropdown.
4. Select the meeting → transcript polling starts automatically once the meeting's transcription is on.

## Notes

- Teams meetings cannot be fully embedded in an iframe (Microsoft blocks it). The page shows a "Join in Teams" button; join from the native Teams client and keep this page open alongside it.
- Meeting transcription must be enabled inside the Teams meeting (organizer action) for Graph to expose transcripts.
- The Power Automate questions webhook is called directly from the browser. If CORS blocks it, enable CORS on the Power Automate HTTP trigger's CORS settings in the environment.
