const EventLog = require('../engines/EventLog');
const terminology = require('../data/terminology.json');

/**
 * ObjectiveSystem - Manages major and minor objectives
 *
 * Handles:
 * - Prisms (minor objectives) - spawn periodically
 * - The Monolith (major objective) - spawns late game
 * - Contest resolution based on team power
 * - Steal mechanics
 * - Buff application
 */
class ObjectiveSystem {
    constructor() {
        this.config = {
            prismSpawnWaves: [10, 20, 30, 40, 50],  // Waves when prisms spawn
            monolithSpawnWave: 40,  // Monolith spawns wave 40
            contestChance: 0.60,  // 60% chance teams contest objective
            stealChance: 0.12,  // 12% steal chance when losing
            prismBuffDuration: 15,  // Prism buffs last 15 waves
            monolithBuffDuration: 999  // Monolith buff permanent
        };

        this.prismTypes = terminology.objectives.minor;
        this.availablePrisms = [];
        this.activePrisms = new Map();  // Track which prisms are up
        this.teamBuffs = {
            team1: [],
            team2: []
        };
    }

    /**
     * Update system - spawn and contest objectives
     */
    update(world, rng, eventLog, phase) {
        const tick = world.getTick();
        const systemRng = rng.fork('objectives');

        // Check for prism spawns
        if (this.config.prismSpawnWaves.includes(tick)) {
            this._spawnPrism(tick, eventLog, systemRng);
        }

        // Check for monolith spawn
        if (tick === this.config.monolithSpawnWave) {
            this._spawnMonolith(tick, eventLog);
        }

        // Contest available objectives
        if (this.availablePrisms.length > 0 && systemRng.chance(this.config.contestChance)) {
            this._contestPrism(world, tick, eventLog, systemRng);
        }

        // Check for monolith contest
        if (this.availablePrisms.some(p => p.type === 'monolith') && systemRng.chance(0.70)) {
            this._contestMonolith(world, tick, eventLog, systemRng);
        }

        // Update buff durations
        this._updateBuffs(world, tick);
    }

    /**
     * Spawn a prism objective
     */
    _spawnPrism(tick, eventLog, rng) {
        const prismType = rng.choice(this.prismTypes);

        const prism = {
            type: 'prism',
            subtype: prismType.type,
            name: prismType.name,
            description: prismType.description,
            flavor: prismType.flavor,
            spawnTick: tick
        };

        this.availablePrisms.push(prism);

        eventLog.log({
            type: EventLog.EventTypes.OBJECTIVE_START,
            tick: tick,
            objectiveType: 'prism',
            objectiveName: prismType.name,
            message: `A ${prismType.name} has manifested`
        });
    }

    /**
     * Spawn the Monolith
     */
    _spawnMonolith(tick, eventLog) {
        const monolith = {
            type: 'monolith',
            name: terminology.objectives.major.name,
            description: terminology.objectives.major.description,
            spawnTick: tick
        };

        this.availablePrisms.push(monolith);

        eventLog.log({
            type: EventLog.EventTypes.OBJECTIVE_START,
            tick: tick,
            objectiveType: 'monolith',
            objectiveName: monolith.name,
            message: terminology.objectives.major.spawn
        });
    }

    /**
     * Contest a prism
     */
    _contestPrism(world, tick, eventLog, rng) {
        if (this.availablePrisms.length === 0) return;

        // Get first available prism (FIFO)
        const prismIndex = this.availablePrisms.findIndex(p => p.type === 'prism');
        if (prismIndex === -1) return;

        const prism = this.availablePrisms[prismIndex];

        // Calculate team power
        const team1Power = this._calculateTeamPower(world, 'team1');
        const team2Power = this._calculateTeamPower(world, 'team2');

        const team1WinChance = team1Power / (team1Power + team2Power);

        // Log contest
        eventLog.log({
            type: EventLog.EventTypes.OBJECTIVE_CONTEST,
            tick: tick,
            objectiveType: 'prism',
            objectiveName: prism.name,
            team1Power,
            team2Power
        });

        // Determine winner
        let winner;
        const roll = rng.random();

        if (roll < team1WinChance) {
            // Team 1 wins
            if (rng.chance(this.config.stealChance)) {
                winner = 'team2';  // Steal!
                eventLog.log({
                    type: EventLog.EventTypes.OBJECTIVE_STEAL,
                    tick: tick,
                    objectiveName: prism.name,
                    stealingTeam: 'team2'
                });
            } else {
                winner = 'team1';
            }
        } else {
            // Team 2 wins
            if (rng.chance(this.config.stealChance)) {
                winner = 'team1';  // Steal!
                eventLog.log({
                    type: EventLog.EventTypes.OBJECTIVE_STEAL,
                    tick: tick,
                    objectiveName: prism.name,
                    stealingTeam: 'team1'
                });
            } else {
                winner = 'team2';
            }
        }

        // Apply buff
        this._applyPrismBuff(winner, prism, tick, world);

        // Remove from available
        this.availablePrisms.splice(prismIndex, 1);

        // Log secure
        eventLog.log({
            type: EventLog.EventTypes.OBJECTIVE_SECURE,
            tick: tick,
            objectiveType: 'prism',
            objectiveName: prism.name,
            winningTeam: winner,
            message: `${winner} ${terminology.objectives.major.secure}`
        });
    }

