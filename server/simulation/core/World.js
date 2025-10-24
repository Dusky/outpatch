/**
 * World - ECS container for all entities and game state
 *
 * Manages entities and provides query methods for systems.
 */
class World {
    constructor() {
        this.entities = new Map();
        this.entitiesByTag = new Map();
        this.tick = 0;
        this.metadata = {};
    }

    /**
     * Add entity to world
     * @param {Entity} entity
     * @returns {Entity}
     */
    addEntity(entity) {
        this.entities.set(entity.id, entity);

        // Index by tags
        for (const tag of entity.tags) {
            if (!this.entitiesByTag.has(tag)) {
                this.entitiesByTag.set(tag, new Set());
            }
            this.entitiesByTag.get(tag).add(entity.id);
        }

        return entity;
    }

    /**
     * Remove entity from world
     * @param {number} entityId
     * @returns {boolean}
     */
    removeEntity(entityId) {
        const entity = this.entities.get(entityId);
        if (!entity) return false;

        // Remove from tag indices
        for (const tag of entity.tags) {
            const tagSet = this.entitiesByTag.get(tag);
            if (tagSet) {
                tagSet.delete(entityId);
                if (tagSet.size === 0) {
                    this.entitiesByTag.delete(tag);
                }
            }
        }

        return this.entities.delete(entityId);
    }

    /**
     * Get entity by ID
     * @param {number} id
     * @returns {Entity|undefined}
     */
    getEntity(id) {
        return this.entities.get(id);
    }

    /**
     * Query entities by component requirements
     * @param {string[]} componentTypes
     * @returns {Entity[]}
     */
    query(...componentTypes) {
        const results = [];
        for (const entity of this.entities.values()) {
            if (entity.hasComponents(...componentTypes)) {
                results.push(entity);
            }
        }
        return results;
    }

    /**
     * Query entities by tag
     * @param {string} tag
     * @returns {Entity[]}
     */
    queryByTag(tag) {
        const entityIds = this.entitiesByTag.get(tag);
        if (!entityIds) return [];

        return Array.from(entityIds)
            .map(id => this.entities.get(id))
            .filter(e => e !== undefined);
    }

    /**
     * Query entities by multiple tags (AND logic)
     * @param {string[]} tags
     * @returns {Entity[]}
     */
    queryByTags(...tags) {
        if (tags.length === 0) return [];

        // Start with smallest set for efficiency
        const sets = tags.map(tag => this.entitiesByTag.get(tag) || new Set());
        sets.sort((a, b) => a.size - b.size);

        const results = [];
        for (const entityId of sets[0]) {
            if (sets.every(set => set.has(entityId))) {
                const entity = this.entities.get(entityId);
                if (entity) results.push(entity);
            }
        }

        return results;
    }

    /**
     * Get all entities
     * @returns {Entity[]}
     */
    getAllEntities() {
        return Array.from(this.entities.values());
    }

    /**
     * Get entity count
     * @returns {number}
     */
    getEntityCount() {
        return this.entities.size;
    }

    /**
     * Clear all entities
     */
    clear() {
        this.entities.clear();
        this.entitiesByTag.clear();
        this.tick = 0;
    }

    /**
     * Advance world tick
     */
    advanceTick() {
        this.tick++;
    }

    /**
     * Get current tick
     * @returns {number}
     */
    getTick() {
        return this.tick;
    }

    /**
     * Set metadata
     * @param {string} key
     * @param {*} value
     */
    setMetadata(key, value) {
        this.metadata[key] = value;
    }

    /**
     * Get metadata
     * @param {string} key
     * @returns {*}
     */
    getMetadata(key) {
        return this.metadata[key];
    }

    /**
     * Serialize world state (for snapshots)
     * @returns {object}
     */
    serialize() {
        const entities = {};
        for (const [id, entity] of this.entities) {
            entities[id] = entity.serialize();
        }

        return {
            tick: this.tick,
            entities,
            metadata: { ...this.metadata }
        };
    }

    /**
     * Get statistics about world state
     * @returns {object}
     */
    getStats() {
        const componentCounts = {};
        const tagCounts = {};

        for (const entity of this.entities.values()) {
            for (const type of entity.getComponentTypes()) {
                componentCounts[type] = (componentCounts[type] || 0) + 1;
            }
            for (const tag of entity.tags) {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
        }

        return {
            entityCount: this.entities.size,
            tick: this.tick,
            componentCounts,
            tagCounts
        };
    }
}

module.exports = World;
