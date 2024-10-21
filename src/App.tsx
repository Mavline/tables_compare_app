'use client'

import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import Button from "./components/ui/button"
import Input from "./components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select"
import './App.css';

function App() {
  const [files, setFiles] = useState<File[]>([])
  const [tables, setTables] = useState<any[]>([])
  const [fields, setFields] = useState<{ [key: string]: string[] }>({})
  const [selectedFields, setSelectedFields] = useState<{ [key: string]: string[] }>({})
  const [keyFields, setKeyFields] = useState<{ [key: string]: string }>({})
  const [mergedData, setMergedData] = useState<any[] | null>(null)

  const findHeaderRow = (data: any[][]) => {
    return data.reduce((longest: any[], current: any[]) => 
      current.filter(Boolean).length > longest.filter(Boolean).length ? current : longest, []
    )
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(event.target.files || [])
    setFiles([...files, ...newFiles])

    newFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
        const endRow = Math.min(range.e.r, 49)
        const tempRange = { ...range, e: { ...range.e, r: endRow } }
        const partialJson = XLSX.utils.sheet_to_json(worksheet, { range: tempRange, header: 1 })

        const headerRow = findHeaderRow(partialJson as any[][])
        const headers = headerRow.map((header) => header?.toString() || '')

        const json = XLSX.utils.sheet_to_json(worksheet, { header: headers })

        setTables((prevTables) => [...prevTables, json])
        setFields((prevFields) => ({
          ...prevFields,
          [file.name]: headers,
        }))
        setSelectedFields((prevSelected) => ({
          ...prevSelected,
          [file.name]: [],
        }))
        setKeyFields((prevKeys) => ({
          ...prevKeys,
          [file.name]: '',
        }))
      }
      reader.readAsArrayBuffer(file)
    })
  }

  const handleFieldSelection = (fileName: string, field: string) => {
    setSelectedFields((prevFields) => {
      const updatedFields = prevFields[fileName].includes(field)
        ? prevFields[fileName].filter((f) => f !== field)
        : [...prevFields[fileName], field]
      return {
        ...prevFields,
        [fileName]: updatedFields,
      }
    })
  }

  const handleKeyFieldSelection = (fileName: string, field: string) => {
    setKeyFields((prevKeys) => ({
      ...prevKeys,
      [fileName]: field,
    }))
  }

  const mergeTables = () => {
    if (tables.length < 2) {
      alert('Please upload at least two tables to merge.')
      return
    }

    const keyFieldSet = new Set(Object.values(keyFields))
    if (keyFieldSet.size === 0) {
      alert('Please select at least one key field for merging.')
      return
    }

    let merged = tables[0]
    
    for (let i = 1; i < tables.length; i++) {
      const currentKeyField = keyFields[files[i].name]
      const previousKeyField = keyFields[files[i - 1].name]

      merged = merged.flatMap((row: any) => {
        const matchingRows = tables[i].filter((r: any) => r[currentKeyField] === row[previousKeyField])
        if (matchingRows.length > 0) {
          return matchingRows.map((match: any) => ({ ...row, ...match }))
        }
        return [row]
      })
    }

    const allSelectedFields = new Set(Object.values(selectedFields).flat())
    merged = merged.map((row: any) =>
      Object.fromEntries(
        Object.entries(row).filter(([key]) => allSelectedFields.has(key))
      )
    )

    setMergedData(merged)
  }

  const downloadMergedFile = () => {
    if (!mergedData) return

    const worksheet = XLSX.utils.json_to_sheet(mergedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Merged')
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(data, 'merged_tables.xlsx')
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="text-3xl font-bold mb-6">Excel Table Merger</h1>
        <div className="file-container-wrapper">
          {[0, 1].map((index) => (
            <div key={index} className="file-container">
              <h2 className="text-xl font-semibold mb-4">File {index + 1}</h2>
              <label htmlFor={`file-input-${index}`} className="mb-2 block">Choose Excel file:</label>
              <Input 
                id={`file-input-${index}`}
                type="file" 
                accept=".xlsx,.xls" 
                onChange={handleFileUpload} 
                className="mb-4" 
              />
              {!files[index] && (
                <p className="text-gray-500 mb-4">No file selected</p>
              )}
              {files[index] && (
                <div className="file-content">
                  <div className="fields-column">
                    <h3 className="font-medium mb-2">Fields:</h3>
                    {fields[files[index].name]?.map((field) => (
                      <div key={field} className="field-item">
                        {field}
                      </div>
                    ))}
                  </div>
                  <div className="checkbox-column">
                    <h3 className="font-medium mb-2">Select:</h3>
                    {fields[files[index].name]?.map((field) => (
                      <div key={field} className="checkbox-container">
                        <input
                          type="checkbox"
                          id={`field-${files[index].name}-${field}`}
                          className="checkbox"
                          checked={selectedFields[files[index].name]?.includes(field)}
                          onChange={() => handleFieldSelection(files[index].name, field)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="key-column">
                    <h3 className="font-medium mb-2">Key field:</h3>
                    <Select onValueChange={(value: string) => handleKeyFieldSelection(files[index].name, value)}>
                      <SelectTrigger className="select-trigger">
                        <SelectValue placeholder="Select a key field" />
                      </SelectTrigger>
                      <SelectContent className="select-content">
                        {fields[files[index].name]?.map((field) => (
                          <SelectItem key={field} value={field}>
                            {field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="button-container">
          <Button onClick={mergeTables} disabled={files.length < 2} className="button">
            Merge
          </Button>
          <Button onClick={downloadMergedFile} disabled={!mergedData} className="button">
            Download
          </Button>
        </div>
      </header>
    </div>
  );
}

export default App;
