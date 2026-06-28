/**
 * HistoryManager.js
 * Undo / Redo using the Command pattern.
 * Each command is { label, execute, undo }.
 */

export class HistoryManager {
  constructor({ maxSize = 200 } = {}) {
    /** @type {Array<{label:string, execute:Function, undo:Function}>} */
    this._undoStack = [];
    /** @type {Array<{label:string, execute:Function, undo:Function}>} */
    this._redoStack = [];
    this.maxSize = maxSize;
    this._listeners = new Set();
  }

  // ─── Subscriptions ───────────────────────────────────────────────────────────

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    const state = this.snapshot();
    this._listeners.forEach((fn) => fn(state));
  }

  snapshot() {
    return {
      canUndo: this._undoStack.length > 0,
      canRedo: this._redoStack.length > 0,
      undoLabel: this._undoStack.at(-1)?.label ?? null,
      redoLabel: this._redoStack.at(-1)?.label ?? null,
      undoCount: this._undoStack.length,
      redoCount: this._redoStack.length,
    };
  }

  // ─── Core API ────────────────────────────────────────────────────────────────

  /**
   * Push and immediately execute a command.
   * @param {{ label: string, execute: Function, undo: Function }} cmd
   */
  push(cmd) {
    cmd.execute();
    this._undoStack.push(cmd);
    // Trim history if oversized
    if (this._undoStack.length > this.maxSize) {
      this._undoStack.shift();
    }
    // Any new action clears the redo future
    this._redoStack = [];
    this._emit();
  }

  undo() {
    if (this._undoStack.length === 0) return;
    const cmd = this._undoStack.pop();
    cmd.undo();
    this._redoStack.push(cmd);
    this._emit();
  }

  redo() {
    if (this._redoStack.length === 0) return;
    const cmd = this._redoStack.pop();
    cmd.execute();
    this._undoStack.push(cmd);
    this._emit();
  }

  clear() {
    this._undoStack = [];
    this._redoStack = [];
    this._emit();
  }
}
