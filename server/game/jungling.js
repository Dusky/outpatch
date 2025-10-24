
function simulateJungling(jungler, logEvent) {
    const decision = Math.random();

    if (decision < 0.4) { // 40% chance to farm
        logEvent(`${jungler.name} is farming jungle camps.`);
        jungler.cs += Math.floor(Math.random() * 3) + 1; // Gain 1-3 CS
    } else if (decision < 0.7) { // 30% chance to gank
        logEvent(`${jungler.name} is looking for a gank.`);
        // In a more complex simulation, this would involve checking lane states and gank success chance
    } else { // 30% chance to eye an objective
        logEvent(`${jungler.name} is eyeing an objective.`);
        // In a more complex simulation, this would involve checking objective timers and team readiness
    }
}

module.exports = { simulateJungling };
