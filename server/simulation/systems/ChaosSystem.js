const EventLog = require('../engines/EventLog');

/**
 * ChaosSystem - Manages chaos events in ECS environment
 *
 * Chaos events are random occurrences that modify game state in unexpected ways.
 * Examples: stat swaps, gold rain, void consumption, role shuffles
 */
class ChaosSystem {
    constructor() {
        this.chaosLevel = 0; // Increases over time (0-1)
        this.activeEvents = []; // Currently active chaos events
        this.eventHistory = []; // All triggered events this match

        this.config = {
            baseChance: 0.08,      // 8% base chance per wave
            maxChance: 0.20,       // 20% max chance at full chaos
            chaosGrowth: 0.01,     // Chaos level increase per wave
            earlyGameWaves: 10     // Waves before rare events can trigger
        };

        // Rarity weights for event selection
        this.rarityWeights = {
            common: 50,
            uncommon: 30,
            rare: 15,
            epic: 5,
            legendary: 2
        };
    }

    /**
     * Update system - process chaos events each wave
     */
    update(world, rng, eventLog, phase) {
        const tick = world.getTick();
        const systemRng = rng.fork('chaos');

        // Increase chaos level over time
        this.chaosLevel = Math.min(1.0, this.chaosLevel + this.config.chaosGrowth);

        // Process active events (reduce duration)
        this._processActiveEvents(world, tick, eventLog);

        // Chance of new chaos event increases with chaos level
        const chaosChance = this.config.baseChance + (this.chaosLevel * (this.config.maxChance - this.config.baseChance));

        if (systemRng.chance(chaosChance)) {
            this._triggerRandomEvent(world, tick, eventLog, systemRng);
        }
    }

    /**
     * Process active chaos events (reduce duration, remove expired)
     */
    _processActiveEvents(world, tick, eventLog) {
        this.activeEvents = this.activeEvents.filter(event => {
            if (event.duration > 0) {
                event.duration--;

                // Call onTick callback if exists
                if (event.onTick) {
                    event.onTick(world, event.duration);
                }

                // If event just expired, call onExpire
                if (event.duration === 0 && event.onExpire) {
                    event.onExpire(world);

                    eventLog.log({
                        type: EventLog.EventTypes.CHAOS_EVENT,
                        tick: tick,
                        eventId: event.id,
                        eventName: event.name,
                        action: 'expired'
                    });
                }

                return event.duration > 0;
            }
            return false;
        });
    }

    /**
     * Trigger a random chaos event
     */
    _triggerRandomEvent(world, tick, eventLog, rng) {
        const availableEvents = this._getAvailableEvents(world.getTick());

        if (availableEvents.length === 0) return;

        // Weight events by rarity
        const weightedEvents = [];
        availableEvents.forEach(event => {
            const weight = this.rarityWeights[event.rarity] || 10;
            for (let i = 0; i < weight; i++) {
                weightedEvents.push(event);
            }
        });

        const selectedEvent = rng.choice(weightedEvents);

        if (selectedEvent) {
            this._executeEvent(selectedEvent, world, tick, eventLog, rng);
        }
    }

    /**
     * Get events available at current tick
     */
    _getAvailableEvents(tick) {
        // Define chaos events inline (or load from external file)
        const allEvents = this._getChaosEventDefinitions();

        return allEvents.filter(event => {
            // Filter out rare events in early game
            if (tick < this.config.earlyGameWaves && ['rare', 'epic', 'legendary'].includes(event.rarity)) {
                return false;
            }
            return true;
        });
    }

    /**
     * Execute a chaos event
     */
    _executeEvent(event, world, tick, eventLog, rng) {
        // Log event trigger
        eventLog.log({
            type: EventLog.EventTypes.CHAOS_EVENT,
            tick: tick,
            eventId: event.id,
            eventName: event.name,
            rarity: event.rarity,
            description: event.description,
            action: 'triggered'
        });

        // Execute the event
        const result = event.execute(world, rng, eventLog, tick);

        // Add to event history
        this.eventHistory.push({
            id: event.id,
            name: event.name,
            tick: tick
        });

        // If event has duration, track it
        if (result && result.duration) {
            this.activeEvents.push({
                id: event.id,
                name: event.name,
                duration: result.duration,
                onTick: result.onTick,
                onExpire: result.onExpire
            });
        }
    }

    /**
     * Get chaos level (0-1)
     */
    getChaosLevel() {
        return this.chaosLevel;
    }

    /**
     * Get active chaos events
     */
    getActiveEvents() {
        return this.activeEvents;
    }

