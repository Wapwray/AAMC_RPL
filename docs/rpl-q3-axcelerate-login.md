# Q3 aXcelerate pre-access gate

`AAMC RPL 2026 Q3.html` requires a verified aXcelerate login before it loads the
shared interview application. The standard app and Q3 Auto Tester are not
affected.

## Request flow

1. The Q3 entry page reads `contactId` from its interview URL.
2. When no login token is present, it shows a login launcher. The learner
   presses the login button to open a resizable popup with:
   - `rpl_q3_auth=1`
   - `rpl_q3_return=<encoded original Q3 URL with rpl_app_window=1>`
3. `rpl-q3-wordpress-login-bridge.js`, embedded on that WordPress page, retains
   the normal AAMC header and aXcelerate login buttons while hiding the
   pre-eligibility questionnaire and manual-contact form.
4. After a successful aXcelerate login, the same popup returns through the
   bridge and becomes the Q3 application window. The short-lived access token
   is returned in the Q3 URL fragment.
5. Q3 posts that token to `/api/axcelerate/verify-login`.
6. The server validates the token through the WordPress aXcelerate plugin and
   returns only the authenticated Contact ID.
7. Q3 loads the shared interview application only when the authenticated
   Contact ID exactly matches the interview URL Contact ID.

The token is removed from the browser address before the interview loads. It is
not written to application logs.

The return state is Base64URL encoded so aXcelerate cannot split nested
`fullName`, `givenName`, and `contactId` query fields while returning through
WordPress.

The popup requests a 1440 by 1000 maximum working area, adapts to smaller
screens, permits resizing and scrolling, and uses Chromium's minimal popup
chrome. Browsers can still show security or origin UI; a normal website cannot
guarantee removal of every browser control.

## aXcelerate approved application

The exact return address must be present in aXcelerate under **System Settings
> Web & Other Integrations > Approved Applications Register**:

```text
Name: AAMC RPL Interview Login
URL: https://aamctraining.edu.au/rpl-pre-eligibility-test/
```

Without this registration, aXcelerate ignores `return_to` and sends the user to
the Learner Portal instead of returning to the interview.

## WordPress embed

The page `https://aamctraining.edu.au/rpl-pre-eligibility-test/` retains its
existing `[ax_enquiry_widget config_id=3]` shortcode and loads:

```html
<script
  src="https://aamc-rpl-live-ecgua6ceb4fkgfh0.australiaeast-01.azurewebsites.net/rpl-q3-wordpress-login-bridge.js"
  defer
></script>
```

The bridge does nothing unless `rpl_q3_auth=1` is present and accepts only the
production Q3 interview page as a return destination.

## Deployment notes

- Q3 release: `V3.1`
- Main app release: unchanged
- Q3 Auto Tester release: unchanged
- No Microsoft Foundry or Azure App Service settings are added by this change.
- The WordPress server must be able to reach its own `admin-ajax.php` endpoint,
  and the Azure App Service must be able to reach that public endpoint.
