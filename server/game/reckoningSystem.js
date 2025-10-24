/**
 * The Reckoning - Democracy Meets Chaos
 *
 * Between seasons, users vote to shape reality:
 * - Bless champions (buff stats)
 * - Curse champions (nerf stats)
 * - Change game rules
 * - Adjust chaos levels
 * - Influence The Committee's decisions
 *
 * Inspired by Blaseball's election system.
 */

class ReckoningSystem {
    constructor(database) {
        this.database = database;
        this.currentVoting = null;
        this.voteResults = {};
    }

    /**
     * Start a new Reckoning voting session
     */
    async startReckoning(teams, seasonNumber) {
        console.log(`Starting The Reckoning for Season ${seasonNumber}...`);

        // Generate voting options
        this.currentVoting = {
            seasonNumber,
            startTime: new Date(),
            endTime: null,
            isActive: true,
            categories: {
                blessings: this.generateBlessings(teams),
                curses: this.generateCurses(teams),
                rules: this.generateRuleChanges(),
                chaos: this.generateChaosDecrees(),
                decree: this.generateCommitteeDecrees()
            },
            votes: {
                blessings: {},
                curses: {},
                rules: {},
                chaos: {},
                decree: {}
            }
        };

        return this.currentVoting.categories;
    }

    /**
     * Generate blessing options (buff champions)
     */
    generateBlessings(teams) {
        const candidates = [];

        for (const team of teams) {
            for (const champion of team.champions) {
                candidates.push({
                    id: `bless_${champion.name.replace(/\s/g, '_')}`,
                    champion: champion.name,
                    team: team.name,
                    role: champion.role,
                    description: `Bless ${champion.name} with enhanced ${this.getRandomStat()}`,
                    effect: this.generateBlessingEffect()
                });
            }
        }

        // Return top 10 candidates (could be based on popularity, randomness, etc.)
        return candidates.sort(() => Math.random() - 0.5).slice(0, 10);
    }

    /**
     * Generate curse options (nerf champions)
     */
    generateCurses(teams) {
        const candidates = [];

        for (const team of teams) {
            for (const champion of team.champions) {
                candidates.push({
                    id: `curse_${champion.name.replace(/\s/g, '_')}`,
                    champion: champion.name,
                    team: team.name,
                    role: champion.role,
                    description: `Curse ${champion.name} with ${this.getRandomAffliction()}`,
                    effect: this.generateCurseEffect()
                });
            }
        }

        return candidates.sort(() => Math.random() - 0.5).slice(0, 10);
    }

    /**
     * Generate rule change options
     */
    generateRuleChanges() {
        return [
            {
                id: 'rule_longer_matches',
                name: 'Extended Matches',
                description: 'Increase match length by 25%',
                effect: { matchDuration: 1.25 }
            },
            {
                id: 'rule_faster_matches',
                name: 'Speed Chess',
                description: 'Decrease match length by 25%',
                effect: { matchDuration: 0.75 }
            },
            {
                id: 'rule_double_chaos',
                name: 'Embrace the Void',
                description: 'Double the frequency of chaos events',
                effect: { chaosMultiplier: 2.0 }
            },
            {
                id: 'rule_stable_reality',
                name: 'Reality Anchor',
                description: 'Reduce chaos events by 50%',
                effect: { chaosMultiplier: 0.5 }
            },
            {
                id: 'rule_high_stakes',
                name: 'High Stakes League',
                description: 'Increased betting payouts (and risks)',
                effect: { payoutMultiplier: 1.5 }
            },
            {
                id: 'rule_mercy',
                name: 'The Committee\'s Mercy',
                description: 'Champions cannot be permanently voided',
                effect: { permadeathDisabled: true }
            }
        ];
    }

    /**
     * Generate chaos decree options
     */
    generateChaosDecrees() {
        return [
            {
                id: 'chaos_weather_extreme',
                name: 'Extreme Weather',
                description: 'Weather effects are twice as strong',
                effect: { weatherIntensity: 2.0 }
            },
            {
                id: 'chaos_random_swaps',
                name: 'Musical Chairs',
                description: 'Random champion position swaps during matches',
                effect: { enableSwaps: true }
            },
            {
                id: 'chaos_item_madness',
                name: 'Item Roulette',
                description: 'Random item effects each game',
                effect: { randomizeItems: true }
            },
            {
                id: 'chaos_grudge_matches',
                name: 'Grudge Match Season',
                description: 'Champions with grudges deal/take extra damage',
                effect: { grudgeMultiplier: 1.5 }
            },
            {
                id: 'chaos_mirror_matches',
                name: 'Through the Looking Glass',
                description: '10% chance for mirrors of champions to appear',
                effect: { mirrorChance: 0.1 }
            }
        ];
    }

