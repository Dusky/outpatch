
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const Game = require('./server/game/game');
const Database = require('./server/database/database');
const PersistenceManager = require('./server/game/persistenceManager');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const db = new Database(); // Database instance for auth endpoints
const persistenceManager = new PersistenceManager();

// Wait for database to be ready, then create game instance
let game = null;
db.readyPromise.then(() => {
    game = new Game(wss, db); // Pass database to Game
    console.log('Game instance created with database connection');
}).catch(err => {
    console.error('Failed to initialize game:', err);
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== AUTHENTICATION API ====================

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.json({ success: false, error: 'Username and password required' });
        }

        const user = await db.createUser(username, password);
        const token = `token_${user.id}_${Date.now()}`;

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                balance: user.balance,
                isAdmin: user.isAdmin || false
            },
            token
        });
    } catch (error) {
        res.json({ success: false, error: error.error || 'Registration failed' });
    }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.json({ success: false, error: 'Username and password required' });
        }

        const user = await db.authenticateUser(username, password);
        const token = `token_${user.id}_${Date.now()}`;

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                balance: user.balance,
                corruptionLevel: user.corruptionLevel,
                responsibilityScore: user.responsibilityScore,
                isAdmin: user.isAdmin || false
            },
            token
        });
    } catch (error) {
        res.json({ success: false, error: error.error || 'Login failed' });
    }
});

// Get user profile
app.get('/api/user/:userId', async (req, res) => {
    try {
        const profile = await persistenceManager.getUserProfile(parseInt(req.params.userId));
        res.json({ success: true, profile });
    } catch (error) {
        res.json({ success: false, error: 'Profile not found' });
    }
});

// Get season history
app.get('/api/seasons', async (req, res) => {
    try {
        const seasons = await persistenceManager.getSeasonHistory();
        res.json({ success: true, seasons });
    } catch (error) {
        res.json({ success: false, error: 'Failed to fetch seasons' });
    }
});

// Get champion career
app.get('/api/champion/:championName', async (req, res) => {
    try {
        const career = await persistenceManager.getChampionCareer(req.params.championName);
        res.json({ success: true, career });
    } catch (error) {
        res.json({ success: false, error: 'Champion not found (yet)' });
    }
});

// Get all champion careers
app.get('/api/champions', async (req, res) => {
    try {
        const champions = await persistenceManager.getAllChampionCareers();
        res.json({ success: true, champions });
    } catch (error) {
        res.json({ success: false, error: 'Failed to fetch champions' });
    }
});

// ==================== ADMIN API ====================

// Middleware to check admin status
async function requireAdmin(req, res, next) {
    const { userId } = req.body;
    if (!userId) {
        return res.json({ success: false, error: 'User ID required' });
    }

    try {
        const user = await db.getUserById(userId);
        if (!user || user.is_admin !== 1) {
            return res.json({ success: false, error: 'Admin privileges required' });
        }
        req.adminUser = user;
        next();
    } catch (error) {
        res.json({ success: false, error: 'Authentication failed' });
    }
}

// ==================== REPLAY API ENDPOINTS ====================

// Get replay by match ID
app.get('/api/replays/:matchId', async (req, res) => {
    try {
        const replay = await db.getMatchReplay(req.params.matchId);

        if (!replay) {
            return res.status(404).json({
                success: false,
                error: 'Replay not found'
            });
        }

        res.json({
            success: true,
            replay: replay
        });
    } catch (error) {
        console.error('Error fetching replay:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch replay'
        });
    }
});

// Get all replays (paginated)
app.get('/api/replays', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const replays = await db.getAllMatchReplays(limit, offset);

        res.json({
            success: true,
            replays: replays,
            limit: limit,
            offset: offset
        });
    } catch (error) {
        console.error('Error fetching replays:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch replays'
        });
    }
});

