# Q3 application window

`AAMC RPL 2026 Q3.html` opens the shared RPL interview in a separate,
resizable application-style window. The standard app and Q3 Auto Tester are
not affected.

## Request flow

1. The Q3 entry page retains the student details from its interview URL.
2. The learner presses **Open the interview**.
3. The launcher opens the same Q3 URL with `rpl_app_window=1`.
4. The application window loads and transforms the shared
   `AAMC RPL 2026.html` source.
5. The application window notifies the launcher after it has started.

The popup requests a 1440 by 1000 maximum working area, adapts to smaller
screens, permits resizing and scrolling, and uses Chromium's minimal popup
chrome. Browsers can still show security or origin UI; a normal website cannot
guarantee removal of every browser control.

## Deployment notes

- Q3 release: `V3.3`
- Main app release: `V2.10`
- Q3 Auto Tester release: `V2.10`
- No aXcelerate, WordPress login bridge, token validation, Microsoft Foundry,
  or Azure App Service setting is required by the application-window launcher.
