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

// Get champion name from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const championName = urlParams.get('name');

if (!championName) {
    alert('No champion specified');
    window.location.href = '/';
}

// Color generation (same as app.js)
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function generateChampionColor(championName) {
    if (!championName) return 'hsl(0, 0%, 60%)';
    const hash = hashString(championName);
    const hue = hash % 360;
    const saturation = 70 + (hash % 30);
    const lightness = 60 + (hash % 20);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Fetch champion data
async function fetchChampionData() {
    try {
        const response = await fetch(`/api/champions/${encodeURIComponent(championName)}`);
        if (!response.ok) {
            throw new Error('Champion not found');
        }
        const data = await response.json();
        displayChampionData(data);
    } catch (error) {
        console.error('Error fetching champion data:', error);
        document.getElementById('loading-container').innerHTML = `
            <div class="error-message">
                <h2>Champion Not Found</h2>
                <p>Could not load data for ${championName}</p>
                <a href="/" class="btn-primary">Return to Home</a>
            </div>
        `;
    }
}

// Display champion data
function displayChampionData(data) {
    const champion = data.champion;
    const careerStats = data.careerStats;
    const matchHistory = data.matchHistory;
    const grudges = data.grudges || [];
    const synergies = data.synergies || [];

    // Hide loading, show container
    document.getElementById('loading-container').style.display = 'none';
    document.getElementById('champion-container').style.display = 'block';

    // Set page title
    document.title = `${champion.name} - MOBA Network`;

    // Champion color
    const champColor = generateChampionColor(champion.name);

    // Header
    document.getElementById('champion-name').textContent = champion.name;
    document.getElementById('champion-name').style.color = champColor;

    const iconEl = document.getElementById('champion-icon');
    iconEl.textContent = champion.name.substring(0, 2).toUpperCase();
    iconEl.style.background = `linear-gradient(135deg, ${champColor}, ${champColor}dd)`;

    document.getElementById('champion-role').textContent = champion.role;
    document.getElementById('champion-lore').textContent = champion.lore || 'No lore available.';

    // Power curve badge
    const powerCurve = champion.power_curve || 'mid';
    const powerCurveEl = document.getElementById('champion-power-curve');
    powerCurveEl.textContent = `${powerCurve.toUpperCase()} GAME`;
    powerCurveEl.className = `champion-power-curve power-curve-${powerCurve}`;

    // Quick stats
    const gamesPlayed = careerStats.games_played || 0;
    const wins = careerStats.wins || 0;
    const losses = careerStats.losses || 0;
    const winRate = gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : 0;
    const totalKills = careerStats.total_kills || 0;
    const totalDeaths = careerStats.total_deaths || 0;
    const totalAssists = careerStats.total_assists || 0;
    const kdaRatio = totalDeaths > 0 ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : (totalKills + totalAssists).toFixed(2);

    document.getElementById('career-level').textContent = careerStats.career_level || 1;
    document.getElementById('win-rate').textContent = `${winRate}%`;
    document.getElementById('kda-ratio').textContent = kdaRatio;
    document.getElementById('form-value').textContent = `${(careerStats.form || 1.0).toFixed(2)}x`;

    // Apply form color
    const formValue = careerStats.form || 1.0;
    const formEl = document.getElementById('form-value');
    if (formValue > 1.2) {
        formEl.style.color = '#27ae60'; // Good form
    } else if (formValue < 0.8) {
        formEl.style.color = '#e74c3c'; // Bad form
    } else {
        formEl.style.color = '#f39c12'; // Neutral form
    }

    // Career stats
    document.getElementById('games-played').textContent = gamesPlayed;
    document.getElementById('win-loss').textContent = `${wins} / ${losses}`;
    document.getElementById('total-kills').textContent = totalKills;
    document.getElementById('total-deaths').textContent = totalDeaths;
    document.getElementById('total-assists').textContent = totalAssists;
    document.getElementById('avg-gold').textContent = (careerStats.avg_gold || 0).toLocaleString();
    document.getElementById('avg-cs').textContent = Math.floor(careerStats.avg_cs || 0);
    document.getElementById('career-xp').textContent = (careerStats.career_xp || 0).toLocaleString();

    // Abilities
    displayAbilities(champion.abilities);

    // Match history
    displayMatchHistory(matchHistory);

    // Grudges and synergies
    displayGrudges(grudges);
    displaySynergies(synergies);

    // Preferred build
    displayPreferredBuild(champion);

    // Achievements
    displayAchievements(careerStats);
}

// Display abilities
function displayAbilities(abilities) {
    const container = document.getElementById('abilities-container');
    if (!abilities || abilities.length === 0) {
        container.innerHTML = '<p class="empty-message">No abilities data available.</p>';
        return;
    }

    const abilityKeys = ['Q', 'W', 'E', 'R'];
    container.innerHTML = abilities.slice(0, 4).map((ability, idx) => `
        <div class="ability-card">
            <div class="ability-header">
                <div class="ability-key">${abilityKeys[idx]}</div>
                <div class="ability-info">
                    <div class="ability-name">${ability.name}</div>
                    <div class="ability-meta">
                        <span class="ability-cooldown">CD: ${ability.cooldown}s</span>
                        ${ability.manaCost ? `<span class="ability-mana">Mana: ${ability.manaCost}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="ability-description">${ability.flavor || 'No description available.'}</div>
            ${ability.damage ? `
                <div class="ability-damage">
                    <strong>Damage:</strong> ${ability.damage.base} + ${(ability.damage.scaling.ap || ability.damage.scaling.ad || 0) * 100}% ${ability.damage.scaling.ap ? 'AP' : 'AD'}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Display match history
function displayMatchHistory(matches) {
    const container = document.getElementById('match-history');
    if (!matches || matches.length === 0) {
        container.innerHTML = '<p class="empty-message">No match history available.</p>';
        return;
    }

    container.innerHTML = matches.slice(0, 10).map(match => {
        const won = match.won;
        const kda = match.kda || { kills: 0, deaths: 0, assists: 0 };
        const kdaRatio = kda.deaths > 0 ? ((kda.kills + kda.assists) / kda.deaths).toFixed(1) : (kda.kills + kda.assists).toFixed(1);

        return `
            <div class="match-card ${won ? 'match-won' : 'match-lost'}">
                <div class="match-result">${won ? 'VICTORY' : 'DEFEAT'}</div>
                <div class="match-details">
                    <div class="match-kda">
                        <span class="kda-label">KDA:</span>
                        <span class="kda-value">${kda.kills}/${kda.deaths}/${kda.assists}</span>
                        <span class="kda-ratio">(${kdaRatio})</span>
                    </div>
                    <div class="match-stats">
                        <span>💰 ${(match.gold || 0).toLocaleString()}g</span>
                        <span>CS: ${match.cs || 0}</span>
                        ${match.level ? `<span>Lv${match.level}</span>` : ''}
                    </div>
                </div>
                ${match.date ? `<div class="match-date">${new Date(match.date).toLocaleDateString()}</div>` : ''}
            </div>
        `;
    }).join('');
}

// Display grudges
function displayGrudges(grudges) {
    const container = document.getElementById('grudges-list');
    if (!grudges || grudges.length === 0) {
        container.innerHTML = '<p class="empty-message">No grudges yet.</p>';
        return;
    }

    container.innerHTML = grudges.map(grudge => {
        const intensity = (grudge.intensity || 0) * 100;
        const color = generateChampionColor(grudge.grudge_target_name);
        return `
            <div class="relationship-item">
                <div class="relationship-name" style="color: ${color};">${grudge.grudge_target_name}</div>
                <div class="relationship-stat">
                    <div class="relationship-bar">
                        <div class="relationship-fill grudge-fill" style="width: ${intensity}%"></div>
                    </div>
                    <span class="relationship-value">${intensity.toFixed(0)}%</span>
                </div>
                <div class="relationship-detail">
                    Killed by: ${grudge.times_killed_by || 0} | Killed: ${grudge.times_killed || 0}
                </div>
            </div>
        `;
    }).join('');
}

// Display synergies
function displaySynergies(synergies) {
    const container = document.getElementById('synergies-list');
    if (!synergies || synergies.length === 0) {
        container.innerHTML = '<p class="empty-message">No synergies yet.</p>';
        return;
    }

    container.innerHTML = synergies.map(synergy => {
        const strength = (synergy.strength || 0) * 100;
        const color = generateChampionColor(synergy.synergy_target_name);
        return `
            <div class="relationship-item">
                <div class="relationship-name" style="color: ${color};">${synergy.synergy_target_name}</div>
                <div class="relationship-stat">
                    <div class="relationship-bar">
                        <div class="relationship-fill synergy-fill" style="width: ${strength}%"></div>
                    </div>
                    <span class="relationship-value">${strength.toFixed(0)}%</span>
                </div>
                <div class="relationship-detail">
                    Games: ${synergy.games_together || 0} | Wins: ${synergy.wins_together || 0}
                </div>
            </div>
        `;
    }).join('');
}

// Display preferred build
function displayPreferredBuild(champion) {
    const container = document.getElementById('preferred-build');

    // Get build path from champion data
    const buildPath = champion.build_path || [];

    if (buildPath.length === 0) {
        container.innerHTML = '<p class="empty-message">No build data available.</p>';
        return;
    }

    container.innerHTML = `
        <div class="build-items">
            ${buildPath.map((itemId, idx) => `
                <div class="build-item">
                    <div class="build-item-number">${idx + 1}</div>
                    <div class="build-item-name">${formatItemName(itemId)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// Format item ID to readable name
function formatItemName(itemId) {
    return itemId.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Display achievements
function displayAchievements(careerStats) {
    const container = document.getElementById('achievements');

    const achievements = [];

    // Calculate achievements based on stats
    if (careerStats.games_played >= 10) {
        achievements.push({ icon: '🎮', name: 'Veteran', desc: 'Played 10+ games' });
    }
    if (careerStats.games_played >= 50) {
        achievements.push({ icon: '🏆', name: 'Champion', desc: 'Played 50+ games' });
    }
    if (careerStats.wins >= 25) {
        achievements.push({ icon: '⭐', name: 'Winner', desc: '25+ victories' });
    }
    if ((careerStats.form || 1.0) >= 1.3) {
        achievements.push({ icon: '🔥', name: 'On Fire', desc: 'High form rating' });
    }
    if (careerStats.career_level >= 10) {
        achievements.push({ icon: '📈', name: 'Experienced', desc: 'Career level 10+' });
    }
    if (careerStats.total_kills >= 100) {
        achievements.push({ icon: '⚔️', name: 'Killer', desc: '100+ total kills' });
    }
    if ((careerStats.total_kills + careerStats.total_assists) / Math.max(careerStats.total_deaths, 1) >= 3.0) {
        achievements.push({ icon: '💎', name: 'Elite', desc: 'KDA Ratio 3.0+' });
    }
    if (careerStats.void_touched) {
        achievements.push({ icon: '🌀', name: 'Void-Touched', desc: 'Consumed by the void' });
    }

    if (achievements.length === 0) {
        container.innerHTML = '<p class="empty-message">No achievements yet. Keep playing!</p>';
        return;
    }

    container.innerHTML = achievements.map(ach => `
        <div class="achievement-card">
            <div class="achievement-icon">${ach.icon}</div>
            <div class="achievement-info">
                <div class="achievement-name">${ach.name}</div>
                <div class="achievement-desc">${ach.desc}</div>
            </div>
        </div>
    `).join('');
}

// Load data on page load
fetchChampionData();
