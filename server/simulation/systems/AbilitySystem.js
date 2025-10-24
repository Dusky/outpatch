const EventLog = require('../engines/EventLog');

/**
 * AbilitySystem - Manages champion abilities and their execution
 *
 * Each champion has 4 abilities (Q, W, E, R/Ultimate)
 * Abilities have: cooldowns, mana costs, damage scaling, effects
 *
 * Abilities are used during:
 * - Laning phase: Q/W/E for trades
 * - Team fights: All abilities including ultimates
 */
class AbilitySystem {
    constructor() {
        this.abilities = new Map();
        this.championCooldowns = new Map(); // Track cooldowns per champion
        this.config = {
            laneCastChance: 0.30,      // 30% chance to cast ability in lane
            fightCastChance: 0.90,     // 90% chance to cast ability in fight
            ultCastChance: 0.70,       // 70% chance to cast ult in fight
            baseMana: 400,
            manaRegen: 8,              // Per wave
        };
    }

    /**
     * Load ability data from JSON
     */
    loadAbilities(abilitiesData) {
        for (const ability of abilitiesData) {
            this.abilities.set(ability.id, ability);
        }
    }

    /**
     * Initialize champion abilities
     * Called when champion is created
     */
    initializeChampionAbilities(champion, abilityIds) {
        const identity = champion.getComponent('identity');
        const stats = champion.getComponent('stats');

        // Initialize mana
        if (!stats.mana) {
            stats.mana = this.config.baseMana;
            stats.max_mana = this.config.baseMana;
        }

        // Store ability IDs on champion
        if (!identity.abilities) {
            identity.abilities = {
                q: abilityIds[0] || null,
                w: abilityIds[1] || null,
                e: abilityIds[2] || null,
                r: abilityIds[3] || null
            };
        }

        // Initialize cooldown tracker
        this.championCooldowns.set(champion.id, {
            q: 0,
            w: 0,
            e: 0,
            r: 0,
            lastCastWave: {
                q: -999,
                w: -999,
                e: -999,
                r: -999
            }
        });
    }

    /**
     * Update system - regenerate mana, reduce cooldowns
     */
    update(world, rng, eventLog, phase) {
        const champions = world.queryByTag('champion');
        const tick = world.getTick();

        for (const champion of champions) {
            const stats = champion.getComponent('stats');

            // Regenerate mana
            if (stats.mana < stats.max_mana) {
                stats.mana = Math.min(stats.max_mana, stats.mana + this.config.manaRegen);
            }

            // Cooldowns are tracked per-cast, not per-tick
        }
    }

    /**
     * Attempt to cast ability during laning phase
     */
    tryCastInLane(attacker, defender, world, rng, eventLog) {
        const tick = world.getTick();
        const systemRng = rng.fork('ability_lane');

        // Check if should cast ability
        if (!systemRng.chance(this.config.laneCastChance)) {
            return null;
        }

        // Choose random basic ability (Q, W, or E)
        const abilitySlots = ['q', 'w', 'e'];
        const slot = systemRng.choice(abilitySlots);

        return this.castAbility(attacker, defender, slot, tick, eventLog, systemRng);
    }

    /**
     * Cast all available abilities during team fight
     */
    castAbilitiesInFight(attacker, target, world, rng, eventLog) {
        const tick = world.getTick();
        const systemRng = rng.fork('ability_fight');
        const results = [];

        // Try to cast Q, W, E
        for (const slot of ['q', 'w', 'e']) {
            if (systemRng.chance(this.config.fightCastChance)) {
                const result = this.castAbility(attacker, target, slot, tick, eventLog, systemRng);
                if (result) {
                    results.push(result);
                }
            }
        }

        // Try to cast ultimate (R) - lower chance, higher impact
        if (systemRng.chance(this.ultCastChance)) {
            const ultResult = this.castAbility(attacker, target, 'r', tick, eventLog, systemRng);
            if (ultResult) {
                results.push(ultResult);
            }
        }

        return results;
    }

    /**
     * Set ObjectiveSystem reference for buff integration
     */
    setObjectiveSystem(objectiveSystem) {
        this.objectiveSystem = objectiveSystem;
    }

