/**
 * Main application logic for the FedEx Hierarchy Generator
 */

// Global variables
let isEditMode = false;
let nodeToDelete = null;
let nodeToColor = null;
let lastClickTime = 0;
const doubleClickThreshold = 300; // milliseconds for double-tap detection

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // File upload handling
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);

    // Department and manager selection
    document.getElementById('departmentSelect').addEventListener('change', handleDepartmentChange);
    document.getElementById('managerSelect').addEventListener('change', handleManagerChange);
    document.getElementById('locationSelect').addEventListener('change', handleLocationChange);

    // View options
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    document.getElementById('saveChartBtn').addEventListener('click', saveChartAsImage);
    document.getElementById('editModeBtn').addEventListener('click', toggleEditMode);
    document.getElementById('addNodeBtn').addEventListener('click', showAddNodeModal);
    document.getElementById('saveLayoutBtn').addEventListener('click', saveCurrentLayout);

    // Node size controls
    document.getElementById('nodeSizeSlider').addEventListener('input', updateNodeSizeValue);
    document.getElementById('horizontalSpacingSlider').addEventListener('input', updateHorizontalSpacingValue);
    document.getElementById('resetLayoutBtn').addEventListener('click', resetLayout);
    document.getElementById('nodeSizeSlider').addEventListener('change', applyNodeSizeAndSpacing);
    document.getElementById('horizontalSpacingSlider').addEventListener('change', applyNodeSizeAndSpacing);

    // Fullscreen controls
    document.getElementById('fsExitBtn').addEventListener('click', toggleFullscreen);
    document.getElementById('fsScreenshotBtn').addEventListener('click', saveChartAsImage);
    document.getElementById('fsEditModeBtn').addEventListener('click', toggleEditMode);
    document.getElementById('fsSaveLayoutBtn').addEventListener('click', saveCurrentLayout);
    document.getElementById('fsNodeSizeSlider').addEventListener('input', function() {
        document.getElementById('nodeSizeSlider').value = this.value;
        updateNodeSizeValue();
        applyNodeSizeAndSpacing();
    });
    document.getElementById('fsHorizontalSpacingSlider').addEventListener('input', function() {
        document.getElementById('horizontalSpacingSlider').value = this.value;
        updateHorizontalSpacingValue();
        applyNodeSizeAndSpacing();
    });
    document.getElementById('fsLocationSelect').addEventListener('change', function() {
        document.getElementById('locationSelect').value = this.value;
        handleLocationChange({ target: { value: this.value } });
    });

    // Delete confirmation
    document.getElementById('deleteSingleBtn').addEventListener('click', deleteSingleNode);
    document.getElementById('deleteWithChildrenBtn').addEventListener('click', deleteWithChildren);
    document.getElementById('cancelDelete').addEventListener('click', cancelDelete);

    // Add node modal
    document.getElementById('addNodeForm').addEventListener('submit', handleAddNode);
    document.getElementById('cancelAddNode').addEventListener('click', closeAddNodeModal);
    document.getElementById('closeAddNodeModal').addEventListener('click', closeAddNodeModal);

    // Dataset name modal
    document.getElementById('datasetNameForm').addEventListener('submit', saveDatasetWithName);
    document.getElementById('cancelDatasetName').addEventListener('click', closeDatasetNameModal);
    document.getElementById('closeDatasetNameModal').addEventListener('click', closeDatasetNameModal);

    // Dataset selection
    document.getElementById('datasetSelect').addEventListener('change', switchDataset);

    // Color picker
    document.getElementById('applyColorPicker').addEventListener('click', applyNodeColor);
    document.getElementById('cancelColorPicker').addEventListener('click', closeColorPicker);
    document.getElementById('closeColorPicker').addEventListener('click', closeColorPicker);

    // Employee modal
    document.getElementById('closeEmployeeModal').addEventListener('click', closeEmployeeModal);

    // Check for saved data on page load
    const savedData = localStorage.getItem('fedexEmployeeData');
    if (savedData) {
        try {
            const parsedData = JSON.parse(savedData);
            datasets = parsedData.datasets || {};
            currentDataset = parsedData.currentDataset || '';
            nextNodeId = parsedData.nextNodeId || 0;
            nodeColors = parsedData.nodeColors || {
                department: '#4B0082',
                manager: '#7C3AED',
                jobRole: '#2563EB',
                employee: '#0284C7',
                location: '#FF6600',
                topLevel: '#0284C7'
            };

            if (Object.keys(datasets).length > 0) {
                document.getElementById('datasetControls').style.display = 'block';
                populateDatasetSelect();

                if (currentDataset && datasets[currentDataset]) {
                    loadDataset(currentDataset);
                }
            }
        } catch (error) {
            showStatus('Error loading saved data', 'error');
            console.error(error);
        }
    }
});

