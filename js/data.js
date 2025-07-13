/**
 * Data handling and management for the FedEx Hierarchy Generator
 */

// Global data variables
let employeeData = [];
let currentDepartment = '';
let currentManager = '';
let currentLocation = '';
let hierarchyData = null;
let originalHierarchyData = null;
let nodePositions = {}; // Store custom node positions
let nextNodeId = 0; // Track next available node ID
let datasets = {}; // Store multiple datasets
let currentDataset = ''; // Current active dataset
let pendingFileData = null; // Store file data while waiting for dataset name

// Node color settings
let nodeColors = {
    department: '#4B0082',
    manager: '#7C3AED',
    jobRole: '#2563EB',
    employee: '#0284C7',
    location: '#FF6600',
    topLevel: '#0284C7'
};

/**
 * Saves the current state to localStorage
 */
function saveCurrentData() {
    const dataToSave = {
        datasets,
        currentDataset,
        nextNodeId,
        nodeColors
    };
    localStorage.setItem('fedexEmployeeData', JSON.stringify(dataToSave));
}

/**
 * Populates the dataset dropdown with available datasets
 */
function populateDatasetSelect() {
    const select = document.getElementById('datasetSelect');
    select.innerHTML = '';

    Object.keys(datasets).forEach(datasetName => {
        const option = document.createElement('option');
        option.value = datasetName;
        option.textContent = datasetName;
        if (datasetName === currentDataset) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

/**
 * Loads a dataset by name
 * @param {string} datasetName - The name of the dataset to load
 */
function loadDataset(datasetName) {
    const dataset = datasets[datasetName];
    if (!dataset) return;

    employeeData = dataset.employeeData || [];
    currentDepartment = dataset.currentDepartment || '';
    currentManager = dataset.currentManager || '';
    currentLocation = dataset.currentLocation || '';
    nodePositions = dataset.nodePositions || {};

    // Update layout settings with defaults if not present
    customLayoutSettings = dataset.customLayoutSettings || {
        horizontalSpacing: 300,
        verticalSpacing: 200,
        elbowLength: 80,
        nodeSize: 150,
        horizontalSpacingSlider: 100
    };

    // Update sliders to match loaded settings
    document.getElementById('nodeSizeSlider').value = customLayoutSettings.nodeSize;
    document.getElementById('horizontalSpacingSlider').value = customLayoutSettings.horizontalSpacingSlider;
    document.getElementById('fsNodeSizeSlider').value = customLayoutSettings.nodeSize;
    document.getElementById('fsHorizontalSpacingSlider').value = customLayoutSettings.horizontalSpacingSlider;
    updateNodeSizeValue();
    updateHorizontalSpacingValue();

    if (employeeData.length > 0) {
        document.getElementById('departmentSelectDiv').style.display = 'block';
        populateDepartmentSelect();

        if (currentDepartment) {
            document.getElementById('departmentSelect').value = currentDepartment;
            populateManagerSelect(currentDepartment);
            populateLocationSelect(currentDepartment);

            if (currentManager) {
                document.getElementById('managerSelect').value = currentManager;
            }

            if (currentLocation) {
                document.getElementById('locationSelect').value = currentLocation;
                document.getElementById('fsLocationSelect').value = currentLocation;
            }

            generateHierarchyTables();
        }
    } else {
        document.getElementById('departmentSelectDiv').style.display = 'none';
        document.getElementById('managerSelectDiv').style.display = 'none';
        document.getElementById('locationFilter').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
    }

    showStatus(`Loaded dataset "${datasetName}"`, 'success');
}

/**
 * Populates the department dropdown with available departments
 */
function populateDepartmentSelect() {
    const departments = [...new Set(employeeData.map(emp => emp.Department))].filter(Boolean);
    const select = document.getElementById('departmentSelect');

    select.innerHTML = '<option value="">Choose a department...</option>';
    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        select.appendChild(option);
    });

    document.getElementById('departmentSelectDiv').style.display = 'block';
}

/**
 * Populates the manager dropdown for a department
 * @param {string} department - The department to get managers for
 */
function populateManagerSelect(department) {
    const deptEmployees = employeeData.filter(emp => emp.Department === department);
    const managerStructure = buildManagerStructure(deptEmployees);

    const select = document.getElementById('managerSelect');
    select.innerHTML = '<option value="">Show full department hierarchy</option>';

    // Add all managers who have employees reporting to them
    managerStructure.forEach((data, managerName) => {
        const option = document.createElement('option');
        option.value = data.manager['Employee Name'];
        option.textContent = `${data.manager['Employee Name']} (${data.employees.length} employees)`;
        select.appendChild(option);
    });

    document.getElementById('managerSelectDiv').style.display = 'block';

    // Prevent the management modal from opening when selecting a manager
    select.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

/**
 * Populates the location dropdown for a department
 * @param {string} department - The department to get locations for
 */
function populateLocationSelect(department) {
    const deptEmployees = employeeData.filter(emp => emp.Department === department);
    const locations = [...new Set(deptEmployees.map(emp => emp['Location']))].filter(Boolean);
    const select = document.getElementById('locationSelect');

    select.innerHTML = '<option value="">All Locations</option>';
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        select.appendChild(option);
    });

    // Also populate the fullscreen location filter
    const fsSelect = document.getElementById('fsLocationSelect');
    fsSelect.innerHTML = '<option value="">All Locations</option>';
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        fsSelect.appendChild(option);
    });

    document.getElementById('locationFilter').style.display = 'block';
}

