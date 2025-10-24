const EventLog = require('../engines/EventLog');

/**
 * ObjectiveSystem - Manages void-themed major and minor objectives
 *
 * Handles:
 * - Rift Breaches (minor objectives) - spawn periodically, grant powerful buffs
 * - The Hungering Void (major objective) - spawns late game, game-changing buff
 * - Contest resolution based on team power
 * - Steal mechanics
 * - Buff application with real gameplay effects
 */
class ObjectiveSystem {
    constructor() {
        this.config = {
            riftSpawnWaves: [10, 20, 30, 40],  // Waves when rifts spawn
            voidSpawnWave: 40,  // Hungering Void spawns wave 40
            contestChance: 0.60,  // 60% chance teams contest rift
            voidContestChance: 0.75,  // 75% chance teams contest void
            stealChance: 0.12,  // 12% steal chance when losing
            riftBuffDuration: 10,  // Rift buffs last 10 waves
            voidBuffDuration: 5  // Void buff lasts 5 waves
        };

        // Define the four types of Rift Breaches
        this.riftTypes = [
            {
                id: 'reality_rift',
                name: 'Reality Rift',
                description: '+10% damage to all abilities',
                flavor: 'The fabric of reality warps, amplifying magical energies',
                icon: '🌌',
                effects: {
                    ability_damage_multiplier: 1.10
                }
            },
            {
                id: 'time_rift',
                name: 'Time Rift',
                description: '-20% cooldowns on all abilities',
                flavor: 'Time flows faster for those who breach it',
                icon: '⏰',
                effects: {
                    cooldown_reduction: 0.20
                }
            },
            {
                id: 'void_rift',
                name: 'Void Rift',
                description: '+500 HP to all champions',
                flavor: 'Void energy fortifies mortal forms',
                icon: '🕳️',
                effects: {
                    bonus_health: 500
                }
            },
            {
                id: 'chaos_rift',
                name: 'Chaos Rift',
                description: 'Random buff to each champion',
                flavor: 'Unpredictable chaos empowers the worthy',
                icon: '🌀',
                effects: {
                    chaos_mode: true
                }
            }
        ];

        this.availableObjectives = [];
        this.teamBuffs = {
            team1: [],
            team2: []
        };
    }

    /**
     * Set leveling system reference
     */
    setLevelingSystem(levelingSystem) {
        this.levelingSystem = levelingSystem;
    }

    /**
     * Update system - spawn and contest objectives
     */
    update(world, rng, eventLog, phase) {
        const tick = world.getTick();
        const systemRng = rng.fork('objectives');

        // Check for rift spawns
        if (this.config.riftSpawnWaves.includes(tick)) {
            this._spawnRiftBreach(tick, eventLog, systemRng);
        }

        // Check for Hungering Void spawn
        if (tick === this.config.voidSpawnWave) {
            this._spawnHungeringVoid(tick, eventLog);
        }

        // Contest available rifts
        const availableRift = this.availableObjectives.find(obj => obj.type === 'rift');
        if (availableRift && systemRng.chance(this.config.contestChance)) {
            this._contestRiftBreach(world, tick, eventLog, systemRng);
        }

        // Check for void contest
        const availableVoid = this.availableObjectives.find(obj => obj.type === 'void');
        if (availableVoid && systemRng.chance(this.config.voidContestChance)) {
            this._contestHungeringVoid(world, tick, eventLog, systemRng);
        }

        // Update buff durations
        this._updateBuffs(world, tick);
    }

    /**
     * Spawn a Rift Breach objective
     */
    _spawnRiftBreach(tick, eventLog, rng) {
        const riftType = rng.choice(this.riftTypes);

        const rift = {
            type: 'rift',
            subtype: riftType.id,
            name: riftType.name,
            description: riftType.description,
            flavor: riftType.flavor,
            icon: riftType.icon,
            effects: riftType.effects,
            spawnTick: tick
        };

        this.availableObjectives.push(rift);

        eventLog.log({
            type: EventLog.EventTypes.OBJECTIVE_START,
            tick: tick,
            objectiveType: 'rift',
            objectiveName: riftType.name,
            message: `${riftType.icon} ${riftType.name} has opened! ${riftType.description}`
        });
    }

