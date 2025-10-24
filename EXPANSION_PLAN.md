# MOBA Blaseball Expansion Plan
## Comprehensive Roadmap for Feature Expansion & UI Overhaul

**Created:** 2025-10-24
**Status:** Planning Phase
**Estimated Total Time:** 6-8 weeks for full implementation

---

## Executive Summary

This plan addresses critical improvements across simulation, chaos systems, champion progression, UI/UX, and narrative systems. The goal is to transform the MOBA Blaseball simulator from a functional prototype into a rich, engaging experience with deterministic replays, deep champion systems, and compelling visual feedback.

### Core Objectives

1. **Migrate to ECS Engine** - Enable deterministic replays and better architecture
2. **Expand Item System** - Add randomness, more items, themed builds
3. **Enhance Chaos Events** - More events with actual gameplay effects + UI display
4. **Implement Champion Abilities** - Unique abilities per champion, ults, skill expression
5. **Add Themed Objectives** - Replace Dragons/Baron with Void-themed objectives
6. **Improve Team Fighting** - Ability interactions, positioning, focus targeting
7. **Fix Simulation Issues** - Better pacing, comeback mechanics, less predictability
8. **Build Champion Progression** - Stats that improve over career/seasons
9. **Create UI Visualizations** - Mini-map, event timeline, match replay viewer
10. **Overhaul Commentary** - Context-aware, ability callouts, momentum tracking

---

## PHASE 1: Foundation - ECS Migration & Core Systems
**Duration:** 2 weeks
**Priority:** CRITICAL (blocks all other features)

### 1.1 Complete ECS Engine Migration
**Goal:** Fully migrate from legacy Match.js to the new ECS-based simulation engine

#### Tasks:
- [ ] **Finish ItemSystem integration**
  - Current state: Basic system exists, needs passives/active items
  - Add: Item passive effects (Thornmail reflect, BotRK % health damage)
  - Add: Active items (if desired)
  - Add: Item randomness (champions deviate from build paths)

- [ ] **Implement Ability System (NEW)**
  - Create `AbilitySystem.js` in `/server/simulation/systems/`
  - Each champion gets 4 abilities (Q, W, E, R/Ultimate)
  - Abilities have: cooldowns, mana costs, damage types, effects
  - Store champion ability data in `/server/simulation/data/abilities.json`
  - Abilities scale with stats (AD, AP, level)

- [ ] **Migrate Chaos Events to ECS**
  - Port ChaosManager to work with World entities
  - Chaos events now modify Entity components instead of raw objects
  - Add chaos event tracking to EventLog

- [ ] **Integrate Weather System into ECS**
  - Port WeatherSystem to work with World
  - Weather affects chaos chance, item gold costs, ability damage

- [ ] **Update Match Simulation to Use ECS**
  - Modify `server/game/game.js` to use MatchSimulator instead of legacy Match
  - Ensure WebSocket broadcasts still work
  - Test concurrent matches with ECS engine

- [ ] **Add Replay System**
  - Store match snapshots every 10 waves
  - Save full event log to database
  - Create API endpoints: `/api/matches/:id/replay`
  - Add replay seed storage for deterministic re-simulation

#### Deliverables:
- ✅ ECS engine is default simulation method
- ✅ All chaos events work in ECS
- ✅ Deterministic replays functional
- ✅ Item system complete with passives
- ✅ Ability system foundation ready

#### Testing:
- Run 100 matches with same seed → verify identical outcomes
- Compare ECS vs Legacy match quality
- Verify no memory leaks with concurrent matches

---

## PHASE 2: Abilities & Combat Depth
**Duration:** 1.5 weeks
**Priority:** HIGH (core gameplay improvement)

### 2.1 Champion Ability Design
**Goal:** Each champion has unique abilities that affect match outcomes

#### Ability Categories:
1. **Damage Abilities** (Q/W/E)
   - Single target damage
   - AOE damage
   - Skill shots (miss chance based on mechanical_skill)

2. **Utility Abilities**
   - Crowd Control (stuns, slows, roots)
   - Shields and healing
   - Mobility (dashes, blinks)

3. **Ultimate Abilities (R)**
   - High impact, long cooldown (60-120s)
   - Game-changing effects
   - Examples: AOE stun, massive damage, team buff

