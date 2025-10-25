
const { getRandomAbsurdistEvent, getRandomAbsurdistCommentary } = require('./absurdistEvents');
const { simulateLaning } = require('./laning');
const { simulateJungling } = require('./jungling');
const { simulateTeamfight } = require('./teamfights');
const { simulateObjective } = require('./objectives');
const { ChaosManager } = require('./chaosEvents');
const { WeatherSystem } = require('./weather');
const { CommentaryEngine } = require('./commentaryEngine');

class Match {
    constructor(team1, team2, wss) {
        this.team1 = team1;
        this.team2 = team2;
        this.wss = wss;
        this.log = [];
        this.wave = 0;
        this.interval = null;
        this.eventListeners = {};

        // Initialize commentary engine before using it
        this.commentary = new CommentaryEngine(this);

        this.logEvent(`Match starting: ${team1.name} vs ${team2.name}`);
        this.logEvent(this.commentary.getTemplate('start', { team1: team1.name, team2: team2.name }));

        // Map champions to roles for easier access during simulation
        this.team1Lanes = {};
        this.team2Lanes = {};
        team1.champions.forEach(c => this.team1Lanes[c.role] = c);
        team2.champions.forEach(c => this.team2Lanes[c.role] = c);

        this.team1Towers = 11; // 3 outer, 3 inner, 3 inhib, 2 nexus
        this.team2Towers = 11;
        this.match_ended = false; // New flag
        this.chaosState = {}; // Store chaos event states
        this.chaosManager = new ChaosManager(this); // Initialize chaos manager
        this.weatherSystem = new WeatherSystem(this); // Initialize weather system
        this.weatherSystem.initialize(); // Start weather
    }

    on(eventName, listener) {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(listener);
    }

    emit(eventName, ...args) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName].forEach(listener => listener(...args));
        }
    }

    logEvent(message) {
        this.log.push(message);
        this.wss.clients.forEach(client => client.send(message));
    }

    start() {
        const waveInterval = Math.floor(Math.random() * 6 + 10) * 1000; // 10-15 seconds
        this.interval = setInterval(() => {
            this.wave++;
            this.logEvent(`--- Wave ${this.wave} ---`);

            // Trigger chaos events at start of wave
            this.chaosManager.onWaveStart();

            // Process weather effects
            this.weatherSystem.onWaveStart();

            this.simulateWave();

            // Check for tower deaths after mid/late game teamfights
            if (this.wave > 20 && Math.random() < 0.1 && (this.team1Towers > 0 || this.team2Towers > 0)) { // 10% chance for a tower to fall
                if (Math.random() > 0.5 && this.team1Towers > 0) {
                    this.team1Towers--;
                    this.logEvent(`A moment of silence for a fallen tower of ${this.team1.name}.`);
                } else if (this.team2Towers > 0) {
                    this.team2Towers--;
                    this.logEvent(`A moment of silence for a fallen tower of ${this.team2.name}.`);
                }
            }

            if (this.wave >= 60 || this.team1Towers <= 0 || this.team2Towers <= 0) { // End if max waves or all towers down
                this.end();
            }
        }, waveInterval);
    }

    simulateWave() {
        // Update commentary engine match state
        this.commentary.updateMatchState(this.team1.champions, this.team2.champions);

        // Check for comeback status and announce if needed
        const comebackCommentary = this.commentary.checkComebackStatus();
        if (comebackCommentary) {
            this.logEvent(comebackCommentary);
        }

        // Laning phase (waves 1-20)
        if (this.wave <= 20) {
            const roles = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
            roles.forEach(role => {
                const team1Champ = this.team1Lanes[role];
                const team2Champ = this.team2Lanes[role];
                if (team1Champ && team2Champ) {
                    simulateLaning(team1Champ, team2Champ, this.logEvent.bind(this), this.commentary);
                }
            });
            simulateJungling(this.team1Lanes['Jungle'], this.logEvent.bind(this), this.commentary);
            simulateJungling(this.team2Lanes['Jungle'], this.logEvent.bind(this), this.commentary);
        }

        // Mid game (waves 21-40)
        if (this.wave > 20 && this.wave <= 40) {
            if (Math.random() < 0.3) { // 30% chance of a teamfight in mid game
                simulateTeamfight(this.team1.champions, this.team2.champions, this.logEvent.bind(this), this.commentary);
            }
            simulateObjective(this.team1, this.team2, this.wave, this.logEvent.bind(this), this.commentary);
        }

        // Late game (waves 41+)
        if (this.wave > 40) {
            if (Math.random() < 0.5) { // 50% chance of a teamfight in late game
                simulateTeamfight(this.team1.champions, this.team2.champions, this.logEvent.bind(this), this.commentary);
            }
            simulateObjective(this.team1, this.team2, this.wave, this.logEvent.bind(this), this.commentary);
        }

        // Occasional wave commentary (not every wave)
        const waveCommentary = this.commentary.generateWaveCommentary(this.wave);
        if (waveCommentary) {
            this.logEvent(waveCommentary);
        }

        // Keep some absurdist commentary for flavor (10% chance)
        if (Math.random() < 0.1) {
            this.logEvent(getRandomAbsurdistCommentary('wave', { wave: this.wave }));
        }
    }

    end() {
        clearInterval(this.interval);
        this.match_ended = true; // Set flag
        let winner = null;
        let loser = null;

        if (this.team1Towers <= 0) {
            winner = this.team2;
            loser = this.team1;
        } else if (this.team2Towers <= 0) {
            winner = this.team1;
            loser = this.team2;
        } else { // If max waves reached, random winner
            winner = Math.random() > 0.5 ? this.team1 : this.team2;
            loser = winner === this.team1 ? this.team2 : this.team1;
        }

        this.logEvent(`Match ended! ${winner.name} wins!`);

        // Use commentary engine for end commentary
        const descriptor = Math.abs(this.commentary.momentum) > 50 ? 'dominant' : 'hard-fought';
        this.logEvent(this.commentary.getTemplate('end', {
            winner: winner.name,
            loser: loser.name,
            descriptor
        }));

        this.emit('end', winner, loser);
    }
}


module.exports = Match;
