/**
 * Draft System - Where Champions Find Their Destiny
 *
 * Handles:
 * - Champion pool generation (50+ available champions)
 * - Team draft logic with pick order
 * - Roster changes and retirements
 * - Draft commentary and drama
 */

const { generateChampion } = require('../data/generators');

const CHAMPION_POOL_SIZE = 60; // Generate 60 available champions
const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

class DraftSystem {
    constructor() {
        this.championPool = [];
        this.draftedChampions = [];
        this.retiredChampions = [];
        this.draftHistory = [];
    }

    /**
     * Generate a fresh pool of champions for drafting
     */
    generateChampionPool() {
        this.championPool = [];

        // Generate champions for each role
        const championsPerRole = Math.ceil(CHAMPION_POOL_SIZE / ROLES.length);

        for (const role of ROLES) {
            for (let i = 0; i < championsPerRole; i++) {
                const champion = this.generateUniqueChampion(role);
                if (champion) {
                    this.championPool.push(champion);
                }
            }
        }

        console.log(`Generated champion pool: ${this.championPool.length} champions available`);
        return this.championPool;
    }

    /**
     * Generate a unique champion that doesn't already exist in pool
     */
    generateUniqueChampion(role) {
        let attempts = 0;
        let champion = null;

        while (attempts < 20) {
            champion = generateChampion(role);

            // Check if name is unique
            const isDuplicate = this.championPool.some(c => c.name === champion.name);

            if (!isDuplicate) {
                // Add draft-specific properties
                champion.drafted = false;
                champion.draftPosition = null;
                champion.draftRound = null;
                champion.experience = 0; // Rookie
                champion.championships = 0;
                champion.careerStats = {
                    matches: 0,
                    wins: 0,
                    kills: 0,
                    deaths: 0,
                    assists: 0
                };

                return champion;
            }

            attempts++;
        }

        return null; // Failed to generate unique
    }

    /**
     * Conduct a full draft for all teams
     * Snake draft: Team 1 picks first in Round 1, Team N picks first in Round 2, etc.
     */
    async conductDraft(teams, database = null) {
        console.log(`Starting draft for ${teams.length} teams...`);

        // Determine draft order (bottom teams pick first for fairness)
        const draftOrder = [...teams].sort((a, b) => {
            // Teams with fewer wins pick earlier
            const aWins = a.wins || 0;
            const bWins = b.wins || 0;
            return aWins - bWins;
        });

        const draftLog = [];
        let pickNumber = 1;

        // Each team needs 5 champions (one per role)
        for (let round = 0; round < 5; round++) {
            const isEvenRound = round % 2 === 0;
            const roundOrder = isEvenRound ? draftOrder : [...draftOrder].reverse();

            // Determine which role is being drafted this round
            const roleThisRound = ROLES[round];

            draftLog.push({
                type: 'round_start',
                round: round + 1,
                role: roleThisRound,
                message: `Round ${round + 1}: Drafting ${roleThisRound} champions...`
            });

            for (const team of roundOrder) {
                // Get available champions for this role
                const availableForRole = this.championPool.filter(c =>
                    c.role === roleThisRound && !c.drafted
                );

                if (availableForRole.length === 0) {
                    console.error(`No available champions for role ${roleThisRound}!`);
                    continue;
                }

                // AI pick logic (can be enhanced)
                const pick = this.makeTeamPick(team, availableForRole, round);

                // Draft the champion
                pick.drafted = true;
                pick.draftPosition = pickNumber;
                pick.draftRound = round + 1;
                pick.teamName = team.name;

                // Add to team roster (replacing existing champion in that role)
                const existingIndex = team.champions.findIndex(c => c.role === roleThisRound);
                if (existingIndex >= 0) {
                    const oldChampion = team.champions[existingIndex];
                    this.retiredChampions.push({
                        ...oldChampion,
                        retiredDate: new Date(),
                        reason: 'Replaced in draft'
                    });
                    team.champions[existingIndex] = pick;
                } else {
                    team.champions.push(pick);
                }

                this.draftedChampions.push(pick);

                // Generate pick commentary
                const commentary = this.generatePickCommentary(team, pick, pickNumber);

                draftLog.push({
                    type: 'pick',
                    pickNumber,
                    round: round + 1,
                    team: team.name,
                    champion: pick.name,
                    role: pick.role,
                    commentary
                });

                pickNumber++;

                // Record in database if available
                if (database) {
                    try {
                        await database.addSeasonEvent(
                            database.currentSeason || 1,
                            'DRAFT_PICK',
                            `${team.name} drafted ${pick.name} (${pick.role}) at pick ${pickNumber - 1}`,
                            pick.name,
                            team.name
                        );
                    } catch (err) {
                        console.error('Failed to record draft pick:', err);
                    }
                }
            }
        }

        draftLog.push({
            type: 'draft_complete',
            message: 'Draft complete! Rosters have been finalized.',
            totalPicks: pickNumber - 1,
            retiredChampions: this.retiredChampions.length
        });

        this.draftHistory.push({
            date: new Date(),
            log: draftLog,
            teams: teams.map(t => t.name)
        });

        return draftLog;
    }

