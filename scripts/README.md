# Utility Scripts

This folder contains utility scripts for managing the MOBA Blaseball Simulator.

## User Management

### Reset Users Script

`reset-users.js` - Manage users in the database

**List all users:**
```bash
node scripts/reset-users.js --list
```

**Delete a specific user:**
```bash
node scripts/reset-users.js --username <username>
```

**Reset all user balances to 1000⌬:**
```bash
node scripts/reset-users.js --reset-balances
```

**Delete all users (WARNING: Irreversible!):**
```bash
node scripts/reset-users.js --all --confirm
```

Note: The first user to register after deleting all users will automatically become an admin.

## Common Use Cases

### Testing the Betting System

1. Reset all user balances to start fresh:
   ```bash
   node scripts/reset-users.js --reset-balances
   ```

2. Clear test accounts:
   ```bash
   node scripts/reset-users.js --username testuser1
   node scripts/reset-users.js --username testuser2
   ```

3. Complete database reset (development only):
   ```bash
   node scripts/reset-users.js --all --confirm
   ```

### Checking Database State

```bash
node scripts/reset-users.js --list
```

This will show:
- User ID
- Username
- Display name
- Current balance
- Admin status
- Creation date
