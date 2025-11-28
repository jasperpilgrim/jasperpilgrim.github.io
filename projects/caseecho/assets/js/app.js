let allResults = [];
let filteredResults = [];
let currentView = 'grid';
let currentPage = 1;
const itemsPerPage = 50;
let physicalData = null;

const searchInput = document.getElementById('searchInput');
const caseTypeFilter = document.getElementById('caseTypeFilter');
const stateFilter = document.getElementById('stateFilter');
const ageFrom = document.getElementById('ageFrom');
const ageTo = document.getElementById('ageTo');
const dateFrom = document.getElementById('dateFrom');
const dateTo = document.getElementById('dateTo');
const clearFiltersBtn = document.getElementById('clearFilters');
const activeFilters = document.getElementById('activeFilters');
const resultsContainer = document.getElementById('resultsContainer');
const paginationContainer = document.getElementById('paginationContainer');
const resultsTitle = document.getElementById('resultsTitle');
const resultsCount = document.getElementById('resultsCount');
const gridViewBtn = document.getElementById('gridView');
const listViewBtn = document.getElementById('listView');
const sortSelect = document.getElementById('sortSelect');
const totalCases = document.getElementById('totalCases');
const statesCount = document.getElementById('statesCount');
const statesLabel = document.getElementById('statesLabel');
const territoriesCount = document.getElementById('territoriesCount');
const territoriesLabel = document.getElementById('territoriesLabel');
const districtsCount = document.getElementById('districtsCount');
const districtsLabel = document.getElementById('districtsLabel');
const missingCases = document.getElementById('missingCases');
const missingLabel = document.getElementById('missingLabel');
const unidentifiedCases = document.getElementById('unidentifiedCases');
const unidentifiedLabel = document.getElementById('unidentifiedLabel');
const unclaimedCases = document.getElementById('unclaimedCases');
const unclaimedLabel = document.getElementById('unclaimedLabel');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const fullscreenIcon = document.getElementById('fullscreenIcon');
const fullscreenExitIcon = document.getElementById('fullscreenExitIcon');

document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await loadPhysicalData();
    await loadNamUsData();

    showEmptyState();
    updateStats();
    updateFullscreenIcon();
});

function setupEventListeners() {
    searchInput.addEventListener('input', applyFilters);

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            applyFilters();
        }
        if (e.key === 'Escape') {
            clearAllFilters();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && e.target !== searchInput && !e.target.matches('input, textarea, select')) {
            e.preventDefault();
            searchInput.focus();
        }
        if (e.key === 'Escape' && document.activeElement === searchInput && searchInput.value.trim() === '') {
            searchInput.blur();
        }
    });

    caseTypeFilter.addEventListener('change', applyFilters);
    stateFilter.addEventListener('change', applyFilters);
    ageFrom.addEventListener('input', applyFilters);
    ageTo.addEventListener('input', applyFilters);
    if (dateFrom) dateFrom.addEventListener('change', applyFilters);
    if (dateTo) dateTo.addEventListener('change', applyFilters);
    clearFiltersBtn.addEventListener('click', clearAllFilters);

    gridViewBtn.addEventListener('click', () => {
        setView('grid');
    });
    listViewBtn.addEventListener('click', () => {
        setView('list');
    });
    sortSelect.addEventListener('change', applyFilters);

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        document.addEventListener('fullscreenchange', updateFullscreenIcon);
        document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
        document.addEventListener('mozfullscreenchange', updateFullscreenIcon);
        document.addEventListener('MSFullscreenChange', updateFullscreenIcon);
    }

    resultsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('find-matches-btn') || e.target.closest('.find-matches-btn')) {
            e.stopPropagation();
            e.preventDefault();
            const btn = e.target.classList.contains('find-matches-btn') ? e.target : e.target.closest('.find-matches-btn');
            const caseNumber = btn.getAttribute('data-case-number');
            if (caseNumber) {
                window.showMatchesForCase(caseNumber);
            }
            return false;
        }

        if (e.target.closest('.result-card-link') || e.target.closest('.result-item-link') || e.target.tagName === 'A') {
            return;
        }

        const card = e.target.closest('.result-card') || e.target.closest('.result-item');
        if (card && !e.target.closest('button') && !e.target.closest('a')) {
            const caseNumber = card.getAttribute('data-case-number');
            if (caseNumber) {
                const caseData = allResults.find(c => c.caseNumber === caseNumber);
                if (caseData) {
                    showCaseDetailsModal(caseData);
                }
            }
        }
    });
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));

    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) continue;

        const row = {};
        headers.forEach((header, index) => {
            let value = values[index] || '';

            value = value.replace(/^"|"$/g, '');
            row[header] = value;
        });
        results.push(row);
    }

    return results;
}

function detectCaseType(caseNumber) {
    if (!caseNumber) return 'missing';
    const upper = caseNumber.toUpperCase();
    if (upper.startsWith('UP')) return 'unidentified';
    if (upper.startsWith('UCP')) return 'unclaimed';
    return 'missing';
}

function normalizeState(state) {
    if (!state) return '';

    const stateMap = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
        'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
        'florida': 'FL', 'georgia': 'GA', 'guam': 'GU', 'hawaii': 'HI', 'idaho': 'ID',
        'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
        'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
        'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
        'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
        'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
        'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
        'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
        'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
        'puerto rico': 'PR', 'northern mariana islands': 'MP', 'us virgin islands': 'VI',
        'virgin islands': 'VI'
    };

    const normalized = state.trim();
    const lower = normalized.toLowerCase();

    if (/^[A-Z]{2}$/i.test(normalized)) {
        return normalized.toUpperCase();
    }

    if (stateMap[lower]) {
        return stateMap[lower];
    }

    return normalized;
}

function csvRowToCase(row, detectedCaseType = null) {

    const caseNumber = row['Case Number'] || row['Case'] || '';

    const caseType = detectedCaseType || detectCaseType(caseNumber);

    let age = null;
    let ageFrom = null;
    let ageTo = null;

    if (row['Missing Age']) {
        const ageMatch = row['Missing Age'].match(/(\d+)/);
        if (ageMatch) {
            age = parseInt(ageMatch[1]);
        }
    } else if (row['Age From']) {

        const ageFromMatch = row['Age From'].match(/(\d+)/);
        if (ageFromMatch) {
            ageFrom = parseInt(ageFromMatch[1]);
            age = ageFrom;
        }

        if (row['Age To']) {
            const ageToMatch = row['Age To'].match(/(\d+)/);
            if (ageToMatch) {
                ageTo = parseInt(ageToMatch[1]);
            }
        }
    }

    let year = null;
    const dateField = row['DLC'] || row['DBF'] || '';
    if (dateField) {
        const dateMatch = dateField.match(/\/(\d{4})/);
        if (dateMatch) {
            year = parseInt(dateMatch[1]);
        }
    }

    let name = 'Unknown';
    if (row['Legal First Name'] && row['Legal Last Name']) {

        name = `${row['Legal First Name']} ${row['Legal Last Name']}`.trim();
    } else if (row['Case']) {

        name = `Unidentified Person ${caseNumber}`;
    }

    let link = '';
    if (caseNumber) {

        let cleanCaseNumber = caseNumber.trim().replace(/^"|"$/g, '');
        const caseId = cleanCaseNumber.replace(/^MP|^UP|^UCP/i, '').trim();

        if (caseId && /^\d+$/.test(caseId)) {
            if (caseType === 'unidentified') {
                link = `https://www.namus.gov/UnidentifiedPersons/Case#/${caseId}?nav`;
            } else if (caseType === 'unclaimed') {
                link = `https://www.namus.gov/UnclaimedPersons/Case#/${caseId}?nav`;
            } else {
                link = `https://www.namus.gov/MissingPersons/Case#/${caseId}?nav`;
            }
        }
    }

    const caseObj = {
        id: caseNumber ? caseNumber.replace(/^MP|^UP|^UCP/i, '').trim() : null,
        caseNumber: caseNumber,
        caseType: caseType,
        name: name,
        age: age,
        ageFrom: ageFrom,
        ageTo: ageTo,
        state: normalizeState(row['State'] || ''),
        city: row['City'] || '',
        county: row['County'] || '',
        year: year,
        sex: row['Biological Sex'] || '',
        race: row['Race / Ethnicity'] || '',
        dlc: row['DLC'] || row['DBF'] || '',
        dateModified: row['Date Modified'] || '',
        link: link
    };

    if (physicalData && caseNumber && physicalData[caseNumber]) {
        const phys = physicalData[caseNumber];
        caseObj.heightFeet = phys.heightFeet;
        caseObj.heightInches = phys.heightInches;
        caseObj.heightFormatted = phys.heightFormatted;
        caseObj.weight = phys.weight;
        caseObj.hairColor = phys.hairColor;
        caseObj.eyeColor = phys.eyeColor;
        caseObj.headHairDescription = phys.headHairDescription;
        caseObj.bodyHairDescription = phys.bodyHairDescription;
        caseObj.facialHairDescription = phys.facialHairDescription;
        caseObj.circumstances = phys.circumstances;
        caseObj.dnaStatus = phys.dnaStatus;
        caseObj.fingerprintsStatus = phys.fingerprintsStatus;
        caseObj.dentalStatus = phys.dentalStatus;
    }

    return caseObj;
}

async function loadPhysicalData() {
    try {
        const response = await fetch('assets/data/extracted-physical-data.json');
        if (response.ok) {
            physicalData = await response.json();
        }
    } catch (error) {
        console.error('Error loading physical data:', error);
    }
}

