# Memory Adapters - Universal Persistence for Self-Healing Code

The memory adapter system provides universal persistence for your self-healing pipeline across any environment - from WordPress plugins to LangChain agents to N8N workflows.

## Core Concept

Every adapter implements the same `MemoryAdapter` interface, so your pipeline code never changes - only the storage backend:

```typescript
interface MemoryAdapter {
  storeEnvelope(envelope: PatchEnvelope): Promise<void>;
  getByErrorSignature(signature: string): Promise<PatchEnvelope[]>;
  queryEnvelopes(query: MemoryQuery): Promise<PatchEnvelope[]>;
  storeTransmission(transmission: Transmission): Promise<void>;
  getBreakerState(): Promise<BreakerState>;
  setBreakerState(state: BreakerState): Promise<void>;
  clear(): Promise<void>;
  close(): Promise<void>;
}
```

## Quick Start

```typescript
import { createMemoryAdapter, SelfHealingPipeline } from './utils/typescript';

// File-based (local development)
const fileAdapter = createMemoryAdapter('file', { filePath: './memory.json' });

// WordPress (plugin integration)  
const wpAdapter = createMemoryAdapter('wpdb', { wpdb: global.wpdb });

// LangChain (AI agent memory)
const lcAdapter = createMemoryAdapter('langchain', { chatMemory, vectorStore });

// N8N (workflow integration)
const n8nAdapter = createMemoryAdapter('n8n', { baseUrl: 'https://n8n.example.com' });

// Sim Studio (agent runtime)
const simAdapter = createMemoryAdapter('sim', { agent: simAgent });

// Same pipeline code works with any adapter
const pipeline = new SelfHealingPipeline(fileAdapter);
```

## Adapter Details

### 1. JSONFileMemoryAdapter

**Best for:** Local development, testing, small deployments

```typescript
import { JSONFileMemoryAdapter } from './utils/typescript';

const adapter = new JSONFileMemoryAdapter('./my-memory.json');

// Automatic file creation and persistence
await adapter.storeEnvelope(envelope);

// Get comprehensive stats
const stats = await adapter.getStats();
console.log(`${stats.totalEnvelopes} envelopes, ${stats.successfulPatches} successful`);
```

**Features:**
- ✅ Zero setup - just specify a file path
- ✅ Automatic JSON serialization with metadata
- ✅ Built-in statistics and health metrics
- ✅ Handles date conversion and error recovery
- ⚠️ Single-file storage (not ideal for high concurrency)

### 2. WPDBMemoryAdapter

**Best for:** WordPress plugins, WooCommerce extensions

```typescript
import { WPDBMemoryAdapter } from './utils/typescript';

const adapter = new WPDBMemoryAdapter(wpdb, 'my_plugin_');

// Create required tables (run during plugin activation)
await adapter.createTables();

// Store patch data in WordPress database
await adapter.storeEnvelope(envelope);

// Get data for admin dashboard
const adminData = await adapter.getAdminPageData();
```

**Features:**
- ✅ Full WordPress integration with `wpdb`
- ✅ Custom table creation with proper indexes
- ✅ Admin dashboard data helpers
- ✅ Handles WordPress-specific SQL escaping
- ✅ Supports multisite installations

**WordPress Admin Integration:**
```php
// In your WordPress plugin
add_action('admin_menu', function() {
    add_menu_page(
        'Self-Healing Debug',
        'Debug History', 
        'manage_options',
        'selfhealing-debug',
        'show_debug_page'
    );
});

function show_debug_page() {
    // Get data from WPDBMemoryAdapter.getAdminPageData()
    // Display patch history, breaker state, success rates
}
```

### 3. LangChainMemoryAdapter

**Best for:** AI agents, chatbots, retrieval-augmented generation

```typescript
import { LangChainMemoryAdapter } from './utils/typescript';

const adapter = new LangChainMemoryAdapter({
  chatMemory: new ConversationBufferMemory(),
  vectorStore: new Chroma(),
  enableSemanticSearch: true
});

// Automatically adds context to agent conversations
await adapter.storeEnvelope(envelope);

// Get context for AI decision making
const context = await adapter.getContextForAgent('syntax error in React component');
```

**Features:**
- ✅ Semantic search via vector embeddings
- ✅ Automatic conversation context injection
- ✅ Works with any LangChain memory backend
- ✅ Provides rich context for AI agents
- ⚠️ Requires LangChain setup and API keys

**Integration with LangChain Agents:**
```typescript
// In your LangChain agent
const tools = [
  new DynamicTool({
    name: "get_patch_context",
    description: "Get context about previous patches for similar errors",
    func: async (query: string) => {
      const context = await memoryAdapter.getContextForAgent(query);
      return JSON.stringify(context);
    }
  })
];
```

### 4. N8NMemoryAdapter

**Best for:** Workflow automation, notifications, multi-service integration

```typescript
import { N8NMemoryAdapter } from './utils/typescript';

const adapter = new N8NMemoryAdapter({
  baseUrl: 'https://your-n8n.com',
  webhookToken: 'your-token'
}, {
  storeEnvelope: '/webhook/selfhealing/store',
  // ... other endpoints
});

// Automatically triggers N8N workflows
await adapter.storeEnvelope(envelope);

// Send notifications through N8N
await adapter.sendNotification('error', 'Circuit breaker opened!', { details });
```

