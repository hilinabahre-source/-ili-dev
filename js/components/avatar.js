import { mount } from "https://embed.bodydbl.com/1.0.2/viewer.js";

let viewer;
let debounceTimer;
let currentUnit = 'metric';

export const lengthFieldIds = [
  'shoulderWidth', 'neckToWaistBack', 'neckToWaistFront',
  'chestGirth', 'underbustGirth', 'armLength', 'bicepGirth',
  'waistGirth', 'hipGirth', 'thighGirth', 'crotchHeight'
];

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;

// Every number field remembers the exact metric value (cm / kg) behind what it shows
// (data-metric) and the text it was shown as (data-shown). Switching units, reopening the
// profile or saving without editing reuses that exact value, so nothing drifts through
// rounding. A number the customer types themselves always becomes the new value.
const DISPLAY_DECIMALS = 2;
const METRIC_DECIMALS = 4;
const kindOf = (inputId) => (inputId === 'bd-weight' ? 'weight' : 'length');
const round = (n, d) => Number(n.toFixed(d));

function metricToUnit(metric, kind, unit) {
  if (unit !== 'imperial') return metric;
  return kind === 'weight' ? metric / KG_PER_LB : metric / CM_PER_IN;
}
function unitToMetric(value, kind, unit) {
  if (unit !== 'imperial') return value;
  return kind === 'weight' ? value * KG_PER_LB : value * CM_PER_IN;
}

// Fill a profile field from a saved metric value (cm or kg), shown in the current unit.
export function setFieldMetric(inputId, metric) {
  const input = document.getElementById(inputId);
  const value = Number(metric);
  if (metric == null || metric === '' || !Number.isFinite(value)) {
    input.value = '';
    delete input.dataset.metric;
    delete input.dataset.shown;
    return;
  }
  const shown = String(round(metricToUnit(value, kindOf(inputId), currentUnit), DISPLAY_DECIMALS));
  input.value = shown;
  input.dataset.metric = String(value);
  input.dataset.shown = shown;
}

// The metric value of a field, read in the given unit (the unit currently on screen).
function fieldMetric(inputId, unit = currentUnit) {
  const input = document.getElementById(inputId);
  if (input.value.trim() === '') return null;
  if (input.dataset.metric != null && input.value === input.dataset.shown) return Number(input.dataset.metric);
  const typed = parseFloat(input.value);
  if (!Number.isFinite(typed)) return null;
  return round(unitToMetric(typed, kindOf(inputId), unit), METRIC_DECIMALS);
}

const allNumberFieldIds = () => ['bd-height', 'bd-weight', ...lengthFieldIds.map(id => 'bd-' + id)];

function updateUnitLabels() {
  const lengthLabel = currentUnit === 'imperial' ? 'in' : 'cm';
  const weightLabel = currentUnit === 'imperial' ? 'lb' : 'kg';
  document.querySelectorAll('.bd-unit-length').forEach(el => el.textContent = lengthLabel);
  document.querySelectorAll('.bd-unit-weight').forEach(el => el.textContent = weightLabel);
}

// Re-show every field in the new unit, starting from its exact metric value.
function switchDisplayedUnit(fromUnit, toUnit) {
  const metrics = allNumberFieldIds().map(id => [id, fieldMetric(id, fromUnit)]);
  currentUnit = toUnit;
  metrics.forEach(([id, metric]) => setFieldMetric(id, metric));
}

export function collectProfile() {
  const gender = document.getElementById('bd-gender').value;
  const fields = {};

  const height = fieldMetric('bd-height');
  if (height != null) fields.height = height;

  const weight = fieldMetric('bd-weight');
  if (weight != null) fields.weight = weight;

  lengthFieldIds.forEach(id => {
    const value = fieldMetric('bd-' + id);
    if (value != null) fields[id] = value;
  });

  return { schemaVersion: 1, gender, unitSystem: 'metric', fields };
}

// Exposed so other parts of the site (like pattern pages) can read the
// customer's real entered measurements, always converted to cm/kg.
window.getCustomerBodyMeasurements = collectProfile;

function scheduleUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    if (!viewer) return;

    try {
      await viewer.setProfile(collectProfile());
    } catch (err) {
      console.error('BodyDouble update failed:', err);
    }
  }, 300);
}

function watchField(fieldId, measurementKey) {
  const el = document.getElementById(fieldId);
  el.addEventListener('input', scheduleUpdate);
  el.addEventListener('focus', () => {
    viewer?.showMeasurement(measurementKey, { autoZoom: true }).catch(() => {});
  });
}

document.getElementById('bd-unit').addEventListener('change', (e) => {
  switchDisplayedUnit(currentUnit, e.target.value);
  updateUnitLabels();
  scheduleUpdate();
});

currentUnit = document.getElementById('bd-unit').value;
updateUnitLabels();

// Mounting a WebGL viewer into a hidden/zero-size container is what
// broke this the last time it lived inside a modal, so this no longer
// runs at page load — it's only called once the profile modal (which
// now holds body-view) has actually been made visible and laid out.
window.initBodyDoubleViewer = async function initBodyDoubleViewer(){
  try {
    viewer = mount({
      target: '#body-view',
      siteKey: "bd_site_2g3wFctQ5NH03P1zEw05IME9dNlWYPIi"
    });
    await viewer.ready;

    try {
      await viewer.setAppearance({ preset: 'light' });
    } catch (appearanceErr) {
      console.warn('Could not set appearance:', appearanceErr);
    }

    // Subscribe before the first setProfile call, per SeamScape's docs.
    viewer.on('profile', profile => {
      console.log('BodyDouble profile update:', profile.fields);
    });
    // Only these mean the viewer itself is broken. Everything else (like a
    // single field being out of range while someone's still typing) is a
    // normal, recoverable per-update error and shouldn't kill the viewer.
    const FATAL_ERROR_CODES = new Set([
      'INIT_TIMEOUT',
      'VERSION_MISMATCH',
      'WEBGL_UNAVAILABLE',
      'WEBGL_CONTEXT_LOST',
      'MODEL_LOAD_FAILED',
      'VIEWER_ERROR',
      'DESTROYED'
    ]);

    viewer.on('error', err => {
      console.error('BodyDouble runtime error:', err);
      if (FATAL_ERROR_CODES.has(err?.code)) {
        document.querySelector('#body-view').textContent =
          '3D preview ran into a problem. You can continue entering measurements.';
      }
    });

    document.getElementById('bd-gender').addEventListener('change', scheduleUpdate);
    document.getElementById('bd-height').addEventListener('input', scheduleUpdate);
    document.getElementById('bd-weight').addEventListener('input', scheduleUpdate);
    lengthFieldIds.forEach(id => {
      watchField('bd-' + id, id);
    });
  } catch (error) {
    viewer?.destroy();
    document.querySelector('#body-view').textContent =
      '3D preview unavailable. You can continue entering measurements.';
  }
};
