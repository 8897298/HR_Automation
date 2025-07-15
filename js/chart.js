/**
 * Chart rendering and visualization functions for the FedEx Hierarchy Generator
 */

// Layout settings for the chart
let customLayoutSettings = {
    horizontalSpacing: 300,
    verticalSpacing: 200,
    elbowLength: 80,
    nodeSize: 150,
    horizontalSpacingSlider: 100
};

/**
 * Renders the combined flowchart with D3.js
 * @param {Object} data - The hierarchy data to render
 */
function renderCombinedFlowChart(data) {
    const container = d3.select('#flowchartContainer');
    container.selectAll("*").remove();

    // Calculate required dimensions based on hierarchy depth and breadth
    const hierarchyDepth = getHierarchyDepth(data);
    const hierarchyBreadth = getHierarchyBreadth(data);

    // Set very large dimensions to accommodate big hierarchies
    const width = Math.max(3000, hierarchyBreadth * customLayoutSettings.horizontalSpacing);
    const height = Math.max(3000, hierarchyDepth * customLayoutSettings.verticalSpacing);
    const margin = { top: 40, right: 120, bottom: 40, left: 120 };

    const svg = container.append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .call(d3.zoom()
            .scaleExtent([0.1, 5])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
                updateLinks(); // Update links when zooming/panning
            }))
        .on('dblclick.zoom', null); // Disable double-click zoom

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create hierarchical layout
    const root = d3.stratify()
        .id(d => d.id)
        .parentId(d => {
            const link = data.links.find(l => l.target === d.id);
            return link ? link.source : null;
        })(data.nodes);

    // Custom tree layout with dynamic spacing
    const treeLayout = d3.tree()
        .size([width - margin.left - margin.right, height - margin.top - margin.bottom])
        .separation((a, b) => (a.parent === b.parent ? 1 : 1.5) / a.depth);

    const treeData = treeLayout(root);

    // Apply saved positions if they exist
    treeData.each(d => {
        if (nodePositions[d.data.id]) {
            d.x = nodePositions[d.data.id].x;
            d.y = nodePositions[d.data.id].y;
        }
    });

    // Create elbow links
    const links = g.selectAll('.link')
        .data(treeData.links().filter(d => !d.target.data.hidden))
        .enter().append('path')
        .attr('class', 'link')
        .style('fill', 'none')
        .style('stroke', '#94A3B8')
        .style('opacity', 0.8)
        .style('stroke-width', 1.5);

    // Update links initially
    updateLinks();

    // Calculate node dimensions based on size slider (1-200 to actual pixel values)
    const nodeBaseSize = 180 + (customLayoutSettings.nodeSize * 2); // 180-580px
    const nodeDimensions = {
        department: { width: nodeBaseSize * 2.5, height: nodeBaseSize * 1.5, fontSize: nodeBaseSize * 0.2 },
        manager: { width: nodeBaseSize * 1.8, height: nodeBaseSize * 1.2, fontSize: nodeBaseSize * 0.18 },
        'job-role': { width: nodeBaseSize * 1.5, height: nodeBaseSize, fontSize: nodeBaseSize * 0.16 },
        'top-level-role': { width: nodeBaseSize * 1.5, height: nodeBaseSize, fontSize: nodeBaseSize * 0.16 },
        'employee': { width: nodeBaseSize * 1.2, height: nodeBaseSize * 0.9, fontSize: nodeBaseSize * 0.14 },
        'location': { width: nodeBaseSize * 1.6, height: nodeBaseSize, fontSize: nodeBaseSize * 0.16 }
    };

    // Create nodes with double-tap functionality
    const node = g.selectAll('.node')
        .data(treeData.descendants().filter(d => !d.data.hidden))
        .enter().append('g')
        .attr('class', d => `node ${d.data.type}-node ${d.data.expanded ? 'expanded' : ''}`)
        .attr('transform', d => `translate(${d.x},${d.y})`)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended))
        .on('click', function(event, d) {
            const now = Date.now();
            const isDoubleClick = (now - lastClickTime) < doubleClickThreshold;
            lastClickTime = now;

            if (isEditMode) {
                // In edit mode, don't process clicks for expansion
                return;
            }

            if (isDoubleClick && (d.data.type === 'manager' || d.data.type === 'job-role' || d.data.type === 'top-level-role' || d.data.type === 'location')) {
                // Double-click on manager or job role - show all employees directly
                d3.select(this).classed('highlight', true);
                setTimeout(() => d3.select(this).classed('highlight', false), 500);

                // Collect all employees under this node
                let allEmployees = [];
                if (d.data.type === 'manager') {
                    hierarchyData.nodes.forEach(n => {
                        if ((n.type === 'location' || n.type === 'job-role' || n.type === 'employee') && n.managerId === d.data.id) {
                            allEmployees.push(...n.employees);
                        }
                    });
                } else {
                    allEmployees = d.data.employees || [];
                }

                // Show in modal
                showEmployeeModal({
                    name: d.data.name,
                    type: d.data.type,
                    count: allEmployees.length,
                    employees: allEmployees,
                    fullName: `All employees under ${d.data.name}`
                });
            } else if (d.data.type === 'manager' || d.data.type === 'job-role' || d.data.type === 'top-level-role' || d.data.type === 'location') {
                // Single click - toggle expansion of children
                const wasExpanded = d.data.expanded;
                d.data.expanded = !wasExpanded;

                // For managers, toggle employees visibility
                if (d.data.type === 'manager') {
                    hierarchyData.nodes.forEach(n => {
                        if (n.type === 'employee' && n.managerId === d.data.id) {
                            n.hidden = !d.data.expanded;
                        }
                    });
                }
                // For job roles, toggle employees visibility
                else if (d.data.type === 'job-role' || d.data.type === 'top-level-role' || d.data.type === 'location') {
                    hierarchyData.nodes.forEach(n => {
                        if (n.type === 'employee' && hierarchyData.links.some(l => l.source === d.data.id && l.target === n.id)) {
                            n.hidden = !d.data.expanded;
                        }
                    });
                }

                renderCombinedFlowChart(hierarchyData);
            } else if (d.data.type === 'employee') {
                // Single click on employee - show employee details
                showEmployeeModal(d.data);
            }
        })
        .on('mouseover', function(event, d) {
            if (!isEditMode) showTooltip(event, d.data);
        })
        .on('mouseout', function() {
            hideTooltip();
        });

    // Add rectangles for nodes with scaled dimensions
    node.append('rect')
        .attr('width', d => nodeDimensions[d.data.type].width)
        .attr('height', d => nodeDimensions[d.data.type].height)
        .attr('x', d => -nodeDimensions[d.data.type].width / 2)
        .attr('y', d => -nodeDimensions[d.data.type].height / 2)
        .style('stroke', d => {
            // Check for custom colors first
            if (d.data.customColors && d.data.customColors.stroke) {
                return d.data.customColors.stroke;
            }

            // Use default colors based on node type
            switch(d.data.type) {
                case 'department': return nodeColors.department;
                case 'manager': return d.data.expanded ? nodeColors.department : nodeColors.manager;
                case 'job-role': return nodeColors.jobRole;
                case 'employee': return nodeColors.employee;
                case 'top-level-role': return nodeColors.topLevel;
                case 'location': return nodeColors.location;
                default: return '#94A3B8';
            }
        })
        .style('stroke-width', d => d.data.expanded ? '2px' : '1.5px')
        .style('fill', d => {
            // Check for custom fill color
            if (d.data.customColors && d.data.customColors.fill) {
                return d.data.customColors.fill;
            }
            return 'white';
        })
        .style('fill-opacity', 0.9);

    // Add text containers with wrapped text
    node.each(function(d) {
        const g = d3.select(this);
        const width = nodeDimensions[d.data.type].width * 0.9; // 90% of node width
        const height = nodeDimensions[d.data.type].height * 0.9; // 90% of node height
        const fontSize = nodeDimensions[d.data.type].fontSize;

        // Create foreignObject for HTML content
        const fo = g.append('foreignObject')
            .attr('width', width)
            .attr('height', height)
            .attr('x', -width / 2)
            .attr('y', -height / 2);

        // Create div container for text
        const div = fo.append('xhtml:div')
            .attr('class', 'text-container')
            .style('width', width + 'px')
            .style('height', height + 'px')
            .style('font-size', fontSize + 'px')
            .style('padding', '8px')
            .style('box-sizing', 'border-box')
            .style('color', d => {
                // Check for custom text color
                if (d.data.customColors && d.data.customColors.text) {
                    return d.data.customColors.text;
                }

                // Use default colors based on node type
                switch(d.data.type) {
                    case 'department': return nodeColors.department;
                    case 'manager': return nodeColors.manager;
                    case 'job-role': return nodeColors.jobRole;
                    case 'employee': return nodeColors.employee;
                    case 'top-level-role': return nodeColors.topLevel;
                    case 'location': return nodeColors.location;
                    default: return '#1E293B';
                }
            });

        // Add main text
        div.append('div')
            .attr('class', 'main-text')
            .style('font-weight', '600')
            .style('margin-bottom', '4px')
            .style('word-break', 'break-word')
            .text(d.data.name);

        // Add count if applicable
        if (d.data.type === 'manager' || d.data.type === 'top-level-role' || d.data.type === 'job-role' || d.data.type === 'location') {
            div.append('div')
                .attr('class', 'count-text')
                .style('font-size', '0.85em')
                .style('color', '#64748B')
                .text(`(${d.data.count} employees)`);
        }

        // Add description if available
        if (d.data.description) {
            div.append('div')
                .attr('class', 'description-text')
                .style('font-size', '0.75em')
                .style('color', '#64748B')
                .style('margin-top', '4px')
                .text(d.data.description);
        }

        // Add delete button (only visible in edit mode)
        if (isEditMode) {
            g.append('foreignObject')
                .attr('width', 24)
                .attr('height', 24)
                .attr('x', nodeDimensions[d.data.type].width / 2 - 12)
                .attr('y', -nodeDimensions[d.data.type].height / 2 - 12)
                .append('xhtml:button')
                .attr('class', 'delete-btn')
                .text('×')
                .on('click', function(event) {
                    event.stopPropagation();
                    nodeToDelete = d.data.id;
                    document.getElementById('deleteConfirmationModal').style.display = 'flex';
                });

            // Add color picker button (only visible in edit mode)
            g.append('foreignObject')
                .attr('width', 24)
                .attr('height', 24)
                .attr('x', -nodeDimensions[d.data.type].width / 2 - 12)
                .attr('y', -nodeDimensions[d.data.type].height / 2 - 12)
                .append('xhtml:button')
                .attr('class', 'color-picker-btn')
                .text('🎨')
                .on('click', function(event) {
                    event.stopPropagation();
                    showColorPicker(d.data.id);
                });
        }
    });

    /**
     * Updates the link paths when nodes are moved
     */
    function updateLinks() {
        links.attr('d', d => {
            const sourceX = d.source.x;
            const sourceY = d.source.y;
            const targetX = d.target.x;
            const targetY = d.target.y;

            const elbowLength = customLayoutSettings.elbowLength;

            return `M${sourceX},${sourceY}
                    V${sourceY + elbowLength}
                    H${targetX}
                    V${targetY}`;
        });
    }

    /**
     * Handles drag start event
     */
    function dragstarted(event, d) {
        if (!isEditMode) return;
        d3.select(this).raise().classed("active", true);
    }

    /**
     * Handles drag event
     */
    function dragged(event, d) {
        if (!isEditMode) return;

        // Snap to grid in edit mode
        const snapSize = 20;
        const snappedX = Math.round(event.x / snapSize) * snapSize;
        const snappedY = Math.round(event.y / snapSize) * snapSize;

        d.x = snappedX;
        d.y = snappedY;

        d3.select(this).attr("transform", `translate(${d.x},${d.y})`);

        // Save the position
        nodePositions[d.data.id] = { x: d.x, y: d.y };
        saveCurrentData();

        updateLinks();
    }

    /**
     * Handles drag end event
     */
    function dragended(event, d) {
        if (!isEditMode) return;
        d3.select(this).classed("active", false);
    }
}

