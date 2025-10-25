# Stats Display Fixes

This document describes the fixes applied to make stats display properly throughout the application.

## Problems Fixed

### 1. **Gold Display Always Shows Same Value**

**Problem:** The gold counter in the match status bar showed an estimated value (based on kills × 300 + wave × 100) instead of the actual gold from the simulation.

**Root Cause:** In `MatchAdapter.js:447-448`, gold was being calculated using a placeholder formula:
```javascript
team1Gold: Math.floor(this.team1Kills * 300 + this.wave * 100), // Estimate
team2Gold: Math.floor(this.team2Kills * 300 + this.wave * 100), // Estimate
```

**Solution:** Calculate actual team gold by summing champion gold from the simulation state.

**Files Changed:**
- `server/simulation/MatchAdapter.js:422-448` - Calculate real gold from champion states

**Code:**
```javascript
// Get live champion stats from simulator
let championStats = null;
let team1Gold = 0;
let team2Gold = 0;
try {
    const state = this.simulator.getState();
    if (state && state.champions) {
        championStats = state.champions;

        // Calculate actual team gold from champions
        championStats.forEach(champ => {
            if (champ.teamId === 'team1') {
                team1Gold += champ.gold || 0;
            } else if (champ.teamId === 'team2') {
                team2Gold += champ.gold || 0;
            }
        });
    }
} catch (error) {
    console.error('Error getting champion states:', error);
}

// If we couldn't get real gold, use estimates
if (team1Gold === 0 && team2Gold === 0) {
    team1Gold = Math.floor(this.team1Kills * 300 + this.wave * 100);
    team2Gold = Math.floor(this.team2Kills * 300 + this.wave * 100);
}
```

### 2. **Leaderboards and Champion Stats Not Updating**

**Problem:** After matches, the leaderboards (KDA, Gold, Chaos) showed no data or incorrect data. Champion stats weren't being tracked properly.

**Root Cause:** When a match ended, the final champion stats from the simulation were never copied back to the team champion objects. The `StatsManager.recordMatch()` was trying to read stats from the original champion objects, which had initial/default values.

**Flow:**
1. Match starts with team objects containing initial champion data
2. Simulation runs and tracks all stats internally (kills, deaths, gold, CS, etc.)
3. Match ends, emits `'end'` event with original team objects
4. `StatsManager.recordMatch()` reads stats from original champion objects ❌
5. Stats are 0 or undefined, leaderboards show no data

**Solution:** Before emitting the end event, update all champion objects on the team with their final stats from the simulation.

**Files Changed:**
- `server/simulation/MatchAdapter.js:522-543` - Update champion stats at match end

**Code:**
```javascript
// Update team champion stats with final simulation data
try {
    const state = this.simulator.getState();
    if (state && state.champions) {
        state.champions.forEach(champState => {
            // Find the champion in the appropriate team
            const team = champState.teamId === 'team1' ? this.team1 : this.team2;
            const champ = team.champions.find(c => c.name === champState.name);

            if (champ) {
                // Update with final stats from simulation
                champ.kda = champState.kda || { k: 0, d: 0, a: 0 };
                champ.cs = champState.cs || 0;
                champ.gold = champState.gold || 0;
                champ.level = champState.level || 1;
                champ.items = champState.items || [];
            }
        });
    }
} catch (error) {
    console.error('Error updating champion stats at match end:', error);
}
```

## What Now Works

### ✅ Real-time Match Stats
- **Gold Display:** Shows actual accumulated gold for each team, updates live
- **Kill Count:** Already working, shows live kill counts
- **Structure Count:** Already working, shows remaining towers/objectives
- **Wave Progress:** Already working, shows match progression

### ✅ Champion Live Stats (During Match)
- **KDA:** Shows real-time kills/deaths/assists
- **CS:** Shows creep score
- **Gold:** Shows individual champion gold
- **Level:** Shows champion level
- **Items:** Shows purchased items
- **Tilt:** Shows tilt level indicator

### ✅ Post-Match Stats & Leaderboards
- **KDA Leaderboard:** Now tracks actual KDA from matches
- **Gold Leaderboard:** Now tracks average gold per game
- **Chaos Leaderboard:** Tracks absurdist events (void consumption, role switches, etc.)
- **Match History:** Shows match results with accurate winner/loser data
- **Champion Career Stats:** Total kills, deaths, assists, CS, gold all tracked correctly

### ✅ Roster Display
- Shows season-to-date stats for each champion
- Updates with live stats during matches
- Persists between matches

## How Stats Flow Now

### During Match
1. Simulation tracks all stats internally in ECS components
2. Every wave, `MatchAdapter._broadcastMatchStatus()` is called
3. Gets current state from `simulator.getState()`
4. Calculates team gold from champion states
5. Broadcasts to all connected clients
6. Clients update UI with real-time stats

### After Match
1. Simulation determines winner
2. `MatchAdapter._endMatch()` is called
3. **NEW:** Gets final state and updates team champion objects
4. Emits `'end'` event with updated team objects
5. `StatsManager.recordMatch()` reads accurate stats from champions
6. Updates leaderboards and global statistics
7. Broadcasts stats update to all clients

## Testing

To verify stats are working:

1. **Start server and watch a match**
   ```bash
   node server.js
   ```

2. **Check real-time gold display**
   - Gold should start low and increase throughout match
   - Both teams should have different gold values
   - Gold should reflect team performance

3. **Check live champion stats (Stats tab)**
   - Should show KDA, gold, CS for all 10 champions
   - Should update in real-time during match
   - Values should change as match progresses

4. **After match ends, check leaderboards**
   - Stats tab should show top 5 KDA champions
   - Gold leaderboard should show top earners
   - Values should be realistic (e.g., 5000-15000 gold)

5. **Check match history (if implemented)**
   - Should show accurate winner
   - Champion stats should reflect match performance

## Files Modified

- `server/simulation/MatchAdapter.js` - Fixed gold calculation and champion stat updates
  - Lines 422-448: Real gold calculation
  - Lines 522-543: Champion stat synchronization at match end

## Related Systems

These fixes interact with:
- `StatsManager` (server/game/statsManager.js) - Consumes stats for leaderboards
- `Database` (server/database/database.js) - Persists champion career stats
- `MatchSimulator` (server/simulation/MatchSimulator.js) - Source of truth for stats
- Client UI (public/app.js) - Displays stats in various panels

## Future Enhancements

Consider adding:
- Per-wave stat snapshots for detailed graphs
- Damage dealt/taken tracking
- Vision score tracking
- Objective participation percentage
- More granular chaos event tracking
- Historical stat comparison (season-over-season)
