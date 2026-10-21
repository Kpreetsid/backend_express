/**
 * Build the Phase 1 catalog from the supplied CSV. Run with --check in CI to
 * verify that the independently deployed projects carry the same definition.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const backendRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(backendRoot, '..');
const sourcePath = path.join(backendRoot, 'catalog', 'asset_train.csv');
const outputPaths = [
  path.join(backendRoot, 'src/catalog/asset-train-catalog.data.json'),
  path.join(workspaceRoot, 'cmmsF/src/app/shared/catalog/asset-train-catalog.data.json'),
  path.join(workspaceRoot, 'data_processors/app/diagnostic_metadata/asset-train-catalog.data.json'),
];

function slug(value) {
  return value.trim().toLowerCase().replace(/[\s/&+()-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

// RFC 4180 quoting support keeps a future comma in a label from shifting columns.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some(value => value.trim())) rows.push(row);
      row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('Unterminated CSV quote.');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const trainTypes = [
  ['motor_train', 'Motor / driver train'], ['pump_train', 'Pump train'],
  ['fan_train', 'Fan train'], ['blower_train', 'Blower train'],
  ['compressor_train', 'Compressor train'], ['gearbox_train', 'Gearbox train'],
  ['chiller_train', 'Chiller train'], ['cnc_train', 'CNC machine train'],
  ['extruder_train', 'Extruder train'], ['mixer_agitator_train', 'Mixer / agitator train'],
  ['kiln_rotary_dryer_train', 'Kiln / rotary dryer train'], ['other', 'Other machine train'],
].map(([value, label]) => ({ value, label }));

// Existing persisted identifiers remain valid. Catalog names supersede matching
// creation choices, without renaming assets already stored in MongoDB.
const legacyAssetTypes = [
  ['Equipment', 'Equipment', 'other', false], ['Motor', 'Motor', 'motor_train', true],
  ['Flexible', 'Flexible coupling', 'other', false], ['Rigid', 'Rigid coupling', 'other', false],
  ['Belt_Pulley', 'Belt / pulley', 'other', false], ['Gearbox', 'Gearbox', 'gearbox_train', true],
  ['Fan_Blower', 'Fan Blower', 'fan_train', true], ['Fan', 'Fan', 'fan_train', true],
  ['Blower', 'Blower', 'blower_train', true], ['Pumps', 'Pump', 'pump_train', true],
  ['Compressor', 'Compressor', 'compressor_train', true], ['Chillers', 'Chiller', 'chiller_train', true],
  ['CNC', 'CNC machine', 'cnc_train', true], ['Other', 'Other', 'other', true],
  ['Extruder', 'Extruder', 'extruder_train', true], ['Mixer', 'Mixer', 'mixer_agitator_train', true],
  ['Agitator', 'Agitator', 'mixer_agitator_train', true], ['Kiln', 'Kiln', 'kiln_rotary_dryer_train', true],
  ['Rotary_Dryer', 'Rotary dryer', 'kiln_rotary_dryer_train', true],
].map(([value, name, train_type, selectable]) => ({ value, name, train_type, selectable }));

// A machine-specific display name is independent of its diagnostic family.
// Servo/VFD motors remain motors so energy endpoints can use their nameplate.
const componentFamilies = [
  ['motor', 'Motor', 'driver', ['Servo', 'Servo Motor', 'Spindle Motor', 'VFD Motor', 'Exciter Motor']],
  ['pump', 'Pump', 'driven', ['Pumps', 'Hydraulic Pump']],
  ['fan', 'Fan', 'driven', ['Fan_Blower']], ['blower', 'Blower', 'driven', []],
  ['compressor', 'Compressor', 'driven', []],
  ['gearbox', 'Gearbox', 'transmission', ['Planetary Gearbox', 'Reduction Gearbox', 'Harmonic Gearbox']],
  ['chiller', 'Chiller', 'driven', ['Chillers']], ['cnc', 'CNC machine', 'driven', ['CNC']],
  ['belt_pulley', 'Belt / pulley', 'transmission', ['Pulley', 'Drive Pulley', 'Driven Pulley', 'Driving Pulley', 'Head Pulley', 'Fan Pulley', 'Pump Pulley', 'Sheave']],
  ['flexible_coupling', 'Flexible coupling', 'transmission', ['Flexible']],
  ['rigid_coupling', 'Rigid coupling', 'transmission', ['Rigid']],
  ['coupling', 'Coupling', 'transmission', []],
  ['extruder', 'Extruder', 'driven', []], ['mixer', 'Mixer', 'driven', []],
  ['agitator', 'Agitator', 'driven', []], ['kiln', 'Kiln', 'driven', []],
  ['rotary_dryer', 'Rotary Dryer', 'driven', []],
  ['shaft', 'Shaft', 'transmission', ['Pump Shaft', 'Vertical Shaft', 'Fan Shaft', 'Blower Shaft', 'Compressor Shaft', 'Screw Shaft', 'Rotor Shaft', 'Main Shaft', 'Turbine Shaft', 'Drive Shaft', 'Central Shaft', 'Agitator Shaft', 'Mixer Shaft', 'Countershaft', 'Eccentric Shaft', 'Exciter Shaft', 'Cutter Shaft', 'Bowl Shaft', 'Basket Shaft', 'Roll Shafts', 'Roller Shafts', 'Disc Shafts', 'Mixing Shafts', 'Cutter Shafts', 'Twin Screw Shafts', 'Die Shaft', 'Roller Shaft']],
  ['bearing_housing', 'Bearing housing', 'support', []],
  ['turbine', 'Turbine', 'driver', []], ['engine', 'Engine', 'driver', ['Diesel Engine', 'Gas Engine']],
  ['generator', 'Generator', 'driven', []], ['alternator', 'Alternator', 'driven', []],
  ['impeller', 'Impeller', 'driven', ['Impellers', 'Multiple Impellers']],
  ['rotor', 'Rotor', 'driven', ['Pump Rotor', 'Screw Rotor', 'Male Rotor', 'Female Rotor', 'Turbine Rotor', 'Generator Rotor']],
  ['screw', 'Screw', 'driven', ['Extruder Screw']],
  ['crankshaft', 'Crankshaft', 'transmission', []],
  ['connecting_rod', 'Connecting Rod', 'transmission', []], ['piston', 'Piston', 'driven', []],
  ['gear', 'Gear', 'transmission', ['Drive Gear', 'Driven Gear', 'Timing Gears', 'Reduction Gear', 'Gear Train']],
  ['pinion', 'Pinion', 'transmission', []], ['girth_gear', 'Girth Gear', 'transmission', []],
  ['pinion_stand', 'Pinion Stand', 'transmission', []], ['belt', 'Belt', 'transmission', []],
  ['chain', 'Chain', 'transmission', ['Apron Chain', 'Step Chain']],
  ['sprocket', 'Sprocket', 'transmission', ['Drive Sprocket']],
  ['blade', 'Blade', 'driven', ['Blades', 'Fan Blades', 'Rotor Blades']],
  ['lobe', 'Lobe', 'driven', ['Twin Lobes']], ['propeller', 'Propeller', 'driven', []],
  ['vane', 'Vane', 'driven', ['Vanes']], ['roller', 'Roller', 'driven', ['Rollers', 'Drive Roller']],
  ['roll', 'Roll', 'driven', ['Rolls', 'Work Rolls', 'Forming Rolls', 'Dryer Rolls', 'Printing Rollers', 'Mill Rollers', 'Crushing Rolls']],
  ['spindle', 'Spindle', 'transmission', ['Spindles', 'Vertical Spindle']],
  ['flywheel', 'Flywheel', 'transmission', []], ['clutch', 'Clutch', 'transmission', []],
  ['brake', 'Brake', 'support', []], ['drum', 'Drum', 'driven', ['Rope Drum']],
  ['bowl', 'Bowl', 'driven', []], ['scroll', 'Scroll', 'driven', []],
  ['basket', 'Basket', 'driven', []], ['mandrel', 'Mandrel', 'driven', []],
  ['joint', 'Joint', 'driven', []], ['ball_screw', 'Ball Screw', 'transmission', []],
  ['cylinder', 'Cylinder', 'driven', []], ['ram', 'Ram', 'driven', []],
  ['hammer', 'Hammer', 'driven', ['Hammers']], ['blow_bar', 'Blow Bar', 'driven', ['Blow Bars']],
  ['grinding_table', 'Grinding Table', 'driven', []], ['grinding_bowl', 'Grinding Bowl', 'driven', []],
  ['grinding_wheel', 'Grinding Wheel', 'driven', []], ['refining_disc', 'Refining Disc', 'driven', []],
  ['mill_shell', 'Mill Shell', 'driven', []], ['kiln_shell', 'Kiln Shell', 'driven', []],
  ['turbine_runner', 'Turbine Runner', 'driven', []], ['feeder_deck', 'Feeder Deck', 'driven', []],
  ['jaw', 'Jaw', 'driven', []], ['eccentric', 'Eccentric', 'transmission', []],
  ['mill', 'Mill', 'driven', []], ['injection_unit', 'Injection Unit', 'driven', []],
  ['die', 'Die', 'driven', []],
  ['capstan', 'Capstan', 'driven', []], ['driven_machine', 'Driven Machine', 'driven', []],
  ['crank', 'Crank', 'transmission', []], ['chain_mechanism', 'Chain Mechanism', 'transmission', []],
  ['drive_wheel', 'Drive Wheel', 'driven', []], ['star_wheel', 'Star Wheel', 'driven', []],
  ['rotary_table', 'Rotary Table', 'driven', []], ['carousel', 'Carousel', 'driven', []],
  ['robot', 'Robot', 'driven', []], ['conveyor', 'Conveyor', 'driven', []],
  ['screen', 'Screen', 'driven', []], ['scraper', 'Scraper', 'driven', []], ['rake', 'Rake', 'driven', []],
  ['direct_drive', 'Direct Drive', 'transmission', []],
  ['steam', 'Steam', 'auxiliary', []], ['combustion', 'Combustion', 'auxiliary', []],
  ['other', 'Other component', 'driven', ['Other']],
].map(([value, label, role, aliases]) => ({ value, label, role, aliases }));

const componentByName = new Map();
componentFamilies.find(family => family.value === 'shaft').aliases.push('Aerator Shaft');
for (const family of componentFamilies) {
  for (const name of [family.value, family.label, ...family.aliases]) {
    componentByName.set(slug(name), family);
  }
}

const expansions = {
  'Harmonic/Planetary Gearbox': ['Harmonic Gearbox', 'Planetary Gearbox'],
  'Die/Roller Shaft': ['Die Shaft', 'Roller Shaft'],
  'Crank/Chain Mechanism': ['Crank', 'Chain Mechanism'],
};
const grouped = new Set([
  'Multiple Impellers', 'Impellers', 'Fan Blades', 'Timing Gears', 'Twin Lobes', 'Vanes',
  'Rollers', 'Roll Shafts', 'Hammers', 'Blow Bars', 'Blades', 'Mixing Shafts',
  'Twin Screw Shafts', 'Cutter Shafts', 'Spindles', 'Work Rolls', 'Rolls',
  'Roller Shafts', 'Forming Rolls', 'Rotor Blades', 'Dryer Rolls', 'Printing Rollers',
  'Mill Rollers', 'Crushing Rolls', 'Disc Shafts',
]);

function componentTemplate(name) {
  const family = componentByName.get(slug(name));
  if (!family) throw new Error(`Unmapped component: ${name}`);
  return {
    key: slug(name), name, asset_type: name, component_type: family.value,
    component_role: family.role, grouped: grouped.has(name), default_quantity: 1,
  };
}

function trainType(name) {
  if (/pump/i.test(name)) return 'pump_train';
  if (/chiller/i.test(name)) return 'chiller_train';
  if (/blower/i.test(name)) return 'blower_train';
  if (/fan/i.test(name)) return 'fan_train';
  if (/compressor/i.test(name)) return 'compressor_train';
  if (/extruder/i.test(name)) return 'extruder_train';
  if (/mixer|agitator|kneader|chemical reactor/i.test(name)) return 'mixer_agitator_train';
  if (/kiln|rotary dryer/i.test(name)) return 'kiln_rotary_dryer_train';
  if (/cnc|lathe|milling|machining|grinding machine|drilling|boring/i.test(name)) return 'cnc_train';
  return 'other';
}

const source = fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');
const [header, ...rows] = parseCsv(source);
if (header.join(',') !== 'Equipment,Typical drive train') throw new Error('Unexpected CSV header.');
const equipmentByName = new Map();
const resolvedDuplicates = [];
for (const [index, row] of rows.entries()) {
  if (row.length !== 2) throw new Error(`CSV row ${index + 2} must have two columns.`);
  const [name, train] = row.map(value => value.trim());
  const key = slug(name);
  if (equipmentByName.has(key)) {
    if (name !== 'Boiler Feed Pump' || !equipmentByName.get(key).source_train.includes('Pump Shaft')) {
      throw new Error(`Unresolved duplicate equipment: ${name}`);
    }
    resolvedDuplicates.push({ name, retained: equipmentByName.get(key).source_train, omitted: train });
    continue;
  }
  // '?' is the supplied file's separator (its arrows were already replaced).
  const names = train.split(/\s*(?:\?|\u2192|->)\s*/).flatMap(segment =>
    expansions[segment] || segment.split(/\s*[\/+]\s*/)
  ).filter(Boolean);
  const uniqueNames = [...new Map(names.map(component => [slug(component), component])).values()];
  equipmentByName.set(key, {
    id: key, name, asset_type: name, train_type: trainType(name), source_train: train,
    components: uniqueNames.map(componentTemplate),
  });
}

