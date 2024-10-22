'use client'

import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import Button from "./components/ui/button"
import Input from "./components/ui/input"
import './App.css';

function App() {
  const [files, setFiles] = useState<File[]>([])
  const [tables, setTables] = useState<any[]>([])
  const [fields, setFields] = useState<{ [key: string]: string[] }>({})
  const [fieldMapping, setFieldMapping] = useState<{ [key: string]: [string, string] }>({
    'Number': ['', ''],
    'Description': ['', ''],
    'Revision': ['', ''],
    'QTY': ['', ''],
    'Ref Des': ['', '']
  })
  const [comparisonResult, setComparisonResult] = useState<any[] | null>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, fileIndex: number) => {
    const newFile = event.target.files?.[0]
    if (newFile) {
      setFiles(prevFiles => {
        const newFiles = [...prevFiles]
        newFiles[fileIndex] = newFile
        return newFiles
      })
      const reader = new FileReader()
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        const headers = json[0] as string[]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        setTables(prevTables => {
          const newTables = [...prevTables]
          newTables[fileIndex] = jsonData
          return newTables
        })
        
        setFields(prevFields => ({
          ...prevFields,
          [newFile.name]: headers
        }))

        console.log(`File ${fileIndex + 1} fields:`, headers)
      }
      reader.readAsArrayBuffer(newFile)
    }
  }

  const handleFieldMapping = (newTableField: string, fileIndex: number, value: string) => {
    setFieldMapping(prevMapping => ({
      ...prevMapping,
      [newTableField]: [
        fileIndex === 0 ? value : prevMapping[newTableField][0],
        fileIndex === 1 ? value : prevMapping[newTableField][1]
      ]
    }))
  }

  const compareTables = () => {
    if (tables.length !== 2) {
      alert('Please upload both tables before comparing.')
      return
    }

    const result = tables[0].map((oldRow: any, index: number) => {
      const newRow = tables[1][index]
      if (!newRow) return null

      let hasChanges = false
      const resultRow: any = {
        'Number': newRow[fieldMapping['Number'][1]],
        'Description': newRow[fieldMapping['Description'][1]]
      }

      // Сравниваем QTY
      const qtyOld = oldRow[fieldMapping['QTY'][0]]
      const qtyNew = newRow[fieldMapping['QTY'][1]]
      if (qtyOld !== qtyNew) {
        resultRow['QTY Rev-OLD'] = qtyOld
        resultRow['QTY Rev-NEW'] = qtyNew
        hasChanges = true
      }

      // Сравниваем Ref Des
      const refDesOld = oldRow[fieldMapping['Ref Des'][0]]
      const refDesNew = newRow[fieldMapping['Ref Des'][1]]
      if (refDesOld !== refDesNew) {
        resultRow['Ref Des Cancel'] = refDesOld
        resultRow['Ref Des Add'] = refDesNew
        hasChanges = true
      }

      // Добавляем Revision, если оно выбрано и есть изменения
      if (hasChanges && fieldMapping['Revision'][0] && fieldMapping['Revision'][1]) {
        resultRow['Revision-OLD'] = oldRow[fieldMapping['Revision'][0]]
        resultRow['Revision-NEW'] = newRow[fieldMapping['Revision'][1]]
      }

      return hasChanges ? resultRow : null
    }).filter(Boolean)

    setComparisonResult(result)
  }

  const downloadComparisonResult = () => {
    if (!comparisonResult) return

    // Определяем заголовки таблицы
    const headers = [
      'Number',
      'Description',
      ...(fieldMapping['Revision'][0] && fieldMapping['Revision'][1] ? ['Revision-OLD', 'Revision-NEW'] : []),
      'QTY Rev-OLD',
      'QTY Rev-NEW',
      'Ref Des Cancel',
      'Ref Des Add'
    ]

    // Преобразуем данные в формат, подходящий для XLSX
    const data = comparisonResult.map(row => {
      const rowData: any = {}
      headers.forEach(header => {
        rowData[header] = row[header] || ''
      })
      return rowData
    })

    // Создаем рабочую книгу и лист
    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Comparison')

    // Генерируем файл и сохраняем его
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, 'comparison_result.xlsx')
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="text-3xl font-bold mb-6">Excel Table Comparison</h1>
        <div className="file-container-wrapper">
          {[0, 1].map((index) => (
            <div key={index} className="file-container">
              <h2 className="text-xl font-semibold mb-4">File {index + 1} ({index === 0 ? 'Old' : 'New'})</h2>
              <Input 
                type="file" 
                accept=".xlsx,.xls" 
                onChange={(e) => handleFileUpload(e, index)} 
                className="mb-4" 
              />
            </div>
          ))}
        </div>
        {files.length === 2 && (
          <div className="mapping-container">
            <h2 className="text-xl font-semibold mb-4">Field Mapping</h2>
            <div>
              <p>File 1 fields: {fields[files[0]?.name]?.length}</p>
              <p>File 2 fields: {fields[files[1]?.name]?.length}</p>
            </div>
            <div className="mapping-grid" style={{ display: 'flex' }}>
              <div className="mapping-column new-fields" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3>Result Fields</h3>
                {Object.keys(fieldMapping).map((newField) => (
                  <div key={newField} className="mapping-row" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <span>{newField}</span>
                  </div>
                ))}
              </div>
              {[0, 1].map((fileIndex) => (
                <div key={fileIndex} className="mapping-column" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3>File {fileIndex + 1} Fields ({fileIndex === 0 ? 'Old' : 'New'})</h3>
                  {Object.entries(fieldMapping).map(([newField, [oldField1, oldField2]]) => (
                    <div key={newField} className="mapping-row" style={{ flex: 1 }}>
                      <select
                        value={fileIndex === 0 ? oldField1 : oldField2}
                        onChange={(e) => handleFieldMapping(newField, fileIndex, e.target.value)}
                        className="select-native"
                        style={{
                          height: '100%',
                          width: '100%',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          padding: '5px',
                          outline: 'none',
                        }}
                        onFocus={(e) => e.target.style.boxShadow = '0 0 5px rgba(81, 203, 238, 1)'}
                        onBlur={(e) => e.target.style.boxShadow = 'none'}
                      >
                        <option value="">Select a field</option>
                        {fields[files[fileIndex]?.name]?.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="button-container">
          <Button onClick={compareTables} disabled={files.length < 2} className="button">
            Compare
          </Button>
          <Button onClick={downloadComparisonResult} disabled={!comparisonResult} className="button">
            Download Result
          </Button>
        </div>
        {comparisonResult && (
          <div className="result-preview">
            <h2 className="text-xl font-semibold mb-4">Comparison Result Preview</h2>
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Description</th>
                  {fieldMapping['Revision'][0] && fieldMapping['Revision'][1] && (
                    <>
                      <th>Revision-OLD</th>
                      <th>Revision-NEW</th>
                    </>
                  )}
                  <th>QTY Rev-OLD</th>
                  <th>QTY Rev-NEW</th>
                  <th>Ref Des Cancel</th>
                  <th>Ref Des Add</th>
                </tr>
              </thead>
              <tbody>
                {comparisonResult.slice(0, 5).map((row, index) => (
                  <tr key={index}>
                    <td>{row['Number']}</td>
                    <td>{row['Description']}</td>
                    {fieldMapping['Revision'][0] && fieldMapping['Revision'][1] && (
                      <>
                        <td>{row['Revision-OLD']}</td>
                        <td>{row['Revision-NEW']}</td>
                      </>
                    )}
                    <td>{row['QTY Rev-OLD']}</td>
                    <td>{row['QTY Rev-NEW']}</td>
                    <td>{row['Ref Des Cancel']}</td>
                    <td>{row['Ref Des Add']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {comparisonResult.length > 5 && <p>... and {comparisonResult.length - 5} more rows</p>}
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
