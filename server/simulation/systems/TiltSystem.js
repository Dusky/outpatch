const EventLog = require('../engines/EventLog');

/**
 * TiltSystem - Manages psychological state and hidden stat effects
 *
 * Tilt increases from negative events (deaths, failed objectives, etc.)
 * Tilt decreases slowly over time if not stressed
 * High tilt reduces effective mechanical_skill and game_sense
 */
class TiltSystem {
    constructor() {
        this.config = {
            tiltDecayPerWave: 0.02,  // Natural recovery
            deathTiltIncrease: 0.15,  // Already applied in LaneSystem
            objectiveFailTilt: 0.10,
            objectiveSuccessTiltReduction: 0.05,
            mentalBoomThreshold: 0.7,
            confidenceImpactMultiplier: 0.2
        };
    }

    /**
     * Update system - process tilt decay and effects
     */
    update(world, rng, eventLog, phase) {
        const champions = world.queryByTag('champion');
        const tick = world.getTick();
        const systemRng = rng.fork('tilt');

        for (const champion of champions) {
            const identity = champion.getComponent('identity');
            const stats = champion.getComponent('stats');
            const hiddenStats = champion.getComponent('hiddenStats');
            const status = champion.getComponent('status');

            // Natural tilt decay
            this._applyTiltDecay(hiddenStats);

            // Update confidence based on performance
            this._updateConfidence(champion, stats, hiddenStats);

            // Check for mental boom
            if (hiddenStats.tilt_level >= this.config.mentalBoomThreshold) {
                this._checkMentalBoom(champion, tick, eventLog, systemRng);
            }

            // Apply tilt effects to status (visible to other systems)
            this._applyTiltEffects(champion, status, hiddenStats);
        }
    }

    /**
     * Natural tilt decay over time
     */
    _applyTiltDecay(hiddenStats) {
        if (hiddenStats.tilt_level > 0) {
            const decayAmount = this.config.tiltDecayPerWave * hiddenStats.tilt_resistance;
            hiddenStats.tilt_level = Math.max(0, hiddenStats.tilt_level - decayAmount);
        }
    }

    /**
     * Update confidence based on KDA and CS performance
     */
    _updateConfidence(champion, stats, hiddenStats) {
        const kills = stats.kda.kills;
        const deaths = stats.kda.deaths;
        const cs = stats.cs;

        // Calculate performance score
        let performanceScore = 0.5;  // Neutral baseline

        if (deaths > 0) {
            const kda = (kills + stats.kda.assists) / deaths;
            performanceScore = Math.min(1, kda / 5);  // 5+ KDA = max confidence
        } else if (kills > 0) {
            performanceScore = 0.8;  // Perfect KDA gives high confidence
        }

        // CS also affects confidence (minor)
        const expectedCS = champion.getComponent('identity').role === 'support' ? 0 : 50;
        const csRatio = Math.min(1, cs / expectedCS);
        performanceScore = (performanceScore * 0.7) + (csRatio * 0.3);

        // Smooth transition toward performance score
        const confidenceDelta = (performanceScore - hiddenStats.confidence) * 0.1;
        hiddenStats.confidence = Math.max(0, Math.min(1, hiddenStats.confidence + confidenceDelta));
    }

    /**
     * Check if champion reaches mental boom state
     */
    _checkMentalBoom(champion, tick, eventLog, rng) {
        const hiddenStats = champion.getComponent('hiddenStats');
        const identity = champion.getComponent('identity');

        // Already in mental boom?
        if (hiddenStats.mentalBoomActive) return;

        // Chance based on how far over threshold
        const overThreshold = hiddenStats.tilt_level - this.config.mentalBoomThreshold;
        const boomChance = overThreshold * 0.3;  // 30% per 0.1 over threshold

        if (rng.chance(boomChance)) {
            hiddenStats.mentalBoomActive = true;
            hiddenStats.mentalBoomDuration = rng.int(5, 10);  // Lasts 5-10 waves

            eventLog.log({
                type: EventLog.EventTypes.MENTAL_BOOM,
                tick: tick,
                entityId: champion.id,
                championName: identity.name,
                teamId: identity.teamId,
                tiltLevel: hiddenStats.tilt_level,
                duration: hiddenStats.mentalBoomDuration
            });
        }
    }

