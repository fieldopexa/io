# Cabinet Registry: simpler All Cabinets

The main desktop/tablet list shows Cabinet ID, Site / Location, Status and View details. Phone cards show the same information. Serial numbers, Token, TeamViewer and other technical fields are available after opening details rather than filling every row.

Management retains the existing cabinet profile, history, Edit and Delete handlers. Edit/Delete are in a small per-row menu. FSE users receive a read-only dialog containing the technical fields previously visible to them in the table; no management actions are added. Backend authorization, search-role behavior, cabinet save handlers and stored records are unchanged.

Search remains visible. Site and status controls open through Filters, with removable active-filter chips. Existing filter handlers and cabinet-prefix grouping are retained.

Validation: existing backend/service-form/report-scope/install tests pass. `cabinet-registry.test.cjs` uses synthetic records and blocked external requests at 390/820/1440px. It verifies the four-column list, search/status/reset, management profile technical details and edit access, read-only FSE technical details without edit controls, and no-results behavior. No runtime errors or horizontal page overflow. All inline scripts parse. No production writes were made.

Screens: [desktop](cabinet-screens/registry-1440.png), [tablet](cabinet-screens/registry-820.png), [phone](cabinet-screens/registry-390.png).
