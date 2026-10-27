# Bulk cabinet profile deletion

Management users can open Delete cabinet profiles from All Cabinets or any site profile, including Carmona Warehouse. Search for a location, select cabinets individually or select all, review the checked IDs, then explicitly confirm permanent deletion. Nothing is selected initially.

The existing management-only deleteCabinet API removes each selected cabinet profile and records its audit event. Site records, visit logs and existing movement history are retained. There is no undo in this UI. Cabinet components are handled exactly as in the existing individual delete flow.

Before deletion, a fresh cabinet list skips profiles that disappeared, changed allocation ID, or moved away from the reviewed location. Calls run sequentially. A failure stops the remaining batch without retries, reports confirmed deletions and not-attempted records, and refreshes cabinet data. A lost response can mean the failed request was saved; verify current records before retrying. This is not an atomic operation.

A Carmona Warehouse shortcut is available above the site list; the existing site search remains available for all other locations.

Validation: bulk-delete.test.cjs covers phone and desktop widths, review before writes, selected-location scope, individual API deletions, stopping on failure and dialog width. Bulk warehouse, warehouse stock and install regression tests pass. No production records were changed during testing.
