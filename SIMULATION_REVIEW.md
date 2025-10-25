# Simulation Code Review - Issues Found

**⚠️ IMPORTANT CONTEXT:**
This review primarily covers **legacy Match.js**. The project currently uses the **ECS engine** (`useNewSimulation = true` in game.js), which already has many "missing" features:

✅ **Active in ECS Engine:**
- **LevelingSystem** - Champions level 1-18, gain stats per level
- **ItemSystem** - Auto-purchases items following role-specific builds
- **AbilitySystem** - Abilities cast in lane (30%) and fights (90%), with cooldowns/mana
- **WeatherSystem** - Fully integrated with effects
- **ChaosSystem** - Chaos events with gameplay effects
- **TiltSystem** - Tilt affects champion performance

The bugs/fixes below apply to the legacy system (used when `useNewSimulation = false`).

---

## CRITICAL BUGS (Legacy Match.js - NOT CURRENTLY USED)

### 1. Jungler Doing Double Duty (match.js:103-112)
**File:** `server/game/match.js`
**Lines:** 103-112
**Issue:** Junglers are included in the `roles` array for laning simulation, so they participate in laning matchups AND jungle farming.

```javascript
// BUG: Jungle is in the roles array
const roles = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
roles.forEach(role => {
    // This makes junglers lane against each other
    simulateLaning(team1Champ, team2Champ, this.logEvent.bind(this), this.commentary);
});
// Then junglers ALSO do jungling
simulateJungling(this.team1Lanes['Jungle'], this.logEvent.bind(this), this.commentary);
```

**Fix:** Remove 'Jungle' from the laning roles array.

---

### 2. Tower Damage Not Connected to Gameplay (match.js:74-83)
**File:** `server/game/match.js`
**Lines:** 74-83
**Issue:** Towers fall randomly with no connection to teamfight victories, objectives, or match state.

```javascript
// Towers just randomly fall 10% chance
if (this.wave > 20 && Math.random() < 0.1) {
    if (Math.random() > 0.5 && this.team1Towers > 0) {
        this.team1Towers--;
```

**Fix:** Tower damage should be tied to teamfight victories or objective captures.

---

### 3. Weather Modifiers Not Applied (laning.js, teamfights.js, etc.)
**File:** Multiple simulation files
**Issue:** WeatherSystem has `modifyDamage()` and `modifyGold()` methods, but they're never called in combat simulation.

**Missing integrations:**
- laning.js line 35: `winner.gold += 300;` should use `match.weatherSystem.modifyGold(300)`
- teamfights.js line 34: `killer.gold += 300;` should use weather modifier
- objectives.js line 51: `c.gold += 100;` should use weather modifier
- jungling.js line 8: `jungler.gold += csGained * 20;` should use weather modifier

**Fix:** All gold gains should call `match.weatherSystem.modifyGold(amount)`.

---

### 4. Chaos "Shop Closed" Event Not Enforced (chaosEvents.js:133-152)
**File:** `server/game/chaosEvents.js`
**Lines:** 133-152
**Issue:** The "shop_closed" chaos event sets a flag, but nothing in the simulation checks this flag.

```javascript
match.chaosState.shopClosed = { duration: 3 };
```

But no file checks `if (match.chaosState.shopClosed)` before adding gold.

**Fix:** All gold-gaining code should check if shop is closed.

---

## MISSING IMPLEMENTATIONS

### 5. No Item Purchasing System
**Issue:** Champions gain gold but never buy items. The `items` array on champions is always empty.

