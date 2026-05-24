# Architecture

This document describes how the BOM comparison pipeline is actually wired today. It is the source of truth for refactors. Update it in the same commit as any structural change.

## Entry point

```
src/index.tsx
  ReactDOM.createRoot(#root)
    React.StrictMode
      BrowserRouter
        TableProvider          # provides { mergedData, saveMergedData, clearData }
          App
            Navigation
            Routes
              "/"       -> <MainContent/>
              "/about"  -> <About/>
```

`reportWebVitals()` is called but no callback is supplied, so vitals are computed and discarded.

## State surface

Almost all state lives inside `MainContent` (`src/App.tsx`), keyed by file or by file index:

| State                  | Type                                                | Purpose                                    |
| ---------------------- | --------------------------------------------------- | ------------------------------------------ |
| `files`                | `File[]`                                            | Slot 0 = left file, slot 1 = right file.   |
| `tables`               | `TableRow[][]`                                      | Parsed JSON rows for each file.            |
| `fields`               | `{ [fileName]: string[] }`                          | Detected column names per file.            |
| `sheets`               | `{ [fileName]: string[] }`                          | Sheet names per workbook.                  |
| `selectedSheets`       | `{ [fileName]: string }`                            | Active sheet per file.                     |
| `keyFields`            | `{ [fileName]: string }`                            | One key column per file.                   |
| `groupingStructure`    | `{ [fileName]: { [rowIndex]: GroupInfo } }`         | Outline levels read from raw XML.          |
| `fieldMappings`        | `FieldMapping[]`                                    | Left→right column pairings.                |
| `columnToProcess`      | `string`                                            | RefDes column on the left side.            |
| `secondColumnToProcess`| `string`                                            | RefDes column on the right side.           |
| `fileIds`              | `{ 0: string, 1: string }`                          | User-supplied identifiers used in export.  |
| `mergedPreview`        | `TableRow[]`                                        | Filtered merge result for the preview.     |
| `selectedFieldsOrder`  | `string[]`                                          | Header order used by preview + export.     |

`TableContext` (`src/context/TableContext.tsx`) only holds `mergedData`. It exists so future routes can read the merge without going back to the upload page. The preview table itself reads `mergedPreview`, not the context value.

## Pipeline

### 1. Upload (`handleFileUpload`)

- `FileReader.readAsArrayBuffer` → `XLSX.read(data, { type: 'array' })`.
- Resets every per-file dictionary so re-uploading slot 0 does not leave stale grouping info from the previous workbook.

### 2. Sheet detection (`processSheet`)

- Reads the first 50 rows with `header: 1`.
- For each row, counts cells that are non-empty strings containing at least one letter (`countSignificantCells`).
- Picks the row with the largest count as the header row.
- Renames duplicate headers with suffixes (`Price`, `Price-2`, …).
- Re-parses the worksheet from `headerRowIndex + 1` with `header: headers` to get typed objects.

### 3. Hierarchy extraction (`extractGroupingInfo`)

- Opens the same file as a ZIP with `JSZip`.
- Reads `xl/worksheets/sheet1.xml` (always sheet 1 — *known limitation*).
- Parses it with `fast-xml-parser` and walks `worksheet.sheetData.row`.
- Stores `{ level: parseInt(@_outlineLevel), group: [], hidden: false }` keyed by `rowIndex - headerOffset` so the indices line up with the JSON rows.

`@_outlineLevel` is the only signal preserving the Excel grouping. SheetJS drops it.

### 4. Field mapping

`fieldMappings: FieldMapping[]` is mutated by `handleFieldMappingChange`, `removeFieldMapping`, and `addFieldMapping`. A mapping with `isActive && leftField && rightField` produces a pair of `Left.<leftField>` / `Right.<rightField>` columns. Duplicate mappings on either side are rejected with an alert.

### 5. Key field selection

`handleKeyFieldSelection` updates `keyFields[fileName]`. Used to match left rows to right rows during the merge and to pick the "real" key column in the export.

### 6. Merge (`mergeTables`)

Pseudocode:

```text
keyL = keyFields[left.name]; keyR = keyFields[right.name]
mapL2R = map(left rows by keyL)
mapR2L = map(right rows by keyR)

for i in 0 .. max(len(left), len(right)) - 1:
    L = left[i]   if any
    R = right[i]  if any

    if L is not None:
        row = createBaseRow(...)   # fills Level_* columns from groupingStructure[left.name]
        matchR = mapR2L by L[keyL]
        for m in active mappings:
            row["Left." + m.left]  = L[m.left]  or ""
            row["Right." + m.right] = matchR[m.right] if matchR else ""
        push row

    if R is not None and L is None or right has no match in left for R[keyR]:
        row = createBaseRow(...)
        for m in active mappings:
            row["Left." + m.left]  = ""
            row["Right." + m.right] = R[m.right] or ""
        push row

filter rows where ALL active mapping pairs are byte-equal
```

