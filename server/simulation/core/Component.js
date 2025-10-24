/**
 * Component Types for ECS Architecture
 *
 * Components are pure data containers with no logic.
 * Systems operate on entities that have specific component combinations.
 */

/**
 * Position & Location
 */
class CPosition {
    constructor(lane = null, zone = 'base') {
        this.lane = lane;  // 'top', 'jungle', 'mid', 'bot', 'support'
        this.zone = zone;  // 'base', 'lane', 'jungle', 'river', 'objective'
    }
}

/**
 * Base champion statistics
 */
class CStats {
    constructor(data = {}) {
        // Combat stats (visible)
        this.attack_damage = data.attack_damage || 60;
        this.ability_power = data.ability_power || 0;
        this.attack_speed = data.attack_speed || 0.65;
        this.armor = data.armor || 30;
        this.magic_resist = data.magic_resist || 30;
        this.health = data.health || 550;
        this.max_health = data.max_health || 550;
        this.mana = data.mana || 350;
        this.max_mana = data.max_mana || 350;

        // Economic stats
        this.gold = data.gold || 500;
        this.cs = data.cs || 0;  // Creep score
        this.level = data.level || 1;
        this.xp = data.xp || 0;

        // Performance tracking (visible)
        this.kda = data.kda || { kills: 0, deaths: 0, assists: 0 };

        // Structure-specific stats
        this.isAlive = data.isAlive !== undefined ? data.isAlive : true;
        this.isVulnerable = data.isVulnerable !== undefined ? data.isVulnerable : false;
    }

    /**
     * Apply stat modifiers (from items, buffs, etc.)
     */
    applyModifiers(modifiers) {
        for (const [stat, value] of Object.entries(modifiers)) {
            if (stat in this) {
                this[stat] += value;
            }
        }
    }
}

/**
 * Hidden performance stats (not visible to players)
 */
class CHiddenStats {
    constructor(data = {}) {
        // Core competencies (0-1 normalized)
        this.mechanical_skill = data.mechanical_skill || 0.5;
        this.game_sense = data.game_sense || 0.5;
        this.tilt_resistance = data.tilt_resistance || 0.5;
        this.clutch_factor = data.clutch_factor || 0.5;

        // Dynamic state
        this.tilt_level = data.tilt_level || 0;  // 0-1, increases with stress
        this.mental_boom_threshold = data.mental_boom_threshold || 0.7;
        this.confidence = data.confidence || 0.5;  // 0-1, affects risk-taking

        // Relationships
        this.grudges = data.grudges || [];  // List of champion IDs
        this.synergy_map = data.synergy_map || {};  // championId -> synergy score
    }

    /**
     * Get effective mechanical skill after tilt penalty
     */
    getEffectiveMechanical() {
        return Math.max(0, this.mechanical_skill - (this.tilt_level * 0.1));
    }

    /**
     * Get effective game sense after tilt penalty
     */
    getEffectiveGameSense() {
        return Math.max(0, this.game_sense - (this.tilt_level * 0.15));
    }
}

/**
 * Items & equipment
 */
class CItems {
    constructor() {
        this.inventory = [];  // Array of item objects
        this.maxSlots = 6;
    }

    addItem(item) {
        if (this.inventory.length < this.maxSlots) {
            this.inventory.push(item);
            return true;
        }
        return false;
    }

    removeItem(itemId) {
        const index = this.inventory.findIndex(i => i.id === itemId);
        if (index >= 0) {
            return this.inventory.splice(index, 1)[0];
        }
        return null;
    }

    getTotalStats() {
        const stats = {};
        for (const item of this.inventory) {
            for (const [stat, value] of Object.entries(item.stats)) {
                stats[stat] = (stats[stat] || 0) + value;
            }
        }
        return stats;
    }
}

/**
 * Champion abilities
 */
class CAbilities {
    constructor(abilities = []) {
        this.abilities = abilities.map(ability => ({
            name: ability.name,
            cooldown: ability.cooldown,
            currentCooldown: 0,
            damage: ability.damage || 0,
            type: ability.type || 'physical',  // 'physical', 'magic', 'true'
            effects: ability.effects || []
        }));
    }

