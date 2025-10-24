
const { teams } = require('../data/data.json');

const patchNotes = [
    "Minions now gain consciousness at 20 minutes",
    "Fixed bug where towers had feelings",
    "Jungle camps have 5% chance to jungle you",
    "Wards now judge your placement choices",
    "Baron Nashor now requires a valid fishing license to be engaged",
    "The river has been reclassified as a 'sentient puddle'",
    "Champion abilities now have a 0.1% chance to summon a rubber duck",
    "Recall animation replaced with a dramatic interpretive dance",
    "All in-game currency is now denominated in 'schmeckles'",
    "The shopkeeper now offers unsolicited life advice",
    "Fixed an exploit where players could escape reality",
    "New feature: Emotional support poros now follow champions",
    "Removed the 'win' condition, now only 'exist' condition remains",
    "The Nexus has developed a fear of commitment",
    "Minions now occasionally sing opera",
    "Champion hitboxes are now determined by their astrological sign",
    "The fog of war has been replaced with a light mist of existential dread",
    "All chat messages are now automatically translated into ancient Aramaic",
    "Players can now spontaneously combust if they don't buy enough wards",
    "The game client now occasionally asks if you're happy with your life choices"
];

const teamDrama = [
    "[CHAMPION] caught practicing with enemy team's mouse pad",
    "[CHAMPION] is actually two kids in a trenchcoat",
    "[TEAM]'s jungler missing for 3 days, still shows up for matches",
    "[CHAMPION] refuses to leave fountain until someone acknowledges their birthday",
    "[CHAMPION] seen arguing with a minion over farming rights",
    "Rumors: [TEAM]'s support is secretly a highly advanced AI trying to understand human emotions",
    "[CHAMPION] claims their keyboard is haunted by a former pro player",
    "[TEAM]'s coach seen consulting a crystal ball during strategy sessions",
    "[CHAMPION] has legally changed their name to 'Not AFK'",
    "[TEAM]'s ADC insists on only buying boots, regardless of situation",
    "[CHAMPION] has started a side hustle selling 'blessed' wards",
    "[TEAM]'s mid-laner communicates exclusively through interpretive dance moves",
    "[CHAMPION] believes the enemy team is a figment of their imagination",
    "[TEAM]'s top-laner has declared war on all bushes",
    "[CHAMPION] found trying to teach a jungle monster to play chess",
    "[TEAM]'s entire roster has collectively forgotten how to last-hit",
    "[CHAMPION] is convinced the Nexus is whispering secrets to them",
    "[TEAM]'s latest strategy involves confusing the enemy with interpretive silence",
    "[CHAMPION] has developed an irrational fear of blue buffs",
    "[TEAM]'s manager is a sentient tumbleweed with a surprisingly good win rate"
];

const statisticalAnomalies = [
    "[CHAMPION] has died to minions [X] times this season (record)",
    "Tower 2 has more kills than [TEAM]'s ADC",
    "[CHAMPION]'s KDA has formed a prime number 17 games in a row",
    "Scuttle crab has higher vision score than [TEAM]'s support",
    "[CHAMPION] has spent 90% of game time in the enemy fountain",
    "The average ping in [TEAM]'s games is now measured in light-years",
    "[CHAMPION] has achieved a negative CS score for 5 consecutive games",
    "[TEAM]'s win rate is inversely proportional to the phase of the moon",
    "[CHAMPION] has more assists on enemy champions than their own team",
    "The number of times [CHAMPION] has accidentally bought a second jungle item is statistically significant",
    "[TEAM]'s average game duration is now shorter than the loading screen",
    "[CHAMPION] has a 100% win rate when playing with their eyes closed",
    "The amount of gold [TEAM] has spent on wards could fund a small nation",
    "[CHAMPION] has successfully ganked their own jungle camp 3 times",
    "The total damage dealt by [TEAM]'s carries is less than a single minion auto-attack",
    "[CHAMPION]'s ultimate ability has a higher cooldown than the game itself",
    "[TEAM]'s support has accidentally sold their starting item 12 times",
    "The number of times [CHAMPION] has walked into a clearly visible trap is a new league record",
    "[TEAM]'s top laner has a higher KDA in other games than in this one",
    "[CHAMPION] has been reported for 'excessive politeness'"
];

const sponsorMessages = [
    "This killing spree brought to you by Gerald's Keyboard Repair",
    "Today's throws sponsored by The Concept of Regret",
    "Baron buff provided by an anonymous crab",
    "The existential dread in your lane is proudly sponsored by 'Void & Sons Mortuary'",
    "Feeling tilted? Try 'Serenity Now' brand anti-tilt potions!",
    "This tower dive was made possible by 'Gravity's Embrace' insurance",
    "For all your questionable life choices, choose 'Regret-a-Cola'",
    "Your inevitable defeat is brought to you by 'Destiny's Doorstep Delivery'",
    "Need to disappear? 'Shadow Realm Travel Agency' has you covered!",
    "This perfectly executed gank is fueled by 'Ambush Energy Drinks'",
    "The silence in your comms is sponsored by 'Awkward Moments Inc.'",
    "For all your broken dreams, visit 'Shattered Hopes Emporium'",
    "This unexpected comeback is brought to you by 'Plot Twist Pharmaceuticals'",
    "Your tears are collected and bottled by 'Salty Springs Water Co.'",
    "The sudden urge to surrender is a product of 'Giving Up & Go Home Solutions'",
    "This perfectly timed ultimate is brought to you by 'Synchronicity Watches'",
    "For all your rage-quitting needs, try 'Exit Strategy Gaming Chairs'",
    "The lingering feeling of inadequacy is a service of 'Self-Doubt & Co.'",
    "This game-winning play was powered by 'Pure Unadulterated Luck'",
    "Your opponent's questionable build is sponsored by 'Experimental Itemization Labs'"
];

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateNewsItem(allTeams) {
    const categories = ['patchNotes', 'teamDrama', 'statisticalAnomalies', 'sponsorMessages'];
    const category = getRandomElement(categories);

    let item;
    switch (category) {
        case 'patchNotes':
            item = getRandomElement(patchNotes);
            break;
        case 'teamDrama':
            item = getRandomElement(teamDrama);
            item = replacePlaceholders(item, allTeams);
            break;
        case 'statisticalAnomalies':
            item = getRandomElement(statisticalAnomalies);
            item = replacePlaceholders(item, allTeams);
            // Replace [X] with a random number
            item = item.replace('[X]', Math.floor(Math.random() * 50) + 1);
            break;
        case 'sponsorMessages':
            item = getRandomElement(sponsorMessages);
            item = replacePlaceholders(item, allTeams);
            break;
    }
    return item;
}

function replacePlaceholders(text, allTeams) {
    // Replace [CHAMPION] with a random champion name from any team
    if (text.includes('[CHAMPION]')) {
        const randomTeam = getRandomElement(allTeams);
        const randomChampion = getRandomElement(randomTeam.champions);
        text = text.replace('[CHAMPION]', randomChampion.name);
    }
    // Replace [TEAM] with a random team name
    if (text.includes('[TEAM]')) {
        const randomTeam = getRandomElement(allTeams);
        text = text.replace('[TEAM]', randomTeam.name);
    }
    return text;
}

module.exports = { generateNewsItem };
