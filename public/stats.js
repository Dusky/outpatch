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

// Tab switching
document.querySelectorAll('.stats-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        // Remove active from all tabs and content
        document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.stats-tab-content').forEach(c => c.classList.remove('active'));

        // Add active to clicked tab and content
        tab.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});

// Initialize
async function initialize() {
    try {
        // Fetch all data in parallel
        const [championsRes, matchesRes, teamsRes] = await Promise.all([
            fetch('/api/champions'),
            fetch('/api/replays?limit=1000'),
            fetch('/api/teams')
        ]);

        const championsData = await championsRes.json();
        const matchesData = await matchesRes.json();
        const teamsData = await teamsRes.json();

        const champions = championsData.champions || [];
        const matches = matchesData.replays || [];
        const teams = teamsData.teams || [];

        // Process and display data
        displayChampionLeaderboards(champions);
        displayTeamStats(teams, matches);
        displayItemStats(matches);
        displayChaosStats(matches);

        // Hide loading, show content
        document.getElementById('loading-container').style.display = 'none';
        document.getElementById('stats-container').style.display = 'block';
    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('loading-container').innerHTML = `
            <div class="error-message">
                <h2>Failed to Load Statistics</h2>
                <p>${error.message}</p>
                <a href="/" class="btn-primary">Return to Home</a>
            </div>
        `;
    }
}

// Display champion leaderboards
function displayChampionLeaderboards(champions) {
    // Filter champions with at least 1 game
    const activeChampions = champions.filter(c => c.games_played > 0);

    // KDA Leaderboard
    const kdaLeaderboard = activeChampions
        .map(c => ({
            ...c,
            kda: c.total_deaths > 0
                ? ((c.total_kills + c.total_assists) / c.total_deaths).toFixed(2)
                : (c.total_kills + c.total_assists).toFixed(2)
        }))
        .sort((a, b) => parseFloat(b.kda) - parseFloat(a.kda))
        .slice(0, 10);

    displayLeaderboard('leaderboard-kda', kdaLeaderboard, 'kda', (val) => val);

    // Kills Leaderboard
    const killsLeaderboard = [...activeChampions]
        .sort((a, b) => b.total_kills - a.total_kills)
        .slice(0, 10);

    displayLeaderboard('leaderboard-kills', killsLeaderboard, 'total_kills', (val) => val);

    // Gold Leaderboard
    const goldLeaderboard = [...activeChampions]
        .sort((a, b) => b.avg_gold - a.avg_gold)
        .slice(0, 10);

    displayLeaderboard('leaderboard-gold', goldLeaderboard, 'avg_gold', (val) => Math.floor(val).toLocaleString() + 'g');

    // Win Rate Leaderboard (min 5 games)
    const winRateLeaderboard = activeChampions
        .filter(c => c.games_played >= 5)
        .map(c => ({
            ...c,
            winRate: ((c.wins / c.games_played) * 100).toFixed(1)
        }))
        .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))
        .slice(0, 10);

    displayLeaderboard('leaderboard-winrate', winRateLeaderboard, 'winRate', (val) => val + '%');

    // CS Leaderboard
    const csLeaderboard = [...activeChampions]
        .sort((a, b) => b.avg_cs - a.avg_cs)
        .slice(0, 10);

    displayLeaderboard('leaderboard-cs', csLeaderboard, 'avg_cs', (val) => Math.floor(val));

    // Assists Leaderboard
    const assistsLeaderboard = [...activeChampions]
        .sort((a, b) => b.total_assists - a.total_assists)
        .slice(0, 10);

    displayLeaderboard('leaderboard-assists', assistsLeaderboard, 'total_assists', (val) => val);
}

// Display leaderboard
function displayLeaderboard(containerId, data, valueKey, formatter) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = data.map((item, idx) => {
        const color = generateChampionColor(item.champion_name);
        const value = formatter(item[valueKey]);

        return `
            <div class="leaderboard-item">
                <div class="leaderboard-rank">#${idx + 1}</div>
                <a href="/champion.html?name=${encodeURIComponent(item.champion_name)}" class="leaderboard-name" style="color: ${color};">
                    ${item.champion_name}
                </a>
                <div class="leaderboard-value">${value}</div>
                <div class="leaderboard-meta">${item.games_played} games</div>
            </div>
        `;
    }).join('');
}

