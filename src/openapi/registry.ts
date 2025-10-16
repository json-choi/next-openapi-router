import type { HttpMethod, RouteRegistration } from '../core/types';

/**
 * Global route registry for OpenAPI generation
 * This stores all registered routes for documentation generation
 */
class RouteRegistry {
    private readonly routes: Map<string, RouteRegistration> = new Map();
    private initialized: boolean = false;

    /**
     * Initialize the registry (called automatically)
     */
    private initialize(): void {
        if (this.initialized) return;

        this.routes.clear();
        this.initialized = true;
    }

    /**
     * Register a route for OpenAPI documentation
     * @param registration - Route registration information
     */
    register(registration: RouteRegistration): void {
        this.initialize();

        const key = this.createRouteKey(registration.path, registration.method);
        this.routes.set(key, registration);
    }

    /**
     * Get all registered routes
     * @returns Array of route registrations
     */
    getRoutes(): RouteRegistration[] {
        this.initialize();
        return Array.from(this.routes.values());
    }

    /**
     * Get routes for a specific path
     * @param path - Route path
     * @returns Array of route registrations for the path
     */
    getRoutesForPath(path: string): RouteRegistration[] {
        this.initialize();
        return this.getRoutes().filter(route => route.path === path);
    }

    /**
     * Get a specific route registration
     * @param path - Route path
     * @param method - HTTP method
     * @returns Route registration or undefined
     */
    getRoute(path: string, method: HttpMethod): RouteRegistration | undefined {
        this.initialize();
        const key = this.createRouteKey(path, method);
        return this.routes.get(key);
    }

    /**
     * Remove a route registration
     * @param path - Route path
     * @param method - HTTP method
     * @returns True if route was removed
     */
    unregister(path: string, method: HttpMethod): boolean {
        this.initialize();
        const key = this.createRouteKey(path, method);
        return this.routes.delete(key);
    }

    /**
     * Clear all registered routes
     */
    clear(): void {
        this.routes.clear();
    }

    /**
     * Get all unique paths
     * @returns Array of unique route paths
     */
    getPaths(): string[] {
        this.initialize();
        const paths = new Set(this.getRoutes().map(route => route.path));
        return Array.from(paths).sort();
    }

    /**
     * Get all methods for a specific path
     * @param path - Route path
     * @returns Array of HTTP methods for the path
     */
    getMethodsForPath(path: string): HttpMethod[] {
        return this.getRoutesForPath(path).map(route => route.method);
    }

    /**
     * Get registry statistics
     * @returns Statistics about the registry
     */
    getStats(): {
        totalRoutes: number;
        uniquePaths: number;
        methodDistribution: Record<HttpMethod, number>;
        pathsWithMultipleMethods: number;
    } {
        this.initialize();
        const routes = this.getRoutes();
        const paths = this.getPaths();

        const methodDistribution: Record<string, number> = {};
        routes.forEach(route => {
            methodDistribution[route.method] = (methodDistribution[route.method] ?? 0) + 1;
        });

        const pathsWithMultipleMethods = paths.filter(
            path => this.getMethodsForPath(path).length > 1
        ).length;

        return {
            totalRoutes: routes.length,
            uniquePaths: paths.length,
            methodDistribution: methodDistribution as Record<HttpMethod, number>,
            pathsWithMultipleMethods,
        };
    }

    /**
     * Check if a route is registered
     * @param path - Route path
     * @param method - HTTP method
     * @returns True if route is registered
     */
    hasRoute(path: string, method: HttpMethod): boolean {
        this.initialize();
        const key = this.createRouteKey(path, method);
        return this.routes.has(key);
    }

    /**
     * Update a route registration
     * @param path - Route path
     * @param method - HTTP method
     * @param registration - New registration data
     * @returns True if route was updated
     */
    updateRoute(path: string, method: HttpMethod, registration: RouteRegistration): boolean {
        this.initialize();
        const key = this.createRouteKey(path, method);

        if (this.routes.has(key)) {
            this.routes.set(key, registration);
            return true;
        }

        return false;
    }

