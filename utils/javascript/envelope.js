class PatchEnvelope {
  constructor(patchId, patchData, metadata = {}, attempts = [], confidenceComponents = {}, breakerState = "CLOSED", cascadeDepth = 0, resourceUsage = {}) {
    this.patchId = patchId;
    this.patchData = patchData;
    this.metadata = {
      created_at: new Date().toISOString(),
      language: "javascript",
      ai_generated: true,
      ...metadata
    };
    this.attempts = attempts;
    this.confidenceComponents = confidenceComponents;
    this.breakerState = breakerState;
    this.cascadeDepth = cascadeDepth;
    this.resourceUsage = resourceUsage;
    this.success = false;
    this.flaggedForDeveloper = false;
    this.developerMessage = "";
  }

  toJson() {
    return JSON.stringify({
      patch_id: this.patchId,
      patch_data: this.patchData,
      metadata: this.metadata,
      attempts: this.attempts,
      confidenceComponents: this.confidenceComponents,
      breakerState: this.breakerState,
      cascadeDepth: this.cascadeDepth,
      resourceUsage: this.resourceUsage,
      success: this.success,
      flagged_for_developer: this.flaggedForDeveloper,
      developer_message: this.developerMessage,
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  static fromJson(jsonStr) {
    const data = JSON.parse(jsonStr);
    const envelope = new PatchEnvelope(
      data.patch_id,
      data.patch_data,
      data.metadata,
      data.attempts,
      data.confidenceComponents || {},
      data.breakerState || "CLOSED",
      data.cascadeDepth || 0,
      data.resourceUsage || {}
    );
    envelope.success = data.success || false;
    envelope.flaggedForDeveloper = data.flagged_for_developer || false;
    envelope.developerMessage = data.developer_message || "";
    return envelope;
  }
}

class PatchWrapper {
  wrapPatch(patch) {
    throw new Error("wrapPatch method must be implemented by subclass");
  }

  unwrapAndExecute(envelope) {
    throw new Error("unwrapAndExecute method must be implemented by subclass");
  }
}

class AIPatchEnvelope extends PatchWrapper {
  constructor() {
    super();
    this.envelopes = new Map();
  }

  wrapPatch(patch) {
    const patchId = `patch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const envelope = new PatchEnvelope(patchId, patch);

    this.envelopes.set(patchId, envelope);
    return envelope;
  }

  unwrapAndExecute(envelope) {
    // Check if this is a "big error" that should be flagged
    if (this._isBigError(envelope.patchData)) {
      envelope.flaggedForDeveloper = true;
      envelope.developerMessage = this._generateDeveloperMessage(envelope.patchData);
      return {
        success: false,
        flagged: true,
        message: "Patch flagged for developer review - potential critical issue",
        envelope: envelope.toJson()
      };
    }

    // Simulate successful execution
    const result = {
      success: true,
      patch_id: envelope.patchId,
      execution_details: "Patch executed successfully",
      envelope: envelope.toJson()
    };

    // Update envelope
    envelope.success = true;
    envelope.attempts.push({
      timestamp: new Date().toISOString(),
      result: "success",
      details: result.execution_details
    });

    return result;
  }

  _isBigError(patchData) {
    const errorIndicators = [
      patchData.database_schema_change,
      patchData.authentication_bypass,
      patchData.critical_security_vulnerability,
      patchData.production_data_modification,
      JSON.stringify(patchData).length > 1000 // Large/complex patches
    ];
    return errorIndicators.some(indicator => indicator);
  }

  _generateDeveloperMessage(patchData) {
    if (patchData.database_schema_change) {
      return "Database schema modification detected. Please review for data integrity and migration implications.";
    } else if (patchData.authentication_bypass) {
      return "Authentication-related changes detected. Critical security review required.";
    } else if (patchData.production_data_modification) {
      return "Production data modification detected. Please verify backup and rollback procedures.";
    } else {
      return "Complex patch detected requiring manual review before deployment.";
    }
  }
}

class MemoryBuffer {
  constructor(maxSize = 100) {
    this.buffer = [];
    this.maxSize = maxSize;
  }

  addOutcome(envelopeJson) {
    this.buffer.push({
      envelope: envelopeJson,
      timestamp: new Date().toISOString()
    });

    // Maintain buffer size
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getSimilarOutcomes(patchData) {
    const similar = [];
    for (const item of this.buffer) {
      const envelope = PatchEnvelope.fromJson(item.envelope);
      if (this._isSimilar(envelope.patchData, patchData)) {
        similar.push(item);
      }
    }
    return similar.slice(-5); // Return last 5 similar outcomes
  }

  _isSimilar(pastPatch, currentPatch) {
    const pastKeys = JSON.stringify(pastPatch).toLowerCase().split(/[^a-zA-Z0-9]/);
    const currentKeys = JSON.stringify(currentPatch).toLowerCase().split(/[^a-zA-Z0-9]/);
    const intersection = pastKeys.filter(key => currentKeys.includes(key));
    return intersection.length > 2;
  }
}

module.exports = { PatchEnvelope, PatchWrapper, AIPatchEnvelope, MemoryBuffer };