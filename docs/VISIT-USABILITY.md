# New Visit and Field Logs — focused usability pass

Built from the original `main` at `cda82ef`. Keeps the original colors, typography, navigation and page layout; none of the discarded redesign styles are included.

- Field Logs adds a status selector that combines with the existing search, date, category and technician filters. Both clear actions reset the status. The main Clear filters action also clears technician/attention scope. The filter summary includes the selected status, and the empty state distinguishes no loaded records from no matching results.
- New Visit focuses the visible client picker when client validation fails, including from the final mobile step. Client validation is associated with the visible combobox for assistive technology.
- Mobile Save mirrors the actual submit button's disabled/busy state. A persistent message distinguishes saving, confirmed save, attachments uploading separately, and unconfirmed save. On an unconfirmed save it advises reviewing Field Logs before retrying, since a dropped response does not prove that a remote write failed.
- The existing submit handler, optimistic rollback, validation, role scope, storage, backend and attachments remain in place. The service worker caches the new feedback module using its existing safe-update mechanism.

## Validation

All four existing tests pass: `api.test.cjs`, `service-form.test.cjs`, `report-scope.test.cjs`, and `install.test.cjs`.

`usability-browser.test.cjs` uses Edge with external requests blocked and mocked API responses. At 390, 820 and 1440px it exercises the actual submit handler through failure/rollback/retry/success, checks form-data retention and mobile busy feedback, and verifies status/search/reset/empty-state behavior. No runtime errors. No production writes were made; authenticated save/upload smoke testing remains necessary before release.

Screens: [phone log filter](usability-screens/logs-390.png), [desktop log filter](usability-screens/logs-1440.png), [phone failed save](usability-screens/save-failure-390.png), [desktop failed save](usability-screens/save-failure-1440.png).

## Review preview

`node build-preview.cjs OUTPUT.html` bundles a single HTML preview. Its synthetic fixtures are loaded only by the preview and browser test. Production does not load `preview-fixtures.js`. The preview blocks backend writes and lets the reviewer explore the current interface without authentication.
