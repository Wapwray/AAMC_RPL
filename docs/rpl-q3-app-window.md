# Q3 direct application entry

`AAMC RPL 2026 Q3.html` loads the shared RPL interview directly in the current
browser tab. The previous intermediate launcher and **Open the interview**
button are no longer used. The standard app and Q3 Auto Tester retain their
existing entry behaviour.

## Request flow

1. The Q3 entry page captures the supplied student and course parameters.
2. The parameters are retained in per-tab session storage so a refresh can
   restore the same learner context.
3. The identifying query string is removed from the visible browser address.
4. The page immediately loads and transforms the shared
   `AAMC RPL 2026.html` source.

The normal browser frame remains under the browser's control, but the learner's
name, contact ID and other launch parameters are no longer left visible in its
address bar.

## Deployment notes

- Q3 release: `V3.5`
- Main app release: `V2.12`
- Q3 Auto Tester release: `V2.12`
- No aXcelerate, WordPress login bridge, token validation, Microsoft Foundry,
  or Azure App Service setting is required by the direct Q3 entry.
