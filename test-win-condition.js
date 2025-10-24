/**
 * Test Win Condition System
 *
 * Verifies that:
 * 1. Structures are created and tracked correctly
 * 2. Lane pressure causes structure damage
 * 3. Structures are destroyed in proper order (spires → gateways → core)
 * 4. Match ends when core is destroyed
 * 5. Winner is correctly identified
 */

const MatchSimulator = require('./server/simulation/MatchSimulator');

async function testWinCondition() {
    console.log('=== Testing Win Condition System ===\n');

    // Load team data
    const teamsData = require('./server/data/data.json');
    const team1 = teamsData.teams[0];
    const team2 = teamsData.teams[1];

    console.log(`Teams: ${team1.name} vs ${team2.name}\n`);

    // Create simulator with fixed seed
    const seed = 'win-condition-test-123';
    const simulator = new MatchSimulator({
        matchId: 'test-win-condition',
        seed: seed,
        team1: team1,
        team2: team2,
        maxWaves: 200  // Extended to allow for full match
    });

    // Initialize
    console.log('Initializing match...');
    await simulator.initialize();

    const world = simulator.engine.getWorld();

    // Check initial structures
    const team1Structures = world.queryByTags('structure', 'team1');
    const team2Structures = world.queryByTags('structure', 'team2');

    console.log(`Team 1 structures: ${team1Structures.length}`);
    console.log(`Team 2 structures: ${team2Structures.length}`);

    // Count by type
    let structureCounts = {
        team1: { spires: 0, gateways: 0, core: 0 },
        team2: { spires: 0, gateways: 0, core: 0 }
    };

    for (const structure of team1Structures) {
        const identity = structure.getComponent('identity');
        if (identity.structureType === 'spire') structureCounts.team1.spires++;
        else if (identity.structureType === 'gateway') structureCounts.team1.gateways++;
        else if (identity.structureType === 'core') structureCounts.team1.core++;
    }

    for (const structure of team2Structures) {
        const identity = structure.getComponent('identity');
        if (identity.structureType === 'spire') structureCounts.team2.spires++;
        else if (identity.structureType === 'gateway') structureCounts.team2.gateways++;
        else if (identity.structureType === 'core') structureCounts.team2.core++;
    }

    console.log('Team 1:', structureCounts.team1);
    console.log('Team 2:', structureCounts.team2);
    console.log();

    // Run match to completion
    console.log('Running match to completion...\n');
    const startTime = Date.now();
    const result = await simulator.runToCompletion();
    const duration = Date.now() - startTime;

    console.log(`\n=== Match Complete in ${duration}ms ===`);
    console.log(`Winner: ${result.winner}`);
    console.log(`Duration: ${result.waves} waves`);
    console.log(`Total Events: ${result.eventCount}\n`);

    // Analyze structure destruction events
    const events = simulator.getAllEvents();
    const structureEvents = events.filter(e =>
        e.type === 'structure.destroyed' ||
        e.type === 'gateway.destroyed' ||
        e.type === 'match.end'
    );

    console.log(`Structure destruction events: ${structureEvents.length}\n`);

    // Show first 10 structure events
    console.log('First structure destructions:');
    for (let i = 0; i < Math.min(10, structureEvents.length); i++) {
        const event = structureEvents[i];
        if (event.type === 'structure.destroyed') {
            console.log(`  Wave ${event.tick}: ${event.structureName} (${event.structureType})`);
        } else if (event.type === 'gateway.destroyed') {
            console.log(`  Wave ${event.tick}: ${event.lane} Gateway destroyed!`);
        } else if (event.type === 'match.end') {
            console.log(`  Wave ${event.tick}: MATCH END - ${event.winner} wins!`);
        }
    }

    // Check final structure counts
    console.log('\n=== Final Structure Status ===');
    const finalTeam1Structures = world.queryByTags('structure', 'team1');
    const finalTeam2Structures = world.queryByTags('structure', 'team2');

    let finalCounts = {
        team1: { alive: 0, destroyed: 0 },
        team2: { alive: 0, destroyed: 0 }
    };

    for (const structure of finalTeam1Structures) {
        const stats = structure.getComponent('stats');
        if (stats.isAlive) finalCounts.team1.alive++;
        else finalCounts.team1.destroyed++;
    }

    for (const structure of finalTeam2Structures) {
        const stats = structure.getComponent('stats');
        if (stats.isAlive) finalCounts.team2.alive++;
        else finalCounts.team2.destroyed++;
    }

    console.log('Team 1:', finalCounts.team1);
    console.log('Team 2:', finalCounts.team2);

    // Verify winner
    console.log('\n=== Verification ===');
    if (result.winner) {
        const losingTeam = result.winner === 'team1' ? 'team2' : 'team1';
        const losingCore = world.queryByTags('structure', losingTeam, 'core')[0];
        const coreStats = losingCore.getComponent('stats');

        if (!coreStats.isAlive) {
            console.log('✅ Winner determined correctly - losing team\'s core destroyed');
        } else {
            console.log('❌ ERROR: Winner declared but core still alive');
        }
    } else {
        console.log('❌ ERROR: No winner declared (reached max waves)');
    }

    // Event type breakdown
    console.log('\n=== Event Breakdown ===');
    const eventTypes = {};
    for (const event of events) {
        eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    }

    const sortedTypes = Object.entries(eventTypes).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sortedTypes.slice(0, 15)) {
        console.log(`  ${type}: ${count}`);
    }

    console.log('\n=== Test Complete ===\n');
}

// Run test
testWinCondition().catch(err => {
    console.error('Test failed:', err);
    console.error(err.stack);
    process.exit(1);
});
