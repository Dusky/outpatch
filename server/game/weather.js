// Weather System - Affects gameplay mechanics

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
        },
        color: '#39ff14'
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
            visionModifier: 0.1, // Nearly blind
            invisible: true
        },
        color: '#ff10f0'
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
        },
        color: '#ff10f0'
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
            speedMultiplier: 0.5, // Everything slower
            timeDistortion: true
        },
        color: '#00ffff'
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
        },
        color: '#ff0040'
    },
    {
        id: 'glitch_weather',
        name: 'Reality Glitch',
        description: 'Stats and visuals corrupt',
        icon: '⚡',
        rarity: 'rare',
        effects: {
            damageMultiplier: 0.5, // Unpredictable
            goldMultiplier: 2.0,
            speedMultiplier: 1.5,
            statCorruption: true
        },
        color: '#ff10f0'
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
        },
        color: '#9a9aaa'
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
        },
        color: '#b8860b'
    },
    {
        id: 'chaos_winds',
        name: 'Chaos Winds',
        description: 'All effects randomized',
        icon: '🌀',
        rarity: 'epic',
        effects: {
            damageMultiplier: Math.random() * 2,
            goldMultiplier: Math.random() * 3,
            speedMultiplier: Math.random() * 2,
            totalChaos: true
        },
        color: '#ff10f0'
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
        },
        color: '#ff0040'
    }
];

class WeatherSystem {
    constructor(match) {
        this.match = match;
        this.currentWeather = this.getWeatherByID('clear');
        this.weatherDuration = 0;
        this.forecastQueue = [];
        this.weatherHistory = [];
    }

    initialize() {
        // Set initial weather
        this.changeWeather();

        // Generate forecast for next 3 weather changes
        this.generateForecast();
    }

    onWaveStart() {
        if (this.weatherDuration > 0) {
            this.weatherDuration--;

            // Apply ongoing weather effects
            this.applyWeatherEffects();

            if (this.weatherDuration === 0) {
                this.match.logEvent(`Weather clearing...`);
                this.changeWeather();
            }
        }
    }

    changeWeather() {
        // Get next weather from forecast or generate new one
        const newWeather = this.forecastQueue.length > 0
            ? this.forecastQueue.shift()
            : this.selectRandomWeather();

        this.currentWeather = newWeather;
        this.weatherDuration = Math.floor(Math.random() * 8) + 5; // 5-12 waves

        this.match.logEvent(`${newWeather.icon} WEATHER CHANGE: ${newWeather.name.toUpperCase()}`);
        this.match.logEvent(`${newWeather.description}`);

        // Store in history
        this.weatherHistory.push({
            weather: newWeather.id,
            wave: this.match.wave,
            duration: this.weatherDuration
        });

        // Broadcast weather to clients
        this.broadcastWeather();

        // Regenerate forecast
        this.generateForecast();
    }

    selectRandomWeather() {
        const rarityWeights = {
            common: 50,
            uncommon: 30,
            rare: 15,
            epic: 5
        };

        const weightedWeather = [];
        weatherTypes.forEach(weather => {
            const weight = rarityWeights[weather.rarity] || 10;
            for (let i = 0; i < weight; i++) {
                weightedWeather.push(weather);
            }
        });

        return weightedWeather[Math.floor(Math.random() * weightedWeather.length)];
    }

    generateForecast() {
        this.forecastQueue = [];
        for (let i = 0; i < 3; i++) {
            this.forecastQueue.push(this.selectRandomWeather());
        }
    }

    applyWeatherEffects() {
        const effects = this.currentWeather.effects;
        const allChamps = [...this.match.team1.champions, ...this.match.team2.champions];

        // Apply gold rain
        if (effects.goldRain) {
            if (Math.random() < 0.3) { // 30% chance per wave
                const goldAmount = Math.floor(Math.random() * 500) + 200;
                allChamps.forEach(champ => {
                    champ.gold += goldAmount;
                });
                this.match.logEvent(`✨ Gold rains from the sky! Everyone gains ${goldAmount} gold!`);
            }
        }

        // Apply random teleportation
        if (effects.randomTeleport) {
            if (Math.random() < 0.2) { // 20% chance per wave
                const champ = allChamps[Math.floor(Math.random() * allChamps.length)];
                this.match.logEvent(`🌪️ ${champ.name} has been teleported randomly!`);
            }
        }

        // Apply tilt increase
        if (effects.tiltIncrease) {
            allChamps.forEach(champ => {
                champ.tilt_level = Math.min(1.0, champ.tilt_level + effects.tiltIncrease);
            });
        }

        // Apply stat corruption
        if (effects.statCorruption) {
            if (Math.random() < 0.1) { // 10% chance per wave
                const champ = allChamps[Math.floor(Math.random() * allChamps.length)];
                this.match.logEvent(`⚡ ${champ.name}'s stats are glitching! Numbers don't make sense!`);
            }
        }

        // Apply total chaos
        if (effects.totalChaos) {
            if (Math.random() < 0.15) { // 15% chance per wave
                this.match.logEvent(`🌀 The chaos winds shift... everything changes!`);
                // Regenerate effect multipliers
                this.currentWeather.effects.damageMultiplier = Math.random() * 2;
                this.currentWeather.effects.goldMultiplier = Math.random() * 3;
                this.currentWeather.effects.speedMultiplier = Math.random() * 2;
            }
        }
    }

    getWeatherByID(id) {
        return weatherTypes.find(w => w.id === id) || weatherTypes[0];
    }

    getCurrentWeather() {
        return {
            ...this.currentWeather,
            duration: this.weatherDuration,
            forecast: this.forecastQueue.map(w => ({ name: w.name, icon: w.icon }))
        };
    }

    broadcastWeather() {
        const weatherData = this.getCurrentWeather();
        this.match.wss.clients.forEach(client => {
            client.send(JSON.stringify({
                type: 'weather_update',
                weather: weatherData
            }));
        });
    }

    // Modify damage based on weather
    modifyDamage(baseDamage) {
        return baseDamage * this.currentWeather.effects.damageMultiplier;
    }

    // Modify gold gains based on weather
    modifyGold(baseGold) {
        return Math.floor(baseGold * this.currentWeather.effects.goldMultiplier);
    }

    // Check if champions are invisible
    isInvisible() {
        return this.currentWeather.effects.invisible || false;
    }
}

module.exports = { WeatherSystem, weatherTypes };
