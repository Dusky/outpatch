const EventLog = require('../engines/EventLog');

/**
 * TeamfightSystem - Manages team fights with positioning and targeting
 *
 * Handles:
 * - Fight detection (multiple champions in proximity)
 * - Positioning (frontline vs backline)
 * - Target selection (priority system)
 * - Damage calculation with items
 * - Kill order resolution
 * - KDA tracking
 */
class TeamfightSystem {
    constructor() {
        // Reference to AbilitySystem (set externally)
        this.abilitySystem = null;

        this.config = {
            fightTriggerChance: {
                early: 0,      // No fights in early game (wave 1-20)
                mid: 0.30,     // 30% chance mid game (wave 21-40)
                late: 0.50     // 50% chance late game (wave 41+)
            },
            baseDamagePerSecond: 100,
            fightDuration: 5,  // Simulated seconds
            ticksPerSecond: 1,
            executeThreshold: 0.20,  // <20% HP = high priority target
            clutchThreshold: 0.30,    // <30% HP = clutch factor activates
            abilityCastChance: 0.90,  // 90% chance to cast ability in fight
            ultCastChance: 0.70       // 70% chance to cast ultimate
        };

        this.activeFights = new Map();
    }

    /**
     * Set ability system reference
     */
    setAbilitySystem(abilitySystem) {
        this.abilitySystem = abilitySystem;
    }

    /**
     * Update system - detect and resolve team fights
     */
    update(world, rng, eventLog, phase) {
        if (phase === 'early') return;  // No teamfights in lane phase

        const tick = world.getTick();
        const systemRng = rng.fork('teamfight');

        // Determine if fight should happen this wave
        const fightChance = this.config.fightTriggerChance[phase] || 0;

        if (systemRng.chance(fightChance)) {
            this._startTeamfight(world, tick, eventLog, systemRng);
        }
    }

    /**
     * Start a new teamfight
     */
    _startTeamfight(world, tick, eventLog, rng) {
        const team1Champions = world.queryByTags('champion', 'team1');
        const team2Champions = world.queryByTags('champion', 'team2');

        // Log fight start
        eventLog.log({
            type: EventLog.EventTypes.FIGHT_START,
            tick: tick,
            team1Count: team1Champions.length,
            team2Count: team2Champions.length
        });

        // Assign positions (frontline vs backline)
        const team1Positioned = this._assignPositions(team1Champions);
        const team2Positioned = this._assignPositions(team2Champions);

        // Resolve fight over multiple ticks
        const result = this._resolveFight(
            team1Positioned,
            team2Positioned,
            tick,
            eventLog,
            rng,
            world
        );

        // Log fight end
        eventLog.log({
            type: EventLog.EventTypes.FIGHT_END,
            tick: tick,
            winner: result.winner,
            team1Casualties: result.team1Deaths,
            team2Casualties: result.team2Deaths,
            duration: result.duration
        });
    }

    /**
     * Assign champions to frontline or backline based on role/archetype
     */
    _assignPositions(champions) {
        const frontlineRoles = ['top', 'jungle', 'support'];
        const backlineRoles = ['mid', 'bot'];

        return champions.map(champion => {
            const identity = champion.getComponent('identity');
            const position = frontlineRoles.includes(identity.role) ? 'frontline' : 'backline';

            return {
                champion,
                position,
                alive: true
            };
        });
    }

    /**
     * Resolve the fight simulation
     */
    _resolveFight(team1, team2, tick, eventLog, rng, world) {
        const fightState = {
            team1: team1.map(p => ({ ...p, health: p.champion.getComponent('stats').health || 550 })),
            team2: team2.map(p => ({ ...p, health: p.champion.getComponent('stats').health || 550 })),
            killOrder: [],
            assistMap: new Map()
        };

        let fightTick = 0;
        const maxTicks = this.config.fightDuration * this.config.ticksPerSecond;

        // Simulate fight tick by tick
        while (fightTick < maxTicks) {
            // Team 1 attacks Team 2
            this._executeFightTick(fightState.team1, fightState.team2, 'team1', tick, eventLog, rng, world);

            // Check if team 2 wiped
            if (fightState.team2.every(p => !p.alive)) break;

            // Team 2 attacks Team 1
            this._executeFightTick(fightState.team2, fightState.team1, 'team2', tick, eventLog, rng, world);

            // Check if team 1 wiped
            if (fightState.team1.every(p => !p.alive)) break;

            fightTick++;
        }

        // Determine winner
        const team1Alive = fightState.team1.filter(p => p.alive).length;
        const team2Alive = fightState.team2.filter(p => p.alive).length;

        const winner = team1Alive > team2Alive ? 'team1' : team2Alive > team1Alive ? 'team2' : 'draw';

        // Update champion stats
        this._applyFightResults(fightState, tick, eventLog);

        return {
            winner,
            team1Deaths: fightState.team1.filter(p => !p.alive).length,
            team2Deaths: fightState.team2.filter(p => !p.alive).length,
            duration: fightTick
        };
    }

