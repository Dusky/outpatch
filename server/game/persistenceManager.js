/**
 * Persistence Manager
 *
 * Handles integration between the game logic and the database layer.
 * Tracks season progression, champion careers, and user activities.
 *
 * PHASE 2/3 Features:
 * - Season transitions with permanent modifications
 * - Achievement system integration
 * - Void taxes and corruption effects
 */

const Database = require('../database/database');

class PersistenceManager {
    constructor() {
        this.db = new Database();
        this.currentSeason = 1;
        this.seasonStarted = false;
        this.voidTaxSchedule = null;
    }

    // ==================== SEASON MANAGEMENT ====================

    async startNewSeason() {
        try {
            // Check if season already exists
            const existingSeason = await new Promise((resolve, reject) => {
                this.db.db.get(
                    'SELECT * FROM seasons WHERE season_number = ?',
                    [this.currentSeason],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (existingSeason) {
                console.log(`Season ${this.currentSeason} already exists in database`);
                this.seasonStarted = true;
                this.scheduleVoidTaxes();
                return { success: true, seasonNumber: this.currentSeason, existed: true };
            }

            await this.db.createSeason(this.currentSeason);
            this.seasonStarted = true;
            console.log(`Season ${this.currentSeason} started`);

            // Schedule void taxes (every 15 minutes during active season)
            this.scheduleVoidTaxes();

            return { success: true, seasonNumber: this.currentSeason };
        } catch (error) {
            console.error('Failed to start season:', error);
            return { success: false, error };
        }
    }

    async endCurrentSeason(notableEvents = []) {
        try {
            await this.db.endSeason(this.currentSeason, notableEvents);
            console.log(`Season ${this.currentSeason} ended`);

            // Clear void tax schedule
            if (this.voidTaxSchedule) {
                clearInterval(this.voidTaxSchedule);
            }

            this.seasonStarted = false;
            return { success: true, seasonNumber: this.currentSeason };
        } catch (error) {
            console.error('Failed to end season:', error);
            return { success: false, error };
        }
    }

    async progressToNextSeason() {
        const notableEvents = await this.generateSeasonSummary();
        await this.endCurrentSeason(notableEvents);
        this.currentSeason++;
        return await this.startNewSeason();
    }

    async generateSeasonSummary() {
        // PHASE 3: Generate notable events from the season
        const events = [
            'Multiple reality breaches detected',
            'Several champions evolved beyond recognition',
            'The void consumed 47% more than expected',
            'New patch notes written in language that doesn\'t exist yet'
        ];
        return events;
    }

    scheduleVoidTaxes() {
        // Random void taxes between seasons
        this.voidTaxSchedule = setInterval(() => {
            // This will be called for all users when implemented
            console.log('Void maintenance window initiated...');
        }, 15 * 60 * 1000); // 15 minutes
    }

    async applyVoidTaxToUser(userId) {
        const taxReasons = [
            'Void maintenance fee',
            'Reality stabilization surcharge',
            'Dimensional breach insurance',
            'Corruption containment tax',
            'Existence subscription renewal',
            'The void hungers'
        ];

        const taxAmount = Math.floor(Math.random() * 150) + 50; // 50-200 void bucks
        const reason = taxReasons[Math.floor(Math.random() * taxReasons.length)];

        try {
            return await this.db.applyVoidTax(userId, taxAmount, reason);
        } catch (error) {
            console.error('Failed to apply void tax:', error);
            return null;
        }
    }

    // ==================== MATCH RECORDING ====================

    async recordMatchResults(match, winnerTeam, loserTeam) {
        try {
            // Record stats for all champions
            const allChamps = [...winnerTeam.champions, ...loserTeam.champions];

            for (const champ of allChamps) {
                const won = winnerTeam.champions.includes(champ);
                await this.db.upsertChampionCareer(champ.name, champ.teamName || (won ? winnerTeam.name : loserTeam.name), {
                    won,
                    kills: champ.kda?.k || 0,
                    deaths: champ.kda?.d || 0,
                    assists: champ.kda?.a || 0,
                    cs: champ.cs || 0,
                    gold: champ.gold || 0,
                    chaosWitnessed: champ.chaosWitnessed || 0
                });
            }

            // Record notable events from the match
            if (match.chaosManager && match.chaosManager.eventHistory) {
                for (const event of match.chaosManager.eventHistory) {
                    await this.db.addSeasonEvent(
                        this.currentSeason,
                        'chaos_event',
                        event.description || event.name,
                        event.affectedChampion,
                        event.affectedTeam
                    );
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Failed to record match results:', error);
            return { success: false, error };
        }
    }

    // ==================== BETTING INTEGRATION ====================

    async recordUserBet(userId, matchId, teamBet, amount, odds) {
        try {
            const result = await this.db.recordBet(userId, this.currentSeason, matchId, teamBet, amount, odds);
            return result;
        } catch (error) {
            console.error('Failed to record bet:', error);
            return { success: false, error };
        }
    }

    async resolveBetResults(userId, betId, won, payout) {
        try {
            const result = won ? 'win' : 'loss';
            const profit = won ? payout - payout / odds : -payout;
            await this.db.resolveBet(betId, result, payout, profit);

            // Update user balance
            const user = await this.db.getUserById(userId);
            const newBalance = user.balance + payout;
            await this.db.updateUserBalance(userId, newBalance);

            // Check for achievements (PHASE 2)
            await this.checkBettingAchievements(userId);

            return { success: true, newBalance };
        } catch (error) {
            console.error('Failed to resolve bet:', error);
            return { success: false, error };
        }
    }

    async checkBettingAchievements(userId) {
        // PHASE 2: Achievement checking logic
        try {
            const stats = await this.db.getUserBettingStats(userId);

            // "Witnessed The Incident"
            if (stats.total_bets >= 100) {
                await this.db.unlockAchievement(
                    userId,
                    'witnessed_incident',
                    'Witnessed The Incident',
                    this.currentSeason
                );
            }

            // "Bet on 6 boots strategy (and won)"
            // This would need specific tracking from match data

            // "Survived Season [REDACTED]"
            if (this.currentSeason >= 5) {
                await this.db.unlockAchievement(
                    userId,
                    `survived_s${this.currentSeason}`,
                    `Survived Season ${this.currentSeason}`,
                    this.currentSeason
                );
            }
        } catch (error) {
            console.error('Failed to check achievements:', error);
        }
    }

    // ==================== CHAMPION EVENTS ====================

    async addChampionScar(championName, scarDescription) {
        try {
            await this.db.addChampionScar(championName, scarDescription);
            await this.db.addSeasonEvent(
                this.currentSeason,
                'champion_scar',
                `${championName} gained a scar: ${scarDescription}`,
                championName
            );
            return { success: true };
        } catch (error) {
            console.error('Failed to add champion scar:', error);
            return { success: false, error };
        }
    }

    async killChampion(championName, permanent = false) {
        try {
            await this.db.killChampion(championName, permanent);

            if (permanent) {
                await this.db.addSeasonEvent(
                    this.currentSeason,
                    'champion_death',
                    `${championName} has been consumed by the void (permanent)`,
                    championName
                );
                console.log(`RIP ${championName} - they will not return`);
            } else {
                await this.db.addSeasonEvent(
                    this.currentSeason,
                    'champion_death',
                    `${championName} died but may return`,
                    championName
                );
            }

            return { success: true, permanent };
        } catch (error) {
            console.error('Failed to kill champion:', error);
            return { success: false, error };
        }
    }

    // ==================== USER DATA ====================

    async getUserProfile(userId) {
        try {
            const user = await this.db.getUserById(userId);
            const bettingStats = await this.db.getUserBettingStats(userId);
            const achievements = await this.db.getUserAchievements(userId);
            const recentBets = await this.db.getUserBettingHistory(userId, 10);

            return {
                user: {
                    id: user.id,
                    username: user.username,
                    displayName: user.display_name,
                    balance: user.balance,
                    corruptionLevel: user.corruption_level,
                    responsibilityScore: user.responsibility_score
                },
                bettingStats,
                achievements,
                recentBets
            };
        } catch (error) {
            console.error('Failed to get user profile:', error);
            return null;
        }
    }

    async updateUserBalance(userId, newBalance) {
        try {
            return await this.db.updateUserBalance(userId, newBalance);
        } catch (error) {
            console.error('Failed to update balance:', error);
            return { success: false, error };
        }
    }

    // ==================== DATA QUERIES ====================

    async getSeasonHistory() {
        try {
            return await this.db.getAllSeasons();
        } catch (error) {
            console.error('Failed to get season history:', error);
            return [];
        }
    }

    async getChampionCareer(championName) {
        try {
            return await this.db.getChampionCareer(championName);
        } catch (error) {
            console.error('Failed to get champion career:', error);
            return null;
        }
    }

    async getAllChampionCareers() {
        try {
            return await this.db.getAllChampionCareers();
        } catch (error) {
            console.error('Failed to get all champion careers:', error);
            return [];
        }
    }

    // ==================== CLEANUP ====================

    close() {
        if (this.voidTaxSchedule) {
            clearInterval(this.voidTaxSchedule);
        }
        this.db.close();
    }
}

module.exports = PersistenceManager;
