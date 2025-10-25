// Check authentication
const voidUser = localStorage.getItem('voidUser');
let currentUser = null;
if (voidUser) {
    try {
        currentUser = JSON.parse(voidUser);
    } catch (e) {
        localStorage.removeItem('voidUser');
        localStorage.removeItem('voidToken');
        window.location.href = '/login.html';
    }
} else {
    window.location.href = '/login.html';
}

// Display current user
const userDisplayName = document.getElementById('user-display-name');
if (currentUser && userDisplayName) {
    userDisplayName.textContent = currentUser.displayName || currentUser.username;
}

// Logout handler
document.getElementById('logout-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to exit the void?')) {
        localStorage.removeItem('voidUser');
        localStorage.removeItem('voidToken');
        window.location.href = '/login.html';
    }
});

// State
let allMatches = [];
let filteredMatches = [];
let currentPage = 1;
const matchesPerPage = 20;
let teams = [];

// Color generation
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function generateChampionColor(name) {
    if (!name) return 'hsl(0, 0%, 60%)';
    const hash = hashString(name);
    const hue = hash % 360;
    const saturation = 70 + (hash % 30);
    const lightness = 60 + (hash % 20);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Initialize
async function initialize() {
    try {
        // Fetch all matches
        const response = await fetch('/api/replays?limit=1000');
        const data = await response.json();

        if (!data.success) {
            throw new Error('Failed to fetch matches');
        }

        allMatches = data.replays || [];
        filteredMatches = [...allMatches];

        // Update total count
        document.getElementById('total-matches').textContent = allMatches.length;

        // Load teams for filter
        await loadTeams();

        // Display matches
        displayMatches();

        // Show table, hide loading
        document.getElementById('loading-container').style.display = 'none';
        document.getElementById('matches-table-container').style.display = 'block';
    } catch (error) {
        console.error('Error loading matches:', error);
        document.getElementById('loading-container').innerHTML = `
            <div class="error-message">
                <h2>Failed to Load Matches</h2>
                <p>${error.message}</p>
                <a href="/" class="btn-primary">Return to Home</a>
            </div>
        `;
    }
}

// Load teams for filter dropdown
async function loadTeams() {
    try {
        const response = await fetch('/api/teams');
        if (response.ok) {
            const data = await response.json();
            teams = data.teams || [];

            const teamFilter = document.getElementById('team-filter');
            teams.forEach(team => {
                const option = document.createElement('option');
                option.value = team.name;
                option.textContent = team.name;
                teamFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading teams:', error);
    }
}

// Display matches
function displayMatches() {
    const tbody = document.getElementById('matches-tbody');
    tbody.innerHTML = '';

    if (filteredMatches.length === 0) {
        document.getElementById('matches-table-container').style.display = 'none';
        document.getElementById('empty-state').style.display = 'flex';
        return;
    }

    document.getElementById('matches-table-container').style.display = 'block';
    document.getElementById('empty-state').style.display = 'none';

    // Calculate pagination
    const totalPages = Math.ceil(filteredMatches.length / matchesPerPage);
    const startIndex = (currentPage - 1) * matchesPerPage;
    const endIndex = Math.min(startIndex + matchesPerPage, filteredMatches.length);
    const pageMatches = filteredMatches.slice(startIndex, endIndex);

    // Update results count
    document.getElementById('results-count').textContent =
        `${filteredMatches.length} match${filteredMatches.length !== 1 ? 'es' : ''}`;

    // Render matches
    pageMatches.forEach(match => {
        const row = createMatchRow(match);
        tbody.appendChild(row);
    });

    // Update pagination
    updatePagination(totalPages);
}

// Create match row
function createMatchRow(match) {
    const tr = document.createElement('tr');
    tr.className = 'match-row';

    // Parse date
    const date = new Date(match.created_at);
    const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Colors for teams
    const team1Color = generateChampionColor(match.team1_name);
    const team2Color = generateChampionColor(match.team2_name);

    // Parse replay data for additional info
    let duration = 'N/A';
    let team1Score = 0;
    let team2Score = 0;

    try {
        const replayData = typeof match.replay_data === 'string'
            ? JSON.parse(match.replay_data)
            : match.replay_data;

        if (replayData.events && replayData.events.length > 0) {
            // Find max tick for duration
            const maxTick = Math.max(...replayData.events
                .filter(e => e.tick !== undefined)
                .map(e => e.tick));
            duration = `${maxTick} waves`;

            // Find final scores
            const endEvent = replayData.events.find(e => e.type === 'match.end');
            if (endEvent && endEvent.data) {
                team1Score = endEvent.data.team1?.kills || 0;
                team2Score = endEvent.data.team2?.kills || 0;
            }
        }
    } catch (error) {
        console.error('Error parsing replay data:', error);
    }

    // Winner styling
    const winnerClass = match.winner === match.team1_name ? 'winner-team1' : 'winner-team2';

    tr.innerHTML = `
        <td class="match-date">
            <div class="date-primary">${dateStr}</div>
            <div class="date-secondary">${timeStr}</div>
        </td>
        <td class="match-teams">
            <div class="team-vs">
                <span class="team-name ${match.winner === match.team1_name ? 'team-winner' : ''}"
                      style="color: ${team1Color};">
                    ${match.team1_name}
                </span>
                <span class="vs-text">vs</span>
                <span class="team-name ${match.winner === match.team2_name ? 'team-winner' : ''}"
                      style="color: ${team2Color};">
                    ${match.team2_name}
                </span>
            </div>
        </td>
        <td class="match-score">
            <span class="score-value">${team1Score} - ${team2Score}</span>
        </td>
        <td class="match-duration">
            ${duration}
        </td>
        <td class="match-winner ${winnerClass}">
            <span class="winner-name" style="color: ${generateChampionColor(match.winner)};">
                ${match.winner}
            </span>
        </td>
        <td class="match-actions">
            <a href="/replay.html?id=${match.id}" class="action-btn">
                <span class="btn-icon">▶️</span>
                <span class="btn-text">WATCH</span>
            </a>
        </td>
    `;

    // Make row clickable
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', (e) => {
        // Don't navigate if clicking the button
        if (!e.target.closest('.action-btn')) {
            window.location.href = `/replay.html?id=${match.id}`;
        }
    });

    return tr;
}

// Update pagination
function updatePagination(totalPages) {
    document.getElementById('current-page').textContent = currentPage;
    document.getElementById('total-pages').textContent = totalPages;

    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// Pagination handlers
document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        displayMatches();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

document.getElementById('next-page-btn').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredMatches.length / matchesPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayMatches();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

// Filter handlers
document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);

// Apply enter key to search
document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        applyFilters();
    }
});

