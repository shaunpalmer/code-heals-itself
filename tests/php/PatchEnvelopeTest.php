<?php
require 'vendor/autoload.php';
use Opis\JsonSchema\Validator;
use Opis\JsonSchema\ValidationResult;

// Load schemas with file-relative paths
$patchSchemaPath = __DIR__ . '/../../schemas/patch-envelope.schema.json';
$patchSchema = json_decode(file_get_contents($patchSchemaPath));

$transmissionSchemaPath = __DIR__ . '/../../schemas/transmission.json';
$transmissionSchema = json_decode(file_get_contents($transmissionSchemaPath));

$validator = new Validator();

// Load patch envelope test fixtures
$patchValidFixturePath = __DIR__ . '/../../schemas/fixtures/patchEnvelope.valid.json';
$patchInvalidFixturePath = __DIR__ . '/../../schemas/fixtures/patchEnvelope.invalid.json';
$patchValidEnvelope = json_decode(file_get_contents($patchValidFixturePath), true);
$patchInvalidEnvelope = json_decode(file_get_contents($patchInvalidFixturePath), true);

// Load transmission test fixtures
$transmissionValidFixturePath = __DIR__ . '/../../schemas/fixtures/transmission.valid.json';
$transmissionInvalidFixturePath = __DIR__ . '/../../schemas/fixtures/transmission.invalid.json';
$transmissionValidRecord = json_decode(file_get_contents($transmissionValidFixturePath), true);
$transmissionInvalidRecord = json_decode(file_get_contents($transmissionInvalidFixturePath), true);

function test_valid_patch_envelope($validator, $schema, $validEnvelope) {
    $result = $validator->schemaValidation((object)$validEnvelope, $schema);
    assert($result->isValid(), "Valid patch envelope should pass validation");
}

function test_invalid_patch_envelope($validator, $schema, $invalidEnvelope) {
    $result = $validator->schemaValidation((object)$invalidEnvelope, $schema);
    assert(!$result->isValid(), "Invalid patch envelope should fail validation");
}

function test_valid_transmission_record($validator, $schema, $validRecord) {
    $result = $validator->schemaValidation((object)$validRecord, $schema);
    assert($result->isValid(), "Valid transmission record should pass validation");
}

function test_invalid_transmission_record($validator, $schema, $invalidRecord) {
    $result = $validator->schemaValidation((object)$invalidRecord, $schema);
    assert(!$result->isValid(), "Invalid transmission record should fail validation");
}

// Run patch envelope tests
test_valid_patch_envelope($validator, $patchSchema, $patchValidEnvelope);
test_invalid_patch_envelope($validator, $patchSchema, $patchInvalidEnvelope);

// Run transmission record tests
test_valid_transmission_record($validator, $transmissionSchema, $transmissionValidRecord);
test_invalid_transmission_record($validator, $transmissionSchema, $transmissionInvalidRecord);

echo "All PHP tests passed!\n";
