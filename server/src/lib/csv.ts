/** Thrown on malformed CSV: unterminated quotes or text after a closing quote. */
export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

/**
 * Minimal RFC 4180-style CSV codec: quoted cells may contain separators, quotes
 * (escaped as "") and newlines. Rows are separated by \n or \r\n. The cell
 * separator defaults to `,`; `;` is common in spreadsheet exports. Malformed
 * input (unterminated quote, text after a closing quote) raises CsvParseError.
 */
export function parseCsv(text: string, separator = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  // True right after a closing quote; only a separator, newline or EOF may follow.
  let quoteClosed = false;
  let i = 0;

  const pushCell = () => {
    row.push(cell);
    cell = '';
    quoteClosed = false;
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        quoteClosed = true;
        i += 1;
        continue;
      }
      cell += char;
      i += 1;
      continue;
    }
    if (quoteClosed && char !== separator && char !== '\n' && char !== '\r') {
      throw new CsvParseError('unexpected_character_after_quote');
    }
    if (char === '"' && cell === '') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === separator) {
      pushCell();
      i += 1;
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }
    cell += char;
    i += 1;
  }
  if (inQuotes) throw new CsvParseError('unterminated_quoted_cell');
  if (cell !== '' || row.length > 0) pushRow();

  // Drop fully empty rows (trailing newline, blank lines between data).
  return rows.filter((entry) => entry.some((value) => value !== ''));
}

/**
 * Spreadsheet programs evaluate cells starting with =, +, - or @ as formulas,
 * even inside quotes. Prefix such cells with ' so an export opened in a
 * spreadsheet stays inert.
 */
function escapeSpreadsheetFormula(cell: string): string {
  return /^[\t\r ]*[=+\-@]/.test(cell) ? `'${cell}` : cell;
}

export function serializeCsv(rows: string[][], separator = ','): string {
  const quoting = new RegExp(`["\\r\\n${separator}]`);
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const safe = escapeSpreadsheetFormula(cell);
          return quoting.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
        })
        .join(separator),
    )
    .join('\n');
}
