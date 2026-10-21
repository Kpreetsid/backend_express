import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ANALYSIS_FEATURES } from './defaultAnalysisFeatures';
import { PA_FAN_ANALYSIS_FEATURES } from './paFanAnalysisFeatures';
import { mergeDefaultFeatureSelections, sanitizeAnalysisFeatureSelection } from './selectionPolicy';

test('fan catalogue exposes 39 unique charts with all 24 instruments and five calculated parameters', () => {
  const features = PA_FAN_ANALYSIS_FEATURES.subCategory;
  assert.equal(features.length, 39);
  assert.equal(new Set(features.map(item => item.id)).size, 39);
  assert.equal(features.every(item => item.isSelected === false), true);
  for (const field of ['pt-8313a','pt-8313f','te-8332a','yfj3-ai','yfj3-zd1','yfj3-zd2','air-8301b','ft-8306a'])
    assert.equal(features.some(item => item.id === 'pa-fan-' + field), true);
  for (const id of ['pressure-rise','air-power','efficiency','specific-power','bearing-max'])
    assert.equal(features.some(item => item.id === 'pa-fan-' + id), true);
});

test('existing account selections survive addition of fan features and a later catalogue reload', () => {
  const legacy = structuredClone(DEFAULT_ANALYSIS_FEATURES.filter(category => category.id !== 'pa_fan'));
  const chiller = legacy.find(category => category.id === 'chiller')!;
  chiller.subCategory[0].isSelected = true;
  const merged: any = mergeDefaultFeatureSelections(DEFAULT_ANALYSIS_FEATURES, legacy);
  assert.equal(merged.find((category: any) => category.id === 'chiller').subCategory[0].isSelected, true);
  const fan = merged.find((category: any) => category.id === 'pa_fan');
  assert.equal(fan.subCategory.every((item: any) => item.isSelected === false), true);
  fan.subCategory[0].isSelected = true;
  const again: any = mergeDefaultFeatureSelections(DEFAULT_ANALYSIS_FEATURES, merged);
  assert.equal(again.find((category: any) => category.id === 'pa_fan').subCategory[0].isSelected, true);
});

test('feature selection accepts fan charts while retaining server-owned identifiers and titles', () => {
  const request = structuredClone(DEFAULT_ANALYSIS_FEATURES);
  const fan = request.find(category => category.id === 'pa_fan')!;
  fan.subCategory[0].isSelected = true;
  fan.subCategory[0].name = 'Modified title';
  const sanitized: any = sanitizeAnalysisFeatureSelection(DEFAULT_ANALYSIS_FEATURES, request);
  assert.equal(sanitized.find((category: any) => category.id === 'pa_fan').subCategory[0].isSelected, true);
  assert.equal(sanitized.find((category: any) => category.id === 'pa_fan').subCategory[0].name, 'Fan electrical power');
});
