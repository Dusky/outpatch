// Check authentication - redirect to login if not logged in
const voidUser = localStorage.getItem('voidUser');
let currentUser = null;
if (voidUser) {
    try {
        currentUser = JSON.parse(voidUser);
        console.log('Authenticated as:', currentUser.displayName || currentUser.username);
    } catch (e) {
        localStorage.removeItem('voidUser');
        localStorage.removeItem('voidToken');
        window.location.href = '/login.html';
    }
} else {
    // Redirect to login if not authenticated
    window.location.href = '/login.html';
}

// DOM Elements
const matchFeed = document.getElementById('match-feed');
const standingsList = document.getElementById('standings-list');
const rosterList = document.getElementById('roster-list');
const balanceSpan = document.getElementById('balance');
const teamSelect = document.getElementById('team-select');
const betForm = document.getElementById('bet-form');
const statusText = document.getElementById('status-text');
const countdownTimer = document.getElementById('countdown-timer');
const newsFeedDiv = document.getElementById('news-feed');
const tickerContent = document.getElementById('ticker-content');
const matchTitle = document.getElementById('match-title');
const weatherDisplay = document.getElementById('weather-display');
const oddsDisplay = document.getElementById('odds-display');
const potentialWinDiv = document.getElementById('potential-win');
const potentialWinAmount = document.getElementById('potential-win-amount');
const userDisplayName = document.getElementById('user-display-name');
const logoutBtn = document.getElementById('logout-btn');

// Match status elements
const matchStatusBar = document.getElementById('match-status-bar');
const currentWaveEl = document.getElementById('current-wave');
const maxWavesEl = document.getElementById('max-waves');
const matchTimerEl = document.getElementById('match-timer');

// Tab elements
const matchTab = document.getElementById('match-tab');
const newsTab = document.getElementById('news-tab');

let currentMatchId = null;
let currentOdds = { team1: 2.0, team2: 2.0 };

// Color mapping for teams and champions
let teamColorMap = {}; // { "Team Name": "rgba(...)" }
let championColorMap = {}; // { "Champion Name": "#hexcolor" }
let championTeamMap = {}; // { "Champion Name": "Team Name" }
let currentMatchTeams = { team1: null, team2: null }; // Track current match teams

// Display current user
if (currentUser && userDisplayName) {
    const displayText = currentUser.displayName || currentUser.username;
    const adminBadge = currentUser.isAdmin ? ' [ADMIN]' : '';
    userDisplayName.textContent = displayText + adminBadge;

    // Add admin styling and show admin link if user is admin
    if (currentUser.isAdmin) {
        userDisplayName.style.color = '#f39c12';
        userDisplayName.style.fontWeight = '700';

        const adminLink = document.getElementById('admin-link');
        if (adminLink) {
            adminLink.style.display = 'inline';
        }
    }
}

// Logout button handler
logoutBtn?.addEventListener('click', () => {
    if (confirm('Are you sure you want to exit the void?')) {
        localStorage.removeItem('voidUser');
        localStorage.removeItem('voidToken');
        window.location.href = '/login.html';
    }
});

// Collapse functionality
const standingsCollapse = document.getElementById('standings-collapse');
const rostersCollapse = document.getElementById('rosters-collapse');
const statsCollapse = document.getElementById('stats-collapse');
const standingsContent = document.getElementById('standings-content');
const rostersContent = document.getElementById('rosters-content');
const statsContent = document.getElementById('stats-content');

let tickerMessages = [
    'WELCOME TO THE VOID MOBA NETWORK',
    'WHERE CHAMPIONS BECOME L̴̰͌E̷̳̿G̷̰̈Ė̶̮N̷̳͝D̵̰̓S̷̳̈',
    'REALITY IS OPTIONAL',
    'CORPORATE SPONSORSHIP BY THE V̴̢̛̙͂O̴̰̓Ì̴̳D̵̰̿',
    'ALL MATCHES SUBJECT TO CHAOS',
    'BET RESPONSIBLY. OR DON\'T. WE\'RE NOT YOUR MOM.',
    'STATISTICS MAY LIE. ACCEPT THIS.',
    'THE VOID SEES ALL. THE VOID KNOWS ALL.',
    'SPIRES FALL. CORES CRUMBLE. CHAOS REIGNS.',
    'THE MONOLITH HUNGERS FOR CONFLICT',
    'PRISMS REFRACT YOUR DEEPEST FEARS',
    'GATEWAYS GUARD THE ANCIENT SECRETS',
    'SANCTUARY OFFERS NO SALVATION',
    'THE MINIONS KNOW WHAT YOU DID',
    'SPACE BENDS. TIME STUTTERS. REALITY SHIFTS.',
    'CLARITY AND EMBER DANCE IN THE VOID',
];