#### Implementation:
- [ ] **Create Ability Templates**
  - Define 20-30 unique abilities
  - Assign randomly to champions during generation
  - Each role has role-appropriate abilities
    - Top: Tankier abilities, CC
    - Jungle: Mobility, damage
    - Mid: Burst damage, skill shots
    - ADC: Sustained damage, positioning
    - Support: Heals, shields, CC

- [ ] **Ability Data Structure**
```json
{
  "id": "fireball",
  "name": "Void Fireball",
  "type": "damage",
  "cooldown": 8,
  "manaCost": 60,
  "damage": { "base": 80, "scaling": { "ap": 0.6 } },
  "effects": ["magic_damage", "aoe"],
  "flavor": "Hurls corrupted fire from beyond reality"
}
```

- [ ] **Ability Usage in Simulation**
  - During laning: Use Q/W/E for trades
  - During teamfights: Use all abilities + ultimate
  - Cooldown tracking per champion
  - Mana resource management
  - Ability hit/miss based on mechanical_skill vs game_sense

- [ ] **Ability Commentary**
  - Log ability usage: "{Champion} casts {Ability}!"
  - Critical hits: "{Champion}'s {Ability} OBLITERATES {Target}!"
  - Ult usage: "🔥 {Champion} activates {ULTIMATE}!"

#### Deliverables:
- ✅ 20-30 unique abilities defined
- ✅ Champions have 4 abilities each
- ✅ Abilities used in laning & teamfights
- ✅ Ability commentary integrated

---

### 2.2 Enhanced Team Fighting
**Goal:** Team fights feel tactical with ability interactions, positioning, focus fire

#### Current Issues:
- Team fights are simple power sums
- No positioning, targeting, or ability synergy
- Outcomes too predictable

#### Improvements:
- [ ] **Positioning System**
  - Front line (Top, Support) vs Back line (ADC, Mid)
  - Front line protects back line
  - Assassins (Jungle) can dive back line

- [ ] **Focus Fire & Target Selection**
  - Teams prioritize low-HP or high-threat targets
  - Assassins target ADC/Mid
  - Tanks try to protect carries

- [ ] **Ability Combos**
  - AOE CC → AOE damage combos
  - Chain CC (stun → root → slow)
  - Shield/heal timing based on ally HP

- [ ] **Teamfight Phases**
  - Engage phase (initiation)
  - Burst phase (abilities fired)
  - Cleanup phase (low HP targets eliminated)

- [ ] **Comeback Mechanics**
  - Losing team gets desperation bonus (clutch_factor)
  - Ace gold (killing entire team) grants massive gold
  - Shutdown gold (killing fed enemy) gives bonus gold

#### Implementation in TeamfightSystem.js:
```javascript
// Phase-based team fighting
1. Determine engagement (who initiates based on comp)
2. Fire abilities in priority order (CC → Damage → Ults)
3. Calculate damage with positioning modifiers
4. Apply deaths and distribute gold/XP
5. Log detailed play-by-play
```

#### Deliverables:
- ✅ Teamfights have positioning mechanics
- ✅ Abilities create combos and synergies
- ✅ Comeback mechanics functional
- ✅ Detailed teamfight commentary

---

## PHASE 3: Chaos Events & Void Objectives
**Duration:** 1 week
**Priority:** HIGH (adds uniqueness)

### 3.1 Expand Chaos Events
**Goal:** 30+ chaos events with REAL gameplay impact and clear UI feedback

#### New Chaos Event Categories:

**Champion Modification Events:**
- [ ] Size Swap (giants vs tiny champions - affects hitboxes)
- [ ] Voice Swap (champions swap names/identities)
- [ ] Ability Theft (steal enemy ability)
- [ ] Stat Redistribution (shuffle all stats)
- [ ] Clone Event (champion duplicates for 3 waves)

**Economy Events:**
- [ ] Item Recall (all items return to shop, refund 50%)
- [ ] Inflation (all items cost 2x)
- [ ] Deflation (all items cost 50%)
- [ ] Black Market (unique overpowered items available)

**Map Events:**
- [ ] Lane Inversion (Top becomes Bot, Mid rotates)
- [ ] Fog of War (reduced vision, more missed skill shots)
- [ ] Speed Zone (all champions move/attack faster)
- [ ] Gravity Shift (skill shots harder to land)

