# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a MOBA Blaseball Simulator - a real-time multiplayer game that simulates absurdist MOBA (Multiplayer Online Battle Arena) matches with Blaseball-inspired chaos and commentary. The server runs scheduled matches between teams with procedurally generated champions, broadcasting live updates to connected clients via WebSockets.

## Key Commands

### Running the Application
```bash
node server.js
```
The server starts on port 3000 (or PORT environment variable) and automatically begins the game simulation.

### Regenerating Game Data
```bash
node server/data/generate-data.js
```
This creates fresh teams, champions, and stats in `server/data/data.json`. Run this when you want to reset the league or change team/champion generation logic.

### Installing Dependencies
```bash
npm install
```

## Architecture

### Server Architecture (`server.js` + `server/game/`)

The application uses a WebSocket-based architecture with a game loop that manages scheduled matches:

**Game Loop (`server/game/game.js`):**
- Manages the season schedule using round-robin matchmaking
- Runs game days on a 90-minute interval (`GAME_DAY_INTERVAL`)
- Generates absurdist news updates every 2 minutes (`NEWS_UPDATE_INTERVAL`)
- Broadcasts standings, match updates, and news to all connected clients

**Match Simulation (`server/game/match.js`):**
- Each match simulates wave-by-wave gameplay (similar to MOBA minion waves)
- Uses multiple simulation modules that are called each wave:
  - `laning.js` - Lane phase champion interactions
  - `jungling.js` - Jungle farming and ganks
  - `teamfights.js` - Team fight outcomes
  - `objectives.js` - Tower and objective captures
  - `absurdistEvents.js` - Random chaotic events
- Champions have visible stats (KDA, CS, gold, items) and hidden stats (mechanical_skill, game_sense, tilt_resistance, clutch_factor)
- Matches end when one team's nexus towers are destroyed

**Data Generation (`server/data/`):**
- `generators.js` defines the procedural generation for teams and champions with absurdist names and lore
- Teams have 5 champions (Top, Jungle, Mid, ADC, Support)
- Champions have both visible gameplay stats and hidden personality/performance stats
- `data.json` is the generated output containing all teams and champions

### Client Architecture (`public/`)

**`index.html`:**
- Main UI layout with news feed, match viewer, standings, betting interface, and team rosters

**`app.js`:**
- WebSocket client that connects to the server
- Handles incoming messages: match updates, news items, standings, team data
- Manages betting UI and balance updates
- Updates DOM elements based on server broadcasts

**`style.css`:**
- Styling for the application interface

### WebSocket Message Protocol

The server broadcasts several message types:
- `{ type: 'teams', data: [...] }` - Team names for betting dropdown
- `{ type: 'full_teams', data: [...] }` - Complete team rosters with champion details
- `{ type: 'standings', data: [...] }` - Current win/loss records
- `{ type: 'news', item: {...}, history: [...] }` - News updates
- `{ type: 'match_start', match: {...} }` - Match beginning notification
- `{ type: 'match_end', result: {...} }` - Match completion with winner
- `{ type: 'countdown', seconds: N }` - Time until next game day
- Plain text messages for match play-by-play commentary

Client can send:
- `{ type: 'bet', team: 'Team Name', amount: N }` - Place a bet on a team

### Key Design Patterns

**Event-Driven Simulation:**
The Match class uses wave-based progression where each wave triggers multiple simulation functions. This creates emergent gameplay from the interaction of different systems (laning, jungling, teamfights, objectives).

**Hidden Stats System:**
Champions have hidden stats (mechanical_skill, game_sense, tilt_resistance, clutch_factor, tilt_level, grudges, mental_boom_threshold) that affect match outcomes but aren't directly visible to players. This creates unpredictability similar to Blaseball.

**Absurdist Commentary:**
The `newsGenerator.js` and `absurdistEvents.js` modules inject chaos and humor into otherwise standard MOBA simulation, creating Blaseball-style narrative moments.

## Development Notes

- The project is not currently under git version control
- No test suite is configured (package.json has placeholder test script)
- The server uses Express 5.1.0 and ws 8.18.3
- All match state is in-memory; no persistence layer exists
- Client balance tracking is per-connection only (stored on WebSocket object)