/**
 * Builds a manager-employee structure for a set of employees
 * @param {Array} employees - Array of employee objects
 * @returns {Map} Map of manager names to their data and employees
 */
function buildManagerStructure(employees) {
    const managerMap = new Map();
    const employeeMap = new Map();

    // First create a map of all employees with normalized names for matching
    employees.forEach(emp => {
        const normalizedName = normalizeName(emp['Employee Name']);
        employeeMap.set(normalizedName, emp);
    });

    // Group employees by their reporting manager with enhanced fuzzy matching
    employees.forEach(emp => {
        const managerName = emp['Reporting Manager'];
        if (managerName && managerName.trim() !== '') {
            const normalizedManagerName = normalizeName(managerName);

            // Try to find the manager in the employee list
            let managerDetails = employeeMap.get(normalizedManagerName);

            // If manager not found, try to find a close match
            if (!managerDetails) {
                managerDetails = findBestMatch(managerName, employees);
            }

            // If manager still not found, create a placeholder
            if (!managerDetails) {
                managerDetails = {
                    'Employee Name': managerName,
                    'Job Profile': 'Manager (Details not found)',
                    'Location': 'N/A',
                    'Department': currentDepartment,
                    'Reporting Manager': ''
                };
                const normalizedManagerName = normalizeName(managerName);
                employeeMap.set(normalizedManagerName, managerDetails);
            }

            // Find or create manager entry
            const normalizedKey = normalizeName(managerDetails['Employee Name']);
            if (!managerMap.has(normalizedKey)) {
                managerMap.set(normalizedKey, {
                    manager: managerDetails,
                    employees: []
                });
            }

            managerMap.get(normalizedKey).employees.push(emp);
        }
    });

    return managerMap;
}

/**
 * Builds a complete hierarchy for a manager and their chain
 * @param {Object} manager - The manager object
 * @param {Array} allEmployees - All employees in the department
 * @returns {Object} Hierarchy data with nodes and links
 */
