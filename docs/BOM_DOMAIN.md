# BOM Domain Notes

Background knowledge for editing the comparison pipeline. The code lives in `src/App.tsx`; this file explains *why* certain branches exist.

## What a BOM is in this context

A Bill of Materials is an Excel workbook listing parts for a manufacturing build. For Order Management Engineers, the working unit is one BOM revision vs. another revision of the same product. Typical columns:

- Part Number (PN) — the immutable identifier.
- Description — human-readable name. Customers ship this in English, sometimes Hebrew, occasionally both.
- Reference Designators (RefDes) — comma-separated component placeholders on the PCB, e.g. `R1, R2, R3-R5, C10`. These are what physically gets soldered and are the most error-prone field to diff.
- Quantity — integer per row.
- Optional grouping columns and parent-child structure (Excel "outline level" via Data → Group).

A "row" can be either a component or a sub-assembly header. Sub-assemblies use the outline level to indicate hierarchy.

## Reference designators

`expandRanges` (App.tsx:747) turns `R1-R5, C10` into `R1,R2,R3,R4,R5,C10`. Rules that look like edge cases but are intentional:

- Both sides of `-` must share an alphabetic prefix (`R1-R5` ok, `R1-C5` passes through unchanged). Mixed-prefix dashes appear in legacy BOMs as part numbers, not ranges.
- Numbers may go forward (`R1-R5`) or reverse (`R5-R1`). Both produce the same set in the listed order.
- The prefix can be empty (`1-5` expands to `1,2,3,4,5`).
- Underscores are allowed in the prefix (`TP_1-TP_5`).
- Spaces around comma or dash are stripped.

`processRefDesString` (App.tsx:571) additionally:

- splits on whitespace, `,`, or `;`;
- keeps only tokens matching `/^[A-Za-z0-9_]+$/` (drops `?`, `*`, comments).

That filter exists because some BOMs include comment fragments like `R1 (DNP)` and we do not want `(DNP)` to be counted as a designator.

`Canceled_<field>` and `Added_<field>` are computed by set subtraction *after* `expandRanges`. Without the expansion, `R1-R5` vs `R1-R4` would look like two completely different tokens.

## Hierarchy preservation

Excel groups rows with `outlineLevel` (0..7). SheetJS exposes the row data but not the outline level. The pipeline gets it by:

1. Reading the file again as a ZIP archive (`JSZip.loadAsync(arrayBuffer)`).
2. Reading `xl/worksheets/sheet1.xml` as text.
3. Parsing with `fast-xml-parser` and reading `@_outlineLevel` per `<row>` element.
4. Reindexing by `rowIndex - headerOffset` so the keys match the JSON row indices.

Limitations baked into the current implementation:

- The XML path is hardcoded to `sheet1`. If the user picks a non-first sheet, grouping is read from the wrong sheet. This is a known bug; do not paper over it without a fix.
- Only the active workbook is read; the second file's hierarchy is not extracted.
- `LevelValue` is rendered as a string of dots plus the depth, e.g. `...2`, mimicking the previous owner's tool. Tools downstream rely on the dot count.

## Key field

Each file gets exactly one key field. The merge uses it for left-right matching. Typical choices:

- For finished assemblies: Part Number.
- For raw component BOMs: PN, sometimes Manufacturer Part Number.
- For SOM/proprietary BOMs: internal code.

Two BOMs may use different key names (`PN` vs `Part Number`); the user selects each independently. There is no automatic detection. The merge filter compares only the *mapped* columns, so a missing key match still surfaces the row.

## PCA Export route

`/pca` handles the PCA Export workbook shape separately from the legacy Elizra grouped BOM flow. The route expects normal workbook rows below a detected header row, typically on a sheet named `Bill of Materials`, and does not read Excel outline levels.

Domain rules for this route:

- The user still chooses the key field and comparison fields manually.
- The `#` column is an ordinary column. It may represent order in the source workbook, but the app does not infer hierarchy from it and does not compare it unless selected.
- The comparison uses the same broad merge principle as `mergeTables`: key maps plus a positional pass, with right-only rows inserted during that pass.
- Selected field values are compared after range-aware normalization, so `R1-R3` can compare equal to `R1 R2 R3`.
- Export is flat: `Status`, `Key`, `Field`, left file value, right file value. It does not emit `Level_*`, `LevelValue`, `Canceled_*`, or `Added_*` columns.

## Description field detection

`findDescriptionField` (App.tsx:520) walks a hardcoded list and returns the first column name whose normalized form contains one of the canonical names. The list:

```
Description, DESC, DESCRIPTION, Desc,
Name, NAME, ITEM_NAME, Item Name,
Title, TITLE,
תיאור, שם, כותרת,                # Hebrew variants
Item_Description, ItemDesc, Item_Name,
Component_Description, Component_Name,
Part_Description, Part_Name,
Product_Description, Product_Name,
Details, Specification,
Label, Text_Description
```

`field.toLowerCase().replace(/[_\s-]/g, '')` is compared to each canonical name normalized the same way, so `Item Name` matches `ITEM_NAME` and `item-name`. The Hebrew literals are matched as-is (case is irrelevant in Hebrew).

When a customer ships a BOM in a new language, add the canonical names there. Do not strip the existing list — at least one production customer relies on the Hebrew strings.

## Comparison semantics

`mergeTables` and `downloadMergedFile` use a two-pass filter:

- Preview filter: drops rows where every active mapping pair has byte-equal `Left.X` and `Right.X` after `.trim()`.
- Export filter: drops rows where every renamed pair `<fileId0>_X` / `<fileId1>_X` is equal, both blank, both `--`, or both `.`.

The blank/`--`/`.` exemption exists because customer templates often use placeholders that legally compare as different strings to a naive `===`. Keep these special values in mind when changing the filter.

## Output column order

For the export:

```
Level_1, Level_2, ..., LevelValue,
<key field>,
<description>,
<other fields not Left./Right.>,
<fileId0>_X1, <fileId1>_X1, [Canceled_X1, Added_X1]?,
<fileId0>_X2, <fileId1>_X2, [Canceled_X2, Added_X2]?,
...
```

Downstream Excel macros assume the level columns come first, then identity, then comparison pairs. Reordering breaks those macros.

## Styling assumptions

- Headers: filled `#B1F0F0` (light cyan), bold, font size 8.43, black text, thin borders.
- All data rows: thin borders on every cell, including empty ones.
- Default column width: 15.

The size `8.43` matches the default Excel column width unit by coincidence; the previous owner picked it intentionally because the report is printed at A4.

## When in doubt

Test against a real customer-style BOM with:

- multi-level grouping;
- a RefDes column containing both ranges and singletons;
- duplicate part numbers across hierarchy levels;
- at least one Hebrew description.

Synthetic fixtures live under `fixtures/` (create the folder if absent). Do not commit real customer BOMs.
