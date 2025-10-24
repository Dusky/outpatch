/**
 * Visualization Module - Mini-map, Graphs, and Event Timeline
 * For MOBA Blaseball Match Viewer
 */

class MatchVisualization {
    constructor() {
        // Canvas contexts
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.goldGraphCanvas = null;
        this.goldGraphCtx = null;
        this.killGraphCanvas = null;
        this.killGraphCtx = null;

        // Data tracking
        this.matchData = {
            wave: 0,
            maxWaves: 150,
            team1: { kills: 0, gold: 0, champions: [] },
            team2: { kills: 0, gold: 0, champions: [] },
            goldHistory: [], // [{wave, team1Gold, team2Gold}]
            killHistory: [], // [{wave, team1Kills, team2Kills}]
            events: [] // [{wave, type, description, team}]
        };

        // Mini-map configuration
        this.minimapConfig = {
            width: 300,
            height: 300,
            lanes: {
                top: { start: { x: 30, y: 30 }, end: { x: 270, y: 270 } },
                mid: { start: { x: 30, y: 270 }, end: { x: 270, y: 30 } },
                bot: { start: { x: 30, y: 150 }, end: { x: 270, y: 150 } }
            },
            jungle: [
                { x: 100, y: 100 },
                { x: 200, y: 100 },
                { x: 100, y: 200 },
                { x: 200, y: 200 }
            ],
            objectives: [
                { x: 150, y: 80, type: 'rift' },
                { x: 150, y: 220, type: 'void' }
            ]
        };

        // Colors
        this.colors = {
            team1: 'rgba(74, 158, 255, 0.8)', // Blue
            team2: 'rgba(255, 68, 68, 0.8)', // Red
            team1Fill: 'rgba(74, 158, 255, 0.3)',
            team2Fill: 'rgba(255, 68, 68, 0.3)',
            lane: 'rgba(255, 255, 255, 0.2)',
            jungle: 'rgba(50, 255, 150, 0.3)',
            objective: 'rgba(255, 215, 0, 0.6)',
            grid: 'rgba(255, 255, 255, 0.1)',
            text: '#ffffff'
        };

        this.isInitialized = false;
    }

    /**
     * Initialize visualization with canvas elements
     */
    initialize() {
        // Get canvas elements
        this.minimapCanvas = document.getElementById('minimap');
        this.goldGraphCanvas = document.getElementById('gold-graph');
        this.killGraphCanvas = document.getElementById('kill-graph');

        if (this.minimapCanvas) {
            this.minimapCtx = this.minimapCanvas.getContext('2d');
            this.isInitialized = true;
        }

        if (this.goldGraphCanvas) {
            this.goldGraphCtx = this.goldGraphCanvas.getContext('2d');
        }

        if (this.killGraphCanvas) {
            this.killGraphCtx = this.killGraphCanvas.getContext('2d');
        }

        // Draw initial states
        if (this.isInitialized) {
            this.drawMinimap();
            this.drawGoldGraph();
            this.drawKillGraph();
        }

        console.log('Visualization initialized:', this.isInitialized);
    }

    /**
     * Update match data from server
     */
    updateMatchData(data) {
        if (!this.isInitialized) return;

        this.matchData.wave = data.wave || 0;
        this.matchData.maxWaves = data.maxWaves || 150;

        // Update team data
        if (data.team1Gold !== undefined) {
            this.matchData.team1.gold = data.team1Gold;
            this.matchData.team2.gold = data.team2Gold;

            // Track gold history
            this.matchData.goldHistory.push({
                wave: this.matchData.wave,
                team1Gold: data.team1Gold,
                team2Gold: data.team2Gold
            });

            // Limit history to last 50 waves
            if (this.matchData.goldHistory.length > 50) {
                this.matchData.goldHistory.shift();
            }
        }

        if (data.team1Kills !== undefined) {
            this.matchData.team1.kills = data.team1Kills;
            this.matchData.team2.kills = data.team2Kills;

            // Track kill history
            this.matchData.killHistory.push({
                wave: this.matchData.wave,
                team1Kills: data.team1Kills,
                team2Kills: data.team2Kills
            });

            // Limit history to last 50 waves
            if (this.matchData.killHistory.length > 50) {
                this.matchData.killHistory.shift();
            }
        }

        // Update champion positions
        if (data.champions) {
            this.matchData.team1.champions = data.champions.filter(c => c.teamId === 'team1');
            this.matchData.team2.champions = data.champions.filter(c => c.teamId === 'team2');
        }

        // Redraw visualizations
        this.drawMinimap();
        this.drawGoldGraph();
        this.drawKillGraph();
    }

