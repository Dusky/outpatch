/**
 * Database Layer for VOID MOBA Network
 *
 * This module provides persistent storage for:
 * - User accounts and authentication
 * - Season history and events
 * - Champion career statistics
 * - Betting records and achievements
 *
 * NOTE: The database itself is corrupted. Reality is optional.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, '../../data/void_network.db');
const CORRUPTION_CHANCE = 0.001; // 0.1% chance of "corruption" display

class Database {
    constructor() {
        this.ready = false;
        this.readyPromise = new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    console.error('Failed to connect to database:', err);
                    reject(err);
                } else {
                    console.log('Connected to VOID database (reality verification: PASSED)');
                    this.initialize().then(resolve).catch(reject);
                }
            });
        });
    }

    initialize() {
        return new Promise((resolve, reject) => {
            // Create tables if they don't exist
            this.db.serialize(() => {
            // Users table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    display_name TEXT,
                    balance INTEGER DEFAULT 1000,
                    corruption_level INTEGER DEFAULT 0,
                    responsibility_score INTEGER DEFAULT 0,
                    is_admin INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_login DATETIME
                )
            `);

            // Seasons table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS seasons (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    season_number INTEGER UNIQUE,
                    start_date DATETIME,
                    end_date DATETIME,
                    total_matches INTEGER DEFAULT 0,
                    total_chaos_events INTEGER DEFAULT 0,
                    global_corruption INTEGER DEFAULT 0,
                    notable_events TEXT,
                    status TEXT DEFAULT 'active'
                )
            `);

            // Champion careers table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS champion_careers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    champion_name TEXT UNIQUE NOT NULL,
                    team_name TEXT,
                    total_matches INTEGER DEFAULT 0,
                    total_wins INTEGER DEFAULT 0,
                    total_losses INTEGER DEFAULT 0,
                    total_kills INTEGER DEFAULT 0,
                    total_deaths INTEGER DEFAULT 0,
                    total_assists INTEGER DEFAULT 0,
                    total_cs INTEGER DEFAULT 0,
                    total_gold INTEGER DEFAULT 0,
                    chaos_witnessed INTEGER DEFAULT 0,
                    corruption_level INTEGER DEFAULT 0,
                    scars TEXT,
                    curses TEXT,
                    death_count INTEGER DEFAULT 0,
                    resurrection_count INTEGER DEFAULT 0,
                    perma_dead INTEGER DEFAULT 0,
                    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_seen DATETIME
                )
            `);

            // Champion season stats table - per-season statistics archive
            this.db.run(`
                CREATE TABLE IF NOT EXISTS champion_season_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    season_number INTEGER,
                    champion_name TEXT NOT NULL,
                    team_name TEXT,
                    matches_played INTEGER DEFAULT 0,
                    wins INTEGER DEFAULT 0,
                    losses INTEGER DEFAULT 0,
                    kills INTEGER DEFAULT 0,
                    deaths INTEGER DEFAULT 0,
                    assists INTEGER DEFAULT 0,
                    cs INTEGER DEFAULT 0,
                    gold_earned INTEGER DEFAULT 0,
                    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(season_number, champion_name),
                    FOREIGN KEY (season_number) REFERENCES seasons(season_number)
                )
            `);

            // Betting history table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS betting_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    season_number INTEGER,
                    match_id TEXT,
                    team_bet TEXT,
                    amount INTEGER,
                    odds REAL,
                    result TEXT,
                    payout INTEGER DEFAULT 0,
                    profit INTEGER DEFAULT 0,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);

            // Achievements table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS user_achievements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    achievement_id TEXT NOT NULL,
                    achievement_name TEXT,
                    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    season_number INTEGER,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);

            // Season events table (for history)
            this.db.run(`
                CREATE TABLE IF NOT EXISTS season_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    season_number INTEGER,
                    event_type TEXT,
                    event_description TEXT,
                    affected_champion TEXT,
                    affected_team TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (season_number) REFERENCES seasons(season_number)
                )
            `);

            // Patch notes table (gets progressively worse)
            this.db.run(`
                CREATE TABLE IF NOT EXISTS patch_notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    season_number INTEGER,
                    patch_version TEXT,
                    notes TEXT,
                    corruption_level INTEGER DEFAULT 0,
                    released_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // NEW TABLES FOR SEASON SYSTEM

            // Season schedule table - stores full season matchup schedule
            this.db.run(`
                CREATE TABLE IF NOT EXISTS season_schedule (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    season_number INTEGER,
                    week INTEGER,
                    day INTEGER,
                    round INTEGER,
                    team1_name TEXT,
                    team2_name TEXT,
                    matchup_key TEXT,
                    matchup_count INTEGER,
                    special_event TEXT,
                    narrative TEXT,
                    completed INTEGER DEFAULT 0,
                    winner_name TEXT,
                    match_date DATETIME,
                    FOREIGN KEY (season_number) REFERENCES seasons(season_number)
                )
            `);

            // Playoff brackets table - stores playoff tree structure
            this.db.run(`
                CREATE TABLE IF NOT EXISTS playoff_brackets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    season_number INTEGER,
                    round_name TEXT,
                    match_id TEXT UNIQUE,
                    seed1 INTEGER,
                    seed2 INTEGER,
                    team1_name TEXT,
                    team2_name TEXT,
                    winner_name TEXT,
                    match_date DATETIME,
                    FOREIGN KEY (season_number) REFERENCES seasons(season_number)
                )
            `);

            // Champion pool table - available undrafted champions
            this.db.run(`
                CREATE TABLE IF NOT EXISTS champion_pool (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    champion_name TEXT UNIQUE NOT NULL,
                    role TEXT,
                    mechanical_skill REAL,
                    game_sense REAL,
                    tilt_resistance REAL,
                    clutch_factor REAL,
                    lore TEXT,
                    drafted INTEGER DEFAULT 0,
                    draft_position INTEGER,
                    draft_round INTEGER,
                    draft_season INTEGER,
                    team_name TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Season narratives table - active storylines
            this.db.run(`
                CREATE TABLE IF NOT EXISTS season_narratives (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    season_number INTEGER,
                    narrative_type TEXT,
                    title TEXT,
                    description TEXT,
                    affected_teams TEXT,
                    affected_champions TEXT,
                    active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (season_number) REFERENCES seasons(season_number)
                )
            `);

            // User votes table - Reckoning voting records
            this.db.run(`
                CREATE TABLE IF NOT EXISTS user_votes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    season_number INTEGER,
                    category TEXT,
                    option_id TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, season_number, category),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);

            // Awards history table - season awards archive
            this.db.run(`
                CREATE TABLE IF NOT EXISTS awards_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    season_number INTEGER,
                    award_type TEXT,
                    winner_name TEXT,
                    team_name TEXT,
                    stats TEXT,
                    awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (season_number) REFERENCES seasons(season_number)
                )
            `);

            // Match results table - detailed match outcomes
            this.db.run(`
                CREATE TABLE IF NOT EXISTS match_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    season_number INTEGER,
                    match_id TEXT,
                    phase TEXT,
                    week INTEGER,
                    day INTEGER,
                    team1_name TEXT,
                    team2_name TEXT,
                    winner_name TEXT,
                    loser_name TEXT,
                    duration_waves INTEGER,
                    team1_towers INTEGER,
                    team2_towers INTEGER,
                    match_log TEXT,
                    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (season_number) REFERENCES seasons(season_number)
                )
            `);

            // Match replays table - stores deterministic replay data
            this.db.run(`
                CREATE TABLE IF NOT EXISTS match_replays (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    match_id TEXT UNIQUE,
                    seed TEXT NOT NULL,
                    team1_name TEXT,
                    team2_name TEXT,
                    events_json TEXT,
                    snapshots_json TEXT,
                    final_state_json TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (match_id) REFERENCES match_results(match_id)
                )
            `);

            // Team standings table - stores current season team records
            this.db.run(`
                CREATE TABLE IF NOT EXISTS team_standings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    season_number INTEGER,
                    team_name TEXT,
                    wins INTEGER DEFAULT 0,
                    losses INTEGER DEFAULT 0,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(season_number, team_name),
                    FOREIGN KEY (season_number) REFERENCES seasons(season_number)
                )
            `);

            // Season state table - stores current season phase and context
            this.db.run(`
                CREATE TABLE IF NOT EXISTS season_state (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    season_number INTEGER UNIQUE,
                    current_phase TEXT,
                    current_week INTEGER,
                    current_day INTEGER,
                    is_running INTEGER DEFAULT 0,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (season_number) REFERENCES seasons(season_number)
                )
            `);

                console.log('Database tables initialized');
                this.ready = true;
                resolve();
            });
        });
    }

    // ==================== USER AUTHENTICATION ====================

    async createUser(username, password) {
        return new Promise((resolve, reject) => {
            // Reality verification simulation
            if (Math.random() < 0.05) {
                return reject({ error: 'Reality verification required. Please try again.' });
            }

            // Check if this is the first user (make them admin)
            this.db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
                if (err) return reject({ error: 'Database error' });

                const isFirstUser = result.count === 0;
                const passwordHash = bcrypt.hashSync(password, 10);
                const displayName = isFirstUser
                    ? `Admin_${username}`
                    : `Player_${Math.random().toString(36).substr(2, 9).toUpperCase()} (definitely human)`;

                this.db.run(
                    'INSERT INTO users (username, password_hash, display_name, is_admin) VALUES (?, ?, ?, ?)',
                    [username, passwordHash, displayName, isFirstUser ? 1 : 0],
                    function(err) {
                        if (err) {
                            reject({ error: 'Username already exists (in this reality)' });
                        } else {
                            resolve({
                                id: this.lastID,
                                username,
                                displayName,
                                balance: 1000,
                                isAdmin: isFirstUser
                            });
                        }
                    }
                );
            });
        });
    }

    async authenticateUser(username, password) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE username = ?',
                [username],
                async (err, user) => {
                    if (err || !user) {
                        return reject({ error: 'Invalid credentials (or wrong dimension)' });
                    }

                    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
                    if (!passwordMatch) {
                        return reject({ error: 'Invalid credentials (or wrong dimension)' });
                    }

                    // Update last login
                    this.db.run(
                        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                        [user.id]
                    );

                    // Corrupt display occasionally
                    if (Math.random() < CORRUPTION_CHANCE) {
                        user.display_name = user.display_name.split('').map(c =>
                            Math.random() < 0.3 ? '█' : c
                        ).join('');
                    }

                    resolve({
                        id: user.id,
                        username: user.username,
                        displayName: user.display_name,
                        balance: user.balance,
                        corruptionLevel: user.corruption_level,
                        responsibilityScore: user.responsibility_score,
                        isAdmin: user.is_admin === 1
                    });
                }
            );
        });
    }

    async getUserById(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE id = ?',
                [userId],
                (err, user) => {
                    if (err || !user) {
                        reject({ error: 'User not found (they may have been consumed)' });
                    } else {
                        resolve(user);
                    }
                }
            );
        });
    }

    async updateUserBalance(userId, newBalance) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET balance = ? WHERE id = ?',
                [newBalance, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve({ success: true, newBalance });
                }
            );
        });
    }

    async applyVoidTax(userId, taxAmount, reason) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
                if (err || !user) return reject(err);

                const newBalance = Math.max(0, user.balance - taxAmount);
                this.db.run(
                    'UPDATE users SET balance = ? WHERE id = ?',
                    [newBalance, userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve({ success: true, taxAmount, reason, newBalance });
                    }
                );
            });
        });
    }

    // ==================== SEASON MANAGEMENT ====================

    async createSeason(seasonNumber) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO seasons (season_number, start_date, status) VALUES (?, CURRENT_TIMESTAMP, ?)',
                [seasonNumber, 'active'],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, seasonNumber });
                }
            );
        });
    }

    async endSeason(seasonNumber, notableEvents) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE seasons SET
                    end_date = CURRENT_TIMESTAMP,
                    status = 'completed',
                    notable_events = ?
                WHERE season_number = ?`,
                [JSON.stringify(notableEvents), seasonNumber],
                (err) => {
                    if (err) reject(err);
                    else resolve({ success: true });
                }
            );
        });
    }

    /**
     * Archive current season stats for all champions
     * Called at the end of each season to preserve historical data
     */
    async archiveSeasonStats(seasonNumber, teams) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO champion_season_stats
                (season_number, champion_name, team_name, matches_played, wins, losses, kills, deaths, assists, cs, gold_earned)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const promises = [];

            teams.forEach(team => {
                team.champions.forEach(champ => {
                    const promise = new Promise((res, rej) => {
                        stmt.run([
                            seasonNumber,
                            champ.name,
                            team.name,
                            champ.matches_played || 0,
                            champ.wins || 0,
                            champ.losses || 0,
                            champ.kda?.k || 0,
                            champ.kda?.d || 0,
                            champ.kda?.a || 0,
                            champ.cs || 0,
                            champ.gold || 0
                        ], (err) => {
                            if (err) rej(err);
                            else res();
                        });
                    });
                    promises.push(promise);
                });
            });

            Promise.all(promises)
                .then(() => {
                    stmt.finalize();
                    console.log(`Archived stats for season ${seasonNumber}: ${promises.length} champions`);
                    resolve({ success: true, championsArchived: promises.length });
                })
                .catch((err) => {
                    stmt.finalize();
                    reject(err);
                });
        });
    }

    /**
     * Reset champion stats for new season
     * Clears KDA, CS, gold, matches played, wins, losses
     * Preserves career totals in champion_careers table
     */
    async resetChampionStats(teams) {
        return new Promise((resolve, reject) => {
            let championsReset = 0;

            teams.forEach(team => {
                team.champions.forEach(champ => {
                    // Reset per-season stats
                    champ.kda = { k: 0, d: 0, a: 0 };
                    champ.cs = 0;
                    champ.gold = 500; // Starting gold
                    champ.matches_played = 0;
                    champ.wins = 0;
                    champ.losses = 0;
                    champ.items = [];
                    champ.level = 1;
                    championsReset++;
                });
            });

            console.log(`Reset stats for ${championsReset} champions`);
            resolve({ success: true, championsReset });
        });
    }

    /**
     * Get season stats for a specific champion
     */
    async getChampionSeasonHistory(championName) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM champion_season_stats
                WHERE champion_name = ?
                ORDER BY season_number DESC`,
                [championName],
                (err, stats) => {
                    if (err) reject(err);
                    else resolve(stats);
                }
            );
        });
    }

    /**
     * Get all archived stats for a specific season
     */
    async getSeasonStats(seasonNumber) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM champion_season_stats
                WHERE season_number = ?
                ORDER BY (kills + assists) DESC`,
                [seasonNumber],
                (err, stats) => {
                    if (err) reject(err);
                    else resolve(stats);
                }
            );
        });
    }

    async getAllSeasons() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM seasons ORDER BY season_number DESC',
                (err, seasons) => {
                    if (err) reject(err);
                    else {
                        // Occasionally corrupt season data
                        seasons.forEach(season => {
                            if (Math.random() < CORRUPTION_CHANCE * 5) {
                                season.notable_events = '[REDACTED]';
                            }
                        });
                        resolve(seasons);
                    }
                }
            );
        });
    }

    async addSeasonEvent(seasonNumber, eventType, description, affectedChampion = null, affectedTeam = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO season_events
                (season_number, event_type, event_description, affected_champion, affected_team)
                VALUES (?, ?, ?, ?, ?)`,
                [seasonNumber, eventType, description, affectedChampion, affectedTeam],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });
    }

    async getSeasonEvents(seasonNumber) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM season_events WHERE season_number = ? ORDER BY timestamp DESC',
                [seasonNumber],
                (err, events) => {
                    if (err) reject(err);
                    else resolve(events);
                }
            );
        });
    }

    // ==================== TEAM STANDINGS ====================

    async saveTeamStandings(seasonNumber, teams) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO team_standings (season_number, team_name, wins, losses, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);

            const promises = teams.map(team => {
                return new Promise((res, rej) => {
                    stmt.run([seasonNumber, team.name, team.wins || 0, team.losses || 0], (err) => {
                        if (err) rej(err);
                        else res();
                    });
                });
            });

            Promise.all(promises)
                .then(() => {
                    stmt.finalize();
                    resolve({ success: true });
                })
                .catch((err) => {
                    stmt.finalize();
                    reject(err);
                });
        });
    }

    async loadTeamStandings(seasonNumber) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT team_name, wins, losses FROM team_standings WHERE season_number = ?',
                [seasonNumber],
                (err, standings) => {
                    if (err) reject(err);
                    else resolve(standings);
                }
            );
        });
    }

    async saveSeasonState(seasonNumber, phase, week, day, isRunning) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO season_state
                (season_number, current_phase, current_week, current_day, is_running, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [seasonNumber, phase, week, day, isRunning ? 1 : 0],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });
    }

    async loadSeasonState(seasonNumber) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM season_state WHERE season_number = ?',
                [seasonNumber],
                (err, state) => {
                    if (err) reject(err);
                    else resolve(state);
                }
            );
        });
    }

    // ==================== CHAMPION CAREERS ====================

    async upsertChampionCareer(championName, teamName, matchStats) {
        return new Promise((resolve, reject) => {
            // First, check if champion exists
            this.db.get(
                'SELECT * FROM champion_careers WHERE champion_name = ?',
                [championName],
                (err, champion) => {
                    if (err) return reject(err);

                    if (champion) {
                        // Update existing champion
                        this.db.run(
                            `UPDATE champion_careers SET
                                team_name = ?,
                                total_matches = total_matches + 1,
                                total_wins = total_wins + ?,
                                total_losses = total_losses + ?,
                                total_kills = total_kills + ?,
                                total_deaths = total_deaths + ?,
                                total_assists = total_assists + ?,
                                total_cs = total_cs + ?,
                                total_gold = total_gold + ?,
                                chaos_witnessed = chaos_witnessed + ?,
                                last_seen = CURRENT_TIMESTAMP
                            WHERE champion_name = ?`,
                            [
                                teamName,
                                matchStats.won ? 1 : 0,
                                matchStats.won ? 0 : 1,
                                matchStats.kills,
                                matchStats.deaths,
                                matchStats.assists,
                                matchStats.cs,
                                matchStats.gold,
                                matchStats.chaosWitnessed || 0,
                                championName
                            ],
                            (err) => {
                                if (err) reject(err);
                                else resolve({ updated: true });
                            }
                        );
                    } else {
                        // Insert new champion
                        this.db.run(
                            `INSERT INTO champion_careers
                            (champion_name, team_name, total_matches, total_wins, total_losses,
                             total_kills, total_deaths, total_assists, total_cs, total_gold, chaos_witnessed)
                            VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                championName,
                                teamName,
                                matchStats.won ? 1 : 0,
                                matchStats.won ? 0 : 1,
                                matchStats.kills,
                                matchStats.deaths,
                                matchStats.assists,
                                matchStats.cs,
                                matchStats.gold,
                                matchStats.chaosWitnessed || 0
                            ],
                            (err) => {
                                if (err) reject(err);
                                else resolve({ created: true });
                            }
                        );
                    }
                }
            );
        });
    }

    async getChampionCareer(championName) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM champion_careers WHERE champion_name = ?',
                [championName],
                (err, champion) => {
                    if (err) reject(err);
                    else if (!champion) {
                        reject({ error: 'Champion not found (they may not exist yet)' });
                    } else {
                        // Corruption chance
                        if (Math.random() < CORRUPTION_CHANCE * 10) {
                            champion.scars = champion.scars || '';
                            champion.scars += '\n[DATA CORRUPTED]';
                        }
                        resolve(champion);
                    }
                }
            );
        });
    }

    async addChampionScar(championName, scar) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT scars FROM champion_careers WHERE champion_name = ?',
                [championName],
                (err, champion) => {
                    if (err || !champion) return reject(err);

                    const existingScars = champion.scars ? JSON.parse(champion.scars) : [];
                    existingScars.push({ scar, timestamp: new Date().toISOString() });

                    this.db.run(
                        'UPDATE champion_careers SET scars = ? WHERE champion_name = ?',
                        [JSON.stringify(existingScars), championName],
                        (err) => {
                            if (err) reject(err);
                            else resolve({ success: true });
                        }
                    );
                }
            );
        });
    }

    async killChampion(championName, permanent = false) {
        return new Promise((resolve, reject) => {
            const updates = permanent ?
                'death_count = death_count + 1, perma_dead = 1' :
                'death_count = death_count + 1';

            this.db.run(
                `UPDATE champion_careers SET ${updates} WHERE champion_name = ?`,
                [championName],
                (err) => {
                    if (err) reject(err);
                    else resolve({ championName, permanent });
                }
            );
        });
    }

    async getAllChampionCareers() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM champion_careers ORDER BY total_matches DESC',
                (err, champions) => {
                    if (err) reject(err);
                    else {
                        // Add corruption visuals
                        champions.forEach(champ => {
                            if (Math.random() < CORRUPTION_CHANCE * 3) {
                                champ._displayCorruption = true;
                            }
                        });
                        resolve(champions);
                    }
                }
            );
        });
    }

    // ==================== BETTING HISTORY ====================

    async recordBet(userId, seasonNumber, matchId, teamBet, amount, odds) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO betting_history
                (user_id, season_number, match_id, team_bet, amount, odds, result)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
                [userId, seasonNumber, matchId, teamBet, amount, odds],
                function(err) {
                    if (err) reject(err);
                    else resolve({ betId: this.lastID });
                }
            );
        });
    }

    async resolveBet(betId, result, payout, profit) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE betting_history SET result = ?, payout = ?, profit = ? WHERE id = ?',
                [result, payout, profit, betId],
                (err) => {
                    if (err) reject(err);
                    else resolve({ success: true });
                }
            );
        });
    }

    async getUserBettingHistory(userId, limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM betting_history
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT ?`,
                [userId, limit],
                (err, bets) => {
                    if (err) reject(err);
                    else resolve(bets);
                }
            );
        });
    }

    async getUserBettingStats(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT
                    COUNT(*) as total_bets,
                    SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
                    SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
                    SUM(amount) as total_wagered,
                    SUM(payout) as total_payout,
                    SUM(profit) as total_profit
                FROM betting_history
                WHERE user_id = ?`,
                [userId],
                (err, stats) => {
                    if (err) reject(err);
                    else resolve(stats);
                }
            );
        });
    }

    // ==================== ACHIEVEMENTS ====================

    async unlockAchievement(userId, achievementId, achievementName, seasonNumber) {
        return new Promise((resolve, reject) => {
            // Check if already unlocked
            this.db.get(
                'SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
                [userId, achievementId],
                (err, existing) => {
                    if (err) return reject(err);
                    if (existing) return resolve({ alreadyUnlocked: true });

                    this.db.run(
                        `INSERT INTO user_achievements
                        (user_id, achievement_id, achievement_name, season_number)
                        VALUES (?, ?, ?, ?)`,
                        [userId, achievementId, achievementName, seasonNumber],
                        function(err) {
                            if (err) reject(err);
                            else resolve({ unlocked: true, id: this.lastID });
                        }
                    );
                }
            );
        });
    }

    async getUserAchievements(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM user_achievements WHERE user_id = ? ORDER BY unlocked_at DESC',
                [userId],
                (err, achievements) => {
                    if (err) reject(err);
                    else {
                        // Some achievements are redacted
                        achievements.forEach(ach => {
                            if (Math.random() < CORRUPTION_CHANCE * 5) {
                                ach.achievement_name = '[REDACTED]';
                            }
                        });
                        resolve(achievements);
                    }
                }
            );
        });
    }

    // ==================== MATCH REPLAY METHODS ====================

    /**
     * Save match replay data for deterministic replay
     */
    async saveMatchReplay(replayData) {
        return new Promise((resolve, reject) => {
            const {
                matchId,
                seed,
                team1,
                team2,
                events,
                snapshots,
                finalState
            } = replayData;

            this.db.run(
                `INSERT OR REPLACE INTO match_replays
                (match_id, seed, team1_name, team2_name, events_json, snapshots_json, final_state_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    matchId,
                    seed,
                    team1,
                    team2,
                    JSON.stringify(events),
                    JSON.stringify(snapshots || []),
                    JSON.stringify(finalState || {})
                ],
                function(err) {
                    if (err) {
                        console.error('Error saving match replay:', err);
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, matchId });
                    }
                }
            );
        });
    }

    /**
     * Get match replay by match ID
     */
    async getMatchReplay(matchId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM match_replays WHERE match_id = ?',
                [matchId],
                (err, replay) => {
                    if (err) {
                        console.error('Error fetching match replay:', err);
                        reject(err);
                    } else if (!replay) {
                        resolve(null);
                    } else {
                        // Parse JSON fields
                        try {
                            replay.events = JSON.parse(replay.events_json);
                            replay.snapshots = JSON.parse(replay.snapshots_json || '[]');
                            replay.finalState = JSON.parse(replay.final_state_json || '{}');
                            delete replay.events_json;
                            delete replay.snapshots_json;
                            delete replay.final_state_json;
                            resolve(replay);
                        } catch (parseErr) {
                            console.error('Error parsing replay JSON:', parseErr);
                            reject(parseErr);
                        }
                    }
                }
            );
        });
    }

    /**
     * Get all match replays (paginated)
     */
    async getAllMatchReplays(limit = 20, offset = 0) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT id, match_id, seed, team1_name, team2_name, created_at
                 FROM match_replays
                 ORDER BY created_at DESC
                 LIMIT ? OFFSET ?`,
                [limit, offset],
                (err, replays) => {
                    if (err) {
                        console.error('Error fetching match replays:', err);
                        reject(err);
                    } else {
                        resolve(replays);
                    }
                }
            );
        });
    }

    /**
     * Get replays by team name
     */
    async getReplaysByTeam(teamName, limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT id, match_id, seed, team1_name, team2_name, created_at
                 FROM match_replays
                 WHERE team1_name = ? OR team2_name = ?
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [teamName, teamName, limit],
                (err, replays) => {
                    if (err) reject(err);
                    else resolve(replays);
                }
            );
        });
    }

    // ==================== UTILITY METHODS ====================

    close() {
        this.db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            } else {
                console.log('Database connection closed (reality status: UNCERTAIN)');
            }
        });
    }
}

module.exports = Database;
