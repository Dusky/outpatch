/**
 * Test script to verify team standings persistence
 */

const Database = require('./server/database/database');
const { teams } = require('./server/data/data.json');

async function testPersistence() {
    const db = new Database();

    // Wait for database to be ready
    await db.readyPromise;

    console.log('Database ready!');

    // Manually modify some team standings
    teams[0].wins = 5;
    teams[0].losses = 2;
    teams[1].wins = 4;
    teams[1].losses = 3;
    teams[2].wins = 3;
    teams[2].losses = 4;

    console.log('\nModified team standings:');
    teams.slice(0, 3).forEach(team => {
        console.log(`  ${team.name}: ${team.wins}W - ${team.losses}L`);
    });

    // Save standings to database
    console.log('\nSaving to database...');
    await db.saveTeamStandings(1, teams);
    console.log('Saved successfully!');

    // Now load them back
    console.log('\nLoading from database...');
    const loaded = await db.loadTeamStandings(1);

    console.log('Loaded standings:');
    loaded.slice(0, 3).forEach(record => {
        console.log(`  ${record.team_name}: ${record.wins}W - ${record.losses}L`);
    });

    // Verify they match
    const match1 = loaded.find(r => r.team_name === teams[0].name);
    if (match1 && match1.wins === 5 && match1.losses === 2) {
        console.log('\n✓ Persistence test PASSED!');
    } else {
        console.log('\n✗ Persistence test FAILED!');
    }

    process.exit(0);
}

testPersistence().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
