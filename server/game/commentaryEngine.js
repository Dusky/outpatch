/**
 * Commentary Engine - Context-Aware Match Commentary System
 *
 * Features:
 * - Match state awareness (momentum, gold difference, kill counts)
 * - Champion personality-based commentary
 * - Event-specific templates (first blood, ace, pentakill, etc.)
 * - Rivalry and grudge system
 * - Underdog and comeback detection
 * - Record tracking
 * - Clutch play detection
 */

class CommentaryEngine {
    constructor(match) {
        this.match = match;

        // Match state tracking
        this.momentum = 0; // -100 (team2 winning) to +100 (team1 winning)
        this.goldDiff = 0; // team1 gold - team2 gold
        this.killDiff = 0; // team1 kills - team2 kills

        // Event tracking
        this.firstBloodTaken = false;
        this.killStreaks = new Map(); // champion.name -> current streak
        this.matchRecords = {
            highestKillStreak: { champion: null, value: 0 },
            highestCS: { champion: null, value: 0 },
            mostGold: { champion: null, value: 0 }
        };

        // Narrative tracking
        this.recentEvents = []; // Last 5 events for context
        this.aceCount = { team1: 0, team2: 0 };

        // Comeback tracking
        this.maxGoldDiff = 0; // Track largest gold lead for comeback detection
        this.leadTeam = null; // Which team was ahead
    }

    /**
     * Update match state based on current game state
     */
    updateMatchState(team1Champions, team2Champions) {
        // Calculate gold difference
        const team1Gold = team1Champions.reduce((sum, c) => sum + (c.gold || 0), 0);
        const team2Gold = team2Champions.reduce((sum, c) => sum + (c.gold || 0), 0);
        this.goldDiff = team1Gold - team2Gold;

        // Calculate kill difference
        const team1Kills = team1Champions.reduce((sum, c) => sum + (c.kda?.k || 0), 0);
        const team2Kills = team2Champions.reduce((sum, c) => sum + (c.kda?.k || 0), 0);
        this.killDiff = team1Kills - team2Kills;

        // Update momentum (-100 to +100)
        const goldMomentum = Math.max(-50, Math.min(50, this.goldDiff / 100));
        const killMomentum = Math.max(-50, Math.min(50, this.killDiff * 5));
        this.momentum = goldMomentum + killMomentum;

        // Track comeback potential
        if (Math.abs(this.goldDiff) > Math.abs(this.maxGoldDiff)) {
            this.maxGoldDiff = this.goldDiff;
            this.leadTeam = this.goldDiff > 0 ? 'team1' : 'team2';
        }

        // Update records
        [...team1Champions, ...team2Champions].forEach(champ => {
            if ((champ.cs || 0) > this.matchRecords.highestCS.value) {
                this.matchRecords.highestCS = { champion: champ, value: champ.cs || 0 };
            }
            if ((champ.gold || 0) > this.matchRecords.mostGold.value) {
                this.matchRecords.mostGold = { champion: champ, value: champ.gold || 0 };
            }
        });
    }

    /**
     * Generate commentary for a kill event
     */
    generateKillCommentary(killer, victim, assisters = []) {
        const context = {
            killer,
            victim,
            assisters,
            isFirstBlood: !this.firstBloodTaken,
            killerStreak: this.killStreaks.get(killer.name) || 0
        };

        // Mark first blood
        if (!this.firstBloodTaken) {
            this.firstBloodTaken = true;
            return this.getTemplate('first_blood', context);
        }

        // Update kill streaks
        this.killStreaks.set(killer.name, (this.killStreaks.get(killer.name) || 0) + 1);
        this.killStreaks.set(victim.name, 0);

        const streak = this.killStreaks.get(killer.name);

        // Check for shutdown
        const victimStreak = this.killStreaks.get(victim.name) || 0;
        if (victimStreak >= 3) {
            return this.getTemplate('shutdown', { ...context, victimStreak });
        }

        // Check for kill streak milestones
        if (streak === 3) {
            return this.getTemplate('killing_spree', context);
        } else if (streak === 5) {
            return this.getTemplate('rampage', context);
        } else if (streak === 7) {
            return this.getTemplate('unstoppable', context);
        } else if (streak >= 10) {
            return this.getTemplate('godlike', context);
        }

        // Check for grudge kills (if victim in killer's grudges)
        if (killer.grudges && killer.grudges.includes(victim.name)) {
            return this.getTemplate('grudge_kill', context);
        }

        // Check for clutch 1vX plays
        if (context.killerStreak >= 2 && Math.random() < killer.clutch_factor) {
            return this.getTemplate('clutch_play', context);
        }

        // Regular kill with personality
        return this.getTemplate('kill', context);
    }

