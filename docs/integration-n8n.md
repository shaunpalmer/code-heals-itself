# n8n Integration

Use n8n to orchestrate self-healing attempts after build/test failures.

## Quick HTTP Request Node
1. Add an HTTP Request node.
2. Method: POST
3. URL: `http://localhost:8787/api/debug/run`
4. Headers: `Content-Type: application/json`
5. Body (JSON):
```
{
  "error_type": "SYNTAX",
  "message": "Fix missing semicolon",
  "patch_code": "const x=1",
  "original_code": "const x=1;",
  "maxAttempts": 1
}
```
6. Response parsing: JSON → Use `{{$json["action"]}}` in downstream nodes.

## Flow Example
```
[Git Trigger] -> [Run Tests] -> (IF failure) -> [HTTP Self-Heal] -> [Evaluate Result]
```

## Evaluate Result Node (Function)
```javascript
return [{
  action: $json.action,
  patchId: $json.envelope?.patch_id,
  success: $json.action === 'SUCCESS'
}];
```

## Fetch Envelope Details
Add another HTTP Request node (GET):
`http://localhost:8787/api/envelopes/{{$json["patchId"]}}`

## Metrics Dashboard
Use an HTTP Request node hitting `/health?format=prom` then a Function node to parse key gauges for alerting.

## Optional: Custom Node Stub
Create `nodes/SelfHeal.node.js` inside an n8n custom directory:
```javascript
module.exports = {
  description: {
    displayName: 'Self Heal Debug',
    name: 'selfHealDebug',
    group: ['transform'],
    version: 1,
    defaults: { name: 'Self Heal Debug' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      { displayName: 'Base URL', name: 'baseUrl', type: 'string', default: 'http://localhost:8787' },
      { displayName: 'Error Type', name: 'error_type', type: 'options', options: [ 'SYNTAX','LOGIC','RUNTIME','PERFORMANCE','SECURITY' ].map(o => ({ name: o, value: o })), default: 'SYNTAX' },
      { displayName: 'Message', name: 'message', type: 'string', default: '' },
      { displayName: 'Patch Code', name: 'patch_code', type: 'string', default: '' },
      { displayName: 'Original Code', name: 'original_code', type: 'string', default: '' },
      { displayName: 'Max Attempts', name: 'maxAttempts', type: 'number', default: 1 }
    ]
  },
  async execute() {
    const items = this.getInputData();
    const results = [];
    for (let i=0;i<items.length;i++) {
      const baseUrl = this.getNodeParameter('baseUrl', i) as string;
      const body = {
        error_type: this.getNodeParameter('error_type', i),
        message: this.getNodeParameter('message', i),
        patch_code: this.getNodeParameter('patch_code', i),
        original_code: this.getNodeParameter('original_code', i),
        maxAttempts: this.getNodeParameter('maxAttempts', i)
      };
      const resp = await this.helpers.request({
        method: 'POST', uri: `${baseUrl}/api/debug/run`,
        body, json: true
      });
      results.push({ json: resp });
    }
    return this.prepareOutputData(results);
  }
};
```

## Security
If exposing beyond localhost add an API key header check and apply network restrictions.

## Scaling
Multiple self-healer instances can be referenced by different base URLs to parallelize patch attempts.

See also: `docs/function-manifest.md` for schema references.
