abstract class Target {
  abstract applyPatch(patchData: Record<string, any>): Record<string, any>;
}

class Adaptee {
  legacyPatch(rawPatch: string): string {
    return `Legacy patched: ${rawPatch}`;
  }
}

class PatchAdapter extends Target {
  constructor(private adaptee: Adaptee) {
    super();
  }

  applyPatch(patchData: Record<string, any>): Record<string, any> {
    const rawPatch = patchData.raw_patch || "";
    const adaptedResult = this.adaptee.legacyPatch(rawPatch);

    const outcome = {
      adapter: "PatchAdapter",
      patch_applied: true,
      original_patch: patchData,
      adapted_result: adaptedResult,
      success: true,
      details: "Patch adapted and applied successfully"
    };
    return outcome;
  }
}

class SecurityPatchAdapter extends Target {
  applyPatch(patchData: Record<string, any>): Record<string, any> {
    const vulnerability = patchData.vulnerability || "";
    const fix = patchData.fix || "";
    const result = `Security fix applied for ${vulnerability}: ${fix}`;

    const outcome = {
      adapter: "SecurityPatchAdapter",
      patch_applied: true,
      vulnerability: vulnerability,
      fix: fix,
      result: result,
      success: true,
      details: "Security patch applied successfully"
    };
    return outcome;
  }
}

// Usage example
const adaptee = new Adaptee();
const adapter = new PatchAdapter(adaptee);

const patchData = { raw_patch: "Fix buffer overflow" };
const result = adapter.applyPatch(patchData);
console.log(JSON.stringify(result, null, 2));

// Security adapter
const securityAdapter = new SecurityPatchAdapter();
const securityPatch = { vulnerability: "SQL Injection", fix: "Use prepared statements" };
const securityResult = securityAdapter.applyPatch(securityPatch);
console.log(JSON.stringify(securityResult, null, 2));

export { Target, Adaptee, PatchAdapter, SecurityPatchAdapter };