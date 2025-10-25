/**
 * EventLog - Append-only event store for match history
 *
 * All state changes emit typed events that are logged here.
 * Enables replay, analysis, and debugging.
 */

class EventLog {
    constructor() {
        this.events = [];
        this.eventsByType = new Map();
        this.snapshotInterval = 10;  // Save state snapshot every N ticks
        this.snapshots = [];
    }

    /**
     * Log a new event
     * @param {object} event - Event object with type, tick, entities, and data
     */
    log(event) {
        const fullEvent = {
            ...event,
            index: this.events.length,
            timestamp: Date.now()
        };

        this.events.push(fullEvent);

        // Index by type for fast queries
        if (!this.eventsByType.has(event.type)) {
            this.eventsByType.set(event.type, []);
        }
        this.eventsByType.get(event.type).push(fullEvent);

        return fullEvent;
    }

    /**
     * Save a state snapshot
     * @param {number} tick
     * @param {object} state - Serialized world state
     */
    saveSnapshot(tick, state) {
        this.snapshots.push({
            tick,
            state,
            eventIndex: this.events.length
        });
    }

    /**
     * Get all events
     * @returns {object[]}
     */
    getAllEvents() {
        return [...this.events];
    }

    /**
     * Get events by type
     * @param {string} type
     * @returns {object[]}
     */
    getEventsByType(type) {
        return this.eventsByType.get(type) || [];
    }

    /**
     * Get events in tick range
     * @param {number} startTick
     * @param {number} endTick
     * @returns {object[]}
     */
    getEventsByTickRange(startTick, endTick) {
        return this.events.filter(e => e.tick >= startTick && e.tick <= endTick);
    }

    /**
     * Get events involving specific entity
     * @param {number} entityId
     * @returns {object[]}
     */
    getEventsByEntity(entityId) {
        return this.events.filter(e => {
            if (e.entityId === entityId) return true;
            if (e.entities && e.entities.includes(entityId)) return true;
            if (e.source === entityId || e.target === entityId) return true;
            return false;
        });
    }

    /**
     * Get most recent snapshot before or at tick
     * @param {number} tick
     * @returns {object|null}
     */
    getSnapshotBeforeTick(tick) {
        for (let i = this.snapshots.length - 1; i >= 0; i--) {
            if (this.snapshots[i].tick <= tick) {
                return this.snapshots[i];
            }
        }
        return null;
    }

    /**
     * Get event count
     * @returns {number}
     */
    getEventCount() {
        return this.events.length;
    }

    /**
     * Get statistics about event log
     * @returns {object}
     */
    getStats() {
        const typeCounts = {};
        for (const [type, events] of this.eventsByType) {
            typeCounts[type] = events.length;
        }

        return {
            totalEvents: this.events.length,
            eventTypes: Object.keys(typeCounts).length,
            typeCounts,
            snapshots: this.snapshots.length,
            firstTick: this.events.length > 0 ? this.events[0].tick : null,
            lastTick: this.events.length > 0 ? this.events[this.events.length - 1].tick : null
        };
    }

    /**
     * Export events as JSON
     * @returns {string}
     */
    export() {
        return JSON.stringify({
            events: this.events,
            snapshots: this.snapshots
        }, null, 2);
    }

    /**
     * Clear all events
     */
    clear() {
        this.events = [];
        this.eventsByType.clear();
        this.snapshots = [];
    }
}

/**
 * Event type constants
 */
EventLog.EventTypes = {
    // Match lifecycle
    MATCH_START: 'match.start',
    MATCH_END: 'match.end',
    WAVE_START: 'wave.start',
    WAVE_END: 'wave.end',

    // Draft
    DRAFT_PICK: 'draft.pick',
    DRAFT_BAN: 'draft.ban',

    // Lane phase
    LANE_CS: 'lane.cs',
    LANE_TRADE: 'lane.trade',
    LANE_KILL: 'lane.kill',
    LANE_PRESSURE: 'lane.pressure',

    // Jungle
    JUNGLE_CAMP: 'jungle.camp',
    JUNGLE_GANK: 'jungle.gank',
    JUNGLE_COUNTERGANK: 'jungle.countergank',

    // Combat
    FIGHT_START: 'fight.start',
    FIGHT_DAMAGE: 'fight.damage',
    FIGHT_KILL: 'fight.kill',
    FIGHT_ASSIST: 'fight.assist',
    FIGHT_END: 'fight.end',

    // Abilities
    ABILITY_CAST: 'ability.cast',
    ULTIMATE_CAST: 'ultimate.cast',

    // Objectives
    OBJECTIVE_START: 'objective.start',
    OBJECTIVE_CONTEST: 'objective.contest',
    OBJECTIVE_SECURE: 'objective.secure',
    OBJECTIVE_STEAL: 'objective.steal',

    // Economy
    ITEM_PURCHASE: 'item.purchase',
    ITEM_SELL: 'item.sell',
    GOLD_EARN: 'gold.earn',

    // Structures
    TOWER_DAMAGE: 'tower.damage',
    TOWER_DESTROY: 'tower.destroy',
    STRUCTURE_DESTROYED: 'structure.destroyed',
    INHIBITOR_DESTROY: 'inhibitor.destroy',
    GATEWAY_DESTROYED: 'gateway.destroyed',
    NEXUS_DAMAGE: 'nexus.damage',

    // Status
    BUFF_APPLY: 'buff.apply',
    BUFF_EXPIRE: 'buff.expire',
    DEBUFF_APPLY: 'debuff.apply',
    CC_APPLY: 'cc.apply',

    // Tilt & mental
    TILT_INCREASE: 'tilt.increase',
    TILT_DECREASE: 'tilt.decrease',
    MENTAL_BOOM: 'mental.boom',

    // Chaos events
    CHAOS_EVENT: 'chaos.event',
    WEATHER_CHANGE: 'weather.change',
    QUIRK_PROC: 'quirk.proc'
};

module.exports = EventLog;