**Ultimate Events (Rare):**
- [ ] Team Merge (5v5 becomes 10v0 vs minions)
- [ ] Sudden Death (next death ends match)
- [ ] Time Dilation (match slows to 50% speed)
- [ ] Reality Fracture (two parallel matches, winner combined)

#### Chaos Event Display Requirements:
- [ ] **Event Banner in UI**
  - Large on-screen notification when chaos triggers
  - Animated entrance/exit
  - Icon + event name + description

- [ ] **Active Chaos Tracker**
  - Sidebar showing currently active chaos effects
  - Duration countdown
  - Effect description

- [ ] **Chaos History Log**
  - Timeline of all chaos events in match
  - Filterable event log

#### Implementation:
- [ ] Add 20+ new chaos events to `chaosEvents.js`
- [ ] Ensure each event has:
  - `execute()` function (applies effect)
  - `onWave()` function (duration tracking)
  - `description` (for UI display)
  - `rarity` (common/uncommon/rare/epic/legendary)
  - `icon` (emoji or image path)

- [ ] Create WebSocket message type: `{ type: 'chaos_event', event: {...} }`
- [ ] Add UI handler in `app.js` to display chaos banners
- [ ] Add active chaos tracker to sidebar

#### Deliverables:
- ✅ 30+ chaos events implemented
- ✅ All events have visible gameplay effects
- ✅ Chaos event UI notifications working
- ✅ Active chaos tracker in sidebar

---

### 3.2 Void-Themed Objectives
**Goal:** Replace Dragon/Baron with thematic Void objectives

#### Current State:
- Dragons spawn at waves 10, 20, 30, 40
- Baron spawns at waves 40, 50
- No buffs, just "team secured it" messages

#### New Void Objectives:

**1. Rift Breaches (replaces Dragons)**
- Spawn waves: 10, 20, 30, 40
- Types (random each spawn):
  - **Reality Rift**: +10% damage to all abilities
  - **Time Rift**: -20% cooldowns on all abilities
  - **Void Rift**: +500 HP to all champions
  - **Chaos Rift**: Random buff to each champion

**2. The Hungering Void (replaces Baron)**
- Spawns wave 40+
- Team that secures it gets:
  - Massive gold (1500 per champion)
  - +20% all stats for 5 waves
  - Minions empowered (harder to kill)
  - "VOID EMPOWERED" status effect

**3. Reality Tears (new objective, rare)**
- Random spawn waves 25-55
- Contests instantly, pure mechanical skill check
- Winner gets: Choose ANY chaos event to trigger

#### Implementation:
- [ ] Replace objective names in `objectives.js`
- [ ] Add buff application to ObjectiveSystem
- [ ] Track buff duration and effects
- [ ] Add buff icons/indicators in UI
- [ ] Commentary for objective fights and buffs

#### Deliverables:
- ✅ Void-themed objectives replace LoL objectives
- ✅ Buffs have actual gameplay effects
- ✅ Buff tracking in UI
- ✅ Commentary updated

---

## PHASE 4: Champion Progression & Persistence
**Duration:** 1 week
**Priority:** MEDIUM (adds depth)

### 4.1 In-Match Progression
**Goal:** Champions grow stronger during matches

#### Current Issues:
- Champions don't level up (beyond gold/items)
- No XP system
- Flat power curve

#### Improvements:
- [ ] **XP & Leveling System**
  - Champions gain XP from: CS, kills, assists, objectives
  - Level cap: 18 (like real MOBAs)
  - Each level grants: +HP, +damage, +defenses
  - Ability scaling improves with level

- [ ] **Level-Based Abilities**
  - Level 1: Q unlocked
  - Level 3: W unlocked
  - Level 5: E unlocked
  - Level 6: R (Ultimate) unlocked
  - Max rank: Q/W/E = 5 ranks, R = 3 ranks

- [ ] **Power Spikes**
  - Certain champions are "early game" (strong levels 1-6)
  - Others are "late game" (strong levels 11+)
  - Hidden stat: `power_curve` (early/mid/late)

#### Implementation:
- [ ] Add XP tracking to champion components
- [ ] Create leveling formulas (XP needed per level)
- [ ] Modify ability damage based on ability rank + champion level
- [ ] Add "power spike" commentary

#### Deliverables:
- ✅ Champions level 1-18 during matches
- ✅ Abilities scale with level
- ✅ Power spike moments create drama