// Get replays by team
app.get('/api/replays/team/:teamName', async (req, res) => {
    try {
        const teamName = decodeURIComponent(req.params.teamName);
        const limit = parseInt(req.query.limit) || 10;

        const replays = await db.getReplaysByTeam(teamName, limit);

        res.json({
            success: true,
            team: teamName,
            replays: replays
        });
    } catch (error) {
        console.error('Error fetching team replays:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch team replays'
        });
    }
});

// ==================== ADMIN API ENDPOINTS ====================

// Get admin status
app.get('/api/admin/status', async (req, res) => {
    try {
        const seasonStatus = game ? game.getSeasonStatus() : null;

        res.json({
            success: true,
            matchesRunning: game ? game.isRunning : false,
            currentSeason: seasonStatus ? seasonStatus.season : (persistenceManager.currentSeason || 1),
            seasonStatus: persistenceManager.seasonStarted ? 'active' : 'not started',
            seasonPhase: seasonStatus ? {
                phase: seasonStatus.phase,
                week: seasonStatus.week,
                day: seasonStatus.day,
                theme: seasonStatus.theme
            } : null
        });
    } catch (error) {
        res.json({ success: false, error: 'Failed to get status' });
    }
});

// Start matches
app.post('/api/admin/matches/start', requireAdmin, (req, res) => {
    try {
        if (game.isRunning) {
            return res.json({ success: false, message: 'Matches already running' });
        }
        game.start();
        res.json({ success: true, message: 'Matches started successfully' });
    } catch (error) {
        res.json({ success: false, error: 'Failed to start matches' });
    }
});

// Stop matches
app.post('/api/admin/matches/stop', requireAdmin, (req, res) => {
    try {
        if (!game.isRunning) {
            return res.json({ success: false, message: 'Matches not running' });
        }
        game.stop();
        res.json({ success: true, message: 'Matches stopped successfully' });
    } catch (error) {
        res.json({ success: false, error: 'Failed to stop matches' });
    }
});

// Force immediate match
app.post('/api/admin/matches/force', requireAdmin, (req, res) => {
    try {
        game.forceMatch();
        res.json({ success: true, message: 'Match forced successfully' });
    } catch (error) {
        res.json({ success: false, error: 'Failed to force match' });
    }
});

// Start new season
app.post('/api/admin/season/start', requireAdmin, async (req, res) => {
    try {
        await persistenceManager.progressToNextSeason();
        res.json({ success: true, message: `Season ${persistenceManager.currentSeason} started` });
    } catch (error) {
        res.json({ success: false, error: 'Failed to start season' });
    }
});

// End current season
app.post('/api/admin/season/end', requireAdmin, async (req, res) => {
    try {
        const notableEvents = await persistenceManager.generateSeasonSummary();
        await persistenceManager.endCurrentSeason(notableEvents);
        res.json({ success: true, message: 'Season ended successfully' });
    } catch (error) {
        res.json({ success: false, error: 'Failed to end season' });
    }
});

// NEW: Skip to season phase
app.post('/api/admin/season/phase', requireAdmin, async (req, res) => {
    try {
        const { phase } = req.body;
        if (!phase) {
            return res.json({ success: false, error: 'Phase required' });
        }

        if (!game) {
            return res.json({ success: false, error: 'Game not initialized yet' });
        }

        await game.skipToPhase(phase);
        res.json({ success: true, message: `Skipped to ${phase}` });
    } catch (error) {
        res.json({ success: false, error: 'Failed to skip phase' });
    }
});

// Regenerate data
app.post('/api/admin/data/regenerate', requireAdmin, (req, res) => {
    try {
        const { exec } = require('child_process');
        exec('node server/data/generate-data.js', (error, stdout, stderr) => {
            if (error) {
                return res.json({ success: false, error: 'Failed to regenerate data' });
            }
            // Reload data
            game.reloadData();
            res.json({ success: true, message: 'Data regenerated successfully. Restart server for full effect.' });
        });
    } catch (error) {
        res.json({ success: false, error: 'Failed to regenerate data' });
    }
});