    /**
     * Execute one tick of fighting
     */
    _executeFightTick(attackers, defenders, attackingTeam, tick, eventLog, rng, world) {
        const aliveAttackers = attackers.filter(p => p.alive);
        const aliveDefenders = defenders.filter(p => p.alive);

        if (aliveAttackers.length === 0 || aliveDefenders.length === 0) return;

        for (const attacker of aliveAttackers) {
            // Select target
            const target = this._selectTarget(aliveDefenders, attacker, rng);
            if (!target) continue;

            let damage = 0;
            let abilityCast = false;

            // Try to cast abilities (if AbilitySystem available)
            if (this.abilitySystem && rng.chance(this.config.abilityCastChance)) {
                const abilityResults = this.abilitySystem.castAbilitiesInFight(
                    attacker.champion,
                    target.champion,
                    world,
                    rng,
                    eventLog
                );

                // Sum up all ability damage
                if (abilityResults && abilityResults.length > 0) {
                    for (const result of abilityResults) {
                        if (result.damage > 0) {
                            damage += result.damage;
                            abilityCast = true;

                            // Check for kill from ability
                            target.health -= result.damage;
                            if (target.health <= 0 && target.alive) {
                                target.alive = false;
                                this._processKill(attacker, target, aliveAttackers, tick, eventLog);
                                break; // Stop attacking if target is dead
                            }
                        }
                    }
                }
            }

            // Basic attack if still alive and no abilities cast
            if (target.alive && !abilityCast) {
                damage = this._calculateDamage(attacker.champion, target.champion, rng);
                target.health -= damage;

                // Log damage
                eventLog.log({
                    type: EventLog.EventTypes.FIGHT_DAMAGE,
                    tick: tick,
                    attacker: attacker.champion.getComponent('identity').name,
                    attackerTeam: attackingTeam,
                    defender: target.champion.getComponent('identity').name,
                    damage: damage,
                    remainingHealth: target.health
                });

                // Check for kill
                if (target.health <= 0 && target.alive) {
                    target.alive = false;
                    this._processKill(attacker, target, aliveAttackers, tick, eventLog);
                }
            }
        }
    }

    /**
     * Select target based on priority system
     */
    _selectTarget(defenders, attacker, rng) {
        if (defenders.length === 0) return null;

        const attackerIdentity = attacker.champion.getComponent('identity');
        const attackerHidden = attacker.champion.getComponent('hiddenStats');

        // Priority 1: Low health targets (execute range)
        const executeTargets = defenders.filter(d => {
            const maxHealth = d.champion.getComponent('stats').effective_max_health || 550;
            return d.health / maxHealth < this.config.executeThreshold;
        });

        if (executeTargets.length > 0 && rng.chance(0.7)) {
            return rng.choice(executeTargets);
        }

        // Priority 2: Backline targets (if attacker is assassin/diver)
        if (attackerIdentity.role === 'jungle' || attackerIdentity.role === 'mid') {
            const backlineTargets = defenders.filter(d => d.position === 'backline');
            if (backlineTargets.length > 0 && rng.chance(0.6)) {
                return rng.choice(backlineTargets);
            }
        }

        // Priority 3: High threat targets (based on items/stats)
        const threatScores = defenders.map(d => ({
            defender: d,
            threat: this._calculateThreatLevel(d.champion)
        }));

        threatScores.sort((a, b) => b.threat - a.threat);

        // Game sense affects target selection quality
        const gameSense = attackerHidden.getEffectiveGameSense();
        if (rng.chance(gameSense)) {
            // Good target selection - highest threat
            return threatScores[0].defender;
        } else {
            // Poor target selection - random
            return rng.choice(defenders);
        }
    }

    /**
     * Calculate threat level of a champion
     */
    _calculateThreatLevel(champion) {
        const stats = champion.getComponent('stats');
        const items = champion.getComponent('items');

        const ad = stats.effective_attack_damage || 60;
        const ap = stats.effective_ability_power || 0;
        const itemCount = items.inventory.length;

        return ad + ap + (itemCount * 50);
    }

