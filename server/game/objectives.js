
function simulateObjective(team1, team2, wave, logEvent, commentary, match) {
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
        logEvent(`OBJECTIVE CONTEST: ${objectiveName} is being fought over!`);

        // Simplified objective contest: higher total skill wins
        const team1Power = team1.champions.reduce((sum, champ) => sum + champ.game_sense, 0);
        const team2Power = team2.champions.reduce((sum, champ) => sum + champ.game_sense, 0);

        const wasStolen = Math.random() < 0.1; // 10% chance for a steal
        let winningTeam, losingTeam;

        if (wasStolen) {
            // Steal: weaker team gets it
            winningTeam = team1Power < team2Power ? team1 : team2;
            losingTeam = team1Power < team2Power ? team2 : team1;
        } else {
            // Normal: stronger team gets it
            winningTeam = team1Power > team2Power ? team1 : team2;
            losingTeam = team1Power > team2Power ? team2 : team1;
        }

        // Use commentary engine for objective commentary
        if (commentary) {
            logEvent(commentary.generateObjectiveCommentary(winningTeam, objectiveName, wasStolen));
        } else {
            if (wasStolen) {
                logEvent(`${winningTeam.name} STEALS the ${objectiveName} from ${losingTeam.name}!`);
            } else {
                logEvent(`${winningTeam.name} secures ${objectiveName}!`);
            }
        }

        // Give team buffs/gold for securing objective (with weather modifier and shop check)
        if (!match.chaosState?.shopClosed) {
            winningTeam.champions.forEach(c => {
                const objectiveGold = match.weatherSystem ? match.weatherSystem.modifyGold(100) : 100;
                c.gold += objectiveGold;
            });
        }
    }
}

module.exports = { simulateObjective };