// Clear match history (placeholder - would need db implementation)
app.post('/api/admin/matches/clear', requireAdmin, async (req, res) => {
    try {
        // TODO: Implement match history clearing in database
        res.json({ success: true, message: 'Match history cleared (placeholder)' });
    } catch (error) {
        res.json({ success: false, error: 'Failed to clear matches' });
    }
});

// Reset season stats
app.post('/api/admin/season/reset', requireAdmin, (req, res) => {
    try {
        game.resetStandings();
        res.json({ success: true, message: 'Season stats reset successfully' });
    } catch (error) {
        res.json({ success: false, error: 'Failed to reset season' });
    }
});

// NEW: Simulation Demo Endpoint
app.post('/api/admin/simulation/demo', requireAdmin, async (req, res) => {
    try {
        console.log('Running simulation demo...');

        // Import the new simulator
        const MatchSimulator = require('./server/simulation/MatchSimulator');

        // Get two teams from data
        const teamsData = require('./server/data/data.json');
        const team1 = teamsData.teams[0];
        const team2 = teamsData.teams[1];

        // Create simulator
        const seed = `demo-${Date.now()}`;
        const simulator = new MatchSimulator({
            matchId: 'admin-demo',
            seed: seed,
            team1: team1,
            team2: team2,
            maxWaves: 150  // Allow full match completion
        });

        // Run simulation
        console.log('Initializing simulator...');
        await simulator.initialize();

        console.log('Running match to completion...');
        const result = await simulator.runToCompletion();

        console.log('Getting final state...');
        const finalState = simulator.getState();
        const events = simulator.getAllEvents();

        // Get structure system to show remaining structures
        const world = simulator.engine.getWorld();
        const team1Structures = world.queryByTags('structure', 'team1');
        const team2Structures = world.queryByTags('structure', 'team2');

        const structureStats = {
            team1: {
                total: team1Structures.length,
                alive: team1Structures.filter(s => s.getComponent('stats').isAlive).length,
                destroyed: team1Structures.filter(s => !s.getComponent('stats').isAlive).length
            },
            team2: {
                total: team2Structures.length,
                alive: team2Structures.filter(s => s.getComponent('stats').isAlive).length,
                destroyed: team2Structures.filter(s => !s.getComponent('stats').isAlive).length
            }
        };

        // Count event types
        const eventSummary = {};
        events.forEach(e => {
            eventSummary[e.type] = (eventSummary[e.type] || 0) + 1;
        });

        res.json({
            success: true,
            message: 'Simulation demo completed successfully',
            result: {
                winner: result.winner,
                waves: result.waves,
                duration: `${Math.floor(result.waves * 8 / 60)} minutes ${(result.waves * 8) % 60} seconds (at 8s/wave)`
            },
            structures: structureStats,
            eventSummary: eventSummary,
            totalEvents: events.length,
            champions: finalState.champions,
            // Send notable events for display
            notableEvents: events.filter(e =>
                e.type === 'structure.destroyed' ||
                e.type === 'gateway.destroyed' ||
                e.type === 'objective.secure' ||
                e.type === 'objective.steal' ||
                e.type === 'fight.end' ||
                e.type === 'match.end'
            ).slice(0, 50)  // First 50 notable events
        });

        console.log('Simulation demo complete:', result.winner, result.waves, 'waves');
    } catch (error) {
        console.error('Simulation demo error:', error);
        res.json({
            success: false,
            error: 'Failed to run simulation demo',
            message: error.message
        });
    }
});

// ==================== WEBSOCKET CONNECTION ====================

