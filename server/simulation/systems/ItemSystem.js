const EventLog = require('../engines/EventLog');
const itemsData = require('../data/items.json');

/**
 * ItemSystem - Manages item purchasing, builds, and stat application
 *
 * Champions automatically buy items when they have enough gold,
 * following role-specific build paths.
 */
class ItemSystem {
    constructor() {
        this.items = new Map();
        this.buildPaths = itemsData.buildPaths;
        this.championBuilds = new Map();  // Cache build paths per champion

        // Index items by ID
        for (const item of itemsData.items) {
            this.items.set(item.id, item);
        }
    }

    /**
     * Update system - process item purchases for all champions
     */
    update(world, rng, eventLog, phase) {
        const champions = world.queryByTag('champion');
        const systemRng = rng.fork('items');

        for (const champion of champions) {
            const identity = champion.getComponent('identity');
            const stats = champion.getComponent('stats');
            const items = champion.getComponent('items');
            const hiddenStats = champion.getComponent('hiddenStats');

            // Get or initialize build path for this champion (deterministic per champion ID)
            if (!this.championBuilds.has(identity.id)) {
                const championRng = systemRng.fork(identity.id);
                const buildPath = this._getBuildPath(identity.role, championRng);
                this.championBuilds.set(identity.id, buildPath);
            }

            const buildPath = this.championBuilds.get(identity.id);

            // Try to purchase next item in build
            this._attemptPurchase(champion, buildPath, world.getTick(), eventLog, systemRng);

            // Apply item stat bonuses
            this._applyItemStats(champion);
        }
    }

    /**
     * Get build path for a role
     */
    _getBuildPath(role, rng) {
        const rolePaths = this.buildPaths[role];
        if (!rolePaths) return [];

        // Choose a build variant based on RNG
        const variants = Object.keys(rolePaths);
        const variant = rng.choice(variants);

        return rolePaths[variant] || [];
    }

    /**
     * Attempt to purchase the next item in build path
     */
    _attemptPurchase(champion, buildPath, tick, eventLog, rng) {
        const identity = champion.getComponent('identity');
        const stats = champion.getComponent('stats');
        const items = champion.getComponent('items');

        // Find next item to buy
        const ownedItemIds = items.inventory.map(i => i.id);
        const nextItemId = buildPath.find(id => !ownedItemIds.includes(id));

        if (!nextItemId) return;  // Build complete

        const item = this.items.get(nextItemId);
        if (!item) return;

        // Check if can afford
        if (stats.gold >= item.cost) {
            // Purchase item
            stats.gold -= item.cost;

            const purchasedItem = {
                id: item.id,
                name: item.name,
                stats: item.stats,
                passive: item.passive
            };

            items.addItem(purchasedItem);

            // Log purchase event
            eventLog.log({
                type: EventLog.EventTypes.ITEM_PURCHASE,
                tick: tick,
                entityId: champion.id,
                championName: identity.name,
                teamId: identity.teamId,
                itemId: item.id,
                itemName: item.name,
                cost: item.cost,
                goldRemaining: stats.gold
            });

            return purchasedItem;
        }

        return null;
    }

    /**
     * Apply item stats to champion base stats
     */
    _applyItemStats(champion) {
        const stats = champion.getComponent('stats');
        const items = champion.getComponent('items');

        // Get total bonus stats from items
        const itemStats = items.getTotalStats();

        // Apply bonuses (stored separately to track base vs bonus stats)
        if (!stats.itemBonuses) {
            stats.itemBonuses = {};
        }

        stats.itemBonuses = itemStats;

        // Calculate effective stats (base + item bonuses)
        stats.effective_attack_damage = (stats.attack_damage || 60) + (itemStats.attack_damage || 0);
        stats.effective_ability_power = (stats.ability_power || 0) + (itemStats.ability_power || 0);
        stats.effective_attack_speed = (stats.attack_speed || 0.65) + (itemStats.attack_speed || 0);
        stats.effective_armor = (stats.armor || 30) + (itemStats.armor || 0);
        stats.effective_magic_resist = (stats.magic_resist || 30) + (itemStats.magic_resist || 0);
        stats.effective_max_health = (stats.max_health || 550) + (itemStats.max_health || 0);

        // Apply passive multipliers
        this._applyPassiveEffects(champion, stats);

        // Heal up if max health increased
        if (stats.health < stats.effective_max_health) {
            stats.health = Math.min(stats.health + 50, stats.effective_max_health);
        }
    }