    /**
     * Apply tilt effects as status debuffs
     */
    _applyTiltEffects(champion, status, hiddenStats) {
        // Remove old tilt debuff
        status.debuffs = status.debuffs.filter(d => d.type !== 'tilt');

        // Apply tilt debuff if significant
        if (hiddenStats.tilt_level > 0.2) {
            status.addDebuff({
                type: 'tilt',
                source: 'psychological',
                duration: 999,  // Persistent
                strength: hiddenStats.tilt_level,
                effects: {
                    mechanical_skill_penalty: hiddenStats.tilt_level * 0.1,
                    game_sense_penalty: hiddenStats.tilt_level * 0.15
                }
            });
        }

        // Mental boom debuff
        if (hiddenStats.mentalBoomActive) {
            hiddenStats.mentalBoomDuration--;

            if (hiddenStats.mentalBoomDuration <= 0) {
                hiddenStats.mentalBoomActive = false;
            } else {
                // Apply severe penalties
                status.addDebuff({
                    type: 'mental_boom',
                    source: 'psychological',
                    duration: hiddenStats.mentalBoomDuration,
                    strength: 1.0,
                    effects: {
                        mechanical_skill_penalty: 0.3,
                        game_sense_penalty: 0.4,
                        damage_reduction: 0.15
                    }
                });
            }
        }

        // Confidence buff (if high confidence)
        if (hiddenStats.confidence > 0.7) {
            status.buffs = status.buffs.filter(b => b.type !== 'confidence');

            status.addBuff({
                type: 'confidence',
                source: 'psychological',
                duration: 999,
                strength: hiddenStats.confidence,
                effects: {
                    damage_increase: (hiddenStats.confidence - 0.5) * 0.2,
                    mechanical_skill_bonus: (hiddenStats.confidence - 0.5) * 0.1
                }
            });
        }
    }

    /**
     * Increase tilt for a champion (called by other systems)
     */
    increaseTilt(champion, amount, reason, tick, eventLog) {
        const hiddenStats = champion.getComponent('hiddenStats');
        const identity = champion.getComponent('identity');

        // Apply tilt resistance
        const actualIncrease = amount * (1 - hiddenStats.tilt_resistance * 0.5);

        const oldTilt = hiddenStats.tilt_level;
        hiddenStats.tilt_level = Math.min(1.0, hiddenStats.tilt_level + actualIncrease);

        // Log if significant change
        if (hiddenStats.tilt_level - oldTilt > 0.05) {
            eventLog.log({
                type: EventLog.EventTypes.TILT_INCREASE,
                tick: tick,
                entityId: champion.id,
                championName: identity.name,
                teamId: identity.teamId,
                amount: actualIncrease,
                newTilt: hiddenStats.tilt_level,
                reason: reason
            });
        }
    }

    /**
     * Decrease tilt for a champion (positive events)
     */
    decreaseTilt(champion, amount, reason, tick, eventLog) {
        const hiddenStats = champion.getComponent('hiddenStats');
        const identity = champion.getComponent('identity');

        const oldTilt = hiddenStats.tilt_level;
        hiddenStats.tilt_level = Math.max(0, hiddenStats.tilt_level - amount);

        if (oldTilt - hiddenStats.tilt_level > 0.03) {
            eventLog.log({
                type: EventLog.EventTypes.TILT_DECREASE,
                tick: tick,
                entityId: champion.id,
                championName: identity.name,
                teamId: identity.teamId,
                amount: amount,
                newTilt: hiddenStats.tilt_level,
                reason: reason
            });
        }
    }

    /**
     * Get effective stats after tilt penalties
     */
    getEffectiveStats(hiddenStats, status) {
        let mechanicalPenalty = 0;
        let gameSensePenalty = 0;
        let mechanicalBonus = 0;

        // Sum up all debuff effects
        for (const debuff of status.debuffs) {
            if (debuff.effects.mechanical_skill_penalty) {
                mechanicalPenalty += debuff.effects.mechanical_skill_penalty;
            }
            if (debuff.effects.game_sense_penalty) {
                gameSensePenalty += debuff.effects.game_sense_penalty;
            }
        }

        // Sum up buff effects
        for (const buff of status.buffs) {
            if (buff.effects.mechanical_skill_bonus) {
                mechanicalBonus += buff.effects.mechanical_skill_bonus;
            }
        }

        return {
            mechanical_skill: Math.max(0, hiddenStats.mechanical_skill - mechanicalPenalty + mechanicalBonus),
            game_sense: Math.max(0, hiddenStats.game_sense - gameSensePenalty),
            confidence: hiddenStats.confidence
        };
    }
}

module.exports = TiltSystem;
