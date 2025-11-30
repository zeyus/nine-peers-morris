/**
 * Interface for objects that can be dehydrated to a string and rehydrated from that string
 */
export interface Hydratable {
    /**
     * Serializes the object to a JSON string
     */
    dehydrate(): string;
}

/**
 * Interface for classes that can create instances from dehydrated state
 */
export interface HydratableClass<T> {
    /**
     * Creates an instance from a dehydrated string
     */
    rehydrate(data: string, ...args: any[]): T;
}
