<?php

abstract class Target {
    abstract public function applyPatch(array $patchData): array;
}

class Adaptee {
    public function legacyPatch(string $rawPatch): string {
        return "Legacy patched: {$rawPatch}";
    }
}

class PatchAdapter extends Target {
    private Adaptee $adaptee;

    public function __construct(Adaptee $adaptee) {
        $this->adaptee = $adaptee;
    }

    public function applyPatch(array $patchData): array {
        $rawPatch = $patchData["raw_patch"] ?? "";
        $adaptedResult = $this->adaptee->legacyPatch($rawPatch);

        $outcome = [
            "adapter" => "PatchAdapter",
            "patch_applied" => true,
            "original_patch" => $patchData,
            "adapted_result" => $adaptedResult,
            "success" => true,
            "details" => "Patch adapted and applied successfully"
        ];
        return $outcome;
    }
}

class SecurityPatchAdapter extends Target {
    public function applyPatch(array $patchData): array {
        $vulnerability = $patchData["vulnerability"] ?? "";
        $fix = $patchData["fix"] ?? "";
        $result = "Security fix applied for {$vulnerability}: {$fix}";

        $outcome = [
            "adapter" => "SecurityPatchAdapter",
            "patch_applied" => true,
            "vulnerability" => $vulnerability,
            "fix" => $fix,
            "result" => $result,
            "success" => true,
            "details" => "Security patch applied successfully"
        ];
        return $outcome;
    }
}

// Usage example
$adaptee = new Adaptee();
$adapter = new PatchAdapter($adaptee);

$patchData = ["raw_patch" => "Fix buffer overflow"];
$result = $adapter->applyPatch($patchData);
echo json_encode($result, JSON_PRETTY_PRINT) . "\n";

// Security adapter
$securityAdapter = new SecurityPatchAdapter();
$securityPatch = ["vulnerability" => "SQL Injection", "fix" => "Use prepared statements"];
$securityResult = $securityAdapter->applyPatch($securityPatch);
echo json_encode($securityResult, JSON_PRETTY_PRINT) . "\n";

?>