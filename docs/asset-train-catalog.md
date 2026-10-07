# Asset train catalog, creation and component management — Phases 1–4

The catalog combines existing standalone choices with the equipment and drive
trains supplied in `catalog/asset_train.csv`. The Create Asset modal uses it to
prepare an editable preview and save the parent and reviewed children. Optional
attachments belong to the parent. Endpoints are created manually; confirmed
component deletion removes the associated endpoints.

## Rules

- The 155 source rows resolve to 154 equipment definitions. Boiler Feed Pump
  uses Motor, Turbine, Coupling, Pump Shaft and Impellers.
- CSV names and templates supersede matching legacy creation choices. Existing
  stored identifiers (including Pumps, Chillers and Rotary_Dryer) remain valid.
- Unmatched current creation choices are standalone and generate no children,
  regardless of drive arrangement.
- Slash alternatives are separate drafts. `Bowl + Scroll` is also split.
  Shared suffixes are preserved in Harmonic/Planetary Gearbox,
  Die/Roller Shaft and Crank/Chain Mechanism.
- Grouped entries such as Multiple Impellers and Twin Screw Shafts remain one
  draft with `grouped: true`. `default_quantity: 1` represents a draft, not a
  claimed physical quantity. The preview lets users choose a quantity to split
  them into separately numbered children.
- Drive arrangement adds coupling, gearbox, shaft, or belt/pulley templates.
  Existing components are retained. Additions do not duplicate a matching
  coupling, gearbox or shaft, and belt drives require two pulley drafts.
- Machine-specific component names are kept separately from diagnostic
  families. Pump Shaft is a shaft; Servo Motor and VFD Motor are motors. This
  preserves existing motor-only energy endpoint behavior. Impeller, Piston,
  Turbine and the other new families have distinct identifiers.
- Component nameplate details can be empty. Defining a new family does not add
  a new fault detector or a nameplate field schema.

## Files and synchronization

`scripts/generate-asset-train-catalog.cjs` owns source interpretation, families,
roles and drive additions. It writes identical `asset-train-catalog.data.json`
snapshots to backend_express, cmmsF and data_processors. The backend TypeScript
helper is also copied to the frontend. Projects use local snapshots at runtime;
deployments do not require access to sibling repositories or the original CSV.

From backend_express in the normal three-project workspace:

```text
npm run catalog:generate
npm run catalog:check
npm run test:catalog
npm run test:asset-train
```

Generation rejects unknown source components and unresolved duplicate equipment
instead of silently guessing. `catalog:check` verifies source freshness and
agreement between all snapshots and TypeScript helpers without writing files.

## Consumers

- `GET /api/master/assets/catalog` exposes the versioned definition through the
  existing master routes.
- Request validation and Mongo's asset enum use the same supported asset types.
- The frontend exposes `ApiService.assetCreationTypes` in Create Asset and uses the
  registry for diagnostic component options, roles, and train-family suggestions.
- Django canonicalizes known machine names and component aliases. Existing
  custom diagnostic slugs remain accepted. No database migration is needed.
- Parent/child persistence, initial diagnostic metadata, manual component
  management and confirmed endpoint deletion are implemented.

## Creation preview

The new top-level Create Asset modal offers the combined catalog choices. CSV
equipment displays every suggested component as an editable row; unmatched
legacy choices remain standalone. Editing an existing asset or manually adding
a child does not regenerate component suggestions.

- A user can rename or remove rows, add a component from the registry, and
  choose whole-number quantities. Quantities above one preview numbered names.
- Asset Type changes and Reset suggestions replace the draft list. Drive
  arrangement changes retain equipment/manual edits and reconcile only the
  additional drive suggestions. Explicit removals remain removed until reset.
- Validation rejects blank names, duplicate final child names, names over 200
  characters (including number suffixes), and more than 1,999 children. The
  diagnostic inventory limit is 2,000 assets including the parent.
- `AssetModalComponent.getComponentDrafts()` returns independent, expanded
  child specifications with stable keys, display names, asset types, component
  families and roles for persistence. It rejects invalid drafts.
- The submitted asset fields, reviewed children and train settings are captured
  before attachment upload. A failed creation can retry without losing drafts
  or uploading the same successful attachments twice.

## Persistence and failure behavior

`POST /api/master/assets/train` accepts the usual top-level asset fields and a
required `components` array. Each expanded child contains `key`, `name`,
`asset_type`, `component_type` and `component_role`. An empty reviewed array is
allowed. Standalone choices continue using `/old`; updates do not regenerate
children.

- The API validates component keys, names, diagnostic families and roles before
  writing. Location and active-user ownership are checked against the signed-in
  account. Account and creator IDs come from authentication.
- The subscription capacity check counts the parent plus every child. Mongo
  assets and their user/alarm mappings share one transaction when supported.
- Every child is directly under the new parent, has the same root ID, location,
  class, timezone and alarm selections, and has empty model/manufacturer/year,
  description, asset ID and attachments. Motors/generators/alternators are
  electric; other mechanical components are non-electric.
- Children store `diagnostic_component_key`, `diagnostic_component_type` and
  `diagnostic_component_role` for later recovery. No endpoints are created.
