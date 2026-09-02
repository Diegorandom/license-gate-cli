export function parseCsv(content: string) {
  const rows: string[][] = []
  let cell = ''
  let row: string[] = []
  let inQuotes = false
  const delimiter = detectDelimiter(content)

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const next = content[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell.trim())
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++
      row.push(cell.trim())
      if (row.some((value) => value.length > 0)) rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim())
    if (row.some((value) => value.length > 0)) rows.push(row)
  }

  return rows
}

export function csvRowsToObjects(rows: string[][]) {
  const [headerRow, ...dataRows] = rows
  if (!headerRow) return []

  const headers = headerRow.map((header) => normalizeHeader(header))
  return dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, (row[index] ?? '').trim()]))
  )
}

function detectDelimiter(content: string) {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? ''
  const commaCount = (firstLine.match(/,/g) ?? []).length
  const semicolonCount = (firstLine.match(/;/g) ?? []).length
  return semicolonCount > commaCount ? ';' : ','
}

function normalizeHeader(header: string) {
  return header
    .replace(/^\ufeff/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}
