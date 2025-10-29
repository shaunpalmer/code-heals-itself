<?php
/**
 * API Entry Point - public/index.php
 * Routes HTTP requests to appropriate handlers
 */

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Define project paths as constants
define('PROJECT_ROOT', dirname(__DIR__));
define('API_DIR', PROJECT_ROOT . '/api');
define('HANDLERS_DIR', API_DIR . '/handlers');
define('UTILS_DIR', PROJECT_ROOT . '/utils');

// Load Composer autoloader first (handles PSR-4 namespaced classes)
require_once PROJECT_ROOT . '/vendor/autoload.php';

// Load API infrastructure classes (multiple classes per file - explicit requires for clarity)
require_once API_DIR . '/middleware.php';  // APIValidator, APIMiddleware, APIResponse
require_once API_DIR . '/routes.php';       // APIRouter

use CodeHealsItself\Api\APIValidator;
use CodeHealsItself\Api\APIMiddleware;
use CodeHealsItself\Api\APIRouter;
use CodeHealsItself\Api\APIResponse;

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

} catch (\Exception $e) {
    echo APIMiddleware::handleException($e);
    exit(1);
}