---

### 4.2 Cross-Season Progression
**Goal:** Champions improve and change over their careers

#### Systems to Implement:

**1. Experience System**
- [ ] Champions gain career XP from matches
- [ ] More XP for: wins, high KDA, objective secures
- [ ] Career level affects hidden stats (max +0.1 per stat)

**2. Form System**
- [ ] Champions have "form" (0.5 - 1.5 multiplier)
- [ ] Win streaks improve form
- [ ] Loss streaks decrease form
- [ ] Form affects current mechanical_skill and game_sense

**3. Grudge System (Enhanced)**
- [ ] Champions remember opponents who kill them often
- [ ] Grudges grant: +10% damage vs grudge target
- [ ] Grudges increase tilt when facing grudge target

**4. Relationships**
- [ ] Champions who win together build synergy
- [ ] Synergy: +5% stats when on same team
- [ ] Max 3 synergies per champion

**5. Permanent Stat Changes**
- [ ] Rare chaos events can PERMANENTLY alter stats
- [ ] "Void-touched" status (gained from Void consumption)
- [ ] Season-ending awards grant stat bonuses

#### Database Schema Updates:
```sql
-- Add to champion_careers table
ALTER TABLE champion_careers ADD COLUMN career_xp INTEGER DEFAULT 0;
ALTER TABLE champion_careers ADD COLUMN career_level INTEGER DEFAULT 1;
ALTER TABLE champion_careers ADD COLUMN form REAL DEFAULT 1.0;
ALTER TABLE champion_careers ADD COLUMN void_touched BOOLEAN DEFAULT 0;

-- New table for grudges
CREATE TABLE champion_grudges (
  champion_id TEXT,
  grudge_target_id TEXT,
  intensity REAL DEFAULT 0.0,
  PRIMARY KEY (champion_id, grudge_target_id)
);

-- New table for synergies
CREATE TABLE champion_synergies (
  champion_id TEXT,
  synergy_target_id TEXT,
  strength REAL DEFAULT 0.0,
  PRIMARY KEY (champion_id, synergy_target_id)
);
```

#### Deliverables:
- ✅ Champions improve over career
- ✅ Form system affects performance
- ✅ Grudges and synergies add drama
- ✅ Permanent stat changes possible

---

## PHASE 5: Item System Expansion
**Duration:** 3 days
**Priority:** MEDIUM

### 5.1 More Items & Build Variety
**Goal:** Expand from 20 items to 60+ items with build randomness

#### New Item Categories:

**Mythic Items (choose 1 per game):**
- [ ] Eclipse (Assassin mythic)
- [ ] Galeforce (ADC mythic with active dash)
- [ ] Goredrinker (Bruiser mythic with AOE heal)
- [ ] Everfrost (Mage mythic with CC)

**Void-Themed Items (unique to this game):**
- [ ] Voidwalker's Shroud - Teleport on hit
- [ ] Reality Anchor - Immune to chaos events
- [ ] Timeless Hourglass - Revive on death
- [ ] Corruption Engine - Spread chaos to enemies

**Situational Items:**
- [ ] Anti-heal items (vs healing comps)
- [ ] Anti-shield items (vs shield comps)
- [ ] Tenacity items (vs CC comps)

#### Build Randomness:
- [ ] **Build Path Deviation**
  - 30% chance to deviate from planned build
  - Pick random item from role's item pool
  - Higher mechanical_skill = smarter deviations

- [ ] **Early Adaptation**
  - If losing lane, buy defensive item
  - If ahead, buy aggressive item
  - Adaptation chance based on game_sense

- [ ] **Troll Builds (rare)**
  - 5% chance champion goes "full AP Assassin" or similar
  - Intentionally suboptimal builds for chaos
  - Commentary calls it out: "Wait, is {Champion} building WHAT?"

#### Implementation:
- [ ] Expand `items.json` from 20 → 60+ items
- [ ] Add mythic item restriction (max 1)
- [ ] Add build deviation logic to ItemSystem
- [ ] Add situational item logic (counter-building)
- [ ] Commentary for unusual builds

#### Deliverables:
- ✅ 60+ items available
- ✅ Mythic items implemented
- ✅ Build randomness adds variety
- ✅ Champions adapt builds to match state

---

## PHASE 6: UI/UX Overhaul
**Duration:** 2 weeks
**Priority:** HIGH (user experience)