    /**
     * Apply passive item effects that modify stats
     */
    _applyPassiveEffects(champion, stats) {
        const items = champion.getComponent('items');

        for (const item of items.inventory) {
            // Rabadon's Deathcap - Increases AP by 35%
            if (item.id === 'rabadons') {
                stats.effective_ability_power *= 1.35;
            }

            // Spirit Visage - Increases healing by 25% (tracked for later use)
            if (item.id === 'spirit_visage') {
                stats.healing_power = (stats.healing_power || 1.0) * 1.25;
            }

            // Infinity Edge - Increases crit damage
            if (item.id === 'infinity_edge') {
                stats.crit_damage_multiplier = 2.25; // 225% instead of 200%
            }
        }
    }

    /**
     * Calculate on-hit damage from item passives
     * Called by combat systems when a champion attacks
     */
    calculateOnHitDamage(attacker, target) {
        const attackerItems = attacker.getComponent('items');
        const targetStats = target.getComponent('stats');
        let bonusDamage = 0;

        for (const item of attackerItems.inventory) {
            // Blade of the Ruined King - 8% current HP physical damage
            if (item.id === 'blade_of_ruined_king') {
                bonusDamage += targetStats.health * 0.08;
            }

            // Black Cleaver - Apply armor reduction (handled separately in combat)
            // Luden's Tempest - Bonus magic damage (handled in ability system)
        }

        return bonusDamage;
    }

    /**
     * Calculate damage reflection from defensive items
     * Called by combat systems when a champion takes damage
     */
    calculateReflectDamage(defender, incomingDamage) {
        const defenderItems = defender.getComponent('items');
        let reflectedDamage = 0;

        for (const item of defenderItems.inventory) {
            // Thornmail - Reflects 10% of damage taken
            if (item.id === 'thornmail') {
                reflectedDamage += incomingDamage * 0.10;
            }
        }

        return reflectedDamage;
    }

    /**
     * Check if champion has a specific item passive
     */
    hasItemPassive(champion, passiveName) {
        const items = champion.getComponent('items');

        for (const item of items.inventory) {
            if (item.id === passiveName || (item.passive && item.passive.includes(passiveName))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get all active item passives for a champion
     */
    getActivePassives(champion) {
        const items = champion.getComponent('items');
        const passives = [];

        for (const item of items.inventory) {
            if (item.passive) {
                passives.push({
                    itemId: item.id,
                    itemName: item.name,
                    passive: item.passive
                });
            }
        }

        return passives;
    }

    /**
     * Calculate champion power level based on items and stats
     */
    calculatePower(champion) {
        const stats = champion.getComponent('stats');
        const hiddenStats = champion.getComponent('hiddenStats');

        const ad = stats.effective_attack_damage || stats.attack_damage || 60;
        const ap = stats.effective_ability_power || stats.ability_power || 0;
        const as = stats.effective_attack_speed || stats.attack_speed || 0.65;
        const armor = stats.effective_armor || stats.armor || 30;
        const mr = stats.effective_magic_resist || stats.magic_resist || 30;
        const health = stats.effective_max_health || stats.max_health || 550;

        // Offensive power
        const offensivePower = (ad * as) + (ap * 0.8) + (stats.level * 20);

        // Defensive power (effective HP)
        const effectiveHP = health * (1 + (armor + mr) / 200);

        // Skill modifiers
        const skillMultiplier = 1 + (hiddenStats.getEffectiveMechanical() * 0.3);

        return (offensivePower + effectiveHP * 0.3) * skillMultiplier;
    }

    /**
     * Get item by ID
     */
    getItem(itemId) {
        return this.items.get(itemId);
    }

    /**
     * Get all items for a role
     */
    getItemsForRole(role) {
        const result = [];
        for (const item of this.items.values()) {
            if (!item.roles || item.roles.includes(role)) {
                result.push(item);
            }
        }
        return result;
    }
}

module.exports = ItemSystem;
