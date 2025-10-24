/**
 * Test Admin Panel Demo Endpoint
 */

const http = require('http');

const postData = JSON.stringify({
    userId: 1  // Admin user
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/simulation/demo',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            console.log('=== Admin Demo Endpoint Response ===\n');
            console.log('Success:', result.success);
            console.log('Message:', result.message);

            if (result.result) {
                console.log('\n--- Match Result ---');
                console.log('Winner:', result.result.winner);
                console.log('Waves:', result.result.waves);
                console.log('Duration:', result.result.duration);
            }

            if (result.structures) {
                console.log('\n--- Structure Stats ---');
                console.log('Team 1:');
                console.log('  Total:', result.structures.team1.total);
                console.log('  Alive:', result.structures.team1.alive);
                console.log('  Destroyed:', result.structures.team1.destroyed);
                console.log('Team 2:');
                console.log('  Total:', result.structures.team2.total);
                console.log('  Alive:', result.structures.team2.alive);
                console.log('  Destroyed:', result.structures.team2.destroyed);
            }

            if (result.eventSummary) {
                console.log('\n--- Event Summary ---');
                const sortedEvents = Object.entries(result.eventSummary)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 15);
                sortedEvents.forEach(([type, count]) => {
                    console.log(`  ${type}: ${count}`);
                });
            }

            console.log('\nTotal Events:', result.totalEvents);

            if (result.notableEvents) {
                console.log('\n--- Notable Events (first 10) ---');
                result.notableEvents.slice(0, 10).forEach(event => {
                    console.log(`  [Wave ${event.tick}] ${event.type}:`,
                        event.championName || event.objectiveName || event.structureName || '');
                });
            }

            if (result.champions) {
                console.log('\n--- Champion Stats (Top 3 by Kills) ---');
                const champArray = Array.isArray(result.champions) ? result.champions : Object.values(result.champions);
                const champsByKills = champArray
                    .sort((a, b) => (b.kda?.kills || 0) - (a.kda?.kills || 0))
                    .slice(0, 3);
                champsByKills.forEach(champ => {
                    const kda = champ.kda || { kills: 0, deaths: 0, assists: 0 };
                    console.log(`  ${champ.name}: ${kda.kills}/${kda.deaths}/${kda.assists} KDA, ${champ.gold}g, ${champ.cs} CS`);
                });
            }

        } catch (error) {
            console.error('Failed to parse response:', error);
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('Request error:', error);
});

req.write(postData);
req.end();