    /**
     * Spawn The Hungering Void
     */
    _spawnHungeringVoid(tick, eventLog) {
        const voidObj = {
            type: 'void',
            name: 'The Hungering Void',
            description: 'Massive power awaits those brave enough to claim it',
            icon: '🌑',
            spawnTick: tick
        };

        this.availableObjectives.push(voidObj);

        eventLog.log({
            type: EventLog.EventTypes.OBJECTIVE_START,
            tick: tick,
            objectiveType: 'void',
            objectiveName: voidObj.name,
            message: `🌑 THE HUNGERING VOID AWAKENS! An ancient entity stirs in the abyss...`
        });
    }

    /**
     * Contest a Rift Breach
     */
    _contestRiftBreach(world, tick, eventLog, rng) {
        const riftIndex = this.availableObjectives.findIndex(obj => obj.type === 'rift');
        if (riftIndex === -1) return;

        const rift = this.availableObjectives[riftIndex];

        // Calculate team power
        const team1Power = this._calculateTeamPower(world, 'team1');
        const team2Power = this._calculateTeamPower(world, 'team2');

        const team1WinChance = team1Power / (team1Power + team2Power);

        // Log contest
        eventLog.log({
            type: EventLog.EventTypes.OBJECTIVE_CONTEST,
            tick: tick,
            objectiveType: 'rift',
            objectiveName: rift.name,
            team1Power,
            team2Power,
            message: `Both teams clash over ${rift.name}!`
        });

        // Determine winner with steal mechanic
        let winner;
        const roll = rng.random();

        if (roll < team1WinChance) {
            // Team 1 favored
            if (rng.chance(this.config.stealChance)) {
                winner = 'team2';  // Steal!
                eventLog.log({
                    type: EventLog.EventTypes.OBJECTIVE_STEAL,
                    tick: tick,
                    objectiveName: rift.name,
                    stealingTeam: 'team2',
                    message: `⚡ STEAL! Team 2 snatches ${rift.name} away!`
                });
            } else {
                winner = 'team1';
            }
        } else {
            // Team 2 favored
            if (rng.chance(this.config.stealChance)) {
                winner = 'team1';  // Steal!
                eventLog.log({
                    type: EventLog.EventTypes.OBJECTIVE_STEAL,
                    tick: tick,
                    objectiveName: rift.name,
                    stealingTeam: 'team1',
                    message: `⚡ STEAL! Team 1 snatches ${rift.name} away!`
                });
            } else {
                winner = 'team2';
            }
        }

        // Apply buff
        this._applyRiftBuff(winner, rift, tick, world, rng);

        // Remove from available
        this.availableObjectives.splice(riftIndex, 1);

        // Log secure
        eventLog.log({
            type: EventLog.EventTypes.OBJECTIVE_SECURE,
            tick: tick,
            objectiveType: 'rift',
            objectiveName: rift.name,
            winningTeam: winner,
            message: `${rift.icon} ${winner.toUpperCase()} secures ${rift.name}! ${rift.description}`
        });
    }

