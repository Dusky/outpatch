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
            },

            // COOLDOWN RESET - All abilities off cooldown
            {
                id: 'cooldown_reset',
                name: 'Temporal Acceleration',
                description: 'All ability cooldowns instantly reset',
                rarity: 'rare',
                execute: (world, rng) => {
                    // This would need AbilitySystem access to reset cooldowns
                    // For now, narrative event
                    return null;
                }
            },

            // SIZE SWAP - Giants vs Tiny champions
            {
                id: 'size_swap',
                name: 'Dimensional Instability',
                description: 'Half the champions become giants, half become tiny',
                rarity: 'uncommon',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    const shuffled = [...champions].sort(() => rng.next() - 0.5);

                    const giants = shuffled.slice(0, champions.length / 2);
                    const tiny = shuffled.slice(champions.length / 2);

                    const originalSizes = new Map();

                    for (const champion of giants) {
                        const stats = champion.getComponent('stats');
                        originalSizes.set(champion.id, {
                            ad: stats.attack_damage,
                            health: stats.max_health
                        });
                        stats.attack_damage = (stats.attack_damage || 60) * 1.5;
                        stats.max_health = (stats.max_health || 550) * 1.3;
                    }

                    for (const champion of tiny) {
                        const stats = champion.getComponent('stats');
                        originalSizes.set(champion.id, {
                            ad: stats.attack_damage,
                            health: stats.max_health
                        });
                        stats.attack_damage = (stats.attack_damage || 60) * 0.7;
                        stats.max_health = (stats.max_health || 550) * 0.8;
                    }

                    return {
                        duration: 3,
                        onExpire: (world) => {
                            for (const champion of champions) {
                                const stats = champion.getComponent('stats');
                                const original = originalSizes.get(champion.id);
                                if (original) {
                                    stats.attack_damage = original.ad;
                                    stats.max_health = original.health;
                                }
                            }
                        }
                    };
                }
            },

            // REVERSE GRAVITY - Damage and healing swapped
            {
                id: 'reverse_gravity',
                name: 'Reality Inversion',
                description: 'Damage heals, healing damages for 2 waves',
                rarity: 'epic',
                execute: (world, rng) => {
                    world.metadata.reverseGravity = true;
                    return {
                        duration: 2,
                        onExpire: (world) => {
                            world.metadata.reverseGravity = false;
                        }
                    };
                }
            },

            // MANA VOID - Everyone loses all mana
            {
                id: 'mana_void',
                name: 'Mana Void',
                description: 'All mana instantly drained',
                rarity: 'uncommon',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    for (const champion of champions) {
                        const stats = champion.getComponent('stats');
                        if (stats.mana) {
                            stats.mana = 0;
                        }
                    }
                    return null;
                }
            },

            // MANA OVERFLOW - Everyone gains max mana
            {
                id: 'mana_overflow',
                name: 'Mana Overflow',
                description: 'All champions gain infinite mana for 1 wave',
                rarity: 'rare',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    for (const champion of champions) {
                        const stats = champion.getComponent('stats');
                        if (stats.max_mana) {
                            stats.mana = stats.max_mana * 10;
                        }
                    }
                    return null;
                }
            },

            // SPEED DEMON - Everyone moves super fast
            {
                id: 'speed_demon',
                name: 'Hyperspeed',
                description: 'All champions gain 200% movement speed',
                rarity: 'common',
                execute: (world, rng) => {
                    world.metadata.hyperSpeed = true;
                    return {
                        duration: 2,
                        onExpire: (world) => {
                            world.metadata.hyperSpeed = false;
                        }
                    };
                }
            },

            // SLOW MOTION - Everything slowed
            {
                id: 'slow_motion',
                name: 'Temporal Stasis',
                description: 'All actions happen in slow motion',
                rarity: 'common',
                execute: (world, rng) => {
                    world.metadata.slowMotion = true;
                    return {
                        duration: 2,
                        onExpire: (world) => {
                            world.metadata.slowMotion = false;
                        }
                    };
                }
            },

            // CRITICAL EXISTENCE - Everything crits
            {
                id: 'critical_existence',
                name: 'Critical Existence',
                description: 'All attacks are critical hits for 2 waves',
                rarity: 'rare',
                execute: (world, rng) => {
                    world.metadata.allCrits = true;
                    return {
                        duration: 2,
                        onExpire: (world) => {
                            world.metadata.allCrits = false;
                        }
                    };
                }
            },

            // PACIFISM - No damage dealt
            {
                id: 'pacifism',
                name: 'Universal Pacifism',
                description: 'No champion can deal damage for 1 wave',
                rarity: 'rare',
                execute: (world, rng) => {
                    world.metadata.pacifism = true;
                    return {
                        duration: 1,
                        onExpire: (world) => {
                            world.metadata.pacifism = false;
                        }
                    };
                }
            },

            // ITEM SHUFFLE - Everyone's items randomized
            {
                id: 'item_shuffle',
                name: 'The Great Redistribution',
                description: 'All items are randomly redistributed',
                rarity: 'epic',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    const allItems = [];

                    // Collect all items
                    for (const champion of champions) {
                        const items = champion.getComponent('items');
                        allItems.push(...items.inventory);
                        items.inventory = [];
                    }

                    // Shuffle items
                    const shuffled = [...allItems].sort(() => rng.next() - 0.5);

                    // Redistribute
                    let itemIndex = 0;
                    for (const champion of champions) {
                        const items = champion.getComponent('items');
                        const itemCount = Math.min(6, Math.floor(allItems.length / champions.length));
                        for (let i = 0; i < itemCount && itemIndex < shuffled.length; i++) {
                            items.inventory.push(shuffled[itemIndex++]);
                        }
                    }

                    return null;
                }
            },

            // DEBT COLLECTOR - Everyone loses 50% gold
            {
                id: 'debt_collector',
                name: 'The Debt Collector Arrives',
                description: 'All champions lose 50% of their gold',
                rarity: 'uncommon',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    for (const champion of champions) {
                        const stats = champion.getComponent('stats');
                        stats.gold = Math.floor(stats.gold * 0.5);
                    }
                    return null;
                }
            },

            // GOLD MULTIPLICATION - Gold doubles
            {
                id: 'gold_multiplication',
                name: 'Infinite Money Glitch',
                description: 'All gold gains doubled for 3 waves',
                rarity: 'uncommon',
                execute: (world, rng) => {
                    world.metadata.doubleGold = true;
                    return {
                        duration: 3,
                        onExpire: (world) => {
                            world.metadata.doubleGold = false;
                        }
                    };
                }
            },

            // INVINCIBILITY - One random champion becomes invincible
            {
                id: 'chosen_one',
                name: 'The Chosen One',
                description: 'One random champion becomes invincible',
                rarity: 'epic',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    const chosen = rng.choice(champions);
                    const stats = chosen.getComponent('stats');
                    const originalHealth = stats.health;

                    stats.invincible = true;

                    return {
                        duration: 2,
                        onExpire: (world) => {
                            stats.invincible = false;
                        }
                    };
                }
            },

            // ABILITY SWAP - Champions swap abilities with random enemy
            {
                id: 'ability_swap',
                name: 'Cognitive Scramble',
                description: 'Champions swap abilities with random enemies',
                rarity: 'rare',
                execute: (world, rng) => {
                    const team1 = world.queryByTags('champion', 'team1');
                    const team2 = world.queryByTags('champion', 'team2');

                    const swaps = new Map();

                    for (let i = 0; i < Math.min(team1.length, team2.length); i++) {
                        const champ1 = team1[i];
                        const champ2 = team2[i];

                        const identity1 = champ1.getComponent('identity');
                        const identity2 = champ2.getComponent('identity');

                        swaps.set(champ1.id, { ...identity1.abilities });
                        swaps.set(champ2.id, { ...identity2.abilities });

                        const temp = { ...identity1.abilities };
                        identity1.abilities = { ...identity2.abilities };
                        identity2.abilities = temp;
                    }

                    return {
                        duration: 3,
                        onExpire: (world) => {
                            for (let i = 0; i < Math.min(team1.length, team2.length); i++) {
                                const champ1 = team1[i];
                                const champ2 = team2[i];

                                const identity1 = champ1.getComponent('identity');
                                const identity2 = champ2.getComponent('identity');

                                const original1 = swaps.get(champ1.id);
                                const original2 = swaps.get(champ2.id);

                                if (original1) identity1.abilities = original1;
                                if (original2) identity2.abilities = original2;
                            }
                        }
                    };
                }
            },

            // GLASS CANNON - Max damage, min defense
            {
                id: 'glass_cannon',
                name: 'Glass Cannon Mode',
                description: 'All champions gain 200% damage but lose 50% health',
                rarity: 'uncommon',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    const originalStats = new Map();

                    for (const champion of champions) {
                        const stats = champion.getComponent('stats');
                        originalStats.set(champion.id, {
                            ad: stats.attack_damage,
                            ap: stats.ability_power,
                            health: stats.max_health
                        });

                        stats.attack_damage = (stats.attack_damage || 60) * 2;
                        stats.ability_power = (stats.ability_power || 0) * 2;
                        stats.max_health = (stats.max_health || 550) * 0.5;
                        stats.health = Math.min(stats.health, stats.max_health);
                    }

                    return {
                        duration: 2,
                        onExpire: (world) => {
                            for (const champion of champions) {
                                const stats = champion.getComponent('stats');
                                const original = originalStats.get(champion.id);
                                if (original) {
                                    stats.attack_damage = original.ad;
                                    stats.ability_power = original.ap;
                                    stats.max_health = original.health;
                                }
                            }
                        }
                    };
                }
            },

            // TANK MODE - Max defense, min damage
            {
                id: 'tank_mode',
                name: 'Fortification Protocol',
                description: 'All champions gain 300% health but deal 50% damage',
                rarity: 'uncommon',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    const originalStats = new Map();

                    for (const champion of champions) {
                        const stats = champion.getComponent('stats');
                        originalStats.set(champion.id, {
                            ad: stats.attack_damage,
                            ap: stats.ability_power,
                            health: stats.max_health
                        });

                        stats.attack_damage = (stats.attack_damage || 60) * 0.5;
                        stats.ability_power = (stats.ability_power || 0) * 0.5;
                        stats.max_health = (stats.max_health || 550) * 3;
                        stats.health = stats.max_health;
                    }

                    return {
                        duration: 2,
                        onExpire: (world) => {
                            for (const champion of champions) {
                                const stats = champion.getComponent('stats');
                                const original = originalStats.get(champion.id);
                                if (original) {
                                    stats.attack_damage = original.ad;
                                    stats.ability_power = original.ap;
                                    stats.max_health = original.health;
                                }
                            }
                        }
                    };
                }
            },

            // UNTILT - Everyone loses all tilt
            {
                id: 'mass_untilt',
                name: 'Collective Therapy Session',
                description: 'All champions lose all tilt and gain peace',
                rarity: 'rare',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    for (const champion of champions) {
                        const hiddenStats = champion.getComponent('hiddenStats');
                        hiddenStats.tilt_level = 0;
                    }
                    return null;
                }
            },

            // VISION LOSS - Everyone blind
            {
                id: 'vision_loss',
                name: 'Total Blackout',
                description: 'All champions lose vision for 1 wave',
                rarity: 'uncommon',
                execute: (world, rng) => {
                    world.metadata.blind = true;
                    return {
                        duration: 1,
                        onExpire: (world) => {
                            world.metadata.blind = false;
                        }
                    };
                }
            },

            // RUBBER BAND SNAP - Gold equalized
            {
                id: 'wealth_redistribution',
                name: 'Communist Revolution',
                description: 'All gold is redistributed equally',
                rarity: 'epic',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    let totalGold = 0;

                    for (const champion of champions) {
                        const stats = champion.getComponent('stats');
                        totalGold += stats.gold;
                    }

                    const avgGold = Math.floor(totalGold / champions.length);

                    for (const champion of champions) {
                        const stats = champion.getComponent('stats');
                        stats.gold = avgGold;
                    }

                    return null;
                }
            },

            // PENTAKILL POTENTIAL - Next kill is a pentakill
            {
                id: 'pentakill_mode',
                name: 'Pentakill Energy',
                description: 'Next kill by any champion counts as a pentakill',
                rarity: 'epic',
                execute: (world, rng) => {
                    world.metadata.pentakillMode = true;
                    return {
                        duration: 1,
                        onExpire: (world) => {
                            world.metadata.pentakillMode = false;
                        }
                    };
                }
            },

            // FOURTH WALL BREAK - Meta commentary
            {
                id: 'fourth_wall',
                name: 'Existential Awareness',
                description: 'Champions become aware they are in a simulation',
                rarity: 'legendary',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    for (const champion of champions) {
                        const hiddenStats = champion.getComponent('hiddenStats');
                        // Existential crisis causes tilt
                        hiddenStats.tilt_level = Math.min(1.0, hiddenStats.tilt_level + 0.3);
                    }
                    return null;
                }
            },

            // ROLE REVERSAL - Teams swap sides
            {
                id: 'team_swap',
                name: 'Reality Swap',
                description: 'Teams swap sides for 2 waves',
                rarity: 'epic',
                execute: (world, rng) => {
                    // This would require complex team swap logic
                    // For now, narrative event
                    return null;
                }
            },

            // LEVEL UP - Everyone gains 3 levels
            {
                id: 'mass_level_up',
                name: 'Experience Surge',
                description: 'All champions gain 3 levels instantly',
                rarity: 'uncommon',
                execute: (world, rng) => {
                    const champions = world.queryByTag('champion');
                    for (const champion of champions) {
                        const stats = champion.getComponent('stats');
                        stats.level = Math.min(18, (stats.level || 1) + 3);
                    }
                    return null;
                }
            },

            // ITEM UPGRADE - All items become legendary
            {
                id: 'item_ascension',
                name: 'Item Ascension',
                description: 'All items gain 50% more stats for 3 waves',
                rarity: 'rare',
                execute: (world, rng) => {
                    world.metadata.itemAscension = true;
                    return {
                        duration: 3,
                        onExpire: (world) => {
                            world.metadata.itemAscension = false;
                        }
                    };
                }
            }
        ];
    }
}

module.exports = ChaosSystem;
