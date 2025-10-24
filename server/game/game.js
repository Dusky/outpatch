/**
 * Game Controller - Orchestrates the entire MOBA Network
 *
 * Now powered by SeasonManager for deep, robust season simulation
 */

const { teams } = require('../data/data.json');
const Match = require('./match');
const MatchAdapter = require('../simulation/MatchAdapter');  // New simulation engine
const { generateNewsItem } = require('./newsGenerator');
const StatsManager = require('./statsManager');
const BettingSystem = require('./bettingSystem');
const { SeasonManager, PHASES } = require('./seasonManager');
const DraftSystem = require('./draftSystem');
const AwardsSystem = require('./awardsSystem');
const ReckoningSystem = require('./reckoningSystem');

class Game {
    constructor(wss, database) {
        this.wss = wss;
        this.database = database;
        this.teams = teams;

        // Legacy properties (kept for compatibility)
        this.match_history = [];
        this.matchCounter = 0;
        this.newsHistory = [];
        this.newsInterval = null;

        // Core systems
        this.statsManager = new StatsManager();
        this.bettingSystem = new BettingSystem(this);

        // NEW: Season management systems
        this.seasonManager = new SeasonManager(database, wss);
        this.draftSystem = new DraftSystem();
        this.awardsSystem = new AwardsSystem(this.statsManager, database);
        this.reckoningSystem = new ReckoningSystem(database);

        // Current match tracking
        this.activeMatches = [];
        this.currentMatchups = [];

        // Flags
        this.isRunning = false;
        this.useNewSimulation = true;  // Feature flag: Enable new ECS simulation engine

        // Setup season manager event listeners
        this.setupSeasonManagerListeners();
    }

    /**
     * Setup event listeners for SeasonManager
     */
    setupSeasonManagerListeners() {
        // Practice match requested (pre-season)
        this.seasonManager.on('practice_match_requested', () => {
            this.runPracticeMatch();
        });

        // Regular season matches scheduled
        this.seasonManager.on('matches_scheduled', (matchups) => {
            this.runScheduledMatches(matchups, 'REGULAR_SEASON');
        });

        // Playoff match scheduled
        this.seasonManager.on('playoff_match_scheduled', (matchInfo) => {
            this.runPlayoffMatch(matchInfo);
        });

        // Finals match scheduled
        this.seasonManager.on('finals_match_scheduled', (matchInfo) => {
            this.runFinalsMatch(matchInfo);
        });
    }

    /**
     * Initialize and start a new season
     */
    async startSeason(seasonNumber = 1) {
        console.log(`Starting Season ${seasonNumber}...`);

        // Store current season number
        this.currentSeasonNumber = seasonNumber;

        // Load team standings from database if they exist
        await this.loadTeamStandings(seasonNumber);

        // Initialize season in database
        await this.seasonManager.initialize(this.teams, seasonNumber);

        // Generate champion pool for draft
        this.draftSystem.generateChampionPool();

        // Start the season lifecycle
        await this.seasonManager.startSeason();

        this.isRunning = true;

        // Broadcast initial state
        this.broadcastTeamsAndStandings();
        this.broadcastSeasonStatus();

        // Auto-save standings every minute
        this.startAutoSave(seasonNumber);
    }

    /**
     * Load team standings from database
     */
    async loadTeamStandings(seasonNumber) {
        try {
            const standings = await this.database.loadTeamStandings(seasonNumber);
            if (standings && standings.length > 0) {
                console.log(`Loaded ${standings.length} team standings from database`);
                // Update teams object with loaded standings
                standings.forEach(record => {
                    const team = this.teams.find(t => t.name === record.team_name);
                    if (team) {
                        team.wins = record.wins;
                        team.losses = record.losses;
                    }
                });
            }
        } catch (error) {
            console.log('No existing standings found, starting fresh');
        }
    }

    /**
     * Save team standings to database
     */
    async saveTeamStandings(seasonNumber) {
        try {
            await this.database.saveTeamStandings(seasonNumber, this.teams);
            console.log('Team standings saved to database');
        } catch (error) {
            console.error('Failed to save team standings:', error);
        }
    }

    /**
     * Start auto-save interval and status broadcast timer
     */
    startAutoSave(seasonNumber) {
        // Clear any existing auto-save interval
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        // Clear any existing status broadcast interval
        if (this.statusBroadcastInterval) {
            clearInterval(this.statusBroadcastInterval);
        }

        // Save standings every 60 seconds
        this.autoSaveInterval = setInterval(() => {
            this.saveTeamStandings(seasonNumber);
        }, 60000);

        // Broadcast season status every 30 seconds
        this.statusBroadcastInterval = setInterval(() => {
            this.broadcastSeasonStatus();
        }, 30000);
    }

