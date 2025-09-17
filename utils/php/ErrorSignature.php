<?php

/**
 * ErrorSignature - Language-agnostic error fingerprinting for PHP
 * 
 * Normalizes PHP Throwables into consistent signatures
 * to prevent duplicate retry attempts on identical failures.
 */

class ErrorSignatureData {
    public string $signature;
    public string $type;
    public string $message;
    public string $hash;

    public function __construct(string $signature, string $type, string $message, string $hash) {
        $this->signature = $signature;
        $this->type = $type;
        $this->message = $message;
        $this->hash = $hash;
    }

    public function toArray(): array {
        return [
            'signature' => $this->signature,
            'type' => $this->type,
            'message' => $this->message,
            'hash' => $this->hash
        ];
    }
}

class ErrorSignature {
    /**
     * Normalize a PHP Throwable into a consistent signature
     * 
     * @param Throwable $err The Throwable object to normalize
     * @return string Normalized error signature string
     */
    public static function normalize(Throwable $err): string {
        $type = get_class($err);
        // Remove namespace from class name for consistency
        $type = basename(str_replace('\\', '/', $type));
        
        $message = trim(strtok($err->getMessage(), "\n"));
        
        // Remove file paths and line numbers to focus on error content
        $cleanMessage = preg_replace('/\s+at\s+.*:\d+/', '', $message);
        $cleanMessage = preg_replace('/\s+in\s+\/.*$/', '', $cleanMessage);
        $cleanMessage = preg_replace('/\s+on\s+line\s+\d+/', '', $cleanMessage);
        $cleanMessage = trim($cleanMessage);
        
        return "{$type}:{$cleanMessage}";
    }

    /**
     * Create a detailed error signature object
     * 
     * @param Throwable $err The Throwable object to analyze
     * @return ErrorSignatureData Detailed error signature with metadata
     */
    public static function create(Throwable $err): ErrorSignatureData {
        $type = get_class($err);
        $type = basename(str_replace('\\', '/', $type));
        
        $message = trim(strtok($err->getMessage(), "\n"));
        $signature = self::normalize($err);
        
        // Simple hash for deduplication
        $hash = self::simpleHash($signature);
        
        return new ErrorSignatureData($signature, $type, $message, $hash);
    }

    /**
     * Check if two Throwables have the same signature
     * 
     * @param Throwable $err1 First Throwable
     * @param Throwable $err2 Second Throwable
     * @return bool True if Throwables have identical signatures
     */
    public static function areSame(Throwable $err1, Throwable $err2): bool {
        return self::normalize($err1) === self::normalize($err2);
    }

    /**
     * Simple string hash function for error deduplication
     * 
     * @param string $str String to hash
     * @return string Simple hash value as hex string
     */
    private static function simpleHash(string $str): string {
        return substr(md5($str), 0, 8);
    }
}

class ErrorTracker {
    private array $seenErrors = [];
    private array $errorHistory = [];

    /**
     * Check if a Throwable has been seen before
     * 
     * @param Throwable $err Throwable to check
     * @return bool True if this error signature was already seen
     */
    public function hasSeen(Throwable $err): bool {
        $signature = ErrorSignature::normalize($err);
        return in_array($signature, $this->seenErrors, true);
    }

    /**
     * Record a new error occurrence
     * 
     * @param Throwable $err Throwable to record
     * @return ErrorSignatureData The error signature that was recorded
     */
    public function record(Throwable $err): ErrorSignatureData {
        $errorSig = ErrorSignature::create($err);
        
        if (!in_array($errorSig->signature, $this->seenErrors, true)) {
            $this->seenErrors[] = $errorSig->signature;
        }
        
        $this->errorHistory[] = $errorSig;
        return $errorSig;
    }

    /**
     * Get all unique error signatures seen so far
     * 
     * @return array Array of unique ErrorSignatureData objects
     */
    public function getUniqueErrors(): array {
        $unique = [];
        $seen = [];
        
        foreach ($this->errorHistory as $err) {
            if (!in_array($err->signature, $seen, true)) {
                $unique[] = $err;
                $seen[] = $err->signature;
            }
        }
        
        return $unique;
    }

    /**
     * Clear all tracked errors
     */
    public function clear(): void {
        $this->seenErrors = [];
        $this->errorHistory = [];
    }

    /**
     * Get count of how many times each error was seen
     * 
     * @return array Associative array mapping error signature to count
     */
    public function getErrorCounts(): array {
        $counts = [];
        
        foreach ($this->errorHistory as $err) {
            if (!isset($counts[$err->signature])) {
                $counts[$err->signature] = 0;
            }
            $counts[$err->signature]++;
        }
        
        return $counts;
    }

    /**
     * Get the most frequently occurring errors
     * 
     * @param int $limit Maximum number of errors to return
     * @return array Array of [signature, count] arrays sorted by frequency
     */
    public function getMostFrequentErrors(int $limit = 5): array {
        $counts = $this->getErrorCounts();
        arsort($counts);
        
        $result = [];
        $i = 0;
        foreach ($counts as $signature => $count) {
            if ($i >= $limit) break;
            $result[] = [$signature, $count];
            $i++;
        }
        
        return $result;
    }

    /**
     * Get error history as array for serialization
     * 
     * @return array Array representation of error history
     */
    public function toArray(): array {
        return [
            'seenErrors' => $this->seenErrors,
            'errorHistory' => array_map(function($err) {
                return $err->toArray();
            }, $this->errorHistory),
            'uniqueErrorCount' => count($this->getUniqueErrors()),
            'totalErrorCount' => count($this->errorHistory)
        ];
    }
}

?>