# Bulk transfers to Carmona Warehouse

Management users can choose **Move cabinets to warehouse** inside a site profile, or **Move site cabinets to warehouse** from Cabinet Movements.

1. Choose the source site. Its cabinets are selected initially; untick any staying behind.
2. Enter the movement date, handler and optional remarks once.
3. Review the selected cabinets, then confirm the transfer.

The destination is Carmona Cavite Warehouse. Each cabinet uses the existing saveMovement API and receives its own movement record, stock allocation and audit entry. Apps Script and storage schemas are unchanged. Ready / Stock uses the same canonical Carmona cabinet list as the warehouse profile, including legacy STOCK allocations.

Transfers run individually. A fresh cabinet read skips missing cabinets, cabinets already in stock, and cabinets whose source changed after review. If a response is lost, the client checks the unique movement reference and current cabinet location. If confirmation remains uncertain, it stops without retrying automatically; check movement history before attempting another transfer. Earlier confirmed transfers remain saved. The progress list shows moved, skipped and not-attempted cabinets.

The action is unavailable to FSE accounts. During saving, the dialog prevents additional submissions and closing. On completion, cabinet totals and movement history refresh.

## Validation

`bulk-warehouse.test.cjs` covers desktop and phone layouts, subset selection, separate movement records, updated totals, partial failures, lost responses, ledger-only failures, source changes and FSE visibility. Warehouse stock, API, service form, report scope and install tests also pass.

Review screenshots: [desktop](bulk-warehouse-screens/review-1440.png), [phone](bulk-warehouse-screens/review-390.png).

The standalone sample preview disables saving and does not change production records.