    /**
     * Run a practice match (exhibition, doesn't count)
     */
    async runPracticeMatch() {
        console.log('Running practice match...');

        // Pick two random teams
        const shuffled = [...this.teams].sort(() => Math.random() - 0.5);
        const team1 = shuffled[0];
        const team2 = shuffled[1];

        this.broadcast({
            type: 'practice_match_start',
            team1: team1.name,
            team2: team2.name,
            message: '🎮 EXHIBITION MATCH (Does not count toward standings)'
        });

        const match = await this.runMatch(team1, team2, 'PRACTICE');

        // Don't update standings for practice matches
        this.broadcast({
            type: 'practice_match_end',
            winner: match.winner.name,
            message: 'Exhibition match complete. No standings affected.'
        });

        // Broadcast updated season status
        this.broadcastSeasonStatus();
    }

    /**
     * Run scheduled regular season matches
     */
    async runScheduledMatches(matchups, phase = 'REGULAR_SEASON') {
        console.log(`Running ${matchups.length} scheduled matches...`);

        this.currentMatchups = matchups;

        // Broadcast matchups for the day
        this.broadcast({
            type: 'matches_today',
            matchups: matchups.map(m => ({
                team1: m.team1.name,
                team2: m.team2.name,
                narrative: m.narrative,
                specialEvent: m.specialEvent
            }))
        });

        // Start news feed during countdown
        this.startNewsFeed();

        // Run all matches concurrently
        const matchPromises = matchups.map(matchup =>
            this.runMatchWithBetting(matchup.team1, matchup.team2, phase, matchup)
        );

        await Promise.all(matchPromises);

        this.stopNewsFeed();

        // Update standings after all matches
        this.updateStandings();
        this.broadcastStats();
        this.broadcastSeasonStatus();

        // Save standings after matches complete
        await this.saveTeamStandings(this.currentSeasonNumber || 1);
    }

    /**
     * Run a playoff match
     */
    async runPlayoffMatch(matchInfo) {
        console.log(`Running playoff match: ${matchInfo.team1.name} vs ${matchInfo.team2.name}`);

        this.broadcast({
            type: 'playoff_match_start',
            round: matchInfo.round,
            matchId: matchInfo.matchId,
            team1: matchInfo.team1.name,
            team2: matchInfo.team2.name,
            message: `🏆 ${matchInfo.round} - ${matchInfo.team1.name} vs ${matchInfo.team2.name}`
        });

        const match = await this.runMatchWithBetting(
            matchInfo.team1,
            matchInfo.team2,
            'PLAYOFF',
            matchInfo
        );

        // Record result in season manager
        this.seasonManager.recordMatchResult(
            matchInfo.matchId,
            match.winner,
            match.loser,
            'PLAYOFF'
        );

        this.updateStandings();
        this.broadcastSeasonStatus();

        // Save standings after playoff match
        await this.saveTeamStandings(this.currentSeasonNumber || 1);
    }

    /**
     * Run a finals match
     */
    async runFinalsMatch(matchInfo) {
        console.log(`Running FINALS match: Game ${matchInfo.gameNumber}`);

        this.broadcast({
            type: 'finals_match_start',
            gameNumber: matchInfo.gameNumber,
            team1: matchInfo.team1.name,
            team2: matchInfo.team2.name,
            message: `👑 GRAND FINALS GAME ${matchInfo.gameNumber}`
        });

        const match = await this.runMatchWithBetting(
            matchInfo.team1,
            matchInfo.team2,
            'CHAMPIONSHIP',
            matchInfo
        );

        this.updateStandings();
        this.broadcastSeasonStatus();

        // Save standings after finals match
        await this.saveTeamStandings(this.currentSeasonNumber || 1);
    }

    /**
     * Run a single match with full betting integration
     */
    async runMatchWithBetting(team1, team2, phase = 'REGULAR_SEASON', metadata = {}) {
        this.matchCounter++;
        const matchId = `match_${this.matchCounter}`;

        // Create betting pool
        const bettingPool = this.bettingSystem.createMatchBetting({ team1, team2 }, matchId);
        this.broadcastOdds(matchId);

        // Run the actual match
        const match = await this.runMatch(team1, team2, phase, matchId);

        // Lock betting and resolve bets
        this.bettingSystem.lockBetting(matchId);
        const { payouts, totalPaid } = this.bettingSystem.resolveBets(matchId, match.winner.name);
        this.broadcastBetResults(matchId, payouts);

        // Update team records if not practice
        if (phase !== 'PRACTICE') {
            const winnerTeam = this.teams.find(t => t.name === match.winner.name);
            const loserTeam = this.teams.find(t => t.name === match.loser.name);

            if (winnerTeam) winnerTeam.wins++;
            if (loserTeam) loserTeam.losses++;

            // Record match stats
            this.statsManager.recordMatch(match.matchInstance, match.winner, match.loser);
        }

        return match;
    }

