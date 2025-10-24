// Enhanced Chaos Events System
// Events that actually affect gameplay mechanics

const chaosEvents = [
    {
        id: 'team_swap',
        name: 'Reality Swap',
        description: 'Two random champions swap teams for 3 waves',
        rarity: 'rare',
        execute: (match) => {
            const team1Champs = match.team1.champions;
            const team2Champs = match.team2.champions;

            const champ1 = team1Champs[Math.floor(Math.random() * team1Champs.length)];
            const champ2 = team2Champs[Math.floor(Math.random() * team2Champs.length)];

            match.logEvent(`⚡ CHAOS EVENT: ${champ1.name} and ${champ2.name} have SWAPPED TEAMS for 3 waves!`);

            // Store original state
            match.chaosState = match.chaosState || {};
            match.chaosState.swappedChamps = { champ1, champ2, duration: 3 };

            return {
                duration: 3,
                onWave: () => {
                    if (match.chaosState.swappedChamps.duration > 0) {
                        match.chaosState.swappedChamps.duration--;
                        if (match.chaosState.swappedChamps.duration === 0) {
                            match.logEvent(`Reality restored. Champions returned to original teams.`);
                            delete match.chaosState.swappedChamps;
                        }
                    }
                }
            };
        }
    },
    {
        id: 'stat_corruption',
        name: 'Statistical Anomaly',
        description: 'All champion stats are inverted for 2 waves',
        rarity: 'uncommon',
        execute: (match) => {
            match.logEvent(`📊 CHAOS EVENT: STATS CORRUPTED! High performers become weak, weak become strong!`);

            const allChamps = [...match.team1.champions, ...match.team2.champions];
            allChamps.forEach(champ => {
                const temp = champ.mechanical_skill;
                champ.mechanical_skill = 1 - champ.mechanical_skill;
                champ._original_skill = temp;
            });

            return {
                duration: 2,
                onWave: (remaining) => {
                    if (remaining === 0) {
                        allChamps.forEach(champ => {
                            if (champ._original_skill !== undefined) {
                                champ.mechanical_skill = champ._original_skill;
                                delete champ._original_skill;
                            }
                        });
                        match.logEvent(`Stats returned to normal. Or did they?`);
                    }
                }
            };
        }
    },
    {
        id: 'gold_rain',
        name: 'Gold Rain from the Void',
        description: 'All champions gain massive gold',
        rarity: 'common',
        execute: (match) => {
            const goldAmount = Math.floor(Math.random() * 2000) + 1000;
            match.logEvent(`💰 CHAOS EVENT: It's raining gold! Everyone gains ${goldAmount} gold!`);

            const allChamps = [...match.team1.champions, ...match.team2.champions];
            allChamps.forEach(champ => {
                champ.gold += goldAmount;
            });
        }
    },
    {
        id: 'void_consumption',
        name: 'Consumed by the Void',
        description: 'A random champion becomes a spectator',
        rarity: 'rare',
        execute: (match) => {
            const team = Math.random() > 0.5 ? match.team1 : match.team2;
            const champ = team.champions[Math.floor(Math.random() * team.champions.length)];

            match.logEvent(`🌌 CHAOS EVENT: ${champ.name} has been CONSUMED BY THE VOID!`);
            match.logEvent(`${champ.name} is now watching from beyond reality...`);

            champ._consumed = true;
            champ._original_stats = {
                mechanical_skill: champ.mechanical_skill,
                game_sense: champ.game_sense
            };
            champ.mechanical_skill = 0;
            champ.game_sense = 0;

            return {
                duration: 5,
                onWave: (remaining) => {
                    if (remaining === 0 && champ._consumed) {
                        champ.mechanical_skill = champ._original_stats.mechanical_skill;
                        champ.game_sense = champ._original_stats.game_sense;
                        delete champ._consumed;
                        delete champ._original_stats;
                        match.logEvent(`${champ.name} has returned from the void... changed.`);
                    }
                }
            };
        }
    },
    {
        id: 'time_loop',
        name: 'Temporal Anomaly',
        description: 'Repeat the previous wave',
        rarity: 'uncommon',
        execute: (match) => {
            match.logEvent(`⏰ CHAOS EVENT: TIME LOOP! Replaying previous wave...`);
            match.logEvent(`Déjà vu... or is it?`);

            // Simply reduce wave counter
            if (match.wave > 1) {
                match.wave--;
            }
        }
    },
    {
        id: 'shop_closed',
        name: 'Shop Malfunction',
        description: 'No gold gain for 3 waves',
        rarity: 'common',
        execute: (match) => {
            match.logEvent(`🏪 CHAOS EVENT: The shop has CLOSED due to "technical difficulties"`);

            match.chaosState = match.chaosState || {};
            match.chaosState.shopClosed = { duration: 3 };

            return {
                duration: 3,
                onWave: (remaining) => {
                    if (remaining === 0) {
                        match.logEvent(`The shop has reopened. No refunds.`);
                        delete match.chaosState.shopClosed;
                    }
                }
            };
        }
    },
    {
        id: 'mental_boom',
        name: 'Collective Mental Boom',
        description: 'All champions max tilt simultaneously',
        rarity: 'uncommon',
        execute: (match) => {
            match.logEvent(`😤 CHAOS EVENT: Everyone is TILTED! The toxicity is palpable!`);

            const allChamps = [...match.team1.champions, ...match.team2.champions];
            allChamps.forEach(champ => {
                champ.tilt_level = Math.min(1.0, champ.tilt_level + 0.5);
            });
        }
    },
    {
        id: 'enlightenment',
        name: 'Sudden Enlightenment',
        description: 'All champions gain maximum skill for 1 wave',
        rarity: 'rare',
        execute: (match) => {
            match.logEvent(`✨ CHAOS EVENT: ENLIGHTENMENT! Everyone becomes a challenger!`);

            const allChamps = [...match.team1.champions, ...match.team2.champions];
            allChamps.forEach(champ => {
                champ._original_enlightened = {
                    mechanical_skill: champ.mechanical_skill,
                    game_sense: champ.game_sense,
                    tilt_level: champ.tilt_level
                };
                champ.mechanical_skill = 1.0;
                champ.game_sense = 1.0;
                champ.tilt_level = 0;
            });

            return {
                duration: 1,
                onWave: (remaining) => {
                    if (remaining === 0) {
                        allChamps.forEach(champ => {
                            if (champ._original_enlightened) {
                                champ.mechanical_skill = champ._original_enlightened.mechanical_skill;
                                champ.game_sense = champ._original_enlightened.game_sense;
                                champ.tilt_level = champ._original_enlightened.tilt_level;
                                delete champ._original_enlightened;
                            }
                        });
                        match.logEvent(`Enlightenment fades. Back to reality.`);
                    }
                }
            };
        }
    },
    {
        id: 'item_theft',
        name: 'The Great Heist',
        description: 'One team steals gold from the other',
        rarity: 'uncommon',
        execute: (match) => {
            const thiefTeam = Math.random() > 0.5 ? match.team1 : match.team2;
            const victimTeam = thiefTeam === match.team1 ? match.team2 : match.team1;

            const stolenGold = Math.floor(Math.random() * 1000) + 500;

            match.logEvent(`💎 CHAOS EVENT: ${thiefTeam.name} has STOLEN ${stolenGold} gold from ${victimTeam.name}!`);

            thiefTeam.champions.forEach(champ => {
                champ.gold += stolenGold / thiefTeam.champions.length;
            });
            victimTeam.champions.forEach(champ => {
                champ.gold = Math.max(0, champ.gold - stolenGold / victimTeam.champions.length);
            });
        }
    },
    {
        id: 'role_shuffle',
        name: 'Identity Crisis',
        description: 'All champions forget their roles',
        rarity: 'rare',
        execute: (match) => {
            match.logEvent(`🔀 CHAOS EVENT: ROLE SHUFFLE! Nobody knows who they are anymore!`);

            const allChamps = [...match.team1.champions, ...match.team2.champions];
            const roles = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

            allChamps.forEach(champ => {
                champ._original_role = champ.role;
                champ.role = roles[Math.floor(Math.random() * roles.length)];
            });

            // Rebuild lane mappings
            match.team1Lanes = {};
            match.team2Lanes = {};
            match.team1.champions.forEach(c => match.team1Lanes[c.role] = c);
            match.team2.champions.forEach(c => match.team2Lanes[c.role] = c);

            return {
                duration: 4,
                onWave: (remaining) => {
                    if (remaining === 0) {
                        allChamps.forEach(champ => {
                            if (champ._original_role) {
                                champ.role = champ._original_role;
                                delete champ._original_role;
                            }
                        });

                        // Rebuild lane mappings again
                        match.team1Lanes = {};
                        match.team2Lanes = {};
                        match.team1.champions.forEach(c => match.team1Lanes[c.role] = c);
                        match.team2.champions.forEach(c => match.team2Lanes[c.role] = c);

                        match.logEvent(`Roles restored. Everyone remembers who they are. Maybe.`);
                    }
                }
            };
        }
    }
];

