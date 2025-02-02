# Excel Table Merger Application

## Overview
Excel Table Merger is a modern web application built with React and TypeScript that allows users to compare and merge Excel files efficiently. The application specializes in identifying differences between two Excel sheets and generating a comprehensive comparison report.

## Technology Stack
- **Frontend Framework**: React 18+ with TypeScript
- **State Management**: React Context API
- **Routing**: React Router
- **Styling**: Tailwind CSS with custom CSS
- **Excel Processing**: 
  - XLSX library for reading Excel files
  - ExcelJS for advanced Excel manipulation and writing
  - JSZip for handling Excel file structure
- **XML Processing**: fast-xml-parser for Excel XML structure analysis
- **File Handling**: file-saver for downloading generated files

## Key Features
1. **File Upload and Sheet Selection**
   - Support for .xlsx and .xls file formats
   - Multiple sheet handling
   - Interactive sheet selection interface

2. **Field Management**
   - Dynamic field detection from Excel files
   - Customizable field selection
   - Key field designation for matching records

3. **Advanced Range Processing**
   - Automatic expansion of numeric ranges (e.g., "R1-R5" to "R1,R2,R3,R4,R5")
   - Support for component designators and reference designators
   - Dual-column range processing capability

4. **Intelligent Comparison**
   - Row-by-row comparison based on key fields
   - Detection of added and removed items
   - Support for hierarchical data structures
   - Handling of grouped Excel rows

5. **Output Generation**
   - Customized Excel report generation
   - Formatted output with color coding
   - Clear visualization of differences
   - Support for large datasets

6. **User Interface**
   - Clean and intuitive design
   - Real-time preview of merged data
   - Progress indicators
   - Error handling and user feedback

## How It Works
1. Users upload two Excel files for comparison
2. Select relevant sheets from each file
3. Choose fields to compare and designate key fields
4. Optionally select columns for range expansion
5. Process the comparison
6. Preview results
7. Download the formatted comparison report

## Data Processing Features
- **Hierarchical Data Support**: Maintains Excel row grouping structure
- **Smart Field Matching**: Automatically pairs corresponding fields between files
- **Difference Detection**: Identifies and highlights changes between files
- **Range Expansion**: Processes and expands component reference designators
- **Filtering**: Removes identical rows to focus on differences

## Output Format
The generated Excel report includes:
- Original data from both sources
- Highlighted differences
- Added and removed items
- Expanded ranges where applicable
- Hierarchical structure preservation
- Formatted cells for better readability

## Getting Started

### Prerequisites
- Node.js 14.0 or higher
- npm or yarn package manager

### Installation
1. Clone the repository
```bash
git clone [repository-url]
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm start
```

The application will be available at http://localhost:3000

## Usage
1. Click "Choose Excel file" to upload your Excel files
2. Select appropriate sheets from each file
3. Choose fields to compare
4. Designate key fields for matching records
5. (Optional) Select columns for range expansion
6. Click "Merge" to process the files
7. Preview the results
8. Click "Download" to get the comparison report

## Performance
- Handles large Excel files efficiently
- Processes complex range expansions
- Manages hierarchical data structures
- Optimized for memory usage

## Error Handling
- Validates file formats
- Checks for matching key fields
- Provides clear error messages
- Prevents invalid operations

## Future Enhancements
- Support for more file formats
- Advanced filtering options
- Custom comparison rules
- Batch processing capability
- Report customization options

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