/**
 * Handles file upload and processing
 * @param {Event} event - The file input change event
 */
function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    let filesProcessed = 0;
    let allData = [];

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
                    // Process Excel file
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    // Standardize column names
                    const standardizedData = jsonData.map(row => {
                        const standardizedRow = {};
                        for (const key in row) {
                            const lowerKey = key.toLowerCase().trim();

                            if (lowerKey.includes('department') || lowerKey === 'dept') {
                                standardizedRow['Department'] = row[key];
                            } else if ((lowerKey.includes('employee') && lowerKey.includes('name')) ||
                                      lowerKey === 'name' ||
                                      lowerKey === 'full name') {
                                standardizedRow['Employee Name'] = row[key];
                            } else if ((lowerKey.includes('job') && lowerKey.includes('profile')) ||
                                      lowerKey.includes('title') ||
                                      lowerKey.includes('position')) {
                                standardizedRow['Job Profile'] = row[key];
                            } else if (lowerKey.includes('location') || lowerKey === 'office') {
                                standardizedRow['Location'] = row[key];
                            } else if ((lowerKey.includes('reporting') && lowerKey.includes('manager')) ||
                                      lowerKey.includes('manager') ||
                                      lowerKey.includes('supervisor')) {
                                standardizedRow['Reporting Manager'] = row[key];
                            } else if ((lowerKey.includes('employee') && lowerKey.includes('id')) ||
                                      lowerKey.includes('staff id') ||
                                      lowerKey.includes('emp id')) {
                                standardizedRow['Employee ID'] = row[key];
                            } else if (lowerKey.includes('email') || lowerKey.includes('mail')) {
                                standardizedRow['Email'] = row[key];
                            } else if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('contact')) {
                                standardizedRow['Phone'] = row[key];
                            }
                        }
                        return standardizedRow;
                    });

                    allData = allData.concat(standardizedData);
                } else {
                    // Process JSON file
                    const jsonData = JSON.parse(e.target.result);
                    const parsedData = Array.isArray(jsonData) ? jsonData : [jsonData];

                    // Ensure JSON data has required fields
                    const standardizedData = parsedData.map(emp => {
                        return {
                            'Department': emp.Department || emp.department || emp.Dept || emp.dept || 'Unknown',
                            'Employee Name': emp['Employee Name'] || emp.employeeName || emp.name || emp.fullName || 'Unknown',
                            'Job Profile': emp['Job Profile'] || emp.jobProfile || emp.title || emp.position || 'Unknown',
                            'Location': emp.Location || emp.location || emp.office || 'Unknown',
                            'Reporting Manager': emp['Reporting Manager'] || emp.reportingManager || emp.manager || emp.supervisor || '',
                            'Employee ID': emp['Employee ID'] || emp.employeeID || emp.staffID || emp.id || '',
                            'Email': emp.Email || emp.email || emp.mail || '',
                            'Phone': emp.Phone || emp.phone || emp.mobile || emp.contact || ''
                        };
                    });

                    allData = allData.concat(standardizedData);
                }

                filesProcessed++;
                if (filesProcessed === files.length) {
                    // All files processed
                    pendingFileData = allData;
                    showDatasetNameModal();
                }
            } catch (error) {
                showStatus(`Error parsing file ${file.name}. Please check the format.`, 'error');
                console.error(error);
            }
        };
        reader.onerror = function() {
            showStatus(`Error reading file ${file.name}.`, 'error');
        };

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
}

