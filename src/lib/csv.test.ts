import { describe, it, expect } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('CSV cells', () => {
  it('leaves an ordinary value alone', () => {
    expect(csvCell('roles:grant')).toBe('roles:grant');
    expect(csvCell(42)).toBe('42');
  });

  it('writes nothing for null and undefined rather than the words', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes a value carrying a comma, a quote or a newline', () => {
    expect(csvCell('Petrova, Anna')).toBe('"Petrova, Anna"');
    expect(csvCell('she said "no"')).toBe('"she said ""no"""');
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
  });

  it('defuses a value a spreadsheet would execute', () => {
    // A guest can choose their own name. Without this, opening a compliance
    // export in Excel runs whatever they typed.
    expect(csvCell('=HYPERLINK("http://attacker/","click")')).toBe(
      '"\'=HYPERLINK(""http://attacker/"",""click"")"'
    );
    expect(csvCell('+1234')).toBe("'+1234");
    expect(csvCell('-1234')).toBe("'-1234");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('keeps the defused value readable', () => {
    // The apostrophe is a spreadsheet text marker, not part of the data — what
    // the auditor sees in the cell is still exactly what was stored.
    expect(csvCell('=total')).toBe("'=total");
  });
});

describe('a CSV document', () => {
  it('joins rows with CRLF and leads with a byte-order mark', () => {
    const csv = toCsv([
      ['action', 'actor'],
      ['roles:grant', 'Анна Петрова'],
    ]);

    // Without the BOM, Excel on Windows renders Cyrillic names as mojibake.
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('\r\n');
    expect(csv).toContain('Анна Петрова');
  });

  it('can omit the mark when something else will parse the file', () => {
    expect(toCsv([['a']], { bom: false })).toBe('a');
  });
});
