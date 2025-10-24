const seedrandom = require('seedrandom');

/**
 * Seeded RNG Manager
 *
 * Provides deterministic random number generation with substream support.
 * Each subsystem (lane, jungle, teamfight, etc.) gets its own forked RNG
 * to ensure isolated determinism.
 *
 * Usage:
 *   const rng = new RNG('match-12345');
 *   const laneRng = rng.fork('lane:top');
 *   const value = laneRng.random(); // 0-1
 *   const int = laneRng.int(1, 6);  // 1-6 inclusive
 */
class RNG {
    constructor(seed, path = []) {
        this.seed = seed;
        this.path = path;
        this.fullSeed = this._computeFullSeed(seed, path);
        this.prng = seedrandom(this.fullSeed);
        this.callCount = 0;
    }

    /**
     * Generate seed string from base seed + path components
     */
    _computeFullSeed(baseSeed, path) {
        if (path.length === 0) {
            return String(baseSeed);
        }
        return `${baseSeed}:${path.join(':')}`;
    }

    /**
     * Create a forked RNG for a subsystem
     * @param {string} name - Subsystem name (e.g., 'lane:top', 'teamfight:1')
     * @returns {RNG} New RNG instance with forked seed
     */
    fork(name) {
        return new RNG(this.seed, [...this.path, name]);
    }

    /**
     * Generate random float [0, 1)
     * @returns {number}
     */
    random() {
        this.callCount++;
        return this.prng();
    }

    /**
     * Generate random integer [min, max] (inclusive)
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    int(min, max) {
        return Math.floor(this.random() * (max - min + 1)) + min;
    }

    /**
     * Generate random float [min, max)
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    float(min, max) {
        return this.random() * (max - min) + min;
    }

    /**
     * Roll a probability check
     * @param {number} probability - Chance of success [0-1]
     * @returns {boolean}
     */
    chance(probability) {
        return this.random() < probability;
    }

    /**
     * Pick random element from array
     * @param {Array} array
     * @returns {*}
     */
    choice(array) {
        if (array.length === 0) return undefined;
        return array[this.int(0, array.length - 1)];
    }

    /**
     * Weighted random selection
     * @param {Array<{item: any, weight: number}>} items
     * @returns {*}
     */
    weightedChoice(items) {
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        let roll = this.float(0, totalWeight);

        for (const item of items) {
            roll -= item.weight;
            if (roll <= 0) {
                return item.item;
            }
        }

        return items[items.length - 1].item;
    }

    /**
     * Shuffle array in place (Fisher-Yates)
     * @param {Array} array
     * @returns {Array} Same array, shuffled
     */
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Normal distribution (Box-Muller transform)
     * @param {number} mean
     * @param {number} stdDev
     * @returns {number}
     */
    normal(mean = 0, stdDev = 1) {
        const u1 = this.random();
        const u2 = this.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return z0 * stdDev + mean;
    }

    /**
     * Get current RNG state for debugging
     * @returns {object}
     */
    getState() {
        return {
            seed: this.seed,
            path: this.path,
            fullSeed: this.fullSeed,
            callCount: this.callCount
        };
    }
}

module.exports = RNG;