**Features:**
- ✅ HTTP webhook integration with retry logic
- ✅ Batch operations for performance
- ✅ Workflow triggering and status tracking
- ✅ Built-in notification system
- ⚠️ Requires N8N workflow setup

**N8N Workflow Example:**
```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "selfhealing/store"
      }
    },
    {
      "name": "Store in Database", 
      "type": "n8n-nodes-base.postgres"
    },
    {
      "name": "Send Slack Alert",
      "type": "n8n-nodes-base.slack"
    }
  ]
}
```

### 5. SimMemoryAdapter

**Best for:** Sim Studio agents, multi-agent systems, advanced AI workflows

```typescript
import { SimMemoryAdapter } from './utils/typescript';

const adapter = new SimMemoryAdapter({
  agent: simAgent,
  memoryStore: simMemoryStore,
  enableEmbeddings: true
});

// Automatically updates agent strategy based on success patterns
await adapter.updateAgentStrategy();

// Get comprehensive agent context
const context = await adapter.getAgentContext();
```

**Features:**
- ✅ Native Sim Studio integration
- ✅ Automatic strategy optimization
- ✅ Event-driven state synchronization
- ✅ Multi-agent coordination support
- ⚠️ Requires Sim Studio setup

## Pipeline Integration

The real power comes from integrating adapters into your self-healing pipeline:

```typescript
import { SelfHealingPipeline } from './examples/pipeline-integration';

const pipeline = new SelfHealingPipeline(adapter);

// Execute patch with full persistence
const result = await pipeline.executePatch(
  'patch-123',
  'typescript',
  'console.log("before");',
  'console.log("after");',
  optionalError
);

// Get health metrics
const health = await pipeline.getHealthStats();
console.log(`Success rate: ${health.successRate}`);
console.log(`Circuit breaker: ${health.breakerState.state}`);
```

**Pipeline Features:**
- ✅ Automatic error signature deduplication
- ✅ Circuit breaker with persistent state
- ✅ Comprehensive telemetry recording
- ✅ Health monitoring and stats
- ✅ Manual recovery controls

## Error Signature Deduplication

All adapters support error signature-based deduplication:

```typescript
// If you've seen this exact error before...
const pastAttempts = await adapter.getByErrorSignature('TypeError:Cannot read property');

if (pastAttempts.length >= 3) {
  console.log('Skipping - too many recent failures with this signature');
  return;
}

// Otherwise, proceed with patch
await adapter.storeEnvelope(envelope);
```

## Circuit Breaker Persistence

The circuit breaker state persists across restarts:

```typescript
// Check breaker state
const breaker = await adapter.getBreakerState();
if (breaker.state === 'open') {
  throw new Error('Circuit breaker is open');
}

// Update breaker state
await adapter.setBreakerState({
  failures: 5,
  state: 'open',
  lastFailure: new Date(),
  threshold: 5,
  cooldown: 300000 // 5 minutes
});
```

## Cross-Language Support

The same persistence contracts work across all languages:

**TypeScript** (shown above)

**Python** (coming next):
```python
from utils.python import JSONFileMemoryAdapter, SelfHealingPipeline

adapter = JSONFileMemoryAdapter('./memory.json')
pipeline = SelfHealingPipeline(adapter)
```

**PHP** (coming next):
```php
<?php
use Utils\PHP\JSONFileMemoryAdapter;
use Utils\PHP\SelfHealingPipeline;

$adapter = new JSONFileMemoryAdapter('./memory.json');
$pipeline = new SelfHealingPipeline($adapter);
```

## Environment Examples

### Local Development
```typescript
const pipeline = await PipelineExamples.createLocalPipeline();
```

### WordPress Plugin
```typescript
const pipeline = await PipelineExamples.createWordPressPipeline(wpdb);
```

### LangChain Agent
```typescript
const pipeline = await PipelineExamples.createLangChainPipeline({
  chatMemory: new ConversationBufferMemory(),
  vectorStore: new Chroma()
});
```

### N8N Workflow
```typescript
const pipeline = await PipelineExamples.createN8NPipeline({
  baseUrl: 'https://n8n.example.com',
  webhookToken: 'your-token'
});
```

### Sim Studio Agent
```typescript
const pipeline = await PipelineExamples.createSimPipeline({
  agent: simAgent,
  memoryStore: simMemoryStore
});
```

## Testing

Run the comprehensive test suite:

```bash
npm test tests/ts/memory-adapters.test.ts
```

Or try the interactive demo:

```bash
npx ts-node examples/demo.ts
```

This demonstrates:
- ✅ Successful patch execution and storage
- ✅ Error signature generation and deduplication
- ✅ Circuit breaker triggering and recovery
- ✅ Health metrics and statistics
- ✅ Persistence across operations

## Next Steps

1. **Choose your adapter** based on your environment
2. **Set up the pipeline** with your chosen adapter
3. **Integrate into your error handling** flow
4. **Monitor health metrics** to optimize performance
5. **Scale across languages** with Python/PHP adapters (coming soon)

The memory adapter system gives you persistent, intelligent error handling that learns from past attempts and prevents infinite retry loops - regardless of whether you're building WordPress plugins, LangChain agents, or N8N workflows.