# Phase 3 verification — window behavior

Environment: Windows, 1280×720, 100 % scale, one display, interactive console session. Build gate: `cargo check` only.

| Check | Result |
|---|---|
| Transparency | `transparent: true`, `noRedirectionBitmap`, live `WS_EX_NOREDIRECTIONBITMAP`. Background pixels still need an eyeball check |
| Always-on-top | Pass — `WS_EX_TOPMOST` set |
| Top-center | Pass — collapsed 152×30 at (564, 0); expanded 420×150 at (430, 0) |
| Hover expand / collapse | Pass — live phase changes observed; 140/320 ms hysteresis covered by 8 green unit tests |
| Full-screen step-aside | Code/runtime pass — `window.hide()` then `show()`; maximized-window false positive fixed with `IsZoomed`. Visual confirmation by the operator |
| DPI | Math pass at 1.0 / 1.25 / 1.5 / 2.0; a real >100 % display is untested |
| Multi-monitor | Negative-origin placement math passes; a physical second display is untested |
| No taskbar entry | Style pass — `WS_EX_APPWINDOW` cleared, `WS_EX_TOOLWINDOW` set (0x00200198). No taskbar in this session to observe |
| Build hygiene | `cargo check` — zero warnings |

Known limits: 60 ms hover poll; `WS_EX_NOACTIVATE` is not set, so clicking can still take focus; full-screen detection follows the notch's monitor only.
