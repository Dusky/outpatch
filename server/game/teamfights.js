
function simulateTeamfight(team1Champions, team2Champions, logEvent) {
    const lane = ['Top', 'Mid', 'Bot'][Math.floor(Math.random() * 3)];
    logEvent(`CHAOS ERUPTS IN ${lane.toUpperCase()} LANE!`); // Dramatic pause message
    logEvent("A teamfight has broken out!");

    const team1Power = team1Champions.reduce((sum, champ) => sum + champ.mechanical_skill + champ.game_sense, 0);
    const team2Power = team2Champions.reduce((sum, champ) => sum + champ.mechanical_skill + champ.game_sense, 0);

    const totalPower = team1Power + team2Power;
    const team1WinChance = team1Power / totalPower;

    if (Math.random() < team1WinChance) {
        logEvent(`${team1Champions[0].name}'s team wins the teamfight!`);
        // Simulate some KDA changes
        team1Champions.forEach(c => c.kda.k += Math.random() > 0.5 ? 1 : 0);
        team2Champions.forEach(c => c.kda.d += Math.random() > 0.5 ? 1 : 0);
        if (Math.random() < 0.05) { // 5% chance for a pentakill message
            logEvent(`${team1Champions[Math.floor(Math.random() * team1Champions.length)].name} achieves a PENTAKILL!`);
        }
    } else {
        logEvent(`${team2Champions[0].name}'s team wins the teamfight!`);
        // Simulate some KDA changes
        team2Champions.forEach(c => c.kda.k += Math.random() > 0.5 ? 1 : 0);
        team1Champions.forEach(c => c.kda.d += Math.random() > 0.5 ? 1 : 0);
        if (Math.random() < 0.05) { // 5% chance for a pentakill message
            logEvent(`${team2Champions[Math.floor(Math.random() * team2Champions.length)].name} achieves a PENTAKILL!`);
        }
    }
}

module.exports = { simulateTeamfight };