const driveComponents = {
  direct_coupled: ['Coupling'], belt: ['Belt', 'Driving Pulley', 'Driven Pulley'],
  gearbox: ['Gearbox'], direct_shaft: ['Shaft'], standalone: [], other: [],
};
const catalog = {
  schema_version: 1,
  source: { file: 'asset_train.csv', sha256: crypto.createHash('sha256').update(source).digest('hex'), row_count: rows.length, resolved_duplicates: resolvedDuplicates },
  train_types: trainTypes,
  legacy_asset_types: legacyAssetTypes,
  component_types: componentFamilies,
  equipment: [...equipmentByName.values()],
  drive_components: Object.fromEntries(Object.entries(driveComponents).map(([drive, names]) => [drive, names.map(componentTemplate)])),
};
const serialized = JSON.stringify(catalog, null, 2) + '\n';
let outdated = false;
for (const output of outputPaths) {
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== serialized) {
      console.error(`Catalog is out of date: ${path.relative(workspaceRoot, output)}`);
      outdated = true;
    }
  } else {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, serialized);
  }
}
console.log(`${catalog.equipment.length} equipment definitions; ${catalog.component_types.length} component families; ${outputPaths.length} catalog copies.`);
const moduleSource = path.join(backendRoot, 'src/catalog/asset-train-catalog.ts');
const moduleCopy = path.join(workspaceRoot, 'cmmsF/src/app/shared/catalog/asset-train-catalog.ts');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(moduleSource, 'utf8') !== fs.readFileSync(moduleCopy, 'utf8')) {
    console.error('Frontend and backend catalog helpers differ.');
    outdated = true;
  }
} else {
  fs.copyFileSync(moduleSource, moduleCopy);
}
if (outdated) process.exitCode = 1;
