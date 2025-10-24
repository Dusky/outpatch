/**
 * Awards System - Glory and Recognition
 *
 * Calculates and presents season-end awards:
 * - MVP (Most Valuable Player)
 * - Rookie of the Year
 * - Most Chaotic Champion
 * - Golden CS Award (Best Farmer)
 * - Clutch Player of the Year
 * - Most Improved
 * - Team Awards
 */

class AwardsSystem {
    constructor(statsManager, database) {
        this.statsManager = statsManager;
        this.database = database;
    }

    /**
     * Calculate all season awards
     */
    async calculateSeasonAwards(teams, completedMatches) {
        console.log('Calculating season awards...');

        const awards = {
            mvp: await this.calculateMVP(teams, completedMatches),
            rookieOfTheYear: await this.calculateRookieOfTheYear(teams),
            mostChaotic: await this.calculateMostChaotic(teams),
            goldenCS: await this.calculateGoldenCS(teams),
            clutchPlayer: await this.calculateClutchPlayer(teams),
            mostImproved: await this.calculateMostImproved(teams),
            teamAwards: await this.calculateTeamAwards(teams, completedMatches)
        };

        // Record awards in database
        await this.recordAwards(awards);

        return awards;
    }

    /**
     * MVP - Best overall champion performance
     */
    async calculateMVP(teams, completedMatches) {
        const candidates = [];

        for (const team of teams) {
            for (const champion of team.champions) {
                const careerStats = await this.getChampionSeasonStats(champion.name);

                if (!careerStats || careerStats.matches < 5) continue; // Must have played 5+ games

                // Calculate MVP score
                const kda = careerStats.kills + (careerStats.assists / 2) - careerStats.deaths;
                const winRate = careerStats.wins / Math.max(1, careerStats.matches);
                const avgGold = careerStats.gold / Math.max(1, careerStats.matches);

                const mvpScore =
                    (kda * 0.4) +
                    (winRate * 100 * 0.35) +
                    (avgGold / 100 * 0.15) +
                    (champion.clutch_factor * 10 * 0.1);

                candidates.push({
                    champion: champion.name,
                    team: team.name,
                    role: champion.role,
                    stats: careerStats,
                    mvpScore,
                    kda: (careerStats.kills + careerStats.assists) / Math.max(1, careerStats.deaths),
                    winRate: (winRate * 100).toFixed(1) + '%'
                });
            }
        }

        const winner = candidates.sort((a, b) => b.mvpScore - a.mvpScore)[0];

        return {
            award: 'Most Valuable Player',
            winner: winner.champion,
            team: winner.team,
            role: winner.role,
            stats: {
                kda: winner.kda.toFixed(2),
                winRate: winner.winRate,
                matches: winner.stats.matches
            },
            speech: this.generateAcceptanceSpeech(winner.champion, 'MVP')
        };
    }

    /**
     * Rookie of the Year - Best first-season champion
     */
    async calculateRookieOfTheYear(teams) {
        const rookies = [];

        for (const team of teams) {
            for (const champion of team.champions) {
                // Rookies have experience = 0 or championships = 0
                if (champion.experience === 0 || champion.championships === 0) {
                    const stats = await this.getChampionSeasonStats(champion.name);

                    if (!stats || stats.matches < 3) continue;

                    const performance =
                        (stats.kills * 3 + stats.assists * 1.5 - stats.deaths * 2) +
                        (stats.wins * 10);

                    rookies.push({
                        champion: champion.name,
                        team: team.name,
                        role: champion.role,
                        performance,
                        stats
                    });
                }
            }
        }

        if (rookies.length === 0) {
            return {
                award: 'Rookie of the Year',
                winner: 'No eligible rookies',
                team: null,
                role: null
            };
        }

        const winner = rookies.sort((a, b) => b.performance - a.performance)[0];

        return {
            award: 'Rookie of the Year',
            winner: winner.champion,
            team: winner.team,
            role: winner.role,
            stats: {
                matches: winner.stats.matches,
                wins: winner.stats.wins
            },
            speech: this.generateAcceptanceSpeech(winner.champion, 'ROTY')
        };
    }

    /**
     * Most Chaotic Champion - Most absurd/unpredictable
     */
    async calculateMostChaotic(teams) {
        const candidates = [];

        for (const team of teams) {
            for (const champion of team.champions) {
                const stats = await this.getChampionSeasonStats(champion.name);

                if (!stats) continue;

                // Chaos score based on volatility and unexpected outcomes
                const deathVariance = Math.abs(stats.deaths - (stats.matches * 3)); // Expected ~3 deaths/game
                const killVariance = Math.abs(stats.kills - (stats.matches * 5)); // Expected ~5 kills/game
                const tiltFactor = (1 - champion.tilt_resistance) * 10;
                const randomFactor = Math.random() * 5; // Because chaos

                const chaosScore = deathVariance + killVariance + tiltFactor + randomFactor;

                candidates.push({
                    champion: champion.name,
                    team: team.name,
                    role: champion.role,
                    chaosScore,
                    stats
                });
            }
        }

        const winner = candidates.sort((a, b) => b.chaosScore - a.chaosScore)[0];

        return {
            award: 'Most Chaotic Champion',
            winner: winner.champion,
            team: winner.team,
            role: winner.role,
            chaosLevel: winner.chaosScore.toFixed(1),
            speech: this.generateAcceptanceSpeech(winner.champion, 'CHAOS')
        };
    }