That filter is what makes the preview meaningful — only rows with at least one mapped difference survive.

`createBaseRow` emits `Level_1`, `Level_2`, … columns up to the largest level found, marks the matching level cell with `level + 1`, and writes `LevelValue` as `..1`, `...2`, etc. Rows without an entry in `groupingStructure` get `..1` if their key cell is non-empty in the first table.

### 7. Range expansion (`expandRanges`)

Triggered both inside `mergeTables` (preview path) and `downloadMergedFile` (export path) when `columnToProcess` or `secondColumnToProcess` is set.

For each comma-separated part of the cell:

- If it contains `-`, split into start and end.
- Match each side with `/^([A-Za-z_]*)(\d+)$/`.
- If both match and prefixes are equal, expand inclusive in either direction.
- Otherwise pass through verbatim.

### 8. Export (`downloadMergedFile`)

- Validates `fileIds[0]` and `fileIds[1]`.
- Auto-detects a description column with `findDescriptionField` (English + Hebrew names).
- Splits `Left.X` / `Right.X` pairs into compare columns named `<fileId0>_X` / `<fileId1>_X`.
- For the designated RefDes pair(s), computes `Canceled_X` (in left, not in right) and `Added_X` (in right, not in left) after `processRefDesString` normalizes them.
- Filters the rows again — this time on the renamed columns; drops rows where every pair is equal, both blank, both `--`, or both `.`.
- Writes the workbook with `ExcelJS`, cyan headers (`#B1F0F0`), bold size 8.43, thin borders.
- Saves as `merged_tables.xlsx` via `file-saver`.

## File layout

```
src/
├── index.tsx                 # bootstraps React + router + context
├── App.tsx                   # MainContent (the whole pipeline) + <App> shell
├── App.css                   # global page styling
├── index.css                 # font + reset
├── context/
│   └── TableContext.tsx      # mergedData provider
├── components/
│   ├── Navigation.tsx        # fixed top bar with two links
│   ├── About.tsx             # static page
│   └── ui/                   # primitive wrappers (Radix labels, Tailwind-ish classes)
│       ├── alert.tsx
│       ├── button.tsx
│       ├── checkbox.tsx
│       ├── input.tsx
│       ├── label.tsx
│       └── select.tsx
└── lib/
    └── utils.ts              # cn() helper using clsx + tailwind-merge
```

The CSS in `App.css` is largely overridden by inline styles in `App.tsx`. The Tailwind classes in JSX (`text-3xl`, `font-bold`, `mb-6`) are noise unless Tailwind is added to the build — they currently render as plain text class names with no styles.

## Known dead code / stale config

- `src/.cursorrules` — wrong stack description (Vue/Pinia/Vite/Hono/Drizzle), should be deleted or rewritten.
- `config-overrides.js` + `customize-cra` dependency — never invoked because scripts call `react-scripts` directly.
- `reportWebVitals()` invocation without an argument — measures nothing.
- `tsconfig.json` has `"target": "es5"`. CRA compiles JSX via Babel and ignores tsc emit, but anything that uses raw `tsc` to emit will be unusable.

## Refactor hot zones

If you reach a point where `App.tsx` must be split, the safe slicing planes are:

1. **`useBomFiles()`** — own `files`, `tables`, `fields`, `sheets`, `selectedSheets`, `groupingStructure`, plus `handleFileUpload`, `processSheet`, `extractGroupingInfo`, `handleSheetSelection`.
2. **`useFieldMapping()`** — own `keyFields`, `fieldMappings`, `columnToProcess`, `secondColumnToProcess`, and their handlers.
3. **`useBomMerge()`** — own `mergedPreview`, `selectedFieldsOrder`, `mergeTables`, and the column-order computation.
4. **`exportWorkbook(mergedPreview, …)`** — pure function returning a Blob.
5. **`<UploadPanel/>`, `<MappingPanel/>`, `<PreviewTable/>`, `<ActionsBar/>`** — pure JSX.

Do not change the public API of `mergeTables` (positional iteration + key match + equal-pair filter) without freezing a spec and verifying against real customer-style fixtures.
