// Advanced Betting System with Live Odds

class BettingSystem {
    constructor(game) {
        this.game = game;
        this.activeMatches = new Map(); // matchId -> betting pool
        this.userBets = new Map(); // connectionId -> user bet history
        this.oddsHistory = [];
    }

    // Calculate odds for a team based on various factors
    calculateOdds(team, opposingTeam, currentWeather = null, chaosLevel = 0) {
        let baseOdds = 2.0; // Even odds

        // Win rate factor
        const totalGames = team.wins + team.losses;
        if (totalGames > 0) {
            const winRate = team.wins / totalGames;
            const opposingTotalGames = opposingTeam.wins + opposingTeam.losses;
            const opposingWinRate = opposingTotalGames > 0
                ? opposingTeam.wins / opposingTotalGames
                : 0.5;

            // Better win rate = lower odds (more likely to win)
            if (winRate > opposingWinRate) {
                baseOdds = 1.5 + (1 - winRate) * 2;
            } else {
                baseOdds = 2.0 + opposingWinRate * 2;
            }
        }

        // Champion strength factor (average hidden stats)
        const teamStrength = team.champions.reduce((sum, champ) => {
            return sum + (champ.mechanical_skill + champ.game_sense) / 2;
        }, 0) / team.champions.length;

        const opposingStrength = opposingTeam.champions.reduce((sum, champ) => {
            return sum + (champ.mechanical_skill + champ.game_sense) / 2;
        }, 0) / opposingTeam.champions.length;

        if (teamStrength > opposingStrength) {
            baseOdds *= 0.85;
        } else {
            baseOdds *= 1.15;
        }

        // Chaos factor - increases uncertainty, pushes odds toward even
        const chaosMultiplier = 1 + (chaosLevel * 0.5);
        baseOdds = baseOdds + (2.0 - baseOdds) * (chaosLevel * 0.3);

        // Weather factor
        if (currentWeather) {
            // Unpredictable weather = more even odds
            if (currentWeather.effects.totalChaos || currentWeather.effects.statCorruption) {
                baseOdds = baseOdds + (2.0 - baseOdds) * 0.2;
            }
        }

        // Ensure odds stay within reasonable bounds
        return Math.max(1.1, Math.min(10.0, baseOdds));
    }

    // Create betting pool for a match
    createMatchBetting(matchup, matchId) {
        const team1Odds = this.calculateOdds(matchup.team1, matchup.team2);
        const team2Odds = this.calculateOdds(matchup.team2, matchup.team1);

        const bettingPool = {
            matchId,
            team1: matchup.team1.name,
            team2: matchup.team2.name,
            team1Odds,
            team2Odds,
            team1Bets: [],
            team2Bets: [],
            team1Pool: 0,
            team2Pool: 0,
            locked: false,
            winner: null
        };

        this.activeMatches.set(matchId, bettingPool);
        return bettingPool;
    }

    // Update odds based on betting pool
    updateOdds(matchId) {
        const pool = this.activeMatches.get(matchId);
        if (!pool || pool.locked) return pool;

        const totalPool = pool.team1Pool + pool.team2Pool;
        if (totalPool === 0) return pool;

        // Adjust odds based on money distribution
        const team1Percentage = pool.team1Pool / totalPool;
        const team2Percentage = pool.team2Pool / totalPool;

        // More money on a team = lower odds
        pool.team1Odds = Math.max(1.1, 1 / (team1Percentage + 0.1) * 0.9);
        pool.team2Odds = Math.max(1.1, 1 / (team2Percentage + 0.1) * 0.9);

        // Record odds history
        this.oddsHistory.push({
            matchId,
            timestamp: Date.now(),
            team1Odds: pool.team1Odds,
            team2Odds: pool.team2Odds,
            team1Pool: pool.team1Pool,
            team2Pool: pool.team2Pool
        });

        return pool;
    }

    // Place a bet
    placeBet(userId, matchId, team, amount) {
        const pool = this.activeMatches.get(matchId);
        if (!pool) {
            return { success: false, message: 'Match not found' };
        }

        if (pool.locked) {
            return { success: false, message: 'Betting is locked for this match' };
        }

        if (amount <= 0) {
            return { success: false, message: 'Invalid bet amount' };
        }

        const bet = {
            userId,
            matchId,
            team,
            amount,
            timestamp: Date.now(),
            odds: team === pool.team1 ? pool.team1Odds : pool.team2Odds
        };

        // Add to pool
        if (team === pool.team1) {
            pool.team1Bets.push(bet);
            pool.team1Pool += amount;
        } else if (team === pool.team2) {
            pool.team2Bets.push(bet);
            pool.team2Pool += amount;
        } else {
            return { success: false, message: 'Invalid team' };
        }

        // Track user bets
        if (!this.userBets.has(userId)) {
            this.userBets.set(userId, []);
        }
        this.userBets.get(userId).push(bet);

        // Update odds
        this.updateOdds(matchId);

        const potentialWin = Math.floor(amount * bet.odds);

        return {
            success: true,
            bet,
            potentialWin,
            currentOdds: team === pool.team1 ? pool.team1Odds : pool.team2Odds
        };
    }

    // Lock betting for a match (when match starts)
    lockBetting(matchId) {
        const pool = this.activeMatches.get(matchId);
        if (pool) {
            pool.locked = true;
        }
        return pool;
    }

    // Resolve bets after match ends
    resolveBets(matchId, winnerName) {
        const pool = this.activeMatches.get(matchId);
        if (!pool) return { payouts: [], totalPaid: 0 };

        pool.winner = winnerName;
        const winningBets = winnerName === pool.team1 ? pool.team1Bets : pool.team2Bets;

        const payouts = [];
        let totalPaid = 0;

        winningBets.forEach(bet => {
            const payout = Math.floor(bet.amount * bet.odds);
            payouts.push({
                userId: bet.userId,
                amount: bet.amount,
                payout,
                profit: payout - bet.amount,
                odds: bet.odds
            });
            totalPaid += payout;
        });

        return { payouts, totalPaid, pool };
    }

    // Get user betting history
    getUserHistory(userId, limit = 10) {
        const bets = this.userBets.get(userId) || [];
        return bets.slice(-limit).reverse();
    }

    // Get betting stats for a user
    getUserStats(userId) {
        const bets = this.userBets.get(userId) || [];

        let totalWagered = 0;
        let totalWon = 0;
        let wins = 0;
        let losses = 0;

        bets.forEach(bet => {
            totalWagered += bet.amount;

            // Check if bet was resolved
            const pool = this.activeMatches.get(bet.matchId);
            if (pool && pool.winner) {
                if (pool.winner === bet.team) {
                    wins++;
                    totalWon += Math.floor(bet.amount * bet.odds);
                } else {
                    losses++;
                }
            }
        });

        return {
            totalBets: bets.length,
            totalWagered,
            totalWon,
            netProfit: totalWon - totalWagered,
            wins,
            losses,
            winRate: bets.length > 0 ? (wins / bets.length * 100).toFixed(1) : 0
        };
    }

    // Get all active betting pools
    getActivePools() {
        return Array.from(this.activeMatches.values())
            .filter(pool => !pool.locked);
    }

    // Get pool info
    getPool(matchId) {
        return this.activeMatches.get(matchId);
    }
}

module.exports = BettingSystem;
