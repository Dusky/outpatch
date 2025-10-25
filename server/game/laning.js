
function simulateLaning(team1Champion, team2Champion, logEvent, commentary, match) {
    // Simplified CS calculation
    const csAttempt1 = Math.random() < team1Champion.mechanical_skill ? 1 : 0;
    const csAttempt2 = Math.random() < team2Champion.mechanical_skill ? 1 : 0;

    team1Champion.cs += csAttempt1;
    team2Champion.cs += csAttempt2;

    // Award gold for CS (with weather modifier and shop check)
    if (csAttempt1 && !match.chaosState?.shopClosed) {
        const csGold = match.weatherSystem ? match.weatherSystem.modifyGold(20) : 20;
        team1Champion.gold += csGold;
    }
    if (csAttempt2 && !match.chaosState?.shopClosed) {
        const csGold = match.weatherSystem ? match.weatherSystem.modifyGold(20) : 20;
        team2Champion.gold += csGold;
    }

    // Use commentary engine for farming commentary (only sometimes)
    if (csAttempt1) {
        const farmCommentary = commentary?.generateFarmCommentary(team1Champion, team1Champion.cs);
        if (farmCommentary) {
            logEvent(farmCommentary);
        }
    }
    if (csAttempt2) {
        const farmCommentary = commentary?.generateFarmCommentary(team2Champion, team2Champion.cs);
        if (farmCommentary) {
            logEvent(farmCommentary);
        }
    }

    // Simplified trade calculation
    const tradeChance = (team1Champion.mechanical_skill + team1Champion.game_sense) / 2 - (team2Champion.mechanical_skill + team2Champion.game_sense) / 2;

    if (Math.random() < Math.abs(tradeChance) * 0.5) { // 50% chance of a trade if there's a skill difference
        const winner = tradeChance > 0 ? team1Champion : team2Champion;
        const loser = tradeChance > 0 ? team2Champion : team1Champion;

        // Small chance of a kill during laning (5%)
        if (Math.random() < 0.05) {
            winner.kda.k++;
            loser.kda.d++;

            // Apply weather modifier and check shop status
            if (!match.chaosState?.shopClosed) {
                const killGold = match.weatherSystem ? match.weatherSystem.modifyGold(300) : 300;
                winner.gold += killGold;
            }

            // Use commentary engine for kill
            if (commentary) {
                logEvent(commentary.generateKillCommentary(winner, loser));
            } else {
                logEvent(`${winner.name} has slain ${loser.name} in lane!`);
            }
        } else {
            // Just a trade
            if (Math.random() < 0.2) { // Only comment on 20% of trades
                logEvent(`${winner.name} wins a trade against ${loser.name}.`);
            }
        }
    }
}

module.exports = { simulateLaning };
