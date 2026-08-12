/**
 * Minimal RFC 4180-style CSV codec: quoted cells may contain separators, quotes
 * (escaped as "") and newlines. Rows are separated by \n or \r\n. The cell
 * separator defaults to `,`; `;` is common in spreadsheet exports.
 */
export function parseCsv(text: string, separator = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  const pushCell = () => {
    row.push(cell);
    cell = '';
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
        i += 1;
        continue;
      }
      cell += char;
      i += 1;
      continue;
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
  if (cell !== '' || row.length > 0) pushRow();

  // Drop fully empty rows (trailing newline, blank lines between data).
  return rows.filter((entry) => entry.some((value) => value !== ''));
}

export function serializeCsv(rows: string[][], separator = ','): string {
  const quoting = new RegExp(`["\\r\\n${separator}]`);
  return rows
    .map((row) =>
      row
        .map((cell) => (quoting.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell))
        .join(separator),
    )
    .join('\n');
}
