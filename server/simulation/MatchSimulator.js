const SimulationEngine = require('./engines/SimulationEngine');
const Entity = require('./core/Entity');
const {
    CIdentity,
    CStats,
    CHiddenStats,
    CItems,
    CAbilities,
    CPosition,
    CController,
    CStatus,
    CQuirks,
    CLeveling
} = require('./core/Component');
const LaneSystem = require('./systems/LaneSystem');
const ItemSystem = require('./systems/ItemSystem');
const TiltSystem = require('./systems/TiltSystem');
const TeamfightSystem = require('./systems/TeamfightSystem');
const JungleSystem = require('./systems/JungleSystem');
const ObjectiveSystem = require('./systems/ObjectiveSystem');
const StructureSystem = require('./systems/StructureSystem');
const AbilitySystem = require('./systems/AbilitySystem');
const ChaosSystem = require('./systems/ChaosSystem');
const { WeatherSystem } = require('./systems/WeatherSystem');
const LevelingSystem = require('./systems/LevelingSystem');
const abilitiesData = require('./data/abilities.json');

/**
 * MatchSimulator - Public API for match simulation
 *
 * This will eventually replace server/game/match.js
 * Provides a clean interface for running deterministic MOBA matches.
 */
class MatchSimulator {
    constructor(matchConfig) {
        this.matchId = matchConfig.matchId || `match-${Date.now()}`;
        this.seed = matchConfig.seed || this.matchId;
        this.team1 = matchConfig.team1;
        this.team2 = matchConfig.team2;
        this.intensityMultiplier = matchConfig.intensityMultiplier || 1.0;  // For playoffs/championships

        // Create simulation engine
        this.engine = new SimulationEngine({
            seed: this.seed,
            maxWaves: matchConfig.maxWaves || 60,
            snapshotInterval: matchConfig.snapshotInterval || 10,
            intensityMultiplier: this.intensityMultiplier  // Pass to engine
        });

        this.initialized = false;
        this.listeners = {};
    }

    /**
     * Initialize match (setup entities, run draft if needed)
     */
    async initialize() {
        if (this.initialized) {
            throw new Error('Match already initialized');
        }

        // Initialize engine
        await this.engine.initialize({
            matchId: this.matchId,
            team1: this.team1,
            team2: this.team2
        });

        // Register systems (order matters - priority)
        const structureSystem = new StructureSystem();
        const itemSystem = new ItemSystem();
        const abilitySystem = new AbilitySystem();
        const levelingSystem = new LevelingSystem();
        const tiltSystem = new TiltSystem();
        const laneSystem = new LaneSystem();
        const jungleSystem = new JungleSystem();
        const objectiveSystem = new ObjectiveSystem();
        const teamfightSystem = new TeamfightSystem();
        const chaosSystem = new ChaosSystem();
        const weatherSystem = new WeatherSystem();

        // Load abilities into AbilitySystem
        abilitySystem.loadAbilities(abilitiesData);

        // Connect systems that need to communicate
        laneSystem.setAbilitySystem(abilitySystem);
        laneSystem.setLevelingSystem(levelingSystem);  // For CS XP rewards
        teamfightSystem.setAbilitySystem(abilitySystem);
        teamfightSystem.setLevelingSystem(levelingSystem);  // For kill/assist XP
        abilitySystem.setObjectiveSystem(objectiveSystem);  // For rift buffs (CDR, damage)
        objectiveSystem.setLevelingSystem(levelingSystem);  // For objective XP

        this.engine.registerSystem(structureSystem, 5);   // Structures first (win condition)
        this.engine.registerSystem(weatherSystem, 8);     // Weather (affects multipliers)
        this.engine.registerSystem(itemSystem, 10);       // Items (gold → purchases)
        this.engine.registerSystem(abilitySystem, 12);    // Abilities (mana regen, cooldowns)
        this.engine.registerSystem(levelingSystem, 13);   // Leveling (XP → level ups) - after abilities
        this.engine.registerSystem(tiltSystem, 15);       // Tilt (affects all performance)
        this.engine.registerSystem(laneSystem, 20);       // Lane phase
        this.engine.registerSystem(jungleSystem, 25);     // Jungle actions
        this.engine.registerSystem(objectiveSystem, 30);  // Objectives
        this.engine.registerSystem(teamfightSystem, 35);  // Teamfights last
        this.engine.registerSystem(chaosSystem, 40);      // Chaos events after everything

        // Store references for later use
        this.abilitySystem = abilitySystem;
        this.weatherSystem = weatherSystem;
        this.chaosSystem = chaosSystem;
        this.levelingSystem = levelingSystem;

        // Initialize weather
        const rng = this.engine.getRNG();
        const eventLog = this.engine.getEventLog();
        weatherSystem.initialize(rng.fork('weather_init'), eventLog, 0);

        // Create champion entities
        this._createChampionEntities();

        // Initialize abilities for all champions
        for (const champion of champions) {
            const identity = champion.getComponent('identity');
            if (identity.abilities) {
                const abilityIds = [
                    identity.abilities.q,
                    identity.abilities.w,
                    identity.abilities.e,
                    identity.abilities.r
                ];
                abilitySystem.initializeChampionAbilities(champion, abilityIds);
            }
        }

        // Initialize structures
        structureSystem.initialize(this.engine.getWorld());

        this.initialized = true;

        return {
            matchId: this.matchId,
            seed: this.seed
        };
    }

