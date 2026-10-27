# Local quality review — 27 October 2026

The approved visual design is retained. This pass addresses reproducible accessibility and refresh problems; it does not claim a perfect score or full production certification.

## Changes

- Name the report period, audit filters, component filters and spare-part filters for assistive technology.
- Add consistent visible keyboard focus and larger small mobile component/group targets.
- Keep mobile dialog input text at 16px to reduce keyboard zoom issues.
- Separate the interactive section selector from its overflow menu instead of nesting both inside a label.
- Announce asset refresh state on the overflow control and respect reduced-motion preferences.
- Preserve the last cabinet list after a reload fails; display a retry message instead of clearing the list and showing misleading zero totals.
- Include the new files in the offline shell for the eventual deployment.
- Update old browser tests to use the approved mobile dropdown, Registry and Movements action entry points.

## Validation

Offline sample records only; no production writes. Edge Chromium at 320, 390, 820 and 1440 pixels:

- Every main tab and all seven asset subviews: no document overflow, unnamed visible inputs or uncaught JavaScript errors.
- Simulated cabinet reload failure retains the exact previous array; refresh state and spinner clear on completion.
- Existing API, service form, report scope, warehouse stock and install tests pass.
- Bulk deletion and transfer checks pass, including partial failures, lost-response reconciliation and changed sources.
- Registry, movement history, report overview, weekly activities and visit browser checks pass at phone/tablet/desktop widths. Visit checks cover invalid inputs and submit failure/rollback/retry/success.

Run `quality-audit.test.cjs` with the standalone preview path after generating it with `build-preview.cjs`. Set PLAYWRIGHT_MODULE to the local Playwright installation if needed.

Screens: [mobile dashboard](quality-screens/dashboard-390.png), [desktop dashboard](quality-screens/dashboard-1440.png), [mobile report](quality-screens/report-390.png), [desktop report](quality-screens/report-1440.png).

## Limits

Browser tests use mocked API data and a desktop browser with responsive viewports. They do not establish behavior on physical iOS/Safari or Android devices, real mobile keyboards, screen readers, poor cellular networks, large production datasets, or concurrent live edits. Real Apps Script/Sheets production writes were not exercised. Existing backend authorization is covered by unit tests, not a full security audit. These changes remain local until deployment is approved.
