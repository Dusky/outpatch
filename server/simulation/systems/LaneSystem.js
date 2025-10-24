const EventLog = require('../engines/EventLog');
const { CLaneState } = require('../core/Component');

/**
 * LaneSystem - Manages lane phase mechanics
 *
 * Handles:
 * - Minion wave spawning and movement
 * - CS (creep score) mechanics
 * - Champion trading
 * - Lane pressure calculation
 * - Lane state tracking
 */
class LaneSystem {
    constructor() {
        this.lanes = ['top', 'mid', 'bot'];
        this.laneStates = new Map();

        // Lane config
        this.config = {
            minionWaveInterval: 2,  // Spawn wave every 2 ticks
            minionsPerWave: 6,
            minionGoldValue: 20,
            tradeBaseDamage: 80,
            tradeCooldown: 3,  // Can trade every 3 ticks
            csSkillThreshold: 0.6  // mechanical_skill above this gets bonus CS
        };
    }

    /**
     * Initialize lane states
     */
    initialize(world, eventLog) {
        for (const lane of this.lanes) {
            const laneState = new CLaneState(lane);
            this.laneStates.set(lane, laneState);

            // Store in world metadata
            world.setMetadata(`lane_${lane}`, laneState);
        }
    }

    /**
     * Update system - process lane phase each wave
     */
    update(world, rng, eventLog, phase) {
        if (phase !== 'early' && phase !== 'mid') {
            return;  // Lane system only active in early/mid game
        }

        const tick = world.getTick();
        const systemRng = rng.fork('lane');

        // Initialize if needed
        if (this.laneStates.size === 0) {
            this.initialize(world, eventLog);
        }

        // Spawn minion waves
        if (tick % this.config.minionWaveInterval === 0) {
            this._spawnMinionWaves(tick);
        }

        // Process each lane
        for (const lane of this.lanes) {
            const laneRng = systemRng.fork(lane);

            // Get champions in this lane
            const team1Champion = world.queryByTags('champion', 'team1', lane)[0];
            const team2Champion = world.queryByTags('champion', 'team2', lane)[0];

            if (!team1Champion || !team2Champion) continue;

            const laneState = this.laneStates.get(lane);

            // 1. CS (Creep Score) phase
            this._processCS(team1Champion, team2Champion, laneState, tick, eventLog, laneRng);

            // 2. Trading phase
            this._processTrades(team1Champion, team2Champion, laneState, tick, eventLog, laneRng);

            // 3. Update lane pressure
            this._updateLanePressure(laneState, team1Champion, team2Champion);

            // 4. Export lane pressure to world metadata (for StructureSystem)
            this._exportLanePressure(world, lane, laneState);

            // 5. Move minion waves
            this._updateMinionPositions(laneState, tick);
        }
    }

    /**
     * Spawn minion waves for all lanes
     */
    _spawnMinionWaves(tick) {
        for (const [lane, state] of this.laneStates) {
            state.minionWaves.team1.count += this.config.minionsPerWave;
            state.minionWaves.team2.count += this.config.minionsPerWave;
        }
    }

    /**
     * Process CS (last hitting minions)
     */
    _processCS(champ1, champ2, laneState, tick, eventLog, rng) {
        const stats1 = champ1.getComponent('stats');
        const stats2 = champ2.getComponent('stats');
        const hidden1 = champ1.getComponent('hiddenStats');
        const hidden2 = champ2.getComponent('hiddenStats');
        const identity1 = champ1.getComponent('identity');
        const identity2 = champ2.getComponent('identity');

        // Champion 1 CS attempt
        if (laneState.minionWaves.team2.count > 0) {
            const csChance = hidden1.getEffectiveMechanical();
            const csRoll = rng.random();

            if (csRoll < csChance) {
                const csCount = csChance > this.config.csSkillThreshold ? 2 : 1;
                const actualCS = Math.min(csCount, laneState.minionWaves.team2.count);

                stats1.cs += actualCS;
                stats1.gold += actualCS * this.config.minionGoldValue;
                laneState.minionWaves.team2.count -= actualCS;

                eventLog.log({
                    type: EventLog.EventTypes.LANE_CS,
                    tick: tick,
                    entityId: champ1.id,
                    championName: identity1.name,
                    teamId: identity1.teamId,
                    lane: laneState.lane,
                    csGained: actualCS,
                    goldGained: actualCS * this.config.minionGoldValue,
                    totalCS: stats1.cs
                });
            }
        }

        // Champion 2 CS attempt
        if (laneState.minionWaves.team1.count > 0) {
            const csChance = hidden2.getEffectiveMechanical();
            const csRoll = rng.random();

            if (csRoll < csChance) {
                const csCount = csChance > this.config.csSkillThreshold ? 2 : 1;
                const actualCS = Math.min(csCount, laneState.minionWaves.team1.count);

                stats2.cs += actualCS;
                stats2.gold += actualCS * this.config.minionGoldValue;
                laneState.minionWaves.team1.count -= actualCS;

                eventLog.log({
                    type: EventLog.EventTypes.LANE_CS,
                    tick: tick,
                    entityId: champ2.id,
                    championName: identity2.name,
                    teamId: identity2.teamId,
                    lane: laneState.lane,
                    csGained: actualCS,
                    goldGained: actualCS * this.config.minionGoldValue,
                    totalCS: stats2.cs
                });
            }
        }
    }

