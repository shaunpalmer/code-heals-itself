class Observer {
  update(subject, data) {
    throw new Error("update method must be implemented by subclass");
  }
}

class Subject {
  constructor() {
    this.observers = [];
  }

  attach(observer) {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
    }
  }

  detach(observer) {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  notify(data) {
    this.observers.forEach(observer => {
      observer.update(this, data);
    });
  }
}

class PatchObserver extends Observer {
  constructor(name) {
    super();
    this.name = name;
  }

  update(subject, data) {
    const outcome = {
      observer: this.name,
      patch_success: data.success || false,
      patch_name: data.patch_name || "",
      details: data.details || "",
      timestamp: data.timestamp || new Date().toISOString()
    };
    const jsonOutput = JSON.stringify(outcome, null, 2);
    console.log(`Observer ${this.name} received update: ${jsonOutput}`);
    // In a real system, send to logging service or AI feedback
  }
}

class ErrorHandler extends Subject {
  constructor() {
    super();
  }

  handleError(error, patchName = "") {
    const data = {
      error: error,
      patch_name: patchName,
      timestamp: new Date().toISOString()
    };
    this.notify(data);
  }
}

// Usage example
const handler = new ErrorHandler();
const observer = new PatchObserver("SecurityObserver");
handler.attach(observer);

// Simulate an error and patch attempt
handler.handleError("Buffer overflow detected", "security_patch_001");

module.exports = { Observer, Subject, PatchObserver, ErrorHandler };