    /**
     * Generate commentary for a teamfight
     */
    generateTeamfightCommentary(winningTeam, losingTeam, kills, lane) {
        const context = {
            winningTeam: winningTeam.name,
            losingTeam: losingTeam.name,
            kills,
            lane,
            isAce: kills >= 5,
            momentum: this.momentum
        };

        // Ace detection
        if (context.isAce) {
            const teamKey = winningTeam === this.match.team1 ? 'team1' : 'team2';
            this.aceCount[teamKey]++;
            return this.getTemplate('ace', context);
        }

        // Comeback teamfight (losing team wins fight)
        if (this.momentum < -30 && winningTeam === this.match.team1) {
            return this.getTemplate('comeback_fight', context);
        } else if (this.momentum > 30 && winningTeam === this.match.team2) {
            return this.getTemplate('comeback_fight', context);
        }

        // Stomp teamfight (winning team dominates)
        if (Math.abs(this.momentum) > 50) {
            return this.getTemplate('stomp_fight', context);
        }

        // Regular teamfight
        return this.getTemplate('teamfight', context);
    }

    /**
     * Generate commentary for wave events
     */
    generateWaveCommentary(wave) {
        // Early game (waves 1-15)
        if (wave <= 15) {
            return this.getTemplate('early_wave', { wave, momentum: this.momentum });
        }

        // Mid game (waves 16-35)
        if (wave <= 35) {
            return this.getTemplate('mid_wave', { wave, momentum: this.momentum });
        }

        // Late game (waves 36+)
        return this.getTemplate('late_wave', { wave, momentum: this.momentum });
    }

    /**
     * Generate commentary for objective capture
     */
    generateObjectiveCommentary(team, objective, wasStolen = false) {
        const context = {
            team: team.name,
            objective,
            wasStolen,
            momentum: this.momentum
        };

        if (wasStolen) {
            return this.getTemplate('objective_steal', context);
        }

        // Check if this is a comeback objective
        const teamKey = team === this.match.team1 ? 'team1' : 'team2';
        const isComebackTeam = (teamKey === 'team1' && this.momentum < -20) ||
                               (teamKey === 'team2' && this.momentum > 20);

        if (isComebackTeam) {
            return this.getTemplate('comeback_objective', context);
        }

        return this.getTemplate('objective', context);
    }

    /**
     * Generate commentary for CS/farming
     */
    generateFarmCommentary(champion, cs) {
        // Check for CS records
        if (cs > this.matchRecords.highestCS.value && cs % 50 === 0) {
            this.matchRecords.highestCS = { champion, value: cs };
            return this.getTemplate('cs_record', { champion, cs });
        }

        // Milestone celebrations
        if (cs % 100 === 0 && cs >= 100) {
            return this.getTemplate('cs_milestone', { champion, cs });
        }

        // Occasional farming commentary
        if (Math.random() < 0.05) { // 5% chance
            return this.getTemplate('farming', { champion, cs });
        }

        return null; // Don't always comment on farming
    }

    /**
     * Get template and fill with context
     */
    getTemplate(eventType, context) {
        const templates = COMMENTARY_TEMPLATES[eventType];
        if (!templates || templates.length === 0) {
            return this.fallbackCommentary(eventType, context);
        }

        // Filter templates by personality if champion is involved
        let availableTemplates = templates;
        if (context.killer?.personality) {
            const personalityTemplates = templates.filter(t =>
                !t.personality || t.personality === context.killer.personality
            );
            if (personalityTemplates.length > 0) {
                availableTemplates = personalityTemplates;
            }
        }

        // Select random template
        const template = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
        const text = typeof template === 'string' ? template : template.text;

        // Fill template with context data
        return this.fillTemplate(text, context);
    }

    /**
     * Fill template placeholders with context data
     */
    fillTemplate(template, context) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            // Handle nested properties
            if (key === 'killer' && context.killer) return context.killer.name;
            if (key === 'victim' && context.victim) return context.victim.name;
            if (key === 'champion' && context.champion) return context.champion.name;
            if (key === 'team' && context.team) return context.team;
            if (key === 'winningTeam' && context.winningTeam) return context.winningTeam;
            if (key === 'losingTeam' && context.losingTeam) return context.losingTeam;