    /**
     * Generate Committee decree options
     */
    generateCommitteeDecrees() {
        return [
            {
                id: 'decree_champion_evolution',
                name: 'The Evolution Initiative',
                description: 'Top performers permanently gain stat boosts',
                effect: { enableEvolution: true }
            },
            {
                id: 'decree_reality_fracture',
                name: 'Reality Fracture Event',
                description: 'One-time massive chaos event mid-season',
                effect: { fractureEvent: true }
            },
            {
                id: 'decree_void_tax',
                name: 'The Void Tax',
                description: 'The void demands 10% of all winnings',
                effect: { voidTax: 0.1 }
            },
            {
                id: 'decree_prophecy',
                name: 'The Prophecy',
                description: 'One team is "destined" to win (or lose)',
                effect: { prophecyEnabled: true }
            },
            {
                id: 'decree_tournament_arc',
                name: 'Tournament Arc',
                description: 'Mid-season tournament with special prizes',
                effect: { midSeasonTournament: true }
            }
        ];
    }

    /**
     * Cast a vote
     */
    async castVote(userId, category, optionId) {
        if (!this.currentVoting || !this.currentVoting.isActive) {
            throw new Error('No active voting session');
        }

        if (!this.currentVoting.votes[category]) {
            throw new Error('Invalid voting category');
        }

        // Record vote (users can change their vote)
        this.currentVoting.votes[category][userId] = optionId;

        // Store in database
        try {
            await this.database.db.run(
                'INSERT OR REPLACE INTO user_votes (user_id, season_number, category, option_id, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                [userId, this.currentVoting.seasonNumber, category, optionId]
            );
        } catch (err) {
            console.error('Failed to record vote:', err);
        }

        return { success: true, category, optionId };
    }

    /**
     * Get current vote counts
     */
    getVoteCounts() {
        if (!this.currentVoting) return null;

        const counts = {
            blessings: {},
            curses: {},
            rules: {},
            chaos: {},
            decree: {}
        };

        // Count votes in each category
        for (const category of Object.keys(counts)) {
            const votes = this.currentVoting.votes[category];
            for (const optionId of Object.values(votes)) {
                counts[category][optionId] = (counts[category][optionId] || 0) + 1;
            }
        }

        return counts;
    }

    /**
     * End voting and process results
     */
    async endReckoning() {
        if (!this.currentVoting || !this.currentVoting.isActive) {
            throw new Error('No active voting session');
        }

        this.currentVoting.isActive = false;
        this.currentVoting.endTime = new Date();

        // Tally votes
        const counts = this.getVoteCounts();

        // Determine winners in each category
        const results = {
            blessedChampions: this.determineWinners(counts.blessings, this.currentVoting.categories.blessings, 3),
            cursedChampions: this.determineWinners(counts.curses, this.currentVoting.categories.curses, 2),
            rulesChanged: this.determineWinners(counts.rules, this.currentVoting.categories.rules, 2),
            chaosDecree: this.determineWinners(counts.chaos, this.currentVoting.categories.chaos, 1)[0] || null,
            committeeDecree: this.determineWinners(counts.decree, this.currentVoting.categories.decree, 1)[0] || null
        };

        // Apply effects
        await this.applyReckoningResults(results);

        this.voteResults = results;
        return results;
    }

    /**
     * Determine winners from vote counts
     */
    determineWinners(voteCounts, options, count) {
        const sorted = Object.entries(voteCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, count)
            .map(([id]) => options.find(opt => opt.id === id))
            .filter(opt => opt);

        return sorted;
    }

