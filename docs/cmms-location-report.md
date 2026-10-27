# CMMS location report

`POST /cmms_express/api/reports/locations/cmms-data`

Requires the normal authenticated session, CSRF handling, and `location.create_report` permission. `org_id` must match the authenticated account. Invisible records and other accounts are excluded.

```json
{
  "location_ids": ["68aff4762517f347390f5f04"],
  "org_id": "68aff3fb2517f347390f5f01"
}
```

Optional `from_date` and `to_date` accept `YYYY-MM-DD` (IST day boundaries) or full ISO timestamps with an explicit timezone. By default the interval is Monday 00:00 IST through the request time. Optional `stale_after_hours` is a positive number, default 24.

The response uses `{ "status": true, "message": "Data fetched successfully", "data": { ... } }`. Data contains:

- `report_period`, `snapshot_at`: effective interval and current snapshot time.
- `locations`: each selected top-level location, all visible descendant IDs, a location summary, and `asset_data`. Each top-level asset retains its master fields, `child_assets`, and a `summary` including those components' work and RMS data.
- `cmms_summary`: flat rows for top-level assets. A location-only row covers WOs without an asset; no location WO is assigned to every asset.
- `week_total_snapshot`: calculated across unique scoped records, rather than by summing rows which may share stock.
- `critical_spares_stock_replenishment`: current spare stock rows, including general spares as in the supplied example.
- `metadata`: sources, calculation definitions, missing-data explanations and freshness flags.

## Summary columns

| Supplied column | JSON field | Definition |
| --- | --- | --- |
| Asset / location | `asset_location` | Top-level asset name, or location name for a location-only row |
| PM planned | `pm_planned` | Non-rejected preventive WOs due within the interval; start date used when no due date is stored |
| PM completed | `pm_completed` | Completed WOs from that planned cohort |
| PM overdue | `pm_overdue` | Non-completed/non-rejected WOs from that planned cohort with due date before snapshot time |
| Breakdown WOs | `breakdown_wos` | Breakdown WOs starting in the interval; creation date fallback |
| Downtime (h) | `downtime_h` | `null` if there are breakdowns: the schema has no equipment downtime field; zero if there are none |
| Open / overdue WOs | `open_overdue_wos` | Current non-completed/non-rejected WOs, including overdue WOs once. `overdue_wos` is also returned for the overdue subset |
| Spare qty used | `spare_qty_used` | Actual quantity; net issued minus returned fallback; never estimated/planned quantity |
| Spare cost (INR) | `spare_cost_inr` | Quantity consumed multiplied by recorded WO unit cost |
| Labor cost (INR) | `labor_cost_inr` | `null` when labor hours exist because rates are not stored; otherwise zero recorded cost |
| Total cost (INR) | `total_cost_inr` | Spare plus labor cost; `null` if either is unknown |
| Low critical spares | `low_critical_spares` | Unique critical parts below minimum or out of stock; `null` if low stock has unknown criticality |
| Peak endpoint RMS (mm/s) | `peak_endpoint_rms_mm_s` | Historical maximum saved velocity RMS across the asset and its child components |
| Oldest sensor reading | `oldest_sensor_reading` | Oldest timestamp among the latest saved snapshots of each endpoint axis; ISO UTC |
| Data quality flag | `data_quality_flag` | `RECENT`, `STALE`, `MISSING`, or `NO_DATA` |

Spare consumption/cost figures are cumulative actual usage for the WOs starting in the selected interval. They are not a dated issue/return ledger. Open WOs, stock, and status counts use current persisted state; a past interval does not reconstruct past stock or WO status. Only materialized preventive WOs count; future scheduler occurrences that have not produced WOs are not projected.

## Spare columns

| Supplied column | JSON field |
| --- | --- |
| Asset / location | `asset_location` |
| Spare part name | `spare_part_name` |
| Spare part code | `spare_part_code` |
| Classification | `classification` |
| On-hand stock | `on_hand_stock` |
| Min stock | `min_stock` |
| Max stock | `max_stock` |
| Stock status | `stock_status` |
| Reorder to max (qty) | `reorder_to_max_qty` |
| Lead time (days) | `lead_time_days` |
| Unit cost (INR) | `unit_cost_inr` |
| Replenishment (INR) | `replenishment_inr` |
| Supplier | `supplier` |
| Responsible group | `responsible_group` |
| Action / alert | `action_alert` |

Stock is `OUT OF STOCK` at zero, `LOW` below minimum, `OK` at or above minimum, and `UNKNOWN` for missing inputs. Classification comes from a part type explicitly named Critical or General; other types do not establish criticality. Stock is associated with its stored location. Asset-level stock association is inferred from WO part references, since no asset-to-part BOM is stored. Shared parts may appear in multiple asset counts; location/global counts deduplicate them.

Maximum stock and responsible group are not stored. `max_stock` and `responsible_group` are `null`. Reorder-to-max and replenishment cost are `null` for shortages and zero when stock is OK. No maximum, rate, supplier, or other demo value is invented. Non-INR costs are `null`; no currency conversion is assumed. Numeric zeros are returned as zero, rather than the Excel display dash; currency amounts are numbers without the rupee symbol.

Sensor values come from saved asset report `endpointRMSData.velocity`, not a live processor query or a complete sensor inventory. Therefore freshness describes those saved readings only. A stale reading makes the row STALE; missing RMS/timestamp makes it MISSING; absence of saved velocity axes yields NO_DATA. No data is treated as healthy/fresh by default.

## Validation

`npm run typecheck`

`npm run test:cmms-report`

Tests cover hierarchy expansion and cycles, child rollups, tenant/visibility query scoping, duplicate location IDs, empty results, PM cohorts, actual consumption, unknown costs, stock policy, historical RMS versus freshness, timestamps and date validation. Database access is mocked; no production records are changed.
