import test from 'node:test';
import assert from 'node:assert/strict';
import { validationResult } from 'express-validator';
import {
  ASSET_TRAIN_CATALOG, buildComponentTemplates, getAssetCreationOptions,
  getCatalogTrainType, getComponentDefinition, getEquipmentDefinition,
  normalizeCatalogName, SUPPORTED_ASSET_TYPES
} from './asset-train-catalog';
import { assetValidator } from '../masters/asset/asset.validator';
import { AssetModel } from '../models/asset.model';

test('all CSV equipment is represented once, with the chosen Boiler Feed Pump definition', () => {
  assert.equal(ASSET_TRAIN_CATALOG.source.row_count, 155);
  assert.equal(ASSET_TRAIN_CATALOG.equipment.length, 154);
  const names = ASSET_TRAIN_CATALOG.equipment.map(item => item.id);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(buildComponentTemplates('Boiler Feed Pump').map(item => item.name),
    ['Motor', 'Turbine', 'Coupling', 'Pump Shaft', 'Impellers']);
});

test('CSV names win over standalone aliases while unmatched existing types remain standalone', () => {
  const options = getAssetCreationOptions();
  assert.equal(new Set(options.map(item => normalizeCatalogName(item.name))).size, options.length);
  for (const type of ['Motor', 'Pumps', 'Gearbox', 'Other']) {
    assert.equal(options.find(item => item.value === type)?.creationMode, 'standalone');
    assert.deepEqual(buildComponentTemplates(type, 'gearbox'), []);
  }
  assert.equal(options.filter(item => item.name === 'Mixer').length, 1);
  assert.equal(options.find(item => item.name === 'Mixer')?.creationMode, 'train');
  assert.equal(getEquipmentDefinition('Chillers')?.name, 'Chiller');
  assert.equal(options.some(item => item.value === 'Chillers'), false);
  assert.equal(options.find(item => item.name === 'Rotary Dryer')?.creationMode, 'train');
});

test('slash and plus components are distinct, preserving meaningful shared suffixes', () => {
  assert.deepEqual(buildComponentTemplates('Industrial Robot Arm').map(item => item.name),
    ['Servo', 'Harmonic Gearbox', 'Planetary Gearbox', 'Joint']);
  assert.deepEqual(buildComponentTemplates('Decanter Centrifuge').map(item => item.name),
    ['Motor', 'Gearbox', 'Bowl', 'Scroll']);
  assert.equal(getComponentDefinition('Servo Motor')?.value, 'motor');
  assert.equal(getComponentDefinition('Impeller')?.value, 'impeller');
  assert.equal(getComponentDefinition('Turbine')?.role, 'driver');
});

test('drive additions avoid duplicates and preserve two separately named pulleys', () => {
  assert.equal(buildComponentTemplates('Reciprocating Pump', 'gearbox')
    .filter(item => item.component_type === 'gearbox').length, 1);
  assert.equal(buildComponentTemplates('Centrifugal Pump', 'direct_coupled')
    .filter(item => item.component_type === 'coupling').length, 1);
  const belt = buildComponentTemplates('Belt Driven Fan', 'belt');
  assert.equal(belt.filter(item => item.component_type === 'belt_pulley').length, 2);
  assert.equal(belt.filter(item => item.component_type === 'belt').length, 1);
  assert.equal(buildComponentTemplates('Centrifugal Pump', 'belt')
    .filter(item => item.component_type === 'belt_pulley').length, 2);
});

test('grouped quantities stay undecided and drafts cannot mutate the catalog', () => {
  const templates = buildComponentTemplates('Multistage Pump');
  const impellers = templates.find(item => item.component_type === 'impeller')!;
  assert.equal(impellers.grouped, true);
  assert.equal(impellers.default_quantity, 1);
  impellers.name = 'Edited';
  assert.equal(buildComponentTemplates('Multistage Pump').find(item => item.component_type === 'impeller')?.name,
    'Multiple Impellers');
});

test('every child template has a supported asset type, diagnostic family, role and unique key', () => {
  const roles = new Set(['driver', 'transmission', 'driven', 'support', 'auxiliary']);
  for (const equipment of ASSET_TRAIN_CATALOG.equipment) {
    assert.equal(SUPPORTED_ASSET_TYPES.includes(equipment.asset_type), true, equipment.name);
    assert.equal(getCatalogTrainType(equipment.name), equipment.train_type);
    assert.equal(new Set(equipment.components.map(item => item.key)).size, equipment.components.length);
    for (const component of equipment.components) {
      assert.equal(SUPPORTED_ASSET_TYPES.includes(component.asset_type), true, component.name);
      assert.equal(getComponentDefinition(component.component_type)?.value, component.component_type);
      assert.equal(roles.has(component.component_role), true, component.name);
    }
  }
});

test('request validation and the Mongo asset schema accept catalog types and reject unknown types', async () => {
  for (const type of [...SUPPORTED_ASSET_TYPES, 'Unrecognized Machine']) {
    const req: any = { body: {
      asset_name: 'Catalog validation', asset_type: type,
      locationId: '63c8eb45ff7b8f5a8f49a682', alarmType: ['alert']
    } };
    for (const rule of assetValidator) await rule.run(req);
    const errors = validationResult(req);
    assert.equal(errors.isEmpty(), type !== 'Unrecognized Machine', type);
    const document = new AssetModel(req.body);
    const schemaError: any = await document.validate().then(() => undefined, error => error);
    assert.equal(!!schemaError?.errors['asset_type'], type === 'Unrecognized Machine', type);
  }
});
