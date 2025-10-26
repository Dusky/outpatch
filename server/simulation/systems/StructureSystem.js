const EventLog = require('../engines/EventLog');
const terminology = require('../data/terminology.json');
const Entity = require('../core/Entity');
const { CIdentity, CStats } = require('../core/Component');

/**
 * StructureSystem - Manages towers/spires and win conditions
 *
 * Structure Layout (per team):
 * - 3 lanes (top, mid, bot)
 * - 3 Spires per lane = 9 total
 * - 3 Gateways (1 per lane) = 3 total
 * - The Core = 1
 * Total: 13 structures per team
 *
 * Win Condition:
 * - The Core must be destroyed to win
 * - Gateways must be destroyed before The Core is vulnerable
 * - At least 1 Spire in a lane must be destroyed before Gateway is vulnerable
 *
 * Damage Sources:
 * - Minion waves deal damage to Spires
 * - Lane pressure affects damage rate
 * - Team with momentum deals more structure damage
 */
class StructureSystem {
    constructor() {
        this.config = {
            // Spire (tower) stats - tuned for ~40 wave matches
            spireHealth: 600,  // Reduced for match pacing
            spireArmor: 20,    // Lower armor = faster destruction

            // Gateway (inhibitor) stats
            gatewayHealth: 800,   // Reduced
            gatewayArmor: 30,     // Reduced

            // The Core (nexus) stats
            coreHealth: 1200,     // Reduced for faster endings
            coreArmor: 40,        // Reduced

            // Damage rates (per wave with minions present)
            // Math: 150 base damage * 0.83 reduction (20 armor) = ~125 dmg/wave
            // Spire destroyed in: 600/125 = ~5 waves per spire
            // 9 spires + 3 gateways + 1 core in ~25-30 waves
            baseMinionDamage: 150,  // Increased for faster structure destruction
            pressureMultiplier: 2.5,  // Strong pressure bonus for winning team

            // Timing
            minWaveForStructureDamage: 3,  // Structures can be damaged earlier
            gatewayRespawnWaves: 999,  // Gateways don't respawn (permanent destruction)
        };

        this.structureEntities = new Map();  // entityId -> entity
        this.laneStructureState = {
            team1: { top: [], mid: [], bot: [] },
            team2: { top: [], mid: [], bot: [] }
        };
    }

    /**
     * Initialize structures for both teams
     */
    initialize(world) {
        // Create structures for both teams
        for (const teamId of ['team1', 'team2']) {
            this._createTeamStructures(world, teamId);
        }
    }

    /**
     * Create all structures for a team
     */
    _createTeamStructures(world, teamId) {
        const lanes = ['top', 'mid', 'bot'];

        // Create Spires (3 per lane)
        for (const lane of lanes) {
            for (let tier = 1; tier <= 3; tier++) {
                const spire = this._createStructureEntity(
                    teamId,
                    lane,
                    'spire',
                    tier,
                    this.config.spireHealth
                );
                world.addEntity(spire);
                this.structureEntities.set(spire.id, spire);
                this.laneStructureState[teamId][lane].push(spire.id);
            }
        }

        // Create Gateways (1 per lane)
        for (const lane of lanes) {
            const gateway = this._createStructureEntity(
                teamId,
                lane,
                'gateway',
                1,
                this.config.gatewayHealth
            );
            world.addEntity(gateway);
            this.structureEntities.set(gateway.id, gateway);
            this.laneStructureState[teamId][lane].push(gateway.id);
        }

        // Create The Core
        const core = this._createStructureEntity(
            teamId,
            'base',
            'core',
            1,
            this.config.coreHealth
        );
        world.addEntity(core);
        this.structureEntities.set(core.id, core);
    }

    /**
     * Create a structure entity
     */
    _createStructureEntity(teamId, lane, type, tier, health) {
        const entity = new Entity();

        const structureId = `${teamId}-${lane}-${type}-${tier}`;

        entity.addComponent('identity', new CIdentity({
            id: structureId,
            name: this._getStructureName(type, lane, tier),
            teamId: teamId,
            structureType: type,
            lane: lane,
            tier: tier
        }));

        entity.addComponent('stats', new CStats({
            health: health,
            maxHealth: health,
            armor: this._getStructureArmor(type),
            isAlive: true,
            isVulnerable: type === 'spire'  // Spires are always vulnerable, others need prerequisites
        }));

        entity.addTag('structure');
        entity.addTag(teamId);
        entity.addTag(type);
        entity.addTag(lane);

        return entity;
    }

    /**
     * Get structure name from terminology
     */
    _getStructureName(type, lane, tier) {
        const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

        if (type === 'spire') {
            return `${capitalize(lane)} ${terminology.structures.tower.name} ${tier}`;
        } else if (type === 'gateway') {
            return `${capitalize(lane)} ${terminology.structures.inhibitor.name}`;
        } else if (type === 'core') {
            return terminology.structures.nexus.name;
        }
        return 'Unknown Structure';
    }

