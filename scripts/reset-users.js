/**
 * Database User Reset Utility
 *
 * This script helps reset users in the database for testing.
 * Run with: node scripts/reset-users.js [options]
 *
 * Options:
 *   --all         : Delete all users (WARNING: This is irreversible!)
 *   --username <name> : Delete specific user by username
 *   --reset-balances : Reset all user balances to 1000
 */

const Database = require('../server/database/database');
const db = new Database();

const args = process.argv.slice(2);

async function main() {
    await db.readyPromise;

    if (args.includes('--all')) {
        console.log('⚠️  WARNING: This will delete ALL users from the database!');
        console.log('Are you sure? (This cannot be undone)');
        console.log('To proceed, run this script with --all --confirm');

        if (args.includes('--confirm')) {
            await deleteAllUsers();
        } else {
            console.log('Aborting.');
        }
    } else if (args.includes('--username')) {
        const usernameIndex = args.indexOf('--username');
        const username = args[usernameIndex + 1];
        if (!username) {
            console.error('Error: --username requires a username argument');
            process.exit(1);
        }
        await deleteUser(username);
    } else if (args.includes('--reset-balances')) {
        await resetBalances();
    } else if (args.includes('--list')) {
        await listUsers();
    } else {
        console.log('Database User Reset Utility');
        console.log('');
        console.log('Usage: node scripts/reset-users.js [options]');
        console.log('');
        console.log('Options:');
        console.log('  --list                    List all users');
        console.log('  --all --confirm           Delete all users (requires --confirm)');
        console.log('  --username <name>         Delete specific user');
        console.log('  --reset-balances          Reset all balances to 1000');
        console.log('');
    }

    db.close();
}

async function listUsers() {
    return new Promise((resolve, reject) => {
        db.db.all('SELECT id, username, display_name, balance, is_admin, created_at FROM users', (err, users) => {
            if (err) {
                console.error('Error listing users:', err);
                reject(err);
            } else {
                console.log('\n📋 Current Users:\n');
                console.log('ID\tUsername\t\tDisplay Name\t\tBalance\tAdmin\tCreated');
                console.log('─'.repeat(100));
                users.forEach(user => {
                    console.log(
                        `${user.id}\t${user.username.padEnd(16)}\t${(user.display_name || '').substring(0, 20).padEnd(20)}\t${user.balance}\t${user.is_admin ? 'YES' : 'NO'}\t${user.created_at}`
                    );
                });
                console.log(`\nTotal: ${users.length} users\n`);
                resolve();
            }
        });
    });
}

async function deleteAllUsers() {
    return new Promise((resolve, reject) => {
        db.db.run('DELETE FROM users', (err) => {
            if (err) {
                console.error('❌ Error deleting users:', err);
                reject(err);
            } else {
                console.log('✅ All users deleted successfully');
                console.log('💡 Next user to register will become admin');
                resolve();
            }
        });
    });
}

async function deleteUser(username) {
    return new Promise((resolve, reject) => {
        db.db.run('DELETE FROM users WHERE username = ?', [username], function(err) {
            if (err) {
                console.error(`❌ Error deleting user ${username}:`, err);
                reject(err);
            } else if (this.changes === 0) {
                console.log(`❌ User '${username}' not found`);
                resolve();
            } else {
                console.log(`✅ User '${username}' deleted successfully`);
                resolve();
            }
        });
    });
}

async function resetBalances() {
    return new Promise((resolve, reject) => {
        db.db.run('UPDATE users SET balance = 1000', function(err) {
            if (err) {
                console.error('❌ Error resetting balances:', err);
                reject(err);
            } else {
                console.log(`✅ Reset balances for ${this.changes} users to 1000⌬`);
                resolve();
            }
        });
    });
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