wss.on('connection', (ws) => {
    console.log('Client connected');

    // Assign unique ID and balance (will be overridden if authenticated)
    ws._userId = null;
    ws._dbUserId = null;
    ws.balance = 1000; // Initial balance
    ws.authenticated = false;

    ws.on('message', async (message) => {
        console.log(`Received message => ${message}`);
        try {
            const parsedMessage = JSON.parse(message);

            // Handle authentication
            if (parsedMessage.type === 'auth') {
                const { userId } = parsedMessage;
                try {
                    const user = await db.getUserById(userId);
                    ws._dbUserId = user.id;
                    ws._userId = `user_${user.id}`;
                    ws.balance = user.balance;
                    ws.authenticated = true;
                    ws.displayName = user.display_name;

                    ws.send(JSON.stringify({
                        type: 'auth_success',
                        balance: user.balance,
                        displayName: user.display_name,
                        corruptionLevel: user.corruption_level
                    }));

                    console.log(`User ${user.username} authenticated`);
                } catch (error) {
                    ws.send(JSON.stringify({
                        type: 'auth_failed',
                        message: 'Authentication failed. Reality uncertain.'
                    }));
                }
                return;
            }

            if (parsedMessage.type === 'bet') {
                const { team, amount, matchId } = parsedMessage;

                if (!matchId) {
                    // Old betting system (basic)
                    if (ws.balance >= amount) {
                        ws.balance -= amount;
                        ws.send(JSON.stringify({ type: 'bet_ack', success: true, newBalance: ws.balance }));
                        console.log(`Bet of ${amount} on ${team} placed. New balance: ${ws.balance}`);
                    } else {
                        ws.send(JSON.stringify({ type: 'bet_ack', success: false, message: 'Insufficient funds' }));
                    }
                } else {
                    // New advanced betting system with persistence
                    if (ws.balance >= amount) {
                        const result = game.bettingSystem.placeBet(ws._userId || `temp_${Date.now()}`, matchId, team, amount);

                        if (result.success) {
                            ws.balance -= amount;

                            // If user is authenticated, persist bet to database
                            let betId = null;
                            if (ws.authenticated && ws._dbUserId) {
                                try {
                                    const betRecord = await persistenceManager.recordUserBet(
                                        ws._dbUserId,
                                        matchId,
                                        team,
                                        amount,
                                        result.currentOdds
                                    );
                                    betId = betRecord.betId;

                                    // Update user balance in database
                                    await persistenceManager.updateUserBalance(ws._dbUserId, ws.balance);
                                } catch (error) {
                                    console.error('Failed to persist bet:', error);
                                }
                            }

                            ws.send(JSON.stringify({
                                type: 'bet_ack',
                                success: true,
                                newBalance: ws.balance,
                                potentialWin: result.potentialWin,
                                currentOdds: result.currentOdds,
                                matchId,
                                betId
                            }));

                            // Store betId on websocket for later resolution
                            if (betId) {
                                ws._activeBets = ws._activeBets || {};
                                ws._activeBets[matchId] = betId;
                            }

                            // Broadcast updated odds to all clients
                            game.broadcastOdds(matchId);
                        } else {
                            ws.send(JSON.stringify({
                                type: 'bet_ack',
                                success: false,
                                message: result.message
                            }));
                        }
                    } else {
                        ws.send(JSON.stringify({ type: 'bet_ack', success: false, message: 'Insufficient funds' }));
                    }
                }
            }
        } catch (e) {
            console.error('Failed to parse message or process bet:', e);
        }
    });

    // Send initial team names for betting dropdown
    ws.send(JSON.stringify({ type: 'teams', data: game.teams.map(t => t.name) }));
    // Send full team data for roster display
    ws.send(JSON.stringify({ type: 'full_teams', data: game.teams }));
    // Send initial standings
    game.updateStandings();

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.send('Welcome to the MOBA Blaseball Simulator!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`Server is listening on port ${PORT}`);

    // Wait for database to be ready
    await db.readyPromise;
    await persistenceManager.db.readyPromise;

    // Initialize persistence manager and start season
    await persistenceManager.startNewSeason();

    game.start();
});