    /**
     * AI logic for team picking a champion
     */
    makeTeamPick(team, availableChampions, round) {
        // Simple AI: Pick best available based on hidden stats
        const scored = availableChampions.map(champ => {
            const mechanicalScore = champ.mechanical_skill || 0.5;
            const gameSenseScore = champ.game_sense || 0.5;
            const clutchScore = champ.clutch_factor || 0.5;
            const tiltResistance = champ.tilt_resistance || 0.5;

            // Weighted scoring
            const totalScore =
                (mechanicalScore * 0.3) +
                (gameSenseScore * 0.3) +
                (clutchScore * 0.2) +
                (tiltResistance * 0.2);

            // Add some randomness for variety
            const noise = (Math.random() - 0.5) * 0.2;

            return {
                champion: champ,
                score: Math.max(0, Math.min(1, totalScore + noise))
            };
        }).sort((a, b) => b.score - a.score);

        // Top teams pick best, bottom teams sometimes miss (for drama)
        const teamStrength = (team.wins || 0) / Math.max(1, (team.wins || 0) + (team.losses || 0));

        if (teamStrength < 0.3 && Math.random() < 0.3) {
            // Bad teams sometimes make questionable picks
            const randomIndex = Math.floor(Math.random() * Math.min(5, scored.length));
            return scored[randomIndex].champion;
        }

        // Otherwise pick best available
        return scored[0].champion;
    }

    /**
     * Generate commentary for a draft pick
     */
    generatePickCommentary(team, champion, pickNumber) {
        const commentaries = [];

        // Early pick commentary
        if (pickNumber <= 5) {
            commentaries.push(
                `A bold first-round selection`,
                `Setting the tone early`,
                `The ${team.name} front office is confident`,
                `A statement pick from ${team.name}`,
                `This could define their season`
            );
        }

        // Mid pick commentary
        if (pickNumber > 5 && pickNumber <= 30) {
            commentaries.push(
                `Solid value at this position`,
                `An interesting choice`,
                `This could be a sleeper pick`,
                `The ${team.name} coaching staff sees potential`,
                `A calculated risk`
            );
        }

        // Late pick commentary
        if (pickNumber > 30) {
            commentaries.push(
                `A late-round gamble`,
                `They're taking a chance here`,
                `Could be a diamond in the rough`,
                `Filling out the roster`,
                `Depth piece for ${team.name}`
            );
        }

        // Champion-specific commentary based on stats
        if (champion.mechanical_skill > 0.8) {
            commentaries.push(`${champion.name} brings elite mechanics`);
        }
        if (champion.game_sense > 0.8) {
            commentaries.push(`Incredible game IQ from ${champion.name}`);
        }
        if (champion.clutch_factor > 0.8) {
            commentaries.push(`Known for clutch performances`);
        }
        if (champion.tilt_resistance < 0.3) {
            commentaries.push(`Mental game is questionable`);
        }

        // Lore-based commentary
        if (champion.lore) {
            commentaries.push(champion.lore);
        }

        // Random chaos
        if (Math.random() < 0.1) {
            commentaries.push(
                'The void approves of this selection',
                'Reality flickers as the pick is announced',
                'The Committee watches with interest',
                'This pick was foretold in ancient texts',
                'Some say this was inevitable'
            );
        }

        // Return 1-2 random commentaries
        const selected = [];
        const count = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < count && commentaries.length > 0; i++) {
            const index = Math.floor(Math.random() * commentaries.length);
            selected.push(commentaries.splice(index, 1)[0]);
        }

        return selected.join('. ') + '.';
    }

    /**
     * Handle mid-season roster changes (injuries, voidings, etc.)
     */
    async handleRosterChange(team, role, reason = 'Roster move') {
        const availableForRole = this.championPool.filter(c =>
            c.role === role && !c.drafted
        );

        if (availableForRole.length === 0) {
            console.error(`No available champions to replace ${role}`);
            return null;
        }

        // Pick a replacement
        const replacement = availableForRole[Math.floor(Math.random() * availableForRole.length)];
        replacement.drafted = true;
        replacement.teamName = team.name;

        const oldChampionIndex = team.champions.findIndex(c => c.role === role);
        if (oldChampionIndex >= 0) {
            const oldChampion = team.champions[oldChampionIndex];
            this.retiredChampions.push({
                ...oldChampion,
                retiredDate: new Date(),
                reason
            });
            team.champions[oldChampionIndex] = replacement;
        }

        return {
            oldChampion: team.champions[oldChampionIndex]?.name,
            newChampion: replacement.name,
            reason,
            team: team.name
        };
    }

    /**
     * Get draft board for display
     */
    getDraftBoard() {
        return {
            availableChampions: this.championPool.filter(c => !c.drafted).length,
            draftedChampions: this.draftedChampions.length,
            retiredChampions: this.retiredChampions.length,
            championsByRole: ROLES.map(role => ({
                role,
                available: this.championPool.filter(c => c.role === role && !c.drafted).length,
                drafted: this.draftedChampions.filter(c => c.role === role).length
            }))
        };
    }

    /**
     * Get top prospects for display
     */
    getTopProspects(count = 10) {
        const available = this.championPool.filter(c => !c.drafted);

        return available
            .map(champ => ({
                name: champ.name,
                role: champ.role,
                rating: ((champ.mechanical_skill + champ.game_sense + champ.clutch_factor) / 3 * 100).toFixed(0),
                lore: champ.lore
            }))
            .sort((a, b) => b.rating - a.rating)
            .slice(0, count);
    }

    /**
     * Reset for new season
     */
    reset() {
        this.championPool = [];
        this.draftedChampions = [];
        // Keep retired champions for history
    }
}

module.exports = DraftSystem;