            // Direct context values
            return context[key] !== undefined ? context[key] : match;
        });
    }

    /**
     * Fallback commentary if no template found
     */
    fallbackCommentary(eventType, context) {
        return `[${eventType}] Something happened!`;
    }

    /**
     * Check and announce if comeback is happening
     */
    checkComebackStatus() {
        // If team that was behind significantly is now ahead
        if (this.leadTeam && Math.abs(this.maxGoldDiff) > 2000) {
            const currentLeadTeam = this.goldDiff > 0 ? 'team1' : 'team2';
            if (currentLeadTeam !== this.leadTeam && Math.abs(this.goldDiff) > 500) {
                const teamName = currentLeadTeam === 'team1' ? this.match.team1.name : this.match.team2.name;
                this.leadTeam = currentLeadTeam; // Update lead team
                return this.getTemplate('comeback_complete', { team: teamName });
            }
        }
        return null;
    }
}

/**
 * Commentary Templates Database
 *
 * Each event type has an array of possible commentary strings
 * Templates can have {placeholders} that get filled with context
 * Templates can optionally specify personality requirements
 */
const COMMENTARY_TEMPLATES = {
    // Match start/end
    start: [
        "Welcome to the Void! {team1} faces off against {team2} in what promises to be absolute chaos!",
        "The crystals hum with anticipation. {team1} vs {team2} - let's see who survives!",
        "Reality fractures as {team1} and {team2} enter the arena. Buckle up!",
        "Another day, another descent into beautiful madness. {team1} vs {team2}!",
        "The Void hungers. {team1} and {team2} will feed it well today."
    ],

    end: [
        "{winner} emerges victorious! {loser} returns to the void to contemplate their choices.",
        "And that's the match! {winner} stands triumphant while {loser} licks their wounds.",
        "Victory for {winner}! The void is pleased... for now.",
        "{winner} has conquered {loser} in a display of {descriptor} skill!",
        "The crystals dim. {winner} wins. {loser}... well, there's always next time."
    ],

    // First blood
    first_blood: [
        "FIRST BLOOD! {killer} draws first blood against {victim}! The void awakens!",
        "{killer} wastes no time, claiming {victim} for the first blood!",
        "The first sacrifice! {killer} sends {victim} back to spawn!",
        "BLOOD FOR THE VOID! {killer} claims first blood from {victim}!",
        "{killer} strikes first, {victim} falls! First blood to start the chaos!",
        { text: "{killer} grins wickedly as {victim} falls - FIRST BLOOD!", personality: "Chaotic" },
        { text: "{killer} efficiently eliminates {victim}. First blood, as calculated.", personality: "Calculated" }
    ],

    // Regular kills
    kill: [
        "{killer} takes down {victim}!",
        "{victim} has been slain by {killer}!",
        "{killer} catches {victim} slipping!",
        "{victim} didn't see {killer} coming!",
        "{killer} sends {victim} to the shadow realm!",
        { text: "{killer} laughs maniacally as {victim} falls!", personality: "Chaotic" },
        { text: "{killer} showboats after deleting {victim}!", personality: "Cocky" },
        { text: "{killer} quietly eliminates {victim}.", personality: "Humble" },
        { text: "{killer} is TILTED and takes it out on {victim}!", personality: "Tilted" }
    ],

    // Kill streaks
    killing_spree: [
        "{killer} is on a KILLING SPREE! 3 kills without dying!",
        "KILLING SPREE! {killer} is heating up!",
        "{killer} has found their rhythm - 3 down!"
    ],

    rampage: [
        "RAMPAGE! {killer} is UNSTOPPABLE with 5 kills!",
        "{killer} is on a RAMPAGE! Someone stop them!",
        "FIVE KILLS! {killer} is absolutely dominating!"
    ],

    unstoppable: [
        "UNSTOPPABLE! {killer} has 7 kills and counting!",
        "{killer} IS GODLIKE! 7 kills without a single death!",
        "Who can stop {killer}?! SEVEN KILLS!"
    ],

    godlike: [
        "GODLIKE! {killer} is beyond mortal comprehension!",
        "{killer} HAS ASCENDED! {killerStreak} kills without dying!",
        "THE VOID ITSELF FEARS {killer}! Absolutely legendary!"
    ],

    // Shutdown
    shutdown: [
        "SHUTDOWN! {killer} ends {victim}'s {victimStreak} kill streak!",
        "{victim}'s reign of terror ends at the hands of {killer}!",
        "{killer} brings {victim} back down to earth! What a shutdown!"
    ],

    // Grudge/Rivalry kills
    grudge_kill: [
        "{killer} settles old scores with {victim}! The rivalry intensifies!",
        "REVENGE! {killer} strikes down their nemesis {victim}!",
        "The grudge between {killer} and {victim} claims another victim!",
        "{killer} and {victim}'s rivalry continues - another point to {killer}!"
    ],

    // Clutch plays
    clutch_play: [
        "{killer} with the CLUTCH outplay!",
        "INCREDIBLE! {killer} turns the tables!",
        "{killer}'s clutch factor pays off!",
        "Against all odds, {killer} prevails!"
    ],

    // Teamfights
    teamfight: [
        "CHAOS ERUPTS IN {lane} LANE! {winningTeam} takes the fight!",
        "Teamfight! {winningTeam} emerges victorious over {losingTeam}!",
        "{lane} lane explodes into violence! {winningTeam} wins!",
        "{winningTeam} dominates the skirmish in {lane}!"
    ],

    // Ace
    ace: [
        "ACE! {winningTeam} has wiped out the entire enemy team!",
        "COMPLETE ANNIHILATION! {losingTeam} is DELETED!",
        "The void claims all of {losingTeam}! ACE for {winningTeam}!",
        "TEAM WIPE! {winningTeam} spares no one!",
        "ACE! {losingTeam} has been erased from existence!"
    ],

    // Comeback teamfight
    comeback_fight: [
        "{winningTeam} REFUSES TO GIVE UP! What a comeback fight!",
        "AGAINST ALL ODDS! {winningTeam} wins the fight despite being behind!",
        "The underdogs bite back! {winningTeam} takes the fight!",
        "{winningTeam} shows they're not done yet! Incredible!"
    ],

    // Stomp teamfight
    stomp_fight: [
        "{winningTeam} is absolutely STOMPING! {losingTeam} can't compete!",
        "This is getting ugly! {winningTeam} dominating!",
        "{losingTeam} getting bulldozed by {winningTeam}!",
        "It's a massacre! {winningTeam} running riot!"
    ],

    // Wave commentary
    early_wave: [
        "Wave {wave} - laning phase continues...",
        "Minions clash in wave {wave}. Both teams farming up.",
        "Wave {wave}. Champions seeking any advantage they can find.",
        null // Sometimes say nothing
    ],

    mid_wave: [
        "Wave {wave} - the mid game power spike!",
        "Wave {wave}. Objectives are coming into focus.",
        "The match heats up at wave {wave}!",
        null
    ],

    late_wave: [
        "Wave {wave} - one mistake could end it all!",
        "LATE GAME! Wave {wave} - nexus towers are vulnerable!",
        "Wave {wave}. Both teams playing for keeps!",
        "This is it - wave {wave} in the late game!",
        null
    ],

    // Objectives
    objective: [
        "{team} secures the {objective}!",
        "{objective} falls to {team}!",
        "{team} claims the {objective} - huge!",
        "{team} takes control with the {objective}!"
    ],

    objective_steal: [
        "STOLEN! {team} steals the {objective}!",
        "WHAT A STEAL! {team} snatches the {objective}!",
        "{team} with the HEIST! {objective} stolen!",
        "ROBBERY! {team} steals {objective} right from under them!"
    ],

    comeback_objective: [
        "{team} desperately needs this {objective} - AND THEY GET IT!",
        "A lifeline! {team} secures the {objective}!",
        "{team} keeps their hopes alive with the {objective}!",
        "Not dead yet! {team} takes the {objective}!"
    ],

    // CS/Farming
    farming: [
        "{champion} is farming efficiently - {cs} CS already!",
        "{champion} focused on the gold grind. {cs} CS.",
        null
    ],

    cs_milestone: [
        "{champion} hits {cs} CS! That's a LOT of gold!",
        "Farming masterclass from {champion} - {cs} CS!",
        "{champion} crosses {cs} CS. Economic dominance!"
    ],

    cs_record: [
        "NEW CS RECORD! {champion} sets the bar at {cs}!",
        "{champion} is a farming MACHINE! {cs} CS is the new record!"
    ],

    // Comeback complete
    comeback_complete: [
        "THE COMEBACK IS COMPLETE! {team} has taken the lead!",
        "WHAT A TURNAROUND! {team} flips the script!",
        "FROM THE ASHES! {team} rises to take control!",
        "THEY'VE DONE IT! {team} completes the comeback!"
    ]
};

module.exports = { CommentaryEngine, COMMENTARY_TEMPLATES };
