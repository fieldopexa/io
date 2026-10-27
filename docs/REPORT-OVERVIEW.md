# Reports at a glance

Keeps the deployed palette, period selection, role scope and source records. The first view now contains a compact period heading, one-sentence summary, four totals and up to five pending/follow-up visits. Open visits sort by priority (Critical, High, Medium, Low), then oldest date; resolved high-priority visits do not appear as open concerns. Totals and attention rows use only visits in the selected reporting period; voided records are excluded.

Category/site breakdowns, complete visit remarks and weekly agenda remain available in expandable sections. Open concerns use the existing visit-details drawer. Print expands the complete report and restores disclosure state afterward. Presentation mode expands the sections while retaining the original overview/remarks paging. Frozen snapshots retain attention text and full expanded records without live action buttons.

The tabs are named Overview and Weekly Activities. Activities show a week selector and completed-activity count, with newest records first. The form opens through Add Activity or Edit and supports Cancel. Empty weeks start with the form collapsed. Existing agenda API actions and storage keys stay unchanged; failed creates/edits retain entered text and restore the prior list, and failed deletes restore the removed record. Save status stays visible when the form collapses; Add and Cancel are disabled while a save is pending.

No changes to authentication, Apps Script or export calculations. The separate desktop Field Logs shortcut removal is already deployed.

## Validation

The four existing backend/service-form/report-scope/install tests pass. `report-overview.test.cjs` runs offline in Edge at 390, 820 and 1440px with synthetic records. It checks selected-period totals, void exclusion, priority ordering, the five-row limit, full expandable records, print visibility/state restoration, presentation pagination, visit-details navigation, empty state and horizontal overflow. No runtime errors. Backend production writes are blocked.

`weekly-activities.test.cjs` also runs at all three widths, exercising the actual agenda handlers through Add/Cancel, create/edit/delete success, failure rollback and retained text, while checking tab labels, counts, empty state and horizontal overflow.

Screens: [desktop](report-screens/overview-1440.png), [tablet](report-screens/overview-820.png), [phone](report-screens/overview-390.png).
