/**
 * Schedule Generator - Never The Same Twice
 *
 * Creates multi-round robin schedules with:
 * - Fair distribution of matchups
 * - Rivalry tracking
 * - Special event weeks
 * - Varied spacing and timing
 * - Narrative coherence
 */

/**
 * Generate a multi-round robin schedule
 * @param {Array} teams - Array of team objects
 * @param {number} rounds - Number of times each team plays every other team (2-3)
 * @returns {Array} - Array of matchup objects with metadata
 */
function generateMultiRoundRobin(teams, rounds = 2) {
    const schedule = [];
    const matchupHistory = {}; // Track how many times teams have played

    // Helper to create matchup key
    const getMatchupKey = (team1, team2) => {
        const sorted = [team1.name, team2.name].sort();
        return `${sorted[0]}_vs_${sorted[1]}`;
    };

    // Generate all possible matchups for each round
    for (let round = 1; round <= rounds; round++) {
        const roundMatches = [];

        // Round-robin algorithm
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                const team1 = teams[i];
                const team2 = teams[j];
                const matchupKey = getMatchupKey(team1, team2);

                // Track matchup count
                matchupHistory[matchupKey] = (matchupHistory[matchupKey] || 0) + 1;

                roundMatches.push({
                    team1,
                    team2,
                    round,
                    matchupCount: matchupHistory[matchupKey],
                    matchupKey,
                    week: 0, // Will be assigned during distribution
                    day: 0,
                    narrative: null // Will be populated with storylines
                });
            }
        }

        schedule.push(...roundMatches);
    }

    // Shuffle matches to avoid predictable patterns
    // But keep some structure for narrative coherence
    const shuffled = shuffle Schedule(schedule);

    // Assign week and day numbers
    assignScheduleTiming(shuffled);

    // Add special event markers
    markSpecialWeeks(shuffled);

    // Generate narratives for key matchups
    addMatchupNarratives(shuffled, matchupHistory);

    return shuffled;
}

/**
 * Shuffle schedule with some constraints for variety
 */