/**
 * Shows the color picker modal for a node
 * @param {number} nodeId - The ID of the node to color
 */
function showColorPicker(nodeId) {
    nodeToColor = nodeId;

    // Find the node in hierarchy data
    const node = hierarchyData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Set default colors based on node type
    let defaultStrokeColor = '#4B0082';
    let defaultTextColor = '#4B0082';

    switch(node.type) {
        case 'department':
            defaultStrokeColor = nodeColors.department;
            defaultTextColor = nodeColors.department;
            break;
        case 'manager':
            defaultStrokeColor = nodeColors.manager;
            defaultTextColor = nodeColors.manager;
            break;
        case 'job-role':
            defaultStrokeColor = nodeColors.jobRole;
            defaultTextColor = nodeColors.jobRole;
            break;
        case 'employee':
            defaultStrokeColor = nodeColors.employee;
            defaultTextColor = nodeColors.employee;
            break;
        case 'location':
            defaultStrokeColor = nodeColors.location;
            defaultTextColor = nodeColors.location;
            break;
        case 'top-level-role':
            defaultStrokeColor = nodeColors.topLevel;
            defaultTextColor = nodeColors.topLevel;
            break;
    }

    // Set the color picker values
    document.getElementById('nodeFillColor').value = node.customColors?.fill || '#FFFFFF';
    document.getElementById('nodeStrokeColor').value = node.customColors?.stroke || defaultStrokeColor;
    document.getElementById('nodeTextColor').value = node.customColors?.text || defaultTextColor;

    // Show the modal
    document.getElementById('colorPickerModal').style.display = 'flex';
}