    /**
     * Create entity for each champion
     */
    _createChampionEntities() {
        const world = this.engine.getWorld();
        const roles = ['top', 'jungle', 'mid', 'bot', 'support'];

        // Team 1 champions
        for (const role of roles) {
            const championData = this._findChampionByRole(this.team1.champions, role);
            if (championData) {
                const entity = this._createChampionEntity(championData, 'team1', role);
                world.addEntity(entity);
            }
        }

        // Team 2 champions
        for (const role of roles) {
            const championData = this._findChampionByRole(this.team2.champions, role);
            if (championData) {
                const entity = this._createChampionEntity(championData, 'team2', role);
                world.addEntity(entity);
            }
        }
    }

    /**
     * Find champion by role from team roster
     */
    _findChampionByRole(champions, role) {
        const roleLower = role.toLowerCase();
        return champions.find(c => {
            const champRole = c.role.toLowerCase();
            // Handle bot/adc synonym
            if (roleLower === 'bot' && champRole === 'adc') return true;
            if (roleLower === 'adc' && champRole === 'bot') return true;
            return champRole === roleLower;
        });
    }

    /**
     * Create a champion entity with all components
     */
    _createChampionEntity(championData, teamId, role) {
        const entity = new Entity();

        // Identity
        const abilityIds = championData.abilities || ['void_bolt', 'reality_slash', 'shadow_step', 'black_hole'];
        entity.addComponent('identity', new CIdentity({
            id: `${teamId}-${role}`,
            name: championData.name,
            role: role,
            lore: championData.lore,
            teamId: teamId,
            archetype: championData.archetype || 'balanced',
            abilities: {
                q: abilityIds[0],
                w: abilityIds[1],
                e: abilityIds[2],
                r: abilityIds[3]
            }
        }));

        // Stats
        entity.addComponent('stats', new CStats({
            gold: 500,
            cs: 0,
            level: 1,
            kda: { kills: 0, deaths: 0, assists: 0 }
        }));

        // Hidden stats
        entity.addComponent('hiddenStats', new CHiddenStats({
            mechanical_skill: championData.mechanical_skill || 0.5,
            game_sense: championData.game_sense || 0.5,
            tilt_resistance: championData.tilt_resistance || 0.5,
            clutch_factor: championData.clutch_factor || 0.5,
            tilt_level: 0,
            power_curve: championData.power_curve || 'mid'  // 'early', 'mid', 'late'
        }));

        // Items
        entity.addComponent('items', new CItems());

        // Abilities component (CAbilities is used for ability-specific data)
        entity.addComponent('abilities', new CAbilities());

        // Leveling component (for XP and level progression)
        entity.addComponent('leveling', new CLeveling());

        // Position
        entity.addComponent('position', new CPosition(role, 'lane'));

        // Controller
        entity.addComponent('controller', new CController(role, 'balanced'));

        // Status
        entity.addComponent('status', new CStatus());

        // Quirks
        entity.addComponent('quirks', new CQuirks(championData.quirks || []));

        // Tags
        entity.addTag('champion');
        entity.addTag(teamId);
        entity.addTag(role);

        return entity;
    }