    /**
     * Define chaos events (can be moved to external file later)
     */
    _getChaosEventDefinitions() {
        return [
            // GOLD RAIN - Everyone gains gold
            {
                id: 'gold_rain',
                name: 'Gold Rain from the Void',
                description: 'All champions gain massive gold',
                rarity: 'common',
                execute: (world, rng) => {
                    const goldAmount = Math.floor(rng.next() * 2000) + 1000;
                    const champions = world.queryByTag('champion');

                    for (const champion of champions) {
                        const stats = champion.getComponent('stats');
                        stats.gold += goldAmount;
                    }

                    return null; // No duration
                }
            },

            // STAT CORRUPTION - Invert mechanical_skill
            {
                id: 'stat_corruption',
                name: 'Statistical Anomaly',
                description: 'All champion stats are inverted for 2 waves',
                rarity: 'uncommon',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    const originalStats = new Map();

                    // Invert mechanical_skill
                    for (const champion of champions) {
                        const hiddenStats = champion.getComponent('hiddenStats');
                        originalStats.set(champion.id, hiddenStats.mechanical_skill);
                        hiddenStats.mechanical_skill = 1 - hiddenStats.mechanical_skill;
                    }

                    return {
                        duration: 2,
                        onExpire: (world) => {
                            // Restore original stats
                            for (const champion of champions) {
                                const hiddenStats = champion.getComponent('hiddenStats');
                                const original = originalStats.get(champion.id);
                                if (original !== undefined) {
                                    hiddenStats.mechanical_skill = original;
                                }
                            }
                        }
                    };
                }
            },

            // MENTAL BOOM - Everyone tilts
            {
                id: 'mental_boom',
                name: 'Collective Mental Boom',
                description: 'All champions max tilt simultaneously',
                rarity: 'uncommon',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');

                    for (const champion of champions) {
                        const hiddenStats = champion.getComponent('hiddenStats');
                        hiddenStats.tilt_level = Math.min(1.0, hiddenStats.tilt_level + 0.5);
                    }

                    return null;
                }
            },

            // ENLIGHTENMENT - Everyone becomes pro
            {
                id: 'enlightenment',
                name: 'Sudden Enlightenment',
                description: 'All champions gain maximum skill for 1 wave',
                rarity: 'rare',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    const originalStats = new Map();

                    for (const champion of champions) {
                        const hiddenStats = champion.getComponent('hiddenStats');
                        originalStats.set(champion.id, {
                            mechanical_skill: hiddenStats.mechanical_skill,
                            game_sense: hiddenStats.game_sense,
                            tilt_level: hiddenStats.tilt_level
                        });

                        hiddenStats.mechanical_skill = 1.0;
                        hiddenStats.game_sense = 1.0;
                        hiddenStats.tilt_level = 0;
                    }

                    return {
                        duration: 1,
                        onExpire: (world) => {
                            for (const champion of champions) {
                                const hiddenStats = champion.getComponent('hiddenStats');
                                const original = originalStats.get(champion.id);
                                if (original) {
                                    hiddenStats.mechanical_skill = original.mechanical_skill;
                                    hiddenStats.game_sense = original.game_sense;
                                    hiddenStats.tilt_level = original.tilt_level;
                                }
                            }
                        }
                    };
                }
            },

            // ITEM THEFT - One team steals gold from other
            {
                id: 'item_theft',
                name: 'The Great Heist',
                description: 'One team steals gold from the other',
                rarity: 'uncommon',
                execute: (world, rng) => {
                    const team1Champions = world.queryByTags('champion', 'team1');
                    const team2Champions = world.queryByTags('champion', 'team2');

                    const thiefTeam = rng.chance(0.5) ? team1Champions : team2Champions;
                    const victimTeam = thiefTeam === team1Champions ? team2Champions : team1Champions;

                    const stolenGold = Math.floor(rng.next() * 1000) + 500;
                    const goldPerChamp = stolenGold / thiefTeam.length;

                    for (const champion of thiefTeam) {
                        const stats = champion.getComponent('stats');
                        stats.gold += goldPerChamp;
                    }

                    for (const champion of victimTeam) {
                        const stats = champion.getComponent('stats');
                        stats.gold = Math.max(0, stats.gold - goldPerChamp);
                    }

                    return null;
                }
            },

            // TIME LOOP - Replay previous wave (decrease tick)
            {
                id: 'time_loop',
                name: 'Temporal Anomaly',
                description: 'Repeat the previous wave',
                rarity: 'uncommon',
                execute: (world, rng) => {
                    // Note: Actual time loop requires special handling in simulation engine
                    // For now, just a narrative event
                    return null;
                }
            },

            // SHOP CLOSED - No gold gain for 3 waves
            {
                id: 'shop_closed',
                name: 'Shop Malfunction',
                description: 'No gold gain for 3 waves',
                rarity: 'common',
                execute: (world, rng) => {
                    // Track in world metadata
                    world.metadata.shopClosed = true;

                    return {
                        duration: 3,
                        onExpire: (world) => {
                            world.metadata.shopClosed = false;
                        }
                    };
                }
            }
        ];
    }
}

module.exports = ChaosSystem;
