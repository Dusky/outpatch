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

// Get match ID from URL
const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get('id');

if (!matchId) {
    alert('No match ID specified');
    window.location.href = '/';
}

// Replay state
let replayData = null;
let replayEvents = [];
let currentEventIndex = 0;
let isPlaying = false;
let playbackSpeed = 1.0;
let playbackInterval = null;
let visualization = null;
let autoScroll = true;

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

// Initialize visualization
window.addEventListener('load', () => {
    if (window.MatchVisualization) {
        visualization = new window.MatchVisualization();
        // Override canvas IDs for replay page
        visualization.minimapCanvas = document.getElementById('replay-minimap');
        visualization.goldGraphCanvas = document.getElementById('replay-gold-graph');
        visualization.killGraphCanvas = document.getElementById('replay-kill-graph');

        if (visualization.minimapCanvas) {
            visualization.minimapCtx = visualization.minimapCanvas.getContext('2d');
            visualization.isInitialized = true;
        }
        if (visualization.goldGraphCanvas) {
            visualization.goldGraphCtx = visualization.goldGraphCanvas.getContext('2d');
        }
        if (visualization.killGraphCanvas) {
            visualization.killGraphCtx = visualization.killGraphCanvas.getContext('2d');
        }

        visualization.drawMinimap();
        visualization.drawGoldGraph();
        visualization.drawKillGraph();
    }
});

// Fetch replay data
async function fetchReplayData() {
    try {
        const response = await fetch(`/api/replays/${matchId}`);
        if (!response.ok) {
            throw new Error('Replay not found');
        }
        const data = await response.json();

        if (!data.success || !data.replay) {
            throw new Error('Invalid replay data');
        }

        replayData = data.replay;
        initializeReplay();
    } catch (error) {
        console.error('Error fetching replay:', error);
        document.getElementById('loading-container').innerHTML = `
            <div class="error-message">
                <h2>Replay Not Found</h2>
                <p>Could not load replay for match ${matchId}</p>
                <a href="/" class="btn-primary">Return to Home</a>
            </div>
        `;
    }
}

// Initialize replay
function initializeReplay() {
    // Parse replay data
    const parsedReplayData = typeof replayData.replay_data === 'string'
        ? JSON.parse(replayData.replay_data)
        : replayData.replay_data;

    replayEvents = parsedReplayData.events || [];

    if (replayEvents.length === 0) {
        alert('No replay events found');
        window.location.href = '/';
        return;
    }

    // Set title
    document.getElementById('replay-title').textContent =
        `${replayData.team1_name} vs ${replayData.team2_name}`;

    // Find max wave
    const maxWave = Math.max(...replayEvents
        .filter(e => e.tick !== undefined)
        .map(e => e.tick));

    document.getElementById('max-wave-display').textContent = maxWave;
    document.getElementById('wave-scrubber').max = replayEvents.length - 1;

    // Create event markers
    createEventMarkers();

    // Hide loading, show replay
    document.getElementById('loading-container').style.display = 'none';
    document.getElementById('replay-container').style.display = 'block';

    // Render first event
    renderEventAtIndex(0);
}

// Create event markers on scrubber
function createEventMarkers() {
    const markersContainer = document.getElementById('event-markers');
    markersContainer.innerHTML = '';

    const importantEvents = replayEvents.filter(e =>
        e.type && (
            e.type.includes('kill') ||
            e.type.includes('objective') ||
            e.type.includes('teamfight') ||
            e.type.includes('structure')
        )
    );

    importantEvents.forEach((event, idx) => {
        const eventIndex = replayEvents.indexOf(event);
        const percentage = (eventIndex / replayEvents.length) * 100;

        const marker = document.createElement('div');
        marker.className = 'event-marker';
        marker.style.left = `${percentage}%`;

        // Color code by event type
        if (event.type.includes('kill')) {
            marker.style.background = '#ff4444';
        } else if (event.type.includes('objective')) {
            marker.style.background = '#ff9500';
        } else if (event.type.includes('structure')) {
            marker.style.background = '#ffd700';
        }

        marker.title = `Wave ${event.tick}: ${event.type}`;
        marker.addEventListener('click', () => {
            jumpToEvent(eventIndex);
        });

        markersContainer.appendChild(marker);
    });
}

// Control handlers
document.getElementById('play-pause-btn').addEventListener('click', togglePlayPause);
document.getElementById('restart-btn').addEventListener('click', restart);
document.getElementById('wave-scrubber').addEventListener('input', handleScrub);
document.getElementById('auto-scroll-checkbox').addEventListener('change', (e) => {
    autoScroll = e.target.checked;
});

