<?php

abstract class Observer {
    abstract public function update(Subject $subject, array $data): void;
}

class Subject {
    private array $observers = [];

    public function attach(Observer $observer): void {
        if (!in_array($observer, $this->observers, true)) {
            $this->observers[] = $observer;
        }
    }

    public function detach(Observer $observer): void {
        $key = array_search($observer, $this->observers, true);
        if ($key !== false) {
            unset($this->observers[$key]);
        }
    }

    public function notify(array $data): void {
        foreach ($this->observers as $observer) {
            $observer->update($this, $data);
        }
    }
}

class PatchObserver extends Observer {
    private string $name;

    public function __construct(string $name) {
        $this->name = $name;
    }

    public function update(Subject $subject, array $data): void {
        $outcome = [
            "observer" => $this->name,
            "patch_success" => $data["success"] ?? false,
            "patch_name" => $data["patch_name"] ?? "",
            "details" => $data["details"] ?? "",
            "timestamp" => $data["timestamp"] ?? date('c')
        ];
        $jsonOutput = json_encode($outcome, JSON_PRETTY_PRINT);
        echo "Observer {$this->name} received update: {$jsonOutput}\n";
        // In a real system, send to logging service or AI feedback
    }
}

class ErrorHandler extends Subject {
    public function handleError(string $error, string $patchName = ""): void {
        $data = [
            "error" => $error,
            "patch_name" => $patchName,
            "timestamp" => date('c')
        ];
        $this->notify($data);
    }
}

// Usage example
$handler = new ErrorHandler();
$observer = new PatchObserver("SecurityObserver");
$handler->attach($observer);

// Simulate an error and patch attempt
$handler->handleError("Buffer overflow detected", "security_patch_001");

?>