    tickCooldowns(amount = 1) {
        for (const ability of this.abilities) {
            if (ability.currentCooldown > 0) {
                ability.currentCooldown = Math.max(0, ability.currentCooldown - amount);
            }
        }
    }

    getAvailableAbilities() {
        return this.abilities.filter(a => a.currentCooldown === 0);
    }

    useAbility(index) {
        if (index >= 0 && index < this.abilities.length) {
            const ability = this.abilities[index];
            if (ability.currentCooldown === 0) {
                ability.currentCooldown = ability.cooldown;
                return ability;
            }
        }
        return null;
    }
}

/**
 * Lane state (minion waves)
 */
class CLaneState {
    constructor(lane) {
        this.lane = lane;
        this.minionWaves = {
            team1: { count: 0, position: 0 },  // position: -1 (own side) to +1 (enemy side)
            team2: { count: 0, position: 0 }
        };
        this.pressure = 0;  // -1 (team2 pushing) to +1 (team1 pushing)
        this.towerHealth = {
            team1: { outer: 2500, inner: 2500, inhibitor: 2500 },
            team2: { outer: 2500, inner: 2500, inhibitor: 2500 }
        };
    }

    updatePressure() {
        const team1Strength = this.minionWaves.team1.count + this.minionWaves.team1.position;
        const team2Strength = this.minionWaves.team2.count + this.minionWaves.team2.position;
        this.pressure = (team1Strength - team2Strength) / (team1Strength + team2Strength + 1);
    }
}

/**
 * Champion identity & metadata
 */
class CIdentity {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.role = data.role;  // 'top', 'jungle', 'mid', 'adc', 'support'
        this.lore = data.lore || '';
        this.teamId = data.teamId;
        this.archetype = data.archetype || 'balanced';  // 'tank', 'assassin', 'mage', 'marksman', 'support'

        // Additional properties for structures
        this.structureType = data.structureType;  // 'spire', 'gateway', 'core'
        this.lane = data.lane;  // 'top', 'mid', 'bot', 'base'
        this.tier = data.tier;  // 1, 2, 3 for spires
    }
}

/**
 * Status effects & buffs
 */
class CStatus {
    constructor() {
        this.buffs = [];  // { type, duration, strength, source }
        this.debuffs = [];
        this.cc = [];  // Crowd control effects
    }

    addBuff(buff) {
        this.buffs.push({ ...buff, remainingDuration: buff.duration });
    }

    addDebuff(debuff) {
        this.debuffs.push({ ...debuff, remainingDuration: debuff.duration });
    }

    addCC(cc) {
        this.cc.push({ ...cc, remainingDuration: cc.duration });
    }

    tick(amount = 1) {
        this.buffs = this.buffs.filter(b => {
            b.remainingDuration -= amount;
            return b.remainingDuration > 0;
        });
        this.debuffs = this.debuffs.filter(d => {
            d.remainingDuration -= amount;
            return d.remainingDuration > 0;
        });
        this.cc = this.cc.filter(c => {
            c.remainingDuration -= amount;
            return c.remainingDuration > 0;
        });
    }

    isStunned() {
        return this.cc.some(c => c.type === 'stun');
    }

    isSilenced() {
        return this.cc.some(c => c.type === 'silence');
    }
}

/**
 * Controller (AI decision maker)
 */
class CController {
    constructor(role, strategy = 'balanced') {
        this.role = role;
        this.strategy = strategy;  // 'aggressive', 'balanced', 'defensive'
        this.currentGoal = 'farm';  // 'farm', 'roam', 'fight', 'objective', 'recall'
        this.decisionCooldown = 0;
    }
}

/**
 * Chaos quirks & special traits
 */
class CQuirks {
    constructor(quirks = []) {
        this.quirks = quirks;  // Array of quirk objects
        this.activeQuirks = [];
    }

    hasQuirk(quirkName) {
        return this.quirks.some(q => q.name === quirkName);
    }

    getQuirk(quirkName) {
        return this.quirks.find(q => q.name === quirkName);
    }
}

module.exports = {
    CPosition,
    CStats,
    CHiddenStats,
    CItems,
    CAbilities,
    CLaneState,
    CIdentity,
    CStatus,
    CController,
    CQuirks
};