function buildCompleteManagerHierarchy(manager, allEmployees) {
    const nodes = [];
    const links = [];
    nextNodeId = 0;

    // Create a map of all employees for quick lookup (with normalized names)
    const employeeMap = new Map();
    allEmployees.forEach(emp => {
        const normalizedName = normalizeName(emp['Employee Name']);
        employeeMap.set(normalizedName, emp);
    });

    // Create manager structure
    const managerStructure = buildManagerStructure(allEmployees);

    // Function to recursively build the complete hierarchy upwards
    const buildUpwardHierarchy = (employee, processed) => {
        const normalizedName = normalizeName(employee['Employee Name']);
        if (processed.has(normalizedName)) return null;

        processed.add(normalizedName);

        // Create node for this employee
        const isManager = managerStructure.has(normalizedName);
        const nodeType = isManager ? 'manager' : 'employee';
        const node = {
            id: nextNodeId++,
            name: employee['Employee Name'] || 'Unknown',
            type: nodeType,
            count: isManager ? managerStructure.get(normalizedName).employees.length : 1,
            employees: [employee],
            fullName: `${employee['Employee Name']} - ${employee['Job Profile']}`,
            expanded: false
        };
        nodes.push(node);

        // Process reporting manager
        const managerName = employee['Reporting Manager'];
        if (managerName && managerName.trim() !== '') {
            const normalizedManagerName = normalizeName(managerName);
            let upperManager = employeeMap.get(normalizedManagerName);

            // If manager not found, try to find a close match
            if (!upperManager) {
                upperManager = findBestMatch(managerName, allEmployees);
            }

            // If manager still not found, create a placeholder
            if (!upperManager) {
                upperManager = {
                    'Employee Name': managerName,
                    'Job Profile': 'Manager (Details not found)',
                    'Location': 'N/A',
                    'Department': currentDepartment,
                    'Reporting Manager': ''
                };
            }

            const managerNode = buildUpwardHierarchy(upperManager, processed);
            if (managerNode) {
                links.push({
                    source: managerNode.id,
                    target: node.id
                });
            }
        }

        return node;
    };

    // Function to recursively build the complete hierarchy downwards
    const buildDownwardHierarchy = (managerName, parentNodeId) => {
        const normalizedManagerName = normalizeName(managerName);
        const managerData = managerStructure.get(normalizedManagerName);
        if (!managerData) return;

        // Create manager node if not already created
        let managerNode = nodes.find(n =>
            n.type === 'manager' &&
            normalizeName(n.name) === normalizedManagerName
        );

        if (!managerNode) {
            managerNode = {
                id: nextNodeId++,
                name: managerData.manager['Employee Name'],
                type: 'manager',
                count: managerData.employees.length,
                employees: [managerData.manager],
                fullName: `${managerData.manager['Employee Name']} - ${managerData.manager['Job Profile']}`,
                expanded: false
            };
            nodes.push(managerNode);

            // Link to parent if provided
            if (parentNodeId !== undefined) {
                links.push({
                    source: parentNodeId,
                    target: managerNode.id
                });
            }
        }

        // Process this manager's employees (recursively)
        if (managerData) {
            // First group by location
            const locationGroups = new Map();
            managerData.employees.forEach(emp => {
                const location = emp['Location'] || 'Unknown Location';
                if (!locationGroups.has(location)) {
                    locationGroups.set(location, []);
                }
                locationGroups.get(location).push(emp);
            });

            // Then for each location, group by job role
            locationGroups.forEach((locationEmployees, location) => {
                const locationNode = {
                    id: nextNodeId++,
                    name: location,
                    type: 'location',
                    count: locationEmployees.length,
                    employees: locationEmployees,
                    managerId: managerNode.id,
                    hidden: false,
                    fullName: `${location} (${locationEmployees.length} employees)`,
                    expanded: false
                };
                nodes.push(locationNode);

                links.push({
                    source: managerNode.id,
                    target: locationNode.id
                });

                const jobRoleGroups = groupEmployeesByJobRole(locationEmployees);

                jobRoleGroups.forEach((employees, jobRole) => {
                    const jobRoleNode = {
                        id: nextNodeId++,
                        name: jobRole,
                        type: 'job-role',
                        count: employees.length,
                        employees: employees,
                        managerId: managerNode.id,
                        hidden: false,
                        fullName: `${jobRole} (${employees.length} employees)`,
                        expanded: false
                    };
                    nodes.push(jobRoleNode);

                    links.push({
                        source: locationNode.id,
                        target: jobRoleNode.id
                    });

                    // Check if any of these employees are managers themselves
                    employees.forEach(emp => {
                        const normalizedEmpName = normalizeName(emp['Employee Name']);
                        if (managerStructure.has(normalizedEmpName)) {
                            buildDownwardHierarchy(emp['Employee Name'], jobRoleNode.id);
                        }
                    });
                });
            });
        }
    };

    // First build upward hierarchy (managers above the selected manager)
    const processed = new Set();
    buildUpwardHierarchy(manager, processed);

    // Then build downward hierarchy (employees below the selected manager)
    buildDownwardHierarchy(manager['Employee Name']);

    return { nodes, links };
}

/**
 * Builds a full department hierarchy with proper nested structure
 * @param {Map} managerStructure - Map of managers and their employees
 * @param {Array} allEmployees - All employees in the department
 * @returns {Object} Hierarchy data with nodes and links
 */