    /**
     * Contest The Hungering Void
     */
    _contestHungeringVoid(world, tick, eventLog, rng) {
        const voidIndex = this.availableObjectives.findIndex(obj => obj.type === 'void');
        if (voidIndex === -1) return;

        const voidObj = this.availableObjectives[voidIndex];

        // Calculate team power
        const team1Power = this._calculateTeamPower(world, 'team1');
        const team2Power = this._calculateTeamPower(world, 'team2');

        const team1WinChance = team1Power / (team1Power + team2Power);

        // Log contest
        eventLog.log({
            type: EventLog.EventTypes.OBJECTIVE_CONTEST,
            tick: tick,
            objectiveType: 'void',
            objectiveName: voidObj.name,
            team1Power,
            team2Power,
            message: `🌑 EPIC BATTLE! Both teams fight for The Hungering Void!`
        });

        // Determine winner (slightly lower steal chance on void)
        let winner;
        const roll = rng.random();

        if (roll < team1WinChance) {
            if (rng.chance(this.config.stealChance * 0.8)) {
                winner = 'team2';
                eventLog.log({
                    type: EventLog.EventTypes.OBJECTIVE_STEAL,
                    tick: tick,
                    objectiveName: voidObj.name,
                    stealingTeam: 'team2',
                    message: `🌑⚡ INCREDIBLE STEAL! Team 2 claims The Hungering Void!`
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
                    objectiveName: voidObj.name,
                    stealingTeam: 'team1',
                    message: `🌑⚡ INCREDIBLE STEAL! Team 1 claims The Hungering Void!`
                });
            } else {
                winner = 'team2';
            }
        }

        // Apply powerful buff
        this._applyVoidBuff(winner, tick, world, eventLog);

        // Remove from available
        this.availableObjectives.splice(voidIndex, 1);

        // Log secure
        eventLog.log({
            type: EventLog.EventTypes.OBJECTIVE_SECURE,
            tick: tick,
            objectiveType: 'void',
            objectiveName: voidObj.name,
            winningTeam: winner,
            message: `🌑 ${winner.toUpperCase()} IS VOID EMPOWERED! The ancient power courses through them!`
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

            // Only count alive champions
            if (stats.health <= 0) continue;

            const ad = stats.effective_attack_damage || stats.attack_damage || 60;
            const ap = stats.effective_ability_power || stats.ability_power || 0;
            const health = stats.health || 550;

            const skillMultiplier = 1 + hidden.getEffectiveGameSense();

            totalPower += (ad + ap + health * 0.5) * skillMultiplier;
        }

        return totalPower;
    }

    /**
     * Apply Rift Breach buff to winning team
     */
    _applyRiftBuff(teamId, rift, tick, world, rng) {
        const buff = {
            name: rift.name,
            type: rift.subtype,
            expiresAt: tick + this.config.riftBuffDuration,
            effects: rift.effects,
            icon: rift.icon
        };

        this.teamBuffs[teamId].push(buff);

        // Apply buff to all team champions
        const champions = world.queryByTags('champion', teamId);

        for (const champion of champions) {
            const stats = champion.getComponent('stats');
            const status = champion.getComponent('status');

            // Apply specific rift effects
            switch (rift.subtype) {
                case 'reality_rift':
                    // +10% ability damage
                    status.addBuff({
                        type: 'reality_rift',
                        source: 'rift_breach',
                        duration: this.config.riftBuffDuration,
                        strength: 1.0,
                        effects: { ability_damage_multiplier: 1.10 }
                    });
                    break;

                case 'time_rift':
                    // -20% cooldowns (handled by AbilitySystem)
                    status.addBuff({
                        type: 'time_rift',
                        source: 'rift_breach',
                        duration: this.config.riftBuffDuration,
                        strength: 1.0,
                        effects: { cooldown_reduction: 0.20 }
                    });
                    break;

                case 'void_rift':
                    // +500 HP
                    stats.max_health = (stats.max_health || 550) + 500;
                    stats.health = Math.min(stats.health + 500, stats.max_health);
                    status.addBuff({
                        type: 'void_rift',
                        source: 'rift_breach',
                        duration: this.config.riftBuffDuration,
                        strength: 1.0,
                        effects: { bonus_health: 500 }
                    });
                    break;

                case 'chaos_rift':
                    // Random buff for each champion
                    const chaosBuffs = [
                        { stat: 'attack_damage', value: 30, name: 'AD' },
                        { stat: 'ability_power', value: 50, name: 'AP' },
                        { stat: 'armor', value: 40, name: 'Armor' },
                        { stat: 'magic_resist', value: 40, name: 'MR' },
                        { stat: 'attack_speed', value: 0.30, name: 'AS', mult: true }
                    ];
                    const randomBuff = rng.choice(chaosBuffs);

                    if (randomBuff.mult) {
                        stats[randomBuff.stat] = (stats[randomBuff.stat] || 1.0) * (1 + randomBuff.value);
                    } else {
                        stats[randomBuff.stat] = (stats[randomBuff.stat] || 0) + randomBuff.value;
                    }

                    status.addBuff({
                        type: 'chaos_rift',
                        source: 'rift_breach',
                        duration: this.config.riftBuffDuration,
                        strength: 1.0,
                        effects: { chaos_buff: randomBuff.name }
                    });
                    break;
            }

            // Award objective XP
            if (this.levelingSystem) {
                this.levelingSystem.awardObjectiveXP(champion);
            }
        }
    }

    /**
     * Apply The Hungering Void buff to winning team
     */
    _applyVoidBuff(teamId, tick, world, eventLog) {
        const buff = {
            name: 'VOID EMPOWERED',
            type: 'hungering_void',
            expiresAt: tick + this.config.voidBuffDuration,
            effects: {
                all_stats_increase: 0.20,
                gold_bonus: 1500
            }
        };

        this.teamBuffs[teamId].push(buff);

        // Apply to all champions
        const champions = world.queryByTags('champion', teamId);

        for (const champion of champions) {
            const stats = champion.getComponent('stats');
            const status = champion.getComponent('status');

            // Grant 1500 gold per champion
            stats.gold = (stats.gold || 0) + 1500;

            // +20% all stats for 5 waves
            const baseDamage = stats.attack_damage || 60;
            const basePower = stats.ability_power || 0;
            const baseArmor = stats.armor || 30;
            const baseMR = stats.magic_resist || 30;
            const baseHealth = stats.max_health || 550;

            stats.effective_attack_damage = baseDamage * 1.20;
            stats.effective_ability_power = basePower * 1.20;
            stats.effective_armor = baseArmor * 1.20;
            stats.effective_magic_resist = baseMR * 1.20;
            stats.effective_max_health = baseHealth * 1.20;

            // Heal to full
            stats.health = stats.effective_max_health;

            status.addBuff({
                type: 'void_empowered',
                source: 'hungering_void',
                duration: this.config.voidBuffDuration,
                strength: 1.0,
                effects: {
                    all_stats_increase: 0.20,
                    gold_bonus: 1500,
                    minion_buff: true
                }
            });

            const identity = champion.getComponent('identity');
            eventLog.log({
                type: 'buff.applied',
                tick: tick,
                championName: identity.name,
                buffType: 'VOID EMPOWERED',
                message: `🌑 ${identity.name} is VOID EMPOWERED! (+20% all stats, +1500 gold)`
            });

            // Award objective XP (bonus for major objective)
            if (this.levelingSystem) {
                this.levelingSystem.awardObjectiveXP(champion);
                this.levelingSystem.awardObjectiveXP(champion); // Double XP for major objective
            }
        }
    }

    /**
     * Update buff durations and remove expired buffs
     */
    _updateBuffs(world, tick) {
        for (const teamId of ['team1', 'team2']) {
            // Check for expiring buffs
            const expiringBuffs = this.teamBuffs[teamId].filter(buff => buff.expiresAt === tick);

            // Remove stat bonuses when buffs expire
            for (const buff of expiringBuffs) {
                const champions = world.queryByTags('champion', teamId);

                for (const champion of champions) {
                    const stats = champion.getComponent('stats');

                    // Revert void rift health bonus
                    if (buff.type === 'void_rift') {
                        stats.max_health = (stats.max_health || 550) - 500;
                        stats.health = Math.min(stats.health, stats.max_health);
                    }

                    // Revert void empowerment
                    if (buff.type === 'hungering_void') {
                        delete stats.effective_attack_damage;
                        delete stats.effective_ability_power;
                        delete stats.effective_armor;
                        delete stats.effective_magic_resist;
                        delete stats.effective_max_health;
                    }
                }
            }

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

    /**
     * Check if team has specific buff active
     */
    hasBuffActive(teamId, buffType) {
        return this.teamBuffs[teamId].some(buff => buff.type === buffType);
    }

    /**
     * Get buff multiplier for ability damage (for Reality Rift)
     */
    getAbilityDamageMultiplier(champion) {
        const status = champion.getComponent('status');
        const buffs = status.getBuffs();

        let multiplier = 1.0;

        for (const buff of buffs) {
            if (buff.effects && buff.effects.ability_damage_multiplier) {
                multiplier *= buff.effects.ability_damage_multiplier;
            }
        }

        return multiplier;
    }

    /**
     * Get cooldown reduction (for Time Rift)
     */
    getCooldownReduction(champion) {
        const status = champion.getComponent('status');
        const buffs = status.getBuffs();

        let reduction = 0;

        for (const buff of buffs) {
            if (buff.effects && buff.effects.cooldown_reduction) {
                reduction += buff.effects.cooldown_reduction;
            }
        }

        return Math.min(reduction, 0.50); // Cap at 50% CDR
    }
}

module.exports = ObjectiveSystem;