// Collapse button handlers
standingsCollapse?.addEventListener('click', () => {
    const isCollapsed = standingsContent.style.display === 'none';
    standingsContent.style.display = isCollapsed ? 'block' : 'none';
    standingsCollapse.textContent = isCollapsed ? '▼' : '▲';
});

rostersCollapse?.addEventListener('click', () => {
    const isCollapsed = rostersContent.style.display === 'none';
    rostersContent.style.display = isCollapsed ? 'block' : 'none';
    rostersCollapse.textContent = isCollapsed ? '▼' : '▲';
});

statsCollapse?.addEventListener('click', () => {
    const isCollapsed = statsContent.style.display === 'none';
    statsContent.style.display = isCollapsed ? 'block' : 'none';
    statsCollapse.textContent = isCollapsed ? '▼' : '▲';
});

const socket = new WebSocket('ws://' + window.location.host);

socket.addEventListener('open', (event) => {
    console.log('Connected to WebSocket server');

    // Authenticate with the server if user is logged in
    if (currentUser && currentUser.id) {
        socket.send(JSON.stringify({
            type: 'auth',
            userId: currentUser.id
        }));
    } else {
        socket.send('Hello Server!');
    }
});

socket.addEventListener('message', (event) => {
    const message = event.data;
    try {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.type === 'auth_success') {
            console.log('Authentication successful!');
            balanceSpan.textContent = parsedMessage.balance;
            // Update display name if available
            if (parsedMessage.displayName) {
                currentUser.displayName = parsedMessage.displayName;
            }
        } else if (parsedMessage.type === 'auth_failed') {
            console.error('Authentication failed:', parsedMessage.message);
            showNotification('Authentication failed. Logging out...', 'error');
            setTimeout(() => {
                localStorage.removeItem('voidUser');
                localStorage.removeItem('voidToken');
                window.location.href = '/login.html';
            }, 2000);
        } else if (parsedMessage.type === 'standings') {
            updateStandings(parsedMessage.data);
        } else if (parsedMessage.type === 'bet_ack') {
            if (parsedMessage.success) {
                balanceSpan.textContent = parsedMessage.newBalance;
                showNotification('Bet placed successfully!', 'success');
            } else {
                showNotification(`Bet failed: ${parsedMessage.message}`, 'error');
            }
        } else if (parsedMessage.type === 'teams') {
            populateTeamSelect(parsedMessage.data);
        } else if (parsedMessage.type === 'full_teams') {
            displayRosters(parsedMessage.data);
        } else if (parsedMessage.type === 'game_state') {
            handleGameState(parsedMessage);
        } else if (parsedMessage.type === 'news') {
            displayNews(parsedMessage.data);
        } else if (parsedMessage.type === 'stats_update') {
            updateStatsDisplay(parsedMessage.leaderboards, parsedMessage.globalStats);
        } else if (parsedMessage.type === 'weather_update') {
            updateWeatherDisplay(parsedMessage.weather);
        } else if (parsedMessage.type === 'betting_odds') {
            updateOddsDisplay(parsedMessage);
        } else if (parsedMessage.type === 'bet_results') {
            showBetResults(parsedMessage);
        } else if (parsedMessage.type === 'match_status') {
            updateMatchStatus(parsedMessage);
        } else if (parsedMessage.type === 'admin_message') {
            showNotification(parsedMessage.message, 'info');
        } else if (parsedMessage.type === 'season_status') {
            updateSeasonStatus(parsedMessage);
        } else if (parsedMessage.type === 'practice_match_start') {
            addToMatchFeed(parsedMessage.message, 'announcement');
        } else if (parsedMessage.type === 'practice_match_end') {
            addToMatchFeed(parsedMessage.message, 'announcement');
        } else if (parsedMessage.type === 'playoff_match_start') {
            addToMatchFeed(parsedMessage.message, 'announcement');
        } else if (parsedMessage.type === 'finals_match_start') {
            addToMatchFeed(parsedMessage.message, 'announcement');
        } else {
            // Only log if it's not a known type that should be ignored
            // This prevents countdown spam from appearing in feeds
            console.log('Unhandled message type:', parsedMessage.type);
        }
    } catch (e) {
        // If it's not JSON, assume it's a plain text log message
        addToMatchFeed(message);
    }
});

socket.addEventListener('close', (event) => {
    console.log('Disconnected from WebSocket server');
});

betForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const selectedTeam = teamSelect.value;
    const betAmount = parseInt(document.getElementById('bet-amount').value);
    // Basic validation
    if (!selectedTeam || isNaN(betAmount) || betAmount <= 0) {
        showNotification('Invalid bet', 'error');
        return;
    }

    const betData = {
        type: 'bet',
        team: selectedTeam,
        amount: betAmount
    };

    // Include matchId if available
    if (currentMatchId) {
        betData.matchId = currentMatchId;
    }

    socket.send(JSON.stringify(betData));
});

// Update potential win when amount changes
document.getElementById('bet-amount').addEventListener('input', (event) => {
    const amount = parseInt(event.target.value);
    const selectedTeam = teamSelect.value;

    if (amount > 0 && selectedTeam && currentMatchId) {
        // Determine which odds to use
        const team1Name = document.getElementById('odds-team1')?.textContent;
        const odds = selectedTeam === team1Name ? currentOdds.team1 : currentOdds.team2;
        const potentialWin = Math.floor(amount * odds);

        if (potentialWinDiv && potentialWinAmount) {
            potentialWinDiv.style.display = 'block';
            potentialWinAmount.textContent = `${potentialWin}⌬`;
        }
    } else {
        if (potentialWinDiv) {
            potentialWinDiv.style.display = 'none';
        }
    }
});