function buildFullDepartmentHierarchy(managerStructure, allEmployees) {
    const nodes = [];
    const links = [];
    nextNodeId = 0;

    // Create a map of all employees for quick lookup (with normalized names)
    const employeeMap = new Map();
    allEmployees.forEach(emp => {
        const normalizedName = normalizeName(emp['Employee Name']);
        employeeMap.set(normalizedName, emp);
    });

    // Add department root node
    const rootNode = {
        id: nextNodeId++,
        name: `${currentDepartment} Department`,
        type: 'department',
        count: allEmployees.length,
        expanded: false
    };
    nodes.push(rootNode);

    // Create a map to track which employees have been processed
    const processedEmployees = new Set();

    // Function to recursively build manager hierarchy
    const buildManagerHierarchy = (managerName, parentNodeId) => {
        const normalizedManagerName = normalizeName(managerName);

        if (processedEmployees.has(normalizedManagerName)) return null;

        processedEmployees.add(normalizedManagerName);

        const managerData = managerStructure.get(normalizedManagerName);
        const managerDetails = managerData ? managerData.manager :
            employeeMap.get(normalizedManagerName) || {
                'Employee Name': managerName,
                'Job Profile': 'Manager (Details not found)',
                'Location': 'N/A',
                'Department': currentDepartment,
                'Reporting Manager': ''
            };

        // Create manager node
        const managerNode = {
            id: nextNodeId++,
            name: managerDetails['Employee Name'] || 'Unknown',
            type: 'manager',
            count: managerData ? managerData.employees.length : 0,
            employees: [managerDetails],
            fullName: `${managerDetails['Employee Name']} - ${managerDetails['Job Profile']}`,
            expanded: false
        };
        nodes.push(managerNode);

        // Link to parent node
        if (parentNodeId !== undefined) {
            links.push({
                source: parentNodeId,
                target: managerNode.id
            });
        } else {
            // Link to department root if no parent
            links.push({
                source: rootNode.id,
                target: managerNode.id
            });
        }

        // Process this manager's employees (only one level down)
        if (managerData) {
            // First group by location
            const locationGroups = new Map();
            managerData.employees.forEach(emp => {
                const location = emp['Location'] || 'Unknown Location';
                if (!locationGroups.has(location)) {
                    locationGroups.set(location, []);
                }
                locationGroups.get(location).push(emp);
            });

            // Then for each location, group by job role
            locationGroups.forEach((locationEmployees, location) => {
                const locationNode = {
                    id: nextNodeId++,
                    name: location,
                    type: 'location',
                    count: locationEmployees.length,
                    employees: locationEmployees,
                    managerId: managerNode.id,
                    hidden: false,
                    fullName: `${location} (${locationEmployees.length} employees)`,
                    expanded: false
                };
                nodes.push(locationNode);

                links.push({
                    source: managerNode.id,
                    target: locationNode.id
                });

                const jobRoleGroups = groupEmployeesByJobRole(locationEmployees);

                jobRoleGroups.forEach((employees, jobRole) => {
                    const jobRoleNode = {
                        id: nextNodeId++,
                        name: jobRole,
                        type: 'job-role',
                        count: employees.length,
                        employees: employees,
                        managerId: managerNode.id,
                        hidden: false,
                        fullName: `${jobRole} (${employees.length} employees)`,
                        expanded: false
                    };
                    nodes.push(jobRoleNode);

                    links.push({
                        source: locationNode.id,
                        target: jobRoleNode.id
                    });
                });
            });
        }

        return managerNode;
    };

    // First process all employees without managers
    const employeesWithoutManagers = allEmployees.filter(emp =>
        !emp['Reporting Manager'] || emp['Reporting Manager'].trim() === ''
    );

    if (employeesWithoutManagers.length > 0) {
        // Group top-level employees by location first
        const locationGroups = new Map();
        employeesWithoutManagers.forEach(emp => {
            const location = emp['Location'] || 'Unknown Location';
            if (!locationGroups.has(location)) {
                locationGroups.set(location, []);
            }
            locationGroups.get(location).push(emp);
        });

        locationGroups.forEach((locationEmployees, location) => {
            const locationNode = {
                id: nextNodeId++,
                name: location,
                type: 'location',
                count: locationEmployees.length,
                employees: locationEmployees,
                fullName: `${location} (Top Level)`,
                expanded: false
            };
            nodes.push(locationNode);

            links.push({
                source: rootNode.id,
                target: locationNode.id
            });

            const jobRoleGroups = groupEmployeesByJobRole(locationEmployees);

            jobRoleGroups.forEach((employees, jobRole) => {
                const jobRoleNode = {
                    id: nextNodeId++,
                    name: jobRole,
                    type: 'top-level-role',
                    count: employees.length,
                    employees: employees,
                    fullName: `${jobRole} (Top Level)`,
                    expanded: false
                };
                nodes.push(jobRoleNode);

                links.push({
                    source: locationNode.id,
                    target: jobRoleNode.id
                });
            });
        });
    }

    // Then process all managers who don't report to anyone in this department (top-level managers)
    managerStructure.forEach((data, normalizedManagerName) => {
        const manager = data.manager;
        const reportingManager = manager['Reporting Manager'];

        if (!reportingManager || reportingManager.trim() === '' ||
            !employeeMap.has(normalizeName(reportingManager))) {

            if (!processedEmployees.has(normalizedManagerName)) {
                buildManagerHierarchy(manager['Employee Name'], rootNode.id);
            }
        }
    });

    // Then process all other managers in the hierarchy
    managerStructure.forEach((data, normalizedManagerName) => {
        if (!processedEmployees.has(normalizedManagerName)) {
            const manager = data.manager;
            const reportingManager = manager['Reporting Manager'];

            if (reportingManager && reportingManager.trim() !== '') {
                const normalizedReportingManagerName = normalizeName(reportingManager);

                // Check if the reporting manager exists in our structure
                if (managerStructure.has(normalizedReportingManagerName)) {
                    // Find the reporting manager node
                    const reportingManagerNode = nodes.find(n =>
                        n.type === 'manager' &&
                        normalizeName(n.name) === normalizedReportingManagerName
                    );

                    // If the reporting manager node exists, place under it
                    if (reportingManagerNode) {
                        buildManagerHierarchy(manager['Employee Name'], reportingManagerNode.id);
                    } else {
                        // If not found, place under department root
                        buildManagerHierarchy(manager['Employee Name'], rootNode.id);
                    }
                } else {
                    // If reporting manager not found in structure, place under department root
                    buildManagerHierarchy(manager['Employee Name'], rootNode.id);
                }
            }
        }
    });

    return { nodes, links };
}