class ChaosManager {
    constructor(match) {
        this.match = match;
        this.activeEvents = [];
        this.chaosLevel = 0; // Increases over time
    }

    onWaveStart() {
        // Increase chaos level over time
        this.chaosLevel = Math.min(1.0, this.chaosLevel + 0.01);

        // Process active events
        this.activeEvents = this.activeEvents.filter(event => {
            if (event.duration > 0) {
                event.duration--;
                if (event.onWave) {
                    event.onWave(event.duration);
                }
                return event.duration > 0;
            }
            return false;
        });

        // Chance of new chaos event increases with chaos level
        const baseChance = 0.08; // 8% base chance
        const chaosChance = baseChance + (this.chaosLevel * 0.12); // Up to 20% at max chaos

        if (Math.random() < chaosChance) {
            this.triggerRandomEvent();
        }
    }

    triggerRandomEvent() {
        // Weight by rarity
        const rarityWeights = {
            common: 50,
            uncommon: 30,
            rare: 15,
            epic: 5
        };

        const availableEvents = chaosEvents.filter(event => {
            // Some events shouldn't happen in early game
            if (this.match.wave < 10 && ['void_consumption', 'role_shuffle'].includes(event.id)) {
                return false;
            }
            return true;
        });

        const weightedEvents = [];
        availableEvents.forEach(event => {
            const weight = rarityWeights[event.rarity] || 10;
            for (let i = 0; i < weight; i++) {
                weightedEvents.push(event);
            }
        });

        const selectedEvent = weightedEvents[Math.floor(Math.random() * weightedEvents.length)];

        if (selectedEvent) {
            const result = selectedEvent.execute(this.match);
            if (result && result.duration) {
                this.activeEvents.push(result);
            }
        }
    }

    getChaosLevel() {
        return this.chaosLevel;
    }
}

module.exports = { ChaosManager, chaosEvents };