/**
 * Handles department selection change
 * @param {Event} event - The select change event
 */
function handleDepartmentChange(event) {
    currentDepartment = event.target.value;
    currentManager = '';
    currentLocation = '';
    if (currentDepartment) {
        populateManagerSelect(currentDepartment);
        populateLocationSelect(currentDepartment);
        generateHierarchyTables();
        saveCurrentDataset();
    } else {
        document.getElementById('managerSelectDiv').style.display = 'none';
        document.getElementById('locationFilter').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
    }
}

/**
 * Handles manager selection change
 * @param {Event} event - The select change event
 */
function handleManagerChange(event) {
    currentManager = event.target.value;
    if (currentDepartment) {
        generateHierarchyTables();
        saveCurrentDataset();
    }
}

/**
 * Handles location selection change
 * @param {Event} event - The select change event
 */
function handleLocationChange(event) {
    currentLocation = event.target.value;
    if (currentDepartment) {
        generateHierarchyTables();
        saveCurrentDataset();
    }
}

/**
 * Generates hierarchy tables and charts based on current selections
 */
function generateHierarchyTables() {
    const deptEmployees = employeeData.filter(emp => emp.Department === currentDepartment);

    // Apply location filter if selected
    const filteredEmployees = currentLocation ?
        deptEmployees.filter(emp => emp['Location'] === currentLocation) :
        deptEmployees;

    if (filteredEmployees.length === 0) {
        showStatus('No employees found matching the selected criteria.', 'error');
        return;
    }

    // Build manager-employee structure
    const managerStructure = buildManagerStructure(filteredEmployees);

    // Generate summary stats
    generateSummaryStats(filteredEmployees, managerStructure);

    // Generate combined flow chart first
    if (currentManager) {
        // Find the selected manager in the structure
        const normalizedManagerName = normalizeName(currentManager);
        const managerData = managerStructure.get(normalizedManagerName);

        if (managerData) {
            // Build hierarchy for this manager and their chain
            hierarchyData = buildCompleteManagerHierarchy(managerData.manager, filteredEmployees);
        } else {
            showStatus('Selected manager not found in department.', 'error');
            return;
        }
    } else {
        // Show full department hierarchy with proper nested structure
        hierarchyData = buildFullDepartmentHierarchy(managerStructure, filteredEmployees);
    }

    // Store original hierarchy data for reset
    originalHierarchyData = JSON.parse(JSON.stringify(hierarchyData));

    document.getElementById('flowchartSection').style.display = 'block';
    renderCombinedFlowChart(hierarchyData);

    document.getElementById('resultsSection').style.display = 'block';
}

/**
 * Generates summary statistics for the current selection
 * @param {Array} employees - The employees to analyze
 * @param {Map} managerStructure - The manager structure
 */
function generateSummaryStats(employees, managerStructure) {
    let totalEmployees = employees.length;
    let managersCount = managerStructure.size;
    let reportingToManager = 0;
    let managerChain = 0;

    if (currentManager) {
        // Find the selected manager in the structure
        const normalizedManagerName = normalizeName(currentManager);
        const managerData = managerStructure.get(normalizedManagerName);

        if (managerData) {
            reportingToManager = managerData.employees.length;

            // Calculate chain of command above this manager
            let current = managerData.manager;
            while (current && current['Reporting Manager']) {
                managerChain++;
                const normalizedName = normalizeName(current['Reporting Manager']);
                const upperManager = managerStructure.get(normalizedName);
                current = upperManager ? upperManager.manager : null;
            }
        }
    }

    const summaryHTML = `
        <div class="stat-card" onclick="showAllEmployees()">
            <span class="stat-number">${totalEmployees}</span>
            <span class="stat-label">Total Employees</span>
        </div>
        ${currentManager ? `
        <div class="stat-card" onclick="showDirectReports()">
            <span class="stat-number">${reportingToManager}</span>
            <span class="stat-label">Direct Reports</span>
        </div>
        <div class="stat-card">
            <span class="stat-number">${managerChain}</span>
            <span class="stat-label">Management Levels Above</span>
        </div>
        ` : `
        <div class="stat-card" onclick="showAllManagers()">
            <span class="stat-number">${managersCount}</span>
            <span class="stat-label">Managers in Department</span>
        </div>
        `}
    `;

    document.getElementById('summaryStats').innerHTML = summaryHTML;
}