document.getElementById('champion-filter').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        applyFilters();
    }
});

// Apply filters
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    const teamFilter = document.getElementById('team-filter').value;
    const championFilter = document.getElementById('champion-filter').value.toLowerCase().trim();
    const dateFilter = document.getElementById('date-filter').value;
    const resultFilter = document.getElementById('result-filter').value;

    filteredMatches = allMatches.filter(match => {
        // Search filter (team names)
        if (searchTerm) {
            const matchesSearch =
                match.team1_name.toLowerCase().includes(searchTerm) ||
                match.team2_name.toLowerCase().includes(searchTerm) ||
                match.winner.toLowerCase().includes(searchTerm);
            if (!matchesSearch) return false;
        }

        // Team filter
        if (teamFilter) {
            if (match.team1_name !== teamFilter && match.team2_name !== teamFilter) {
                return false;
            }
        }

        // Champion filter (search in replay data)
        if (championFilter) {
            try {
                const replayData = typeof match.replay_data === 'string'
                    ? JSON.parse(match.replay_data)
                    : match.replay_data;

                const hasChampion = replayData.events?.some(event => {
                    if (event.message) {
                        return event.message.toLowerCase().includes(championFilter);
                    }
                    return false;
                });

                if (!hasChampion) return false;
            } catch (error) {
                // Skip matches with invalid replay data
                return false;
            }
        }

        // Date filter
        if (dateFilter !== 'all') {
            const matchDate = new Date(match.created_at);
            const now = new Date();
            const dayInMs = 24 * 60 * 60 * 1000;

            switch (dateFilter) {
                case 'today':
                    if (now - matchDate > dayInMs) return false;
                    break;
                case 'week':
                    if (now - matchDate > 7 * dayInMs) return false;
                    break;
                case 'month':
                    if (now - matchDate > 30 * dayInMs) return false;
                    break;
            }
        }

        // Result filter
        if (resultFilter) {
            // This would need team context - skipping for now
            // Could be enhanced to filter by specific team wins/losses
        }

        return true;
    });

    // Reset to page 1
    currentPage = 1;
    displayMatches();
}

// Clear filters
function clearFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('team-filter').value = '';
    document.getElementById('champion-filter').value = '';
    document.getElementById('date-filter').value = 'all';
    document.getElementById('result-filter').value = '';

    filteredMatches = [...allMatches];
    currentPage = 1;
    displayMatches();
}

// Initialize on load
initialize();
