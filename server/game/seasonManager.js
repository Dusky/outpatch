/**
 * Season Manager - The Heart of the MOBA Network
 *
 * Orchestrates the full lifecycle of a competitive season:
 * PRE_SEASON → REGULAR_SEASON → PLAYOFFS → FINALS → OFF_SEASON
 *
 * Never the same twice. Reality is optional.
 */

const EventEmitter = require('events');

// Phase constants
const PHASES = {
    PRE_SEASON: 'PRE_SEASON',
    REGULAR_SEASON: 'REGULAR_SEASON',
    PLAYOFFS: 'PLAYOFFS',
    FINALS: 'FINALS',
    OFF_SEASON: 'OFF_SEASON',
    PAUSED: 'PAUSED'
};

// Development mode - set to true for faster testing timings
const DEV_MODE = process.env.NODE_ENV !== 'production';

// Timing configuration (in milliseconds)
const PROD_TIMINGS = {
    PRE_SEASON: {
        DRAFT: 45 * 60 * 1000, // 45 minutes for draft event
        PREDICTIONS: 30 * 60 * 1000, // 30 minutes for predictions/analysis
        PRACTICE_MATCH_INTERVAL: 90 * 60 * 1000 // 90 minutes between practice matches
    },
    REGULAR_SEASON: {
        MATCH_INTERVAL: 90 * 60 * 1000, // 90 minutes between regular matches
        MATCHES_PER_DAY: 2 // How many concurrent matches per game day
    },
    PLAYOFFS: {
        MATCH_INTERVAL: 120 * 60 * 1000, // 2 hours between playoff matches (higher stakes)
        REST_BETWEEN_ROUNDS: 10 * 60 * 1000 // 10 minutes rest between rounds
    },
    FINALS: {
        MATCH_INTERVAL: 150 * 60 * 1000, // 2.5 hours between championship matches
        SERIES_LENGTH: 3 // Best of 3
    },
    OFF_SEASON: {
        AWARDS_CEREMONY: 60 * 60 * 1000, // 1 hour awards show
        RECKONING_VOTING: 24 * 60 * 60 * 1000, // 24 hours for voting
        ROSTER_CHANGES: 30 * 60 * 1000, // 30 minutes of draft/trades
        LORE_EVENTS: 15 * 60 * 1000 // 15 minutes between lore reveals
    }
};

// Development timings - much faster for testing
const DEV_TIMINGS = {
    PRE_SEASON: {
        DRAFT: 10 * 1000, // 10 seconds
        PREDICTIONS: 10 * 1000, // 10 seconds
        PRACTICE_MATCH_INTERVAL: 2 * 60 * 1000 // 2 minutes between practice matches
    },
    REGULAR_SEASON: {
        MATCH_INTERVAL: 2 * 60 * 1000, // 2 minutes between regular matches
        MATCHES_PER_DAY: 2 // How many concurrent matches per game day
    },
    PLAYOFFS: {
        MATCH_INTERVAL: 3 * 60 * 1000, // 3 minutes between playoff matches
        REST_BETWEEN_ROUNDS: 30 * 1000 // 30 seconds rest between rounds
    },
    FINALS: {
        MATCH_INTERVAL: 5 * 60 * 1000, // 5 minutes between championship matches
        SERIES_LENGTH: 3 // Best of 3
    },
    OFF_SEASON: {
        AWARDS_CEREMONY: 1 * 60 * 1000, // 1 minute awards show
        RECKONING_VOTING: 5 * 60 * 1000, // 5 minutes for voting
        ROSTER_CHANGES: 1 * 60 * 1000, // 1 minute of draft/trades
        LORE_EVENTS: 30 * 1000 // 30 seconds between lore reveals
    }
};

// Select timings based on mode
const TIMINGS = DEV_MODE ? DEV_TIMINGS : PROD_TIMINGS;

