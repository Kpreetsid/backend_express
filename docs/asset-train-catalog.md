# Asset train catalog and creation preview — Phases 1–2

The catalog combines existing standalone choices with the equipment and drive
trains supplied in `catalog/asset_train.csv`. The Create Asset modal uses it to
prepare an editable preview. Creating the parent and reviewed children together
is Phase 3 work; attachment, endpoint creation and deletion remain separate.

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
- Child creation, inherited fields, and hierarchy/metadata synchronization are
  Phase 3 work. Component management and the Django endpoint deletion cascade
  remain later work.

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
  characters (including number suffixes), and more than 2,000 total children.
- `AssetModalComponent.getComponentDrafts()` returns independent, expanded
  child specifications with stable keys, display names, asset types, component
  families and roles for Phase 3 persistence. It rejects invalid drafts.
- Catalog train submission is deliberately gated with a visible availability
  message until Phase 3 can persist all reviewed children. No asset, attachment
  upload or diagnostic save is sent for a catalog preview. Standalone asset
  creation and existing edit/manual child paths retain their current save flow.

Phase 3 should remove the preview-only submit gate when the backend consumes
these drafts and synchronizes the created child IDs into diagnostic metadata.

## Focused verification

The frontend catalog specs can run independently of unrelated legacy specs:

```text
ng test --watch=false --browsers=ChromeHeadless --ts-config=tsconfig.asset-creation.spec.json --include=src/app/shared/catalog/asset-train-catalog.spec.ts --include=src/app/default/assets/asset-modal/asset-modal.component.spec.ts
```

The Python registry and metadata validation tests require no external services:

```text
python -B -m unittest app.diagnostic_metadata.tests.test_catalog
```