    /**
     * Get armor value by structure type
     */
    _getStructureArmor(type) {
        switch (type) {
            case 'spire': return this.config.spireArmor;
            case 'gateway': return this.config.gatewayArmor;
            case 'core': return this.config.coreArmor;
            default: return 0;
        }
    }

    /**
     * System update - process structure damage
     */
    update(world, rng, eventLog, phase) {
        const tick = world.getTick();

        // Don't damage structures too early
        if (tick < this.config.minWaveForStructureDamage) {
            return;
        }

        // Update structure vulnerability
        this._updateStructureVulnerability(world);

        // Process damage for each lane
        for (const lane of ['top', 'mid', 'bot']) {
            this._processLaneDamage(world, lane, tick, eventLog, rng);
        }

        // Check for core damage (special case)
        this._processCoreVulnerability(world, tick, eventLog, rng);
    }

    /**
     * Update which structures are vulnerable to damage
     */
    _updateStructureVulnerability(world) {
        for (const teamId of ['team1', 'team2']) {
            for (const lane of ['top', 'mid', 'bot']) {
                const structures = world.queryByTags('structure', teamId, lane);

                // Find first alive structure in lane (front-to-back)
                let foundFirstAlive = false;
                for (const structure of structures) {
                    const stats = structure.getComponent('stats');
                    const identity = structure.getComponent('identity');

                    if (stats.isAlive && !foundFirstAlive && identity.structureType !== 'core') {
                        stats.isVulnerable = true;
                        foundFirstAlive = true;
                    } else if (identity.structureType !== 'core') {
                        stats.isVulnerable = false;
                    }
                }
            }
        }
    }

    /**
     * Process damage to structures in a lane
     */
    _processLaneDamage(world, lane, tick, eventLog, rng) {
        const systemRng = rng.fork(`structure-${lane}`);

        // Get lane pressure (from world metadata, set by LaneSystem)
        const team1Pressure = world.getMetadata(`${lane}_lane_pressure_team1`) || 0;
        const team2Pressure = world.getMetadata(`${lane}_lane_pressure_team2`) || 0;

        // Team with higher pressure damages enemy structures
        if (team1Pressure > team2Pressure) {
            this._damageTeamStructures(world, 'team2', lane, team1Pressure - team2Pressure, tick, eventLog, systemRng);
        } else if (team2Pressure > team1Pressure) {
            this._damageTeamStructures(world, 'team1', lane, team2Pressure - team1Pressure, tick, eventLog, systemRng);
        }
    }

    /**
     * Damage structures for a team in a lane
     */
    _damageTeamStructures(world, teamId, lane, pressureAdvantage, tick, eventLog, rng) {
        // Find vulnerable structures in this lane
        const structures = world.queryByTags('structure', teamId, lane);

        for (const structure of structures) {
            const stats = structure.getComponent('stats');
            const identity = structure.getComponent('identity');

            // Only damage vulnerable, alive structures
            if (!stats.isVulnerable || !stats.isAlive) {
                continue;
            }

            // Calculate damage
            let damage = this.config.baseMinionDamage;

            // Apply pressure multiplier
            if (pressureAdvantage > 0.3) {
                damage *= this.config.pressureMultiplier;
            }

            // Apply armor reduction
            const damageReduction = stats.armor / (100 + stats.armor);
            damage *= (1 - damageReduction);

            // Apply damage
            stats.health -= damage;

            // Check for destruction
            if (stats.health <= 0) {
                stats.health = 0;
                stats.isAlive = false;
                stats.isVulnerable = false;

                this._onStructureDestroyed(world, structure, tick, eventLog);
            }
        }
    }

    /**
     * Handle structure destruction
     */
    _onStructureDestroyed(world, structure, tick, eventLog) {
        const identity = structure.getComponent('identity');
        const enemyTeamId = identity.teamId === 'team1' ? 'team2' : 'team1';

        // Log destruction event
        eventLog.log({
            type: EventLog.EventTypes.STRUCTURE_DESTROYED,
            tick: tick,
            structureType: identity.structureType,
            structureName: identity.name,
            lane: identity.lane,
            teamId: identity.teamId,
            message: `${identity.name} destroyed!`
        });

        // Grant gold to enemy team
        const goldReward = this._getStructureGoldReward(identity.structureType);
        this._grantTeamGold(world, enemyTeamId, goldReward, eventLog, tick);

        // Special effects for Gateways
        if (identity.structureType === 'gateway') {
            eventLog.log({
                type: EventLog.EventTypes.GATEWAY_DESTROYED,
                tick: tick,
                lane: identity.lane,
                teamId: enemyTeamId,
                message: `${enemyTeamId} destroyed ${identity.lane} Gateway! Super minions incoming!`
            });
        }

        // Update structure counts in world metadata
        this._updateStructureCounts(world);
    }