async function loadNamUsData() {
    try {

        resultsContainer.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading case data...</div>
                <div class="loading-progress-container">
                    <div class="loading-progress-bar">
                        <div class="loading-progress-fill" id="loadingProgressBar" style="width: 0%"></div>
                    </div>
                    <div class="loading-progress-text" id="loadingProgress">0%</div>
                </div>
            </div>
        `;

        allResults = [];

        const csvFiles = [
            'assets/data/missing/alabama.csv',
            'assets/data/unidentified/alabama.csv',
            'assets/data/unclaimed/alabama.csv',
            'assets/data/missing/alaska.csv',
            'assets/data/unidentified/alaska.csv',
            'assets/data/unclaimed/alaska.csv',
            'assets/data/missing/arizona.csv',
            'assets/data/unidentified/arizona.csv',
            'assets/data/unclaimed/arizona.csv',
            'assets/data/missing/arkansas.csv',
            'assets/data/unidentified/arkansas.csv',
            'assets/data/unclaimed/arkansas.csv',
            'assets/data/missing/california.csv',
            'assets/data/unidentified/california.csv',
            'assets/data/unclaimed/california.csv',
            'assets/data/missing/colorado.csv',
            'assets/data/unidentified/colorado.csv',
            'assets/data/unclaimed/colorado.csv',
            'assets/data/missing/connecticut.csv',
            'assets/data/unidentified/connecticut.csv',
            'assets/data/unclaimed/connecticut.csv',
            'assets/data/missing/delaware.csv',
            'assets/data/unidentified/delaware.csv',
            'assets/data/unclaimed/delaware.csv',
            'assets/data/missing/district-of-columbia.csv',
            'assets/data/unidentified/district-of-columbia.csv',
            'assets/data/unclaimed/district-of-columbia.csv',
            'assets/data/missing/florida.csv',
            'assets/data/unidentified/florida.csv',
            'assets/data/unclaimed/florida.csv',
            'assets/data/missing/georgia.csv',
            'assets/data/unidentified/georgia.csv',
            'assets/data/unclaimed/georgia.csv',
            'assets/data/missing/guam.csv',
            'assets/data/unidentified/guam.csv',
            'assets/data/unclaimed/guam.csv',
            'assets/data/missing/hawaii.csv',
            'assets/data/unidentified/hawaii.csv',
            'assets/data/unclaimed/hawaii.csv',
            'assets/data/missing/idaho.csv',
            'assets/data/unidentified/idaho.csv',
            'assets/data/unclaimed/idaho.csv',
            'assets/data/missing/illinois.csv',
            'assets/data/unidentified/illinois.csv',
            'assets/data/unclaimed/illinois.csv',
            'assets/data/missing/indiana.csv',
            'assets/data/unidentified/indiana.csv',
            'assets/data/unclaimed/indiana.csv',
            'assets/data/missing/iowa.csv',
            'assets/data/unidentified/iowa.csv',
            'assets/data/unclaimed/iowa.csv',
            'assets/data/missing/kansas.csv',
            'assets/data/unidentified/kansas.csv',
            'assets/data/unclaimed/kansas.csv',
            'assets/data/missing/kentucky.csv',
            'assets/data/unidentified/kentucky.csv',
            'assets/data/unclaimed/kentucky.csv',
            'assets/data/missing/louisiana.csv',
            'assets/data/unidentified/louisiana.csv',
            'assets/data/unclaimed/louisiana.csv',
            'assets/data/missing/maine.csv',
            'assets/data/unidentified/maine.csv',
            'assets/data/unclaimed/maine.csv',
            'assets/data/missing/maryland.csv',
            'assets/data/unidentified/maryland.csv',
            'assets/data/unclaimed/maryland.csv',
            'assets/data/missing/massachusetts.csv',
            'assets/data/unidentified/massachusetts.csv',
            'assets/data/unclaimed/massachusetts.csv',
            'assets/data/missing/michigan.csv',
            'assets/data/unidentified/michigan.csv',
            'assets/data/unclaimed/michigan.csv',
            'assets/data/missing/minnesota.csv',
            'assets/data/unidentified/minnesota.csv',
            'assets/data/unclaimed/minnesota.csv',
            'assets/data/missing/mississippi.csv',
            'assets/data/unidentified/mississippi.csv',
            'assets/data/unclaimed/mississippi.csv',
            'assets/data/missing/missouri.csv',
            'assets/data/unidentified/missouri.csv',
            'assets/data/unclaimed/missouri.csv',
            'assets/data/missing/montana.csv',
            'assets/data/unidentified/montana.csv',
            'assets/data/unclaimed/montana.csv',
            'assets/data/missing/nebraska.csv',
            'assets/data/unidentified/nebraska.csv',
            'assets/data/unclaimed/nebraska.csv',
            'assets/data/missing/nevada.csv',
            'assets/data/unidentified/nevada.csv',
            'assets/data/unclaimed/nevada.csv',
            'assets/data/missing/new-hampshire.csv',
            'assets/data/unidentified/new-hampshire.csv',
            'assets/data/unclaimed/new-hampshire.csv',
            'assets/data/missing/new-jersey.csv',
            'assets/data/unidentified/new-jersey.csv',
            'assets/data/unclaimed/new-jersey.csv',
            'assets/data/missing/new-mexico.csv',
            'assets/data/unidentified/new-mexico.csv',
            'assets/data/unclaimed/new-mexico.csv',
            'assets/data/missing/new-york.csv',
            'assets/data/unidentified/new-york.csv',
            'assets/data/unclaimed/new-york.csv',
            'assets/data/missing/north-carolina.csv',
            'assets/data/unidentified/north-carolina.csv',
            'assets/data/unclaimed/north-carolina.csv',
            'assets/data/missing/north-dakota.csv',
            'assets/data/unidentified/north-dakota.csv',
            'assets/data/unclaimed/north-dakota.csv',
            'assets/data/missing/northern-mariana-islands.csv',
            'assets/data/unidentified/northern-mariana-islands.csv',
            'assets/data/unclaimed/northern-mariana-islands.csv',
            'assets/data/missing/ohio.csv',
            'assets/data/unidentified/ohio.csv',
            'assets/data/unclaimed/ohio.csv',
            'assets/data/missing/oklahoma.csv',
            'assets/data/unidentified/oklahoma.csv',
            'assets/data/unclaimed/oklahoma.csv',
            'assets/data/missing/oregon.csv',
            'assets/data/unidentified/oregon.csv',
            'assets/data/unclaimed/oregon.csv',
            'assets/data/missing/pennsylvania.csv',
            'assets/data/unidentified/pennsylvania.csv',
            'assets/data/unclaimed/pennsylvania.csv',
            'assets/data/missing/puerto-rico.csv',
            'assets/data/unidentified/puerto-rico.csv',
            'assets/data/unclaimed/puerto-rico.csv',
            'assets/data/missing/rhode-island.csv',
            'assets/data/unidentified/rhode-island.csv',
            'assets/data/unclaimed/rhode-island.csv',
            'assets/data/missing/south-carolina.csv',
            'assets/data/unidentified/south-carolina.csv',
            'assets/data/unclaimed/south-carolina.csv',
            'assets/data/missing/south-dakota.csv',
            'assets/data/unidentified/south-dakota.csv',
            'assets/data/unclaimed/south-dakota.csv',
            'assets/data/missing/tennessee.csv',
            'assets/data/unidentified/tennessee.csv',
            'assets/data/unclaimed/tennessee.csv',
            'assets/data/missing/texas.csv',
            'assets/data/unidentified/texas.csv',
            'assets/data/unclaimed/texas.csv',
            'assets/data/missing/us-virgin-islands.csv',
            'assets/data/unidentified/us-virgin-islands.csv',
            'assets/data/unclaimed/us-virgin-islands.csv',
            'assets/data/missing/utah.csv',
            'assets/data/unidentified/utah.csv',
            'assets/data/unclaimed/utah.csv',
            'assets/data/missing/vermont.csv',
            'assets/data/unidentified/vermont.csv',
            'assets/data/unclaimed/vermont.csv',
            'assets/data/missing/virginia.csv',
            'assets/data/unidentified/virginia.csv',
            'assets/data/unclaimed/virginia.csv',
            'assets/data/missing/washington.csv',
            'assets/data/unidentified/washington.csv',
            'assets/data/unclaimed/washington.csv',
            'assets/data/missing/west-virginia.csv',
            'assets/data/unidentified/west-virginia.csv',
            'assets/data/unclaimed/west-virginia.csv',
            'assets/data/missing/wisconsin.csv',
            'assets/data/unidentified/wisconsin.csv',
            'assets/data/unclaimed/wisconsin.csv',
            'assets/data/missing/wyoming.csv',
            'assets/data/unidentified/wyoming.csv',
            'assets/data/unclaimed/wyoming.csv'
        ];

        const loadingProgressEl = document.getElementById('loadingProgress');
        let loadedCount = 0;
        const totalFiles = csvFiles.length;

        const loadPromises = csvFiles.map(async (file) => {
            try {
                const response = await fetch(file);
                if (!response.ok) {
                    console.warn(`Failed to load ${file}: ${response.status}`);
                    loadedCount++;
                    if (loadingProgressEl) {
                        const percentage = Math.round((loadedCount / totalFiles) * 100);
                        loadingProgressEl.textContent = `${percentage}% (${loadedCount} / ${totalFiles} files)`;
                        const progressBar = document.getElementById('loadingProgressBar');
                        if (progressBar) {
                            progressBar.style.width = `${percentage}%`;
                        }
                    }
                    return null;
                }

                const csvText = await response.text();
                const csvData = parseCSV(csvText);

                if (csvData.length === 0) {
                    console.warn(`No data found in ${file}`);
                    loadedCount++;
                    if (loadingProgressEl) {
                        const percentage = Math.round((loadedCount / totalFiles) * 100);
                        loadingProgressEl.textContent = `${percentage}% (${loadedCount} / ${totalFiles} files)`;
                        const progressBar = document.getElementById('loadingProgressBar');
                        if (progressBar) {
                            progressBar.style.width = `${percentage}%`;
                        }
                    }
                    return null;
                }

                const firstCaseNumber = csvData[0]['Case Number'] || csvData[0]['Case'] || '';
                let detectedCaseType = detectCaseType(firstCaseNumber);

                if (file.includes('/missing/')) detectedCaseType = 'missing';
                else if (file.includes('/unidentified/')) detectedCaseType = 'unidentified';
                else if (file.includes('/unclaimed/')) detectedCaseType = 'unclaimed';

                const cases = csvData.map(row => csvRowToCase(row, detectedCaseType));
                console.log(`Loaded ${cases.length} ${detectedCaseType} cases from ${file}`);
                loadedCount++;
                if (loadingProgressEl) {
                    const percentage = Math.round((loadedCount / totalFiles) * 100);
                    loadingProgressEl.textContent = `${percentage}% (${loadedCount} / ${totalFiles} files)`;
                    const progressBar = document.getElementById('loadingProgressBar');
                    if (progressBar) {
                        progressBar.style.width = `${percentage}%`;
                    }
                }
                return cases;
            } catch (error) {
                console.error(`Error loading ${file}:`, error);
                loadedCount++;
                if (loadingProgressEl) {
                    const percentage = Math.round((loadedCount / totalFiles) * 100);
                    loadingProgressEl.textContent = `${percentage}% (${loadedCount} / ${totalFiles} files)`;
                    const progressBar = document.getElementById('loadingProgressBar');
                    if (progressBar) {
                        progressBar.style.width = `${percentage}%`;
                    }
                }
                return null;
            }
        });

        const results = await Promise.all(loadPromises);
        allResults = results.filter(r => r !== null).flat();

        console.log(`Total loaded: ${allResults.length} cases`);

        populateStateFilter();

        console.log(`Ready to search ${allResults.length} cases`);
    } catch (error) {
        console.error('Error loading case data:', error);
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <p>Unable to load case data</p>
                <p class="empty-state-hint">Please ensure CSV files exist in the data directory.</p>
            </div>
        `;
        allResults = [];
        filteredResults = [];
    }
}

function performSearch() {

    applyFilters();
}

function showEmptyState() {
    resultsContainer.innerHTML = `
        <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </svg>
            <p>Enter a search term to find cases</p>
        </div>
    `;
    resultsTitle.textContent = 'Search Results';
    resultsCount.textContent = '';
    paginationContainer.innerHTML = '';
    currentPage = 1;
}

