# Self-Healing Code Architecture Analysis

## Current State Analysis
*Date: September 16, 2025*

### Core Classes and Structure

#### 1. PatchEnvelope (utils/typescript/envelope.ts)
- **Primary class** for wrapping patch data
- **Properties**: 
  - `patchId: string` (public, constructor param)
  - `patchData: Record<string, any>` (public, constructor param)
  - `metadata: Record<string, any>` (public, constructor param)
  - `attempts: Record<string, any>[]` (public, constructor param)
  - Instance properties: `success`, `flaggedForDeveloper`, `developerMessage`, `confidenceComponents`, `breakerState`, `cascadeDepth`, `resourceUsage`
- **Methods**: 
  - `toJson(): string` - converts to snake_case JSON for schema compliance
  - `static fromJson(jsonStr: string): PatchEnvelope` - factory from JSON
- **Constructor**: Takes 4 required + 4 optional params, sets defaults, creates metadata with timestamps

#### 2. PatchWrapper (utils/typescript/envelope.ts)
- **Abstract base class** for patch operations
- **Abstract methods**: 
  - `wrapPatch(patch: Record<string, any>): PatchEnvelope`
  - `unwrapAndExecute(envelope: PatchEnvelope): Record<string, any>`

#### 3. AIPatchEnvelope (utils/typescript/envelope.ts)
- **Extends PatchWrapper**
- **Purpose**: AI-specific patch handling with developer flagging
- **Internal state**: `Map<string, PatchEnvelope>` for envelope storage
- **Business logic**: 
  - Detects "big errors" (DB changes, auth bypass, security vulns)
  - Flags patches for developer review
  - Simulates execution

#### 4. MemoryBuffer (utils/typescript/envelope.ts)
- **Utility class** for outcome buffering
- **Internal state**: `Array<{ envelope: string, timestamp: string }>`
- **Methods**: `addOutcome()`, `getSimilarOutcomes()`

#### 5. Transmission Interface (utils/typescript/envelope.ts)
- **Data transfer object** for telemetry
- **Properties**: `patch_id`, `language`, `error_classification`, `confidence_scoring`, `timestamp`, optional `error_signature` and `original_error`

### Memory Adapter Architecture

#### 1. MemoryAdapter Interface (utils/typescript/MemoryAdapter.ts)
- **Pure interface** defining persistence contract
- **Methods**: Store/query envelopes, manage breaker state, store transmissions
- **Supporting types**: `BreakerState`, `MemoryQuery`

#### 2. BaseMemoryAdapter (utils/typescript/MemoryAdapter.ts)
- **Abstract class implementing MemoryAdapter**
- **Provides**: Common breaker logic, state management
- **Template methods**: `updateBreakerOnResult()`, `isBreakerOpen()`
- **Forces implementation**: All core persistence methods

#### 3. Concrete Adapters
- **JSONFileMemoryAdapter**: File-based storage, good OOP inheritance pattern
- **WPDBMemoryAdapter**: WordPress DB storage, extends BaseMemoryAdapter properly
- **LangChainMemoryAdapter**: External service integration
- **N8NMemoryAdapter**: Workflow automation integration  
- **SimMemoryAdapter**: Simulation environment integration

### Issues Identified

#### 1. Import/Export Inconsistencies
- **Problem**: `pipeline-integration.ts` imports from non-existent files:
  - `'../utils/typescript/PatchEnvelope'` (doesn't exist)
  - `'../utils/typescript/Transmission'` (doesn't exist)
- **Root cause**: Classes are defined in `envelope.ts` but imports expect separate files
- **Impact**: Pipeline integration broken, can't run examples

#### 2. Property Naming Confusion
- **Problem**: Internal properties use camelCase (`patchId`) but JSON output uses snake_case (`patch_id`)
- **Context**: This is intentional for schema compliance, but tests were confused
- **Resolution**: Tests now correctly expect camelCase for object properties, snake_case for JSON

#### 3. Missing Error Handling Classes
- **Problem**: Pipeline imports `ErrorSignature` which may not exist
- **Need to verify**: Check if ErrorSignature utility exists and is properly exported

### Architectural Strengths

#### 1. Good OOP Inheritance
- BaseMemoryAdapter → Concrete adapters follows proper template pattern
- PatchWrapper → AIPatchEnvelope shows good abstraction
- Interface → Abstract → Concrete hierarchy is clean

#### 2. Separation of Concerns
- Envelope handles data structure and serialization
- Adapters handle persistence with different backends
- Pipeline orchestrates workflow

#### 3. Extensibility
- New adapters can extend BaseMemoryAdapter easily
- Factory pattern in index.ts allows runtime adapter selection
- Interface-based design supports testing and swapping

### Recommended Actions

#### 1. Fix Import Issues (High Priority)
- Update pipeline imports to use correct module paths
- Ensure all exported classes are available through index.ts
- Verify ErrorSignature utility exists or create it

#### 2. Maintain Clean Architecture (Medium Priority)
- Keep the current inheritance patterns - they're good
- Don't create duplicate interfaces for existing classes
- Use composition where inheritance doesn't fit

#### 3. Documentation and Testing (Medium Priority)
- Keep tests aligned with actual class constructors
- Maintain property naming conventions (camelCase internal, snake_case JSON)
- Document the intentional property naming strategy

## Architectural Decision Record

### Decision: Extend existing classes rather than create new interfaces
**Rationale**: The PatchEnvelope class already exists and works well. Creating additional interfaces leads to confusion and bloat.

### Decision: Maintain camelCase internal / snake_case JSON convention
**Rationale**: Internal TypeScript code should use camelCase conventions, but JSON output should match the schema which uses snake_case.

### Decision: Keep BaseMemoryAdapter template pattern
**Rationale**: This is good OOP - provides common behavior while forcing implementation of core methods.

### Next Steps
1. Fix import paths in pipeline-integration.ts
2. Verify ErrorSignature utility exists
3. Run full test suite
4. Update examples to work with corrected imports