document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        playbackSpeed = parseFloat(btn.dataset.speed);

        // Restart interval if playing
        if (isPlaying) {
            stopPlayback();
            startPlayback();
        }
    });
});

// Toggle play/pause
function togglePlayPause() {
    if (isPlaying) {
        stopPlayback();
    } else {
        startPlayback();
    }
}

// Start playback
function startPlayback() {
    isPlaying = true;
    const btn = document.getElementById('play-pause-btn');
    btn.querySelector('.btn-icon').textContent = '⏸️';
    btn.querySelector('.btn-text').textContent = 'PAUSE';

    const baseInterval = 500; // 500ms between events at 1x speed
    const interval = baseInterval / playbackSpeed;

    playbackInterval = setInterval(() => {
        if (currentEventIndex >= replayEvents.length - 1) {
            stopPlayback();
            return;
        }

        currentEventIndex++;
        renderEventAtIndex(currentEventIndex);
        updateScrubber();
    }, interval);
}

// Stop playback
function stopPlayback() {
    isPlaying = false;
    const btn = document.getElementById('play-pause-btn');
    btn.querySelector('.btn-icon').textContent = '▶️';
    btn.querySelector('.btn-text').textContent = 'PLAY';

    if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
    }
}

// Restart from beginning
function restart() {
    stopPlayback();
    currentEventIndex = 0;
    renderEventAtIndex(0);
    updateScrubber();
    clearFeed();
    if (visualization) {
        visualization.reset();
    }
}

// Handle scrubber input
function handleScrub(e) {
    const index = parseInt(e.target.value);
    jumpToEvent(index);
}

// Jump to specific event
function jumpToEvent(index) {
    stopPlayback();
    currentEventIndex = Math.max(0, Math.min(index, replayEvents.length - 1));

    // Clear feed and replay up to this point
    clearFeed();
    if (visualization) {
        visualization.reset();
    }

    for (let i = 0; i <= currentEventIndex; i++) {
        renderEventAtIndex(i, i === currentEventIndex);
    }

    updateScrubber();
}

// Update scrubber position
function updateScrubber() {
    document.getElementById('wave-scrubber').value = currentEventIndex;
}

// Clear feed
function clearFeed() {
    document.getElementById('replay-feed').innerHTML = '';
}

// Render event at index
function renderEventAtIndex(index, shouldScroll = true) {
    if (index < 0 || index >= replayEvents.length) return;

    const event = replayEvents[index];

    // Update wave display
    if (event.tick !== undefined) {
        document.getElementById('current-wave-display').textContent = event.tick;
    }

    // Update match status from event data
    if (event.data) {
        updateMatchStatus(event.data);
    }

    // Add to feed if it's a message event
    if (event.message) {
        addToFeed(event.message, shouldScroll);
    }

    // Handle specific event types
    switch (event.type) {
        case 'match.start':
            addToFeed(`🎮 MATCH START: ${event.data.team1.name} vs ${event.data.team2.name}`, shouldScroll);
            break;
        case 'match.end':
            addToFeed(`🏆 MATCH END: ${event.data.winner.name} WINS!`, shouldScroll);
            break;
    }
}

// Update match status display
function updateMatchStatus(data) {
    if (data.team1 && data.team2) {
        // Update kills
        const team1Kills = data.team1.kills || 0;
        const team2Kills = data.team2.kills || 0;
        document.getElementById('replay-team1-kills').textContent = team1Kills;
        document.getElementById('replay-team2-kills').textContent = team2Kills;

        // Update gold
        const team1Gold = data.team1.gold || 0;
        const team2Gold = data.team2.gold || 0;
        const goldDiff = team1Gold - team2Gold;

        document.getElementById('replay-team1-gold').textContent = team1Gold.toLocaleString();
        document.getElementById('replay-team2-gold').textContent = team2Gold.toLocaleString();

        const goldDiffEl = document.getElementById('replay-gold-diff');
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

        // Update visualization
        if (visualization) {
            visualization.updateMatchData({
                wave: data.tick || 0,
                maxWaves: 150,
                team1Gold: team1Gold,
                team2Gold: team2Gold,
                team1Kills: team1Kills,
                team2Kills: team2Kills,
                champions: data.champions || []
            });
        }
    }
}

// Add message to feed
function addToFeed(message, shouldScroll = true) {
    const feed = document.getElementById('replay-feed');
    const messageEl = document.createElement('div');
    messageEl.className = 'replay-message';
    messageEl.textContent = message;
    feed.appendChild(messageEl);

    // Auto-scroll if enabled
    if (autoScroll && shouldScroll) {
        feed.scrollTop = feed.scrollHeight;
    }
}

// Load replay data
fetchReplayData();
