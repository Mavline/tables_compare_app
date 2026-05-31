# BOM / Excel Table Comparison Tool

## What this project demonstrates

This project demonstrates a React and TypeScript application for comparing original and revised Excel-based BOM or operational tables. It helps review added, removed, and changed rows, map key fields, inspect workbook structure, and prepare comparison output before operational updates are accepted.

The project is useful as proof of work for spreadsheet workflow automation, operational change tracking, and internal tools for engineering, procurement, production, and order-management processes.

## Use case

A team receives a revised Excel file and needs to compare it with an earlier version before updating a business process, order, BOM, or report. The application gives users a browser-based workflow for loading files, selecting sheets, mapping fields, comparing rows, preserving useful structure, and exporting a reviewable result.

## Features

- Upload and compare Excel files.
- Select workbook sheets for comparison.
- Configure key fields and field mappings.
- Detect changed, added, and removed rows.
- Inspect workbook structure and grouping metadata.
- Generate comparison output for review.
- Export results from the browser.

## Technical stack

- Frontend: React and TypeScript.
- Spreadsheet parsing: xlsx and ExcelJS.
- Workbook structure handling: JSZip and fast-xml-parser.
- File export: file-saver.
- Routing/UI: React Router and local React components.

## Architecture

The application runs as a browser-based React app. Users upload Excel files, the app parses workbook sheets and row data, selected fields are mapped for comparison, and the comparison result is held in application state before export. XML and ZIP-level workbook parsing is used where workbook structure matters.

## How to run locally

Prerequisites:

- Node.js.
- npm.

Commands:

```bash
npm install
npm start
```

Build:

```bash
npm run build
```

## Portfolio notes

This README intentionally avoids unsupported authority claims. This repository is a portfolio/proof-of-work project. It does not include private client data, production credentials, internal datasets, or confidential business logic.

Related acty.dev proof page: `/examples/bom-excel-comparison/`.
