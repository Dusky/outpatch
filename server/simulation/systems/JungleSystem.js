const EventLog = require('../engines/EventLog');

/**
 * JungleSystem - Manages jungle champions and ganks
 *
 * Handles:
 * - Jungle camp clearing (gold/XP)
 * - Gank decision making
 * - Gank success based on lane state
 * - Countergank detection
 */
class JungleSystem {
    constructor() {
        this.config = {
            farmChance: 0.50,
            gankChance: 0.35,
            invadeChance: 0.15,
            campGoldValue: 40,
            gankSuccessBase: 0.30,
            lanePressureModifier: 0.15,  // Overextended lanes are easier to gank
            counterGankChance: 0.20
        };

        this.lastGankWave = new Map();  // Track cooldowns
    }

    /**
     * Update system - process jungle actions
     */
    update(world, rng, eventLog, phase) {
        const tick = world.getTick();
        const systemRng = rng.fork('jungle');

        // Get jungle champions
        const junglers = world.queryByTags('champion', 'jungle');

        for (const jungler of junglers) {
            const identity = jungler.getComponent('identity');
            const junglerRng = systemRng.fork(identity.id);

            // Check gank cooldown (can't gank every wave)
            const lastGank = this.lastGankWave.get(identity.id) || 0;
            if (tick - lastGank < 3) continue;  // 3 wave cooldown

            // Decide action
            const action = this._decideAction(jungler, junglerRng);

            switch (action) {
                case 'farm':
                    this._farmCamp(jungler, tick, eventLog, junglerRng);
                    break;
                case 'gank':
                    this._attemptGank(jungler, world, tick, eventLog, junglerRng);
                    break;
                case 'invade':
                    this._invadeJungle(jungler, tick, eventLog, junglerRng);
                    break;
            }
        }
    }

    /**
     * Decide jungler action based on game sense
     */
    _decideAction(jungler, rng) {
        const hidden = jungler.getComponent('hiddenStats');
        const gameSense = hidden.getEffectiveGameSense();

        // Higher game sense → better decision making
        let farmWeight = this.config.farmChance;
        let gankWeight = this.config.gankChance * (0.7 + gameSense * 0.6);  // Smart junglers gank more
        let invadeWeight = this.config.invadeChance;

        const roll = rng.float(0, farmWeight + gankWeight + invadeWeight);

        if (roll < farmWeight) return 'farm';
        if (roll < farmWeight + gankWeight) return 'gank';
        return 'invade';
    }

    /**
     * Farm a jungle camp
     */
    _farmCamp(jungler, tick, eventLog, rng) {
        const stats = jungler.getComponent('stats');
        const identity = jungler.getComponent('identity');

        // Jungle CS and gold
        const cs = rng.int(2, 4);
        const gold = cs * this.config.campGoldValue;

        stats.cs += cs;
        stats.gold += gold;

        eventLog.log({
            type: EventLog.EventTypes.JUNGLE_CAMP,
            tick: tick,
            entityId: jungler.id,
            championName: identity.name,
            teamId: identity.teamId,
            csGained: cs,
            goldGained: gold
        });
    }

    /**
     * Attempt a gank on a lane
     */
    _attemptGank(jungler, world, tick, eventLog, rng) {
        const identity = jungler.getComponent('identity');
        const hidden = jungler.getComponent('hiddenStats');
        const stats = jungler.getComponent('stats');

        // Select lane to gank
        const enemyTeam = identity.teamId === 'team1' ? 'team2' : 'team1';
        const lanes = ['top', 'mid', 'bot'];
        const targetLane = rng.choice(lanes);

        // Get lane state
        const laneState = world.getMetadata(`lane_${targetLane}`);

        // Determine gank success chance
        let successChance = this.config.gankSuccessBase;

        // Lane pressure affects gank success
        if (laneState) {
            const pressure = laneState.pressure;

            // If your team is pushing (positive pressure for team1), enemy is overextended
            if (identity.teamId === 'team1' && pressure > 0.3) {
                successChance += this.config.lanePressureModifier;
            } else if (identity.teamId === 'team2' && pressure < -0.3) {
                successChance += this.config.lanePressureModifier;
            }
        }

        // Mechanical skill affects gank execution
        successChance += hidden.getEffectiveMechanical() * 0.2;

        // Check for countergank
        const enemyJunglers = world.queryByTags('champion', 'jungle', enemyTeam);
        const counterGanked = enemyJunglers.length > 0 && rng.chance(this.config.counterGankChance);

        if (counterGanked) {
            this._resolveCountergank(jungler, enemyJunglers[0], targetLane, tick, eventLog, rng);
            return;
        }

        // Attempt gank
        if (rng.chance(successChance)) {
            // Successful gank - get kill
            const victim = this._getGankVictim(targetLane, enemyTeam, world);

            if (victim) {
                this._processGankKill(jungler, victim, targetLane, tick, eventLog);
                this.lastGankWave.set(identity.id, tick);
            }
        } else {
            // Failed gank - just pressure
            eventLog.log({
                type: EventLog.EventTypes.JUNGLE_GANK,
                tick: tick,
                gankerId: jungler.id,
                gankerName: identity.name,
                gankerTeam: identity.teamId,
                lane: targetLane,
                success: false
            });
        }
    }