/**
 * Applies the selected colors to the node
 */
function applyNodeColor() {
    if (!nodeToColor) return;

    const fillColor = document.getElementById('nodeFillColor').value;
    const strokeColor = document.getElementById('nodeStrokeColor').value;
    const textColor = document.getElementById('nodeTextColor').value;
    const colorScope = document.querySelector('input[name="colorScope"]:checked').value;

    // Find the node in hierarchy data
    const node = hierarchyData.nodes.find(n => n.id === nodeToColor);
    if (!node) return;

    if (colorScope === 'node') {
        // Apply to this node only
        if (!node.customColors) {
            node.customColors = {};
        }

        node.customColors.fill = fillColor;
        node.customColors.stroke = strokeColor;
        node.customColors.text = textColor;
    } else {
        // Apply to all nodes at this level
        const nodeDepth = getNodeDepth(node.id);

        hierarchyData.nodes.forEach(n => {
            if (getNodeDepth(n.id) === nodeDepth && n.type === node.type) {
                if (!n.customColors) {
                    n.customColors = {};
                }

                n.customColors.fill = fillColor;
                n.customColors.stroke = strokeColor;
                n.customColors.text = textColor;
            }
        });
    }

    // Save data
    saveCurrentData();

    // Re-render the chart
    renderCombinedFlowChart(hierarchyData);

    // Close the color picker
    closeColorPicker();
}

