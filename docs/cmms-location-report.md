# CMMS location report

`POST /cmms_express/api/reports/locations/cmms-data`

Requires the normal authenticated session, CSRF handling, and `location.create_report` permission. `org_id` must match the authenticated account. Invisible records and other accounts are excluded.

```json
{
  "location_ids": ["68aff4762517f347390f5f04"],
  "org_id": "68aff3fb2517f347390f5f01"
}
```

Optional `from_date` and `to_date` accept `YYYY-MM-DD` (IST day boundaries) or full ISO timestamps with an explicit timezone. By default the interval is Monday 00:00 IST through the request time. These dates apply to consumption and cost cohorts, not the current work-order counters. Optional `stale_after_hours` is a positive number, default 24.

The response uses `{ "status": true, "message": "Data fetched successfully", "data": { ... } }`. Data contains:

- `report_period`, `snapshot_at`: effective interval and current snapshot time.
- `locations`: each selected top-level location, all visible descendant IDs, a location summary, and `asset_data`. Each top-level asset retains its master fields, `child_assets`, and a `summary` including those components' work and RMS data.
- `cmms_summary`: flat rows for top-level assets only, with `asset_id` (the asset document `_id`), `asset_name`, `location_id`, and `location_name`. Location fields identify the asset's actual location, including descendant locations. WOs without an asset remain in location summaries; they do not create blank-asset rows. An empty location produces no flat asset rows. `low_critical_spares` is omitted from `cmms_summary` rows; it remains available in nested location/asset summaries and `week_total_snapshot`.
- `week_total_snapshot`: `planner_wos`, `completed_wos`, `open_overdue_wos` and `breakdown_wos` sum the displayed `cmms_summary` asset rows, excluding location-only WOs. For example, displayed open counts of 261 and 4 total 265, even if the location summary also includes 19 location-only WOs. An empty asset list gives zero for all four counts. Other totals continue to use unique scoped records, including location-only work and deduplicated stock.
- `critical_spares_stock_replenishment`: current spare stock rows, including general spares as in the supplied example.
- `metadata`: sources, calculation definitions, missing-data explanations and freshness flags.

Summary metrics (location, asset, flat rows and overall totals) and replenishment rows return numeric `0` for unavailable numeric values and the string `"N/A"` for unavailable text/date values. Populated values and numeric zeros are preserved. These display defaults are applied after calculations; they do not establish measured zero downtime, costs, stock targets or RMS. Sensor quality and stock status continue to reflect the source data. `metadata.response_defaults` describes this policy and `metadata.unavailable_source_fields` lists unavailable source facts. Asset master fields are preserved as stored.

## Summary columns

| Supplied column | JSON field | Definition |
| --- | --- | --- |
| Asset | `asset_name` | Top-level asset name |
| Location | `location_name` | Asset's actual location name |
| Planner WO | `planner_wos` | Visible, non-rejected WOs with `createdFrom` exactly `"Preventive"`, across all dates, including completed work; `type` and `nature_of_work` do not establish Planner membership |
| Breakdown WO | `breakdown_wos` | Visible, non-rejected WOs with `nature_of_work` exactly `"Breakdown"`, across all dates and statuses; totals sum displayed asset rows |
| Complete WO | `completed_wos` | All scoped WOs with status Completed, across all creation sources and dates |
| Open / Overdue WO | `open_overdue_wos` | All scoped WOs except Completed and Rejected, across all creation sources and dates, including Open, In-Progress, On-Hold, Blocked, waiting statuses and overdue work; each counted once |
| Downtime (h) | `downtime_h` | Zero; equipment downtime is not recorded |
| Spare qty used | `spare_qty_used` | Actual quantity; net issued minus returned fallback; never estimated/planned quantity |
| Spare cost (INR) | `spare_cost_inr` | Quantity consumed multiplied by recorded WO unit cost |
| Labor cost (INR) | `labor_cost_inr` | Sum of recorded `labor_entries[].labor_cost` entry totals in INR for the period cohort; never multiplied by hours. Unpriced entries are excluded; zero fallback if labor is logged with no recorded costs |
| Total cost (INR) | `total_cost_inr` | Spare plus labor cost; zero fallback if either is unknown |
| Low critical spares | `low_critical_spares` | Nested location/asset summaries and `week_total_snapshot` only; omitted from `cmms_summary`. Unique critical parts below minimum or out of stock; zero fallback if low stock has unknown criticality |

The CMMS tab sources (`cmms_summary` rows and `week_total_snapshot`) omit `peak_endpoint_rms_mm_s`, `oldest_sensor_reading`, and `data_quality_flag`. These sensor fields remain available in nested location and asset summaries: historical peak RMS in mm/s, oldest reading in IST `dd/mm/yyyy hh:mm:ss` (or `"N/A"`), and `RECENT`, `STALE`, `MISSING`, or `NO_DATA` quality. Sensor metadata describes those nested summaries.

