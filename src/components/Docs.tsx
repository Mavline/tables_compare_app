import React from 'react';
import '../App.css';

const Docs: React.FC = () => {
  return (
    <div className="App">
      <header className="App-header">
        <div className="documentation-content" style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '20px',
          color: '#E6EDF3',
          textAlign: 'left',
          backgroundColor: '#161B22',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
        }}>
          <h1 style={{ textAlign: 'center', marginBottom: '40px', color: '#7E57C2' }}>
            Professional BOM Comparison System Documentation
          </h1>
          
          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#7E57C2', marginBottom: '20px' }}>Expert Introduction</h2>
            <p style={{ marginBottom: '15px', lineHeight: '1.6' }}>
              Welcome to the documentation of our advanced BOM Comparison Tool. As an industry expert with extensive experience in BOM systems and verification methodologies, I'm pleased to present this sophisticated solution for Order Management Engineers.
            </p>
            <p style={{ marginBottom: '15px', lineHeight: '1.6' }}>
              This tool represents the culmination of years of industry expertise, specifically designed to address the complex challenges faced by Order Management Engineers in processing and verifying BOM modifications. It streamlines the critical process of comparing original and revised Bills of Materials, ensuring precise tracking of all changes while maintaining the integrity of component relationships and hierarchical structures.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#7E57C2', marginBottom: '20px' }}>Professional Capabilities</h2>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong style={{ color: '#A78BFA' }}>Intelligent BOM Analysis:</strong> Advanced algorithms for precise comparison of original and modified BOMs, with sophisticated change detection mechanisms.</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong style={{ color: '#A78BFA' }}>Hierarchical Processing:</strong> Preservation of complex Excel outline levels and grouping structures, ensuring maintenance of component relationships.</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong style={{ color: '#A78BFA' }}>Reference Designator Engine:</strong> Sophisticated parsing and comparison of component designators, including range expansion and verification.</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong style={{ color: '#A78BFA' }}>Enterprise-Grade Field Mapping:</strong> Customizable field selection with intelligent matching algorithms for accurate component comparison.</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong style={{ color: '#A78BFA' }}>Industry-Standard Reporting:</strong> Generation of comprehensive Excel reports with professional-grade formatting and change visualization.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#7E57C2', marginBottom: '20px' }}>Operational Protocol</h2>
            <ol style={{ listStyle: 'decimal', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                <strong>Initial BOM Integration</strong>
                <p>Upload your original BOM Excel file, ensuring it contains all necessary component specifications.</p>
              </li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                <strong>Modified BOM Upload</strong>
                <p>Integrate the revised BOM file containing customer modifications.</p>
              </li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                <strong>Sheet Configuration</strong>
                <p>Select the relevant sheets from each file for comparison analysis.</p>
              </li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                <strong>Field Mapping</strong>
                <p>Specify the fields to include in the comparison process, ensuring comprehensive coverage of all relevant specifications.</p>
              </li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                <strong>Key Field Definition</strong>
                <p>Designate the primary key field (e.g., Part Number) for accurate row matching between BOMs.</p>
              </li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                <strong>Reference Designator Configuration</strong>
                <p>If applicable, select columns containing reference designators for automated range processing.</p>
              </li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                <strong>Comparison Execution</strong>
                <p>Initiate the comparison process by clicking "Merge" to generate a preliminary analysis.</p>
              </li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                <strong>Result Verification</strong>
                <p>Review the preview to ensure accurate change detection and proper field mapping.</p>
              </li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                <strong>Report Generation</strong>
                <p>Download the comprehensive comparison report in Excel format.</p>
              </li>
            </ol>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#7E57C2', marginBottom: '20px' }}>Professional Output Specifications</h2>
            <p style={{ marginBottom: '15px', lineHeight: '1.6' }}>The system generates industry-standard reports including:</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>Comprehensive Field Analysis:</strong> Detailed comparison of all selected specifications with clear change indication.</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>Change Visualization:</strong> Professional highlighting of modifications with clear differentiation between types of changes.</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>Component Modification Tracking:</strong> Detailed breakdown of added, removed, and modified components.</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>Reference Designator Analysis:</strong> Expanded comparison of designator ranges with change tracking.</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>Hierarchical Preservation:</strong> Maintenance of BOM structure levels and grouping information.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#7E57C2', marginBottom: '20px' }}>Industry Best Practices</h2>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>Data Consistency:</strong> Maintain consistent formatting and field naming conventions across BOMs.</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>Key Field Selection:</strong> Choose unique and reliable fields for component matching (e.g., manufacturer part numbers).</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>Verification Protocol:</strong> Always review the comparison preview before generating final reports.</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>System Reset:</strong> Utilize the reset functionality between comparisons to ensure data integrity.</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>Reference Designator Standards:</strong> Follow industry conventions for designator formatting to ensure accurate processing.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#7E57C2', marginBottom: '20px' }}>Technical Considerations</h2>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>File Format Compatibility:</strong> The system supports industry-standard Excel formats (.xlsx, .xls).</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>Processing Capacity:</strong> Optimized for handling large-scale BOMs with complex hierarchical structures.</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>Data Validation:</strong> Integrated error checking and validation mechanisms ensure data integrity.</li>
              <li style={{ marginBottom: '15px', lineHeight: '1.6' }}>• <strong>Performance Optimization:</strong> Efficient memory utilization for handling extensive component lists.</li>
            </ul>
          </section>
        </div>
      </header>
    </div>
  );
};

export default Docs; 