### 6.1 Live Match Visualization
**Goal:** Visual representation of match state beyond text

#### Components to Build:

**1. Mini-Map**
- [ ] Canvas-based 300x300px map
- [ ] Shows: lanes, jungle, objectives, towers
- [ ] Champion positions (dots colored by team)
- [ ] Real-time updates during match
- [ ] Click champion dot → show details

**2. Team Composition Display**
- [ ] Show both teams side-by-side
- [ ] Champion portraits (generated or icons)
- [ ] Live KDA, CS, Gold, Level display
- [ ] Health/Mana bars
- [ ] Active buffs (Rift buffs, Void Empowered)
- [ ] Death status (grayed out when dead)

**3. Event Timeline**
- [ ] Horizontal timeline below match feed
- [ ] Icons for: kills, objectives, chaos events, towers
- [ ] Click event → jump to that moment in feed
- [ ] Color-coded by team

**4. Match Stats Dashboard**
- [ ] Gold graph (team gold over time)
- [ ] Kill graph (cumulative kills over time)
- [ ] Tower count
- [ ] Objective count
- [ ] Chaos event count

#### Implementation:
```html
<!-- Add to index.html -->
<div id="match-visualization">
  <canvas id="minimap" width="300" height="300"></canvas>

  <div id="team-compositions">
    <div id="team1-comp" class="team-comp"></div>
    <div id="team2-comp" class="team-comp"></div>
  </div>

  <div id="event-timeline"></div>

  <div id="match-stats-graphs">
    <canvas id="gold-graph" width="400" height="200"></canvas>
    <canvas id="kill-graph" width="400" height="200"></canvas>
  </div>
</div>
```

- [ ] Create `visualization.js` module
- [ ] Use Canvas API for mini-map and graphs
- [ ] WebSocket updates trigger re-renders
- [ ] Add animation easing for smooth transitions

#### Deliverables:
- ✅ Mini-map shows champion positions
- ✅ Team comps display live stats
- ✅ Event timeline interactive
- ✅ Graphs show match flow

---

### 6.2 Champion Detail Pages
**Goal:** Deep-dive into individual champion stats and history

#### Page Structure:
```
/champion/:championId

Sections:
- Header (name, role, lore, portrait)
- Career Stats (total kills, deaths, assists, games, win rate)
- Season Stats (current season performance)
- Match History (last 20 matches with results)
- Abilities (4 abilities with descriptions)
- Items (preferred build paths, item stats)
- Relationships (grudges, synergies)
- Achievements (pentakills, carry games, etc.)
```

#### Implementation:
- [ ] Create `champion.html` template
- [ ] Add API endpoint: `/api/champions/:id`
- [ ] Query database for champion career stats
- [ ] Display match history with links to replays
- [ ] Show grudge/synergy relationships
- [ ] Generate ability cards

#### Deliverables:
- ✅ Champion detail page functional
- ✅ Career stats displayed
- ✅ Match history with replays

---

### 6.3 Match Replay System
**Goal:** Watch previous matches with full playback control

#### Features:
- [ ] **Replay Player**
  - Play/Pause controls
  - Speed controls (0.5x, 1x, 2x, 5x)
  - Wave scrubbing (jump to wave N)
  - Event markers (kills, objectives, chaos)

- [ ] **Replay Data**
  - Load match from database (event log + snapshots)
  - Replay events in order
  - Show match state at any wave
  - Commentary replay

- [ ] **Deterministic Re-Simulation**
  - Button: "Re-simulate with same seed"
  - Verify replay matches original
  - Expose seed for debugging

#### Implementation:
```html
<!-- replay.html -->
<div id="replay-player">
  <div id="replay-visualization">
    <!-- Mini-map, team comps, etc. -->
  </div>

  <div id="replay-controls">
    <button id="play-pause">Play</button>
    <input type="range" id="wave-scrubber" min="1" max="60">
    <select id="speed-control">
      <option value="0.5">0.5x</option>
      <option value="1" selected>1x</option>
      <option value="2">2x</option>
      <option value="5">5x</option>
    </select>
  </div>

  <div id="replay-feed">
    <!-- Match commentary -->
  </div>
</div>
```

- [ ] Create `replay.html` and `replay.js`
- [ ] API: `/api/matches/:id/replay` returns event log
- [ ] Parse events and re-render UI at each wave
- [ ] Implement playback controls