/**
 * Closes the color picker modal
 */
function closeColorPicker() {
    document.getElementById('colorPickerModal').style.display = 'none';
    nodeToColor = null;
}

/**
 * Deletes a single node from the hierarchy
 */
function deleteSingleNode() {
    if (!nodeToDelete || !hierarchyData) return;

    // Find the node to delete
    const nodeIndex = hierarchyData.nodes.findIndex(n => n.id === nodeToDelete);
    if (nodeIndex === -1) return;

    const nodeToRemove = hierarchyData.nodes[nodeIndex];

    // Find all links connected to this node
    const connectedLinks = hierarchyData.links.filter(link =>
        link.source === nodeToDelete || link.target === nodeToDelete
    );

    // Find the parent node (if any)
    const parentLink = hierarchyData.links.find(link => link.target === nodeToDelete);
    const parentNode = parentLink ? hierarchyData.nodes.find(n => n.id === parentLink.source) : null;

    // Find child nodes (if any)
    const childLinks = hierarchyData.links.filter(link => link.source === nodeToDelete);
    const childNodes = childLinks.map(link =>
        hierarchyData.nodes.find(n => n.id === link.target)
    ).filter(node => node);

    // If this node has children and we're not deleting them, we need to connect them to the parent
    if (childNodes.length > 0 && parentNode) {
        childNodes.forEach(childNode => {
            // Create a new link from parent to child
            hierarchyData.links.push({
                source: parentNode.id,
                target: childNode.id
            });
        });
    }

    // Remove all links connected to this node
    hierarchyData.links = hierarchyData.links.filter(link =>
        link.source !== nodeToDelete && link.target !== nodeToDelete
    );

    // Remove the node
    hierarchyData.nodes.splice(nodeIndex, 1);

    // Clear saved position if it exists
    delete nodePositions[nodeToDelete];

    // Save data
    saveCurrentData();

    // Re-render the chart
    renderCombinedFlowChart(hierarchyData);

    // Close the modal and reset
    document.getElementById('deleteConfirmationModal').style.display = 'none';
    nodeToDelete = null;
}

/**
 * Deletes a node and all its children from the hierarchy
 */
function deleteWithChildren() {
    if (!nodeToDelete || !hierarchyData) return;

    // Find all child nodes to delete
    const nodesToDelete = new Set();
    nodesToDelete.add(nodeToDelete);

    // Recursively find all children
    const findChildren = (parentId) => {
        hierarchyData.links.forEach(link => {
            if (link.source === parentId) {
                nodesToDelete.add(link.target);
                findChildren(link.target);
            }
        });
    };

    findChildren(nodeToDelete);

    // Remove all nodes to delete
    hierarchyData.nodes = hierarchyData.nodes.filter(n => !nodesToDelete.has(n.id));

    // Remove all links connected to these nodes
    hierarchyData.links = hierarchyData.links.filter(link =>
        !nodesToDelete.has(link.source) && !nodesToDelete.has(link.target)
    );

    // Clear saved positions for deleted nodes
    nodesToDelete.forEach(id => delete nodePositions[id]);

    // Save data
    saveCurrentData();

    // Re-render the chart
    renderCombinedFlowChart(hierarchyData);

    // Close the modal and reset
    document.getElementById('deleteConfirmationModal').style.display = 'none';
    nodeToDelete = null;
}

