/**
 * @fileoverview Public export surface for the rough-volatility model zoo.
 *
 * Bundles every concrete model into a single import target (`rBergomi`,
 * `rFSV`, `fOU`, `mPRE`, plus the `arfima`/`holtWinters`/`lstm`/
 * `attention` forecasters) and provides a tiny registry so applications
 * can dispatch on a model name string.
 */

import {rBergomi, rBergomiPrice} from './rbergomi.js';
import {rFSV, rFSVPrice} from './rfsv.js';
import {fOU, exactOU} from './fou.js';
import {mPRE, mPREExact} from './mpre.js';
import {
  arfima,
  holtWintersForecast,
  createLSTM,
  createAttentionModel,
} from './forecasting.js';

export {
  rBergomi,
  rBergomiPrice,
  rFSV,
  rFSVPrice,
  fOU,
  exactOU,
  mPRE,
  mPREExact,
  arfima,
  holtWintersForecast,
  createLSTM,
  createAttentionModel,
};

/**
 * Model registry mapping string identifiers to model entry points.
 *
 * Each entry exposes a small set of role-specific methods so consumers
 * can dispatch generically: simulators expose `{simulate, price}`,
 * forecasters expose `{forecast}`, neural predictors expose `{predict}`.
 *
 * @private
 */
const MODEL_REGISTRY = new Map([
  ['rBergomi', {simulate: rBergomi, price: rBergomiPrice}],
  ['rFSV', {simulate: rFSV, price: rFSVPrice}],
  ['fOU', {simulate: fOU, exact: exactOU}],
  ['mPRE', {simulate: mPRE, exact: mPREExact}],
  ['arfima', {forecast: arfima}],
  ['holtWinters', {forecast: holtWintersForecast}],
  ['lstm', {predict: createLSTM}],
  ['attention', {predict: createAttentionModel}],
]);

/**
 * Retrieves a registered model by name.
 *
 * @param {string} name Model identifier (one of the keys in
 *   `MODEL_REGISTRY`, or a custom name registered via
 *   {@link registerModel}).
 * @return {Object|undefined} The registry entry; `undefined` when the
 *   name is unknown.
 */
export function getModel(name) {
  return MODEL_REGISTRY.get(name);
}

/**
 * Adds a new entry to the model registry.
 *
 * Use this to expose user-defined simulators under the same dispatch
 * surface as the built-in models. Be aware the registry is in-memory
 * only — registrations are lost when the module is reloaded.
 *
 * @param {string} name Unique identifier under which to register.
 * @param {Object} entry Entry object (`{simulate, price}`, `{forecast}`,
 *   or `{predict}` depending on the role of the model).
 */
export function registerModel(name, entry) {
  MODEL_REGISTRY.set(name, entry);
}

/**
 * Lists the identifiers of all currently registered models.
 *
 * @return {Array<string>} Snapshot of the registry's keys.
 */
export function listModels() {
  return Array.from(MODEL_REGISTRY.keys());
}