    /**
     * Get gold reward for structure destruction
     */
    _getStructureGoldReward(structureType) {
        switch (structureType) {
            case 'spire': return 200;  // Split among team
            case 'gateway': return 150;
            case 'core': return 0;  // Game over, no gold needed
            default: return 0;
        }
    }

    /**
     * Grant gold to all team members
     */
    _grantTeamGold(world, teamId, amount, eventLog, tick) {
        const champions = world.queryByTags('champion', teamId);
        const perChampionGold = Math.floor(amount / champions.length);

        for (const champion of champions) {
            const stats = champion.getComponent('stats');
            stats.gold += perChampionGold;
        }
    }

    /**
     * Update structure counts in world metadata
     */
    _updateStructureCounts(world) {
        for (const teamId of ['team1', 'team2']) {
            const structures = world.queryByTags('structure', teamId);
            let aliveCount = 0;

            for (const structure of structures) {
                const stats = structure.getComponent('stats');
                if (stats.isAlive) {
                    aliveCount++;
                }
            }

            world.setMetadata(`${teamId}Structures`, aliveCount);
        }
    }

    /**
     * Process core vulnerability and damage
     */
    _processCoreVulnerability(world, tick, eventLog, rng) {
        for (const teamId of ['team1', 'team2']) {
            const core = world.queryByTags('structure', teamId, 'core')[0];
            if (!core) continue;

            const stats = core.getComponent('stats');
            if (!stats.isAlive) continue;

            // Check if any gateways are destroyed
            const gateways = world.queryByTags('structure', teamId, 'gateway');
            const anyGatewayDown = gateways.some(gw => !gw.getComponent('stats').isAlive);

            // Core is vulnerable if at least one gateway is down
            if (anyGatewayDown) {
                stats.isVulnerable = true;

                // Apply siege damage if enemy team has map control
                const enemyTeamId = teamId === 'team1' ? 'team2' : 'team1';
                const mapControl = this._calculateMapControl(world, enemyTeamId);

                if (mapControl > 0.2) {  // Lower threshold - even one lane with pressure can chip Core
                    // Core takes damage
                    const damage = this.config.baseMinionDamage * mapControl;  // Scale with map control
                    stats.health -= damage;

                    if (stats.health <= 0) {
                        stats.health = 0;
                        stats.isAlive = false;

                        this._onCoreDestroyed(world, core, enemyTeamId, tick, eventLog);
                    }
                }
            }
        }
    }

    /**
     * Calculate team's map control (0-1)
     */
    _calculateMapControl(world, teamId) {
        const lanes = ['top', 'mid', 'bot'];
        let totalPressure = 0;

        for (const lane of lanes) {
            const pressure = world.getMetadata(`${lane}_lane_pressure_${teamId}`) || 0;
            totalPressure += pressure;
        }

        return totalPressure / lanes.length;
    }

    /**
     * Handle core destruction (GAME OVER)
     */
    _onCoreDestroyed(world, core, winningTeam, tick, eventLog) {
        const identity = core.getComponent('identity');

        eventLog.log({
            type: EventLog.EventTypes.MATCH_END,
            tick: tick,
            winner: winningTeam,
            loser: identity.teamId,
            message: `${winningTeam} destroyed ${terminology.structures.nexus.name}!`,
            victory: true
        });

        // Set winner in world metadata
        world.setMetadata('matchWinner', winningTeam);
        world.setMetadata('matchOver', true);
    }

    /**
     * Check win condition
     */
    checkWinCondition(world) {
        const matchOver = world.getMetadata('matchOver');
        const winner = world.getMetadata('matchWinner');

        if (matchOver) {
            return winner;
        }

        return null;
    }

    /**
     * Get structure stats for debugging
     */
    getStructureStats(world) {
        const stats = {
            team1: { spires: 0, gateways: 0, core: 1 },
            team2: { spires: 0, gateways: 0, core: 1 }
        };

        for (const teamId of ['team1', 'team2']) {
            const structures = world.queryByTags('structure', teamId);

            for (const structure of structures) {
                const identity = structure.getComponent('identity');
                const structStats = structure.getComponent('stats');

                if (structStats.isAlive) {
                    if (identity.structureType === 'spire') {
                        stats[teamId].spires++;
                    } else if (identity.structureType === 'gateway') {
                        stats[teamId].gateways++;
                    }
                }
            }

            // Check if core is alive
            const core = world.queryByTags('structure', teamId, 'core')[0];
            if (core) {
                const coreStats = core.getComponent('stats');
                stats[teamId].core = coreStats.isAlive ? 1 : 0;
            }
        }

        return stats;
    }
}

module.exports = StructureSystem;
