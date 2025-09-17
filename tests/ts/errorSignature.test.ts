import { ErrorSignature, ErrorTracker, IErrorSignature } from "../../utils/typescript/ErrorSignature";

describe("ErrorSignature", () => {
  describe("normalize method", () => {
    it("should normalize basic JavaScript errors consistently", () => {
      const refError = new ReferenceError("x is not defined");
      const typeError = new TypeError("Cannot read property of undefined");
      const syntaxError = new SyntaxError("Unexpected token");

      expect(ErrorSignature.normalize(refError)).toBe("ReferenceError:x is not defined");
      expect(ErrorSignature.normalize(typeError)).toBe("TypeError:Cannot read property of undefined");
      expect(ErrorSignature.normalize(syntaxError)).toBe("SyntaxError:Unexpected token");
    });

    it("should remove file paths and line numbers", () => {
      const error = new Error("Something went wrong at file.js:10:5");
      const normalized = ErrorSignature.normalize(error);
      expect(normalized).toBe("Error:Something went wrong");
    });

    it("should handle errors without messages", () => {
      const error = new Error();
      const normalized = ErrorSignature.normalize(error);
      expect(normalized).toBe("Error:Error"); // Empty Error() still has "Error" message
    });

    it("should handle non-Error objects", () => {
      const stringError = "Simple string error";
      const objectError = { message: "Object error" };

      expect(ErrorSignature.normalize(stringError)).toBe("String:Simple string error");
      expect(ErrorSignature.normalize(objectError)).toBe("Object:Object error");
    });
  });

  describe("create method", () => {
    it("should create detailed error signature", () => {
      const error = new ReferenceError("variable not found");
      const signature = ErrorSignature.create(error);

      expect(signature.type).toBe("ReferenceError");
      expect(signature.message).toBe("variable not found");
      expect(signature.signature).toBe("ReferenceError:variable not found");
      expect(signature.hash).toMatch(/^[0-9a-f]+$/); // hex hash
    });
  });

  describe("areSame method", () => {
    it("should identify identical error signatures", () => {
      const error1 = new ReferenceError("x is not defined");
      const error2 = new ReferenceError("x is not defined");
      const error3 = new TypeError("x is not defined");

      expect(ErrorSignature.areSame(error1, error2)).toBe(true);
      expect(ErrorSignature.areSame(error1, error3)).toBe(false);
    });
  });
});

describe("ErrorTracker", () => {
  let tracker: ErrorTracker;

  beforeEach(() => {
    tracker = new ErrorTracker();
  });

  it("should track new errors", () => {
    const error = new ReferenceError("x is not defined");

    expect(tracker.hasSeen(error)).toBe(false);

    const signature = tracker.record(error);
    expect(signature.type).toBe("ReferenceError");
    expect(tracker.hasSeen(error)).toBe(true);
  });

  it("should detect duplicate errors", () => {
    const error1 = new ReferenceError("x is not defined");
    const error2 = new ReferenceError("x is not defined");

    tracker.record(error1);
    expect(tracker.hasSeen(error2)).toBe(true);
  });

  it("should track error counts", () => {
    const error1 = new ReferenceError("x is not defined");
    const error2 = new ReferenceError("x is not defined");
    const error3 = new TypeError("different error");

    tracker.record(error1);
    tracker.record(error2);
    tracker.record(error3);

    const counts = tracker.getErrorCounts();
    expect(counts.get("ReferenceError:x is not defined")).toBe(2);
    expect(counts.get("TypeError:different error")).toBe(1);
  });

  it("should return unique errors", () => {
    const error1 = new ReferenceError("x is not defined");
    const error2 = new ReferenceError("x is not defined");
    const error3 = new TypeError("different error");

    tracker.record(error1);
    tracker.record(error2);
    tracker.record(error3);

    const unique = tracker.getUniqueErrors();
    expect(unique.length).toBe(2);
    expect(unique.map(e => e.signature)).toContain("ReferenceError:x is not defined");
    expect(unique.map(e => e.signature)).toContain("TypeError:different error");
  });

  it("should clear all tracked data", () => {
    const error = new ReferenceError("x is not defined");
    tracker.record(error);

    expect(tracker.hasSeen(error)).toBe(true);
    tracker.clear();
    expect(tracker.hasSeen(error)).toBe(false);
    expect(tracker.getUniqueErrors().length).toBe(0);
  });
});