    /**
     * Add event to timeline
     */
    addEvent(wave, type, description, team = null) {
        if (!this.isInitialized) return;

        this.matchData.events.push({
            wave,
            type,
            description,
            team,
            timestamp: Date.now()
        });

        // Limit events to last 50
        if (this.matchData.events.length > 50) {
            this.matchData.events.shift();
        }

        this.renderEventTimeline();
    }

    /**
     * Draw the mini-map
     */
    drawMinimap() {
        if (!this.minimapCtx) return;

        const ctx = this.minimapCtx;
        const width = this.minimapConfig.width;
        const height = this.minimapConfig.height;

        // Clear canvas
        ctx.fillStyle = '#1a1d29';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 1;
        for (let i = 0; i < width; i += 30) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, height);
            ctx.stroke();
        }
        for (let i = 0; i < height; i += 30) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(width, i);
            ctx.stroke();
        }

        // Draw lanes
        this.drawLanes(ctx);

        // Draw jungle camps
        this.drawJungleCamps(ctx);

        // Draw objectives
        this.drawObjectives(ctx);

        // Draw champion positions
        this.drawChampionPositions(ctx);

        // Draw legend
        this.drawMinimapLegend(ctx);
    }

    /**
     * Draw lanes on mini-map
     */
    drawLanes(ctx) {
        ctx.strokeStyle = this.colors.lane;
        ctx.lineWidth = 2;

        // Top lane (diagonal)
        const top = this.minimapConfig.lanes.top;
        ctx.beginPath();
        ctx.moveTo(top.start.x, top.start.y);
        ctx.lineTo(top.end.x, top.end.y);
        ctx.stroke();

        // Mid lane (anti-diagonal)
        const mid = this.minimapConfig.lanes.mid;
        ctx.beginPath();
        ctx.moveTo(mid.start.x, mid.start.y);
        ctx.lineTo(mid.end.x, mid.end.y);
        ctx.stroke();

        // Bot lane (horizontal)
        const bot = this.minimapConfig.lanes.bot;
        ctx.beginPath();
        ctx.moveTo(bot.start.x, bot.start.y);
        ctx.lineTo(bot.end.x, bot.end.y);
        ctx.stroke();
    }

    /**
     * Draw jungle camps
     */
    drawJungleCamps(ctx) {
        ctx.fillStyle = this.colors.jungle;
        this.minimapConfig.jungle.forEach(camp => {
            ctx.beginPath();
            ctx.arc(camp.x, camp.y, 8, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /**
     * Draw objectives (Rift Breaches, Void)
     */
    drawObjectives(ctx) {
        ctx.fillStyle = this.colors.objective;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;

        this.minimapConfig.objectives.forEach(obj => {
            ctx.beginPath();
            if (obj.type === 'rift') {
                // Draw diamond for Rift Breach
                ctx.moveTo(obj.x, obj.y - 10);
                ctx.lineTo(obj.x + 8, obj.y);
                ctx.lineTo(obj.x, obj.y + 10);
                ctx.lineTo(obj.x - 8, obj.y);
                ctx.closePath();
            } else {
                // Draw star for Hungering Void
                this.drawStar(ctx, obj.x, obj.y, 5, 10, 5);
            }
            ctx.fill();
            ctx.stroke();
        });
    }

    /**
     * Draw star shape (for Void objective)
     */
    drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);

        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }

        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
    }

    /**
     * Draw champion positions
     */
    drawChampionPositions(ctx) {
        // Team 1 (Blue) champions
        this.matchData.team1.champions.forEach((champ, idx) => {
            const pos = this.getChampionPosition(champ.role, 'team1', idx);
            this.drawChampion(ctx, pos.x, pos.y, this.colors.team1, champ.name);
        });

        // Team 2 (Red) champions
        this.matchData.team2.champions.forEach((champ, idx) => {
            const pos = this.getChampionPosition(champ.role, 'team2', idx);
            this.drawChampion(ctx, pos.x, pos.y, this.colors.team2, champ.name);
        });
    }

    /**
     * Get champion position based on role and team
     */
    getChampionPosition(role, team, index) {
        const positions = {
            team1: {
                Top: { x: 50, y: 50 },
                Jungle: { x: 100, y: 150 },
                Mid: { x: 150, y: 150 },
                ADC: { x: 50, y: 250 },
                Support: { x: 80, y: 250 }
            },
            team2: {
                Top: { x: 250, y: 250 },
                Jungle: { x: 200, y: 150 },
                Mid: { x: 150, y: 150 },
                ADC: { x: 250, y: 50 },
                Support: { x: 220, y: 50 }
            }
        };

        return positions[team][role] || { x: 150, y: 150 };
    }

    /**
     * Draw a champion dot
     */
    drawChampion(ctx, x, y, color, name) {
        // Draw champion circle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();

        // Draw border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw name (abbreviated) on hover or for key positions
        // For now, just draw dots
    }

    /**
     * Draw minimap legend
     */
    drawMinimapLegend(ctx) {
        ctx.font = '10px "Share Tech Mono", monospace';
        ctx.fillStyle = this.colors.text;

        // Team 1 corner (bottom-left)
        ctx.fillText('TEAM 1', 10, 290);

        // Team 2 corner (top-right)
        ctx.fillText('TEAM 2', 230, 15);
    }

    /**
     * Draw gold graph
     */
    drawGoldGraph() {
        if (!this.goldGraphCtx || this.matchData.goldHistory.length === 0) return;

        const ctx = this.goldGraphCtx;
        const width = this.goldGraphCanvas.width;
        const height = this.goldGraphCanvas.height;

        // Clear canvas
        ctx.fillStyle = '#1a1d29';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        this.drawGraphGrid(ctx, width, height, 'GOLD OVER TIME');

        // Find max gold for scaling
        let maxGold = 0;
        this.matchData.goldHistory.forEach(entry => {
            maxGold = Math.max(maxGold, entry.team1Gold, entry.team2Gold);
        });

        if (maxGold === 0) maxGold = 10000; // Prevent division by zero

        // Draw lines
        this.drawGraphLine(ctx, width, height, this.matchData.goldHistory,
            'team1Gold', this.colors.team1, maxGold);
        this.drawGraphLine(ctx, width, height, this.matchData.goldHistory,
            'team2Gold', this.colors.team2, maxGold);

        // Draw legend
        this.drawGraphLegend(ctx, width, height);
    }

    /**
     * Draw kill graph
     */
    drawKillGraph() {
        if (!this.killGraphCtx || this.matchData.killHistory.length === 0) return;

        const ctx = this.killGraphCtx;
        const width = this.killGraphCanvas.width;
        const height = this.killGraphCanvas.height;

        // Clear canvas
        ctx.fillStyle = '#1a1d29';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        this.drawGraphGrid(ctx, width, height, 'KILLS OVER TIME');

        // Find max kills for scaling
        let maxKills = 0;
        this.matchData.killHistory.forEach(entry => {
            maxKills = Math.max(maxKills, entry.team1Kills, entry.team2Kills);
        });

        if (maxKills === 0) maxKills = 10; // Prevent division by zero

        // Draw lines
        this.drawGraphLine(ctx, width, height, this.matchData.killHistory,
            'team1Kills', this.colors.team1, maxKills);
        this.drawGraphLine(ctx, width, height, this.matchData.killHistory,
            'team2Kills', this.colors.team2, maxKills);

        // Draw legend
        this.drawGraphLegend(ctx, width, height);
    }

    /**
     * Draw graph grid and axes
     */
    drawGraphGrid(ctx, width, height, title) {
        const padding = 40;

        // Draw title
        ctx.font = '12px "Rajdhani", sans-serif';
        ctx.fillStyle = '#b4b8c5';
        ctx.textAlign = 'center';
        ctx.fillText(title, width / 2, 20);

        // Draw axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;

        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.stroke();

        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        for (let i = 0; i < 5; i++) {
            const y = padding + (height - 2 * padding) * i / 4;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }

        // X-axis label
        ctx.font = '10px "Share Tech Mono", monospace';
        ctx.fillStyle = '#7a7f8f';
        ctx.textAlign = 'center';
        ctx.fillText('Wave', width / 2, height - 10);

        // Reset text align
        ctx.textAlign = 'left';
    }

    /**
     * Draw graph line
     */
    drawGraphLine(ctx, width, height, data, field, color, maxValue) {
        const padding = 40;
        const graphWidth = width - 2 * padding;
        const graphHeight = height - 2 * padding;

        if (data.length < 2) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        data.forEach((entry, index) => {
            const x = padding + (graphWidth * index / (data.length - 1));
            const value = entry[field] || 0;
            const y = height - padding - (graphHeight * value / maxValue);

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // Draw fill area
        ctx.fillStyle = color.replace('0.8', '0.1');
        ctx.lineTo(width - padding, height - padding);
        ctx.lineTo(padding, height - padding);
        ctx.closePath();
        ctx.fill();
    }

    /**
     * Draw graph legend
     */
    drawGraphLegend(ctx, width, height) {
        const padding = 40;

        ctx.font = '10px "Share Tech Mono", monospace';

        // Team 1 legend
        ctx.fillStyle = this.colors.team1;
        ctx.fillRect(width - padding - 80, 30, 12, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Team 1', width - padding - 60, 40);

        // Team 2 legend
        ctx.fillStyle = this.colors.team2;
        ctx.fillRect(width - padding - 80, 50, 12, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Team 2', width - padding - 60, 60);
    }

    /**
     * Render event timeline
     */
    renderEventTimeline() {
        const timelineEl = document.getElementById('event-timeline');
        if (!timelineEl) return;

        timelineEl.innerHTML = '';

        // Display last 20 events
        const recentEvents = this.matchData.events.slice(-20);

        recentEvents.forEach(event => {
            const eventEl = document.createElement('div');
            eventEl.className = `timeline-event timeline-event-${event.type}`;

            // Set background color based on team
            if (event.team === 'team1') {
                eventEl.style.backgroundColor = this.colors.team1Fill;
            } else if (event.team === 'team2') {
                eventEl.style.backgroundColor = this.colors.team2Fill;
            }

            eventEl.innerHTML = `
                <div class="timeline-event-wave">W${event.wave}</div>
                <div class="timeline-event-desc">${event.description}</div>
            `;

            eventEl.title = `Wave ${event.wave}: ${event.description}`;
            timelineEl.appendChild(eventEl);
        });

        // Auto-scroll to the right (most recent)
        timelineEl.scrollLeft = timelineEl.scrollWidth;
    }

    /**
     * Reset visualization for new match
     */
    reset() {
        this.matchData = {
            wave: 0,
            maxWaves: 150,
            team1: { kills: 0, gold: 0, champions: [] },
            team2: { kills: 0, gold: 0, champions: [] },
            goldHistory: [],
            killHistory: [],
            events: []
        };

        if (this.isInitialized) {
            this.drawMinimap();
            this.drawGoldGraph();
            this.drawKillGraph();
            this.renderEventTimeline();
        }
    }
}

// Export for use in app.js
window.MatchVisualization = MatchVisualization;
