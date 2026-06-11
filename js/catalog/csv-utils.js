// CSV helpers for the Material Price Catalog
//
// parseCSV: accepts ',' or ';' delimited text, first row = headers
// exportToCSV: builds a CSV string (',' delimited) from an array of row objects

/**
 * Parse CSV/semicolon-separated text into { headers, rows }.
 * - Detects the delimiter from the header line (',' or ';').
 * - Supports double-quoted fields (with escaped "" quotes and embedded delimiters/newlines).
 * - Blank lines are skipped.
 *
 * @param {string} text
 * @returns {{ headers: string[], rows: Record<string, string>[] }}
 */
export function parseCSV(text) {
  const cleaned = (text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!cleaned.trim()) return { headers: [], rows: [] };

  const headerLine = cleaned.split('\n', 1)[0];
  const delimiter = headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';

  const records = parseRecords(cleaned, delimiter);
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map(h => h.trim());
  const rows = records.slice(1)
    .filter(record => record.some(cell => cell.trim() !== ''))
    .map(record => {
      const row = {};
      headers.forEach((header, i) => { row[header] = (record[i] ?? '').trim(); });
      return row;
    });

  return { headers, rows };
}

// Parses raw CSV text into an array of records (each record = array of cell strings),
// honoring double-quoted fields that may contain the delimiter or newlines.
function parseRecords(text, delimiter) {
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      record.push(field);
      field = '';
    } else if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }

  // last field/record (if file doesn't end with newline)
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records;
}

/**
 * Build a CSV string (',' delimited, with header row) from an array of row objects.
 *
 * @param {Record<string, any>[]} rows
 * @param {string[]} [columns] - column order/subset; defaults to keys of the first row
 * @returns {string}
 */
export function exportToCSV(rows, columns) {
  if (!rows || rows.length === 0) return '';
  const cols = columns && columns.length ? columns : Object.keys(rows[0]);

  const escapeCell = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [cols.join(',')];
  rows.forEach(row => {
    lines.push(cols.map(col => escapeCell(row[col])).join(','));
  });

  return lines.join('\n');
}

/**
 * Trigger a browser download of a CSV string.
 *
 * @param {string} csvText
 * @param {string} filename
 */
export function downloadCSV(csvText, filename) {
  const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