    /**
     * Create a unique key for a route
     * @param path - Route path
     * @param method - HTTP method
     * @returns Unique route key
     */
    private createRouteKey(path: string, method: HttpMethod): string {
        return `${method.toUpperCase()}:${path}`;
    }

    /**
     * Convert Next.js dynamic route path to OpenAPI path
     * @param nextPath - Next.js route path (e.g., '/api/users/[id]')
     * @returns OpenAPI path (e.g., '/api/users/{id}')
     */
    convertNextPathToOpenAPI(nextPath: string): string {
        return nextPath
            .replace(/\[([^\]]+)\]/g, '{$1}') // [id] -> {id}
            .replace(/\[\.\.\.([^\]]+)\]/g, '{$1*}'); // [...slug] -> {slug*}
    }

    /**
     * Group routes by path for OpenAPI generation
     * @returns Map of paths to their route registrations
     */
    getRoutesGroupedByPath(): Map<string, RouteRegistration[]> {
        this.initialize();
        const grouped = new Map<string, RouteRegistration[]>();

        this.getRoutes().forEach(route => {
            const openApiPath = this.convertNextPathToOpenAPI(route.path);

            if (!grouped.has(openApiPath)) {
                grouped.set(openApiPath, []);
            }

            const pathRoutes = grouped.get(openApiPath);
            if (pathRoutes) {
                pathRoutes.push(route);
            }
        });

        return grouped;
    }

    /**
     * Export registry data for serialization
     * @returns Serializable registry data
     */
    export(): {
        routes: RouteRegistration[];
        stats: ReturnType<RouteRegistry['getStats']>;
        timestamp: string;
    } {
        return {
            routes: this.getRoutes(),
            stats: this.getStats(),
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Import registry data from serialized format
     * @param data - Serialized registry data
     */
    import(data: { routes: RouteRegistration[] }): void {
        this.clear();
        data.routes.forEach(route => this.register(route));
    }

    /**
     * Validate registry consistency
     * @returns Array of validation issues
     */
    validate(): string[] {
        this.initialize();
        const issues: string[] = [];
        const routes = this.getRoutes();

        // Check for duplicate route keys
        const keys = new Set<string>();
        routes.forEach(route => {
            const key = this.createRouteKey(route.path, route.method);
            if (keys.has(key)) {
                issues.push(`Duplicate route: ${route.method} ${route.path}`);
            }
            keys.add(key);
        });

        // Check for missing required metadata
        routes.forEach(route => {
            if (!route.path) {
                issues.push(`Route missing path: ${JSON.stringify(route)}`);
            }
            if (!route.method) {
                issues.push(`Route missing method: ${JSON.stringify(route)}`);
            }
        });

        return issues;
    }
}

// Create singleton instance
const routeRegistry = new RouteRegistry();

// Export registry instance
export { routeRegistry };

// Export convenience functions
export function registerRoute(registration: RouteRegistration): void {
    routeRegistry.register(registration);
}

export function getRoutes(): RouteRegistration[] {
    return routeRegistry.getRoutes();
}

export function getRoute(path: string, method: HttpMethod): RouteRegistration | undefined {
    return routeRegistry.getRoute(path, method);
}

export function clearRoutes(): void {
    routeRegistry.clear();
}

export function getRoutesGroupedByPath(): Map<string, RouteRegistration[]> {
    return routeRegistry.getRoutesGroupedByPath();
}

export function getRegistryStats(): ReturnType<RouteRegistry['getStats']> {
    return routeRegistry.getStats();
}

export function exportRegistry(): ReturnType<RouteRegistry['export']> {
    return routeRegistry.export();
}

export function importRegistry(data: { routes: RouteRegistration[] }): void {
    routeRegistry.import(data);
}

export function validateRegistry(): string[] {
    return routeRegistry.validate();
}

// Export the registry class for advanced usage
export { RouteRegistry };