    /**
     * Apply the Reckoning results to the game
     */
    async applyReckoningResults(results) {
        console.log('Applying Reckoning results...');

        // Apply blessings
        for (const blessing of results.blessedChampions) {
            await this.applyBlessing(blessing);
        }

        // Apply curses
        for (const curse of results.cursedChampions) {
            await this.applyCurse(curse);
        }

        // Store rule changes (will be applied during season)
        // This would need to be picked up by the game engine

        // Record in database
        try {
            await this.database.addSeasonEvent(
                this.currentVoting.seasonNumber,
                'RECKONING_RESULTS',
                JSON.stringify(results),
                null,
                null
            );
        } catch (err) {
            console.error('Failed to record reckoning results:', err);
        }

        return results;
    }

    /**
     * Apply a blessing to a champion
     */
    async applyBlessing(blessing) {
        // This would modify champion stats in the database
        console.log(`Blessing applied: ${blessing.description}`);

        try {
            await this.database.addSeasonEvent(
                this.currentVoting.seasonNumber,
                'BLESSING',
                blessing.description,
                blessing.champion,
                blessing.team
            );
        } catch (err) {
            console.error('Failed to record blessing:', err);
        }
    }

    /**
     * Apply a curse to a champion
     */
    async applyCurse(curse) {
        console.log(`Curse applied: ${curse.description}`);

        try {
            await this.database.addSeasonEvent(
                this.currentVoting.seasonNumber,
                'CURSE',
                curse.description,
                curse.champion,
                curse.team
            );
        } catch (err) {
            console.error('Failed to record curse:', err);
        }
    }

    /**
     * Helper: Generate random stat name
     */
    getRandomStat() {
        const stats = [
            'mechanical prowess',
            'game sense',
            'clutch factor',
            'tilt resistance',
            'farming ability',
            'teamfight coordination'
        ];
        return stats[Math.floor(Math.random() * stats.length)];
    }

    /**
     * Helper: Generate random affliction
     */
    getRandomAffliction() {
        const afflictions = [
            'reduced tilt resistance',
            'weakened game sense',
            'farming inefficiency',
            'bad luck',
            'void corruption',
            'perpetual tilting'
        ];
        return afflictions[Math.floor(Math.random() * afflictions.length)];
    }

    /**
     * Helper: Generate blessing effect
     */
    generateBlessingEffect() {
        return {
            statIncrease: 0.1 + Math.random() * 0.15, // 10-25% buff
            duration: 'season'
        };
    }

    /**
     * Helper: Generate curse effect
     */
    generateCurseEffect() {
        return {
            statDecrease: 0.1 + Math.random() * 0.15, // 10-25% nerf
            duration: 'season'
        };
    }

    /**
     * Get current voting status for display
     */
    getVotingStatus() {
        if (!this.currentVoting) {
            return { active: false };
        }

        const counts = this.getVoteCounts();
        const totalVotes = Object.values(this.currentVoting.votes)
            .reduce((sum, category) => sum + Object.keys(category).length, 0);

        return {
            active: this.currentVoting.isActive,
            seasonNumber: this.currentVoting.seasonNumber,
            startTime: this.currentVoting.startTime,
            totalVotes,
            categories: this.currentVoting.categories,
            voteCounts: counts
        };
    }

    /**
     * Format for broadcast
     */
    formatForBroadcast() {
        const status = this.getVotingStatus();

        if (!status.active) {
            return {
                type: 'reckoning_inactive',
                message: 'The Reckoning awaits...'
            };
        }

        return {
            type: 'reckoning_active',
            season: status.seasonNumber,
            totalVotes: status.totalVotes,
            categories: {
                blessings: status.categories.blessings.map(b => ({
                    id: b.id,
                    champion: b.champion,
                    description: b.description,
                    votes: status.voteCounts.blessings[b.id] || 0
                })),
                curses: status.categories.curses.map(c => ({
                    id: c.id,
                    champion: c.champion,
                    description: c.description,
                    votes: status.voteCounts.curses[c.id] || 0
                })),
                rules: status.categories.rules.map(r => ({
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    votes: status.voteCounts.rules[r.id] || 0
                })),
                chaos: status.categories.chaos.map(c => ({
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    votes: status.voteCounts.chaos[c.id] || 0
                })),
                decree: status.categories.decree.map(d => ({
                    id: d.id,
                    name: d.name,
                    description: d.description,
                    votes: status.voteCounts.decree[d.id] || 0
                }))
            }
        };
    }
}

module.exports = ReckoningSystem;