/**
 * Cancels the delete operation
 */
function cancelDelete() {
    nodeToDelete = null;
    document.getElementById('deleteConfirmationModal').style.display = 'none';
}

/**
 * Updates the node size value display
 */
function updateNodeSizeValue() {
    document.getElementById('nodeSizeValue').textContent = document.getElementById('nodeSizeSlider').value;
    document.getElementById('fsNodeSizeSlider').value = document.getElementById('nodeSizeSlider').value;
    customLayoutSettings.nodeSize = parseInt(document.getElementById('nodeSizeSlider').value);
}

/**
 * Updates the horizontal spacing value display
 */
function updateHorizontalSpacingValue() {
    document.getElementById('horizontalSpacingValue').textContent = document.getElementById('horizontalSpacingSlider').value;
    document.getElementById('fsHorizontalSpacingSlider').value = document.getElementById('horizontalSpacingSlider').value;
    customLayoutSettings.horizontalSpacingSlider = parseInt(document.getElementById('horizontalSpacingSlider').value);
}

/**
 * Applies the node size and spacing settings to the chart
 */
function applyNodeSizeAndSpacing() {
    const nodeSize = parseInt(document.getElementById('nodeSizeSlider').value);
    const horizontalSpacing = parseInt(document.getElementById('horizontalSpacingSlider').value);

    customLayoutSettings.nodeSize = nodeSize;
    customLayoutSettings.horizontalSpacingSlider = horizontalSpacing;

    // Scale spacing values based on the slider (1-200 to actual pixel values)
    customLayoutSettings.horizontalSpacing = 150 + (horizontalSpacing * 2.5); // Increased multiplier for better spacing
    customLayoutSettings.verticalSpacing = 120 + (horizontalSpacing * 1.2);
    customLayoutSettings.elbowLength = 60 + (horizontalSpacing * 0.8);

    // Re-render the chart if we have data
    if (hierarchyData) {
        renderCombinedFlowChart(hierarchyData);
    }
}

/**
 * Resets the layout to its original state
 */
function resetLayout() {
    // Reset to original hierarchy data
    if (originalHierarchyData) {
        hierarchyData = JSON.parse(JSON.stringify(originalHierarchyData));
        nodePositions = {};
        nextNodeId = Math.max(...hierarchyData.nodes.map(n => n.id)) + 1;
    }

    // Reset layout settings to defaults
    customLayoutSettings = {
        horizontalSpacing: 300,
        verticalSpacing: 200,
        elbowLength: 80,
        nodeSize: 150,
        horizontalSpacingSlider: 100
    };

    // Update sliders
    document.getElementById('nodeSizeSlider').value = customLayoutSettings.nodeSize;
    document.getElementById('horizontalSpacingSlider').value = customLayoutSettings.horizontalSpacingSlider;
    document.getElementById('fsNodeSizeSlider').value = customLayoutSettings.nodeSize;
    document.getElementById('fsHorizontalSpacingSlider').value = customLayoutSettings.horizontalSpacingSlider;
    updateNodeSizeValue();
    updateHorizontalSpacingValue();

    // Save data
    saveCurrentData();

    if (hierarchyData) {
        renderCombinedFlowChart(hierarchyData);
    }
}

/**
 * Saves the current layout to the dataset
 */
function saveCurrentLayout() {
    if (!currentDataset || !hierarchyData) return;

    // Save the current layout to the dataset
    datasets[currentDataset].nodePositions = JSON.parse(JSON.stringify(nodePositions));
    datasets[currentDataset].customLayoutSettings = JSON.parse(JSON.stringify(customLayoutSettings));

    saveCurrentData();
    showStatus(`Layout saved for ${currentManager || currentDepartment}`, 'success');
}

/**
 * Shows the employee modal with details
 * @param {Object} nodeData - The node data to display
 * @param {boolean} showTable - Whether to show as table (default false)
 */