    /**
     * Process champion trades (poke/harass)
     */
    _processTrades(champ1, champ2, laneState, tick, eventLog, rng) {
        const stats1 = champ1.getComponent('stats');
        const stats2 = champ2.getComponent('stats');
        const hidden1 = champ1.getComponent('hiddenStats');
        const hidden2 = champ2.getComponent('hiddenStats');
        const identity1 = champ1.getComponent('identity');
        const identity2 = champ2.getComponent('identity');

        // Initialize trade cooldowns
        if (!stats1.lastTradeTick) stats1.lastTradeTick = 0;
        if (!stats2.lastTradeTick) stats2.lastTradeTick = 0;

        // Calculate trade favorability (who wins trades)
        const skill1 = hidden1.getEffectiveMechanical() + hidden1.getEffectiveGameSense();
        const skill2 = hidden2.getEffectiveMechanical() + hidden2.getEffectiveGameSense();

        const tradeDiff = skill1 - skill2;
        const tradeChance = 0.3 + (Math.abs(tradeDiff) * 0.2);  // 30-50% chance per wave

        // Determine who initiates trade
        const initiator = tradeDiff > 0 ? champ1 : champ2;
        const defender = initiator === champ1 ? champ2 : champ1;
        const initiatorStats = initiator.getComponent('stats');
        const defenderStats = defender.getComponent('stats');
        const initiatorIdentity = initiator.getComponent('identity');
        const defenderIdentity = defender.getComponent('identity');

        // Check if trade happens and cooldown is up
        if (rng.chance(tradeChance) && tick - initiatorStats.lastTradeTick >= this.config.tradeCooldown) {
            // Calculate damage (includes item stats)
            const initiatorAD = initiatorStats.effective_attack_damage || initiatorStats.attack_damage || 60;
            const defenderArmor = defenderStats.effective_armor || defenderStats.armor || 30;

            const baseDamage = this.config.tradeBaseDamage;
            const damageMultiplier = 1 + (initiatorAD - 60) / 100;
            const damageReduction = 100 / (100 + defenderArmor);

            const damage = Math.floor(baseDamage * damageMultiplier * damageReduction);

            // Apply damage
            defenderStats.health = Math.max(0, (defenderStats.health || 550) - damage);

            // Update cooldown
            initiatorStats.lastTradeTick = tick;

            // Log trade event
            eventLog.log({
                type: EventLog.EventTypes.LANE_TRADE,
                tick: tick,
                lane: laneState.lane,
                initiator: initiatorIdentity.name,
                initiatorTeam: initiatorIdentity.teamId,
                defender: defenderIdentity.name,
                defenderTeam: defenderIdentity.teamId,
                damage: damage,
                defenderHealth: defenderStats.health
            });

            // Check for kill (low health threshold)
            if (defenderStats.health <= 0) {
                this._processKill(initiator, defender, laneState, tick, eventLog);
            }
        }
    }

