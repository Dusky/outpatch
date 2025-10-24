/**
 * Test script for lane phase with item system
 *
 * Runs a 30-wave match and validates:
 * - CS accumulation
 * - Gold generation
 * - Item purchases
 * - Champion trades
 * - Lane kills
 * - Deterministic behavior
 */

const MatchSimulator = require('./server/simulation/MatchSimulator');

// Mock team data with varying skill levels
const teamAlpha = {
    name: 'Team Alpha',
    champions: [
        {
            name: 'Skilled Top',
            role: 'top',
            lore: 'A mechanically gifted top laner',
            mechanical_skill: 0.8,
            game_sense: 0.7,
            tilt_resistance: 0.8,
            clutch_factor: 0.6
        },
        {
            name: 'Average Jungle',
            role: 'jungle',
            lore: 'A solid jungler',
            mechanical_skill: 0.6,
            game_sense: 0.6,
            tilt_resistance: 0.6,
            clutch_factor: 0.6
        },
        {
            name: 'Dominant Mid',
            role: 'mid',
            lore: 'An overpowered mid laner',
            mechanical_skill: 0.9,
            game_sense: 0.85,
            tilt_resistance: 0.7,
            clutch_factor: 0.8
        },
        {
            name: 'Glass Cannon ADC',
            role: 'bot',
            lore: 'High damage, low defense',
            mechanical_skill: 0.75,
            game_sense: 0.5,
            tilt_resistance: 0.4,
            clutch_factor: 0.85
        },
        {
            name: 'Protective Support',
            role: 'support',
            lore: 'A defensive support',
            mechanical_skill: 0.5,
            game_sense: 0.8,
            tilt_resistance: 0.8,
            clutch_factor: 0.5
        }
    ]
};

const teamBeta = {
    name: 'Team Beta',
    champions: [
        {
            name: 'Weak Top',
            role: 'top',
            lore: 'An inexperienced top laner',
            mechanical_skill: 0.4,
            game_sense: 0.5,
            tilt_resistance: 0.5,
            clutch_factor: 0.4
        },
        {
            name: 'Strong Jungle',
            role: 'jungle',
            lore: 'A powerful jungler',
            mechanical_skill: 0.75,
            game_sense: 0.8,
            tilt_resistance: 0.7,
            clutch_factor: 0.7
        },
        {
            name: 'Average Mid',
            role: 'mid',
            lore: 'A balanced mid laner',
            mechanical_skill: 0.6,
            game_sense: 0.6,
            tilt_resistance: 0.6,
            clutch_factor: 0.6
        },
        {
            name: 'Tilting ADC',
            role: 'bot',
            lore: 'Easily frustrated',
            mechanical_skill: 0.7,
            game_sense: 0.6,
            tilt_resistance: 0.3,
            clutch_factor: 0.5
        },
        {
            name: 'Aggressive Support',
            role: 'support',
            lore: 'An all-in support',
            mechanical_skill: 0.6,
            game_sense: 0.6,
            tilt_resistance: 0.6,
            clutch_factor: 0.7
        }
    ]
};