#### Deliverables:
- ✅ Replay viewer functional
- ✅ Playback controls working
- ✅ Can watch any historical match

---

### 6.4 Match History Browser
**Goal:** Browse all past matches with filters

#### Features:
- [ ] **Match List**
  - Paginated (20 matches per page)
  - Columns: Date, Teams, Score, Duration, Winner
  - Click row → open replay

- [ ] **Filters**
  - By team
  - By champion
  - By season
  - By date range
  - By chaos event type

- [ ] **Search**
  - Search by champion name
  - Search by team name

#### Implementation:
- [ ] Create `/matches` page
- [ ] API: `/api/matches?page=1&limit=20&filters={...}`
- [ ] Display match results in table
- [ ] Add filter UI and search bar

#### Deliverables:
- ✅ Match history browser functional
- ✅ Filters and search working

---

### 6.5 Improved Stats Dashboard
**Goal:** Rich statistics and leaderboards

#### Pages to Create:

**1. League Leaderboards**
- [ ] Best KDA
- [ ] Most Kills
- [ ] Most Assists
- [ ] Highest Win Rate (min 10 games)
- [ ] Most CS
- [ ] Most Gold Earned
- [ ] Most Chaotic (chaos events triggered)

**2. Team Stats**
- [ ] Team win rates
- [ ] Head-to-head records
- [ ] Average match duration
- [ ] Most common bans (if banning implemented)

**3. Item Stats**
- [ ] Most purchased items
- [ ] Highest win rate items
- [ ] Average gold efficiency

**4. Chaos Stats**
- [ ] Most frequent chaos events
- [ ] Chaos impact on win rate
- [ ] Most chaotic matches

#### Implementation:
- [ ] Create `/stats` page with tabs
- [ ] API endpoints for each leaderboard
- [ ] Database queries with aggregation
- [ ] Display with sorting/filtering

#### Deliverables:
- ✅ Stats dashboard complete
- ✅ Leaderboards functional
- ✅ Team and item stats available

---

## PHASE 7: Commentary & Narrative Overhaul
**Duration:** 1 week
**Priority:** MEDIUM (quality of life)

### 7.1 Context-Aware Commentary
**Goal:** Fix boring/repetitive commentary

#### Current Issues:
- Generic messages
- No awareness of match state
- No momentum tracking
- No personality per champion

#### Improvements:

**1. Match State Awareness**
- [ ] Track momentum (which team is winning)
- [ ] Commentary changes based on gold difference
- [ ] "Comeback commentary" when losing team makes plays
- [ ] "Domination commentary" when ahead team secures objectives

**2. Ability Callouts**
- [ ] When ultimate used: "🔥 {Champion} activates {ABILITY_NAME}!"
- [ ] When ability misses: "{Champion}'s {Ability} whiffs completely!"
- [ ] When ability crits: "{Champion}'s {Ability} OBLITERATES {Target}!"

**3. Champion Personality**
- [ ] Assign personality traits during generation
  - Cocky, Humble, Chaotic, Calculated, Tilted
- [ ] Commentary reflects personality:
  - Cocky: "{Champion} showboats after the kill!"
  - Humble: "{Champion} quietly secures the objective."
  - Chaotic: "{Champion} laughs maniacally!"

**4. Momentum System**
- [ ] Track "momentum" score (-100 to +100)
- [ ] Positive momentum: Team1 winning
- [ ] Momentum shifts trigger commentary:
  - "The tide is turning!"
  - "{Team} is on the back foot now!"
  - "This is a complete STOMP!"

**5. Play-by-Play Quality**
- [ ] Specific commentary for:
  - First blood
  - Ace (team wipe)
  - Baron/Void steal
  - Pentakill
  - Shutdown (killing fed enemy)
  - Comeback kills
  - Nexus exposed

#### Implementation:
- [ ] Create `commentaryEngine.js`
- [ ] Build template library with placeholders
- [ ] Track match state (gold diff, momentum, kill count)
- [ ] Hook into all simulation events
- [ ] Add personality to champion generation