    /**
     * Run a match and return winner/loser
     */
    runMatch(team1, team2, phase = 'REGULAR_SEASON', matchId = null) {
        return new Promise((resolve) => {
            // Determine intensity multiplier based on phase
            let intensityMultiplier = 1.0;
            if (phase === 'PLAYOFF') {
                intensityMultiplier = 1.3;
            } else if (phase === 'CHAMPIONSHIP') {
                intensityMultiplier = 1.5;
            }

            // Choose engine based on feature flag
            const match = this.useNewSimulation
                ? new MatchAdapter(team1, team2, this.wss, { intensityMultiplier })
                : new Match(team1, team2, this.wss);

            // Apply phase intensity modifiers (old engine only)
            if (!this.useNewSimulation) {
                match.intensityMultiplier = intensityMultiplier;
            }

            match.start();

            match.on('end', async (winner, loser) => {
                this.match_history.push(match.log);

                // Save replay data if using new simulator
                if (this.useNewSimulation && match.getReplayData) {
                    try {
                        const replayData = match.getReplayData();
                        if (replayData && this.db) {
                            await this.db.saveMatchReplay(replayData);
                            console.log(`Replay saved for match ${matchId}`);
                        }
                    } catch (error) {
                        console.error('Error saving replay:', error);
                    }
                }

                resolve({
                    winner,
                    loser,
                    matchInstance: match,
                    matchId
                });
            });

            this.activeMatches.push(match);
        });
    }

    /**
     * Start news feed
     */
    startNewsFeed() {
        this.newsHistory = [];
        this.newsInterval = setInterval(() => {
            const newsItem = generateNewsItem(this.teams);
            this.newsHistory.push(newsItem);
            const recentNews = this.newsHistory.slice(Math.max(0, this.newsHistory.length - 4));
            this.broadcast({ type: 'news', data: recentNews });
        }, 2 * 60 * 1000); // 2 minutes
    }

    /**
     * Stop news feed
     */
    stopNewsFeed() {
        if (this.newsInterval) {
            clearInterval(this.newsInterval);
            this.newsInterval = null;
        }
    }

