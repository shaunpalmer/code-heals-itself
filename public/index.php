<?php
/**
 * API Entry Point - public/index.php
 * Routes HTTP requests to appropriate handlers
 */

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Load dependencies
require_once __DIR__ . '/../api/routes.php';
require_once __DIR__ . '/../api/middleware.php';
require_once __DIR__ . '/../api/handlers/HealHandler.php';
require_once __DIR__ . '/../api/handlers/StatusHandler.php';
require_once __DIR__ . '/../api/handlers/ClassifyHandler.php';

try {
    // Parse request
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $path = str_replace('/api', '', $path); // Remove /api prefix

    // Get body
    $body = file_get_contents('php://input');

    // Validate content type for POST/PUT/PATCH
    APIValidator::validateContentType($method);

    // Get router and find handler
    $router = new APIRouter();
    $handlerClass = $router->route($method, $path);

    if (!$handlerClass) {
        echo APIMiddleware::handleNotFound();
        exit(1);
    }

    // Instantiate and call handler
    $handler = new $handlerClass();

    if ($method === 'GET') {
        // GET requests don't have body
        $result = $handler->handle();
    } else {
        // POST/PUT require JSON body
        $payload = APIValidator::validateJSON($body);
        $result = $handler->handle($payload);
    }

    // Return response
    echo APIResponse::json($result, $result['success'] ? 200 : 400);

} catch (Exception $e) {
    echo APIMiddleware::handleException($e);
    exit(1);
}
