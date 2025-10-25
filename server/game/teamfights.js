
function simulateTeamfight(team1Champions, team2Champions, logEvent, commentary) {
    const lane = ['Top', 'Mid', 'Bot'][Math.floor(Math.random() * 3)];

    const team1Power = team1Champions.reduce((sum, champ) => sum + champ.mechanical_skill + champ.game_sense, 0);
    const team2Power = team2Champions.reduce((sum, champ) => sum + champ.mechanical_skill + champ.game_sense, 0);

    const totalPower = team1Power + team2Power;
    const team1WinChance = team1Power / totalPower;

    let winningTeam, winningChampions, losingChampions;
    let kills = 0;

    if (Math.random() < team1WinChance) {
        winningTeam = { name: team1Champions[0].name.replace(/\s.*/, '') + "'s Team" }; // Simplified team name
        winningChampions = team1Champions;
        losingChampions = team2Champions;
    } else {
        winningTeam = { name: team2Champions[0].name.replace(/\s.*/, '') + "'s Team" };
        winningChampions = team2Champions;
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
        killer.gold += 300;

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
        const team1Team = { name: team1Champions[0].name.split(' ')[0] + "'s Team" };
        const team2Team = { name: team2Champions[0].name.split(' ')[0] + "'s Team" };
        const winTeam = winningChampions === team1Champions ? team1Team : team2Team;
        const loseTeam = winningChampions === team1Champions ? team2Team : team1Team;

        logEvent(commentary.generateTeamfightCommentary(winTeam, loseTeam, kills, lane));
    } else {
        logEvent(`${winningTeam.name} wins the teamfight in ${lane} lane!`);
    }

    // Check for pentakill (all 5 enemies dead)
    if (kills >= 5) {
        // Pentakill already announced via "ace" template
    }
}

module.exports = { simulateTeamfight };