/**
 * Shows all employees in the current department/location
 */
function showAllEmployees() {
    const deptEmployees = employeeData.filter(emp => emp.Department === currentDepartment);
    const filteredEmployees = currentLocation ?
        deptEmployees.filter(emp => emp['Location'] === currentLocation) :
        deptEmployees;

    showEmployeeModal({
        name: 'All Employees',
        type: 'department',
        count: filteredEmployees.length,
        employees: filteredEmployees,
        fullName: `All Employees in ${currentDepartment}${currentLocation ? ` (${currentLocation})` : ''}`
    });
}

/**
 * Shows direct reports of the current manager
 */
function showDirectReports() {
    if (!currentManager) return;

    const deptEmployees = employeeData.filter(emp => emp.Department === currentDepartment);
    const filteredEmployees = currentLocation ?
        deptEmployees.filter(emp => emp['Location'] === currentLocation) :
        deptEmployees;

    const managerStructure = buildManagerStructure(filteredEmployees);
    const normalizedManagerName = normalizeName(currentManager);
    const managerData = managerStructure.get(normalizedManagerName);

    if (managerData) {
        // Group employees by job role
        const jobRoleGroups = groupEmployeesByJobRole(managerData.employees);

        showEmployeeModal({
            name: currentManager,
            type: 'manager',
            count: managerData.employees.length,
            employees: managerData.employees,
            fullName: `Direct Reports of ${currentManager} (${managerData.employees.length} employees)`,
            jobRoleGroups: jobRoleGroups
        });
    }
}

/**
 * Shows all managers in the current department/location
 */
function showAllManagers() {
    const deptEmployees = employeeData.filter(emp => emp.Department === currentDepartment);
    const filteredEmployees = currentLocation ?
        deptEmployees.filter(emp => emp['Location'] === currentLocation) :
        deptEmployees;

    const managerStructure = buildManagerStructure(filteredEmployees);
    const managers = Array.from(managerStructure.values()).map(data => data.manager);

    // Group managers by location
    const locationGroups = new Map();
    managers.forEach(manager => {
        const location = manager['Location'] || 'Unknown Location';
        if (!locationGroups.has(location)) {
            locationGroups.set(location, []);
        }
        locationGroups.get(location).push(manager);
    });

    showEmployeeModal({
        name: 'All Managers',
        type: 'manager',
        count: managers.length,
        employees: managers,
        fullName: `All Managers in ${currentDepartment}${currentLocation ? ` (${currentLocation})` : ''}`,
        locationGroups: locationGroups
    });
}

/**
 * Toggles edit mode for the chart
 */
function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    const fsBtn = document.getElementById('fsEditModeBtn');
    btn.classList.toggle('edit-mode');
    fsBtn.classList.toggle('edit-mode');
    btn.textContent = isEditMode ? 'Exit Edit Mode' : 'Edit Mode';
    fsBtn.textContent = isEditMode ? 'Exit Edit Mode' : 'Edit Mode';

    // Toggle edit mode class on flowchart container
    document.getElementById('flowchartContainer').classList.toggle('edit-mode');

    if (hierarchyData) {
        renderCombinedFlowChart(hierarchyData);
    }
}

/**
 * Shows the add node modal
 */
function showAddNodeModal() {
    if (!isEditMode) {
        showStatus('Please enable Edit Mode first', 'error');
        return;
    }

    // Populate parent node dropdown
    const parentSelect = document.getElementById('parentNode');
    parentSelect.innerHTML = '<option value="">None (Top Level)</option>';

    if (hierarchyData && hierarchyData.nodes) {
        hierarchyData.nodes.forEach(node => {
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = `${node.name} (${node.type})`;
            parentSelect.appendChild(option);
        });
    }

    document.getElementById('addNodeModal').classList.add('active');
}