function updateStandings(standings) {
    standingsList.innerHTML = '';
    standings.forEach(team => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${team.name}</td>
            <td>${team.wins}</td>
            <td>${team.losses}</td>
        `;
        standingsList.appendChild(tr);
    });
}

function populateTeamSelect(teams) {
    teamSelect.innerHTML = ''; // Clear existing options
    teams.forEach(teamName => {
        const option = document.createElement('option');
        option.value = teamName;
        option.textContent = teamName;
        teamSelect.appendChild(option);
    });
}

// ==================== COLOR GENERATION ====================

/**
 * Generate a consistent hash from a string
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/**
 * Generate a semi-transparent team background color
 */
function generateTeamColor(teamName) {
    const hash = hashString(teamName);
    const hue = hash % 360;
    const saturation = 40 + (hash % 30); // 40-70%
    const lightness = 25 + (hash % 15); // 25-40%
    const alpha = 0.15; // Subtle background

    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
}

/**
 * Generate a bright, readable champion text color
 */
function generateChampionColor(championName) {
    const hash = hashString(championName);
    const hue = hash % 360;
    const saturation = 70 + (hash % 30); // 70-100%
    const lightness = 60 + (hash % 20); // 60-80%

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Build color maps from team data
 */
function buildColorMaps(teams) {
    teamColorMap = {};
    championColorMap = {};
    championTeamMap = {};

    teams.forEach(team => {
        // Generate team color
        teamColorMap[team.name] = generateTeamColor(team.name);

        // Generate colors for each champion
        team.champions.forEach(champ => {
            championColorMap[champ.name] = generateChampionColor(champ.name);
            championTeamMap[champ.name] = team.name;
        });
    });

    console.log('Color maps built:', Object.keys(championColorMap).length, 'champions');
}

/**
 * Colorize a message by wrapping champion and team names in colored spans
 */
function colorizeMessage(message) {
    if (Object.keys(championColorMap).length === 0) {
        return message; // No colors loaded yet
    }

    let colorizedMessage = message;

    // Sort champion names by length (longest first) to avoid partial matches
    const championNames = Object.keys(championColorMap).sort((a, b) => b.length - a.length);

    // Replace each champion name with colored span
    championNames.forEach(champName => {
        const color = championColorMap[champName];
        const regex = new RegExp(`\\b(${champName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'g');
        colorizedMessage = colorizedMessage.replace(
            regex,
            `<span style="color: ${color}; font-weight: 600; text-shadow: 0 0 8px ${color}40;">$1</span>`
        );
    });

    // Also colorize team names in objectives/structure events
    Object.keys(teamColorMap).forEach(teamName => {
        const color = teamColorMap[teamName];
        const regex = new RegExp(`\\b(${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'g');
        colorizedMessage = colorizedMessage.replace(
            regex,
            `<span style="color: ${generateChampionColor(teamName)}; font-weight: 700;">$1</span>`
        );
    });

    return colorizedMessage;
}

/**
 * Determine which team a message is about (for background coloring)
 */
function getMessageTeamAffiliation(message) {
    // Check if any champion from a team is mentioned
    for (const [champName, teamName] of Object.entries(championTeamMap)) {
        if (message.includes(champName)) {
            return teamName;
        }
    }

    // Check if team name is directly mentioned
    for (const teamName of Object.keys(teamColorMap)) {
        if (message.includes(teamName)) {
            return teamName;
        }
    }

    return null; // Neutral message
}

// ==================== DISPLAY FUNCTIONS ====================

function displayRosters(teams) {
    // Build color maps when teams are loaded
    buildColorMaps(teams);

    rosterList.innerHTML = '';
    teams.forEach(team => {
        const teamDiv = document.createElement('div');
        teamDiv.className = 'roster-team';

        const teamNameDiv = document.createElement('div');
        teamNameDiv.className = 'roster-team-name';
        teamNameDiv.textContent = team.name;
        teamDiv.appendChild(teamNameDiv);

        team.champions.forEach(champ => {
            const champDiv = document.createElement('div');
            champDiv.className = 'roster-champion';
            champDiv.innerHTML = `
                <span class="champion-name">${champ.name}</span>
                <span class="champion-role"> (${champ.role})</span><br>
                <small>KDA: ${champ.kda.k}/${champ.kda.d}/${champ.kda.a} | CS: ${champ.cs}</small>
            `;
            champDiv.title = champ.lore; // Show lore on hover
            teamDiv.appendChild(champDiv);
        });

        rosterList.appendChild(teamDiv);
    });
}

function handleGameState(gameState) {
    if (gameState.state === 'countdown') {
        statusText.textContent = 'COUNTDOWN TO CHAOS';
        updateCountdownDisplay(gameState.countdown);
    } else if (gameState.state === 'in_progress') {
        statusText.textContent = 'MATCH IN PROGRESS';
        matchFeed.innerHTML = ''; // Clear previous match feed
    }
}

function updateCountdownDisplay(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    countdownTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function displayNews(newsItems) {
    newsFeedDiv.innerHTML = '';
    newsItems.forEach(item => {
        const newsDiv = document.createElement('div');
        newsDiv.classList.add('news-item');
        const textSpan = document.createElement('span');
        textSpan.classList.add('news-item-text');
        textSpan.textContent = item;
        newsDiv.appendChild(textSpan);
        newsFeedDiv.appendChild(newsDiv);
    });
}

function addToMatchFeed(message, type = null) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('match-event');

    // Auto-detect type from message content if not provided
    if (!type) {
        type = detectEventType(message);
    }

    // Add type-specific class
    if (type) {
        messageElement.classList.add(`match-event-${type}`);
    }

    // Determine team affiliation and add background color
    const teamAffiliation = getMessageTeamAffiliation(message);
    if (teamAffiliation && teamColorMap[teamAffiliation]) {
        messageElement.style.background = teamColorMap[teamAffiliation];
        messageElement.setAttribute('data-team', teamAffiliation);
    }

    // Add timestamp
    const timestamp = document.createElement('span');
    timestamp.classList.add('match-event-timestamp');
    const now = new Date();
    timestamp.textContent = `[${now.toLocaleTimeString('en-US', { hour12: false })}]`;
    messageElement.appendChild(timestamp);

    // Add message content with colorized champion/team names
    const content = document.createElement('span');
    content.classList.add('match-event-content');
    content.innerHTML = colorizeMessage(message); // Use innerHTML for colored spans
    messageElement.appendChild(content);

    // Add with fade-in animation
    messageElement.style.opacity = '0';
    matchFeed.appendChild(messageElement);

    // Trigger animation
    requestAnimationFrame(() => {
        messageElement.style.transition = 'opacity 0.3s ease-in';
        messageElement.style.opacity = '1';
    });

    // Auto-scroll to bottom
    matchFeed.scrollTop = matchFeed.scrollHeight;

    // Keep feed size manageable (limit to 100 messages)
    while (matchFeed.children.length > 100) {
        matchFeed.removeChild(matchFeed.firstChild);
    }
}

function detectEventType(message) {
    // Detect event type based on message patterns
    if (message.includes('🎮') || message.includes('EXHIBITION') || message.includes('MATCH') && message.includes('vs')) {
        return 'announcement';
    }
    if (message.includes('🏆') || message.includes('WINS')) {
        return 'victory';
    }
    if (message.includes('Wave') || message.includes('---')) {
        return 'wave';
    }
    if (message.includes('💀') || message.includes('eliminated') || message.includes('⚔️') || message.includes('TEAMFIGHT')) {
        return 'combat';
    }
    if (message.includes('✅') || message.includes('secured') || message.includes('🔥') || message.includes('STOLE') || message.includes('📍') || message.includes('🏗️')) {
        return 'objective';
    }
    if (message.includes('purchased') || message.includes('gold') || message.includes('cleared') || message.includes('CS')) {
        return 'economy';
    }
    if (message.includes('😤') || message.includes('💥') || message.includes('tilting') || message.includes('boomed')) {
        return 'mental';
    }

    // Default to standard if no pattern matches
    return 'standard';
}

function showNotification(message, type) {
    // Simple notification replacement for alert()
    // You can enhance this with a custom notification UI
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? 'var(--accent-normal)' : 'var(--glitch-red)'};
        color: var(--bg-primary);
        font-family: var(--font-primary);
        font-weight: 700;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        z-index: 10000;
        animation: slide-in 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slide-out 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function updateTicker() {
    const randomIndex = Math.floor(Math.random() * tickerMessages.length);
    const newMessage = tickerMessages[randomIndex];

    // Add random chaos messages
    if (Math.random() < 0.3) {
        const chaosMessages = [
            `GAME ${Math.floor(Math.random() * 999)} DELAYED DUE TO VOID INTERFERENCE`,
            `CHAMPION "${['Jessica Telephone', 'The Void Accountants', 'xXx_DeathLord_xXx'][Math.floor(Math.random() * 3)]}" EXPERIENCING EXISTENTIAL CRISIS`,
            `MATCH RESULT UNDER REVIEW BY T̴̨̛̙H̴̰̓E̴̳͝ C̵̰̿Ö̵̳M̴̰͌M̴̳̿Ḭ̵̈T̴̳͝T̵̰̓Ë̴̳Ḛ̵̿`,
            `BET ODDS FLUCTUATING WILDLY. THIS IS NORMAL.`,
            `YOUR FAVORITE TEAM MAY NOT EXIST ANYMORE`,
        ];
        tickerMessages.push(chaosMessages[Math.floor(Math.random() * chaosMessages.length)]);
    }

    // Rebuild ticker content
    tickerContent.innerHTML = '';
    tickerMessages.forEach((msg, idx) => {
        const span = document.createElement('span');
        span.className = 'ticker-item';
        span.textContent = msg;
        tickerContent.appendChild(span);

        if (idx < tickerMessages.length - 1) {
            const separator = document.createElement('span');
            separator.className = 'ticker-separator';
            separator.textContent = '⬥';
            tickerContent.appendChild(separator);
        }
    });
}

function updateOddsDisplay(oddsData) {
    currentMatchId = oddsData.matchId;
    currentOdds = {
        team1: parseFloat(oddsData.team1Odds),
        team2: parseFloat(oddsData.team2Odds)
    };

    // Show odds display
    if (oddsDisplay) {
        oddsDisplay.style.display = 'block';

        document.getElementById('odds-team1').textContent = oddsData.team1;
        document.getElementById('odds-team1-value').textContent = `${oddsData.team1Odds}x`;
        document.getElementById('odds-team2').textContent = oddsData.team2;
        document.getElementById('odds-team2-value').textContent = `${oddsData.team2Odds}x`;

        const totalPool = oddsData.team1Pool + oddsData.team2Pool;
        document.getElementById('total-pool').textContent = `${totalPool}⌬`;

        if (oddsData.locked) {
            oddsDisplay.style.borderColor = 'var(--glitch-red)';
            document.querySelector('.odds-title').textContent = 'BETTING LOCKED';
        }
    }
}

function showBetResults(results) {
    if (results.yourPayout) {
        const message = `WINNER: ${results.winner}! You won ${results.yourPayout.payout}⌬ (Profit: +${results.yourPayout.profit}⌬)`;
        showNotification(message, 'success');
    } else {
        showNotification(`Match ended. Winner: ${results.winner}`, 'error');
    }
}

function updateMatchStatus(statusData) {
    const matchStatusBar = document.getElementById('match-status-bar');
    const matchTitle = document.getElementById('match-title');
    const currentWaveEl = document.getElementById('current-wave');
    const maxWavesEl = document.getElementById('max-waves');
    const matchTimerEl = document.getElementById('match-timer');
    const waveProgressFill = document.getElementById('wave-progress-fill');

    // Kill count elements
    const team1KillsEl = document.getElementById('team1-kills');
    const team2KillsEl = document.getElementById('team2-kills');

    // Gold elements
    const team1GoldEl = document.getElementById('team1-gold');
    const team2GoldEl = document.getElementById('team2-gold');
    const goldDiffEl = document.getElementById('gold-diff');

    // Detailed structure elements
    const team1SpiresEl = document.getElementById('team1-spires');
    const team1GatewaysEl = document.getElementById('team1-gateways');
    const team1CoreEl = document.getElementById('team1-core');
    const team2SpiresEl = document.getElementById('team2-spires');
    const team2GatewaysEl = document.getElementById('team2-gateways');
    const team2CoreEl = document.getElementById('team2-core');

    if (!matchStatusBar) return;

    // Show the status bar when match starts
    matchStatusBar.style.display = 'block';

    // Update match title with team names
    if (matchTitle && statusData.team1Name && statusData.team2Name) {
        matchTitle.textContent = `${statusData.team1Name} vs ${statusData.team2Name}`;
    }

    // Update wave info
    if (currentWaveEl) currentWaveEl.textContent = statusData.wave || 0;
    if (maxWavesEl) maxWavesEl.textContent = statusData.maxWaves || 150;

    // Update timer
    if (matchTimerEl) matchTimerEl.textContent = statusData.elapsedTime || '0:00';

    // Update kill counts
    if (team1KillsEl) team1KillsEl.textContent = statusData.team1Kills || 0;
    if (team2KillsEl) team2KillsEl.textContent = statusData.team2Kills || 0;

    // Update gold amounts
    if (statusData.team1Gold !== undefined && statusData.team2Gold !== undefined) {
        const gold1 = statusData.team1Gold;
        const gold2 = statusData.team2Gold;
        const goldDiff = gold1 - gold2;

        if (team1GoldEl) team1GoldEl.textContent = gold1.toLocaleString();
        if (team2GoldEl) team2GoldEl.textContent = gold2.toLocaleString();

        if (goldDiffEl) {
            if (goldDiff > 0) {
                goldDiffEl.textContent = `+${goldDiff.toLocaleString()}`;
                goldDiffEl.className = 'gold-diff positive';
            } else if (goldDiff < 0) {
                goldDiffEl.textContent = goldDiff.toLocaleString();
                goldDiffEl.className = 'gold-diff negative';
            } else {
                goldDiffEl.textContent = '0';
                goldDiffEl.className = 'gold-diff';
            }
        }
    }

    // Update detailed structure counts
    if (statusData.team1 && statusData.team2) {
        if (team1SpiresEl) team1SpiresEl.textContent = statusData.team1.spires || 0;
        if (team1GatewaysEl) team1GatewaysEl.textContent = statusData.team1.gateways || 0;
        if (team1CoreEl) team1CoreEl.textContent = statusData.team1.core || 0;
        if (team2SpiresEl) team2SpiresEl.textContent = statusData.team2.spires || 0;
        if (team2GatewaysEl) team2GatewaysEl.textContent = statusData.team2.gateways || 0;
        if (team2CoreEl) team2CoreEl.textContent = statusData.team2.core || 0;
    }

    // Update progress bar
    if (waveProgressFill && statusData.wave && statusData.maxWaves) {
        const progress = (statusData.wave / statusData.maxWaves) * 100;
        waveProgressFill.style.width = `${progress}%`;
    }

    // Update live champion stats if available
    if (statusData.champions) {
        updateLiveChampionStats(statusData.champions);
        updateRosterWithLiveStats(statusData.champions);
    }
}

function updateLiveChampionStats(champions) {
    const statsContainer = document.getElementById('stats-container');
    if (!statsContainer || !champions || champions.length === 0) return;

    // Role order and icons
    const roleOrder = { 'Top': 0, 'Jungle': 1, 'Mid': 2, 'ADC': 3, 'Support': 4 };
    const roleIcons = {
        'Top': '⚔️',
        'Jungle': '🌲',
        'Mid': '⚡',
        'ADC': '🏹',
        'Support': '🛡️'
    };

    // Group champions by team
    const team1Champs = champions.filter(c => c.teamId === 'team1').sort((a, b) =>
        (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99)
    );
    const team2Champs = champions.filter(c => c.teamId === 'team2').sort((a, b) =>
        (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99)
    );

    // Build HTML
    let html = '<div class="live-champion-stats">';

    // Team 1 Section
    html += '<div class="team-stats-section team1-section">';
    html += '<h4 class="team-stats-header">TEAM 1</h4>';
    team1Champs.forEach(champ => {
        html += buildChampionCard(champ, roleIcons);
    });
    html += '</div>';

    // Team 2 Section
    html += '<div class="team-stats-section team2-section">';
    html += '<h4 class="team-stats-header">TEAM 2</h4>';
    team2Champs.forEach(champ => {
        html += buildChampionCard(champ, roleIcons);
    });
    html += '</div>';

    html += '</div>';

    statsContainer.innerHTML = html;
}

function buildChampionCard(champ, roleIcons) {
    const kda = champ.kda || { kills: 0, deaths: 0, assists: 0 };
    const kdaRatio = kda.deaths === 0 ? kda.kills + kda.assists : ((kda.kills + kda.assists) / kda.deaths).toFixed(1);
    const gold = champ.gold || 0;
    const cs = champ.cs || 0;
    const level = champ.level || 1;
    const roleIcon = roleIcons[champ.role] || '❓';

    // Get first 3 items
    const items = (champ.items || []).slice(0, 3);
    const itemsHtml = items.length > 0
        ? items.map(item => `<span class="champion-item">${item}</span>`).join('')
        : '<span class="champion-item-empty">No items</span>';

    // Tilt indicator (optional personality touch)
    const tilt = champ.tilt || 0;
    let tiltIndicator = '';
    if (tilt > 0.7) {
        tiltIndicator = '<span class="tilt-indicator high">😤</span>';
    } else if (tilt > 0.4) {
        tiltIndicator = '<span class="tilt-indicator medium">😐</span>';
    }

    return `
        <div class="champion-card">
            <div class="champion-header">
                <span class="champion-role">${roleIcon}</span>
                <span class="champion-name">${champ.name}</span>
                <span class="champion-level">Lv${level}</span>
                ${tiltIndicator}
            </div>
            <div class="champion-stats-grid">
                <div class="stat-item">
                    <span class="stat-label">KDA</span>
                    <span class="stat-value">${kda.kills}/${kda.deaths}/${kda.assists}</span>
                    <span class="stat-ratio">(${kdaRatio})</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">💰</span>
                    <span class="stat-value">${gold.toLocaleString()}g</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">CS</span>
                    <span class="stat-value">${cs}</span>
                </div>
            </div>
            <div class="champion-items">
                ${itemsHtml}
            </div>
        </div>
    `;
}

function updateRosterWithLiveStats(champions) {
    if (!rosterList || !champions || champions.length === 0) return;

    // Find all roster champion elements and update their stats
    const rosterChampions = rosterList.querySelectorAll('.roster-champion');

    rosterChampions.forEach(champElement => {
        const nameElement = champElement.querySelector('.champion-name');
        if (!nameElement) return;

        const championName = nameElement.textContent.trim();

        // Find matching champion in live stats
        const liveChamp = champions.find(c => c.name === championName);
        if (!liveChamp) return;

        // Update the stats display
        const statsElement = champElement.querySelector('small');
        if (statsElement && liveChamp.kda) {
            const kda = liveChamp.kda;
            const cs = liveChamp.cs || 0;
            const gold = liveChamp.gold || 0;

            // Highlight updated stats with a subtle color
            statsElement.innerHTML = `<span style="color: var(--accent-primary);">KDA: ${kda.kills}/${kda.deaths}/${kda.assists} | CS: ${cs} | Gold: ${gold.toLocaleString()}g</span>`;

            // Add a subtle pulse animation
            champElement.style.animation = 'stat-update-pulse 0.5s ease';
            setTimeout(() => {
                champElement.style.animation = '';
            }, 500);
        }
    });
}

function updateSeasonStatus(statusData) {
    // Update the status text at the top of the page
    const phaseLabels = {
        'PRE_SEASON': 'PRE-SEASON',
        'REGULAR_SEASON': 'REGULAR SEASON',
        'PLAYOFF': 'PLAYOFFS',
        'FINALS': 'FINALS',
        'OFF_SEASON': 'OFF-SEASON',
        'PAUSED': 'PAUSED'
    };

    const phaseLabel = phaseLabels[statusData.phase] || statusData.phase;

    // Update status text with more detailed information
    if (statusText) {
        let statusMessage = '';

        if (statusData.isMatchInProgress) {
            // During match - show what type and how many
            if (statusData.matchesScheduled > 1) {
                statusMessage = `${phaseLabel} - ${statusData.matchesScheduled} MATCHES IN PROGRESS`;
            } else {
                statusMessage = `${phaseLabel} - MATCH IN PROGRESS`;
            }
        } else {
            // Between matches - show more context
            switch (statusData.phase) {
                case 'PRE_SEASON':
                    statusMessage = '◈ PRE-SEASON TRAINING ◈';
                    break;
                case 'REGULAR_SEASON':
                    if (statusData.week && statusData.day) {
                        statusMessage = `REGULAR SEASON - WEEK ${statusData.week} DAY ${statusData.day}`;
                    } else {
                        statusMessage = 'REGULAR SEASON - AWAITING MATCHUPS';
                    }
                    break;
                case 'PLAYOFF':
                    statusMessage = '⚔️ PLAYOFF BRACKET ACTIVE ⚔️';
                    break;
                case 'FINALS':
                    statusMessage = '👑 GRAND FINALS 👑';
                    break;
                case 'OFF_SEASON':
                    statusMessage = '◈ OFF-SEASON - CHAMPIONS RESTING ◈';
                    break;
                case 'PAUSED':
                    statusMessage = '◈ NETWORK STANDBY ◈';
                    break;
                default:
                    statusMessage = phaseLabel;
            }
        }

        statusText.textContent = statusMessage;
    }

    // Show/hide countdown timer based on match state
    if (countdownTimer) {
        if (statusData.isMatchInProgress) {
            countdownTimer.style.display = 'none';
        } else {
            countdownTimer.style.display = 'block';
            // The countdown timer will be updated separately by countdown messages
        }
    }
}

function updateWeatherDisplay(weather) {
    if (!weather || !weatherDisplay) return;

    // Update weather text
    weatherDisplay.textContent = `${weather.icon} ${weather.name.toUpperCase()}`;

    // Update weather color
    if (weather.color) {
        weatherDisplay.style.color = weather.color;
        weatherDisplay.style.textShadow = `0 0 10px ${weather.color}`;
    }

    // Add weather forecast to ticker
    if (weather.forecast && weather.forecast.length > 0) {
        const forecastText = `FORECAST: ${weather.forecast.map(f => f.icon + ' ' + f.name).join(' → ')}`;
        if (!tickerMessages.includes(forecastText)) {
            tickerMessages.push(forecastText);
        }
    }

    // Add weather change notification
    const weatherMsg = `WEATHER ALERT: ${weather.name.toUpperCase()} - ${weather.description}`;
    if (!tickerMessages.includes(weatherMsg)) {
        tickerMessages.push(weatherMsg);
    }
}

function updateStatsDisplay(leaderboards, globalStats) {
    // Update KDA Leaderboard
    const kdaBoard = document.getElementById('leaderboard-kda');
    kdaBoard.innerHTML = '';
    leaderboards.kda.forEach((champ, idx) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
            <span class="leaderboard-rank">#${idx + 1}</span>
            <span class="leaderboard-name" title="${champ.name}">${champ.name}</span>
            <span class="leaderboard-value">${champ.kda}</span>
        `;
        kdaBoard.appendChild(item);
    });

    // Update Gold Leaderboard
    const goldBoard = document.getElementById('leaderboard-gold');
    goldBoard.innerHTML = '';
    leaderboards.gold.forEach((champ, idx) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
            <span class="leaderboard-rank">#${idx + 1}</span>
            <span class="leaderboard-name" title="${champ.name}">${champ.name}</span>
            <span class="leaderboard-value">${champ.avgGold}⌬</span>
        `;
        goldBoard.appendChild(item);
    });

    // Update Chaos Leaderboard
    const chaosBoard = document.getElementById('leaderboard-chaos');
    chaosBoard.innerHTML = '';
    leaderboards.chaos.forEach((champ, idx) => {
        const chaosScore = champ.timesConsumedByVoid + champ.rolesSwitched + champ.enlightenments;
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
            <span class="leaderboard-rank">#${idx + 1}</span>
            <span class="leaderboard-name" title="${champ.name}">${champ.name}</span>
            <span class="leaderboard-value">${chaosScore}</span>
        `;
        chaosBoard.appendChild(item);
    });

    // Update global stats in ticker (optional)
    if (globalStats.totalMatches > 0) {
        const statMessage = `${globalStats.totalMatches} MATCHES PLAYED | ${globalStats.avgKillsPerMatch} AVG KILLS/MATCH`;
        if (!tickerMessages.includes(statMessage)) {
            tickerMessages.push(statMessage);
        }
    }
}

// Initial state setup
statusText.textContent = '◈ NETWORK SYNC IN PROGRESS ◈';

// Update ticker every 10 seconds
setInterval(updateTicker, 10000);
updateTicker(); // Initial call

// ========================================
// TAB SWITCHING FUNCTIONALITY
// ========================================

// Horizontal tabs for center content (Match/News)
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');

        // Remove active class from all buttons and content
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});

// Vertical tabs for right sidebar (Feed/Stats/Rosters)
document.querySelectorAll('.tab-btn-vertical').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');

        // Remove active class from all buttons and content
        document.querySelectorAll('.tab-btn-vertical').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content-vertical').forEach(content => content.classList.remove('active'));

        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});
