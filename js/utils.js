/**
 * Utility functions for the FedEx Hierarchy Generator
 */

/**
 * Shows a status message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of message ('success' or 'error')
 */
function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = message;
    statusDiv.className = `status ${type}`;
}

/**
 * Normalizes a name for comparison (lowercase, trim, remove special chars)
 * @param {string} name - The name to normalize
 * @returns {string} The normalized name
 */
function normalizeName(name) {
    if (!name) return '';

    // Convert to lowercase and remove extra spaces
    let normalized = name.toString().trim().toLowerCase()
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/[^a-z\s]/g, ''); // Remove special characters

    // Split into parts and sort alphabetically to handle name order variations
    const parts = normalized.split(' ').sort();
    return parts.join(' ');
}

/**
 * Calculates similarity between two names (0 to 1)
 * @param {string} name1 - First name
 * @param {string} name2 - Second name
 * @returns {number} Similarity score (0-1)
 */
function nameSimilarity(name1, name2) {
    const normalized1 = normalizeName(name1);
    const normalized2 = normalizeName(name2);

    if (normalized1 === normalized2) return 1.0;

    // Split into parts
    const parts1 = normalized1.split(' ');
    const parts2 = normalized2.split(' ');

    // Count matching parts
    let matches = 0;
    for (const part1 of parts1) {
        for (const part2 of parts2) {
            if (part1 === part2) {
                matches++;
                break;
            }
        }
    }

    // Calculate similarity score
    const maxLength = Math.max(parts1.length, parts2.length);
    return matches / maxLength;
}

/**
 * Finds the best matching employee for a manager name
 * @param {string} managerName - The manager name to match
 * @param {Array} employees - Array of employee objects
 * @returns {Object|null} The best matching employee or null
 */
function findBestMatch(managerName, employees) {
    let bestMatch = null;
    let bestScore = 0.7; // Minimum similarity threshold

    for (const emp of employees) {
        const score = nameSimilarity(managerName, emp['Employee Name']);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = emp;
        }
    }

    return bestMatch;
}

/**
 * Groups employees by their job role
 * @param {Array} employees - Array of employee objects
 * @returns {Map} Map of job roles to employees
 */
function groupEmployeesByJobRole(employees) {
    const jobRoleGroups = new Map();

    employees.forEach(emp => {
        const jobRole = emp['Job Profile'] || 'Unknown Role';
        // Exclude first 7 characters from job role name for display
        const displayJobRole = jobRole.length > 7 ? jobRole.substring(7) : jobRole;
        if (!jobRoleGroups.has(displayJobRole)) {
            jobRoleGroups.set(displayJobRole, []);
        }
        jobRoleGroups.get(displayJobRole).push(emp);
    });

    return jobRoleGroups;
}

/**
 * Toggles a group's expanded/collapsed state
 * @param {HTMLElement} header - The header element that was clicked
 */
function toggleGroup(header) {
    const group = header.parentElement;
    const isExpanded = group.classList.contains('expanded');
    group.classList.toggle('expanded');
    const content = group.querySelector('.job-role-group-content');
    const icon = group.querySelector('.toggle-icon');

    if (isExpanded) {
        content.style.maxHeight = '0';
        icon.textContent = '▶';
    } else {
        content.style.maxHeight = content.scrollHeight + 'px';
        icon.textContent = '▼';
    }
}

/**
 * Expands all employee groups in the modal
 */
function expandAllGroups() {
    document.querySelectorAll('.job-role-group').forEach(group => {
        group.classList.add('expanded');
        const content = group.querySelector('.job-role-group-content');
        const icon = group.querySelector('.toggle-icon');
        content.style.maxHeight = content.scrollHeight + 'px';
        icon.textContent = '▼';
    });
}

/**
 * Collapses all employee groups in the modal
 */
function collapseAllGroups() {
    document.querySelectorAll('.job-role-group').forEach(group => {
        group.classList.remove('expanded');
        const content = group.querySelector('.job-role-group-content');
        const icon = group.querySelector('.toggle-icon');
        content.style.maxHeight = '0';
        icon.textContent = '▶';
    });
}

// Make functions available globally
window.toggleGroup = toggleGroup;
window.expandAllGroups = expandAllGroups;
window.collapseAllGroups = collapseAllGroups;
