const EventLog = require('../engines/EventLog');

const weatherTypes = [
    {
        id: 'clear',
        name: 'Clear Skies',
        description: 'Normal conditions',
        icon: '☀️',
        rarity: 'common',
        effects: {
            damageMultiplier: 1.0,
            goldMultiplier: 1.0,
            speedMultiplier: 1.0,
            visionModifier: 1.0
        }
    },
    {
        id: 'solar_eclipse',
        name: 'Solar Eclipse',
        description: 'All champions become invisible',
        icon: '🌑',
        rarity: 'rare',
        effects: {
            damageMultiplier: 1.0,
            goldMultiplier: 1.0,
            speedMultiplier: 1.0,
            visionModifier: 0.1,
            invisible: true
        }
    },
    {
        id: 'void_storm',
        name: 'Void Storm',
        description: 'Random teleportation chaos',
        icon: '🌪️',
        rarity: 'uncommon',
        effects: {
            damageMultiplier: 1.2,
            goldMultiplier: 1.0,
            speedMultiplier: 0.8,
            randomTeleport: true
        }
    },
    {
        id: 'time_dilation',
        name: 'Time Dilation',
        description: 'Game speed fluctuates wildly',
        icon: '⏰',
        rarity: 'rare',
        effects: {
            damageMultiplier: 1.0,
            goldMultiplier: 1.5,
            speedMultiplier: 0.5,
            timeDistortion: true
        }
    },
    {
        id: 'blood_rain',
        name: 'Blood Rain',
        description: 'Increased damage and aggression',
        icon: '🩸',
        rarity: 'uncommon',
        effects: {
            damageMultiplier: 1.5,
            goldMultiplier: 1.0,
            speedMultiplier: 1.2,
            aggressionBoost: true
        }
    },
    {
        id: 'glitch_weather',
        name: 'Reality Glitch',
        description: 'Stats and visuals corrupt',
        icon: '⚡',
        rarity: 'rare',
        effects: {
            damageMultiplier: 0.5,
            goldMultiplier: 2.0,
            speedMultiplier: 1.5,
            statCorruption: true
        }
    },
    {
        id: 'fog',
        name: 'Dense Fog',
        description: 'Reduced vision and slower pace',
        icon: '🌫️',
        rarity: 'common',
        effects: {
            damageMultiplier: 0.8,
            goldMultiplier: 1.0,
            speedMultiplier: 0.7,
            visionModifier: 0.3
        }
    },
    {
        id: 'gold_dust',
        name: 'Golden Dust Storm',
        description: 'Gold rains from the sky',
        icon: '✨',
        rarity: 'uncommon',
        effects: {
            damageMultiplier: 1.0,
            goldMultiplier: 3.0,
            speedMultiplier: 1.0,
            goldRain: true
        }
    },
    {
        id: 'heat_wave',
        name: 'Scorching Heat',
        description: 'Champions get exhausted faster',
        icon: '🔥',
        rarity: 'common',
        effects: {
            damageMultiplier: 1.1,
            goldMultiplier: 1.0,
            speedMultiplier: 0.8,
            tiltIncrease: 0.1
        }
    }
];

/**
 * WeatherSystem - Manages dynamic weather effects in ECS environment
 *
 * Weather affects:
 * - Damage multipliers
 * - Gold gains
 * - Champion speeds
 * - Vision
 * - Special effects (gold rain, teleports, etc.)
 */
class WeatherSystem {
    constructor() {
        this.currentWeather = weatherTypes.find(w => w.id === 'clear');
        this.weatherDuration = 0;
        this.forecastQueue = [];
        this.weatherHistory = [];

        this.rarityWeights = {
            common: 50,
            uncommon: 30,
            rare: 15,
            epic: 5
        };
    }

    /**
     * Initialize weather system
     */
    initialize(rng, eventLog, tick) {
        this.changeWeather(rng, eventLog, tick);
        this.generateForecast(rng);
    }

    /**
     * Update system - manage weather changes and effects
     */
    update(world, rng, eventLog, phase) {
        const tick = world.getTick();
        const systemRng = rng.fork('weather');

        if (this.weatherDuration > 0) {
            this.weatherDuration--;

            // Apply ongoing weather effects
            this.applyWeatherEffects(world, systemRng, eventLog, tick);

            // Change weather when duration expires
            if (this.weatherDuration === 0) {
                this.changeWeather(systemRng, eventLog, tick);
            }
        }
    }

