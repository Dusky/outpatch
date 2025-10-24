const MatchSimulator = require('./MatchSimulator');

/**
 * MatchAdapter - Adapts new MatchSimulator to work with old Match interface
 *
 * This wrapper makes MatchSimulator compatible with the existing Game class
 * which expects the old Match API (start(), on('end'), logEvent(), etc.)
 */
class MatchAdapter {
    constructor(team1, team2, wss, options = {}) {
        this.team1 = team1;
        this.team2 = team2;
        this.wss = wss;
        this.log = [];
        this.wave = 0;
        this.interval = null;
        this.eventListeners = {};
        this.match_ended = false;
        this.intensityMultiplier = options.intensityMultiplier || 1.0;  // For compatibility

        // Event queue for staggered broadcasting
        this.eventQueue = [];
        this.eventBroadcastInterval = null;
        this.EVENT_DELAY_MS = 800; // Delay between events (milliseconds)

        // Create the actual simulator
        const seed = `match-${Date.now()}-${Math.random()}`;
        this.simulator = new MatchSimulator({
            matchId: `live-${Date.now()}`,
            seed: seed,
            team1: team1,
            team2: team2,
            maxWaves: 150,
            intensityMultiplier: this.intensityMultiplier  // Pass to simulator
        });

        // Track detailed structure counts
        this.team1Structures = {
            spires: 9,
            gateways: 3,
            core: 1,
            total: 13
        };
        this.team2Structures = {
            spires: 9,
            gateways: 3,
            core: 1,
            total: 13
        };

        // Legacy compatibility
        this.team1Towers = 13;
        this.team2Towers = 13;

        // Track kills and gold
        this.team1Kills = 0;
        this.team2Kills = 0;
        this.team1Gold = 0;
        this.team2Gold = 0;

        // Match timing
        this.matchStartTime = null;
        this.maxWaves = options.maxWaves || 150;

        // Initial log
        this.logEvent(`Match starting: ${team1.name} vs ${team2.name}`);
    }

    /**
     * Event listener registration (compatible with old Match API)
     */
    on(eventName, listener) {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(listener);
    }

