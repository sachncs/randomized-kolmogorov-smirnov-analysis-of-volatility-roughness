/**
 * Models index - exports all rough volatility models.
 * Google JS Style Guide compliant.
 */

export {rBergomi, rBergomiPrice} from './rbergomi.js';
export {rFSV, rFSVPrice} from './rfsv.js';
export {fOU, exactOU} from './fou.js';
export {mpre, mpreExact} from './mpre.js';
export {
  arfima,
  fractionalDifference,
  createLSTM,
  createAttentionModel,
  holtWintersForecast,
} from './forecasting.js';

import {rBergomi, rBergomiPrice} from './rbergomi.js';
import {rFSV, rFSVPrice} from './rfsv.js';
import {fOU, exactOU} from './fou.js';
import {mpre, mpreExact} from './mpre.js';
import {
  arfima,
  createLSTM,
  createAttentionModel,
  holtWintersForecast,
} from './forecasting.js';

/**
 * Model registry for dynamic lookup.
 * Maps model names to their exported entry points.
 */
const MODEL_REGISTRY = new Map([
  ['rBergomi', {simulate: rBergomi, price: rBergomiPrice}],
  ['rFSV', {simulate: rFSV, price: rFSVPrice}],
  ['fOU', {simulate: fOU, exact: exactOU}],
  ['mpre', {simulate: mpre, exact: mpreExact}],
  ['arfima', {forecast: arfima}],
  ['lstm', {forecast: createLSTM}],
  ['attention', {forecast: createAttentionModel}],
  ['holtWinters', {forecast: holtWintersForecast}],
]);

/**
 * Retrieves a registered model by name.
 * @param {string} name Model identifier.
 * @return {Object|undefined} Model entry or undefined.
 */
export function getModel(name) {
  return MODEL_REGISTRY.get(name);
}

/**
 * Registers a new model in the factory.
 * @param {string} name Model identifier.
 * @param {Object} entry Model entry object.
 */
export function registerModel(name, entry) {
  MODEL_REGISTRY.set(name, entry);
}

/**
 * Lists all registered model names.
 * @return {Array<string>} Registered model names.
 */
export function listModels() {
  return Array.from(MODEL_REGISTRY.keys());
}