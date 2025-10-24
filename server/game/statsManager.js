// Champion Statistics Tracking and Leaderboards

class StatsManager {
    constructor() {
        this.championStats = new Map(); // champName -> stats object
        this.matchHistory = [];
        this.globalStats = {
            totalMatches: 0,
            totalKills: 0,
            totalDeaths: 0,
            chaosEventsTriggered: 0
        };
    }

    // Initialize champion stats if not exists
    initChampion(champ) {
        if (!this.championStats.has(champ.name)) {
            this.championStats.set(champ.name, {
                name: champ.name,
                role: champ.role,
                lore: champ.lore,
                matches: 0,
                wins: 0,
                losses: 0,
                kills: 0,
                deaths: 0,
                assists: 0,
                totalCS: 0,
                totalGold: 0,
                firstBloods: 0,
                pentaKills: 0,
                chaosEventsWitnessed: 0,
                timesConsumedByVoid: 0,
                rolesSwitched: 0,
                enlightenments: 0,
                // Derived stats (calculated on demand)
                get kda() {
                    return this.deaths === 0 ?
                        (this.kills + this.assists) :
                        ((this.kills + this.assists) / this.deaths).toFixed(2);
                },
                get avgCS() {
                    return this.matches === 0 ? 0 : (this.totalCS / this.matches).toFixed(1);
                },
                get avgGold() {
                    return this.matches === 0 ? 0 : (this.totalGold / this.matches).toFixed(0);
                },
                get winRate() {
                    return this.matches === 0 ? 0 : ((this.wins / this.matches) * 100).toFixed(1);
                }
            });
        }
        return this.championStats.get(champ.name);
    }

    // Record match data for all champions
    recordMatch(match, winner, loser) {
        this.globalStats.totalMatches++;

        const allChamps = [...match.team1.champions, ...match.team2.champions];
        const winningTeam = winner.champions;

        allChamps.forEach(champ => {
            const stats = this.initChampion(champ);
            stats.matches++;

            // Win/Loss
            if (winningTeam.includes(champ)) {
                stats.wins++;
            } else {
                stats.losses++;
            }

            // KDA
            stats.kills += champ.kda.k;
            stats.deaths += champ.kda.d;
            stats.assists += champ.kda.a;

            // Economy
            stats.totalCS += champ.cs;
            stats.totalGold += champ.gold;

            // Track global stats
            this.globalStats.totalKills += champ.kda.k;
            this.globalStats.totalDeaths += champ.kda.d;

            // Chaos tracking (if champion has chaos flags)
            if (champ._consumed) stats.timesConsumedByVoid++;
            if (champ._original_role) stats.rolesSwitched++;
            if (champ._original_enlightened) stats.enlightenments++;
        });

        // Store match summary
        this.matchHistory.unshift({
            id: this.globalStats.totalMatches,
            timestamp: new Date(),
            team1: match.team1.name,
            team2: match.team2.name,
            winner: winner.name,
            loser: loser.name,
            waves: match.wave,
            chaosLevel: match.chaosManager.getChaosLevel()
        });

        // Keep only last 50 matches
        if (this.matchHistory.length > 50) {
            this.matchHistory.pop();
        }
    }

    // Get leaderboard by specific stat
    getLeaderboard(stat, limit = 10) {
        const champArray = Array.from(this.championStats.values());

        // Filter champions with at least 1 match
        const qualified = champArray.filter(c => c.matches > 0);

        // Sort by stat
        let sorted;
        switch (stat) {
            case 'kda':
                sorted = qualified.sort((a, b) => parseFloat(b.kda) - parseFloat(a.kda));
                break;
            case 'kills':
                sorted = qualified.sort((a, b) => b.kills - a.kills);
                break;
            case 'deaths':
                // Most deaths (for fun)
                sorted = qualified.sort((a, b) => b.deaths - a.deaths);
                break;
            case 'winRate':
                sorted = qualified.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));
                break;
            case 'cs':
                sorted = qualified.sort((a, b) => b.totalCS - a.totalCS);
                break;
            case 'gold':
                sorted = qualified.sort((a, b) => b.totalGold - a.totalGold);
                break;
            case 'chaos':
                // Most chaotic (combines various chaos stats)
                sorted = qualified.sort((a, b) => {
                    const aChaos = a.timesConsumedByVoid + a.rolesSwitched + a.enlightenments;
                    const bChaos = b.timesConsumedByVoid + b.rolesSwitched + b.enlightenments;
                    return bChaos - aChaos;
                });
                break;
            default:
                sorted = qualified.sort((a, b) => b.matches - a.matches);
        }

        return sorted.slice(0, limit);
    }

    // Get all leaderboards
    getAllLeaderboards() {
        return {
            kda: this.getLeaderboard('kda', 5),
            kills: this.getLeaderboard('kills', 5),
            deaths: this.getLeaderboard('deaths', 5),
            winRate: this.getLeaderboard('winRate', 5),
            gold: this.getLeaderboard('gold', 5),
            chaos: this.getLeaderboard('chaos', 5)
        };
    }

    // Get specific champion stats
    getChampionStats(champName) {
        return this.championStats.get(champName) || null;
    }

    // Get match history
    getMatchHistory(limit = 10) {
        return this.matchHistory.slice(0, limit);
    }

    // Get global stats summary
    getGlobalStats() {
        return {
            ...this.globalStats,
            avgKillsPerMatch: this.globalStats.totalMatches === 0 ? 0 :
                (this.globalStats.totalKills / this.globalStats.totalMatches).toFixed(1),
            totalChampions: this.championStats.size
        };
    }

    // Export all stats (for persistence later)
    exportStats() {
        return {
            championStats: Array.from(this.championStats.entries()),
            matchHistory: this.matchHistory,
            globalStats: this.globalStats
        };
    }

    // Import stats (for persistence later)
    importStats(data) {
        if (data.championStats) {
            this.championStats = new Map(data.championStats);
        }
        if (data.matchHistory) {
            this.matchHistory = data.matchHistory;
        }
        if (data.globalStats) {
            this.globalStats = data.globalStats;
        }
    }
}

module.exports = StatsManager;