    /**
     * Emit events to listeners
     */
    emit(eventName, ...args) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName].forEach(listener => listener(...args));
        }
    }

    /**
     * Log event and broadcast to WebSocket clients
     */
    logEvent(message) {
        this.log.push(message);
        if (this.wss && this.wss.clients) {
            this.wss.clients.forEach(client => {
                if (client.readyState === 1) {  // WebSocket.OPEN
                    client.send(message);
                }
            });
        }
    }

    /**
     * Start the match simulation
     */
    async start() {
        try {
            // Initialize simulator
            await this.simulator.initialize();
            this.matchStartTime = Date.now();

            // Listen to all simulator events
            this.simulator.on('*', (event) => {
                this._handleSimulatorEvent(event);
            });

            // Broadcast match start with timing info
            this._broadcastMatchStatus();

            // Start processing event queue
            this._startEventQueueProcessor();

            // Run simulation wave by wave with intervals
            const waveInterval = 30000; // 30 seconds per wave for better viewer pacing

            this.interval = setInterval(async () => {
                if (this.match_ended) {
                    clearInterval(this.interval);
                    return;
                }

                // Step simulation forward one wave
                const result = this.simulator.step();
                this.wave = result.wave;

                // Broadcast wave progress
                this._broadcastMatchStatus();

                // Check if match finished
                if (result.finished) {
                    this._endMatch(result.winner);
                }
            }, waveInterval);

        } catch (error) {
            console.error('Match simulation error:', error);
            this.logEvent(`⚠️ Simulation error: ${error.message}`);
        }
    }

    /**
     * Handle events from the simulator and queue them for staggered broadcast
     */
    _handleSimulatorEvent(event) {
        // Add event to queue instead of processing immediately
        this.eventQueue.push(event);
    }

    /**
     * Process a single event from the queue and broadcast it
     */
    _processQueuedEvent(event) {
        const { type, tick } = event;

        // Convert new event types to old-style commentary
        switch (type) {
            case 'wave.start':
                this.logEvent(`--- Wave ${tick} ---`);
                break;

            case 'lane.cs':
                this.logEvent(`${event.championName} secured ${event.csGained} CS`);
                break;

            case 'lane.kill':
                this.logEvent(`💀 ${event.killerName} eliminated ${event.victimName} in ${event.lane} lane!`);
                // Track kills (killer's team gets +1)
                if (event.killerTeam === 'team1') {
                    this.team1Kills++;
                } else if (event.killerTeam === 'team2') {
                    this.team2Kills++;
                }
                break;

            case 'lane.trade':
                this.logEvent(`⚔️ ${event.champ1Name} and ${event.champ2Name} trade blows in ${event.lane}`);
                break;

            case 'jungle.camp':
                this.logEvent(`${event.championName} cleared ${event.campType} for ${event.goldEarned}g`);
                break;

            case 'jungle.gank':
                if (event.success) {
                    this.logEvent(`🎯 ${event.jungler} ganked ${event.lane} lane successfully!`);
                } else {
                    this.logEvent(`${event.jungler} attempted a gank in ${event.lane} but failed`);
                }
                break;

            case 'jungle.countergank':
                this.logEvent(`🔄 ${event.counterJungler} counter-ganked in ${event.lane}!`);
                break;

            case 'fight.start':
                this.logEvent(`⚔️ TEAMFIGHT BREAKING OUT!`);
                break;

            case 'fight.kill':
                this.logEvent(`${event.killerName} eliminated ${event.victimName}!`);
                // Track kills
                if (event.killerTeam === 'team1') {
                    this.team1Kills++;
                } else if (event.killerTeam === 'team2') {
                    this.team2Kills++;
                }
                break;

            case 'fight.end':
                this.logEvent(`Teamfight concluded. ${event.kills} kills.`);
                break;

            case 'item.purchase':
                this.logEvent(`${event.championName} purchased ${event.itemName}`);
                break;

            case 'objective.start':
                this.logEvent(`📍 ${event.objectiveName} has spawned!`);
                break;

            case 'objective.contest':
                this.logEvent(`⚔️ Both teams contest ${event.objectiveName}!`);
                break;

            case 'objective.secure':
                const winningTeamName = event.winningTeam === 'team1' ? this.team1.name : this.team2.name;
                this.logEvent(`✅ ${winningTeamName} secured ${event.objectiveName}!`);
                break;

            case 'objective.steal':
                const stealingTeamName = event.stealingTeam === 'team1' ? this.team1.name : this.team2.name;
                this.logEvent(`🔥 ${stealingTeamName} STOLE ${event.objectiveName}!`);
                break;

            case 'structure.destroyed':
                const teamName = event.teamId === 'team1' ? this.team1.name : this.team2.name;
                this.logEvent(`🏗️ ${teamName}'s ${event.structureName} destroyed!`);

                // Update detailed structure counts
                const structureType = event.structureType || 'spire';  // Default to spire
                if (event.teamId === 'team1') {
                    this.team1Towers--;
                    this.team1Structures.total--;
                    if (structureType === 'spire') {
                        this.team1Structures.spires--;
                    } else if (structureType === 'gateway') {
                        this.team1Structures.gateways--;
                    } else if (structureType === 'core') {
                        this.team1Structures.core = 0;
                    }
                } else {
                    this.team2Towers--;
                    this.team2Structures.total--;
                    if (structureType === 'spire') {
                        this.team2Structures.spires--;
                    } else if (structureType === 'gateway') {
                        this.team2Structures.gateways--;
                    } else if (structureType === 'core') {
                        this.team2Structures.core = 0;
                    }
                }
                break;

            case 'gateway.destroyed':
                this.logEvent(`⚠️ ${event.lane} Gateway destroyed! Super minions incoming!`);
                break;

            case 'tilt.increase':
                if (event.newTilt > 0.7) {
                    this.logEvent(`😤 ${event.championName} is tilting hard (${Math.floor(event.newTilt * 100)}% tilt)`);
                }
                break;

            case 'mental.boom':
                this.logEvent(`💥 ${event.championName} has mentally boomed!`);
                break;
        }
    }

    /**
     * Start the event queue processor
     */
    _startEventQueueProcessor() {
        if (this.eventBroadcastInterval) {
            clearInterval(this.eventBroadcastInterval);
        }

        this.eventBroadcastInterval = setInterval(() => {
            if (this.eventQueue.length > 0) {
                const event = this.eventQueue.shift();
                this._processQueuedEvent(event);
            }
        }, this.EVENT_DELAY_MS);
    }

    /**
     * Stop the event queue processor
     */
    _stopEventQueueProcessor() {
        if (this.eventBroadcastInterval) {
            clearInterval(this.eventBroadcastInterval);
            this.eventBroadcastInterval = null;
        }
    }

    /**
     * Broadcast match status (wave progress and timer)
     */
    _broadcastMatchStatus() {
        if (!this.wss || !this.wss.clients) return;

        const elapsedMs = this.matchStartTime ? Date.now() - this.matchStartTime : 0;
        const elapsedMin = Math.floor(elapsedMs / 60000);
        const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);

        // Get live champion stats from simulator
        let championStats = null;
        try {
            const state = this.simulator.getState();
            if (state && state.champions) {
                championStats = state.champions;
            }
        } catch (error) {
            console.error('Error getting champion states:', error);
        }

        this.wss.clients.forEach(client => {
            if (client.readyState === 1) {  // WebSocket.OPEN
                const statusMessage = {
                    type: 'match_status',
                    wave: this.wave,
                    maxWaves: this.maxWaves,
                    elapsedTime: `${elapsedMin}:${elapsedSec.toString().padStart(2, '0')}`,
                    // Team names
                    team1Name: this.team1.name,
                    team2Name: this.team2.name,
                    // Kill counts
                    team1Kills: this.team1Kills,
                    team2Kills: this.team2Kills,
                    // Gold amounts (placeholder for now)
                    team1Gold: Math.floor(this.team1Kills * 300 + this.wave * 100), // Estimate
                    team2Gold: Math.floor(this.team2Kills * 300 + this.wave * 100), // Estimate
                    // Legacy support
                    team1Structures: this.team1Towers,
                    team2Structures: this.team2Towers,
                    // Detailed structure counts
                    team1: {
                        spires: this.team1Structures.spires,
                        gateways: this.team1Structures.gateways,
                        core: this.team1Structures.core,
                        total: this.team1Structures.total
                    },
                    team2: {
                        spires: this.team2Structures.spires,
                        gateways: this.team2Structures.gateways,
                        core: this.team2Structures.core,
                        total: this.team2Structures.total
                    }
                };

                // Add champion stats if available
                if (championStats) {
                    statusMessage.champions = championStats;
                }

                client.send(JSON.stringify(statusMessage));
            }
        });
    }

    /**
     * End the match and determine winner
     */
    _endMatch(winnerTeamId) {
        if (this.match_ended) return;

        clearInterval(this.interval);
        this.match_ended = true;

        let winner, loser;

        if (winnerTeamId === 'team1') {
            winner = this.team1;
            loser = this.team2;
        } else if (winnerTeamId === 'team2') {
            winner = this.team2;
            loser = this.team1;
        } else {
            // Draw/timeout - pick based on remaining towers
            if (this.team1Towers > this.team2Towers) {
                winner = this.team1;
                loser = this.team2;
            } else {
                winner = this.team2;
                loser = this.team1;
            }
        }

        this.logEvent(`\n🏆 ${winner.name} WINS! 🏆\n`);
        this.emit('end', winner, loser);
    }

    /**
     * Cleanup (called when match is done)
     */
    end() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this._stopEventQueueProcessor();
        this.match_ended = true;
    }
}

module.exports = MatchAdapter;