/**
 * Closes the add node modal
 */
function closeAddNodeModal() {
    document.getElementById('addNodeModal').classList.remove('active');
    document.getElementById('addNodeForm').reset();
}

/**
 * Handles adding a new node
 * @param {Event} event - The form submit event
 */
function handleAddNode(event) {
    event.preventDefault();

    const nodeName = document.getElementById('nodeName').value;
    const nodeType = document.getElementById('nodeType').value;
    const parentNodeId = document.getElementById('parentNode').value;
    const employeeCount = parseInt(document.getElementById('employeeCount').value) || 0;
    const nodeDescription = document.getElementById('nodeDescription').value;

    if (!nodeName) {
        showStatus('Node name is required', 'error');
        return;
    }

    // Create new node
    const newNode = {
        id: nextNodeId++,
        name: nodeName,
        type: nodeType,
        description: nodeDescription,
        count: employeeCount,
        employees: [],
        expanded: false,
        hidden: false
    };

    // Add to hierarchy data
    if (!hierarchyData) {
        hierarchyData = { nodes: [], links: [] };
    }

    hierarchyData.nodes.push(newNode);

    // If parent node is selected, create the link
    if (parentNodeId) {
        hierarchyData.links.push({
            source: parseInt(parentNodeId),
            target: newNode.id
        });
    }

    // Save positions if needed
    nodePositions[newNode.id] = {
        x: window.innerWidth / 2 - 100,
        y: window.innerHeight / 2 - 50
    };

    // Save data
    saveCurrentData();

    // Re-render
    renderCombinedFlowChart(hierarchyData);
    closeAddNodeModal();
}

/**
 * Shows the dataset name modal
 */
function showDatasetNameModal() {
    document.getElementById('datasetNameModal').classList.add('active');
    document.getElementById('datasetName').focus();
}

/**
 * Closes the dataset name modal
 */
function closeDatasetNameModal() {
    document.getElementById('datasetNameModal').classList.remove('active');
    document.getElementById('datasetNameForm').reset();
    pendingFileData = null;
}

/**
 * Saves the dataset with the provided name
 * @param {Event} event - The form submit event
 */
function saveDatasetWithName(event) {
    event.preventDefault();

    const datasetName = document.getElementById('datasetName').value.trim();
    if (!datasetName) {
        showStatus('Please enter a dataset name', 'error');
        return;
    }

    if (datasets[datasetName]) {
        showStatus('Dataset with this name already exists', 'error');
        return;
    }

    // Create new dataset with the pending file data
    datasets[datasetName] = {
        employeeData: pendingFileData,
        currentDepartment: '',
        currentManager: '',
        currentLocation: '',
        nodePositions: {},
        customLayoutSettings: {
            horizontalSpacing: 300,
            verticalSpacing: 200,
            elbowLength: 80,
            nodeSize: 150,
            horizontalSpacingSlider: 100
        }
    };

    currentDataset = datasetName;
    saveCurrentData();
    populateDatasetSelect();
    document.getElementById('datasetSelect').value = datasetName;

    // Process the data
    employeeData = pendingFileData;
    pendingFileData = null;

    document.getElementById('datasetControls').style.display = 'block';
    populateDepartmentSelect();

    closeDatasetNameModal();
    showStatus(`Dataset "${datasetName}" created and loaded`, 'success');
}

/**
 * Switches to the selected dataset
 * @param {Event} event - The select change event
 */
function switchDataset(event) {
    const datasetName = event.target.value;
    if (!datasetName || !datasets[datasetName]) return;

    currentDataset = datasetName;
    saveCurrentData();
    loadDataset(datasetName);
}

// Make functions available globally
window.showAllEmployees = showAllEmployees;
window.showDirectReports = showDirectReports;
window.showAllManagers = showAllManagers;