function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();

    const hasCaseType = caseTypeFilter.value.length > 0;
    const hasState = stateFilter.value.length > 0;
    const hasAge = ageFrom.value.length > 0 || ageTo.value.length > 0;
    const hasDate = (dateFrom && dateFrom.value) || (dateTo && dateTo.value);
    const hasAnyFilter = hasCaseType || hasState || hasAge || hasDate;

    if (query.length === 0 && !hasAnyFilter) {
        showEmptyState();
        filteredResults = [];
        updateStats();
        return;
    }

    let results = [...allResults];

    if (query.length > 0) {
        results = results.filter(item => {
            return matchesAdvancedQuery(item, query);
        });
    }

    const caseType = caseTypeFilter.value;
    if (caseType) {
        results = results.filter(item => item.caseType === caseType);
    }

    const state = stateFilter.value;
    if (state) {
        results = results.filter(item => item.state === state);
    }

    const fromAge = parseInt(ageFrom.value);
    const toAge = parseInt(ageTo.value);
    if (fromAge) {
        results = results.filter(item => item.age && item.age >= fromAge);
    }
    if (toAge) {
        results = results.filter(item => item.age && item.age <= toAge);
    }

    if (dateFrom && dateFrom.value) {
        const fromDate = new Date(dateFrom.value).getTime();
        results = results.filter(item => {
            const itemDate = parseDate(item.dlc);
            return itemDate && itemDate >= fromDate;
        });
    }
    if (dateTo && dateTo.value) {
        const toDate = new Date(dateTo.value).getTime();
        results = results.filter(item => {
            const itemDate = parseDate(item.dlc);
            return itemDate && itemDate <= toDate;
        });
    }

    filteredResults = sortResults(results);

    currentPage = 1;
    updateActiveFilters();
    updateStats();
    displayResults();
}

function sortResults(results) {
    const sortOption = sortSelect.value;
    const sorted = [...results];

    sorted.sort((a, b) => {
        switch (sortOption) {
            case 'date-desc':

                const dateA = parseDate(a.dlc);
                const dateB = parseDate(b.dlc);
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateB - dateA;

            case 'date-asc':

                const dateA2 = parseDate(a.dlc);
                const dateB2 = parseDate(b.dlc);
                if (!dateA2 && !dateB2) return 0;
                if (!dateA2) return 1;
                if (!dateB2) return -1;
                return dateA2 - dateB2;

            case 'name-asc':

                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);

            case 'name-desc':

                const nameA2 = (a.name || '').toLowerCase();
                const nameB2 = (b.name || '').toLowerCase();
                return nameB2.localeCompare(nameA2);

            case 'age-asc':

                const ageA = a.age ?? 999;
                const ageB = b.age ?? 999;
                return ageA - ageB;

            case 'age-desc':

                const ageA2 = a.age ?? 0;
                const ageB2 = b.age ?? 0;
                return ageB2 - ageA2;

            case 'state-asc':

                const stateA = (a.state || '').toLowerCase();
                const stateB = (b.state || '').toLowerCase();
                return stateA.localeCompare(stateB);

            case 'case-type':
            default:

                const typeOrder = { missing: 0, unidentified: 1, unclaimed: 2 };
                const orderA = typeOrder[a.caseType] ?? 3;
                const orderB = typeOrder[b.caseType] ?? 3;
                return orderA - orderB;
        }
    });

    return sorted;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const month = parseInt(parts[0]) - 1;
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        return new Date(year, month, day).getTime();
    }
    return null;
}

function pluralize(count, singular, plural = null) {
    if (count === 1) return singular;
    return plural || singular + 's';
}

function formatRace(race) {
    if (!race) return '';
    return race.split('/').map(part => {
        return part.split(',').map(r => {
            r = r.trim();

            return r.split(' ').map(word => {
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }).join(' ');
        }).join(', ');
    }).join(' / ');
}

function matchesAdvancedQuery(item, query) {
    const searchableText = `${item.name} ${item.caseNumber} ${item.state || ''} ${item.city || ''} ${item.county || ''} ${item.year || ''} ${item.race || ''}`.toLowerCase();

    const orPattern = /\s+OR\s+/i;
    const andPattern = /\s+AND\s+/i;
    const hasOr = orPattern.test(query);
    const hasAnd = andPattern.test(query);

    let parts;
    if (hasOr) {
        parts = query.split(orPattern);
    } else if (hasAnd) {
        parts = query.split(andPattern);
    } else {
        parts = query.split(/\s+/).filter(p => p.trim().length > 0);
    }

    const matchResults = parts.map(part => {
        part = part.trim();
        if (!part) return false;

        if (part.startsWith('"') && part.endsWith('"')) {
            const phrase = part.slice(1, -1).toLowerCase();
            return searchableText.includes(phrase);
        }

        const fieldMatch = part.match(/^(\w+):(.+)$/);
        if (fieldMatch) {
            const field = fieldMatch[1].toLowerCase();
            let value = fieldMatch[2];

            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            value = value.toLowerCase();

            let fieldValue = '';
            switch (field) {
                case 'name':
                    fieldValue = (item.name || '').toLowerCase();
                    break;
                case 'state':
                    fieldValue = (item.state || '').toLowerCase();
                    break;
                case 'city':
                    fieldValue = (item.city || '').toLowerCase();
                    break;
                case 'county':
                    fieldValue = (item.county || '').toLowerCase();
                    break;
                case 'case':
                case 'casenumber':
                    fieldValue = (item.caseNumber || '').toLowerCase();
                    break;
                case 'age':
                    fieldValue = String(item.age || '');
                    break;
                case 'year':
                    fieldValue = String(item.year || '');
                    break;
                default:

                    return searchableText.includes(value);
            }

            return fieldValue.includes(value);
        }

        return searchableText.includes(part.toLowerCase());
    }).filter(r => r !== undefined);

    if (matchResults.length === 0) return true;

    if (hasOr) {
        return matchResults.some(r => r === true);
    } else {
        return matchResults.every(r => r === true);
    }
}

function updateActiveFilters() {
    const filters = [];

    if (caseTypeFilter.value) {
        const labels = { missing: 'Missing Persons', unidentified: 'Unidentified', unclaimed: 'Unclaimed' };
        filters.push({ type: 'caseType', label: labels[caseTypeFilter.value], value: caseTypeFilter.value });
    }

    if (stateFilter.value) {
        filters.push({ type: 'state', label: `Location: ${stateFilter.value}`, value: stateFilter.value });
    }

    if (ageFrom.value) {
        filters.push({ type: 'ageFrom', label: `Age from: ${ageFrom.value}`, value: ageFrom.value });
    }
    if (ageTo.value) {
        filters.push({ type: 'ageTo', label: `Age to: ${ageTo.value}`, value: ageTo.value });
    }

    if (dateFrom && dateFrom.value) {
        const dateStr = new Date(dateFrom.value).toLocaleDateString();
        filters.push({ type: 'dateFrom', label: `Date from: ${dateStr}`, value: dateFrom.value });
    }
    if (dateTo && dateTo.value) {
        const dateStr = new Date(dateTo.value).toLocaleDateString();
        filters.push({ type: 'dateTo', label: `Date to: ${dateStr}`, value: dateTo.value });
    }

    activeFilters.innerHTML = filters.map(filter => `
        <div class="filter-chip">
            <span>${escapeHtml(filter.label)}</span>
            <button class="filter-chip-remove" data-type="${filter.type}" data-value="${filter.value}">×</button>
        </div>
    `).join('');

    activeFilters.querySelectorAll('.filter-chip-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;

            if (type === 'caseType') {
                caseTypeFilter.value = '';
            } else if (type === 'state') {
                stateFilter.value = '';
            } else if (type === 'ageFrom') {
                ageFrom.value = '';
            } else if (type === 'ageTo') {
                ageTo.value = '';
            } else if (type === 'dateFrom') {
                if (dateFrom) dateFrom.value = '';
            } else if (type === 'dateTo') {
                if (dateTo) dateTo.value = '';
            }

            applyFilters();
        });
    });
}

function clearAllFilters() {
    searchInput.value = '';
    caseTypeFilter.value = '';
    stateFilter.value = '';
    ageFrom.value = '';
    ageTo.value = '';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    updateActiveFilters();
    showEmptyState();
    filteredResults = [];
    updateStats();
}

function populateStateFilter() {
    const states = new Set(allResults.map(r => r.state).filter(s => s));

    const stateDisplayNames = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
        'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
        'DC': 'District of Columbia', 'FL': 'Florida', 'GA': 'Georgia', 'GU': 'Guam',
        'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana',
        'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana',
        'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan',
        'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana',
        'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
        'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota',
        'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania',
        'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee',
        'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia',
        'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
        'PR': 'Puerto Rico', 'MP': 'Northern Mariana Islands', 'VI': 'US Virgin Islands'
    };

    const sortedStates = Array.from(states).sort((a, b) => {
        const nameA = stateDisplayNames[a] || a;
        const nameB = stateDisplayNames[b] || b;
        return nameA.localeCompare(nameB);
    });

    stateFilter.innerHTML = '<option value="">All Locations</option>' +
        sortedStates.map(state => {
            const displayName = stateDisplayNames[state] || state;
            return `<option value="${state}">${displayName}</option>`;
        }).join('');
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function updateStats() {

    totalCases.textContent = formatNumber(allResults.length);

    const dataToCount = filteredResults.length > 0 ? filteredResults : allResults;
    const uniqueStates = new Set(dataToCount.map(r => r.state).filter(s => s));
    
    const territories = new Set(['PR', 'MP', 'VI', 'GU']);
    const districts = new Set(['DC']);
    const allStates = new Set(['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']);
    
    const states = Array.from(uniqueStates).filter(s => allStates.has(s));
    const territoriesList = Array.from(uniqueStates).filter(s => territories.has(s));
    const districtsList = Array.from(uniqueStates).filter(s => districts.has(s));
    
    const statesNum = states.length;
    const territoriesNum = territoriesList.length;
    const districtsNum = districtsList.length;
    const uniqueLocations = statesNum + territoriesNum + districtsNum;
    
    const missing = dataToCount.filter(r => r.caseType === 'missing').length;
    const unidentified = dataToCount.filter(r => r.caseType === 'unidentified').length;
    const unclaimed = dataToCount.filter(r => r.caseType === 'unclaimed').length;

    if (statesCount) statesCount.textContent = formatNumber(statesNum);
    if (statesLabel) statesLabel.textContent = statesNum === 1 ? 'State' : 'States';
    if (territoriesCount) territoriesCount.textContent = formatNumber(territoriesNum);
    if (territoriesLabel) territoriesLabel.textContent = territoriesNum === 1 ? 'Territory' : 'Territories';
    if (districtsCount) districtsCount.textContent = formatNumber(districtsNum);
    if (districtsLabel) districtsLabel.textContent = districtsNum === 1 ? 'District' : 'Districts';
    missingCases.textContent = formatNumber(missing);
    unidentifiedCases.textContent = formatNumber(unidentified);
    unclaimedCases.textContent = formatNumber(unclaimed);
    if (missingLabel) {
        missingLabel.textContent = missing === 1 ? 'Missing Person' : 'Missing Persons';
    }
    if (unidentifiedLabel) {
        unidentifiedLabel.textContent = unidentified === 1 ? 'Unidentified Person' : 'Unidentified';
    }
    if (unclaimedLabel) {
        unclaimedLabel.textContent = unclaimed === 1 ? 'Unclaimed Person' : 'Unclaimed';
    }
}