    /**
     * Contest the Monolith
     */
    _contestMonolith(world, tick, eventLog, rng) {
        const monolithIndex = this.availablePrisms.findIndex(p => p.type === 'monolith');
        if (monolithIndex === -1) return;

        const monolith = this.availablePrisms[monolithIndex];

        // Calculate team power
        const team1Power = this._calculateTeamPower(world, 'team1');
        const team2Power = this._calculateTeamPower(world, 'team2');

        const team1WinChance = team1Power / (team1Power + team2Power);

        // Log contest
        eventLog.log({
            type: EventLog.EventTypes.OBJECTIVE_CONTEST,
            tick: tick,
            objectiveType: 'monolith',
            objectiveName: monolith.name,
            team1Power,
            team2Power
        });

        // Determine winner
        let winner;
        const roll = rng.random();

        if (roll < team1WinChance) {
            if (rng.chance(this.config.stealChance * 0.8)) {  // Slightly lower steal chance on monolith
                winner = 'team2';
                eventLog.log({
                    type: EventLog.EventTypes.OBJECTIVE_STEAL,
                    tick: tick,
                    objectiveName: monolith.name,
                    stealingTeam: 'team2',
                    message: `${terminology.objectives.major.steal}`
                });
            } else {
                winner = 'team1';
            }
        } else {
            if (rng.chance(this.config.stealChance * 0.8)) {
                winner = 'team1';
                eventLog.log({
                    type: EventLog.EventTypes.OBJECTIVE_STEAL,
                    tick: tick,
                    objectiveName: monolith.name,
                    stealingTeam: 'team1',
                    message: `${terminology.objectives.major.steal}`
                });
            } else {
                winner = 'team2';
            }
        }

        // Apply powerful buff
        this._applyMonolithBuff(winner, tick, world);

        // Remove from available
        this.availablePrisms.splice(monolithIndex, 1);

        // Log secure
        eventLog.log({
            type: EventLog.EventTypes.OBJECTIVE_SECURE,
            tick: tick,
            objectiveType: 'monolith',
            objectiveName: monolith.name,
            winningTeam: winner,
            message: `${winner} ${terminology.objectives.major.secure}`
        });
    }

    /**
     * Calculate team power for objective contests
     */
    _calculateTeamPower(world, teamId) {
        const champions = world.queryByTags('champion', teamId);

        let totalPower = 0;

        for (const champion of champions) {
            const stats = champion.getComponent('stats');
            const hidden = champion.getComponent('hiddenStats');

            const ad = stats.effective_attack_damage || stats.attack_damage || 60;
            const ap = stats.effective_ability_power || stats.ability_power || 0;
            const health = stats.effective_max_health || stats.max_health || 550;

            const skillMultiplier = 1 + hidden.getEffectiveGameSense();

            totalPower += (ad + ap + health * 0.5) * skillMultiplier;
        }

        return totalPower;
    }

    /**
     * Apply prism buff to winning team
     */
    _applyPrismBuff(teamId, prism, tick, world) {
        const buff = {
            name: prism.name,
            type: prism.subtype,
            expiresAt: tick + this.config.prismBuffDuration,
            effects: this._getPrismEffects(prism.subtype)
        };

        this.teamBuffs[teamId].push(buff);

        // Apply buff to all team champions
        const champions = world.queryByTags('champion', teamId);
        for (const champion of champions) {
            const status = champion.getComponent('status');
            status.addBuff({
                type: `prism_${prism.subtype}`,
                source: 'objective',
                duration: this.config.prismBuffDuration,
                strength: 1.0,
                effects: buff.effects
            });
        }
    }

    /**
     * Apply Monolith buff to winning team
     */
    _applyMonolithBuff(teamId, tick, world) {
        const buff = {
            name: terminology.objectives.major.buff,
            type: 'monolith',
            expiresAt: 999,  // Permanent
            effects: {
                damage_increase: 0.20,
                defense_increase: 0.15,
                ability_haste: 30
            }
        };

        this.teamBuffs[teamId].push(buff);

        // Apply to all champions
        const champions = world.queryByTags('champion', teamId);
        for (const champion of champions) {
            const status = champion.getComponent('status');
            status.addBuff({
                type: 'monolith',
                source: 'objective',
                duration: 999,
                strength: 1.0,
                effects: buff.effects
            });
        }
    }

    /**
     * Get prism effects based on type
     */
    _getPrismEffects(prismType) {
        switch (prismType) {
            case 'refraction':  // Prism - ability haste
                return { ability_haste: 20 };
            case 'gravity':  // Vortex - damage
                return { damage_increase: 0.10 };
            case 'resonance':  // Echo - ability power
                return { ability_power: 30 };
            case 'current':  // Flow - speed
                return { movement_speed: 0.12, attack_speed: 0.15 };
            case 'chaos':  // Rift - random
                return { damage_increase: 0.08, defense_increase: 0.08 };
            default:
                return { damage_increase: 0.05 };
        }
    }

    /**
     * Update buff durations
     */
    _updateBuffs(world, tick) {
        for (const teamId of ['team1', 'team2']) {
            // Remove expired buffs
            this.teamBuffs[teamId] = this.teamBuffs[teamId].filter(buff => {
                return buff.expiresAt > tick;
            });
        }
    }

    /**
     * Get active buffs for a team
     */
    getTeamBuffs(teamId) {
        return this.teamBuffs[teamId] || [];
    }
}

module.exports = ObjectiveSystem;
