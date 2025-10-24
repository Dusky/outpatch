/**
 * Test script for deterministic simulation
 *
 * Runs the same match twice with the same seed and verifies identical results.
 */

const MatchSimulator = require('./server/simulation/MatchSimulator');

// Mock team data
const mockTeam1 = {
    name: 'Team Alpha',
    champions: [
        {
            name: 'Top Champion',
            role: 'top',
            lore: 'A powerful top laner',
            mechanical_skill: 0.7,
            game_sense: 0.6,
            tilt_resistance: 0.8,
            clutch_factor: 0.5
        },
        {
            name: 'Jungle Champion',
            role: 'jungle',
            lore: 'A sneaky jungler',
            mechanical_skill: 0.6,
            game_sense: 0.7,
            tilt_resistance: 0.6,
            clutch_factor: 0.6
        },
        {
            name: 'Mid Champion',
            role: 'mid',
            lore: 'A skilled mid laner',
            mechanical_skill: 0.8,
            game_sense: 0.7,
            tilt_resistance: 0.5,
            clutch_factor: 0.7
        },
        {
            name: 'ADC Champion',
            role: 'bot',
            lore: 'A deadly marksman',
            mechanical_skill: 0.7,
            game_sense: 0.5,
            tilt_resistance: 0.6,
            clutch_factor: 0.8
        },
        {
            name: 'Support Champion',
            role: 'support',
            lore: 'A protective support',
            mechanical_skill: 0.5,
            game_sense: 0.8,
            tilt_resistance: 0.7,
            clutch_factor: 0.5
        }
    ]
};

const mockTeam2 = {
    name: 'Team Beta',
    champions: [
        {
            name: 'Enemy Top',
            role: 'top',
            lore: 'An enemy top laner',
            mechanical_skill: 0.6,
            game_sense: 0.7,
            tilt_resistance: 0.7,
            clutch_factor: 0.6
        },
        {
            name: 'Enemy Jungle',
            role: 'jungle',
            lore: 'An enemy jungler',
            mechanical_skill: 0.7,
            game_sense: 0.6,
            tilt_resistance: 0.5,
            clutch_factor: 0.5
        },
        {
            name: 'Enemy Mid',
            role: 'mid',
            lore: 'An enemy mid laner',
            mechanical_skill: 0.7,
            game_sense: 0.8,
            tilt_resistance: 0.6,
            clutch_factor: 0.7
        },
        {
            name: 'Enemy ADC',
            role: 'bot',
            lore: 'An enemy marksman',
            mechanical_skill: 0.6,
            game_sense: 0.6,
            tilt_resistance: 0.7,
            clutch_factor: 0.7
        },
        {
            name: 'Enemy Support',
            role: 'support',
            lore: 'An enemy support',
            mechanical_skill: 0.6,
            game_sense: 0.7,
            tilt_resistance: 0.8,
            clutch_factor: 0.6
        }
    ]
};

async function testDeterministicSimulation() {
    console.log('=== DETERMINISTIC SIMULATION TEST ===\n');

    const seed = 'test-seed-12345';

    console.log(`Seed: ${seed}\n`);

    // Run first match
    console.log('Running Match 1...');
    const match1 = new MatchSimulator({
        matchId: 'test-match-1',
        seed: seed,
        team1: mockTeam1,
        team2: mockTeam2,
        maxWaves: 10  // Short test
    });

    await match1.initialize();

    const results1 = [];
    for (let i = 0; i < 10; i++) {
        const result = match1.step();
        results1.push(result);
        if (result.finished) break;
    }

    const events1 = match1.getAllEvents();
    console.log(`Match 1 completed: ${events1.length} events\n`);

    // Run second match with same seed
    console.log('Running Match 2 (same seed)...');
    const match2 = new MatchSimulator({
        matchId: 'test-match-2',
        seed: seed,  // Same seed!
        team1: mockTeam1,
        team2: mockTeam2,
        maxWaves: 10
    });

    await match2.initialize();

    const results2 = [];
    for (let i = 0; i < 10; i++) {
        const result = match2.step();
        results2.push(result);
        if (result.finished) break;
    }

    const events2 = match2.getAllEvents();
    console.log(`Match 2 completed: ${events2.length} events\n`);

    // Compare results
    console.log('=== COMPARISON ===\n');

    console.log(`Event count match: ${events1.length === events2.length ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Match 1: ${events1.length} events`);
    console.log(`  Match 2: ${events2.length} events\n`);

    // Compare event types (should be identical)
    const types1 = events1.map(e => e.type).join(',');
    const types2 = events2.map(e => e.type).join(',');

    console.log(`Event types match: ${types1 === types2 ? '✅ PASS' : '❌ FAIL'}`);

    if (types1 !== types2) {
        console.log(`  Match 1 types: ${types1}`);
        console.log(`  Match 2 types: ${types2}`);
    }

    console.log('\n=== CHAMPION STATES ===\n');

    const state1 = match1.getState();
    const state2 = match2.getState();

    console.log('Team Alpha (Team 1):');
    const team1Champs1 = state1.champions.filter(c => c.teamId === 'team1');
    const team1Champs2 = state2.champions.filter(c => c.teamId === 'team1');

    for (let i = 0; i < team1Champs1.length; i++) {
        const c1 = team1Champs1[i];
        const c2 = team1Champs2[i];

        console.log(`  ${c1.name} (${c1.role}):`);
        console.log(`    Match 1: ${c1.kda.kills}/${c1.kda.deaths}/${c1.kda.assists} KDA, ${c1.cs} CS, ${c1.gold} gold`);
        console.log(`    Match 2: ${c2.kda.kills}/${c2.kda.deaths}/${c2.kda.assists} KDA, ${c2.cs} CS, ${c2.gold} gold`);

        const statsMatch =
            c1.kda.kills === c2.kda.kills &&
            c1.kda.deaths === c2.kda.deaths &&
            c1.kda.assists === c2.kda.assists &&
            c1.cs === c2.cs &&
            c1.gold === c2.gold;

        console.log(`    Stats match: ${statsMatch ? '✅' : '❌'}\n`);
    }

    console.log('\n=== RNG TEST ===\n');

    // Test raw RNG reproduction
    const RNG = require('./server/simulation/core/RNG');

    const rng1 = new RNG('test-123');
    const rng2 = new RNG('test-123');

    const values1 = [];
    const values2 = [];

    for (let i = 0; i < 10; i++) {
        values1.push(rng1.random());
        values2.push(rng2.random());
    }

    const rngMatch = values1.every((v, i) => v === values2[i]);

    console.log(`Raw RNG match: ${rngMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  First 5 values (RNG 1): ${values1.slice(0, 5).map(v => v.toFixed(6)).join(', ')}`);
    console.log(`  First 5 values (RNG 2): ${values2.slice(0, 5).map(v => v.toFixed(6)).join(', ')}`);

    console.log('\n=== TEST COMPLETE ===\n');

    const allPassed =
        events1.length === events2.length &&
        types1 === types2 &&
        rngMatch;

    if (allPassed) {
        console.log('✅ ALL TESTS PASSED - Simulation is deterministic!');
    } else {
        console.log('❌ SOME TESTS FAILED - Check output above');
    }
}

// Run test
testDeterministicSimulation().catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});
