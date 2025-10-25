
function simulateJungling(jungler, logEvent, commentary, match) {
    const decision = Math.random();

    if (decision < 0.4) { // 40% chance to farm
        const csGained = Math.floor(Math.random() * 3) + 1;
        jungler.cs += csGained;

        // Apply weather modifier and check shop status
        if (!match.chaosState?.shopClosed) {
            const jungleGold = match.weatherSystem ? match.weatherSystem.modifyGold(csGained * 20) : csGained * 20;
            jungler.gold += jungleGold;
        }

        // Use commentary engine for farming (only sometimes)
        if (commentary) {
            const farmCommentary = commentary.generateFarmCommentary(jungler, jungler.cs);
            if (farmCommentary) {
                logEvent(farmCommentary);
            }
        } else if (Math.random() < 0.1) { // 10% chance to comment if no engine
            logEvent(`${jungler.name} is farming jungle camps.`);
        }
    } else if (decision < 0.7) { // 30% chance to gank
        // Don't always announce ganks
        if (Math.random() < 0.15) { // 15% chance to mention
            logEvent(`${jungler.name} is looking for a gank opportunity...`);
        }
    } else { // 30% chance to eye an objective
        // Don't always announce objective prep
        if (Math.random() < 0.1) { // 10% chance to mention
            logEvent(`${jungler.name} is preparing for an objective.`);
        }
    }
}

module.exports = { simulateJungling };