function shuffleSchedule(schedule) {
    const shuffled = [...schedule];

    // Fisher-Yates shuffle with constraints
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        // Don't put the same matchup too close together
        const match1 = shuffled[i];
        const match2 = shuffled[j];

        // If this is a rematch, try to space it out
        if (match1.matchupKey === match2.matchupKey) {
            // Skip swap if too close (within 5 positions)
            if (Math.abs(i - j) < 5) {
                continue;
            }
        }

        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

/**
 * Assign week and day numbers to matches
 */
function assignScheduleTiming(schedule) {
    const matchesPerWeek = 6; // ~3 game days per week, 2 matches per day
    let currentWeek = 1;
    let matchesThisWeek = 0;
    let dayInWeek = 1;
    let matchesThisDay = 0;

    for (let i = 0; i < schedule.length; i++) {
        schedule[i].week = currentWeek;
        schedule[i].day = dayInWeek;

        matchesThisDay++;
        matchesThisWeek++;

        // 2 matches per day
        if (matchesThisDay >= 2) {
            dayInWeek++;
            matchesThisDay = 0;
        }

        // Move to next week
        if (matchesThisWeek >= matchesPerWeek) {
            currentWeek++;
            dayInWeek = 1;
            matchesThisWeek = 0;
        }
    }
}

/**
 * Mark special themed weeks
 */
function markSpecialWeeks(schedule) {
    if (schedule.length === 0) return;

    const totalWeeks = Math.max(...schedule.map(m => m.week));

    // Randomly select weeks for special events
    const rivalryWeek = Math.floor(Math.random() * (totalWeeks - 2)) + 2;
    const chaosWeek = Math.floor(Math.random() * (totalWeeks - rivalryWeek - 1)) + rivalryWeek + 1;

    schedule.forEach(match => {
        if (match.week === rivalryWeek) {
            match.specialEvent = 'RIVALRY_WEEK';
            match.eventDescription = '⚔️ Rivalry Week: Old grudges resurface';
        } else if (match.week === chaosWeek) {
            match.specialEvent = 'CHAOS_WEEK';
            match.eventDescription = '🌀 Chaos Week: Expect the unexpected';
        } else if (match.week === 1) {
            match.specialEvent = 'SEASON_OPENER';
            match.eventDescription = '🎬 Season Opener: Fresh start, new hopes';
        } else if (match.week === totalWeeks) {
            match.specialEvent = 'SEASON_FINALE';
            match.eventDescription = '🏁 Season Finale: Playoff implications on the line';
        }
    });
}

/**
 * Add narrative context to matchups
 */
function addMatchupNarratives(schedule, matchupHistory) {
    schedule.forEach((match, index) => {
        const narratives = [];

        // First meeting
        if (match.matchupCount === 1) {
            narratives.push(generateFirstMeetingNarrative(match.team1, match.team2));
        }

        // Rematch
        if (match.matchupCount > 1) {
            narratives.push(generateRematchNarrative(match.team1, match.team2, match.matchupCount));
        }

        // Late season drama
        if (match.week >= Math.max(...schedule.map(m => m.week)) - 2) {
            narratives.push('Playoff implications hang heavy in the air');
        }

        // Underdog story
        const team1Strength = calculateTeamStrength(match.team1);
        const team2Strength = calculateTeamStrength(match.team2);
        const strengthDiff = Math.abs(team1Strength - team2Strength);

        if (strengthDiff > 0.3) {
            const underdog = team1Strength < team2Strength ? match.team1.name : match.team2.name;
            narratives.push(`${underdog} looking to upset the odds`);
        }

        // Special event narrative
        if (match.specialEvent) {
            narratives.push(match.eventDescription);
        }

        // Add some chaos
        if (Math.random() < 0.1) {
            narratives.push(getRandomChaosNarrative());
        }

        match.narrative = narratives.filter(n => n).join('. ') || null;
    });
}

function generateFirstMeetingNarrative(team1, team2) {
    const templates = [
        `First meeting between ${team1.name} and ${team2.name} - fresh rivalry brewing`,
        `${team1.name} and ${team2.name} clash for the first time this season`,
        `First blood: ${team1.name} vs ${team2.name}`,
        `The inaugural battle between ${team1.name} and ${team2.name} begins`,
        `First encounter: Will ${team1.name} or ${team2.name} draw first blood?`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
}

function generateRematchNarrative(team1, team2, count) {
    const templates = [
        `REMATCH ${count}: ${team1.name} and ${team2.name} know each other well`,
        `Round ${count} between these rivals`,
        `The saga continues: ${team1.name} vs ${team2.name} (${count}x)`,
        `They meet again - ${team1.name} and ${team2.name} have unfinished business`,
        `Match ${count} in this developing rivalry`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
}

function getRandomChaosNarrative() {
    const narratives = [
        'The void watches with interest',
        'Reality feels thin around this matchup',
        'The Committee has marked this game',
        'Something feels... different about this one',
        'Chaos stirs in the shadows',
        'The champions sense something is coming',
        'This game will be remembered',
        'History is about to be made (or unmade)',
        'The fabric of reality trembles'
    ];
    return narratives[Math.floor(Math.random() * narratives.length)];
}

function calculateTeamStrength(team) {
    if (!team.champions || team.champions.length === 0) return 0.5;

    return team.champions.reduce((sum, c) => {
        const mechanicalSkill = c.mechanical_skill || 0.5;
        const gameSense = c.game_sense || 0.5;
        return sum + (mechanicalSkill + gameSense) / 2;
    }, 0) / team.champions.length;
}

/**
 * Generate a single game day's matchups
 * Used for quick match generation without full season
 */
function generateGameDay(teams, matchesPerDay = 2) {
    const matchups = [];
    const usedTeams = new Set();

    // Shuffle teams to randomize matchups
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);

    for (let i = 0; i < matchesPerDay && i * 2 + 1 < shuffledTeams.length; i++) {
        const team1 = shuffledTeams[i * 2];
        const team2 = shuffledTeams[i * 2 + 1];

        if (!usedTeams.has(team1.name) && !usedTeams.has(team2.name)) {
            matchups.push({
                team1,
                team2,
                round: 1,
                matchupCount: 1,
                week: 0,
                day: 0,
                narrative: generateFirstMeetingNarrative(team1, team2)
            });

            usedTeams.add(team1.name);
            usedTeams.add(team2.name);
        }
    }

    return matchups;
}

/**
 * Get schedule summary for display
 */
function getScheduleSummary(schedule) {
    if (!schedule || schedule.length === 0) {
        return {
            totalMatches: 0,
            weeks: 0,
            rounds: 0
        };
    }

    const rounds = Math.max(...schedule.map(m => m.round || 1));
    const weeks = Math.max(...schedule.map(m => m.week || 0));

    const specialEvents = schedule.filter(m => m.specialEvent).map(m => ({
        week: m.week,
        event: m.specialEvent,
        description: m.eventDescription
    }));

    return {
        totalMatches: schedule.length,
        weeks,
        rounds,
        matchesPerWeek: Math.ceil(schedule.length / weeks),
        specialEvents
    };
}

/**
 * Filter schedule by week
 */
function getWeekSchedule(schedule, weekNumber) {
    return schedule.filter(m => m.week === weekNumber);
}

/**
 * Get upcoming matches (next N matches)
 */
function getUpcomingMatches(schedule, completedMatchIds, count = 5) {
    const upcoming = schedule.filter(m =>
        !completedMatchIds.includes(m.matchupKey)
    );
    return upcoming.slice(0, count);
}

module.exports = {
    generateMultiRoundRobin,
    generateGameDay,
    getScheduleSummary,
    getWeekSchedule,
    getUpcomingMatches
};
