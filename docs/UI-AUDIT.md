# OPEXA FSM Interface Pass — 27 October 2026

Audited the actual `fieldopexa/io` application at commit `cda82ef`, including the inline CSS/JS, mobile drawer and bottom navigation, visit wizard, Field Logs, service-form integration, Apps Script interface and offline shell.

## Findings and changes

| Area | Before | First pass |
| --- | --- | --- |
| Brand | Overlapping gold, lavender and blue overrides | Shared charcoal surfaces, gold navigation/actions, readable muted text and consistent focus rings |
| Dashboard | Fifth cabinet-attention KPI hidden; site risk and priority concerns inside collapsed insights | All five existing KPIs visible; existing attention cards moved above detailed insights; responsive five/three/two-column layout |
| Field Logs | Useful existing search/date/category controls; small actions and muted metadata | Preserved filter handlers; 44px actions/category targets, clearer selected filters, legible metadata, gold details action |
| New Visit | Existing four-step flow with optional fifth signature step; desktop shared controls | Same fields, step logic and save handlers; consistent control sizing, labels, surfaces and actions; focus follows wizard navigation |
| Validation | Client failure focused a hidden select behind the location combobox | Focus visible client picker; associate its label and error; announce validation messages |
| Navigation | Desktop div tabs; hidden drawer remained keyboard accessible; no Escape/focus containment | Keyboard activation/current-page state, skip link, inert closed drawer, focus containment and Escape/return focus; bottom navigation also available at tablet widths |
| Save feedback | Mobile Save did not mirror disabled submit; brief toast duration | Mobile Save mirrors actual busy/disabled state and restores its label; error announcements remain visible for ten seconds |
| Offline updates | Cache did not include new modules | Versioned shell caches both UI modules using the existing unfinished-work update protection |

The new CSS and JS are isolated in `ui-modernization.css`, `ui-operations.css` and `ui-modernization.js`. The operations layer follows the supplied OPEXA administration reference: near-black/navy surfaces, restrained gold accents, compact toolbars, subtle table dividers and status badges. Reports, Asset Operations, Audit Trail and Users share those treatments. Accounts become labeled cards on phones while retaining their original action buttons. Report-period chips support keyboard activation and expose their selected state. The tablet bottom navigation is explicitly sized throughout its full 900px breakpoint.

The legacy application has many cascading presentation layers; this pass deliberately avoids a broad rewrite of them. Visibility and permission rules stay in the application. Print rules are excluded from the new CSS.

## Validation

Run the existing checks from the repository root:

```powershell
node api.test.cjs
node service-form.test.cjs
node report-scope.test.cjs
node install.test.cjs
```

Run the browser regression with an installed Playwright package and Microsoft Edge:

```powershell
# Set PLAYWRIGHT_MODULE to the package path if it is outside normal module resolution.
node ui-browser.test.cjs
```

The browser harness uses the actual app and renderers with synthetic records, blocks external requests and disables service workers. It checks all seven sections at 390, 820 and 1440px; additional checks cover 320, 760, 900 and 901px. It verifies all KPIs, filtering/reset, client validation/focus, optional step five, busy-state recovery, drawer focus/Escape, form visibility across resize, compact tablet navigation, user-table labeling/add-form disclosure, audit search, Report/Agenda switching, and management/FSE UI restrictions. These UI checks supplement the existing backend permission tests; hiding controls is not a security boundary.

No production records were written. Authenticated end-to-end Sheets saves, Drive uploads and real signature persistence require a staging account/backend and remain a release smoke test. Existing backend and service-form regression tests exercise their mocked round trips. External logos are unavailable in these offline screenshots; sync warnings are expected.

## Before / after screens

| View | Before | After |
| --- | --- | --- |
| Dashboard, desktop | [Before](ui-screens/before-dashboard-1440.png) | [After](ui-screens/after-dashboard-1440.png) |
| Dashboard, phone | [Before](ui-screens/before-dashboard-390.png) | [After](ui-screens/after-dashboard-390.png) |
| Field Logs, desktop | [Before](ui-screens/before-fieldlogs-1440.png) | [After](ui-screens/after-fieldlogs-1440.png) |
| Field Logs, phone | [Before](ui-screens/before-fieldlogs-390.png) | [After](ui-screens/after-fieldlogs-390.png) |
| New Visit, desktop | [Before](ui-screens/before-log-1440.png) | [After](ui-screens/after-log-1440.png) |
| New Visit, phone | [Before](ui-screens/before-log-390.png) | [After](ui-screens/after-log-390.png) |
| Reports, desktop | [Before](ui-screens/before-report-1440.png) | [After](ui-screens/after-report-1440.png) |
| Reports, phone | [Before](ui-screens/before-report-390.png) | [After](ui-screens/after-report-390.png) |
| Asset Operations, desktop | [Before](ui-screens/before-inventory-1440.png) | [After](ui-screens/after-inventory-1440.png) |
| Asset Operations, phone | [Before](ui-screens/before-inventory-390.png) | [After](ui-screens/after-inventory-390.png) |
| Audit Trail, desktop | [Before](ui-screens/before-audit-1440.png) | [After](ui-screens/after-audit-1440.png) |
| Audit Trail, phone | [Before](ui-screens/before-audit-390.png) | [After](ui-screens/after-audit-390.png) |
| Users, desktop | [Before](ui-screens/before-users-1440.png) | [After](ui-screens/after-users-1440.png) |
| Users, phone | [Before](ui-screens/before-users-390.png) | [After](ui-screens/after-users-390.png) |

Screens at 820px are also in `ui-screens/`. Phone/tablet captures show a viewport; desktop captures show the full page. `ui-screens/results.json` records browser runtime errors for each before/after run.

## Standalone HTML preview

`node build-preview.cjs OUTPUT.html` creates a single HTML preview with the local styles/scripts and service-form reference embedded. `preview-fixtures.js` supplies synthetic visit, asset, audit and account records only to this preview and the browser test; production `index.html` never loads it. Network requests and backend writes are blocked in the preview. The preview starts on Dashboard and supports navigating all sections without a login. This file is for interface review, not deployment.

## Release / rollback

Merge the review branch through the existing GitHub hosting process after a staging save/upload smoke test. This change does not require redeploying `api.gs`. To roll back, revert the interface commit as a unit, including its service-worker cache change. Keep the existing safe-update mechanism so open unfinished visits are not reloaded.
