/**
 * Test Live Match Integration
 *
 * Tests that MatchAdapter works with the live game system
 */

const MatchAdapter = require('./server/simulation/MatchAdapter');

async function testLiveMatch() {
    console.log('=== Testing Live Match with New Simulation ===\n');

    // Load team data
    const teamsData = require('./server/data/data.json');
    const team1 = teamsData.teams[0];
    const team2 = teamsData.teams[1];

    console.log(`Teams: ${team1.name} vs ${team2.name}\n`);

    // Mock WebSocket server
    const mockWss = {
        clients: new Set([
            {
                readyState: 1,  // WebSocket.OPEN
                send: (msg) => {
                    // Only log key events to avoid spam
                    if (msg.includes('Match starting') ||
                        msg.includes('WINS') ||
                        msg.includes('destroyed') ||
                        msg.includes('secured') ||
                        msg.includes('Wave ')) {
                        console.log(msg);
                    }
                }
            }
        ])
    };

    // Create match adapter
    const match = new MatchAdapter(team1, team2, mockWss);

    // Set up end listener
    return new Promise((resolve) => {
        match.on('end', (winner, loser) => {
            console.log(`\n=== Match Complete ===`);
            console.log(`Winner: ${winner.name}`);
            console.log(`Loser: ${loser.name}`);
            console.log(`Total waves: ${match.wave}`);
            console.log(`Events logged: ${match.log.length}`);

            // Show final structure counts
            console.log(`\n=== Final Structures ===`);
            console.log(`${team1.name}: ${match.team1Towers} remaining`);
            console.log(`${team2.name}: ${match.team2Towers} remaining`);

            resolve();
        });

        // Start the match
        console.log('Starting match...\n');
        match.start();
    });
}

// Run test
testLiveMatch()
    .then(() => {
        console.log('\n✅ Live match integration test complete!');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Test failed:', err);
        console.error(err.stack);
        process.exit(1);
    });
