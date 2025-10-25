const EventLog = require('../engines/EventLog');

/**
 * LevelingSystem - Manages champion XP and leveling during matches
 *
 * Champions gain XP from:
 * - CS (minion kills): 50 XP each
 * - Kills: 300 XP
 * - Assists: 150 XP
 * - Objectives: 200 XP
 *
 * Level cap: 18
 * Each level grants: +HP, +AD, +AP, +Armor, +MR
 */
class LevelingSystem {
    constructor() {
        this.config = {
            maxLevel: 18,
            xpPerCS: 50,
            xpPerKill: 300,
            xpPerAssist: 150,
            xpPerObjective: 200,

            // Stats per level
            hpPerLevel: 85,
            adPerLevel: 3,
            apPerLevel: 5,
            armorPerLevel: 3.5,
            mrPerLevel: 1.25,

            // Ability unlock levels
            abilityUnlocks: {
                q: 1,
                w: 3,
                e: 5,
                r: 6
            },

            maxAbilityRanks: {
                q: 5,
                w: 5,
                e: 5,
                r: 3
            }
        };

        // XP required for each level (cumulative)
        this.xpTable = this._generateXPTable();
    }

    /**
     * Generate XP requirements table (levels 1-18)
     */
    _generateXPTable() {
        const table = [0]; // Level 1 requires 0 XP

        // Formula: level 2 needs 280, scaling up
        for (let level = 2; level <= this.config.maxLevel; level++) {
            const prevXP = table[level - 2] || 0;
            const xpForLevel = 280 + ((level - 2) * 100); // 280, 380, 480, 580...
            table.push(prevXP + xpForLevel);
        }

        return table;
    }

    /**
     * Update system - process XP gains and level ups
     */
    update(world, rng, eventLog, phase) {
        const tick = world.getTick();
        const champions = world.queryByTag('champion');

        for (const champion of champions) {
            const stats = champion.getComponent('stats');
            const leveling = champion.getComponent('leveling');

            if (!leveling) continue;

            // Check for pending XP gains
            if (leveling.pendingXP > 0) {
                this._grantXP(champion, leveling.pendingXP, tick, eventLog);
                leveling.pendingXP = 0;
            }

            // Check if can level up
            if (leveling.level < this.config.maxLevel) {
                const nextLevelXP = this.xpTable[leveling.level]; // Current level index = next level requirement

                if (leveling.xp >= nextLevelXP) {
                    this._levelUp(champion, tick, eventLog);
                }
            }
        }
    }

    /**
     * Grant XP to champion
     */
    _grantXP(champion, amount, tick, eventLog) {
        const leveling = champion.getComponent('leveling');
        const identity = champion.getComponent('identity');

        leveling.xp += amount;

        eventLog.log({
            type: 'leveling.xp_gain',
            tick: tick,
            championName: identity.name,
            xpGained: amount,
            totalXP: leveling.xp,
            currentLevel: leveling.level
        });
    }

    /**
     * Level up champion
     */
    _levelUp(champion, tick, eventLog) {
        const leveling = champion.getComponent('leveling');
        const stats = champion.getComponent('stats');
        const identity = champion.getComponent('identity');
        const abilities = champion.getComponent('abilities');

        leveling.level++;

        // Grant stat bonuses
        stats.max_health += this.config.hpPerLevel;
        stats.health += this.config.hpPerLevel; // Also heal for the bonus HP
        stats.attack_damage = (stats.attack_damage || 60) + this.config.adPerLevel;
        stats.ability_power = (stats.ability_power || 0) + this.config.apPerLevel;
        stats.armor = (stats.armor || 30) + this.config.armorPerLevel;
        stats.magic_resist = (stats.magic_resist || 30) + this.config.mrPerLevel;

        // Check for ability unlocks
        const unlockedAbilities = [];
        for (const [slot, unlockLevel] of Object.entries(this.config.abilityUnlocks)) {
            if (leveling.level === unlockLevel) {
                if (abilities && abilities.available) {
                    abilities.available[slot] = true;
                    unlockedAbilities.push(slot.toUpperCase());
                }
            }
        }

        // Check for power spike
        const powerSpike = this._checkPowerSpike(champion);

        eventLog.log({
            type: EventLog.EventTypes.LEVEL_UP || 'leveling.level_up',
            tick: tick,
            championName: identity.name,
            newLevel: leveling.level,
            statsGained: {
                hp: this.config.hpPerLevel,
                ad: this.config.adPerLevel,
                ap: this.config.apPerLevel,
                armor: this.config.armorPerLevel,
                mr: this.config.mrPerLevel
            },
            unlockedAbilities,
            powerSpike
        });
    }

    /**
     * Check if champion hit a power spike level
     */
    _checkPowerSpike(champion) {
        const leveling = champion.getComponent('leveling');
        const hiddenStats = champion.getComponent('hiddenStats');

        // Power spikes at: 2, 6 (ult), 9, 11 (ult rank 2), 13, 16 (ult rank 3)
        const powerSpikeLevels = [2, 6, 9, 11, 13, 16];

        if (!powerSpikeLevels.includes(leveling.level)) {
            return null;
        }

        // Determine if this champion is early/mid/late game
        const powerCurve = hiddenStats.power_curve || 'mid';

        if (leveling.level === 6) {
            return { type: 'ultimate_unlock', strength: 'major' };
        }

        if (leveling.level === 2 && powerCurve === 'early') {
            return { type: 'early_spike', strength: 'major' };
        }

        if (leveling.level >= 11 && powerCurve === 'late') {
            return { type: 'late_spike', strength: 'major' };
        }

        if (leveling.level === 16) {
            return { type: 'max_rank_ult', strength: 'moderate' };
        }

        return { type: 'general_spike', strength: 'minor' };
    }

    /**
     * Award XP for CS
     */
    awardCSXP(champion) {
        const leveling = champion.getComponent('leveling');
        if (leveling) {
            leveling.pendingXP = (leveling.pendingXP || 0) + this.config.xpPerCS;
        }
    }

    /**
     * Award XP for kill
     */
    awardKillXP(champion) {
        const leveling = champion.getComponent('leveling');
        if (leveling) {
            leveling.pendingXP = (leveling.pendingXP || 0) + this.config.xpPerKill;
        }
    }

    /**
     * Award XP for assist
     */
    awardAssistXP(champion) {
        const leveling = champion.getComponent('leveling');
        if (leveling) {
            leveling.pendingXP = (leveling.pendingXP || 0) + this.config.xpPerAssist;
        }
    }

    /**
     * Award XP for objective
     */
    awardObjectiveXP(champion) {
        const leveling = champion.getComponent('leveling');
        if (leveling) {
            leveling.pendingXP = (leveling.pendingXP || 0) + this.config.xpPerObjective;
        }
    }

    /**
     * Get XP needed for next level
     */
    getXPForNextLevel(champion) {
        const leveling = champion.getComponent('leveling');
        if (!leveling || leveling.level >= this.config.maxLevel) {
            return null;
        }

        const nextLevelXP = this.xpTable[leveling.level];
        const current = leveling.xp;
        return nextLevelXP - current;
    }

    /**
     * Check if ability is unlocked at current level
     */
    isAbilityUnlocked(champion, slot) {
        const leveling = champion.getComponent('leveling');
        const abilities = champion.getComponent('abilities');

        if (!leveling || !abilities || !abilities.available) {
            return false;
        }

        return abilities.available[slot] === true;
    }

    /**
     * Get champion level
     */
    getLevel(champion) {
        const leveling = champion.getComponent('leveling');
        return leveling ? leveling.level : 1;
    }
}

module.exports = LevelingSystem;
