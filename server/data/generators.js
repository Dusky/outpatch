const abilitiesData = require('../simulation/data/abilities.json');

const championNames = [
    "Jessica Telephone",
    "Mysterious Creep (Derek)",
    "xXx_DeathLord_xXx (real name: Timothy)",
    "The Concept of Thursday",
    "Boots McLargeHuge",
    "?????? ??????",
    "Former President Crab",
    "A Single, Unassuming Pigeon",
    "The Void Accountants",
    "Basement Dwellers United",
    "The Forbidden Snacks",
    "Desktop Background Energy",
    "Mom's Credit Card FC",
    "A Literal Bag of Gold",
    "Sentient Error Message",
    "The Number 7",
    "A Mild Inconvenience"
];

const teamNames = [
    "The Void Accountants",
    "Basement Dwellers United",
    "The Forbidden Snacks",
    "Desktop Background Energy",
    "Mom's Credit Card FC",
    "The Salty Spitoons",
    "Gravity's Rainbow",
    "The Infinite Jest",
    "The Crying Breakfast Friends",
    "The Screaming Meemies"
];

const loreSnippets = [
    "Died twice in one game due to a rounding error",
    "Legally cannot be banned due to a typo in their contract",
    "Is actually three smaller champions in a trenchcoat",
    "Mains themselves in another dimension",
    "Haunted by the ghost of a particularly salty laner",
    "Believes they are in a different game entirely",
    "Constantly followed by a flock of non-aggressive seagulls",
    "Source code contains several commented-out recipes for lasagna",
    "Accidentally deleted their own lore file",
    "Is wanted in three servers for tax evasion"
];


const roles = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateChampionName() {
    return getRandomElement(championNames);
}

function generateTeamName() {
    return getRandomElement(teamNames);
}

/**
 * Get abilities suitable for a role
 * Returns {basic: [...], ultimates: [...]}
 */
function getAbilitiesForRole(role) {
    // Map ADC to bot for ability lookup
    let roleNormalized = role.toLowerCase();
    if (roleNormalized === 'adc') {
        roleNormalized = 'bot';
    }

    const basic = abilitiesData.filter(ability =>
        ability.type !== 'ultimate' &&
        ability.roles &&
        ability.roles.includes(roleNormalized)
    );

    const ultimates = abilitiesData.filter(ability =>
        ability.type === 'ultimate' &&
        ability.roles &&
        ability.roles.includes(roleNormalized)
    );

    return { basic, ultimates };
}

/**
 * Select 4 abilities for a champion (Q/W/E/R)
 */
function selectAbilities(role) {
    const { basic, ultimates } = getAbilitiesForRole(role);

    if (basic.length === 0 || ultimates.length === 0) {
        console.warn(`Warning: Not enough abilities for role ${role}`);
        return ['void_bolt', 'reality_slash', 'shadow_step', 'black_hole'];
    }

    // Shuffle basic abilities
    const shuffledBasic = [...basic].sort(() => Math.random() - 0.5);

    // Take first 3 for Q/W/E
    const q = shuffledBasic[0]?.id || 'void_bolt';
    const w = shuffledBasic[1]?.id || 'reality_slash';
    const e = shuffledBasic[2]?.id || 'shadow_step';

    // Pick random ultimate for R
    const r = getRandomElement(ultimates)?.id || 'black_hole';

    return [q, w, e, r];
}

function generateChampion(role) {
    const abilities = selectAbilities(role);

    return {
        name: generateChampionName(),
        role: role,
        lore: getRandomElement(loreSnippets),
        // Abilities (Q/W/E/R)
        abilities: abilities,
        // Visible Stats
        kda: { k: 0, d: 0, a: 0 },
        cs: 0,
        gold: 500,
        items: [],
        level: 1,
        // Hidden Stats
        mechanical_skill: Math.random(),
        game_sense: Math.random(),
        tilt_resistance: Math.random(),
        synergy_map: {},
        clutch_factor: Math.random(),
        tilt_level: 0,
        grudges: [],
        mental_boom_threshold: Math.random() * 0.5 + 0.5, // Between 0.5 and 1.0
    };
}

function generateTeam() {
    const team = {
        name: generateTeamName(),
        champions: [],
        wins: 0,
        losses: 0,
    };

    for (const role of roles) {
        team.champions.push(generateChampion(role));
    }

    return team;
}

function generateAllData() {
    const teams = [];
    for (let i = 0; i < 10; i++) {
        teams.push(generateTeam());
    }
    return { teams };
}

module.exports = { generateAllData, generateChampion, generateChampionName };