    /**
     * Golden CS Award - Best farmer
     */
    async calculateGoldenCS(teams) {
        const candidates = [];

        for (const team of teams) {
            for (const champion of team.champions) {
                const stats = await this.getChampionSeasonStats(champion.name);

                if (!stats || stats.matches < 5) continue;

                const avgCS = stats.cs / stats.matches;

                candidates.push({
                    champion: champion.name,
                    team: team.name,
                    role: champion.role,
                    avgCS,
                    totalCS: stats.cs
                });
            }
        }

        const winner = candidates.sort((a, b) => b.avgCS - a.avgCS)[0];

        return {
            award: 'Golden CS Award',
            winner: winner.champion,
            team: winner.team,
            role: winner.role,
            avgCS: winner.avgCS.toFixed(1),
            totalCS: winner.totalCS,
            speech: this.generateAcceptanceSpeech(winner.champion, 'CS')
        };
    }

    /**
     * Clutch Player - Best under pressure
     */
    async calculateClutchPlayer(teams) {
        const candidates = [];

        for (const team of teams) {
            for (const champion of team.champions) {
                const stats = await this.getChampionSeasonStats(champion.name);

                if (!stats) continue;

                // Clutch score combines clutch_factor and actual performance
                const clutchScore =
                    (champion.clutch_factor * 50) +
                    (stats.wins * 5) +
                    (stats.kills / Math.max(1, stats.deaths) * 10);

                candidates.push({
                    champion: champion.name,
                    team: team.name,
                    role: champion.role,
                    clutchScore,
                    clutchFactor: champion.clutch_factor
                });
            }
        }

        const winner = candidates.sort((a, b) => b.clutchScore - a.clutchScore)[0];

        return {
            award: 'Clutch Player of the Year',
            winner: winner.champion,
            team: winner.team,
            role: winner.role,
            clutchRating: (winner.clutchFactor * 100).toFixed(0),
            speech: this.generateAcceptanceSpeech(winner.champion, 'CLUTCH')
        };
    }

    /**
     * Most Improved - Biggest improvement from start to end of season
     */
    async calculateMostImproved(teams) {
        // This would require tracking performance over time
        // For now, placeholder logic
        const candidates = [];

        for (const team of teams) {
            for (const champion of team.champions) {
                const stats = await this.getChampionSeasonStats(champion.name);

                if (!stats || stats.matches < 5) continue;

                // Simulate improvement score (would need actual tracking)
                const improvementScore = Math.random() * 100;

                candidates.push({
                    champion: champion.name,
                    team: team.name,
                    role: champion.role,
                    improvementScore
                });
            }
        }

        const winner = candidates.sort((a, b) => b.improvementScore - a.improvementScore)[0];

        return {
            award: 'Most Improved Champion',
            winner: winner.champion,
            team: winner.team,
            role: winner.role,
            speech: this.generateAcceptanceSpeech(winner.champion, 'IMPROVED')
        };
    }

    /**
     * Team Awards
     */
    async calculateTeamAwards(teams, completedMatches) {
        const sortedByWins = [...teams].sort((a, b) => (b.wins || 0) - (a.wins || 0));
        const sortedByLosses = [...teams].sort((a, b) => (a.losses || 0) - (b.losses || 0));

        const bestRecord = sortedByWins[0];
        const worstRecord = sortedByLosses[sortedByLosses.length - 1];

        // Cinderella Story - team that made playoffs despite low expectations
        const playoffTeams = sortedByWins.slice(0, 6);
        const cinderella = playoffTeams.find(t => (t.wins || 0) < 10) || playoffTeams[5];

        return {
            bestRecord: {
                team: bestRecord.name,
                record: `${bestRecord.wins || 0}-${bestRecord.losses || 0}`
            },
            cinderellaStory: {
                team: cinderella.name,
                record: `${cinderella.wins || 0}-${cinderella.losses || 0}`,
                message: 'Against all odds, they made the playoffs'
            },
            mostEntertaining: {
                team: teams[Math.floor(Math.random() * teams.length)].name,
                reason: 'For keeping us on the edge of reality'
            }
        };
    }