    /**
     * Process lane kill
     */
    _processKill(killer, victim, laneState, tick, eventLog) {
        const killerStats = killer.getComponent('stats');
        const victimStats = victim.getComponent('stats');
        const killerIdentity = killer.getComponent('identity');
        const victimIdentity = victim.getComponent('identity');
        const victimHidden = victim.getComponent('hiddenStats');

        // Update KDA
        killerStats.kda.kills++;
        victimStats.kda.deaths++;

        // Award gold (300 base + 100 per kill streak)
        const killGold = 300 + (killerStats.kda.kills * 100);
        killerStats.gold += killGold;

        // Increase victim tilt
        victimHidden.tilt_level = Math.min(1.0, victimHidden.tilt_level + 0.15);

        // Reset victim health
        victimStats.health = victimStats.effective_max_health || victimStats.max_health || 550;

        // Log kill event
        eventLog.log({
            type: EventLog.EventTypes.LANE_KILL,
            tick: tick,
            lane: laneState.lane,
            killerName: killerIdentity.name,
            killerTeam: killerIdentity.teamId,
            victimName: victimIdentity.name,
            victimTeam: victimIdentity.teamId,
            goldAwarded: killGold,
            killerKDA: `${killerStats.kda.kills}/${killerStats.kda.deaths}/${killerStats.kda.assists}`,
            victimKDA: `${victimStats.kda.kills}/${victimStats.kda.deaths}/${victimStats.kda.assists}`,
            victimTilt: victimHidden.tilt_level
        });
    }

    /**
     * Update lane pressure based on minion waves and CS
     */
    _updateLanePressure(laneState, champ1, champ2) {
        const stats1 = champ1.getComponent('stats');
        const stats2 = champ2.getComponent('stats');

        // Calculate pressure from minion waves
        const minionDiff = laneState.minionWaves.team1.count - laneState.minionWaves.team2.count;

        // Calculate pressure from CS lead
        const csDiff = stats1.cs - stats2.cs;

        // Calculate pressure from health lead
        const health1 = stats1.health || 550;
        const health2 = stats2.health || 550;
        const healthDiff = health1 - health2;

        // Combine factors
        laneState.pressure = (minionDiff * 0.05) + (csDiff * 0.02) + (healthDiff * 0.001);

        // Clamp to [-1, 1]
        laneState.pressure = Math.max(-1, Math.min(1, laneState.pressure));
    }

    /**
     * Update minion wave positions
     */
    _updateMinionPositions(laneState, tick) {
        // Minions move toward center based on wave balance
        const pushSpeed = 0.1;

        if (laneState.minionWaves.team1.count > laneState.minionWaves.team2.count) {
            laneState.minionWaves.team1.position = Math.min(1, laneState.minionWaves.team1.position + pushSpeed);
        } else if (laneState.minionWaves.team2.count > laneState.minionWaves.team1.count) {
            laneState.minionWaves.team2.position = Math.min(1, laneState.minionWaves.team2.position + pushSpeed);
        }

        // Minions fight each other and die
        if (laneState.minionWaves.team1.count > 0 && laneState.minionWaves.team2.count > 0) {
            const killed = Math.min(laneState.minionWaves.team1.count, laneState.minionWaves.team2.count);
            laneState.minionWaves.team1.count -= Math.min(killed, 2);
            laneState.minionWaves.team2.count -= Math.min(killed, 2);
        }
    }

    /**
     * Export lane pressure to world metadata (for other systems like StructureSystem)
     */
    _exportLanePressure(world, lane, laneState) {
        // Pressure is in range [-1, 1]
        // Positive = team1 has pressure, negative = team2 has pressure
        const pressure = laneState.pressure;

        if (pressure > 0) {
            // Team 1 has pressure advantage
            world.setMetadata(`${lane}_lane_pressure_team1`, pressure);
            world.setMetadata(`${lane}_lane_pressure_team2`, 0);
        } else if (pressure < 0) {
            // Team 2 has pressure advantage
            world.setMetadata(`${lane}_lane_pressure_team1`, 0);
            world.setMetadata(`${lane}_lane_pressure_team2`, Math.abs(pressure));
        } else {
            // Neutral
            world.setMetadata(`${lane}_lane_pressure_team1`, 0);
            world.setMetadata(`${lane}_lane_pressure_team2`, 0);
        }
    }

    /**
     * Get lane state for a specific lane
     */
    getLaneState(lane) {
        return this.laneStates.get(lane);
    }

    /**
     * Get all lane states
     */
    getAllLaneStates() {
        return Array.from(this.laneStates.values());
    }
}

module.exports = LaneSystem;