    /**
     * Cast a specific ability
     */
    castAbility(caster, target, slot, tick, eventLog, rng) {
        const identity = caster.getComponent('identity');
        const stats = caster.getComponent('stats');
        const hiddenStats = caster.getComponent('hiddenStats');

        // Get ability from champion's slot
        const abilityId = identity.abilities?.[slot];
        if (!abilityId) return null;

        const ability = this.abilities.get(abilityId);
        if (!ability) return null;

        // Check cooldown
        const cooldowns = this.championCooldowns.get(caster.id);
        if (!cooldowns) return null;

        const wavesSinceLastCast = tick - cooldowns.lastCastWave[slot];
        let cooldownWaves = Math.ceil(ability.cooldown / 10); // Convert seconds to waves (10s/wave)

        // Apply cooldown reduction from Time Rift
        if (this.objectiveSystem) {
            const cdr = this.objectiveSystem.getCooldownReduction(caster);
            cooldownWaves = Math.ceil(cooldownWaves * (1 - cdr));
        }

        if (wavesSinceLastCast < cooldownWaves) {
            return null; // Still on cooldown
        }

        // Check mana cost
        if (stats.mana < ability.manaCost) {
            return null; // Not enough mana
        }

        // Consume mana
        stats.mana -= ability.manaCost;

        // Put on cooldown
        cooldowns.lastCastWave[slot] = tick;

        // Calculate damage
        const damage = this._calculateAbilityDamage(caster, target, ability, rng);

        // Apply damage to target
        const targetStats = target.getComponent('stats');
        const targetIdentity = target.getComponent('identity');

        targetStats.health -= damage;

        // Check for kill
        const isKill = targetStats.health <= 0;

        // Log ability cast
        const abilityName = ability.name;
        const isUlt = slot === 'r';

        eventLog.log({
            type: isUlt ? EventLog.EventTypes.ULTIMATE_CAST : EventLog.EventTypes.ABILITY_CAST,
            tick: tick,
            casterId: caster.id,
            casterName: identity.name,
            targetId: target.id,
            targetName: targetIdentity.name,
            abilityName: abilityName,
            abilitySlot: slot.toUpperCase(),
            damage: Math.round(damage),
            isKill: isKill,
            flavor: ability.flavor
        });

        return {
            ability: ability,
            damage: damage,
            isKill: isKill,
            slot: slot
        };
    }

    /**
     * Calculate ability damage with scaling
     */
    _calculateAbilityDamage(caster, target, ability, rng) {
        const casterStats = caster.getComponent('stats');
        const casterHidden = caster.getComponent('hiddenStats');
        const targetStats = target.getComponent('stats');

        // Base damage
        let damage = ability.damage.base || 0;

        // Add scaling (AD, AP, level)
        if (ability.damage.scaling) {
            // AD scaling
            if (ability.damage.scaling.ad) {
                const ad = casterStats.effective_attack_damage || casterStats.attack_damage || 60;
                damage += ad * ability.damage.scaling.ad;
            }

            // AP scaling
            if (ability.damage.scaling.ap) {
                const ap = casterStats.effective_ability_power || casterStats.ability_power || 0;
                damage += ap * ability.damage.scaling.ap;
            }

            // Level scaling
            if (ability.damage.scaling.level) {
                damage += (casterStats.level || 1) * ability.damage.scaling.level;
            }
        }

        // Apply mechanical skill modifier (can miss skillshots)
        const hitChance = 0.7 + (casterHidden.getEffectiveMechanical() * 0.3); // 70-100% hit chance
        if (!rng.chance(hitChance)) {
            return 0; // Ability missed!
        }

        // Apply damage mitigation (armor or magic resist)
        if (ability.damageType === 'physical') {
            const armor = targetStats.effective_armor || targetStats.armor || 30;
            const reduction = armor / (100 + armor);
            damage *= (1 - reduction);
        } else if (ability.damageType === 'magic') {
            const mr = targetStats.effective_magic_resist || targetStats.magic_resist || 30;
            const reduction = mr / (100 + mr);
            damage *= (1 - reduction);
        }

        // Add variance (±15%)
        const variance = 0.85 + (rng.next() * 0.30);
        damage *= variance;

        // Critical hit chance for certain abilities
        if (ability.effects?.includes('can_crit') && rng.chance(0.20)) {
            damage *= casterStats.crit_damage_multiplier || 2.0;
        }

        // Apply Reality Rift buff (+10% ability damage)
        if (this.objectiveSystem) {
            const abilityDamageMult = this.objectiveSystem.getAbilityDamageMultiplier(caster);
            damage *= abilityDamageMult;
        }

        return Math.max(0, damage);
    }

    /**
     * Get ability cooldown remaining (in waves)
     */
    getCooldownRemaining(champion, slot, currentTick) {
        const identity = champion.getComponent('identity');
        const abilityId = identity.abilities?.[slot];
        if (!abilityId) return 0;

        const ability = this.abilities.get(abilityId);
        if (!ability) return 0;

        const cooldowns = this.championCooldowns.get(champion.id);
        if (!cooldowns) return 0;

        const wavesSinceLastCast = currentTick - cooldowns.lastCastWave[slot];
        const cooldownWaves = Math.ceil(ability.cooldown / 10);

        return Math.max(0, cooldownWaves - wavesSinceLastCast);
    }

    /**
     * Check if ability is ready to cast
     */
    isAbilityReady(champion, slot, currentTick) {
        return this.getCooldownRemaining(champion, slot, currentTick) === 0;
    }

    /**
     * Get all abilities for a champion
     */
    getChampionAbilities(champion) {
        const identity = champion.getComponent('identity');
        const abilities = [];

        for (const slot of ['q', 'w', 'e', 'r']) {
            const abilityId = identity.abilities?.[slot];
            if (abilityId) {
                const ability = this.abilities.get(abilityId);
                if (ability) {
                    abilities.push({
                        slot: slot.toUpperCase(),
                        ...ability
                    });
                }
            }
        }

        return abilities;
    }

    /**
     * Get ability by ID
     */
    getAbility(abilityId) {
        return this.abilities.get(abilityId);
    }
}

module.exports = AbilitySystem;