function showEmployeeModal(nodeData, showTable = false) {
    const modal = document.getElementById('employeeModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    modalTitle.textContent = nodeData.fullName || `${nodeData.name} - Employee Details`;

    // Create expand/collapse controls if showing multiple employees
    let controlsHTML = '';
    if (nodeData.employees.length > 1) {
        controlsHTML = `
            <div style="margin-bottom: 16px; display: flex; gap: 8px;">
                <button onclick="expandAllGroups()" style="padding: 6px 12px; background: #4B0082; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Expand All</button>
                <button onclick="collapseAllGroups()" style="padding: 6px 12px; background: #64748B; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Collapse All</button>
            </div>
        `;
    }

    // Group employees by job role if showing multiple employees
    let employeeCardsHTML = '';
    if (nodeData.employees.length > 1) {
        if (nodeData.type === 'manager') {
            // For direct reports, show job role groups
            const jobRoleGroups = nodeData.jobRoleGroups || groupEmployeesByJobRole(nodeData.employees);

            Array.from(jobRoleGroups.entries()).forEach(([jobRole, employees]) => {
                employeeCardsHTML += `
                    <div class="job-role-group">
                        <div class="job-role-group-header" onclick="toggleGroup(this)">
                            <h4>${jobRole}</h4>
                            <div style="display: flex; align-items: center;">
                                <span style="margin-right: 12px; font-size: 13px; color: #64748B;">${employees.length} employees</span>
                                <span class="toggle-icon" style="font-size: 0.8em;">▶</span>
                            </div>
                        </div>
                        <div class="job-role-group-content">
                            <ul class="employee-list">
                                ${employees.map(emp => `
                                    <li class="employee-item">
                                        <div class="employee-info">
                                            <strong>${emp['Employee Name'] || 'N/A'}</strong>
                                            <span>${emp['Employee ID'] || 'N/A'} | ${emp['Location'] || 'N/A'}</span>
                                        </div>
                                        <div class="employee-actions">
                                            <button class="employee-action-btn" onclick="showSingleEmployee(event, ${JSON.stringify(emp).replace(/"/g, '&quot;')})">View</button>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                `;
            });
        } else if (nodeData.type === 'department' || nodeData.type === 'location') {
            // For department or location views, show job role groups
            const jobRoleGroups = groupEmployeesByJobRole(nodeData.employees);

            Array.from(jobRoleGroups.entries()).forEach(([jobRole, employees]) => {
                employeeCardsHTML += `
                    <div class="job-role-group">
                        <div class="job-role-group-header" onclick="toggleGroup(this)">
                            <h4>${jobRole}</h4>
                            <div style="display: flex; align-items: center;">
                                <span style="margin-right: 12px; font-size: 13px; color: #64748B;">${employees.length} employees</span>
                                <span class="toggle-icon" style="font-size: 0.8em;">▶</span>
                            </div>
                        </div>
                        <div class="job-role-group-content">
                            <ul class="employee-list">
                                ${employees.map(emp => `
                                    <li class="employee-item">
                                        <div class="employee-info">
                                            <strong>${emp['Employee Name'] || 'N/A'}</strong>
                                            <span>${emp['Employee ID'] || 'N/A'} | ${emp['Location'] || 'N/A'}</span>
                                        </div>
                                        <div class="employee-actions">
                                            <button class="employee-action-btn" onclick="showSingleEmployee(event, ${JSON.stringify(emp).replace(/"/g, '&quot;')})">View</button>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                `;
            });
        } else if (nodeData.type === 'manager' && nodeData.locationGroups) {
            // For all managers view, show location groups
            Array.from(nodeData.locationGroups.entries()).forEach(([location, managers]) => {
                employeeCardsHTML += `
                    <div class="job-role-group">
                        <div class="job-role-group-header" onclick="toggleGroup(this)">
                            <h4>${location}</h4>
                            <div style="display: flex; align-items: center;">
                                <span style="margin-right: 12px; font-size: 13px; color: #64748B;">${managers.length} managers</span>
                                <span class="toggle-icon" style="font-size: 0.8em;">▶</span>
                            </div>
                        </div>
                        <div class="job-role-group-content">
                            <ul class="employee-list">
                                ${managers.map(manager => `
                                    <li class="employee-item">
                                        <div class="employee-info">
                                            <strong>${manager['Employee Name'] || 'N/A'}</strong>
                                            <span>${manager['Job Profile'] || 'N/A'} | ${manager['Employee ID'] || 'N/A'}</span>
                                        </div>
                                        <div class="employee-actions">
                                            <button class="employee-action-btn" onclick="showSingleEmployee(event, ${JSON.stringify(manager).replace(/"/g, '&quot;')})">View</button>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                `;
            });
        } else {
            // Default view for other cases
            employeeCardsHTML = `
                <div class="employee-grid">
                    ${nodeData.employees.map(emp => `
                        <div class="employee-card">
                            <h4>${emp['Employee Name'] || 'N/A'}</h4>
                            <p><strong>Employee ID:</strong> <span class="employee-id">${emp['Employee ID'] || 'N/A'}</span></p>
                            <p><strong>Job Profile:</strong> ${emp['Job Profile'] || 'N/A'}</p>
                            <p><strong>Department:</strong> ${emp['Department'] || 'N/A'}</p>
                            <p><strong>Location:</strong> <span class="employee-location">${emp['Location'] || 'N/A'}</span></p>
                            <p><strong>Reporting Manager:</strong> ${emp['Reporting Manager'] || 'None'}</p>
                            ${emp['Email'] ? `<p><strong>Email:</strong> ${emp['Email']}</p>` : ''}
                            ${emp['Phone'] ? `<p><strong>Phone:</strong> ${emp['Phone']}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } else if (nodeData.employees.length === 1) {
        // Single employee view
        const emp = nodeData.employees[0];
        employeeCardsHTML = `
            <div class="employee-card">
                <h4>${emp['Employee Name'] || 'N/A'}</h4>
                <p><strong>Employee ID:</strong> <span class="employee-id">${emp['Employee ID'] || 'N/A'}</span></p>
                <p><strong>Job Profile:</strong> ${emp['Job Profile'] || 'N/A'}</p>
                <p><strong>Department:</strong> ${emp['Department'] || 'N/A'}</p>
                <p><strong>Location:</strong> <span class="employee-location">${emp['Location'] || 'N/A'}</span></p>
                <p><strong>Reporting Manager:</strong> ${emp['Reporting Manager'] || 'None'}</p>
                ${emp['Email'] ? `<p><strong>Email:</strong> ${emp['Email']}</p>` : ''}
                ${emp['Phone'] ? `<p><strong>Phone:</strong> ${emp['Phone']}</p>` : ''}
            </div>
        `;
    }

    modalContent.innerHTML = controlsHTML + employeeCardsHTML;
    modal.classList.add('active');
}

/**
 * Shows a single employee in the modal
 * @param {Event} event - The click event
 * @param {Object} emp - The employee data
 */
function showSingleEmployee(event, emp) {
    event.stopPropagation();
    showEmployeeModal({
        name: emp['Employee Name'],
        type: 'employee',
        count: 1,
        employees: [emp],
        fullName: `${emp['Employee Name']} - ${emp['Job Profile']} (${emp['Employee ID'] || 'N/A'})`
    });
}

/**
 * Closes the employee modal
 */
function closeEmployeeModal() {
    document.getElementById('employeeModal').classList.remove('active');
}

/**
 * Shows a tooltip with node information
 * @param {Event} event - The mouse event
 * @param {Object} data - The node data
 */
function showTooltip(event, data) {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.opacity = '1';
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY - 10) + 'px';

    let tooltipContent = `<strong>${data.fullName || data.name}</strong><br>`;
    tooltipContent += `Type: ${data.type.replace('-', ' ')}<br>`;

    if (data.count !== undefined) {
        tooltipContent += `Employees: ${data.count}<br>`;
    }

    if (data.employees && data.employees[0]) {
        const emp = data.employees[0];
        if (emp['Employee ID']) tooltipContent += `ID: ${emp['Employee ID']}<br>`;
        if (emp['Job Profile']) tooltipContent += `Job: ${emp['Job Profile']}<br>`;
        if (emp['Location']) tooltipContent += `Location: ${emp['Location']}<br>`;
        if (emp['Reporting Manager']) tooltipContent += `Manager: ${emp['Reporting Manager']}<br>`;
    }

    if (data.description) {
        tooltipContent += `<br>${data.description}`;
    }

    tooltip.innerHTML = tooltipContent;
}

/**
 * Hides the tooltip
 */
function hideTooltip() {
    document.getElementById('tooltip').style.opacity = '0';
}

/**
 * Saves the chart as an image
 */
function saveChartAsImage() {
    const chartContainer = document.getElementById('flowchartContainer');
    const svg = chartContainer.querySelector('svg');

    if (!svg) {
        showStatus('No chart to capture', 'error');
        return;
    }

    // Show progress modal
    const progressModal = document.getElementById('screenshotProgressModal');
    progressModal.style.display = 'flex';
    const progressBar = document.getElementById('screenshotProgressBar');
    const statusText = document.getElementById('screenshotStatus');

    // Update progress
    statusText.textContent = 'Preparing image...';
    progressBar.style.width = '10%';

    // Get all visible nodes to calculate content bounds
    const visibleNodes = Array.from(svg.querySelectorAll('.node:not([display="none"])'));
    if (visibleNodes.length === 0) {
        showStatus('No visible content to capture', 'error');
        progressModal.style.display = 'none';
        return;
    }

    // Calculate content bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    visibleNodes.forEach(node => {
        const transform = node.getAttribute('transform');
        if (transform) {
            const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (match) {
                const x = parseFloat(match[1]);
                const y = parseFloat(match[2]);

                // Get node dimensions
                const rect = node.querySelector('rect');
                if (rect) {
                    const width = parseFloat(rect.getAttribute('width'));
                    const height = parseFloat(rect.getAttribute('height'));

                    minX = Math.min(minX, x - width/2);
                    maxX = Math.max(maxX, x + width/2);
                    minY = Math.min(minY, y - height/2);
                    maxY = Math.max(maxY, y + height/2);
                }
            }
        }
    });

    // Add padding to the bounds
    const padding = 40;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX += padding;
    maxY += padding;

    // Calculate content dimensions
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Create a canvas with content dimensions
    const scale = 2; // Scale factor for higher resolution
    const canvas = document.createElement('canvas');
    canvas.width = contentWidth * scale;
    canvas.height = contentHeight * scale;
    const ctx = canvas.getContext('2d');

    // Set background to white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Convert SVG to data URL with viewBox set to content area
    const svgClone = svg.cloneNode(true);
    svgClone.setAttribute('viewBox', `${minX} ${minY} ${contentWidth} ${contentHeight}`);
    svgClone.setAttribute('width', contentWidth);
    svgClone.setAttribute('height', contentHeight);

    const svgData = new XMLSerializer().serializeToString(svgClone);
    const img = new Image();

    img.onload = function() {
        // Update progress
        statusText.textContent = 'Rendering image...';
        progressBar.style.width = '50%';

        // Draw the SVG image onto the canvas with scaling
        ctx.drawImage(img,
            0,
            0,
            contentWidth * scale,
            contentHeight * scale
        );

        // Update progress
        statusText.textContent = 'Finalizing image...';
        progressBar.style.width = '80%';

        // Create download link
        setTimeout(() => {
            const link = document.createElement('a');
            const filename = `${currentDepartment.replace(/[^a-z0-9]/gi, '_')}_hierarchy_${new Date().toISOString().slice(0,10)}.png`;
            link.download = filename;

            // Convert canvas to blob for better quality
            canvas.toBlob(function(blob) {
                const url = URL.createObjectURL(blob);
                link.href = url;

                // Update progress
                statusText.textContent = 'Downloading image...';
                progressBar.style.width = '100%';

                // Trigger download
                setTimeout(() => {
                    link.click();

                    // Clean up
                    setTimeout(() => {
                        URL.revokeObjectURL(url);
                        progressModal.style.display = 'none';
                        showStatus('Screenshot saved successfully', 'success');
                    }, 100);
                }, 500);
            }, 'image/png', 1.0); // Highest quality
        }, 500);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
}

/**
 * Toggles fullscreen mode for the chart
 */
function toggleFullscreen() {
    const flowchartSection = document.getElementById('flowchartSection');
    const isFullscreen = flowchartSection.classList.contains('fullscreen-chart');

    if (isFullscreen) {
        flowchartSection.classList.remove('fullscreen-chart');
        document.body.style.overflow = 'auto';
        document.getElementById('fullscreenControls').style.display = 'none';
        document.getElementById('fullscreenLocationFilter').style.display = 'none';
        document.getElementById('locationFilter').style.display = 'block';
    } else {
        flowchartSection.classList.add('fullscreen-chart');
        document.body.style.overflow = 'hidden';
        document.getElementById('fullscreenControls').style.display = 'flex';
        document.getElementById('fullscreenLocationFilter').style.display = 'block';
        document.getElementById('locationFilter').style.display = 'none';
    }

    // Recalculate dimensions after fullscreen change
    setTimeout(() => {
        if (hierarchyData) {
            renderCombinedFlowChart(hierarchyData);
        }
    }, 100);
}

// Make functions available globally
window.showSingleEmployee = showSingleEmployee;
window.closeEmployeeModal = closeEmployeeModal;