    /**
     * Generate acceptance speech
     */
    generateAcceptanceSpeech(championName, awardType) {
        const speeches = {
            MVP: [
                `${championName}: "I couldn't have done it without my team... and also raw mechanical skill."`,
                `${championName}: "This award belongs to everyone. Especially me."`,
                `${championName}: "I'd like to thank the void for believing in me."`,
                `${championName}: "mom get the camera"`,
                `${championName}: "Is this real? Wait, is anything real?"`
            ],
            ROTY: [
                `${championName}: "As a rookie, I just tried to not int too hard."`,
                `${championName}: "First season? More like first place."`,
                `${championName}: "I'm just glad I didn't get voided."`,
                `${championName}: "Big thanks to whoever drafted me by accident."`
            ],
            CHAOS: [
                `${championName}: "I HAVE NO IDEA WHAT I'M DOING"`,
                `${championName}: "Chaos isn't a playstyle, it's a lifestyle."`,
                `${championName}: "Reality is optional, winning is mandatory."`,
                `${championName}: "I don't follow the meta, the meta follows me."`
            ],
            CS: [
                `${championName}: "I just really like hitting minions."`,
                `${championName}: "Farm > Team. Always."`,
                `${championName}: "What's a teamfight? I was farming."`,
                `${championName}: "The secret? Ignore your team and farm."`
            ],
            CLUTCH: [
                `${championName}: "Pressure? I don't feel pressure. I AM the pressure."`,
                `${championName}: "When it matters most, I show up. Usually."`,
                `${championName}: "The clutch gene is real, and it's in my DNA."`,
                `${championName}: "Close games? That's when I thrive."`
            ],
            IMPROVED: [
                `${championName}: "I started from the bottom, now I'm... slightly higher."`,
                `${championName}: "Turns out reading patch notes helps."`,
                `${championName}: "My secret? I started actually trying."`,
                `${championName}: "Thanks to whoever believed I could improve!"`
            ]
        };

        const options = speeches[awardType] || speeches.MVP;
        return options[Math.floor(Math.random() * options.length)];
    }

    /**
     * Get champion season stats from database
     */
    async getChampionSeasonStats(championName) {
        try {
            const career = await this.database.getChampionCareer(championName);
            return {
                matches: career.total_matches || 0,
                wins: career.total_wins || 0,
                kills: career.total_kills || 0,
                deaths: career.total_deaths || 0,
                assists: career.total_assists || 0,
                cs: career.total_cs || 0,
                gold: career.total_gold || 0
            };
        } catch (err) {
            return null;
        }
    }

    /**
     * Record awards in database
     */
    async recordAwards(awards) {
        const season = (await this.database.getAllSeasons())[0]?.season_number || 1;

        const awardsList = [
            { type: 'MVP', winner: awards.mvp.winner, team: awards.mvp.team },
            { type: 'ROTY', winner: awards.rookieOfTheYear.winner, team: awards.rookieOfTheYear.team },
            { type: 'CHAOS', winner: awards.mostChaotic.winner, team: awards.mostChaotic.team },
            { type: 'GOLDEN_CS', winner: awards.goldenCS.winner, team: awards.goldenCS.team },
            { type: 'CLUTCH', winner: awards.clutchPlayer.winner, team: awards.clutchPlayer.team }
        ];

        for (const award of awardsList) {
            try {
                await this.database.addSeasonEvent(
                    season,
                    'AWARD',
                    `${award.winner} (${award.team}) won ${award.type}`,
                    award.winner,
                    award.team
                );
            } catch (err) {
                console.error(`Failed to record ${award.type} award:`, err);
            }
        }
    }

    /**
     * Format awards for broadcast
     */
    formatForBroadcast(awards) {
        return {
            type: 'awards_ceremony',
            awards: [
                {
                    name: awards.mvp.award,
                    winner: awards.mvp.winner,
                    team: awards.mvp.team,
                    stats: awards.mvp.stats,
                    speech: awards.mvp.speech
                },
                {
                    name: awards.rookieOfTheYear.award,
                    winner: awards.rookieOfTheYear.winner,
                    team: awards.rookieOfTheYear.team,
                    speech: awards.rookieOfTheYear.speech
                },
                {
                    name: awards.mostChaotic.award,
                    winner: awards.mostChaotic.winner,
                    team: awards.mostChaotic.team,
                    chaosLevel: awards.mostChaotic.chaosLevel,
                    speech: awards.mostChaotic.speech
                },
                {
                    name: awards.goldenCS.award,
                    winner: awards.goldenCS.winner,
                    team: awards.goldenCS.team,
                    avgCS: awards.goldenCS.avgCS,
                    speech: awards.goldenCS.speech
                },
                {
                    name: awards.clutchPlayer.award,
                    winner: awards.clutchPlayer.winner,
                    team: awards.clutchPlayer.team,
                    clutchRating: awards.clutchPlayer.clutchRating,
                    speech: awards.clutchPlayer.speech
                }
            ],
            teamAwards: awards.teamAwards
        };
    }
}

module.exports = AwardsSystem;