    /**
     * Step simulation forward one wave
     * @returns {object} Step result
     */
    step() {
        if (!this.initialized) {
            throw new Error('Match not initialized. Call initialize() first.');
        }

        const result = this.engine.step();

        // Emit events to listeners
        this._emitEvents(result.events);

        return result;
    }

    /**
     * Run match to completion
     * @returns {object} Match result
     */
    async runToCompletion() {
        if (!this.initialized) {
            await this.initialize();
        }

        const result = await this.engine.runToCompletion();

        return {
            matchId: this.matchId,
            seed: this.seed,
            winner: result.winner,
            waves: result.waves,
            eventCount: result.events.length,
            finalState: result.finalState
        };
    }

    /**
     * Get current match state
     * @returns {object}
     */
    getState() {
        return {
            matchId: this.matchId,
            seed: this.seed,
            initialized: this.initialized,
            engine: this.engine.getState(),
            champions: this._getChampionStates()
        };
    }

    /**
     * Get champion states for display
     * @returns {object[]}
     */
    _getChampionStates() {
        const world = this.engine.getWorld();
        const champions = world.queryByTag('champion');

        return champions.map(entity => {
            const identity = entity.getComponent('identity');
            const stats = entity.getComponent('stats');
            const hiddenStats = entity.getComponent('hiddenStats');
            const items = entity.getComponent('items');

            return {
                id: identity.id,
                name: identity.name,
                role: identity.role,
                teamId: identity.teamId,
                kda: stats.kda,
                cs: stats.cs,
                gold: stats.gold,
                level: stats.level,
                items: items.inventory,
                tilt: hiddenStats.tilt_level
            };
        });
    }

    /**
     * Get event log
     * @returns {EventLog}
     */
    getEventLog() {
        return this.engine.getEventLog();
    }

    /**
     * Get all events
     * @returns {object[]}
     */
    getAllEvents() {
        return this.engine.getEventLog().getAllEvents();
    }

    /**
     * Export replay data
     * @returns {object}
     */
    exportReplay() {
        return {
            matchId: this.matchId,
            seed: this.seed,
            team1: this.team1.name,
            team2: this.team2.name,
            events: this.getAllEvents(),
            finalState: this.engine.getWorld().serialize()
        };
    }

    /**
     * Register event listener
     * @param {string} eventType
     * @param {function} callback
     */
    on(eventType, callback) {
        if (!this.listeners[eventType]) {
            this.listeners[eventType] = [];
        }
        this.listeners[eventType].push(callback);
    }

    /**
     * Emit events to registered listeners
     * @param {object[]} events
     */
    _emitEvents(events) {
        for (const event of events) {
            const listeners = this.listeners[event.type] || [];
            const allListeners = this.listeners['*'] || [];

            [...listeners, ...allListeners].forEach(callback => {
                try {
                    callback(event);
                } catch (error) {
                    console.error('Error in event listener:', error);
                }
            });
        }
    }

    /**
     * Stop simulation
     */
    stop() {
        this.engine.stop();
    }

    /**
     * Reset simulation
     */
    reset() {
        this.engine.reset();
        this.initialized = false;
    }
}

module.exports = MatchSimulator;