    /**
     * Update and broadcast standings
     */
    updateStandings() {
        // Deduplicate teams by name, merging wins/losses for duplicates
        const teamMap = new Map();
        this.teams.forEach(t => {
            const existing = teamMap.get(t.name);
            if (existing) {
                // Merge stats for duplicate team
                existing.wins = (existing.wins || 0) + (t.wins || 0);
                existing.losses = (existing.losses || 0) + (t.losses || 0);
            } else {
                teamMap.set(t.name, { name: t.name, wins: t.wins || 0, losses: t.losses || 0 });
            }
        });

        const standings = Array.from(teamMap.values())
            .sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                return a.losses - b.losses;
            });

        this.broadcast({ type: 'standings', data: standings });
    }

    /**
     * Broadcast stats update
     */
    broadcastStats() {
        const leaderboards = this.statsManager.getAllLeaderboards();
        const globalStats = this.statsManager.getGlobalStats();
        const matchHistory = this.statsManager.getMatchHistory(10);

        this.broadcast({
            type: 'stats_update',
            leaderboards,
            globalStats,
            matchHistory
        });
    }

    /**
     * Broadcast betting odds
     */
    broadcastOdds(matchId) {
        const pool = this.bettingSystem.getPool(matchId);
        if (!pool) return;

        this.broadcast({
            type: 'betting_odds',
            matchId,
            team1: pool.team1,
            team2: pool.team2,
            team1Odds: pool.team1Odds.toFixed(2),
            team2Odds: pool.team2Odds.toFixed(2),
            team1Pool: pool.team1Pool,
            team2Pool: pool.team2Pool,
            locked: pool.locked
        });
    }

    /**
     * Broadcast bet results
     */
    broadcastBetResults(matchId, payouts) {
        const pool = this.bettingSystem.getPool(matchId);

        this.wss.clients.forEach(client => {
            const userId = client._userId;
            const userPayout = payouts.find(p => p.userId === userId);

            client.send(JSON.stringify({
                type: 'bet_results',
                matchId,
                winner: pool.winner,
                yourPayout: userPayout || null,
                totalPayouts: payouts.length
            }));
        });
    }

    /**
     * Broadcast teams and standings on initialization
     */
    broadcastTeamsAndStandings() {
        this.broadcast({ type: 'teams', data: this.teams.map(t => t.name) });
        this.broadcast({ type: 'full_teams', data: this.teams });
        this.updateStandings();
    }

    /**
     * Broadcast current season status to all clients
     */
    broadcastSeasonStatus() {
        const status = this.seasonManager ? this.seasonManager.getStatus() : null;

        this.broadcast({
            type: 'season_status',
            phase: status ? status.phase : 'PAUSED',
            season: this.currentSeasonNumber || 1,
            week: status ? status.week : 0,
            day: status ? status.day : 0,
            isMatchInProgress: this.activeMatches.length > 0,
            matchesScheduled: this.currentMatchups.length
        });
    }

    /**
     * Generic broadcast helper
     */
    broadcast(message) {
        if (this.wss) {
            this.wss.clients.forEach(client => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(JSON.stringify(message));
                }
            });
        }
    }

    // ==================== ADMIN CONTROLS ====================

    /**
     * Start matches (legacy compatibility + new season system)
     */
    start() {
        if (this.isRunning) {
            console.log('Game already running');
            return;
        }

        // Start new season with season manager
        this.startSeason(1);
    }

    /**
     * Stop everything
     */
    stop() {
        this.stopNewsFeed();

        if (this.seasonManager) {
            this.seasonManager.pause();
        }

        // Clear intervals
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        if (this.statusBroadcastInterval) {
            clearInterval(this.statusBroadcastInterval);
            this.statusBroadcastInterval = null;
        }

        this.activeMatches = [];
        this.isRunning = false;

        this.broadcast({
            type: 'admin_message',
            message: 'All activity stopped by admin'
        });
    }

    /**
     * Resume season
     */
    resume() {
        if (this.seasonManager) {
            this.seasonManager.resume();
            this.isRunning = true;
        }
    }

    /**
     * Force a quick match (admin override)
     */
    forceMatch() {
        console.log('Forcing immediate match...');

        // Pick two random teams
        const shuffled = [...this.teams].sort(() => Math.random() - 0.5);
        const team1 = shuffled[0];
        const team2 = shuffled[1];

        this.runMatchWithBetting(team1, team2, 'ADMIN_FORCED');
    }

    /**
     * Skip to specific season phase
     */
    async skipToPhase(phase) {
        if (this.seasonManager) {
            await this.seasonManager.skipToPhase(phase);
        }
    }

    /**
     * Get current season status
     */
    getSeasonStatus() {
        if (this.seasonManager) {
            return this.seasonManager.getStatus();
        }
        return { phase: 'NONE', isRunning: this.isRunning };
    }

    /**
     * Run draft
     */
    async runDraft() {
        console.log('Running draft...');
        const draftLog = await this.draftSystem.conductDraft(this.teams, this.database);

        this.broadcast({
            type: 'draft_complete',
            log: draftLog,
            message: 'Draft completed! New rosters finalized.'
        });

        // Broadcast updated teams
        this.broadcastTeamsAndStandings();

        return draftLog;
    }

    /**
     * Calculate and broadcast awards
     */
    async calculateAwards() {
        console.log('Calculating season awards...');
        const awards = await this.awardsSystem.calculateSeasonAwards(
            this.teams,
            this.match_history
        );

        this.broadcast(this.awardsSystem.formatForBroadcast(awards));

        return awards;
    }

    /**
     * Start Reckoning voting
     */
    async startReckoning(seasonNumber) {
        const votingOptions = await this.reckoningSystem.startReckoning(this.teams, seasonNumber);

        this.broadcast(this.reckoningSystem.formatForBroadcast());

        return votingOptions;
    }

    /**
     * End Reckoning and process votes
     */
    async endReckoning() {
        const results = await this.reckoningSystem.endReckoning();

        this.broadcast({
            type: 'reckoning_results',
            results
        });

        return results;
    }

    /**
     * Reset standings (admin)
     */
    resetStandings() {
        this.teams.forEach(team => {
            team.wins = 0;
            team.losses = 0;
        });
        this.updateStandings();
    }

    /**
     * Reload team data (admin)
     */
    reloadData() {
        delete require.cache[require.resolve('../data/data.json')];
        const { teams } = require('../data/data.json');
        this.teams = teams;
        this.broadcastTeamsAndStandings();
    }
}

module.exports = Game;