function setView(view) {
    currentView = view;
    resultsContainer.className = `results-container ${view}-view`;

    gridViewBtn.classList.toggle('active', view === 'grid');
    listViewBtn.classList.toggle('active', view === 'list');

    displayResults();
}

function getPaginatedResults() {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredResults.slice(start, end);
}

window.showMatchesForCase = function (caseNumber) {

    const cleanCaseNumber = String(caseNumber).trim().replace(/^"|"$/g, '');

    let caseData = allResults.find(c => c.caseNumber === cleanCaseNumber);

    if (!caseData) {
        caseData = allResults.find(c => c.caseNumber && c.caseNumber.toLowerCase() === cleanCaseNumber.toLowerCase());
    }

    if (caseData) {
        showPotentialMatches(caseData);
    } else {
        console.error('Case not found:', cleanCaseNumber);
        alert('Case not found. Please try again.');
    }
};

function lockBodyScroll() {
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`;
}

function unlockBodyScroll() {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
}

function closeCaseDetailsModal(modal) {
    unlockBodyScroll();
    modal.remove();
}

function showCaseDetailsModal(caseData) {
    lockBodyScroll();
    const modal = document.createElement('div');
    modal.className = 'case-details-modal';
    modal.innerHTML = `
        <div class="case-details-modal-content">
            <div class="case-details-modal-header">
                <h2>${escapeHtml(caseData.name)}</h2>
                <button class="case-details-modal-close" onclick="closeCaseDetailsModal(this.closest('.case-details-modal'))" aria-label="Close">×</button>
            </div>
            <div class="case-details-modal-body">
                <div class="case-details-grid">
                    <div class="case-details-section">
                        <h3>Case Information</h3>
                        <div class="case-details-info">
                            <div class="case-details-item">
                                <strong>Case #:</strong>
                                <span>${escapeHtml(caseData.caseNumber)}</span>
                            </div>
                            <div class="case-details-item">
                                <strong>Case Type:</strong>
                                <span class="case-type-badge case-type-${caseData.caseType}">${caseData.caseType}</span>
                            </div>
                            ${caseData.age ? `
                            <div class="case-details-item">
                                <strong>Age:</strong>
                                <span>${caseData.age} ${pluralize(caseData.age, 'year')}</span>
                            </div>
                            ` : ''}
                            ${caseData.sex ? `
                            <div class="case-details-item">
                                <strong>Sex:</strong>
                                <span>${escapeHtml(caseData.sex)}</span>
                            </div>
                            ` : ''}
                            ${caseData.race ? `
                            <div class="case-details-item">
                                <strong>Race/Ethnicity:</strong>
                                <span>${escapeHtml(caseData.race)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ${(caseData.heightFormatted || caseData.weight || caseData.hairColor || caseData.eyeColor) ? `
                    <div class="case-details-section">
                        <h3>Physical Description</h3>
                        <div class="case-details-info">
                            ${caseData.heightFormatted ? `
                            <div class="case-details-item">
                                <strong>Height:</strong>
                                <span>${escapeHtml(caseData.heightFormatted)}</span>
                            </div>
                            ` : ''}
                            ${caseData.weight ? `
                            <div class="case-details-item">
                                <strong>Weight:</strong>
                                <span>${escapeHtml(caseData.weight)} lbs</span>
                            </div>
                            ` : ''}
                            ${caseData.hairColor ? `
                            <div class="case-details-item">
                                <strong>Hair:</strong>
                                <span>${escapeHtml(caseData.hairColor)}</span>
                            </div>
                            ` : ''}
                            ${caseData.eyeColor ? `
                            <div class="case-details-item">
                                <strong>Eyes:</strong>
                                <span>${escapeHtml(caseData.eyeColor)}</span>
                            </div>
                            ` : ''}
                            ${caseData.headHairDescription ? `
                            <div class="case-details-item">
                                <strong>Hair Details:</strong>
                                <span>${escapeHtml(caseData.headHairDescription)}</span>
                            </div>
                            ` : ''}
                            ${caseData.facialHairDescription ? `
                            <div class="case-details-item">
                                <strong>Facial Hair:</strong>
                                <span>${escapeHtml(caseData.facialHairDescription)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                    <div class="case-details-section case-details-location-wrapper">
                        <h3>Location</h3>
                        <div class="case-details-info">
                            ${caseData.city ? `
                            <div class="case-details-item">
                                <strong>City:</strong>
                                <span>${escapeHtml(caseData.city)}</span>
                            </div>
                            ` : ''}
                            ${caseData.county ? `
                            <div class="case-details-item">
                                <strong>County:</strong>
                                <span>${escapeHtml(caseData.county)}</span>
                            </div>
                            ` : ''}
                            ${caseData.state ? `
                            <div class="case-details-item">
                                <strong>State:</strong>
                                <span>${escapeHtml(caseData.state)}</span>
                            </div>
                            ` : ''}
                            ${caseData.year ? `
                            <div class="case-details-item">
                                <strong>Year:</strong>
                                <span>${caseData.year}</span>
                            </div>
                            ` : ''}
                            ${caseData.dlc ? `
                            <div class="case-details-item">
                                <strong>${caseData.caseType === 'unidentified' ? 'Date Found' : 'Date Last Contact'}:</strong>
                                <span>${escapeHtml(caseData.dlc)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ${caseData.circumstances ? `
                    <div class="case-details-section case-details-circumstances-wrapper">
                        <h3>Circumstances</h3>
                        <div class="case-details-circumstances">
                            <p>${escapeHtml(caseData.circumstances)}</p>
                        </div>
                    </div>
                    ` : ''}
                    ${(caseData.dnaStatus || caseData.fingerprintsStatus || caseData.dentalStatus) ? `
                    <div class="case-details-section">
                        <h3>Forensic Information</h3>
                        <div class="case-details-info">
                            ${caseData.dnaStatus ? `
                            <div class="case-details-item">
                                <strong>DNA Status:</strong>
                                <span>${escapeHtml(caseData.dnaStatus)}</span>
                            </div>
                            ` : ''}
                            ${caseData.fingerprintsStatus ? `
                            <div class="case-details-item">
                                <strong>Fingerprints Status:</strong>
                                <span>${escapeHtml(caseData.fingerprintsStatus)}</span>
                            </div>
                            ` : ''}
                            ${caseData.dentalStatus ? `
                            <div class="case-details-item">
                                <strong>Dental Status:</strong>
                                <span>${escapeHtml(caseData.dentalStatus)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="case-details-modal-footer">
                <button class="find-matches-btn" data-case-number="${escapeHtml(caseData.caseNumber || '')}" onclick="window.showMatchesForCase('${escapeHtml(caseData.caseNumber || '')}'); closeCaseDetailsModal(this.closest('.case-details-modal'));">Find Similar Cases</button>
                <a href="${caseData.link || '#'}" target="_blank" class="case-details-link">View on NamUs →</a>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeCaseDetailsModal(modal);
        }
    });

    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCaseDetailsModal(modal);
        }
    });
}

