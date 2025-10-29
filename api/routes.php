<?php
/**
 * REST API Router
 * Dispatches HTTP requests to appropriate handlers
 */

declare(strict_types=1);

class APIRouter {
    private array $routes = [];

    public function __construct() {
        $this->registerRoutes();
    }

    private function registerRoutes(): void {
        $this->routes['POST']['/heal'] = 'HealHandler';
        $this->routes['GET']['/status'] = 'StatusHandler';
        $this->routes['POST']['/classify'] = 'ClassifyHandler';
    }

    public function route(string $method, string $path): ?string {
        return $this->routes[$method][$path] ?? null;
    }

    public function getAvailableRoutes(): array {
        return $this->routes;
    }
}
