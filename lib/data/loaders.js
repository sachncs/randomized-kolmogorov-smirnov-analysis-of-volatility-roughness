/**
 * @fileoverview Data loading utilities for RK-SAVR experiments.
 *
 * Lightweight CSV/JSON parsers with a handful of validation helpers
 * (date parsing, gap detection, downsampling). The parsers are designed
 * to be predictable and dependency-free rather than maximally
 * featureful: every row is materialized as a plain object with the
 * requested type conversion already applied.
 *
 * The split-line state machine in `_splitCSVLine` understands double
 * quotes but does **not** attempt to handle escaped quotes or
 * escaped commas inside a quoted field; for richer CSV dialects plug in
 * a dedicated parser (e.g. via `registerModel` pattern in `models/`).
 */

/**
 * Parses a CSV string into an array of plain objects.
 *
 * Expected input shape:
 * - The first non-empty line is the header row.
 * - Each subsequent line is a record with the same column count as the
 *   header.
 * - Fields can be optionally wrapped in double quotes; quotes may embed
 *   commas but not other escapes.
 *
 * Type coercion:
 * - `opts.dateField` (default `"date"`) is parsed via `new Date(...)`.
 * - Any field listed in `opts.numericFields` is parsed via `parseFloat`.
 * - All other fields are kept as trimmed strings.
 *
 * Error handling:
 * - Empty input returns `[]`.
 * - Mismatched column counts throw with a descriptive message.
 * - Non-numeric values in declared numeric columns throw.
 *
 * @param {string} csv Raw CSV content.
 * @param {Object} opts Parser options.
 * @param {string=} opts.dateField Date column name (default `"date"`).
 * @param {Array<string>=} opts.numericFields Columns to coerce to numbers.
 * @return {Array<Object>} Parsed rows, one per non-empty CSV line.
 * @throws {Error} When the input is malformed.
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
 * Splits a single CSV line respecting double-quoted regions.
 *
 * States:
 * - Outside quotes: a comma terminates the current field.
 * - Inside quotes: a quote toggles back to "outside", all other chars are
 *   kept verbatim.
 *
 * @private
 * @param {string} line Raw CSV line (no trailing newline).
 * @return {Array<string>} Split fields. Empty trailing field is preserved.
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
 * Extracts a `{date, value}` series from a parsed CSV array.
 *
 * Rows that are missing `field` are skipped; the resulting series is
 * optionally sorted by `dateField` when the caller asks. Sorting uses
 * the standard JS `Date` arithmetic, so the dates must be real `Date`
 * instances.
 *
 * @param {Array<Object>} rows Parsed CSV rows.
 * @param {string} field Numeric field name to extract.
 * @param {Object} opts Extraction options.
 * @param {boolean=} opts.sortByDate When `true`, sort by the date field
 *   before extraction (default `false`).
 * @param {string=} opts.dateField Date field name (default `"date"`).
 * @return {Array<{date: Date, value: number}>} Series of `{date, value}`
 *   points.
 * @throws {Error} When `rows` is not an array or `field` is not a string.
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
 * Parses a JSON string that must encode an array of objects.
 *
 * The function deliberately refuses non-array JSON to keep the loader
 * simple. Empty or whitespace-only input returns `[]`.
 *
 * @param {string} json Raw JSON string.
 * @return {Array<Object>} Parsed objects (empty if the input is empty).
 * @throws {Error} When the input is not valid JSON or does not decode
 *   to an array.
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
 * Validates that a time series does not contain temporal gaps larger
 * than `maxGapMs`.
 *
 * Returns the maximum observed gap, the full list of pairwise gap
 * lengths, and a `valid` flag for the threshold check. Series with
 * fewer than two points are deemed valid by definition.
 *
 * @param {Array<{date: Date}>} series Time series with `Date` fields.
 * @param {number} maxGapMs Maximum allowed gap in milliseconds.
 * @return {{valid: boolean, maxGap: number, gaps: Array<number>}}
 *   Validation result.
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
 * Downsamples a time series by averaging values that fall into fixed
 * `intervalMs`-wide buckets.
 *
 * The bucket index is computed as
 *     `floor(date.getTime() / intervalMs)`,
 * so all buckets share the same left edge (`0`, `intervalMs`,
 * `2 * intervalMs`, ...). The output is sorted by date and every
 * returned point carries the *bucket start* (not the average timestamp)
 * as its `date` value.
 *
 * @param {Array<{date: Date, value: number}>} series Input series.
 * @param {number} intervalMs Bucket length in milliseconds.
 * @return {Array<{date: Date, value: number}>} One entry per non-empty
 *   bucket, sorted chronologically.
 * @throws {Error} When `series` is not an array or `intervalMs <= 0`.
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
