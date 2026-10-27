# Reports at a glance

Keeps the deployed palette, period selection, role scope and source records. The first view now contains a compact period heading, one-sentence summary, four totals and up to five pending/follow-up visits. Open visits sort by priority (Critical, High, Medium, Low), then oldest date; resolved high-priority visits do not appear as open concerns. Totals and attention rows use only visits in the selected reporting period; voided records are excluded.

Category/site breakdowns, complete visit remarks and weekly agenda remain available in expandable sections. Open concerns use the existing visit-details drawer. Print expands the complete report and restores disclosure state afterward. Presentation mode expands the sections while retaining the original overview/remarks paging. Frozen snapshots retain attention text and full expanded records without live action buttons.

No changes to authentication, Apps Script, storage, save handlers or export calculations. This Reports change is a preview; the separate desktop Field Logs shortcut removal is already deployed.

## Validation

The four existing backend/service-form/report-scope/install tests pass. `report-overview.test.cjs` runs offline in Edge at 390, 820 and 1440px with synthetic records. It checks selected-period totals, void exclusion, priority ordering, the five-row limit, full expandable records, print visibility/state restoration, presentation pagination, visit-details navigation, empty state and horizontal overflow. No runtime errors. Backend production writes are blocked.

Screens: [desktop](report-screens/overview-1440.png), [tablet](report-screens/overview-820.png), [phone](report-screens/overview-390.png).