    /**
     * Change to new weather
     */
    changeWeather(rng, eventLog, tick) {
        // Get next weather from forecast or generate new one
        const newWeather = this.forecastQueue.length > 0
            ? this.forecastQueue.shift()
            : this.selectRandomWeather(rng);

        this.currentWeather = newWeather;
        this.weatherDuration = Math.floor(rng.next() * 8) + 5; // 5-12 waves

        // Log weather change
        eventLog.log({
            type: EventLog.EventTypes.WEATHER_CHANGE,
            tick: tick,
            weatherId: newWeather.id,
            weatherName: newWeather.name,
            weatherIcon: newWeather.icon,
            description: newWeather.description,
            duration: this.weatherDuration
        });

        // Store in history
        this.weatherHistory.push({
            weather: newWeather.id,
            tick: tick,
            duration: this.weatherDuration
        });

        // Regenerate forecast
        this.generateForecast(rng);
    }

    /**
     * Select random weather based on rarity weights
     */
    selectRandomWeather(rng) {
        const weightedWeather = [];
        weatherTypes.forEach(weather => {
            const weight = this.rarityWeights[weather.rarity] || 10;
            for (let i = 0; i < weight; i++) {
                weightedWeather.push(weather);
            }
        });

        return rng.choice(weightedWeather);
    }

    /**
     * Generate forecast for next 3 weather changes
     */
    generateForecast(rng) {
        this.forecastQueue = [];
        for (let i = 0; i < 3; i++) {
            this.forecastQueue.push(this.selectRandomWeather(rng));
        }
    }

    /**
     * Apply ongoing weather effects to world
     */
    applyWeatherEffects(world, rng, eventLog, tick) {
        const effects = this.currentWeather.effects;
        const champions = world.queryByTag('champion');

        // Gold Rain effect
        if (effects.goldRain && rng.chance(0.3)) {
            const goldAmount = Math.floor(rng.next() * 500) + 200;

            for (const champion of champions) {
                const stats = champion.getComponent('stats');
                stats.gold += goldAmount;
            }

            eventLog.log({
                type: 'weather.effect',
                tick: tick,
                effect: 'gold_rain',
                amount: goldAmount
            });
        }

        // Random Teleport effect
        if (effects.randomTeleport && rng.chance(0.2)) {
            const champion = rng.choice(champions);
            const identity = champion.getComponent('identity');

            eventLog.log({
                type: 'weather.effect',
                tick: tick,
                effect: 'teleport',
                championName: identity.name
            });
        }

        // Tilt Increase effect
        if (effects.tiltIncrease) {
            for (const champion of champions) {
                const hiddenStats = champion.getComponent('hiddenStats');
                hiddenStats.tilt_level = Math.min(1.0, hiddenStats.tilt_level + effects.tiltIncrease);
            }
        }

        // Stat Corruption effect
        if (effects.statCorruption && rng.chance(0.1)) {
            const champion = rng.choice(champions);
            const identity = champion.getComponent('identity');

            eventLog.log({
                type: 'weather.effect',
                tick: tick,
                effect: 'stat_corruption',
                championName: identity.name
            });
        }
    }

    /**
     * Get current weather state
     */
    getCurrentWeather() {
        return {
            ...this.currentWeather,
            duration: this.weatherDuration,
            forecast: this.forecastQueue.map(w => ({
                name: w.name,
                icon: w.icon,
                id: w.id
            }))
        };
    }

    /**
     * Modify damage based on current weather
     */
    modifyDamage(baseDamage) {
        return baseDamage * (this.currentWeather.effects.damageMultiplier || 1.0);
    }

    /**
     * Modify gold gains based on current weather
     */
    modifyGold(baseGold) {
        return Math.floor(baseGold * (this.currentWeather.effects.goldMultiplier || 1.0));
    }

    /**
     * Check if champions are invisible due to weather
     */
    isInvisible() {
        return this.currentWeather.effects.invisible || false;
    }

    /**
     * Get weather multipliers for external use
     */
    getMultipliers() {
        return {
            damage: this.currentWeather.effects.damageMultiplier || 1.0,
            gold: this.currentWeather.effects.goldMultiplier || 1.0,
            speed: this.currentWeather.effects.speedMultiplier || 1.0,
            vision: this.currentWeather.effects.visionModifier || 1.0
        };
    }
}

module.exports = { WeatherSystem, weatherTypes };
