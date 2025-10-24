/**
 * Entity - Base class for ECS entities
 *
 * An entity is just an ID + collection of components.
 * Systems query entities by their component composition.
 */
class Entity {
    static nextId = 1;

    constructor(id = null) {
        this.id = id || Entity.nextId++;
        this.components = new Map();
        this.tags = new Set();
    }

    /**
     * Add a component to this entity
     * @param {string} type - Component type name
     * @param {object} component - Component instance
     */
    addComponent(type, component) {
        this.components.set(type, component);
        return this;
    }

    /**
     * Get a component by type
     * @param {string} type
     * @returns {object|undefined}
     */
    getComponent(type) {
        return this.components.get(type);
    }

    /**
     * Check if entity has a component
     * @param {string} type
     * @returns {boolean}
     */
    hasComponent(type) {
        return this.components.has(type);
    }

    /**
     * Check if entity has all specified components
     * @param {string[]} types
     * @returns {boolean}
     */
    hasComponents(...types) {
        return types.every(type => this.components.has(type));
    }

    /**
     * Remove a component
     * @param {string} type
     * @returns {boolean}
     */
    removeComponent(type) {
        return this.components.delete(type);
    }

    /**
     * Add a tag for quick filtering
     * @param {string} tag
     */
    addTag(tag) {
        this.tags.add(tag);
        return this;
    }

    /**
     * Check if entity has a tag
     * @param {string} tag
     * @returns {boolean}
     */
    hasTag(tag) {
        return this.tags.has(tag);
    }

    /**
     * Remove a tag
     * @param {string} tag
     * @returns {boolean}
     */
    removeTag(tag) {
        return this.tags.delete(tag);
    }

    /**
     * Get all component types
     * @returns {string[]}
     */
    getComponentTypes() {
        return Array.from(this.components.keys());
    }

    /**
     * Serialize entity state
     * @returns {object}
     */
    serialize() {
        const components = {};
        for (const [type, component] of this.components) {
            components[type] = { ...component };
        }
        return {
            id: this.id,
            components,
            tags: Array.from(this.tags)
        };
    }

    /**
     * Clone entity (shallow copy of components)
     * @returns {Entity}
     */
    clone() {
        const clone = new Entity(this.id);
        for (const [type, component] of this.components) {
            clone.addComponent(type, { ...component });
        }
        for (const tag of this.tags) {
            clone.addTag(tag);
        }
        return clone;
    }
}

module.exports = Entity;