The response exposes four work-order counters: `planner_wos`, `completed_wos`, `open_overdue_wos`, and `breakdown_wos`. Planner is a creation-source subset and does not equal completed plus open work. A General order with `createdFrom: "Preventive"` counts as Planner; an order with `type` or `nature_of_work` Preventive but `createdFrom: "Work Order"` does not. Completed and open counts continue to include all creation sources. PM fields and the separate overdue subset are removed. `breakdown_wos` counts visible, non-rejected work orders with `nature_of_work` exactly `"Breakdown"`, across all dates and statuses; `type` alone does not establish a breakdown. The same rules apply to child work orders rolled up into a top-level asset. Only persisted work orders count; future scheduler occurrences that have not produced WOs are not projected.

Spare consumption/cost figures are cumulative actual usage for the WOs starting in the selected interval. They are not a dated issue/return ledger. Work-order counters and stock use current persisted state; a past interval does not reconstruct past stock or WO status. Downtime still uses breakdown work starting in the selected interval internally, with zero as the unavailable-value response default.

## Spare columns

| Supplied column | JSON field |
| --- | --- |
| Location | `location_name` |
| Associated asset ID | `asset_id` |
| Spare part name | `spare_part_name` |
| Spare part code | `spare_part_code` |
| On-hand stock | `on_hand_stock` |
| Min stock | `min_stock` |
| Stock status | `stock_status` |
| Lead time (days) | `lead_time_days` |
| Unit cost (INR) | `unit_cost_inr` |
| Supplier | `supplier` |
| Action / alert | `action_alert` |

Stock is `OUT OF STOCK` at zero, `LOW` below minimum, `OK` at or above minimum, and `UNKNOWN` for missing inputs. Classification comes from a part type explicitly named Critical or General; other types do not establish criticality. Stock is associated with its stored location. Asset-level stock association is inferred from WO part references, since no asset-to-part BOM is stored. Shared parts may appear in multiple asset counts; location/global counts deduplicate them.

Spare rows include one row per distinct part/asset association found in visible, scoped work orders, using the referenced asset's document ID (including child components). Repeated work-order references to the same part/asset pair produce one row. Unlinked stock returns `asset_id: "N/A"`. Shared stock is repeated for each linked asset for context; do not sum these rows to calculate inventory totals. Summary calculations continue using unique stock records.

`critical_spares_stock_replenishment` omits `asset_name`, `classification`, `max_stock`, `reorder_to_max_qty`, `replenishment_inr`, and `responsible_group`. Classification remains an internal input for critical-stock summary calculations. Asset names elsewhere in the report remain available. Non-INR costs default to zero; no currency conversion is assumed. Currency amounts are numbers without the rupee symbol.

Sensor values come from saved asset report `endpointRMSData.velocity`, not a live processor query or a complete sensor inventory. Therefore freshness describes those saved readings only. A stale reading makes the row STALE; missing RMS/timestamp makes it MISSING; absence of saved velocity axes yields NO_DATA. No data is treated as healthy/fresh by default.

Reports are fetched from `assets-report` with the authenticated `accountId`, `visible: true`, and either `top_level_asset_id` or `assetId` in the scoped asset IDs. Reports saved after `snapshot_at` are ignored. Within each report, a point's `asset_id` takes precedence over report-level asset IDs, and a different `org_id` is excluded. Only `velocity.Axial`, `velocity.Horizontal`, and `velocity.Vertical` are read. Future sensor readings are ignored.

`peak_endpoint_rms_mm_s` is the maximum valid, nonnegative RMS across eligible saved reports as of the snapshot, including child assets; it is not restricted to the report week. `oldest_sensor_reading` uses the most recently saved reading for each asset/endpoint/axis, then takes the oldest available timestamp across those readings. For example, `2026-02-16T12:44:00.000Z` becomes `16/02/2026 18:14:00` in IST. When no eligible saved velocity readings are available, RMS defaults to `0` and the date to `"N/A"`, with `NO_DATA` quality. Missing RMS or timestamps use the same respective defaults and produce `MISSING`. These defaults do not prove that the asset has no physical sensors. Fresh values require saving updated endpoint velocity data through the existing asset-report flow.

## Validation

`npm run typecheck`

`node --require ts-node/register/transpile-only --test src/reports/location/cmms-data.test.ts src/reports/location/cmms-report.test.ts`

Tests cover hierarchy expansion and cycles, child rollups, tenant/visibility query scoping, duplicate location IDs, empty results, category/date-independent work-order counts, completed/open partitioning, displayed-row totals, actual consumption, unknown costs, stock policy, historical RMS versus freshness, timestamps and date validation. Database access is mocked; no production records are changed.
