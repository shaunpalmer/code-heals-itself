<?php
/**
 * API Middleware - Error handling, validation, response formatting
 */

declare(strict_types=1);

namespace CodeHealsItself\Api;

class APIResponse {
    public static function json(array $data, int $httpCode = 200): string {
        http_response_code($httpCode);
        header('Content-Type: application/json');
        return json_encode($data, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    }

    public static function error(string $message, int $httpCode = 400): string {
        return self::json([
            'success' => false,
            'error' => $message,
            'timestamp' => date('c'),
        ], $httpCode);
    }

    public static function success(array $data, int $httpCode = 200): string {
        return self::json([
            'success' => true,
            'data' => $data,
            'timestamp' => date('c'),
        ], $httpCode);
    }
}

class APIValidator {
    public static function validateJSON(string $body): array {
        if (empty($body)) {
            throw new \Exception('Request body cannot be empty');
        }

        $data = json_decode($body, true);
        if ($data === null) {
            throw new \Exception('Invalid JSON in request body');
        }

        return $data;
    }

    public static function validateMethod(string $required, string $actual): void {
        if (strtoupper($required) !== strtoupper($actual)) {
            throw new \Exception("Method must be {$required}, got {$actual}");
        }
    }

    public static function validateContentType(string $method): void {
        if (in_array($method, ['POST', 'PUT', 'PATCH'])) {
            // Some SAPIs (built-in server, proxies) populate HTTP_CONTENT_TYPE instead
            $contentType = $_SERVER['CONTENT_TYPE']
                ?? $_SERVER['HTTP_CONTENT_TYPE']
                ?? '';
            // Be lenient: if header missing but body decodes as JSON later, allow it
            if ($contentType !== '') {
                if (stripos($contentType, 'application/json') === false) {
                    throw new \Exception('Content-Type must be application/json');
                }
            }
        }
    }
}

class APIMiddleware {
    public static function handleException(\Throwable $e): string {
        error_log('[API ERROR] ' . $e->getMessage());
        return APIResponse::error($e->getMessage(), 500);
    }

    public static function handleNotFound(): string {
        return APIResponse::error('Endpoint not found', 404);
    }

    public static function handleMethodNotAllowed(): string {
        return APIResponse::error('Method not allowed', 405);
    }
}