    /**
     * Get gank victim from target lane
     */
    _getGankVictim(lane, enemyTeam, world) {
        const laneChampions = world.queryByTags('champion', enemyTeam, lane);
        return laneChampions[0];  // Return first champion in lane
    }

    /**
     * Process successful gank kill
     */
    _processGankKill(jungler, victim, lane, tick, eventLog) {
        const junglerStats = jungler.getComponent('stats');
        const junglerIdentity = jungler.getComponent('identity');
        const victimStats = victim.getComponent('stats');
        const victimIdentity = victim.getComponent('identity');
        const victimHidden = victim.getComponent('hiddenStats');

        // Assign kill
        junglerStats.kda.kills++;

        // Assign death
        victimStats.kda.deaths++;

        // Gold reward
        const killGold = 300 + (victimStats.kda.kills * 100);
        junglerStats.gold += killGold;

        // Increase victim tilt
        victimHidden.tilt_level = Math.min(1.0, victimHidden.tilt_level + 0.20);  // Ganks are more tilting

        // Reset victim health
        victimStats.health = victimStats.effective_max_health || victimStats.max_health || 550;

        // Log gank
        eventLog.log({
            type: EventLog.EventTypes.JUNGLE_GANK,
            tick: tick,
            gankerId: jungler.id,
            gankerName: junglerIdentity.name,
            gankerTeam: junglerIdentity.teamId,
            victimId: victim.id,
            victimName: victimIdentity.name,
            victimTeam: victimIdentity.teamId,
            lane: lane,
            success: true,
            goldAwarded: killGold
        });
    }

    /**
     * Resolve countergank scenario
     */
    _resolveCountergank(ganker, counterGanker, lane, tick, eventLog, rng) {
        const gankerIdentity = ganker.getComponent('identity');
        const gankerHidden = ganker.getComponent('hiddenStats');
        const gankerStats = ganker.getComponent('stats');

        const counterIdentity = counterGanker.getComponent('identity');
        const counterHidden = counterGanker.getComponent('hiddenStats');
        const counterStats = counterGanker.getComponent('stats');

        // Compare skill
        const gankerPower = gankerHidden.getEffectiveMechanical() + gankerHidden.getEffectiveGameSense();
        const counterPower = counterHidden.getEffectiveMechanical() + counterHidden.getEffectiveGameSense();

        const gankerWinChance = gankerPower / (gankerPower + counterPower);

        let winner, loser;
        if (rng.chance(gankerWinChance)) {
            winner = ganker;
            loser = counterGanker;
        } else {
            winner = counterGanker;
            loser = ganker;
        }

        const winnerStats = winner.getComponent('stats');
        const winnerIdentity = winner.getComponent('identity');
        const loserStats = loser.getComponent('stats');
        const loserIdentity = loser.getComponent('identity');
        const loserHidden = loser.getComponent('hiddenStats');

        // Assign KDA
        winnerStats.kda.kills++;
        loserStats.kda.deaths++;

        // Gold
        const killGold = 300;
        winnerStats.gold += killGold;

        // Tilt
        loserHidden.tilt_level = Math.min(1.0, loserHidden.tilt_level + 0.15);

        // Reset loser health
        loserStats.health = loserStats.effective_max_health || loserStats.max_health || 550;

        // Log countergank
        eventLog.log({
            type: EventLog.EventTypes.JUNGLE_COUNTERGANK,
            tick: tick,
            gankerId: ganker.id,
            gankerName: gankerIdentity.name,
            gankerTeam: gankerIdentity.teamId,
            counterGankerId: counterGanker.id,
            counterGankerName: counterIdentity.name,
            counterGankerTeam: counterIdentity.teamId,
            lane: lane,
            winnerName: winnerIdentity.name,
            winnerTeam: winnerIdentity.teamId,
            goldAwarded: killGold
        });
    }

    /**
     * Invade enemy jungle
     */
    _invadeJungle(jungler, tick, eventLog, rng) {
        const stats = jungler.getComponent('stats');
        const identity = jungler.getComponent('identity');

        // Risky but rewarding
        if (rng.chance(0.7)) {
            // Successful invade
            const cs = rng.int(3, 6);
            const gold = cs * this.config.campGoldValue * 1.5;  // 50% bonus for invading

            stats.cs += cs;
            stats.gold += gold;

            eventLog.log({
                type: 'jungle.invade',
                tick: tick,
                entityId: jungler.id,
                championName: identity.name,
                teamId: identity.teamId,
                success: true,
                csGained: cs,
                goldGained: gold
            });
        } else {
            // Caught invading - lose time
            eventLog.log({
                type: 'jungle.invade',
                tick: tick,
                entityId: jungler.id,
                championName: identity.name,
                teamId: identity.teamId,
                success: false
            });
        }
    }
}

module.exports = JungleSystem;