#### Example Templates:
```javascript
{
  event: 'first_blood',
  templates: [
    "FIRST BLOOD! {killer} draws first blood against {victim}!",
    "{killer} wastes no time, securing first blood!",
    "The void hungers! {killer} claims the first sacrifice!"
  ]
},
{
  event: 'ace',
  templates: [
    "ACE! {team} has wiped out the entire enemy team!",
    "COMPLETE ANNIHILATION! {team} stands alone!",
    "The void claims all of {enemy_team}!"
  ]
}
```

#### Deliverables:
- ✅ Context-aware commentary system
- ✅ Ability callouts working
- ✅ Champion personality in commentary
- ✅ Momentum tracking affects commentary

---

### 7.2 Narrative Moments
**Goal:** Create memorable story beats during matches

#### Systems:

**1. Rivalry System**
- [ ] When champions with grudges face off:
  - "The rivalry between {A} and {B} reignites!"
  - Bonus commentary when one kills the other
  - Track grudge escalation

**2. Underdog Moments**
- [ ] Detect when losing team makes comeback
- [ ] "Against all odds, {team} refuses to surrender!"
- [ ] Extra drama for near-loss victories

**3. Record Breakers**
- [ ] Track in-match records (highest CS, fastest pentakill, etc.)
- [ ] Announce when broken:
  - "{Champion} just set a new CS record: {value}!"

**4. Clutch Plays**
- [ ] Detect 1v2+ situations where underdog wins
- [ ] "{Champion} with the CLUTCH outplay!"
- [ ] Bonus based on clutch_factor stat

**5. Cursed Moments**
- [ ] Track humiliating deaths (killed by minions, tower dives)
- [ ] "{Champion} has been sentenced to the void by a MINION!"

#### Deliverables:
- ✅ Rivalry system creates drama
- ✅ Underdog moments highlighted
- ✅ Record breakers announced
- ✅ Clutch plays rewarded with commentary

---

## PHASE 8: Simulation Quality Improvements
**Duration:** 4 days
**Priority:** HIGH (core experience)

### 8.1 Fix Match Pacing
**Goal:** Matches feel appropriately paced, not too short or long

#### Current Issues:
- Some matches end in 20 waves (too fast)
- Some drag to 60 waves (too slow)
- No comeback mechanics

#### Improvements:

**1. Dynamic Wave Duration**
- [ ] Early game waves: 10-15 seconds
- [ ] Mid game waves: 8-12 seconds
- [ ] Late game waves: 5-8 seconds (faster pace)

**2. Tower Scaling**
- [ ] Early towers: Easier to destroy
- [ ] Inhibitor towers: Very tanky
- [ ] Nexus towers: Require team effort

**3. Rubber-Banding**
- [ ] Losing team gets bonus XP/Gold
- [ ] Killing fed enemy grants shutdown gold
- [ ] Respawn timers shorter for losing team
- [ ] Desperation buff at -5000 gold deficit

**4. Ending Conditions**
- [ ] Win condition: Destroy nexus (both nexus towers down)
- [ ] Rare: Forfeit if >10k gold deficit at wave 50+
- [ ] Rare: Sudden death if wave 60 reached (next nexus hit wins)

#### Implementation:
- [ ] Adjust wave intervals in MatchSimulator
- [ ] Add tower HP scaling to StructureSystem
- [ ] Implement comeback mechanics in gold/XP distribution
- [ ] Add forfeit logic

#### Deliverables:
- ✅ Matches average 35-45 waves
- ✅ Comebacks are possible
- ✅ Matches feel dynamic, not snowbally

---

### 8.2 Reduce Predictability
**Goal:** Outcomes less determined by simple stat sums

#### Improvements:

**1. Variance in Abilities**
- [ ] Skill shots can miss (based on mechanical_skill)
- [ ] Critical hits add randomness
- [ ] Dodge chance based on agility

**2. Chaos Escalation**
- [ ] Chaos level increases faster in close matches
- [ ] More chaos = more unpredictability

**3. Tilt Impact**
- [ ] High tilt can cause throw moments
- [ ] "Mental boom" events where champion plays terribly
- [ ] Random tilt spikes from deaths/losses

**4. Hidden Stat Impact**
- [ ] Clutch factor matters more in close fights
- [ ] Game sense helps predict/dodge abilities
- [ ] Tilt resistance prevents mental boom

#### Implementation:
- [ ] Add variance to ability damage (±15%)
- [ ] Increase chaos event frequency in close games
- [ ] Add tilt spikes on death/loss streaks
- [ ] Weight hidden stats more heavily in outcomes