- Asset health is initialized for all created IDs after Mongo commit. A creation
  or processor error triggers compensation for the explicitly planned assets
  and mappings, scoped to the account. This also covers partial writes on Mongo
  deployments without transaction support. Cleanup failures are surfaced.
- The response preserves `data: [parent]` and adds `components`, with the saved
  `asset_id` for each reviewed child. The frontend then saves the existing Django
  train profile with these IDs and empty nameplate/metadata objects. Django
  resolves the authoritative inventory from Mongo and rejects unrelated IDs.
- Metadata saving is a subsequent request. If it fails, the hierarchy remains
  created and the UI points to Setup Diagnostics. That screen seeds persisted
  component keys even before endpoints exist and retains saved diagnostic edits.
  This avoids creating the parent/children again just to retry metadata.
- A notification failure does not undo a successfully created train.
- The Express processor client requires an absolute HTTP/HTTPS
  `PROCESSOR_API_URL`. A missing or invalid URL returns
  `PROCESSOR_API_NOT_CONFIGURED` instead of the original generic Invalid URL.
  Request logs omit authorization tokens.

## Component management and deletion

Setup Diagnostics offers **Create child component** and **Use existing asset**.
The first saves one new child directly under the top-level asset; the second
adds a diagnostic row on an existing hierarchy asset. It never regenerates the
train. New children inherit the parent location, class, timezone, alarm settings
and user mappings, and start with empty nameplate details. Creating a child is
an immediate action; saving diagnostic details remains a separate action.

- `POST /api/master/assets/:rootId/components` accepts `name` and `asset_type`.
  It requires `add_child_asset`, validates account ownership, sibling names and
  train/subscription capacity, initializes health, and compensates only the
  new child if creation fails. A unique persisted component key enables recovery
  if the dialog is closed before its diagnostic details are saved.
- Registered children can be edited with the existing Edit Asset action.
  Their component catalog types are selectable. Updates preserve the component
  key, parent, root and account, and update the stored diagnostic family/role.
  Existing diagnostic nameplate details are edited in Setup Diagnostics.
- Deleting a saved component first shows a warning icon and explicitly states
  that all associated vibration and energy endpoints will be deleted. Cancel
  makes no deletion request. Creation/deletion controls respect asset permissions
  and disable repeat submissions while an operation is pending.
- `DELETE /api/master/assets/:rootId/components/:componentId?delete_endpoints=true`
  requires `delete_asset` and explicit endpoint confirmation. It accepts a direct
  leaf component in the authenticated account. Parent/train cascades are not part
  of this action: remove a component's children first, and remove registered
  components before deleting their parent through the ordinary asset action.
- Express calls Django `DELETE asset-train-metadata/child-component/` with the
  root ID, child ID and `delete_endpoints: true`. Django independently resolves
  the visible Mongo parent/child, checks organization and leaf ownership, then
  transactionally deletes vibration mounts, energy mounts, equipment records,
  endpoint diagnostic bindings, and the child's component/profile inventory.
  Foreign endpoint ownership rejects the operation. Vibration configuration
  records follow their existing foreign-key cascades. Parent and sibling
  endpoints are retained. Deleted signal/bearing cache entries are invalidated
  after commit; a cache failure is logged without undoing the SQL commit.
- Only after Django acknowledges that exact child ID does Express hide the
  Mongo child, its related records and user mappings. A processor failure leaves
  the child available. SQL deletion is safe to repeat if Mongo hiding needs a
  retry. These are separate database transactions, not a distributed transaction.
  No live PostgreSQL/Mongo integration test has been performed.
- `DELETE asset-train-metadata/components/` removes a saved diagnostic row on
  an existing asset. It accepts the root ID, component key and confirmation;
  deletes only typed endpoints bound to that key; and retains the asset itself.
  Registered Mongo children must use the Express child deletion action.
- The asset tree and general information Delete actions use the same confirmed
  path for registered direct child components. Setup Diagnostics retains other
  unsaved edits while removing the deleted child's rows and endpoints. The UI
  forwards its configured Mongo environment for processor ownership checks.

## Focused verification

The frontend catalog specs can run independently of unrelated legacy specs:

```text
ng test --watch=false --browsers=ChromeHeadless --ts-config=tsconfig.asset-creation.spec.json --include=src/app/shared/catalog/asset-train-catalog.spec.ts --include=src/app/default/assets/asset-modal/asset-modal.component.spec.ts --include=src/app/default/assets/diagnostic-setup/diagnostic-setup.component.spec.ts
```

The Python registry and metadata validation tests require no external services:

```text
python -B -m unittest app.diagnostic_metadata.tests.test_catalog app.diagnostic_metadata.tests.test_creation_contract
```

`test_components` uses isolated SQLite models to exercise the production
deletion queries, foreign-key configuration cascades, typed endpoint IDs,
inventory cleanup and SQL rollback. Run it with Django configured for an
in-memory SQLite database and `django.contrib.contenttypes` installed; it does
not read or modify live Mongo/PostgreSQL data. Production model/API imports are
also checked separately from that isolated schema.
