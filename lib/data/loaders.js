/**
 * Data loading utilities for RK-SAVR experiments.
 * CSV and JSON parsing with validation.
 */

/**
 * Parses a CSV string into an array of objects.
 * Expects the first row to be headers.
 * Handles basic quoting and comma separation.
 *
 * @param {string} csv Raw CSV string.
 * @param {Object} opts Options.
 * @param {string} opts.dateField Field to parse as Date (default 'date').
 * @param {Array<string>} opts.numericFields Fields to parse as numbers.
 * @return {Array<Object>} Parsed rows.
 */
export function parseCSV(csv, opts = {}) {
  if (typeof csv !== 'string') throw new Error('csv must be a string');
  if (csv.trim().length === 0) return [];

  const lines = csv.trim().split('\n');
  if (lines.length === 0) return [];

  const headers = _splitCSVLine(lines[0]);
  const dateField = opts.dateField || 'date';
  const numericFields = opts.numericFields || [];

  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;
    const values = _splitCSVLine(line);
    if (values.length !== headers.length) {
      throw new Error(
        `Row ${i + 1} has ${values.length} columns, expected ${headers.length}`,
      );
    }

    const row = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j].trim();
      const raw = values[j].trim();
      if (numericFields.includes(key)) {
        const num = parseFloat(raw);
        if (Number.isNaN(num))
          throw new Error(
            `Non-numeric value "${raw}" in row ${i + 1}, column "${key}"`,
          );
        row[key] = num;
      } else if (key === dateField) {
        const d = new Date(raw);
        if (Number.isNaN(d.getTime()))
          throw new Error(`Invalid date "${raw}" in row ${i + 1}`);
        row[key] = d;
      } else {
        row[key] = raw;
      }
    }
    result.push(row);
  }

  return result;
}

/**
 * Splits a CSV line respecting quoted fields.
 * @private
 * @param {string} line
 * @return {Array<string>} Split fields.
 */
function _splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Extracts a numeric time series from parsed CSV rows.
 *
 * @param {Array<Object>} rows Parsed rows.
 * @param {string} field Field name to extract.
 * @param {Object} opts Options.
 * @param {boolean} opts.sortByDate Sort by date field before extraction.
 * @param {string} opts.dateField Date field name (default 'date').
 * @return {Array<{date: Date, value: number}>} Time series.
 */
export function extractSeries(rows, field, opts = {}) {
  if (!Array.isArray(rows)) throw new Error('rows must be an array');
  if (typeof field !== 'string') throw new Error('field must be a string');

  const dateField = opts.dateField || 'date';
  const data = rows
    .filter((r) => r[field] !== undefined && r[field] !== null)
    .map((r) => ({date: r[dateField], value: r[field]}));

  if (opts.sortByDate && data[0] && data[0].date instanceof Date) {
    data.sort((a, b) => a.date - b.date);
  }

  return data;
}

/**
 * Loads and parses a JSON array of objects.
 *
 * @param {string} json Raw JSON string.
 * @return {Array<Object>} Parsed objects.
 */
export function parseJSON(json) {
  if (typeof json !== 'string') throw new Error('json must be a string');
  if (json.trim().length === 0) return [];
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data))
      throw new Error('JSON must be an array of objects');
    return data;
  } catch (err) {
    throw new Error(`Invalid JSON: ${err.message}`);
  }
}

/**
 * Validates that a time series has no gaps larger than a threshold.
 *
 * @param {Array<{date: Date}>} series Time series with dates.
 * @param {number} maxGapMs Maximum allowed gap in milliseconds.
 * @return {{valid: boolean, maxGap: number, gaps: Array<number>}} Validation result.
 */
export function validateNoGaps(series, maxGapMs) {
  if (!Array.isArray(series) || series.length < 2) {
    return {valid: true, maxGap: 0, gaps: []};
  }

  const gaps = [];
  let maxGap = 0;
  for (let i = 1; i < series.length; i++) {
    const gap = series[i].date.getTime() - series[i - 1].date.getTime();
    gaps.push(gap);
    if (gap > maxGap) maxGap = gap;
  }

  return {valid: maxGap <= maxGapMs, maxGap, gaps};
}

/**
 * Downsamples a time series to a target frequency by averaging.
 *
 * @param {Array<{date: Date, value: number}>} series Input series.
 * @param {number} intervalMs Target interval in milliseconds.
 * @return {Array<{date: Date, value: number}>} Downsampled series.
 */
export function downsample(series, intervalMs) {
  if (!Array.isArray(series)) throw new Error('series must be an array');
  if (intervalMs <= 0) throw new Error('intervalMs must be positive');
  if (series.length === 0) return [];

  const buckets = new Map();
  for (const point of series) {
    const bucketTime =
      Math.floor(point.date.getTime() / intervalMs) * intervalMs;
    const bucket = buckets.get(bucketTime) || {sum: 0, count: 0};
    bucket.sum += point.value;
    bucket.count++;
    buckets.set(bucketTime, bucket);
  }

  const result = [];
  for (const [time, bucket] of buckets) {
    result.push({date: new Date(time), value: bucket.sum / bucket.count});
  }

  result.sort((a, b) => a.date - b.date);
  return result;
}