/**
 * Gets the depth of a node in the hierarchy
 * @param {number} nodeId - The ID of the node
 * @returns {number} The depth of the node (0 for root)
 */
function getNodeDepth(nodeId) {
    let depth = 0;
    let currentNode = hierarchyData.nodes.find(n => n.id === nodeId);

    while (currentNode) {
        const parentLink = hierarchyData.links.find(link => link.target === currentNode.id);
        if (!parentLink) break;

        depth++;
        currentNode = hierarchyData.nodes.find(n => n.id === parentLink.source);
    }

    return depth;
}

/**
 * Gets the depth of the hierarchy
 * @param {Object} data - The hierarchy data
 * @returns {number} The maximum depth of the hierarchy
 */
function getHierarchyDepth(data) {
    let maxDepth = 0;
    const nodeMap = new Map();

    // Build node map
    data.nodes.forEach(node => {
        nodeMap.set(node.id, { ...node, depth: 0, children: [] });
    });

    // Build tree structure
    data.links.forEach(link => {
        const parent = nodeMap.get(link.source);
        const child = nodeMap.get(link.target);
        if (parent && child) {
            parent.children.push(child);
        }
    });

    // Calculate depths
    const calculateDepth = (node, depth) => {
        node.depth = depth;
        maxDepth = Math.max(maxDepth, depth);
        node.children.forEach(child => calculateDepth(child, depth + 1));
    };

    // Start from root (assuming first node is root)
    if (data.nodes.length > 0) {
        calculateDepth(nodeMap.get(data.nodes[0].id), 0);
    }

    return maxDepth + 1; // Add 1 because depth starts at 0
}

/**
 * Gets the breadth of the hierarchy (maximum nodes at any level)
 * @param {Object} data - The hierarchy data
 * @returns {number} The maximum breadth of the hierarchy
 */
function getHierarchyBreadth(data) {
    let maxBreadth = 0;
    const nodeMap = new Map();

    // Build node map
    data.nodes.forEach(node => {
        nodeMap.set(node.id, { ...node, breadth: 0, children: [] });
    });

    // Build tree structure
    data.links.forEach(link => {
        const parent = nodeMap.get(link.source);
        const child = nodeMap.get(link.target);
        if (parent && child) {
            parent.children.push(child);
        }
    });

    // Calculate breadth at each level
    const levelMap = new Map();

    const calculateBreadth = (node, level) => {
        if (!levelMap.has(level)) {
            levelMap.set(level, 0);
        }
        levelMap.set(level, levelMap.get(level) + 1);
        maxBreadth = Math.max(maxBreadth, levelMap.get(level));
        node.children.forEach(child => calculateBreadth(child, level + 1));
    };

    // Start from root (assuming first node is root)
    if (data.nodes.length > 0) {
        calculateBreadth(nodeMap.get(data.nodes[0].id), 0);
    }

    return maxBreadth;
}

/**
 * Saves the current dataset state
 */
function saveCurrentDataset() {
    if (!currentDataset) return;

    datasets[currentDataset] = {
        ...datasets[currentDataset],
        employeeData,
        currentDepartment,
        currentManager,
        currentLocation,
        nodePositions,
        customLayoutSettings
    };

    saveCurrentData();
}