async function testLanePhase() {
    console.log('=== LANE PHASE + ITEM SYSTEM TEST ===\n');

    const seed = 'lane-test-12345';
    console.log(`Seed: ${seed}\n`);

    // Run match
    const match = new MatchSimulator({
        matchId: 'lane-test',
        seed: seed,
        team1: teamAlpha,
        team2: teamBeta,
        maxWaves: 30  // 30 waves = early/mid game
    });

    await match.initialize();

    console.log('Running 30-wave simulation...\n');

    let waveCount = 0;
    while (waveCount < 30) {
        const result = match.step();
        waveCount++;
        if (result.finished) break;
    }

    const events = match.getAllEvents();
    const finalState = match.getState();

    console.log(`Match completed: ${events.length} total events\n`);

    // Analyze events by type
    const eventCounts = {};
    for (const event of events) {
        eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
    }

    console.log('=== EVENT BREAKDOWN ===\n');
    for (const [type, count] of Object.entries(eventCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${type}: ${count}`);
    }
    console.log('');

    // Champion stats
    console.log('=== FINAL CHAMPION STATS ===\n');

    const champions = finalState.champions.sort((a, b) => {
        if (a.teamId !== b.teamId) return a.teamId.localeCompare(b.teamId);
        return a.role.localeCompare(b.role);
    });

    for (const champ of champions) {
        const kda = `${champ.kda.kills}/${champ.kda.deaths}/${champ.kda.assists}`;
        console.log(`${champ.name} (${champ.teamId} ${champ.role}):`);
        console.log(`  KDA: ${kda}`);
        console.log(`  CS: ${champ.cs}`);
        console.log(`  Gold: ${champ.gold}`);
        console.log(`  Items: ${champ.items.length} (${champ.items.map(i => i.name).join(', ') || 'none'})`);
        console.log(`  Tilt: ${(champ.tilt * 100).toFixed(1)}%`);
        console.log('');
    }

    // Verify CS events
    console.log('=== CS VALIDATION ===\n');
    const csEvents = events.filter(e => e.type === 'lane.cs');
    console.log(`Total CS events: ${csEvents.length}`);

    const csByChampion = {};
    for (const event of csEvents) {
        csByChampion[event.championName] = (csByChampion[event.championName] || 0) + event.csGained;
    }

    console.log('CS by champion:');
    for (const [name, cs] of Object.entries(csByChampion).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${name}: ${cs}`);
    }
    console.log('');

    // Verify item purchases
    console.log('=== ITEM PURCHASES ===\n');
    const itemEvents = events.filter(e => e.type === 'item.purchase');
    console.log(`Total item purchases: ${itemEvents.length}`);

    const itemsByChampion = {};
    for (const event of itemEvents) {
        if (!itemsByChampion[event.championName]) {
            itemsByChampion[event.championName] = [];
        }
        itemsByChampion[event.championName].push({
            item: event.itemName,
            cost: event.cost,
            wave: event.tick
        });
    }

    for (const [name, items] of Object.entries(itemsByChampion)) {
        console.log(`${name}:`);
        for (const purchase of items) {
            console.log(`  Wave ${purchase.wave}: ${purchase.item} (${purchase.cost}g)`);
        }
    }
    console.log('');

    // Verify trades
    console.log('=== TRADES & KILLS ===\n');
    const tradeEvents = events.filter(e => e.type === 'lane.trade');
    const killEvents = events.filter(e => e.type === 'lane.kill');

    console.log(`Total trades: ${tradeEvents.length}`);
    console.log(`Total lane kills: ${killEvents.length}\n`);

    if (killEvents.length > 0) {
        console.log('Kill log:');
        for (const kill of killEvents) {
            console.log(`  Wave ${kill.tick} [${kill.lane}]: ${kill.killerName} (${kill.killerTeam}) killed ${kill.victimName} (${kill.victimTeam})`);
            console.log(`    Gold: +${kill.goldAwarded}g | Victim tilt: ${(kill.victimTilt * 100).toFixed(1)}%`);
        }
        console.log('');
    }

    // Test determinism
    console.log('=== DETERMINISM TEST ===\n');

    const match2 = new MatchSimulator({
        matchId: 'lane-test-2',
        seed: seed,  // Same seed
        team1: teamAlpha,
        team2: teamBeta,
        maxWaves: 30
    });

    await match2.initialize();

    for (let i = 0; i < 30; i++) {
        const result = match2.step();
        if (result.finished) break;
    }

    const events2 = match2.getAllEvents();
    const finalState2 = match2.getState();

    console.log(`Match 2 events: ${events2.length}`);
    console.log(`Events match: ${events.length === events2.length ? '✅ PASS' : '❌ FAIL'}`);

    // Sort champions by ID for consistent comparison
    const champs1Sorted = champions.sort((a, b) => a.id.localeCompare(b.id));
    const champs2Sorted = finalState2.champions.sort((a, b) => a.id.localeCompare(b.id));

    // Compare final CS
    const csMatch = champs1Sorted.every((c, i) => {
        const match = c.cs === champs2Sorted[i].cs;
        if (!match) console.log(`  CS mismatch: ${c.name} ${c.cs} vs ${champs2Sorted[i].cs}`);
        return match;
    });
    console.log(`CS match: ${csMatch ? '✅ PASS' : '❌ FAIL'}`);

    // Compare final gold
    const goldMatch = champs1Sorted.every((c, i) => {
        const match = c.gold === champs2Sorted[i].gold;
        if (!match) console.log(`  Gold mismatch: ${c.name} ${c.gold} vs ${champs2Sorted[i].gold}`);
        return match;
    });
    console.log(`Gold match: ${goldMatch ? '✅ PASS' : '❌ FAIL'}`);

    // Compare final items
    const itemsMatch = champs1Sorted.every((c, i) => {
        const match = c.items.length === champs2Sorted[i].items.length;
        if (!match) console.log(`  Items mismatch: ${c.name} ${c.items.length} vs ${champs2Sorted[i].items.length}`);
        return match;
    });
    console.log(`Items match: ${itemsMatch ? '✅ PASS' : '❌ FAIL'}`);

    console.log('\n=== TEST COMPLETE ===\n');

    const allPassed =
        csEvents.length > 0 &&
        itemEvents.length > 0 &&
        events.length === events2.length &&
        csMatch &&
        goldMatch &&
        itemsMatch;

    if (allPassed) {
        console.log('✅ ALL TESTS PASSED!');
        console.log('  - CS mechanics working');
        console.log('  - Gold economy working');
        console.log('  - Item purchasing working');
        console.log('  - Deterministic behavior confirmed');
    } else {
        console.log('❌ SOME TESTS FAILED - Check output above');
    }
}

// Run test
testLanePhase().catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});