console.log(`SeasonManager: Running in ${DEV_MODE ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);

class SeasonManager extends EventEmitter {
    constructor(database, wss) {
        super();
        this.db = database;
        this.wss = wss;

        // Current state
        this.currentSeason = 1;
        this.currentPhase = PHASES.PAUSED;
        this.currentWeek = 0;
        this.currentDay = 0;

        // Season data
        this.teams = [];
        this.championPool = []; // Available undrafted champions
        this.schedule = []; // Full season schedule
        this.playoffBracket = null;
        this.narratives = []; // Active storylines

        // Match tracking
        this.currentMatches = [];
        this.completedMatches = [];

        // Timers
        this.phaseTimer = null;
        this.matchTimer = null;

        // Season metadata
        this.seasonStartDate = null;
        this.seasonNarrativeTheme = null; // e.g., "The Year of Chaos", "The Glitch Season"

        // State flags
        this.isRunning = false;
    }

    // ==================== INITIALIZATION ====================

    async initialize(teams, seasonNumber = 1) {
        this.teams = teams;
        this.currentSeason = seasonNumber;

        // Try to create season in database
        try {
            await this.db.createSeason(seasonNumber);
            console.log(`Season ${seasonNumber} initialized in database`);
        } catch (err) {
            console.log(`Season ${seasonNumber} already exists in database`);
        }

        // Generate narrative theme for this season
        this.seasonNarrativeTheme = this.generateSeasonTheme();

        this.broadcast({
            type: 'season_init',
            season: this.currentSeason,
            theme: this.seasonNarrativeTheme,
            phase: this.currentPhase
        });
    }

    generateSeasonTheme() {
        const themes = [
            'The Year of Chaos',
            'The Glitch Season',
            'The Reckoning',
            'The Void Awakens',
            'The Reality Crisis',
            'The Champion Wars',
            'The Corruption Deepens',
            'The Great Unraveling',
            'The Committee\'s Game',
            'The Forgotten Protocol',
            'The Dimensional Shift',
            'The Final Season (Just Kidding)'
        ];
        return themes[Math.floor(Math.random() * themes.length)];
    }

    // ==================== SEASON CONTROL ====================

    async startSeason() {
        if (this.isRunning) {
            console.log('Season already running');
            return;
        }

        this.isRunning = true;
        this.seasonStartDate = new Date();

        // Start with pre-season
        await this.enterPhase(PHASES.PRE_SEASON);
    }

    async enterPhase(phase) {
        this.currentPhase = phase;
        console.log(`Entering phase: ${phase}`);

        this.broadcast({
            type: 'phase_change',
            phase,
            season: this.currentSeason,
            message: this.getPhaseAnnouncement(phase)
        });

        // Record phase change in database
        try {
            await this.db.addSeasonEvent(
                this.currentSeason,
                'PHASE_CHANGE',
                `Season ${this.currentSeason} entered ${phase}`,
                null,
                null
            );
        } catch (err) {
            console.error('Failed to record phase change:', err);
        }

        switch (phase) {
            case PHASES.PRE_SEASON:
                await this.runPreSeason();
                break;
            case PHASES.REGULAR_SEASON:
                await this.runRegularSeason();
                break;
            case PHASES.PLAYOFFS:
                await this.runPlayoffs();
                break;
            case PHASES.FINALS:
                await this.runFinals();
                break;
            case PHASES.OFF_SEASON:
                await this.runOffSeason();
                break;
        }
    }

    getPhaseAnnouncement(phase) {
        const announcements = {
            PRE_SEASON: `🎭 Welcome to ${this.seasonNarrativeTheme}! Pre-season begins...`,
            REGULAR_SEASON: `⚔️ The regular season is underway! ${this.schedule.length} matches await...`,
            PLAYOFFS: `🏆 The playoffs have begun! Only the strong survive...`,
            FINALS: `👑 THE GRAND FINALS! All roads lead to this moment...`,
            OFF_SEASON: `🌌 The season concludes. Reality takes a brief vacation...`
        };
        return announcements[phase] || 'Phase transition initiated';
    }

    // ==================== PRE-SEASON PHASE ====================

    async runPreSeason() {
        // Sub-phases of pre-season:
        // 1. Reset champion stats for new season
        // 2. Draft Event
        // 3. Power Rankings & Predictions
        // 4. Practice Matches (2-3 exhibition games)

        // Reset all champion stats for the new season
        this.broadcast({
            type: 'system_message',
            message: '🔄 Resetting champion stats for new season...'
        });

        try {
            await this.db.resetChampionStats(this.teams);
            console.log(`Season ${this.currentSeason} stats reset successfully`);
        } catch (error) {
            console.error('Error resetting champion stats:', error);
        }

        this.broadcast({
            type: 'pre_season_start',
            message: 'PRE-SEASON: DRAFT EVENT BEGINNING'
        });

        // Wait for draft timing
        await this.sleep(TIMINGS.PRE_SEASON.DRAFT);

        this.broadcast({
            type: 'pre_season_predictions',
            message: 'PRE-SEASON: POWER RANKINGS & PREDICTIONS',
            predictions: this.generatePowerRankings()
        });

        await this.sleep(TIMINGS.PRE_SEASON.PREDICTIONS);

        // Run 2-3 practice matches
        const practiceMatchCount = Math.floor(Math.random() * 2) + 2; // 2-3 matches
        for (let i = 0; i < practiceMatchCount; i++) {
            this.broadcast({
                type: 'practice_match',
                matchNumber: i + 1,
                message: `EXHIBITION MATCH ${i + 1} OF ${practiceMatchCount}`
            });

            // Emit event for game to run a practice match
            this.emit('practice_match_requested');

            await this.sleep(TIMINGS.PRE_SEASON.PRACTICE_MATCH_INTERVAL);
        }

        // Transition to regular season
        await this.enterPhase(PHASES.REGULAR_SEASON);
    }

    generatePowerRankings() {
        // Generate predictions for each team
        const rankings = this.teams.map((team, index) => {
            const baseStrength = team.champions.reduce((sum, c) =>
                sum + c.mechanical_skill + c.game_sense, 0) / (team.champions.length * 2);

            // Add randomness - predictions aren't always right!
            const noise = (Math.random() - 0.5) * 0.3;
            const predictedStrength = Math.max(0.1, Math.min(1.0, baseStrength + noise));

            return {
                rank: 0, // Will be assigned after sorting
                teamName: team.name,
                predictedWinRate: (predictedStrength * 100).toFixed(1) + '%',
                analysis: this.generateTeamAnalysis(team, predictedStrength)
            };
        }).sort((a, b) => parseFloat(b.predictedWinRate) - parseFloat(a.predictedWinRate));

        // Assign ranks
        rankings.forEach((r, i) => r.rank = i + 1);

        return rankings;
    }

    generateTeamAnalysis(team, strength) {
        const strengths = [
            'exceptional mechanical prowess',
            'terrifying teamfight coordination',
            'unpredictable strategies',
            'clutch factor under pressure',
            'early game dominance',
            'late game scaling',
            'objective control mastery'
        ];

        const weaknesses = [
            'questionable decision-making',
            'inconsistent performance',
            'vulnerability to chaos',
            'tilt susceptibility',
            'draft phase confusion',
            'reality coherence issues'
        ];

        const analysis = [];
        if (strength > 0.7) {
            analysis.push(`Strong contender with ${strengths[Math.floor(Math.random() * strengths.length)]}`);
        } else if (strength > 0.4) {
            analysis.push(`Middle of the pack, showing ${strengths[Math.floor(Math.random() * strengths.length)]}`);
        } else {
            analysis.push(`Dark horse team despite ${weaknesses[Math.floor(Math.random() * weaknesses.length)]}`);
        }

        // Add a quirky observation
        const quirks = [
            'Watch out for their jungle pressure.',
            'The void whispers their name...',
            'Reality bends around this roster.',
            'Expectations: moderate. Chaos potential: HIGH.',
            'The Committee is watching closely.'
        ];
        analysis.push(quirks[Math.floor(Math.random() * quirks.length)]);

        return analysis.join(' ');
    }

    // ==================== REGULAR SEASON PHASE ====================

    async runRegularSeason() {
        // Generate full season schedule (multi-round robin)
        const scheduleGenerator = require('./scheduleGenerator');
        this.schedule = scheduleGenerator.generateMultiRoundRobin(
            this.teams,
            Math.floor(Math.random() * 2) + 2 // 2-3 rounds random
        );

        this.broadcast({
            type: 'regular_season_start',
            schedule: this.formatScheduleForBroadcast(),
            totalMatches: this.schedule.length,
            estimatedWeeks: Math.ceil(this.schedule.length / TIMINGS.REGULAR_SEASON.MATCHES_PER_DAY)
        });

        // Process each game day
        for (let i = 0; i < this.schedule.length; i += TIMINGS.REGULAR_SEASON.MATCHES_PER_DAY) {
            if (!this.isRunning) break;

            this.currentDay++;
            if (this.currentDay % 7 === 0) this.currentWeek++;

            const todaysMatches = this.schedule.slice(i, i + TIMINGS.REGULAR_SEASON.MATCHES_PER_DAY);

            this.broadcast({
                type: 'game_day',
                day: this.currentDay,
                week: this.currentWeek,
                matches: todaysMatches.map(m => ({
                    team1: m.team1.name,
                    team2: m.team2.name
                }))
            });

            // Emit event for Game class to run these matches
            this.emit('matches_scheduled', todaysMatches);

            // Wait for match interval
            await this.sleep(TIMINGS.REGULAR_SEASON.MATCH_INTERVAL);
        }

        // Regular season complete - move to playoffs
        await this.enterPhase(PHASES.PLAYOFFS);
    }

    formatScheduleForBroadcast() {
        // Send abbreviated schedule info
        return {
            totalGames: this.schedule.length,
            weeks: Math.ceil(this.schedule.length / TIMINGS.REGULAR_SEASON.MATCHES_PER_DAY),
            firstMatchup: {
                team1: this.schedule[0]?.team1.name,
                team2: this.schedule[0]?.team2.name
            }
        };
    }

    // ==================== PLAYOFFS PHASE ====================

    async runPlayoffs() {
        // Seed top 6 teams based on regular season record
        const standings = this.calculateStandings();
        const seeds = standings.slice(0, 6); // Top 6 teams

        this.broadcast({
            type: 'playoffs_bracket',
            seeds: seeds.map((s, i) => ({
                seed: i + 1,
                team: s.name,
                record: `${s.wins}-${s.losses}`
            })),
            message: 'THE PLAYOFF BRACKET IS SET'
        });

        // Playoff structure:
        // Seeds 1-2: BYE to semifinals
        // Quarterfinals: Seed 3 vs 6, Seed 4 vs 5

        this.playoffBracket = {
            quarterfinals: [
                { matchId: 'QF1', team1: seeds[2], team2: seeds[5], winner: null },
                { matchId: 'QF2', team1: seeds[3], team2: seeds[4], winner: null }
            ],
            semifinals: [
                { matchId: 'SF1', team1: seeds[0], team2: null, winner: null }, // Seed 1 vs QF1 winner
                { matchId: 'SF2', team1: seeds[1], team2: null, winner: null }  // Seed 2 vs QF2 winner
            ],
            finals: null
        };

        // Run quarterfinals
        await this.runPlayoffRound('QUARTERFINALS', this.playoffBracket.quarterfinals);

        await this.sleep(TIMINGS.PLAYOFFS.REST_BETWEEN_ROUNDS);

        // Set up semifinals with winners
        this.playoffBracket.semifinals[0].team2 = this.playoffBracket.quarterfinals[0].winner;
        this.playoffBracket.semifinals[1].team2 = this.playoffBracket.quarterfinals[1].winner;

        // Run semifinals
        await this.runPlayoffRound('SEMIFINALS', this.playoffBracket.semifinals);

        // Move to finals
        await this.enterPhase(PHASES.FINALS);
    }

    async runPlayoffRound(roundName, matches) {
        this.broadcast({
            type: 'playoff_round_start',
            round: roundName,
            matches: matches.map(m => ({
                matchId: m.matchId,
                team1: m.team1.name,
                team2: m.team2?.name || 'TBD'
            }))
        });

        for (const match of matches) {
            if (!this.isRunning) break;

            this.emit('playoff_match_scheduled', {
                team1: match.team1,
                team2: match.team2,
                round: roundName,
                matchId: match.matchId,
                intensity: 'PLAYOFF' // Higher stakes modifier
            });

            // Wait for match to complete (will be set by Game class via recordMatchResult)
            await this.sleep(TIMINGS.PLAYOFFS.MATCH_INTERVAL);
        }
    }

    // ==================== FINALS PHASE ====================

    async runFinals() {
        const finalists = [
            this.playoffBracket.semifinals[0].winner,
            this.playoffBracket.semifinals[1].winner
        ];

        this.broadcast({
            type: 'finals_start',
            team1: finalists[0].name,
            team2: finalists[1].name,
            seriesFormat: `BEST OF ${TIMINGS.FINALS.SERIES_LENGTH}`,
            message: '👑 THE GRAND FINALS BEGIN 👑'
        });

        // Best of 3/5 series
        const seriesLength = TIMINGS.FINALS.SERIES_LENGTH;
        const matchesNeeded = Math.ceil(seriesLength / 2);

        let team1Wins = 0;
        let team2Wins = 0;
        let champion = null;

        for (let game = 1; team1Wins < matchesNeeded && team2Wins < matchesNeeded; game++) {
            if (!this.isRunning) break;

            this.broadcast({
                type: 'finals_game',
                gameNumber: game,
                series: `${team1Wins}-${team2Wins}`,
                team1: finalists[0].name,
                team2: finalists[1].name
            });

            this.emit('finals_match_scheduled', {
                team1: finalists[0],
                team2: finalists[1],
                gameNumber: game,
                intensity: 'CHAMPIONSHIP' // Maximum stakes
            });

            await this.sleep(TIMINGS.FINALS.MATCH_INTERVAL);

            // Winner will be recorded via recordMatchResult
            // For now, simulate (this will be replaced by actual match result)
            if (Math.random() > 0.5) {
                team1Wins++;
            } else {
                team2Wins++;
            }
        }

        champion = team1Wins > team2Wins ? finalists[0] : finalists[1];

        this.broadcast({
            type: 'champion_crowned',
            champion: champion.name,
            series: `${team1Wins}-${team2Wins}`,
            season: this.currentSeason,
            message: `🏆 ${champion.name} ARE YOUR SEASON ${this.currentSeason} CHAMPIONS! 🏆`
        });

        // Record championship in database
        await this.db.addSeasonEvent(
            this.currentSeason,
            'CHAMPIONSHIP',
            `${champion.name} won Season ${this.currentSeason}`,
            null,
            champion.name
        );

        // Move to off-season
        await this.enterPhase(PHASES.OFF_SEASON);
    }

    // ==================== OFF-SEASON PHASE ====================

    async runOffSeason() {
        // 1. Awards Ceremony
        this.broadcast({
            type: 'awards_ceremony',
            message: '🏅 AWARDS CEREMONY BEGINNING'
        });

        const awards = await this.calculateAwards();
        this.broadcast({
            type: 'awards_results',
            awards
        });

        await this.sleep(TIMINGS.OFF_SEASON.AWARDS_CEREMONY);

        // 2. The Reckoning (Voting Phase)
        this.broadcast({
            type: 'reckoning_start',
            message: '⚡ THE RECKONING: VOTE TO SHAPE REALITY',
            votingOpen: true
        });

        await this.sleep(TIMINGS.OFF_SEASON.RECKONING_VOTING);

        const reckoningResults = await this.processReckoningVotes();
        this.broadcast({
            type: 'reckoning_results',
            results: reckoningResults
        });

        // 3. Roster Changes & Draft
        await this.sleep(TIMINGS.OFF_SEASON.ROSTER_CHANGES);

        this.broadcast({
            type: 'roster_changes',
            message: '🔄 ROSTER CHANGES & DRAFT COMPLETE'
        });

        // 4. Lore Events
        const loreEvents = this.generateLoreEvents();
        for (const event of loreEvents) {
            this.broadcast({
                type: 'lore_event',
                ...event
            });
            await this.sleep(TIMINGS.OFF_SEASON.LORE_EVENTS);
        }

        // 5. Archive season stats before ending
        this.broadcast({
            type: 'system_message',
            message: '📊 Archiving season statistics...'
        });

        try {
            await this.db.archiveSeasonStats(this.currentSeason, this.teams);
            console.log(`Season ${this.currentSeason} stats archived successfully`);
        } catch (error) {
            console.error('Error archiving season stats:', error);
        }

        // End season in database
        await this.db.endSeason(this.currentSeason, { awards, reckoningResults });

        // Prepare for next season
        this.currentSeason++;
        this.currentWeek = 0;
        this.currentDay = 0;
        this.completedMatches = [];

        this.broadcast({
            type: 'off_season_complete',
            message: `Season ${this.currentSeason - 1} has concluded. Season ${this.currentSeason} approaches...`,
            nextSeason: this.currentSeason
        });

        // Auto-start next season or pause
        this.isRunning = false;
        this.currentPhase = PHASES.PAUSED;
    }

    async calculateAwards() {
        // Calculate season awards based on stats
        // This is a placeholder - will be expanded with actual stat tracking
        return {
            mvp: { champion: 'TBD', team: 'TBD' },
            rookieOfYear: { champion: 'TBD', team: 'TBD' },
            mostChaotic: { champion: 'TBD', team: 'TBD' },
            goldCS: { champion: 'TBD', team: 'TBD' },
            clutchPlayer: { champion: 'TBD', team: 'TBD' }
        };
    }

    async processReckoningVotes() {
        // Process user votes for next season changes
        // This is a placeholder - will be expanded with voting system
        return {
            rulesChanged: [],
            championsBlessed: [],
            championsCursed: [],
            chaosDecree: 'The Committee decrees: More chaos.'
        };
    }

    generateLoreEvents() {
        const events = [
            { title: 'The Void Stirs', description: 'Strange energies detected in the network...' },
            { title: 'A Champion Dreams', description: 'They speak of things beyond the arena...' },
            { title: 'The Committee Watches', description: 'Always watching. Always judging.' }
        ];

        // Return 1-3 random events
        const count = Math.floor(Math.random() * 3) + 1;
        return events.sort(() => Math.random() - 0.5).slice(0, count);
    }

    // ==================== HELPER METHODS ====================

    calculateStandings() {
        return this.teams
            .map(t => ({
                name: t.name,
                wins: t.wins || 0,
                losses: t.losses || 0
            }))
            .sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                return a.losses - b.losses; // Tiebreaker by fewer losses
            });
    }

    recordMatchResult(matchId, winner, loser, phase) {
        // Called by Game class when a match completes
        this.completedMatches.push({ matchId, winner: winner.name, loser: loser.name, phase });

        // Update playoff bracket if in playoffs/finals
        if (this.playoffBracket) {
            const allMatches = [
                ...this.playoffBracket.quarterfinals,
                ...this.playoffBracket.semifinals
            ];
            const match = allMatches.find(m => m.matchId === matchId);
            if (match) {
                match.winner = winner;
            }
        }
    }

    broadcast(message) {
        if (this.wss) {
            this.wss.clients.forEach(client => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(JSON.stringify(message));
                }
            });
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== ADMIN CONTROLS ====================

    pause() {
        this.isRunning = false;
        clearTimeout(this.phaseTimer);
        clearTimeout(this.matchTimer);
        this.currentPhase = PHASES.PAUSED;
        this.broadcast({
            type: 'season_paused',
            message: 'Season paused by admin'
        });
    }

    resume() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.broadcast({
                type: 'season_resumed',
                message: 'Season resumed'
            });
        }
    }

    async skipToPhase(phase) {
        if (Object.values(PHASES).includes(phase)) {
            await this.enterPhase(phase);
        }
    }

    getStatus() {
        return {
            season: this.currentSeason,
            phase: this.currentPhase,
            week: this.currentWeek,
            day: this.currentDay,
            theme: this.seasonNarrativeTheme,
            isRunning: this.isRunning,
            matchesCompleted: this.completedMatches.length,
            standingsTop3: this.calculateStandings().slice(0, 3)
        };
    }
}

module.exports = { SeasonManager, PHASES, TIMINGS };
