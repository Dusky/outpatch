
function simulateLaning(team1Champion, team2Champion, logEvent) {
    // Simplified CS calculation
    const csAttempt1 = Math.random() < team1Champion.mechanical_skill ? 1 : 0;
    const csAttempt2 = Math.random() < team2Champion.mechanical_skill ? 1 : 0;

    team1Champion.cs += csAttempt1;
    team2Champion.cs += csAttempt2;

    if (csAttempt1) logEvent(`${team1Champion.name} (CS: ${team1Champion.cs}) last-hit a minion.`);
    if (csAttempt2) logEvent(`${team2Champion.name} (CS: ${team2Champion.cs}) last-hit a minion.`);

    // Simplified trade calculation
    const tradeChance = (team1Champion.mechanical_skill + team1Champion.game_sense) / 2 - (team2Champion.mechanical_skill + team2Champion.game_sense) / 2;

    if (Math.random() < Math.abs(tradeChance) * 0.5) { // 50% chance of a trade if there's a skill difference
        if (tradeChance > 0) {
            logEvent(`${team1Champion.name} wins a trade against ${team2Champion.name}.`);
        } else {
            logEvent(`${team2Champion.name} wins a trade against ${team1Champion.name}.`);
        }
    }
}

module.exports = { simulateLaning };