    /**
     * Calculate damage from attacker to defender
     */
    _calculateDamage(attacker, defender, rng) {
        const attackerStats = attacker.getComponent('stats');
        const attackerHidden = attacker.getComponent('hiddenStats');
        const attackerStatus = attacker.getComponent('status');
        const defenderStats = defender.getComponent('stats');
        const defenderStatus = defender.getComponent('status');

        // Base damage
        const ad = attackerStats.effective_attack_damage || attackerStats.attack_damage || 60;
        const ap = attackerStats.effective_ability_power || attackerStats.ability_power || 0;
        const baseDamage = this.config.baseDamagePerSecond;

        // Skill multiplier
        const effectiveMechanical = attackerHidden.getEffectiveMechanical();
        const skillMultiplier = 0.8 + (effectiveMechanical * 0.4);  // 0.8x to 1.2x

        // Item multiplier
        const itemMultiplier = 1 + ((ad - 60) / 200) + (ap / 300);

        // Defense reduction
        const armor = defenderStats.effective_armor || defenderStats.armor || 30;
        const mr = defenderStats.effective_magic_resist || defenderStats.magic_resist || 30;
        const avgDefense = (armor + mr) / 2;
        const damageReduction = 100 / (100 + avgDefense);

        // Status effects
        let damageModifier = 1.0;
        for (const buff of attackerStatus.buffs) {
            if (buff.effects.damage_increase) {
                damageModifier += buff.effects.damage_increase;
            }
        }
        for (const debuff of defenderStatus.debuffs) {
            if (debuff.effects.damage_reduction) {
                damageModifier *= (1 - debuff.effects.damage_reduction);
            }
        }

        // Variance
        const variance = rng.float(0.9, 1.1);

        return Math.floor(
            baseDamage *
            skillMultiplier *
            itemMultiplier *
            damageReduction *
            damageModifier *
            variance
        );
    }

    /**
     * Process kill and assign KDA
     */
    _processKill(killer, victim, aliveAllies, tick, eventLog) {
        const killerStats = killer.champion.getComponent('stats');
        const killerIdentity = killer.champion.getComponent('identity');
        const victimStats = victim.champion.getComponent('stats');
        const victimIdentity = victim.champion.getComponent('identity');
        const victimHidden = victim.champion.getComponent('hiddenStats');

        // Assign kill
        killerStats.kda.kills++;

        // Assign death
        victimStats.kda.deaths++;

        // Assign assists (all alive teammates get assists)
        for (const ally of aliveAllies) {
            if (ally.champion.id !== killer.champion.id && ally.alive) {
                const allyStats = ally.champion.getComponent('stats');
                allyStats.kda.assists++;
            }
        }

        // Base gold reward
        let killGold = 300;

        // Shutdown gold (killing fed enemies)
        if (victimStats.kda.kills >= 3) {
            const shutdownBonus = victimStats.kda.kills * 150; // 150g per kill
            killGold += shutdownBonus;

            eventLog.log({
                type: 'shutdown',
                tick: tick,
                killerName: killerIdentity.name,
                victimName: victimIdentity.name,
                victimKillStreak: victimStats.kda.kills,
                shutdownGold: shutdownBonus
            });
        }

        killerStats.gold += killGold;

        // Increase victim tilt (more tilt if shutdown)
        const tiltIncrease = victimStats.kda.kills >= 3 ? 0.25 : 0.15;
        victimHidden.tilt_level = Math.min(1.0, victimHidden.tilt_level + tiltIncrease);

        // Log kill
        eventLog.log({
            type: EventLog.EventTypes.FIGHT_KILL,
            tick: tick,
            killerName: killerIdentity.name,
            killerTeam: killerIdentity.teamId,
            victimName: victimIdentity.name,
            victimTeam: victimIdentity.teamId,
            goldAwarded: killGold,
            assistCount: aliveAllies.length - 1
        });
    }

    /**
     * Apply fight results to champion stats
     */
    _applyFightResults(fightState, tick, eventLog) {
        // Check for ACE (team wipe)
        const team1Wiped = fightState.team1.every(p => !p.alive);
        const team2Wiped = fightState.team2.every(p => !p.alive);

        // Award ACE gold
        if (team1Wiped && !team2Wiped) {
            const aceGold = 500; // Bonus gold for ACE
            for (const participant of fightState.team2) {
                if (participant.alive) {
                    const stats = participant.champion.getComponent('stats');
                    stats.gold += aceGold;
                }
            }

            eventLog.log({
                type: 'ace',
                tick: tick,
                aceTeam: 'team2',
                aceGold: aceGold
            });
        } else if (team2Wiped && !team1Wiped) {
            const aceGold = 500;
            for (const participant of fightState.team1) {
                if (participant.alive) {
                    const stats = participant.champion.getComponent('stats');
                    stats.gold += aceGold;
                }
            }

            eventLog.log({
                type: 'ace',
                tick: tick,
                aceTeam: 'team1',
                aceGold: aceGold
            });
        }

        // Reset health for survivors
        for (const participant of [...fightState.team1, ...fightState.team2]) {
            const stats = participant.champion.getComponent('stats');

            if (participant.alive) {
                // Survivors keep reduced health
                stats.health = Math.max(100, participant.health);
            } else {
                // Dead champions respawn with full health
                stats.health = stats.effective_max_health || stats.max_health || 550;
            }
        }
    }
}

module.exports = TeamfightSystem;