// Display team stats
function displayTeamStats(teams, matches) {
    // Calculate team records
    const teamRecords = {};

    teams.forEach(team => {
        teamRecords[team.name] = {
            wins: 0,
            losses: 0,
            totalKills: 0,
            totalDeaths: 0,
            totalGames: 0
        };
    });

    matches.forEach(match => {
        if (!teamRecords[match.team1_name] || !teamRecords[match.team2_name]) return;

        const team1Won = match.winner === match.team1_name;

        if (team1Won) {
            teamRecords[match.team1_name].wins++;
            teamRecords[match.team2_name].losses++;
        } else {
            teamRecords[match.team2_name].wins++;
            teamRecords[match.team1_name].losses++;
        }

        teamRecords[match.team1_name].totalGames++;
        teamRecords[match.team2_name].totalGames++;

        // Parse replay for kills
        try {
            const replayData = typeof match.replay_data === 'string'
                ? JSON.parse(match.replay_data)
                : match.replay_data;

            const endEvent = replayData.events?.find(e => e.type === 'match.end');
            if (endEvent && endEvent.data) {
                teamRecords[match.team1_name].totalKills += endEvent.data.team1?.kills || 0;
                teamRecords[match.team1_name].totalDeaths += endEvent.data.team2?.kills || 0;
                teamRecords[match.team2_name].totalKills += endEvent.data.team2?.kills || 0;
                teamRecords[match.team2_name].totalDeaths += endEvent.data.team1?.kills || 0;
            }
        } catch (error) {
            // Skip invalid replay data
        }
    });

    // Display team performance
    const performanceContainer = document.getElementById('team-performance');
    if (performanceContainer) {
        performanceContainer.innerHTML = Object.entries(teamRecords)
            .filter(([_, record]) => record.totalGames > 0)
            .sort((a, b) => b[1].wins - a[1].wins)
            .map(([teamName, record]) => {
                const winRate = ((record.wins / record.totalGames) * 100).toFixed(1);
                const avgKills = (record.totalKills / record.totalGames).toFixed(1);
                const avgDeaths = (record.totalDeaths / record.totalGames).toFixed(1);
                const color = generateChampionColor(teamName);

                return `
                    <div class="team-stat-card">
                        <div class="team-stat-header">
                            <h3 class="team-stat-name" style="color: ${color};">${teamName}</h3>
                            <div class="team-stat-record">${record.wins}W - ${record.losses}L</div>
                        </div>
                        <div class="team-stat-body">
                            <div class="team-stat-item">
                                <span class="stat-label">Win Rate</span>
                                <span class="stat-value">${winRate}%</span>
                            </div>
                            <div class="team-stat-item">
                                <span class="stat-label">Avg Kills</span>
                                <span class="stat-value">${avgKills}</span>
                            </div>
                            <div class="team-stat-item">
                                <span class="stat-label">Avg Deaths</span>
                                <span class="stat-value">${avgDeaths}</span>
                            </div>
                            <div class="team-stat-item">
                                <span class="stat-label">Total Games</span>
                                <span class="stat-value">${record.totalGames}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
    }

    // Display head-to-head (simplified)
    const h2hContainer = document.getElementById('head-to-head');
    if (h2hContainer) {
        h2hContainer.innerHTML = `
            <div class="h2h-info">
                <p>Head-to-head matchups coming soon! Track rivalries between teams.</p>
            </div>
        `;
    }
}

// Display item stats
function displayItemStats(matches) {
    const itemStats = {};

    // Parse all matches for item data
    matches.forEach(match => {
        try {
            const replayData = typeof match.replay_data === 'string'
                ? JSON.parse(match.replay_data)
                : match.replay_data;

            const endEvent = replayData.events?.find(e => e.type === 'match.end');
            if (!endEvent || !endEvent.data || !endEvent.data.champions) return;

            const winner = match.winner;
            const team1Name = match.team1_name;

            endEvent.data.champions.forEach(champ => {
                if (!champ.items) return;

                const won = (champ.teamId === 'team1' && winner === team1Name) ||
                            (champ.teamId === 'team2' && winner !== team1Name);

                champ.items.forEach(itemId => {
                    if (!itemStats[itemId]) {
                        itemStats[itemId] = {
                            purchases: 0,
                            wins: 0,
                            losses: 0
                        };
                    }

                    itemStats[itemId].purchases++;
                    if (won) {
                        itemStats[itemId].wins++;
                    } else {
                        itemStats[itemId].losses++;
                    }
                });
            });
        } catch (error) {
            // Skip invalid replay data
        }
    });

    // Most purchased
    const mostPurchased = Object.entries(itemStats)
        .sort((a, b) => b[1].purchases - a[1].purchases)
        .slice(0, 10);

    displayItemLeaderboard('most-purchased-items', mostPurchased, 'purchases');

    // Highest win rate (min 10 purchases)
    const highestWinRate = Object.entries(itemStats)
        .filter(([_, stats]) => stats.purchases >= 10)
        .map(([itemId, stats]) => [
            itemId,
            {
                ...stats,
                winRate: ((stats.wins / stats.purchases) * 100).toFixed(1)
            }
        ])
        .sort((a, b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate))
        .slice(0, 10);

    displayItemLeaderboard('winrate-items', highestWinRate, 'winRate');

    // Items by role placeholder
    const roleContainer = document.getElementById('items-by-role');
    if (roleContainer) {
        roleContainer.innerHTML = `
            <div class="role-info">
                <p>Item analysis by role coming soon!</p>
            </div>
        `;
    }

    // Most expensive (placeholder - would need item price data)
    const expensiveContainer = document.getElementById('expensive-items');
    if (expensiveContainer) {
        expensiveContainer.innerHTML = `
            <div class="empty-leaderboard">
                <p>Price data coming soon!</p>
            </div>
        `;
    }
}

// Display item leaderboard
function displayItemLeaderboard(containerId, data, valueKey) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = data.map(([itemId, stats], idx) => {
        const itemName = formatItemName(itemId);
        const value = valueKey === 'winRate'
            ? stats[valueKey] + '%'
            : stats[valueKey];

        return `
            <div class="leaderboard-item">
                <div class="leaderboard-rank">#${idx + 1}</div>
                <div class="leaderboard-name">${itemName}</div>
                <div class="leaderboard-value">${value}</div>
                <div class="leaderboard-meta">${stats.purchases} purchases</div>
            </div>
        `;
    }).join('');
}

// Format item ID to name
function formatItemName(itemId) {
    return itemId.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Display chaos stats
function displayChaosStats(matches) {
    const chaosEvents = {};
    let totalChaos = 0;

    // Parse matches for chaos events
    matches.forEach(match => {
        try {
            const replayData = typeof match.replay_data === 'string'
                ? JSON.parse(match.replay_data)
                : match.replay_data;

            replayData.events?.forEach(event => {
                if (event.type && event.type.includes('chaos')) {
                    const eventName = event.type.replace('chaos.', '').replace(/_/g, ' ');

                    if (!chaosEvents[eventName]) {
                        chaosEvents[eventName] = {
                            count: 0,
                            matches: 0
                        };
                    }

                    chaosEvents[eventName].count++;
                    totalChaos++;
                }
            });
        } catch (error) {
            // Skip invalid replay data
        }
    });

    // Most frequent chaos
    const frequentChaos = Object.entries(chaosEvents)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);

    displayChaosLeaderboard('chaos-frequency', frequentChaos);

    // Impact (placeholder)
    const impactContainer = document.getElementById('chaos-impact');
    if (impactContainer) {
        impactContainer.innerHTML = `
            <div class="empty-leaderboard">
                <p>Chaos impact analysis coming soon!</p>
            </div>
        `;
    }

    // Global stats
    const globalContainer = document.getElementById('global-chaos-stats');
    if (globalContainer) {
        globalContainer.innerHTML = `
            <div class="global-stat-grid">
                <div class="global-stat-item">
                    <div class="global-stat-label">Total Chaos Events</div>
                    <div class="global-stat-value">${totalChaos}</div>
                </div>
                <div class="global-stat-item">
                    <div class="global-stat-label">Unique Event Types</div>
                    <div class="global-stat-value">${Object.keys(chaosEvents).length}</div>
                </div>
                <div class="global-stat-item">
                    <div class="global-stat-label">Avg Events/Match</div>
                    <div class="global-stat-value">${matches.length > 0 ? (totalChaos / matches.length).toFixed(1) : 0}</div>
                </div>
                <div class="global-stat-item">
                    <div class="global-stat-label">Chaos Factor</div>
                    <div class="global-stat-value">${Math.min(100, Math.floor((totalChaos / matches.length) * 10))}%</div>
                </div>
            </div>
        `;
    }

    // Timeline (placeholder canvas)
    const canvas = document.getElementById('chaos-timeline');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1a1d29';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#7a7f8f';
        ctx.font = '16px "Rajdhani", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Chaos timeline visualization coming soon!', canvas.width / 2, canvas.height / 2);
    }
}

// Display chaos leaderboard
function displayChaosLeaderboard(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = data.map(([eventName, stats], idx) => {
        return `
            <div class="leaderboard-item">
                <div class="leaderboard-rank">#${idx + 1}</div>
                <div class="leaderboard-name">${eventName}</div>
                <div class="leaderboard-value">${stats.count}</div>
                <div class="leaderboard-meta">occurrences</div>
            </div>
        `;
    }).join('');
}

// Initialize on load
initialize();
