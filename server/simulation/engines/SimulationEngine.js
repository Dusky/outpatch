const World = require('../core/World');
const EventLog = require('./EventLog');
const RNG = require('../core/RNG');

/**
 * SimulationEngine - Main game loop and system orchestration
 *
 * Manages the tick-based simulation and coordinates all game systems.
 * Each step() call advances the simulation by one wave.
 */
class SimulationEngine {
    constructor(config = {}) {
        this.world = new World();
        this.eventLog = new EventLog();
        this.rng = new RNG(config.seed || Date.now());

        this.config = {
            maxWaves: config.maxWaves || 60,
            snapshotInterval: config.snapshotInterval || 10,
            ...config
        };

        this.systems = [];
        this.phase = 'draft';  // 'draft', 'early', 'mid', 'late', 'ended'
        this.currentWave = 0;
        this.isRunning = false;
    }

    /**
     * Register a system to be executed each tick
     * @param {object} system - System object with update(world, rng, eventLog) method
     * @param {number} priority - Lower numbers execute first
     */
    registerSystem(system, priority = 100) {
        this.systems.push({ system, priority });
        this.systems.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Initialize match (setup entities, run draft, etc.)
     * @param {object} matchConfig - Match configuration with teams
     */
    async initialize(matchConfig) {
        this.world.setMetadata('matchId', matchConfig.matchId);
        this.world.setMetadata('team1', matchConfig.team1);
        this.world.setMetadata('team2', matchConfig.team2);
        this.world.setMetadata('startTime', Date.now());

        // Log match start
        this.eventLog.log({
            type: EventLog.EventTypes.MATCH_START,
            tick: 0,
            matchId: matchConfig.matchId,
            teams: {
                team1: matchConfig.team1.name,
                team2: matchConfig.team2.name
            }
        });

        this.isRunning = true;
        this.phase = 'early';
    }

    /**
     * Step simulation forward by one wave
     * @returns {object} Step result with events and state changes
     */
    step() {
        if (!this.isRunning) {
            return { finished: true, events: [] };
        }

        this.currentWave++;
        this.world.advanceTick();

        const waveStartEvent = this.eventLog.log({
            type: EventLog.EventTypes.WAVE_START,
            tick: this.world.getTick(),
            wave: this.currentWave
        });

        // Update game phase based on wave
        this._updatePhase();

        // Execute all systems in priority order
        const systemResults = [];
        for (const { system } of this.systems) {
            try {
                const result = system.update(this.world, this.rng, this.eventLog, this.phase);
                if (result) {
                    systemResults.push(result);
                }
            } catch (error) {
                console.error(`Error in system ${system.constructor.name}:`, error);
            }
        }

        // Wave end event
        const waveEndEvent = this.eventLog.log({
            type: EventLog.EventTypes.WAVE_END,
            tick: this.world.getTick(),
            wave: this.currentWave
        });

        // Save snapshot periodically
        if (this.currentWave % this.config.snapshotInterval === 0) {
            this.eventLog.saveSnapshot(this.world.getTick(), this.world.serialize());
        }

        // Check win condition
        const winner = this._checkWinCondition();
        if (winner || this.currentWave >= this.config.maxWaves) {
            this._endMatch(winner);
            return {
                finished: true,
                winner,
                events: this._getRecentEvents(),
                wave: this.currentWave
            };
        }

        return {
            finished: false,
            events: this._getRecentEvents(),
            wave: this.currentWave,
            phase: this.phase
        };
    }

    /**
     * Update game phase based on wave number
     */
    _updatePhase() {
        if (this.currentWave <= 20) {
            this.phase = 'early';
        } else if (this.currentWave <= 40) {
            this.phase = 'mid';
        } else {
            this.phase = 'late';
        }
    }

    /**
     * Check if either team has won
     * @returns {string|null} 'team1', 'team2', or null
     */
    _checkWinCondition() {
        // Check if match is over (set by StructureSystem when core is destroyed)
        const matchOver = this.world.getMetadata('matchOver');
        const winner = this.world.getMetadata('matchWinner');

        if (matchOver && winner) {
            return winner;
        }

        return null;
    }

    /**
     * End the match and log final event
     * @param {string} winner
     */
    _endMatch(winner) {
        this.isRunning = false;
        this.phase = 'ended';

        this.eventLog.log({
            type: EventLog.EventTypes.MATCH_END,
            tick: this.world.getTick(),
            wave: this.currentWave,
            winner,
            duration: this.currentWave
        });

        // Final snapshot
        this.eventLog.saveSnapshot(this.world.getTick(), this.world.serialize());
    }

    /**
     * Get events from recent ticks
     * @returns {object[]}
     */
    _getRecentEvents() {
        const currentTick = this.world.getTick();
        return this.eventLog.getEventsByTickRange(currentTick - 1, currentTick);
    }

    /**
     * Run entire match to completion
     * @returns {object} Match result
     */
    async runToCompletion() {
        const results = [];

        while (this.isRunning && this.currentWave < this.config.maxWaves) {
            const result = this.step();
            results.push(result);

            if (result.finished) {
                break;
            }
        }

        return {
            winner: this._checkWinCondition(),
            waves: this.currentWave,
            events: this.eventLog.getAllEvents(),
            finalState: this.world.serialize()
        };
    }

    /**
     * Get current simulation state
     * @returns {object}
     */
    getState() {
        return {
            wave: this.currentWave,
            phase: this.phase,
            isRunning: this.isRunning,
            worldStats: this.world.getStats(),
            eventStats: this.eventLog.getStats()
        };
    }

    /**
     * Get full event log
     * @returns {EventLog}
     */
    getEventLog() {
        return this.eventLog;
    }

    /**
     * Get world reference
     * @returns {World}
     */
    getWorld() {
        return this.world;
    }

    /**
     * Stop simulation
     */
    stop() {
        this.isRunning = false;
    }

    /**
     * Reset simulation
     */
    reset() {
        this.world.clear();
        this.eventLog.clear();
        this.currentWave = 0;
        this.phase = 'draft';
        this.isRunning = false;
    }
}

module.exports = SimulationEngine;
