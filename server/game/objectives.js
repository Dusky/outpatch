
function simulateObjective(team1, team2, wave, logEvent) {
    let objectiveContested = false;
    let objectiveName = "";

    // Dragon spawns around wave 10 (5 minutes in-game, 30s/wave * 10 waves = 300s = 5min)
    if (wave === 10 || wave === 20 || wave === 30 || wave === 40) {
        objectiveContested = true;
        objectiveName = "Dragon";
    }

    // Baron spawns around wave 40 (20 minutes in-game)
    if (wave === 40 || wave === 50) {
        objectiveContested = true;
        objectiveName = "Baron Nashor";
    }

    if (objectiveContested) {
        logEvent(`OBJECTIVE CONTEST: ${objectiveName} is being fought over!`); // Dramatic pause message

        // Simplified objective contest: higher total skill wins
        const team1Power = team1.champions.reduce((sum, champ) => sum + champ.game_sense, 0);
        const team2Power = team2.champions.reduce((sum, champ) => sum + champ.game_sense, 0);

        if (Math.random() < 0.1) { // 10% chance for a steal
            if (team1Power > team2Power) {
                logEvent(`${team2.name} STEALS the ${objectiveName} from ${team1.name}!`); // Steal message
            } else {
                logEvent(`${team1.name} STEALS the ${objectiveName} from ${team2.name}!`); // Steal message
            }
        } else if (team1Power > team2Power) {
            logEvent(`${team1.name} secures ${objectiveName}!`);
        } else {
            logEvent(`${team2.name} secures ${objectiveName}!`);
        }
    }
}

module.exports = { simulateObjective };
