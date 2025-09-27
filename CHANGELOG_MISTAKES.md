# CHANGELOG - Learning from Mistakes

## Date: September 27, 2025

### FIX: Enforce Schema Minimums for Confidence Floors in TypeScript AIDebugger
- **What changed**: Updated the `AIDebugger` constructor in `ai-debugging.ts` to always clamp `syntax_conf_floor` and `logic_conf_floor` to the schema minimum (0.1), regardless of input.
- **Why it matters**: Prevents invalid policy configurations that violate the schema, ensuring all envelopes and policy snapshots are always contract-compliant. This eliminates a class of schema validation errors and makes the system robust to misconfiguration.
- **How to read it in our engine**: Any attempt to set a confidence floor below 0.1 is automatically corrected, so all downstream logic and schema validation will succeed.
- **Tests**: All Jest tests now pass, including those with permissive settings.

### LESSON LEARNED: Always Enforce Schema Contracts in Code
- **Rule**: Never trust external/test input to be schema-compliant—enforce minimums and maximums in constructors and setters.
- **Outcome**: The system is now resilient to accidental or intentional misconfiguration, and future changes to the schema minimums can be enforced in one place.

## Date: September 25, 2025

### IMPROVEMENT: Stabilized Confidence Softmax on Python Side
- **What changed**: Replaced the naive `math.exp(logit)` loop with a numerically stable softmax (subtract max logit, guard empty inputs) inside `utils/python/confidence_scoring.py` and started recording real UTC timestamps in the dual circuit breaker.
- **Why it matters**: Prevents overflow when logits spike during healing attempts, keeps confidence gradients meaningful, and preserves audit timelines.
- **Next step (TypeScript)**: Mirror the stable softmax + timestamp update in `utils/typescript/confidence_scoring.ts` the next time we touch the TS branch.
- **How to read it in our engine**: for each confidence component `i`, we now compute
  $$\operatorname{softmax}_i = \frac{\exp(\text{logits}_i - \max_j \text{logits}_j)}{\sum_j \exp(\text{logits}_j - \max_k \text{logits}_k)}$$
  so the logits coming out of the error-delta gradient get smoothed into normalized weights without numerical blow-ups.

### ACTION ITEMS
1. ✅ Python softmax now stable and breaker timestamps real.
2. ☐ Port the same stability guard into the TypeScript scorer (note for upcoming TypeScript branch work).

## Date: September 16, 2025

### MISTAKE: Over-Engineering with Extra Files
- **What I did wrong**: Created unnecessary new files (`PersistentMemoryBuffer.ts`, `PersistentAIDebugger.ts`, etc.) instead of extending existing classes
- **Why it was wrong**: 
  - Created import path problems
  - Added unnecessary complexity
  - Violated DRY principle
  - Made the codebase bloated
- **What I should have done**: Extended existing classes IN THEIR EXISTING FILES

### LESSON LEARNED: Always Extend, Never Create Duplicates
- **Rule 1**: Read existing code FIRST, understand what's already there
- **Rule 2**: Extend existing classes in their current files
- **Rule 3**: Use existing constants and enums, don't create new ones
- **Rule 4**: No new files unless absolutely necessary
- **Rule 5**: Test with the REAL system, not parallel systems

### TECHNICAL DEBT CREATED:
- `utils/typescript/PersistentMemoryBuffer.ts` - UNNECESSARY, delete it
- `utils/typescript/PersistentAIDebugger.ts` - UNNECESSARY, delete it  
- `utils/typescript/MemoryAdapter.ts` - BLOAT, delete it
- `utils/typescript/*MemoryAdapter.ts` files - BLOAT, delete them
- Path problems in imports - caused by creating extra files

### CORRECT APPROACH:
- ✅ Extended `MemoryBuffer` class directly in `envelope.ts` 
- ✅ Extended `AIDebugger` class directly in `ai-debugging.ts`
- ✅ Used existing `ErrorType` constants from `confidence_scoring.ts`
- ✅ Made pipeline use REAL `AIDebugger`, not parallel system

### ACTION ITEMS:
1. Delete all the bloated memory adapter files I created
2. Remove unnecessary imports 
3. Use only the extended classes in existing files
4. Test to make sure everything works with original paths

### REMEMBER FOR NEXT TIME:
**"When you want to add functionality, extend existing classes IN PLACE. Don't create new files. Don't create parallel systems. Read the existing code first."**

Write this down. Tape it to your monitor. This is how real developers work.