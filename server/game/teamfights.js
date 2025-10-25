
function simulateTeamfight(team1, team2, logEvent, commentary, match) {
    const team1Champions = team1.champions;
    const team2Champions = team2.champions;
    const lane = ['Top', 'Mid', 'Bot'][Math.floor(Math.random() * 3)];

    const team1Power = team1Champions.reduce((sum, champ) => sum + champ.mechanical_skill + champ.game_sense, 0);
    const team2Power = team2Champions.reduce((sum, champ) => sum + champ.mechanical_skill + champ.game_sense, 0);

    const totalPower = team1Power + team2Power;
    const team1WinChance = team1Power / totalPower;

    let winningTeam, winningChampions, losingChampions, losingTeam;
    let kills = 0;

    if (Math.random() < team1WinChance) {
        winningTeam = team1;
        winningChampions = team1Champions;
        losingTeam = team2;
        losingChampions = team2Champions;
    } else {
        winningTeam = team2;
        winningChampions = team2Champions;
        losingTeam = team1;
        losingChampions = team1Champions;
    }

    // Simulate kills in teamfight (1-5 kills)
    kills = Math.floor(Math.random() * 5) + 1;

    // Distribute kills and deaths
    for (let i = 0; i < kills && i < losingChampions.length; i++) {
        const killer = winningChampions[Math.floor(Math.random() * winningChampions.length)];
        const victim = losingChampions[i];

        killer.kda.k++;
        victim.kda.d++;

        // Apply weather modifier and check shop status
        if (!match.chaosState?.shopClosed) {
            const killGold = match.weatherSystem ? match.weatherSystem.modifyGold(300) : 300;
            killer.gold += killGold;
        }

        // Add assists to other team members
        winningChampions.forEach(c => {
            if (c !== killer && Math.random() < 0.6) {
                c.kda.a++;
            }
        });

        // Generate kill commentary during teamfight
        if (i === 0 || Math.random() < 0.3) { // First kill or 30% of subsequent kills
            if (commentary) {
                logEvent(commentary.generateKillCommentary(killer, victim));
            }
        }
    }

    // Use commentary engine for teamfight outcome
    if (commentary) {
        logEvent(commentary.generateTeamfightCommentary(winningTeam, losingTeam, kills, lane));
    } else {
        logEvent(`${winningTeam.name} wins the teamfight in ${lane} lane!`);
    }

    // Return winning team and kills for tower damage logic
    return { winningTeam, losingTeam, kills };
}

module.exports = { simulateTeamfight };