**Missing:**
- Item shop logic
- Auto-buy system
- Build path logic (champions have build preferences but don't use them)

**Current state:** Champions accumulate gold but never spend it.

---

### 6. ~~No Champion Leveling~~ ✅ IMPLEMENTED (ECS Engine)
**Status:** LEVELING EXISTS in ECS engine (`server/simulation/systems/LevelingSystem.js`)

**Implemented features:**
- XP gain: CS (50), Kills (300), Assists (150), Objectives (200)
- Level cap: 18
- Stats per level: +85 HP, +3 AD, +5 AP, +3.5 Armor, +1.25 MR
- Ability unlocks at levels 1, 3, 5, 6

**Current state:** ✅ Active in ECS engine (feature flag `useNewSimulation = true`)

---

### 7. Champion Abilities Not Used in Combat
**Issue:** Champions have abilities defined (Q/W/E/R) but they're never cast during simulation.

**Files with missing ability usage:**
- laning.js: No ability trading
- teamfights.js: No ability usage in fights
- jungling.js: No ability farming

**Current state:** Abilities exist but are cosmetic only.

---

### 8. Objectives Don't Actually Do Anything
**File:** `server/game/objectives.js`
**Issue:** Securing Dragon/Baron gives 100 gold split among team, but no buffs or stat increases.

**Missing:**
- Dragon buffs (AD/AP increases, movement speed, etc.)
- Baron buff (enhanced minions, stat boost)
- Objective buff duration tracking

---

## LOGIC ERRORS

### 9. Objectives Only Spawn on Specific Waves
**File:** `server/game/objectives.js`
**Lines:** 7-16
**Issue:** Objectives only check on waves 10, 20, 30, 40, 50. But match.js calls `simulateObjective()` every mid/late game wave.

```javascript
// Mid game (waves 21-40)
if (this.wave > 20 && this.wave <= 40) {
    simulateObjective(...); // Called every wave, but only triggers on 20, 30, 40
}
```

**Result:** Most calls to simulateObjective() do nothing.

**Fix:** Either remove wave checks in objectives.js, or only call it on spawn waves.

---

### 10. Comeback Detection Has Off-by-One Logic
**File:** `server/game/commentaryEngine.js`
**Lines:** 215-225
**Issue:** Comeback is announced when gold lead changes hands, but `maxGoldDiff` tracking might not update correctly.

```javascript
if (Math.abs(this.goldDiff) > Math.abs(this.maxGoldDiff)) {
    this.maxGoldDiff = this.goldDiff; // Stores signed value
    this.leadTeam = this.goldDiff > 0 ? 'team1' : 'team2';
}
```

If goldDiff oscillates around 0, this could trigger false comebacks.

---

## CODE QUALITY ISSUES

### 11. Duplicate Team Name Simplification
**File:** `server/game/teamfights.js`
**Lines:** 15, 19, 53, 54
**Issue:** Creating simplified team names in multiple places with different methods.

```javascript
const winningTeam = { name: team1Champions[0].name.replace(/\s.*/, '') + "'s Team" };
// Later...
const team1Team = { name: team1Champions[0].name.split(' ')[0] + "'s Team" };
```

**Fix:** Use actual team names from `match.team1.name` and `match.team2.name`.

---

### 12. Inconsistent Gold Award Amounts
**Issue:** Different events give different, seemingly arbitrary gold amounts:

- Kill in lane: 300 gold (laning.js:35)
- Kill in teamfight: 300 gold (teamfights.js:34)
- Objective: 100 gold per champion (objectives.js:51)
- CS: 20 gold per CS (jungling.js:8)
- CS: No gold in laning.js (missing!)

**Fix:** Standardize gold values and ensure CS gives gold in all situations.

---

### 13. Champion Stats Not Saved to Database
**Issue:** Champions gain stats during match (kills, deaths, assists, CS, gold) but these are never persisted.

**Missing:**
- Save champion stats after match
- Aggregate career totals
- Update champion progression

---

## HALF-IMPLEMENTED FEATURES

### 14. Tilt System Has No Effect
**Issue:** Champions have `tilt_level` that increases with chaos events and weather, but it's never checked during combat.

**What should happen:** Tilted champions should:
- Have reduced mechanical_skill
- Make worse decisions
- Be more aggressive (and reckier)

**Current state:** tilt_level accumulates but does nothing.

---

### 15. Clutch Factor Partially Implemented
**File:** `server/game/commentaryEngine.js`
**Line:** 124
**Issue:** Clutch plays are detected for commentary, but `clutch_factor` doesn't affect actual combat outcomes.

```javascript
if (context.killerStreak >= 2 && Math.random() < killer.clutch_factor) {
    return this.getTemplate('clutch_play', context);
}
```

This only affects commentary, not whether the clutch play succeeds.

---

### 16. Power Curve Not Applied
**File:** `server/data/generators.js`
**Lines:** 118-127
**Issue:** Champions have `power_curve` ('early', 'mid', 'late') but it's never checked during simulation.

**What should happen:**
- Early game champions stronger waves 1-20
- Mid game champions spike waves 21-40
- Late game champions scale waves 41+

**Current state:** Power curve is cosmetic only.

---

## INTEGRATION ISSUES

### 17. Match Not Passed to simulateLaning
**File:** `server/game/laning.js`
**Issue:** Weather system and chaos events can't be checked because match object isn't passed.

**Current signature:**
```javascript
function simulateLaning(team1Champion, team2Champion, logEvent, commentary)
```

**Needed:**
```javascript
function simulateLaning(team1Champion, team2Champion, logEvent, commentary, match)
```

This prevents checking weather modifiers, shop closed status, etc.

---

### 18. Grudges Use Names Instead of IDs
**File:** `server/game/commentaryEngine.js`
**Line:** 119
**Issue:** Grudges are stored as champion names, which can be non-unique.

```javascript
if (killer.grudges && killer.grudges.includes(victim.name))
```

**Problem:** Multiple champions can have the same name ("Boots McLargeHuge" appears twice in generated data).

**Fix:** Use unique IDs or ensure names are unique in generation.

---

## PERFORMANCE ISSUES

### 19. Commentary Engine Creates Objects Every Call
**File:** `server/game/commentaryEngine.js`
**Issue:** Context objects created for every kill, teamfight, etc.

Not critical but could be optimized for high-frequency matches.

---

## MISSING ERROR HANDLING

### 20. No Null Checks for Champions
**File:** Multiple
**Issue:** If a champion is missing from a role, code may crash.

Example: `match.team1Lanes['Jungle']` might be undefined if role shuffle chaos event causes issues.

**Fix:** Add null checks before calling simulation functions.

---

## RECOMMENDATIONS

### Priority 1 (Fix Immediately):
1. Remove Jungle from laning roles array
2. Apply weather modifiers to all gold gains
3. Make CS give gold in laning.js
4. Connect tower damage to teamfights

### Priority 2 (Missing Core Features):
5. Implement item purchasing system
6. Implement champion leveling
7. Use abilities in combat
8. Make objectives give buffs

### Priority 3 (Polish):
9. Apply power curves to stats
10. Make tilt affect performance
11. Standardize gold amounts
12. Fix objective spawn logic

### Priority 4 (Nice to Have):
13. Save champion stats to database
14. Add error handling
15. Use unique IDs for grudges
16. Optimize commentary engine
