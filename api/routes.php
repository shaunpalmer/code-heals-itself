<?php
/**
 * REST API Router
 * Dispatches HTTP requests to appropriate handlers
 */

declare(strict_types=1);

namespace CodeHealsItself\Api;

class APIRouter {
    private array $routes = [];

    public function __construct() {
        $this->registerRoutes();
    }

    private function registerRoutes(): void {
        $this->routes['POST']['/heal'] = 'CodeHealsItself\Api\Handlers\HealHandler';
        $this->routes['GET']['/status'] = 'CodeHealsItself\Api\Handlers\StatusHandler';
        $this->routes['POST']['/classify'] = 'CodeHealsItself\Api\Handlers\ClassifyHandler';
    }

    public function route(string $method, string $path): ?string {
        return $this->routes[$method][$path] ?? null;
    }

    public function getAvailableRoutes(): array {
        return $this->routes;
    }
}