function displayResults() {
    if (filteredResults.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <p>No results found. Try adjusting your search or filters.</p>
            </div>
        `;
        resultsTitle.textContent = 'No Results';
        resultsCount.textContent = '';
        paginationContainer.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
    const paginatedResults = getPaginatedResults();

    resultsTitle.textContent = 'Search Results';
    resultsCount.textContent = `Showing ${formatNumber((currentPage - 1) * itemsPerPage + 1)}-${formatNumber(Math.min(currentPage * itemsPerPage, filteredResults.length))} of ${formatNumber(filteredResults.length)} ${filteredResults.length === 1 ? 'case' : 'cases'}`;

    if (currentView === 'grid') {

        resultsContainer.innerHTML = paginatedResults.map((item, index) => {
            return `
            <div class="result-card result-card-${item.caseType}" data-link="${escapeHtml(item.link || '')}" data-case-number="${escapeHtml(item.caseNumber || '')}">
                <div class="result-card-header">
                    <h3 class="result-card-title">${escapeHtml(item.name)}</h3>
                    <span class="result-card-type">${item.caseType}</span>
                </div>
                <div class="result-card-body">
                    <div class="result-card-info">
                        <div class="result-card-info-item">
                            <strong>Case #:</strong>
                            <span>${escapeHtml(item.caseNumber)}</span>
                        </div>
                        ${item.age ? `
                        <div class="result-card-info-item">
                            <strong>Age:</strong>
                            <span>${item.age} ${pluralize(item.age, 'year')}</span>
                        </div>
                        ` : ''}
                        ${item.sex ? `
                        <div class="result-card-info-item">
                            <strong>Sex:</strong>
                            <span>${escapeHtml(item.sex)}</span>
                        </div>
                        ` : ''}
                        ${item.race ? `
                        <div class="result-card-info-item">
                            <strong>Race/Ethnicity:</strong>
                            <span>${escapeHtml(item.race)}</span>
                        </div>
                        ` : ''}
                        ${(item.heightFormatted || item.weight || item.hairColor || item.eyeColor || item.headHairDescription || item.facialHairDescription) ? `
                        <div class="result-card-physical-section">
                            ${item.heightFormatted ? `
                            <div class="result-card-info-item">
                                <strong>Height:</strong>
                                <span>${escapeHtml(item.heightFormatted)}</span>
                            </div>
                            ` : ''}
                            ${item.weight ? `
                            <div class="result-card-info-item">
                                <strong>Weight:</strong>
                                <span>${escapeHtml(item.weight)} lbs</span>
                            </div>
                            ` : ''}
                            ${item.hairColor ? `
                            <div class="result-card-info-item">
                                <strong>Hair:</strong>
                                <span>${escapeHtml(item.hairColor)}</span>
                            </div>
                            ` : ''}
                            ${item.eyeColor ? `
                            <div class="result-card-info-item">
                                <strong>Eyes:</strong>
                                <span>${escapeHtml(item.eyeColor)}</span>
                            </div>
                            ` : ''}
                            ${item.headHairDescription ? `
                            <div class="result-card-info-item">
                                <strong>Hair Details:</strong>
                                <span>${escapeHtml(item.headHairDescription)}</span>
                            </div>
                            ` : ''}
                            ${item.facialHairDescription ? `
                            <div class="result-card-info-item">
                                <strong>Facial Hair:</strong>
                                <span>${escapeHtml(item.facialHairDescription)}</span>
                            </div>
                            ` : ''}
                        </div>
                        ` : ''}
                        ${item.circumstances ? (() => {
                            const words = item.circumstances.trim().split(/\s+/);
                            const previewWords = words.slice(0, 4).join(' ');
                            return `
                        <div class="result-card-circumstances">
                            <div class="result-card-info-item">
                                <strong>Circumstances:</strong>
                                <span>${escapeHtml(previewWords)}...</span>
                            </div>
                        </div>
                        `;
                        })() : ''}
                        ${item.dnaStatus ? `
                        <div class="result-card-info-item">
                            <strong>DNA Status:</strong>
                            <span>${escapeHtml(item.dnaStatus)}</span>
                        </div>
                        ` : ''}
                        ${item.fingerprintsStatus ? `
                        <div class="result-card-info-item">
                            <strong>Fingerprints Status:</strong>
                            <span>${escapeHtml(item.fingerprintsStatus)}</span>
                        </div>
                        ` : ''}
                        ${item.dentalStatus ? `
                        <div class="result-card-info-item">
                            <strong>Dental Status:</strong>
                            <span>${escapeHtml(item.dentalStatus)}</span>
                        </div>
                        ` : ''}
                        ${item.city ? `
                        <div class="result-card-info-item">
                            <strong>City:</strong>
                            <span>${escapeHtml(item.city)}</span>
                        </div>
                        ` : ''}
                        ${item.county ? `
                        <div class="result-card-info-item">
                            <strong>County:</strong>
                            <span>${escapeHtml(item.county)}</span>
                        </div>
                        ` : ''}
                        ${item.state ? `
                        <div class="result-card-info-item">
                            <strong>State:</strong>
                            <span>${escapeHtml(item.state)}</span>
                        </div>
                        ` : ''}
                        ${item.year ? `
                        <div class="result-card-info-item">
                            <strong>Year:</strong>
                            <span>${item.year}</span>
                        </div>
                        ` : ''}
                        ${item.dlc ? `
                        <div class="result-card-info-item">
                            <strong>${item.caseType === 'unidentified' ? 'Date Found' : 'Date Last Contact'}:</strong>
                            <span>${escapeHtml(item.dlc)}</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="result-card-link">
                        <button class="find-matches-btn" data-case-number="${escapeHtml(item.caseNumber || '')}">Find Similar Cases</button>
                        <a href="${item.link || '#'}" target="_blank">View on NamUs →</a>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        if (totalPages > 1) {
            paginationContainer.innerHTML = `
                <div class="pagination">
                    <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">Previous</button>
                    <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
                    <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Next</button>
                </div>
            `;
        } else {
            paginationContainer.innerHTML = '';
        }
    } else {
        resultsContainer.innerHTML = paginatedResults.map((item, index) => {
            return `
            <div class="result-item result-item-${item.caseType}" data-link="${escapeHtml(item.link || '')}" data-case-number="${escapeHtml(item.caseNumber || '')}">
                <div class="result-item-content">
                    <div class="result-item-header">
                        <h3 class="result-item-title">${escapeHtml(item.name)}</h3>
                        <span class="result-item-type">${item.caseType}</span>
                    </div>
                    <div class="result-item-info">
                        <div class="result-item-info-item">
                            <strong>Case #:</strong>
                            <span>${escapeHtml(item.caseNumber)}</span>
                        </div>
                        ${item.age ? `
                        <div class="result-item-info-item">
                            <strong>Age:</strong>
                            <span>${item.age} ${pluralize(item.age, 'year')}</span>
                        </div>
                        ` : ''}
                        ${item.sex ? `
                        <div class="result-item-info-item">
                            <strong>Sex:</strong>
                            <span>${escapeHtml(item.sex)}</span>
                        </div>
                        ` : ''}
                        ${item.race ? `
                        <div class="result-item-info-item">
                            <strong>Race/Ethnicity:</strong>
                            <span>${escapeHtml(item.race)}</span>
                        </div>
                        ` : ''}
                        ${(item.heightFormatted || item.weight || item.hairColor || item.eyeColor || item.headHairDescription || item.facialHairDescription) ? `
                        <div class="result-item-physical-section">
                            ${item.heightFormatted ? `
                            <div class="result-item-info-item">
                                <strong>Height:</strong>
                                <span>${escapeHtml(item.heightFormatted)}</span>
                            </div>
                            ` : ''}
                            ${item.weight ? `
                            <div class="result-item-info-item">
                                <strong>Weight:</strong>
                                <span>${escapeHtml(item.weight)} lbs</span>
                            </div>
                            ` : ''}
                            ${item.hairColor ? `
                            <div class="result-item-info-item">
                                <strong>Hair:</strong>
                                <span>${escapeHtml(item.hairColor)}</span>
                            </div>
                            ` : ''}
                            ${item.eyeColor ? `
                            <div class="result-item-info-item">
                                <strong>Eyes:</strong>
                                <span>${escapeHtml(item.eyeColor)}</span>
                            </div>
                            ` : ''}
                            ${item.headHairDescription ? `
                            <div class="result-item-info-item">
                                <strong>Hair Details:</strong>
                                <span>${escapeHtml(item.headHairDescription)}</span>
                            </div>
                            ` : ''}
                            ${item.facialHairDescription ? `
                            <div class="result-item-info-item">
                                <strong>Facial Hair:</strong>
                                <span>${escapeHtml(item.facialHairDescription)}</span>
                            </div>
                            ` : ''}
                        </div>
                        ` : ''}
                        ${item.circumstances ? (() => {
                            const words = item.circumstances.trim().split(/\s+/);
                            const previewWords = words.slice(0, 4).join(' ');
                            return `
                        <div class="result-item-circumstances">
                            <div class="result-item-info-item">
                                <strong>Circumstances:</strong>
                                <span>${escapeHtml(previewWords)}...</span>
                            </div>
                        </div>
                        `;
                        })() : ''}
                        ${item.dnaStatus ? `
                        <div class="result-item-info-item">
                            <strong>DNA Status:</strong>
                            <span>${escapeHtml(item.dnaStatus)}</span>
                        </div>
                        ` : ''}
                        ${item.fingerprintsStatus ? `
                        <div class="result-item-info-item">
                            <strong>Fingerprints Status:</strong>
                            <span>${escapeHtml(item.fingerprintsStatus)}</span>
                        </div>
                        ` : ''}
                        ${item.dentalStatus ? `
                        <div class="result-item-info-item">
                            <strong>Dental Status:</strong>
                            <span>${escapeHtml(item.dentalStatus)}</span>
                        </div>
                        ` : ''}
                        ${item.city ? `
                        <div class="result-item-info-item">
                            <strong>City:</strong>
                            <span>${escapeHtml(item.city)}</span>
                        </div>
                        ` : ''}
                        ${item.county ? `
                        <div class="result-item-info-item">
                            <strong>County:</strong>
                            <span>${escapeHtml(item.county)}</span>
                        </div>
                        ` : ''}
                        ${item.state ? `
                        <div class="result-item-info-item">
                            <strong>State:</strong>
                            <span>${escapeHtml(item.state)}</span>
                        </div>
                        ` : ''}
                        ${item.year ? `
                        <div class="result-item-info-item">
                            <strong>Year:</strong>
                            <span>${item.year}</span>
                        </div>
                        ` : ''}
                        ${item.dlc ? `
                        <div class="result-item-info-item">
                            <strong>${item.caseType === 'unidentified' ? 'Date Found' : 'Date Last Contact'}:</strong>
                            <span>${escapeHtml(item.dlc)}</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="result-item-link">
                        <button class="find-matches-btn" data-case-number="${escapeHtml(item.caseNumber || '')}">Find Similar Cases</button>
                        <a href="${item.link || '#'}" target="_blank">View full case on NamUs →</a>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        if (totalPages > 1) {
            paginationContainer.innerHTML = `
                <div class="pagination">
                    <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">Previous</button>
                    <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
                    <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Next</button>
                </div>
            `;
        } else {
            paginationContainer.innerHTML = '';
        }
    }
}

function changePage(page) {
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        displayResults();

        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function areStatesAdjacent(state1, state2) {
    if (!state1 || !state2 || state1 === state2) return false;

    const adjacencyMap = {
        'AL': ['FL', 'GA', 'MS', 'TN'],
        'AK': [],
        'AZ': ['CA', 'CO', 'NM', 'NV', 'UT'],
        'AR': ['LA', 'MO', 'MS', 'OK', 'TN', 'TX'],
        'CA': ['AZ', 'NV', 'OR'],
        'CO': ['AZ', 'KS', 'NE', 'NM', 'OK', 'UT', 'WY'],
        'CT': ['MA', 'NY', 'RI'],
        'DE': ['MD', 'NJ', 'PA'],
        'FL': ['AL', 'GA'],
        'GA': ['AL', 'FL', 'NC', 'SC', 'TN'],
        'HI': [],
        'ID': ['MT', 'NV', 'OR', 'UT', 'WA', 'WY'],
        'IL': ['IN', 'IA', 'KY', 'MO', 'WI'],
        'IN': ['IL', 'KY', 'MI', 'OH'],
        'IA': ['IL', 'MN', 'MO', 'NE', 'SD', 'WI'],
        'KS': ['CO', 'MO', 'NE', 'OK'],
        'KY': ['IL', 'IN', 'MO', 'OH', 'TN', 'VA', 'WV'],
        'LA': ['AR', 'MS', 'TX'],
        'ME': ['NH'],
        'MD': ['DE', 'PA', 'VA', 'WV'],
        'MA': ['CT', 'NH', 'NY', 'RI', 'VT'],
        'MI': ['IN', 'OH', 'WI'],
        'MN': ['IA', 'ND', 'SD', 'WI'],
        'MS': ['AL', 'AR', 'LA', 'TN'],
        'MO': ['AR', 'IL', 'IA', 'KS', 'KY', 'NE', 'OK', 'TN'],
        'MT': ['ID', 'ND', 'SD', 'WY'],
        'NE': ['CO', 'IA', 'KS', 'MO', 'SD', 'WY'],
        'NV': ['AZ', 'CA', 'ID', 'OR', 'UT'],
        'NH': ['ME', 'MA', 'VT'],
        'NJ': ['DE', 'NY', 'PA'],
        'NM': ['AZ', 'CO', 'OK', 'TX'],
        'NY': ['CT', 'MA', 'NJ', 'PA', 'VT'],
        'NC': ['GA', 'SC', 'TN', 'VA'],
        'ND': ['MN', 'MT', 'SD'],
        'OH': ['IN', 'KY', 'MI', 'PA', 'WV'],
        'OK': ['AR', 'CO', 'KS', 'MO', 'NM', 'TX'],
        'OR': ['CA', 'ID', 'NV', 'WA'],
        'PA': ['DE', 'MD', 'NJ', 'NY', 'OH', 'WV'],
        'RI': ['CT', 'MA'],
        'SC': ['GA', 'NC'],
        'SD': ['IA', 'MN', 'MT', 'NE', 'ND', 'WY'],
        'TN': ['AL', 'AR', 'GA', 'KY', 'MO', 'MS', 'NC', 'VA'],
        'TX': ['AR', 'LA', 'NM', 'OK'],
        'UT': ['AZ', 'CO', 'ID', 'NV', 'WY'],
        'VT': ['MA', 'NH', 'NY'],
        'VA': ['KY', 'MD', 'NC', 'TN', 'WV'],
        'WA': ['ID', 'OR'],
        'WV': ['KY', 'MD', 'OH', 'PA', 'VA'],
        'WI': ['IL', 'IA', 'MI', 'MN'],
        'WY': ['CO', 'ID', 'MT', 'NE', 'SD', 'UT'],
        'DC': ['MD', 'VA']
    };

    const neighbors = adjacencyMap[state1] || [];
    return neighbors.includes(state2);
}

function calculateMatchScore(case1, case2) {
    let score = 0;
    let maxScore = 0;
    const matchReasons = [];
    const mismatchReasons = [];

    const date1 = parseDate(case1.dlc);
    const date2 = parseDate(case2.dlc);
    const yearsDiff = date1 && date2 ? Math.abs(new Date(date1).getFullYear() - new Date(date2).getFullYear()) : null;
    const daysDiff = date1 && date2 ? Math.abs(date1 - date2) / (1000 * 60 * 60 * 24) : null;

    let hardExclusion = false;
    let exclusionReason = '';

    if (case1.caseType === 'missing' && case2.caseType === 'unidentified' && date1 && date2) {
        if (date1 > date2) {

            hardExclusion = true;
            exclusionReason = `Hard exclusion: Missing date (${case1.dlc}) is after found date (${case2.dlc})`;
        }
    }

    if (case1.sex && case2.sex) {
        const sex1 = case1.sex.toLowerCase().trim();
        const sex2 = case2.sex.toLowerCase().trim();
        if (sex1 !== sex2 && sex1 !== 'unknown' && sex2 !== 'unknown') {
            hardExclusion = true;
            exclusionReason = `Hard exclusion: Sex mismatch (${case1.sex} vs ${case2.sex})`;
        }
    }

    if (yearsDiff && yearsDiff > 50) {
        hardExclusion = true;
        exclusionReason = `Hard exclusion: Dates ${yearsDiff} ${pluralize(yearsDiff, 'year')} apart (extremely unlikely)`;
    }

    if (case1.age && case2.age && date1 && date2 && case1.caseType === 'missing' && case2.caseType === 'unidentified') {
        const yearsBetween = (date2 - date1) / (1000 * 60 * 60 * 24 * 365.25);
        const expectedAge = case1.age + yearsBetween;

        if (expectedAge < case2.age - 5) {
            hardExclusion = true;
            exclusionReason = `Hard exclusion: Impossible age progression (missing at ${case1.age}, found ${Math.round(yearsBetween)} years later at estimated age ${case2.age})`;
        }
    }

    if (case1.heightFormatted && case2.heightFormatted) {
        const height1 = (case1.heightFeet || 0) * 12 + (case1.heightInches || 0);
        const height2 = (case2.heightFeet || 0) * 12 + (case2.heightInches || 0);

        if (height1 > 0 && height2 > 0) {
            const heightDiff = Math.abs(height1 - height2);
            if (heightDiff > 8) {
                hardExclusion = true;
                exclusionReason = `Hard exclusion: Height mismatch too large (${case1.heightFormatted} vs ${case2.heightFormatted}, ${heightDiff}" difference)`;
            }
        }
    }

    if (case1.weight && case2.weight) {
        const weightDiff = Math.abs(case1.weight - case2.weight);
        const weightPercentDiff = weightDiff / Math.max(case1.weight, case2.weight);

        if (weightPercentDiff > 0.5 && weightDiff > 50) {
            hardExclusion = true;
            exclusionReason = `Hard exclusion: Weight mismatch too large (${case1.weight} lbs vs ${case2.weight} lbs, ${Math.round(weightPercentDiff * 100)}% difference)`;
        }
    }

    if (hardExclusion) {
        return {
            score: 0,
            confidence: 'Low',
            matchReasons: [],
            mismatchReasons: [exclusionReason],
            details: {
                ageDiff: null,
                dateDiff: daysDiff,
                yearsDiff: yearsDiff,
                sameState: false,
                sameCounty: false,
                sameCity: false,
                isTemporallyValid: false,
                hardExclusion: true
            }
        };
    }

    const isTemporallyValid = !yearsDiff || yearsDiff <= 50;
    const isTemporallyClose = yearsDiff && yearsDiff <= 10;

    let sexMatch = false;
    let sexMismatch = false;
    let raceMatch = false;
    let raceMismatch = false;
    let ageMismatch = false;
    let ageDiff = null;

    let caseTypeMultiplier = 1.0;
    if (case1.caseType === 'missing' && case2.caseType === 'unidentified') {
        caseTypeMultiplier = 1.0;
    } else if (case1.caseType === 'unidentified' && case2.caseType === 'missing') {
        caseTypeMultiplier = 0.95;
    } else if (case1.caseType === 'unidentified' && case2.caseType === 'unclaimed') {
        caseTypeMultiplier = 0.9;
    }

    maxScore += 50;
    let hasStrongGeographicMatch = false;

    if (case1.state && case2.state) {
        if (case1.state === case2.state) {
            score += 10;
            matchReasons.push('Same state');

            if (case1.county && case2.county) {
                if (case1.county.toLowerCase() === case2.county.toLowerCase()) {
                    score += 20;
                    hasStrongGeographicMatch = true;
                    matchReasons.push('Same county');

                    if (case1.city && case2.city && case1.city.toLowerCase() === case2.city.toLowerCase()) {
                        score += 20;
                        matchReasons.push('Same city');
                    } else if (case1.city && case2.city) {
                        score += 5;
                        mismatchReasons.push(`Different cities: ${case1.city} vs ${case2.city}`);
                    }
                } else {
                    score += 3;
                    matchReasons.push('Same state, different counties');
                    mismatchReasons.push(`Different counties: ${case1.county} vs ${case2.county}`);
                }
            } else if (case1.city && case2.city && case1.city.toLowerCase() === case2.city.toLowerCase()) {
                score += 15;
                matchReasons.push('Same city, same state');
            }
        } else if (areStatesAdjacent(case1.state, case2.state)) {
            score += 5;
            matchReasons.push(`Adjacent states: ${case1.state} and ${case2.state}`);

            if (case1.city && case2.city && case1.city.toLowerCase() === case2.city.toLowerCase()) {
                score += 8;
                matchReasons.push('Same city name across border');
            }
        } else {
            mismatchReasons.push(`Different states: ${case1.state} vs ${case2.state}`);
        }
    }

    maxScore += 30;
    let hasStrongAgeMatch = false;

    if (date1 && date2 && (case1.age || case2.age)) {

        let expectedAge1 = case1.age;
        let expectedAge2 = case2.age;

        if (case1.age && date1 && date2) {

            const yearsBetween = (date2 - date1) / (1000 * 60 * 60 * 24 * 365.25);
            expectedAge1 = case1.age + yearsBetween;
        }

        if (case2.age && date1 && date2) {

            const yearsBetween = (date2 - date1) / (1000 * 60 * 60 * 24 * 365.25);
            expectedAge2 = case2.age - yearsBetween;
        }

        let ageMatchScore = 0;
        let ageReason = '';

        if (case2.ageFrom !== null && case2.ageTo !== null) {

            const ageToCheck = case1.age || expectedAge1;
            const rangeWidth = case2.ageTo - case2.ageFrom;
            const rangeMid = (case2.ageFrom + case2.ageTo) / 2;

            if (rangeWidth === 0) {

                const ageDiff = Math.abs(ageToCheck - case2.ageFrom);
                if (ageDiff === 0) {
                    ageMatchScore = 30;
                    hasStrongAgeMatch = true;
                    ageReason = 'Same age';
                } else if (ageDiff <= 1) {
                    ageMatchScore = 30;
                    hasStrongAgeMatch = true;
                    ageReason = `Age ${Math.round(ageToCheck)} matches age ${case2.ageFrom}`;
                } else if (ageDiff <= 2) {
                    ageMatchScore = 20;
                    hasStrongAgeMatch = true;
                    ageReason = `Age ${Math.round(ageToCheck)} close to age ${case2.ageFrom}`;
                } else if (ageDiff <= 5) {
                    ageMatchScore = 10;
                    ageReason = `Age ${Math.round(ageToCheck)} near age ${case2.ageFrom}`;
                }
            } else if (rangeWidth > 5) {

                ageMatchScore = 0;
                ageReason = '';

            } else if (ageToCheck >= case2.ageFrom && ageToCheck <= case2.ageTo) {

                const distanceFromMid = Math.abs(ageToCheck - rangeMid);
                const normalizedDistance = rangeWidth > 0 ? distanceFromMid / (rangeWidth / 2) : 0;

                let baseScore = 30;

                const positionPenalty = normalizedDistance * 0.3;
                ageMatchScore = Math.round(baseScore * (1 - positionPenalty));

                if (normalizedDistance <= 0.5 || rangeWidth <= 5) {
                    hasStrongAgeMatch = true;
                }

                if (normalizedDistance <= 0.2) {
                    ageReason = `Age ${Math.round(ageToCheck)} matches estimated range (${case2.ageFrom}-${case2.ageTo})`;
                } else if (normalizedDistance <= 0.5) {
                    ageReason = `Age ${Math.round(ageToCheck)} matches estimated range (${case2.ageFrom}-${case2.ageTo})`;
                } else {
                    ageReason = `Age ${Math.round(ageToCheck)} matches estimated range (${case2.ageFrom}-${case2.ageTo})`;
                }
            } else {

                const ageDiff = Math.abs(ageToCheck - rangeMid);
                if (ageDiff <= 2) {
                    ageMatchScore = 20;
                    hasStrongAgeMatch = true;
                    ageReason = `Age ${Math.round(ageToCheck)} close to estimated range (${case2.ageFrom}-${case2.ageTo})`;
                } else if (ageDiff <= 5) {
                    ageMatchScore = 10;
                    ageReason = `Age ${Math.round(ageToCheck)} near estimated range (${case2.ageFrom}-${case2.ageTo})`;
                }
            }
        } else if (case1.age && case2.age) {

            const ageDiff1 = Math.abs(expectedAge1 - case2.age);
            const ageDiff2 = Math.abs(case1.age - expectedAge2);
            const ageDiff = Math.min(ageDiff1, ageDiff2);

            if (ageDiff === 0 || (Math.abs(case1.age - case2.age) === 0 && !date1 && !date2)) {
                ageMatchScore = 30;
                hasStrongAgeMatch = true;
                ageReason = 'Same age';
            } else if (ageDiff <= 1) {
                ageMatchScore = 30;
                hasStrongAgeMatch = true;
                ageReason = `Age matches: ${case1.age} at disappearance, ${case2.age} when found`;
            } else if (ageDiff <= 2) {
                ageMatchScore = 20;
                hasStrongAgeMatch = true;
                const roundedDiff = Math.round(ageDiff);
                ageReason = `Ages match within ${roundedDiff} ${pluralize(roundedDiff, 'year')}`;
            } else if (ageDiff <= 5) {
                ageMatchScore = 10;
                const roundedDiff = Math.round(ageDiff);
                ageReason = `Ages match within ${roundedDiff} ${pluralize(roundedDiff, 'year')}`;
            } else if (ageDiff <= 10) {
                ageMatchScore = 5;
                const roundedDiff = Math.round(ageDiff);
                ageReason = `Ages match within ${roundedDiff} ${pluralize(roundedDiff, 'year')}`;
            }
        }

        if (ageMatchScore > 0 && yearsDiff && yearsDiff > 10) {
            const reduction = yearsDiff <= 25 ? 0.5 : 0.75;
            ageMatchScore = Math.round(ageMatchScore * (1 - reduction));
            ageReason += ` (reduced due to ${yearsDiff} ${pluralize(yearsDiff, 'year')} date gap)`;
        }

        if (ageMatchScore > 0) {
            score += ageMatchScore;
            if (ageReason) {
                matchReasons.push(ageReason);
            }
        } else if (case1.age && case2.age && date1 && date2) {

            const ageDiff1 = Math.abs(expectedAge1 - case2.age);
            const ageDiff2 = Math.abs(case1.age - expectedAge2);
            ageDiff = Math.min(ageDiff1, ageDiff2);

            if (ageDiff > 5) {
                ageMismatch = true;
                mismatchReasons.push(`Ages don't match: ${case1.age} vs ${case2.age} (${Math.round(ageDiff)} ${pluralize(Math.round(ageDiff), 'year')} difference)`);
            } else if (ageDiff > 2) {
                mismatchReasons.push(`Ages don't match closely: ${case1.age} vs ${case2.age} (${Math.round(ageDiff)} ${pluralize(Math.round(ageDiff), 'year')} difference)`);
            }
        } else if (case1.age && case2.age && (!date1 || !date2)) {

            const directAgeDiff = Math.abs(case1.age - case2.age);
            if (directAgeDiff > 5) {
                ageMismatch = true;
                ageDiff = directAgeDiff;
                mismatchReasons.push(`Ages don't match: ${case1.age} vs ${case2.age} (${Math.round(ageDiff)} ${pluralize(Math.round(ageDiff), 'year')} difference)`);
            }
        } else if ((case1.age || case2.age) && !case1.age) {
            mismatchReasons.push('Age not available for missing person');
        } else if ((case1.age || case2.age) && !case2.age) {
            mismatchReasons.push('Age not available for unidentified person');
        }
    }

    maxScore += 20;
    let hasStrongDateMatch = false;
    if (date1 && date2) {
        if (daysDiff <= 30) {
            score += 20;
            hasStrongDateMatch = true;
            matchReasons.push(`Dates within 30 days`);
        } else if (daysDiff <= 90) {
            score += 15;
            hasStrongDateMatch = true;
            matchReasons.push(`Dates within 90 days`);
        } else if (daysDiff <= 180) {
            score += 10;
            matchReasons.push(`Dates within 6 months`);
        } else if (daysDiff <= 365) {
            score += 5;
            matchReasons.push(`Dates within 1 year`);
        } else if (yearsDiff && yearsDiff <= 5) {
            score += 2;
            matchReasons.push(`Dates within ${yearsDiff} ${pluralize(yearsDiff, 'year')}`);
        } else if (yearsDiff && yearsDiff > 5) {

            mismatchReasons.push(`Dates ${yearsDiff} ${pluralize(yearsDiff, 'year')} apart`);
        }

        if (case1.caseType === 'missing' && case2.caseType === 'unidentified' && date1 < date2) {
            if (daysDiff <= 3650) {
                score += 5;
                matchReasons.push('Missing date before found date');
            }
        }
    } else {

        if (!date1 && case1.dlc) {
            mismatchReasons.push('Date not available for missing person');
        } else if (!date1) {
            mismatchReasons.push('Date not available for first case');
        }
        if (!date2 && case2.dlc) {
            mismatchReasons.push('Date not available for unidentified person');
        } else if (!date2) {
            mismatchReasons.push('Date not available for second case');
        }
    }

    maxScore += 15;

    if (case1.sex && case2.sex) {
        const sex1 = case1.sex.toLowerCase().trim();
        const sex2 = case2.sex.toLowerCase().trim();
        if (sex1 === sex2) {
            score += 8;
            sexMatch = true;
            matchReasons.push('Same sex');
        } else {
            sexMismatch = true;
            const sex1Formatted = case1.sex.charAt(0).toUpperCase() + case1.sex.slice(1).toLowerCase();
            const sex2Formatted = case2.sex.charAt(0).toUpperCase() + case2.sex.slice(1).toLowerCase();
            mismatchReasons.push(`Sex mismatch: ${sex1Formatted} vs ${sex2Formatted}`);
        }
    } else {

        if (!case1.sex && case2.sex) {
            mismatchReasons.push('Sex not available for missing person');
        } else if (case1.sex && !case2.sex) {
            mismatchReasons.push('Sex not available for unidentified person');
        } else if (!case1.sex && !case2.sex) {
            mismatchReasons.push('Sex not available for either case');
        }
    }

    if (case1.race && case2.race) {
        const race1 = case1.race.toLowerCase().trim();
        const race2 = case2.race.toLowerCase().trim();

        if (race1 === race2) {
            score += 7;
            raceMatch = true;
            matchReasons.push('Same race/ethnicity');
        } else {

            const race1Parts = race1.split(',').map(r => r.trim());
            const race2Parts = race2.split(',').map(r => r.trim());

            const matchingParts = race1Parts.filter(r1 =>
                race2Parts.some(r2 => r1 === r2 || r1.includes(r2) || r2.includes(r1))
            );

            if (matchingParts.length > 0) {
                score += 4;
                raceMatch = true;
                const formattedParts = matchingParts.map(p => formatRace(p));
                matchReasons.push(`Partial race match: ${formattedParts.join(', ')}`);
            } else {
                raceMismatch = true;
                mismatchReasons.push(`Race mismatch: ${formatRace(case1.race)} vs ${formatRace(case2.race)}`);
            }
        }
    } else {

        if (!case1.race && case2.race) {
            mismatchReasons.push('Race/ethnicity not available for missing person');
        } else if (case1.race && !case2.race) {
            mismatchReasons.push('Race/ethnicity not available for unidentified person');
        } else if (!case1.race && !case2.race) {
            mismatchReasons.push('Race/ethnicity not available for either case');
        }
    }

    maxScore += 25;
    let hasStrongPhysicalMatch = false;

    if (case1.heightFormatted && case2.heightFormatted) {
        const height1 = (case1.heightFeet || 0) * 12 + (case1.heightInches || 0);
        const height2 = (case2.heightFeet || 0) * 12 + (case2.heightInches || 0);

        if (height1 > 0 && height2 > 0) {
            const heightDiff = Math.abs(height1 - height2);

            if (heightDiff === 0) {
                score += 10;
                hasStrongPhysicalMatch = true;
                matchReasons.push(`Same height: ${case1.heightFormatted}`);
            } else if (heightDiff <= 1) {
                score += 8;
                hasStrongPhysicalMatch = true;
                matchReasons.push(`Height match: ${case1.heightFormatted} vs ${case2.heightFormatted}`);
            } else if (heightDiff <= 2) {
                score += 5;
                matchReasons.push(`Height close: ${case1.heightFormatted} vs ${case2.heightFormatted}`);
            } else if (heightDiff <= 3) {
                score += 2;
                matchReasons.push(`Height similar: ${case1.heightFormatted} vs ${case2.heightFormatted}`);
            } else if (heightDiff > 4) {
                mismatchReasons.push(`Height mismatch: ${case1.heightFormatted} vs ${case2.heightFormatted}`);
            }
        }
    }

    if (case1.weight && case2.weight) {
        const weightDiff = Math.abs(case1.weight - case2.weight);
        const weightPercentDiff = weightDiff / Math.max(case1.weight, case2.weight);

        if (weightPercentDiff <= 0.05) {
            score += 8;
            hasStrongPhysicalMatch = true;
            matchReasons.push(`Weight match: ${case1.weight} lbs vs ${case2.weight} lbs`);
        } else if (weightPercentDiff <= 0.10) {
            score += 5;
            matchReasons.push(`Weight close: ${case1.weight} lbs vs ${case2.weight} lbs`);
        } else if (weightPercentDiff <= 0.15) {
            score += 2;
            matchReasons.push(`Weight similar: ${case1.weight} lbs vs ${case2.weight} lbs`);
        } else if (weightPercentDiff > 0.25) {
            mismatchReasons.push(`Weight mismatch: ${case1.weight} lbs vs ${case2.weight} lbs`);
        }
    }

    if (case1.hairColor && case2.hairColor) {
        const hair1 = case1.hairColor.toLowerCase().trim();
        const hair2 = case2.hairColor.toLowerCase().trim();

        if (hair1 === hair2 && hair1 !== 'unknown' && hair1 !== 'other') {
            score += 8;
            hasStrongPhysicalMatch = true;
            matchReasons.push(`Same hair color: ${case1.hairColor}`);
        } else if (hair1 !== 'unknown' && hair2 !== 'unknown' && hair1 !== 'other' && hair2 !== 'other') {
            const hair1Parts = hair1.split('/').map(h => h.trim());
            const hair2Parts = hair2.split('/').map(h => h.trim());

            const matchingHair = hair1Parts.filter(h1 =>
                hair2Parts.some(h2 => h1 === h2 || h1.includes(h2) || h2.includes(h1))
            );

            if (matchingHair.length > 0) {
                score += 4;
                matchReasons.push(`Similar hair color: ${case1.hairColor} vs ${case2.hairColor}`);
            } else {
                mismatchReasons.push(`Hair color mismatch: ${case1.hairColor} vs ${case2.hairColor}`);
            }
        }
    }

    if (case1.eyeColor && case2.eyeColor) {
        const eye1 = case1.eyeColor.toLowerCase().trim();
        const eye2 = case2.eyeColor.toLowerCase().trim();

        if (eye1 === eye2 && eye1 !== 'unknown' && eye1 !== 'other') {
            score += 7;
            hasStrongPhysicalMatch = true;
            matchReasons.push(`Same eye color: ${case1.eyeColor}`);
        } else if (eye1 !== 'unknown' && eye2 !== 'unknown' && eye1 !== 'other' && eye2 !== 'other') {
            mismatchReasons.push(`Eye color mismatch: ${case1.eyeColor} vs ${case2.eyeColor}`);
        }
    }

    if (case1.headHairDescription && case2.headHairDescription) {
        const desc1 = case1.headHairDescription.toLowerCase();
        const desc2 = case2.headHairDescription.toLowerCase();

        const commonWords = desc1.split(/\s+/).filter(word =>
            word.length > 3 && desc2.includes(word)
        );

        if (commonWords.length >= 2) {
            score += 3;
            matchReasons.push('Similar hair description');
        }
    }

    score = Math.round(score * caseTypeMultiplier);

    if (!isTemporallyValid && yearsDiff) {
        score = Math.round(score * 0.7);
    }

    if (sexMismatch) {
        score = Math.round(score * 0.7);

    }

    if (raceMismatch) {
        score = Math.round(score * 0.6);

    }

    if (ageMismatch && ageDiff !== null) {
        let agePenalty = 0.7;
        if (ageDiff > 50) {
            agePenalty = 0.2;
        } else if (ageDiff > 40) {
            agePenalty = 0.3;
        } else if (ageDiff > 30) {
            agePenalty = 0.4;
        } else if (ageDiff > 20) {
            agePenalty = 0.5;
        }
        score = Math.round(score * agePenalty);

    }

    let physicalMismatch = false;
    if (case1.hairColor && case2.hairColor &&
        case1.hairColor.toLowerCase() !== 'unknown' && case2.hairColor.toLowerCase() !== 'unknown' &&
        case1.hairColor.toLowerCase() !== 'other' && case2.hairColor.toLowerCase() !== 'other') {
        const hair1 = case1.hairColor.toLowerCase().trim();
        const hair2 = case2.hairColor.toLowerCase().trim();

        if (hair1 !== hair2) {
            const hair1Parts = hair1.split('/').map(h => h.trim());
            const hair2Parts = hair2.split('/').map(h => h.trim());
            const matchingHair = hair1Parts.filter(h1 =>
                hair2Parts.some(h2 => h1 === h2 || h1.includes(h2) || h2.includes(h1))
            );

            if (matchingHair.length === 0) {
                physicalMismatch = true;
            }
        }
    }

    if (case1.eyeColor && case2.eyeColor &&
        case1.eyeColor.toLowerCase() !== 'unknown' && case2.eyeColor.toLowerCase() !== 'unknown' &&
        case1.eyeColor.toLowerCase() !== 'other' && case2.eyeColor.toLowerCase() !== 'other') {
        const eye1 = case1.eyeColor.toLowerCase().trim();
        const eye2 = case2.eyeColor.toLowerCase().trim();

        if (eye1 !== eye2) {
            physicalMismatch = true;
        }
    }

    if (physicalMismatch) {
        score = Math.round(score * 0.8);
    }

    const strongFactors = [];
    if (hasStrongGeographicMatch) strongFactors.push('geography');
    if (hasStrongAgeMatch) strongFactors.push('age');
    if (hasStrongDateMatch) strongFactors.push('date');
    if (sexMatch) strongFactors.push('sex');
    if (raceMatch) strongFactors.push('race');
    if (hasStrongPhysicalMatch) strongFactors.push('physical');

    const percentage = maxScore > 0 ? Math.min(100, Math.round((score / maxScore) * 100)) : 0;
    let confidence = 'Low';

    const hasCriticalFactors = sexMatch && raceMatch && !sexMismatch && !raceMismatch && !ageMismatch && !physicalMismatch;
    const hasStrongGeography = hasStrongGeographicMatch;

    if (percentage >= 75 && isTemporallyValid && hasCriticalFactors && hasStrongGeography && hasStrongPhysicalMatch && strongFactors.length >= 5) {
        confidence = 'High';
    } else if (percentage >= 75 && isTemporallyValid && hasCriticalFactors && hasStrongGeography && strongFactors.length >= 4) {
        confidence = 'High';
    } else if (percentage >= 70 && isTemporallyValid && hasCriticalFactors && hasStrongGeography && hasStrongPhysicalMatch && strongFactors.length >= 4) {
        confidence = 'High';
    } else if (percentage >= 70 && isTemporallyValid && hasCriticalFactors && hasStrongGeography && strongFactors.length >= 3) {
        confidence = 'High';
    } else if (percentage >= 70 && isTemporallyValid && hasCriticalFactors && hasStrongPhysicalMatch && strongFactors.length >= 3) {
        confidence = 'Medium';
    } else if (percentage >= 70 && isTemporallyValid && hasCriticalFactors && strongFactors.length >= 3) {
        confidence = 'Medium';
    } else if (percentage >= 60 && isTemporallyValid && sexMatch && raceMatch && !sexMismatch && !raceMismatch && hasStrongPhysicalMatch && strongFactors.length >= 3) {
        confidence = 'Medium';
    } else if (percentage >= 60 && isTemporallyValid && sexMatch && raceMatch && !sexMismatch && !raceMismatch && strongFactors.length >= 2) {
        confidence = 'Medium';
    } else if (percentage >= 50 && isTemporallyValid && !sexMismatch && !raceMismatch && !ageMismatch && !physicalMismatch) {
        confidence = 'Medium';
    } else if (percentage >= 40 && isTemporallyValid && !raceMismatch && !ageMismatch && !physicalMismatch) {
        confidence = 'Low';
    } else if (percentage >= 40 && isTemporallyValid) {
        confidence = 'Low';
    } else if (percentage >= 70) {
        confidence = 'Low';
    } else {
        confidence = 'Low';
    }

    if (sexMismatch && confidence === 'High') {
        confidence = 'Medium';
    }

    if (raceMismatch && confidence === 'High') {
        confidence = 'Medium';
    }
    if (raceMismatch && confidence === 'Medium' && percentage < 50) {
        confidence = 'Low';
    }

    if (ageMismatch && ageDiff !== null) {
        if (confidence === 'High') {
            confidence = 'Medium';
        }

        if (ageDiff > 20 && confidence === 'Medium') {
            confidence = 'Low';
        }

        if (ageDiff > 40) {
            confidence = 'Low';
        }
    }

    if (physicalMismatch && confidence === 'High') {
        confidence = 'Medium';
    }

    if (physicalMismatch && confidence === 'Medium' && percentage < 55) {
        confidence = 'Low';
    }

    return {
        score: percentage,
        confidence: confidence,
        matchReasons: matchReasons,
        mismatchReasons: mismatchReasons,
        details: {
            ageDiff: case1.age && case2.age ? Math.abs(case1.age - case2.age) : null,
            dateDiff: daysDiff,
            yearsDiff: yearsDiff,
            sameState: case1.state && case2.state && case1.state === case2.state,
            sameCounty: case1.county && case2.county && case1.county.toLowerCase() === case2.county.toLowerCase(),
            sameCity: case1.city && case2.city && case1.city.toLowerCase() === case2.city.toLowerCase(),
            isTemporallyValid: isTemporallyValid,
            strongFactors: strongFactors.length,
            hardExclusion: false,
        }
    };
}

function findPotentialMatches(targetCase) {

    const otherCases = allResults.filter(c => c.caseType !== targetCase.caseType);

    const matches = otherCases.map(c => ({
        case: c,
        match: calculateMatchScore(targetCase, c)
    }));

    return matches
        .sort((a, b) => b.match.score - a.match.score)
        .slice(0, 20)
        .filter(m => m.match.score > 0);
}

function closeMatchesModal(modal) {
    unlockBodyScroll();
    modal.remove();
}

function showPotentialMatches(caseData) {
    lockBodyScroll();
    const matches = findPotentialMatches(caseData);

    const modal = document.createElement('div');
    modal.className = 'matches-modal';
    modal.innerHTML = `
        <div class="matches-modal-content">
            <div class="matches-modal-header">
                <h2>Potential Matches for ${escapeHtml(caseData.name)}</h2>
                <button class="matches-modal-close" onclick="closeMatchesModal(this.closest('.matches-modal'))">×</button>
            </div>
            <div class="matches-modal-body">
                ${matches.length === 0 ? `
                    <div class="no-matches">
                        <p>No potential matches found. Try adjusting your search criteria.</p>
                    </div>
                ` : `
                    <div class="matches-list">
                        ${matches.map(match => `
                            <div class="match-item match-item-${match.case.caseType}">
                                <div class="match-header">
                                    <div class="match-title">
                                        <h3>${escapeHtml(match.case.name)}</h3>
                                        <span class="match-type match-type-${match.case.caseType}">${match.case.caseType}</span>
                                    </div>
                                    <div class="match-score">
                                        <span class="match-score-value match-score-${match.match.confidence.toLowerCase()}">${match.match.score}%</span>
                                        <span class="match-confidence">${match.match.confidence} Match</span>
                                    </div>
                                </div>
                                <div class="match-details">
                                    <div class="match-case-info">
                                        <div class="match-case-info-item">
                                            <strong>Case #:</strong>
                                            <span>${escapeHtml(match.case.caseNumber)}</span>
                                        </div>
                                        ${match.case.age ? `
                                        <div class="match-case-info-item">
                                            <strong>Age:</strong>
                                            <span>${match.case.age} ${pluralize(match.case.age, 'year')}</span>
                                        </div>
                                        ` : ''}
                                        ${match.case.sex ? `
                                        <div class="match-case-info-item">
                                            <strong>Sex:</strong>
                                            <span>${escapeHtml(match.case.sex)}</span>
                                        </div>
                                        ` : ''}
                                        ${match.case.race ? `
                                        <div class="match-case-info-item">
                                            <strong>Race/Ethnicity:</strong>
                                            <span>${escapeHtml(match.case.race)}</span>
                                        </div>
                                        ` : ''}
                                        ${match.case.state ? `
                                        <div class="match-case-info-item">
                                            <strong>State:</strong>
                                            <span>${escapeHtml(match.case.state)}</span>
                                        </div>
                                        ` : ''}
                                        ${match.case.county ? `
                                        <div class="match-case-info-item">
                                            <strong>County:</strong>
                                            <span>${escapeHtml(match.case.county)}</span>
                                        </div>
                                        ` : ''}
                                        ${match.case.city ? `
                                        <div class="match-case-info-item">
                                            <strong>City:</strong>
                                            <span>${escapeHtml(match.case.city)}</span>
                                        </div>
                                        ` : ''}
                                        ${match.case.dlc ? `
                                        <div class="match-case-info-item">
                                            <strong>${match.case.caseType === 'unidentified' ? 'Date Found' : match.case.caseType === 'missing' ? 'Date Last Contact' : 'Date'}:</strong>
                                            <span>${escapeHtml(match.case.dlc)}</span>
                                        </div>
                                        ` : ''}
                                        ${caseData.dlc ? `
                                        <div class="match-case-info-item">
                                            <strong>Original Case Date:</strong>
                                            <span>${escapeHtml(caseData.dlc)}</span>
                                        </div>
                                        ` : ''}
                                        ${match.match.details.yearsDiff ? `
                                        <div class="match-case-info-item">
                                            <strong style="color: ${match.match.details.yearsDiff > 50 ? '#ff5555' : match.match.details.yearsDiff > 10 ? '#ffb86c' : 'inherit'};">Time Gap:</strong>
                                            <span style="color: ${match.match.details.yearsDiff > 50 ? '#ff5555' : match.match.details.yearsDiff > 10 ? '#ffb86c' : 'inherit'};">${match.match.details.yearsDiff} ${pluralize(match.match.details.yearsDiff, 'year')}</span>
                                        </div>
                                        ` : ''}
                                    </div>
                                    <div class="match-reasons">
                                        <strong>Match Reasons:</strong>
                                        ${match.match.matchReasons.length > 0 ? `
                                        <ul>
                                            ${match.match.matchReasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
                                        </ul>
                                        ` : '<p style="color: var(--text-secondary); font-style: italic;">None</p>'}
                                        ${match.match.mismatchReasons.length > 0 ? `
                                        <div style="margin-top: 1rem;">
                                            <strong>Mismatches:</strong>
                                            <ul>
                                                ${match.match.mismatchReasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
                                            </ul>
                                        </div>
                                        ` : ''}
                                    </div>
                                </div>
                                <div class="match-actions">
                                    <a href="${match.case.link}" target="_blank" class="match-link">View on NamUs →</a>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeMatchesModal(modal);
        }
    });

    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMatchesModal(modal);
        }
    });
}

window.changePage = changePage;

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleFullscreen() {
    if (!document.fullscreenElement && 
        !document.webkitFullscreenElement && 
        !document.mozFullScreenElement && 
        !document.msFullscreenElement) {
        const element = document.documentElement;
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

function updateFullscreenIcon() {
    const isFullscreen = !!(document.fullscreenElement || 
                            document.webkitFullscreenElement || 
                            document.mozFullScreenElement || 
                            document.msFullscreenElement);
    
    if (fullscreenIcon && fullscreenExitIcon) {
        if (isFullscreen) {
            fullscreenIcon.style.display = 'none';
            fullscreenExitIcon.style.display = 'block';
        } else {
            fullscreenIcon.style.display = 'block';
            fullscreenExitIcon.style.display = 'none';
        }
    }
}