#### Deliverables:
- ✅ Match outcomes less predictable
- ✅ Upsets happen regularly
- ✅ Hidden stats matter

---

## PHASE 9: Polish & Testing
**Duration:** 1 week
**Priority:** CRITICAL (before launch)

### 9.1 Performance Optimization
- [ ] Profile match simulation (ensure <100ms per wave)
- [ ] Optimize database queries (add indexes)
- [ ] Minimize WebSocket message size
- [ ] Add client-side caching
- [ ] Lazy load match history/replays

### 9.2 Bug Fixes
- [ ] Test all chaos events for edge cases
- [ ] Verify ECS engine has no memory leaks
- [ ] Ensure replays are deterministic (100 test runs)
- [ ] Fix any UI rendering issues
- [ ] Mobile responsiveness (if desired)

### 9.3 Balance Tuning
- [ ] Adjust item costs for balance
- [ ] Tune ability damage/cooldowns
- [ ] Adjust chaos event frequencies
- [ ] Balance comeback mechanics (not too strong)
- [ ] Tune hidden stat weights

### 9.4 Documentation
- [ ] Update CLAUDE.md with new architecture
- [ ] Document ability system
- [ ] Document chaos events
- [ ] API documentation for new endpoints
- [ ] User guide for new UI features

---

## PHASE 10: Future Enhancements (Post-MVP)
**Duration:** Ongoing
**Priority:** LOW (nice-to-have)

### Ideas for Later:
- [ ] Banning phase before matches
- [ ] Draft system (teams pick champions from pool)
- [ ] Coaching system (AI coach gives advice)
- [ ] Tournament mode (brackets, playoffs)
- [ ] Custom game mode (user-created rulesets)
- [ ] Mobile app
- [ ] Twitch integration (stream matches)
- [ ] Betting leagues and competitions
- [ ] Social features (friend lists, chat)
- [ ] Champion skins/cosmetics
- [ ] Voice lines for champions
- [ ] Sound effects and music

---

## Success Metrics

### Phase 1-2 (Core Systems):
- ✅ Deterministic replays work 100% of the time
- ✅ Abilities used in >90% of fights
- ✅ ECS engine runs at <100ms per wave

### Phase 3 (Chaos):
- ✅ Chaos event triggers in >80% of matches
- ✅ Players can see active chaos effects in UI
- ✅ 30+ unique chaos events

### Phase 4-5 (Progression):
- ✅ Champions show measurable stat growth over seasons
- ✅ Build variety: No two champions have identical builds
- ✅ Grudges/synergies create storylines

### Phase 6 (UI):
- ✅ Users can replay any historical match
- ✅ Mini-map updates in real-time
- ✅ Champion detail pages load <1s

### Phase 7-8 (Simulation):
- ✅ Commentary feels contextual and varied
- ✅ Match pacing: 35-45 waves average
- ✅ Upsets happen in 15-20% of matches

---

## Risk Assessment

### High Risk:
- **ECS Migration Complexity** - May introduce bugs. *Mitigation: Extensive testing, parallel run with legacy*
- **Performance Degradation** - More systems = slower. *Mitigation: Profiling, optimization*
- **Scope Creep** - Features expand indefinitely. *Mitigation: Stick to plan, defer nice-to-haves*

### Medium Risk:
- **Replay Determinism** - Hard to guarantee. *Mitigation: Seeded RNG, extensive testing*
- **UI Complexity** - Canvas rendering can be tricky. *Mitigation: Use libraries, incremental development*
- **Balance Issues** - New systems may be broken. *Mitigation: Tuning phase, player feedback*

### Low Risk:
- **Database Schema Changes** - Well-understood. *Mitigation: Migrations, backups*
- **Chaos Event Bugs** - Easy to isolate. *Mitigation: Unit tests per event*

---

## Conclusion

This plan transforms the MOBA Blaseball simulator from a functional prototype into a feature-rich, engaging simulation with deep systems, compelling UI, and emergent storytelling. The phased approach allows for incremental progress while maintaining a working product at each stage.

**Estimated Total Effort:** 6-8 weeks (1 developer, full-time)
**Key Dependencies:** Phase 1 must complete before others begin
**Recommended Approach:** Execute phases sequentially, with daily testing and iteration

Let's build something amazing. The void awaits.
