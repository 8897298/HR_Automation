# FedEx Org Chart Generator  

A web-based tool to visualize employee hierarchies from Excel/CSV/JSON data.  

## Features  

- **Interactive Org Charts**: Dynamic visualization with zoom/pan  
- **Multi-Source Data**: Supports Excel (XLSX), CSV, and JSON formats  
- **Smart Filtering**: Filter by department, manager, or location  
- **Edit Mode**: Customize nodes, positions, and colors  
- **Employee Profiles**: Detailed view with all employee data  
- **Export**: Save high-resolution PNG images of charts  
- **Responsive**: Works on desktop and mobile  

## File Structure  

```
fedex-hierarchy/  
├── index.html          # Main entry point  
├── css/  
│   └── styles.css      # All application styles  
├── js/  
│   ├── main.js         # Core app logic and event handlers  
│   ├── chart.js        # D3.js visualization code  
│   ├── data.js         # Data processing and hierarchy building  
│   └── utils.js        # Helper functions and utilities  
```  

## Data Requirements  

Acceptable file formats:  
- Excel (XLSX)  
- CSV  
- JSON  

Required fields (column names are flexible):  
- Employee Name  
- Job Title  
- Department  
- Reporting Manager  
- Location  

## Setup  

1. Clone repository  
2. Open `index.html` in any modern browser  
3. No server or build tools required  

## Key Functions  

### Data Processing (`data.js`)  
- `processUploadedFile()` - Handles file parsing  
- `buildHierarchy()` - Creates org chart structure  
- `normalizeData()` - Standardizes input format  

### Visualization (`chart.js`)  
- `renderOrgChart()` - Main D3.js rendering  
- `handleNodeInteractions()` - Click/drag behaviors  
- `updateChartLayout()` - Adjusts spacing/positioning  

### Core Logic (`main.js`)  
- `initializeApp()` - Sets up event listeners  
- `toggleEditMode()` - Enables/disables editing  
- `showEmployeeModal()` - Displays details  

## Technical Stack  

- **Frontend**: Vanilla JS (no frameworks)  
- **Visualization**: D3.js v7  
- **Excel Parsing**: SheetJS/xlsx  
- **Export**: html2canvas  

## Browser Support  

- Chrome ✅  
- Firefox ✅  
- Edge ✅  
- Safari ✅  

## Customization  

To modify:  
- Colors: Edit CSS variables in `styles.css`  
- Layout: Adjust `chartConfig` in `chart.js`  
- Data Handling: Modify `dataProcessors` in `data.js`  
