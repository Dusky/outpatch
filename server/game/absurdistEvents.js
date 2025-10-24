
const absurdEvents = [
    "The dragon has decided to become a pacifist",
    "Tower 2 and Tower 3 have swapped places due to a custody dispute",
    "All minions are now crabs for exactly 3 waves",
    "Champion [NAME] has been replaced by their evil twin (stats identical)",
    "The shop is closed due to personal reasons",
    "Baron Nashor has been democratically elected team captain",
    "A rogue portal has opened, sucking all jungle camps into another dimension",
    "The Nexus has declared independence and is refusing to spawn minions",
    "All champions have spontaneously developed a fear of heights",
    "The announcer has gone on strike, replaced by a kazoo band"
];

const unhingedCommentary = {
    start: [
        "Welcome, if you can call it that, to another glorious descent into madness!",
        "The fabric of reality is already fraying, just how we like it.",
        "Prepare for an experience that will question your very existence."
    ],
    wave: [
        "Jessica Telephone purchases boots. This is her 7th pair of boots.",
        "The jungler has forgotten what jungle is and is now laning",
        "Critical error: Champion has clipped through reality",
        "xXx_DeathLord_xXx is crying in fountain (tactical decision)",
        "A minion has achieved sentience and is questioning its life choices.",
        "The top laner is currently engaged in a philosophical debate with a bush.",
        "Mid lane is now a designated quiet zone. Shhh.",
        "The ADC is attempting to communicate with the enemy team using interpretive dance."
    ],
    end: [
        "And that's the game! Or is it? Who can truly say?",
        "The universe sighs in relief, or perhaps despair. It's hard to tell.",
        "Another match concludes, leaving behind only questions and existential dread."
    ]
};

function getRandomAbsurdistEvent() {
    const event = absurdEvents[Math.floor(Math.random() * absurdEvents.length)];
    // Replace [NAME] with a random champion name if present
    if (event.includes('[NAME]')) {
        // This will require access to champion names, which we don't have directly here.
        // For now, I'll just leave it as [NAME] or pick a placeholder.
        // In a more complete system, this would be passed in.
        return event.replace('[NAME]', 'A Random Champion'); // Placeholder
    }
    return event;
}

function getRandomAbsurdistCommentary(context, data = {}) {
    const comments = unhingedCommentary[context];
    if (!comments) return "";
    let comment = comments[Math.floor(Math.random() * comments.length)];

    // Simple templating for commentary
    if (data.team1) comment = comment.replace('{team1}', data.team1);
    if (data.team2) comment = comment.replace('{team2}', data.team2);
    if (data.winner) comment = comment.replace('{winner}', data.winner);
    if (data.loser) comment = comment.replace('{loser}', data.loser);
    if (data.wave) comment = comment.replace('{wave}', data.wave);

    return comment;
}

module.exports = { getRandomAbsurdistEvent, getRandomAbsurdistCommentary };
