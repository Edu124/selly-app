/**
 * Codeforge AI Hub — VS Code Extension (Enhanced)
 *
 * Features:
 *  1. Generate Unit Tests     — select code → right-click → generate test file
 *  2. Inline Code Suggester   — ghost text completions as you type (Tab to accept)
 *  3. Smart Debug             — describe bug → AI analyzes current + connected files → applies fixes
 *  4. Terminal Error Explainer — paste error → AI explains + proposes fix → apply on approval
 */

import * as vscode from "vscode";
import * as fs     from "fs";
import * as path   from "path";
import WebSocket   from "ws";

// ── Constants ──────────────────────────────────────────────────────────────────
const HUB_URL             = "ws://127.0.0.1:7471";
const RECONNECT_DELAY_MS  = 3000;
const CONTEXT_DEBOUNCE_MS = 500;
const INLINE_DEBOUNCE_MS  = 800;   // wait this long after last keystroke before suggesting
const INLINE_TIMEOUT_MS   = 5000;  // give up on inline suggestion after this

// ── State ──────────────────────────────────────────────────────────────────────
let ws:               WebSocket | null = null;
let statusBarItem:    vscode.StatusBarItem;
let outputChannel:    vscode.OutputChannel | null = null;
let reconnectTimer:   ReturnType<typeof setTimeout> | null = null;
let contextTimer:     ReturnType<typeof setTimeout> | null = null;
let inlineDebounce:   ReturnType<typeof setTimeout> | null = null;
let isConnected       = false;

// Response buffer — collects streamed tokens from Hub for in-extension features
let responseBuffer    = "";
let currentOperation: string | null = null;
let currentOpMeta:    Record<string, any> = {};

// Inline suggestion — resolved when Hub returns suggestion
let pendingInlineResolve: ((s: string) => void) | null = null;

// ── Helpers ────────────────────────────────────────────────────────────────────

function detectEditorName(): string {
  const name = vscode.env.appName.toLowerCase();
  if (name.includes("cursor"))   return "cursor";
  if (name.includes("windsurf")) return "windsurf";
  return "vscode";
}

function send(obj: object): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function setStatus(connected: boolean, text?: string): void {
  statusBarItem.text    = connected ? "$(circle-filled) CodeForge AI" : "$(circle-outline) CodeForge AI";
  statusBarItem.tooltip = connected ? "CodeForge AI: Connected" : (text || "CodeForge AI: Disconnected — click to reconnect");
  statusBarItem.color   = connected ? new vscode.ThemeColor("statusBar.foreground") : "#888";
}

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) outputChannel = vscode.window.createOutputChannel("CodeForge AI");
  return outputChannel;
}

// ── Context sender ─────────────────────────────────────────────────────────────

function scheduleContextUpdate(): void {
  if (contextTimer) clearTimeout(contextTimer);
  contextTimer = setTimeout(sendContextUpdate, CONTEXT_DEBOUNCE_MS);
}

function sendContextUpdate(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !isConnected) return;
  const doc = editor.document;
  send({
    type:         "context",
    file:         doc.fileName,
    language:     doc.languageId,
    selectedCode: doc.getText(editor.selection),
    fullCode:     doc.getText().slice(0, 3000),
    cursorLine:   editor.selection.active.line + 1,
  });
}

// ── Operation complete dispatcher ─────────────────────────────────────────────

async function handleOperationComplete(): Promise<void> {
  const result = responseBuffer;
  const op     = currentOperation;
  const meta   = { ...currentOpMeta };
  responseBuffer    = "";
  currentOperation  = null;
  currentOpMeta     = {};

  switch (op) {
    case "test_generate":    await handleTestResult(result, meta);        break;
    case "debug_query":      await handleDebugResult(result, meta);       break;
    case "terminal_error":   await handleTerminalFixResult(result, meta); break;
    case "inline_suggest":
      if (pendingInlineResolve) { pendingInlineResolve(result); pendingInlineResolve = null; }
      break;
  }
}

// ── Feature 1: Generate Unit Tests ────────────────────────────────────────────

async function generateUnitTests(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { vscode.window.showWarningMessage("CodeForge AI: Open a file first."); return; }
  if (!isConnected) { vscode.window.showWarningMessage("CodeForge AI: Not connected to Hub."); return; }

  const doc       = editor.document;
  const selection = doc.getText(editor.selection);
  const code      = selection || doc.getText().slice(0, 4000);
  const language  = doc.languageId;
  const fileName  = doc.fileName;
  const framework = await detectTestFramework(fileName, language);

  vscode.window.showInformationMessage(`CodeForge AI: Generating ${framework} tests…`);

  currentOperation = "test_generate";
  currentOpMeta    = { fileName, language, framework };
  responseBuffer   = "";

  send({ type: "test_generate", code, language, framework, fileName: path.basename(fileName), suggestedTokens: 1200 });
}

async function detectTestFramework(filePath: string, language: string): Promise<string> {
  let searchDir = path.dirname(filePath);
  for (let i = 0; i < 4; i++) {
    // JS/TS: check package.json
    try {
      const pkg  = JSON.parse(fs.readFileSync(path.join(searchDir, "package.json"), "utf8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps["vitest"])             return "Vitest";
      if (deps["jest"] || deps["@jest/core"]) return "Jest";
      if (deps["mocha"])              return "Mocha";
    } catch { /* not found */ }
    // Python: check requirements.txt
    try {
      const req = fs.readFileSync(path.join(searchDir, "requirements.txt"), "utf8");
      if (req.includes("pytest")) return "pytest";
    } catch { /* not found */ }
    searchDir = path.dirname(searchDir);
  }
  // Fallback by language
  const defaults: Record<string, string> = {
    python: "pytest", java: "JUnit", rust: "Rust built-in tests",
    go: "Go testing", csharp: "xUnit",
  };
  return defaults[language] || "Jest";
}

async function handleTestResult(result: string, meta: Record<string, any>): Promise<void> {
  // Strip markdown code fences if present
  const codeMatch = result.match(/```[\w]*\n([\s\S]+?)```/);
  const testCode  = codeMatch ? codeMatch[1] : result;

  const testPath = getTestFilePath(meta.fileName, meta.language);
  try {
    const uri = vscode.Uri.file(testPath);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(testCode, "utf8"));
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    vscode.window.showInformationMessage(`✅ CodeForge AI: Tests created → ${path.basename(testPath)}`);
  } catch (err) {
    vscode.window.showErrorMessage(`CodeForge AI: Could not create test file — ${err}`);
  }
}

function getTestFilePath(filePath: string, language: string): string {
  const dir  = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const ext  = path.extname(filePath);
  if (language === "python")  return path.join(dir, `test_${base}.py`);
  if (language === "java")    return path.join(dir, `${base}Test.java`);
  if (language === "go")      return path.join(dir, `${base}_test.go`);
  return path.join(dir, `${base}.test${ext}`);
}

// ── Feature 2: Inline Code Suggester ─────────────────────────────────────────

function registerInlineSuggester(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration("codeforgeai");
  if (!config.get<boolean>("inlineSuggestions", true)) return;

  const provider: vscode.InlineCompletionItemProvider = {
    async provideInlineCompletionItems(doc, position, _ctx, token) {
      if (!isConnected) return null;
      if (currentOperation && currentOperation !== "inline_suggest") return null;

      const linePrefix = doc.getText(new vscode.Range(position.with(undefined, 0), position));
      if (!linePrefix.trim() || linePrefix.trim().length < 3) return null;

      // Get up to 10 lines of context above cursor
      const startLine  = Math.max(0, position.line - 10);
      const contextCode = doc.getText(new vscode.Range(new vscode.Position(startLine, 0), position));

      if (token.isCancellationRequested) return null;

      const suggestion = await requestInlineSuggestion(contextCode, doc.languageId, token);
      if (!suggestion || token.isCancellationRequested) return null;

      return [new vscode.InlineCompletionItem(suggestion)];
    },
  };

  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, provider)
  );
}

function requestInlineSuggestion(
  ctx: string, language: string, token: vscode.CancellationToken
): Promise<string> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { pendingInlineResolve = null; resolve(""); }, INLINE_TIMEOUT_MS);

    token.onCancellationRequested(() => {
      clearTimeout(timeout);
      pendingInlineResolve = null;
      resolve("");
    });

    pendingInlineResolve = (suggestion: string) => { clearTimeout(timeout); resolve(suggestion); };

    currentOperation = "inline_suggest";
    responseBuffer   = "";
    send({ type: "inline_suggest", context: ctx, language, suggestedTokens: 60 });
  });
}

// ── Feature 3: Smart Debug ────────────────────────────────────────────────────

async function debugWithAI(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { vscode.window.showWarningMessage("CodeForge AI: Open a file first."); return; }
  if (!isConnected) { vscode.window.showWarningMessage("CodeForge AI: Not connected to Hub."); return; }

  const bugDesc = await vscode.window.showInputBox({
    prompt:          "Describe the bug or error you're seeing",
    placeHolder:     "e.g. getUserData returns null when user hasn't logged in",
    ignoreFocusOut:  true,
  });
  if (!bugDesc) return;

  const doc         = editor.document;
  const currentFile = doc.fileName;
  const currentCode = doc.getText();
  const language    = doc.languageId;

  vscode.window.showInformationMessage("CodeForge AI: Scanning connected files…");

  // Find files imported/required by the current file (max 5)
  const connectedPaths   = findConnectedFiles(currentFile, currentCode, language);
  const connectedFiles: Array<{ name: string; path: string; content: string }> = [];
  for (const fp of connectedPaths) {
    try {
      connectedFiles.push({
        name:    path.basename(fp),
        path:    fp,
        content: fs.readFileSync(fp, "utf8").slice(0, 2000),
      });
    } catch { /* unreadable */ }
  }

  const fileCount = connectedFiles.length + 1;
  vscode.window.showInformationMessage(`CodeForge AI: Debugging across ${fileCount} file(s)…`);

  currentOperation = "debug_query";
  currentOpMeta    = { currentFile, language, connectedFiles };
  responseBuffer   = "";

  send({
    type:           "debug_query",
    bugDescription: bugDesc,
    currentFile:    path.basename(currentFile),
    currentCode:    currentCode.slice(0, 4000),
    language,
    connectedFiles,
    suggestedTokens: 1500,
  });
}

function findConnectedFiles(filePath: string, content: string, language: string): string[] {
  const dir   = path.dirname(filePath);
  const found: string[] = [];
  let   regex: RegExp | null = null;

  if (["javascript","typescript","javascriptreact","typescriptreact"].includes(language)) {
    regex = /(?:import\s+[\s\S]*?\s+from|require)\s*\(?['"](\.[^'"]+)['"]\)?/g;
  } else if (language === "python") {
    regex = /(?:from\s+(\.[\w./]+)\s+import|import\s+(\.[\w./]+))/g;
  }
  if (!regex) return [];

  const exts = language === "python" ? [".py"] : [".ts",".tsx",".js",".jsx",""];
  let m: RegExpExecArray | null;

  while ((m = regex.exec(content)) !== null && found.length < 5) {
    const imp      = m[1] || m[2];
    if (!imp || !imp.startsWith(".")) continue;
    const resolved = path.resolve(dir, imp);

    for (const ext of exts) {
      const candidate = resolved + ext;
      if (fs.existsSync(candidate) && candidate !== filePath) { found.push(candidate); break; }
      if (ext) {
        const idx = path.join(resolved, `index${ext}`);
        if (fs.existsSync(idx)) { found.push(idx); break; }
      }
    }
  }

  return [...new Set(found)];
}

interface CodeChange { file: string; description: string; oldCode: string; newCode: string; }

async function handleDebugResult(result: string, meta: Record<string, any>): Promise<void> {
  const changesMatch = result.match(/<CHANGES>([\s\S]*?)<\/CHANGES>/);
  const explanation  = result.replace(/<CHANGES>[\s\S]*?<\/CHANGES>/g, "").trim();

  // Always show explanation in output channel
  const ch = getOutputChannel();
  ch.appendLine("\n═══ CodeForge AI — Debug Analysis ═══");
  ch.appendLine(explanation);
  ch.show(true);

  if (!changesMatch) return;

  let changes: CodeChange[] = [];
  try { changes = JSON.parse(changesMatch[1].trim()); } catch { return; }
  if (!changes.length) return;

  const fileList = changes.map(c => `• ${c.file}: ${c.description}`).join("\n");
  const choice   = await vscode.window.showInformationMessage(
    `CodeForge AI wants to make ${changes.length} change(s)`,
    { modal: true, detail: `${explanation.slice(0, 250)}\n\n${fileList}` },
    "Apply All", "Review Each", "Cancel"
  );

  if (choice === "Apply All") {
    await applyChanges(changes, meta.connectedFiles, meta.currentFile);
    vscode.window.showInformationMessage(`✅ CodeForge AI: Applied ${changes.length} fix(es)`);
  } else if (choice === "Review Each") {
    for (const change of changes) {
      const c = await vscode.window.showInformationMessage(
        `Fix: ${change.description}`,
        { modal: true, detail: `File: ${change.file}\n\nOld:\n${change.oldCode}\n\nNew:\n${change.newCode}` },
        "Apply", "Skip"
      );
      if (c === "Apply") {
        await applyChanges([change], meta.connectedFiles, meta.currentFile);
      }
    }
  }
}

// ── Feature 4: Terminal Error Explainer ───────────────────────────────────────

async function explainTerminalError(): Promise<void> {
  if (!isConnected) { vscode.window.showWarningMessage("CodeForge AI: Not connected to Hub."); return; }

  // Pre-fill InputBox with clipboard text if it looks like an error
  const clip       = await vscode.env.clipboard.readText();
  const looksLike  = clip.length > 10 && clip.length < 2000;

  const errorText = await vscode.window.showInputBox({
    prompt:         "Paste the terminal error (or it was auto-filled from clipboard)",
    value:          looksLike ? clip : "",
    placeHolder:    "e.g. TypeError: Cannot read properties of undefined (reading 'map')",
    ignoreFocusOut: true,
  });
  if (!errorText) return;

  const editor      = vscode.window.activeTextEditor;
  const currentFile = editor?.document.fileName || "";
  const currentCode = editor?.document.getText().slice(0, 3000) || "";
  const language    = editor?.document.languageId || "";

  vscode.window.showInformationMessage("CodeForge AI: Analyzing error…");

  currentOperation = "terminal_error";
  currentOpMeta    = { errorText, currentFile, language };
  responseBuffer   = "";

  send({ type: "terminal_error", errorText, currentFile: path.basename(currentFile), currentCode, language, suggestedTokens: 800 });
}

async function handleTerminalFixResult(result: string, meta: Record<string, any>): Promise<void> {
  const fixMatch    = result.match(/<FIX>([\s\S]*?)<\/FIX>/);
  const explanation = result.replace(/<FIX>[\s\S]*?<\/FIX>/g, "").trim();

  // Show explanation
  const ch = getOutputChannel();
  ch.appendLine("\n═══ CodeForge AI — Error Explanation ═══");
  ch.appendLine(explanation);
  ch.show(true);

  if (!fixMatch) {
    vscode.window.showInformationMessage("CodeForge AI: Error explained — see CodeForge AI output panel.");
    return;
  }

  let fixes: CodeChange[] = [];
  try { fixes = JSON.parse(fixMatch[1].trim()); } catch { return; }
  if (!fixes.length) return;

  ch.appendLine("\n── Proposed Fix ──");
  for (const fix of fixes) {
    ch.appendLine(`${fix.file}: ${fix.description}`);
    ch.appendLine(`  Old: ${fix.oldCode}`);
    ch.appendLine(`  New: ${fix.newCode}`);
  }

  const choice = await vscode.window.showInformationMessage(
    `CodeForge AI found a fix for the error`,
    { modal: false },
    "Apply Fix", "Show Details", "Dismiss"
  );

  if (choice === "Apply Fix") {
    await applyChanges(fixes, [], meta.currentFile);
    vscode.window.showInformationMessage("✅ CodeForge AI: Fix applied!");
  } else if (choice === "Show Details") {
    getOutputChannel().show();
  }
}

// ── Shared: Apply code changes via WorkspaceEdit ──────────────────────────────

async function applyChanges(
  changes: CodeChange[],
  connectedFiles: Array<{ name: string; path: string }>,
  currentFilePath: string
): Promise<void> {
  const edit = new vscode.WorkspaceEdit();

  for (const change of changes) {
    // Resolve file path: check connected files first, fallback to current file
    const connMatch = connectedFiles.find(f => f.name === change.file);
    const resolvedPath = connMatch?.path
      || (path.basename(currentFilePath) === change.file ? currentFilePath : currentFilePath);

    try {
      const uri  = vscode.Uri.file(resolvedPath);
      const doc  = await vscode.workspace.openTextDocument(uri);
      const text = doc.getText();
      const idx  = text.indexOf(change.oldCode);
      if (idx === -1) { vscode.window.showWarningMessage(`CodeForge AI: Could not locate code in ${change.file} — skipped.`); continue; }
      const start = doc.positionAt(idx);
      const end   = doc.positionAt(idx + change.oldCode.length);
      edit.replace(uri, new vscode.Range(start, end), change.newCode);
    } catch (err) {
      vscode.window.showWarningMessage(`CodeForge AI: Could not edit ${change.file} — ${err}`);
    }
  }

  await vscode.workspace.applyEdit(edit);
}

// ── Context menu helper (existing commands) ────────────────────────────────────

function sendCommand(verb: string): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor)      { vscode.window.showWarningMessage("CodeForge AI: No active editor.");          return; }
  if (!isConnected) { vscode.window.showWarningMessage("CodeForge AI: Not connected to Hub.");      return; }
  const selected = editor.document.getText(editor.selection);
  if (!selected)    { vscode.window.showWarningMessage("CodeForge AI: Select some code first.");    return; }
  sendContextUpdate();
  send({ type: "message", text: `${verb}:\n\`\`\`${editor.document.languageId}\n${selected}\n\`\`\`` });
  vscode.window.showInformationMessage(`CodeForge AI: Sent "${verb}" — check the CodeForge Hub panel.`);
}

// ── WebSocket ──────────────────────────────────────────────────────────────────

function connect(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { try { ws.terminate(); } catch { /* ignore */ } ws = null; }

  const socket = new WebSocket(HUB_URL);
  ws = socket;

  socket.on("open", () => {
    isConnected = true;
    setStatus(true);
    send({ type: "hello", editor: detectEditorName(), version: "1.1.0" });
    sendContextUpdate();
  });

  socket.on("message", (raw: WebSocket.RawData) => {
    let msg: Record<string, any>;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      // Streaming tokens — buffer for in-extension feature handlers
      case "token":
        if (msg.content) responseBuffer += msg.content;
        break;

      // Stream complete — dispatch to feature handler
      case "done":
        handleOperationComplete();
        break;

      // Error from Hub
      case "error":
        if (currentOperation) {
          vscode.window.showErrorMessage(`CodeForge AI: ${msg.message || "Unknown error"}`);
          responseBuffer = ""; currentOperation = null; currentOpMeta = {};
          if (pendingInlineResolve) { pendingInlineResolve(""); pendingInlineResolve = null; }
        }
        break;

      // Legacy: apply code directly to editor selection
      case "apply":
        if (msg.code) {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            editor.edit(eb => { eb.replace(editor.selection, msg.code); });
            vscode.window.showInformationMessage("CodeForge AI: Code applied ✓");
          }
        }
        break;

      case "ping":
        send({ type: "pong" });
        break;
    }
  });

  socket.on("close", () => {
    isConnected = false; ws = null;
    setStatus(false, "CodeForge AI: Disconnected — retrying…");
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
  });

  socket.on("error", () => {
    isConnected = false;
    setStatus(false, "CodeForge AI: Hub not reachable — is CodeForge running?");
  });
}

// ── Activation ─────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "codeforgeai.connect";
  statusBarItem.show();
  setStatus(false, "CodeForge AI: Connecting…");
  context.subscriptions.push(statusBarItem);

  // Connect to Hub
  connect();

  // Register all commands
  context.subscriptions.push(
    // Existing commands
    vscode.commands.registerCommand("codeforgeai.explain",  () => sendCommand("Explain this code")),
    vscode.commands.registerCommand("codeforgeai.refactor", () => sendCommand("Refactor this code to be cleaner and more efficient")),
    vscode.commands.registerCommand("codeforgeai.fix",      () => sendCommand("Find and fix the bug in this code")),
    vscode.commands.registerCommand("codeforgeai.comment",  () => sendCommand("Add clear inline comments to this code")),
    vscode.commands.registerCommand("codeforgeai.connect",  () => { vscode.window.showInformationMessage("CodeForge AI: Reconnecting…"); connect(); }),

    // New commands
    vscode.commands.registerCommand("codeforgeai.generateTests",       () => generateUnitTests()),
    vscode.commands.registerCommand("codeforgeai.debugWithAI",         () => debugWithAI()),
    vscode.commands.registerCommand("codeforgeai.explainTerminalError",() => explainTerminalError()),
  );

  // Register inline suggester
  registerInlineSuggester(context);

  // Context change listeners
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(() => scheduleContextUpdate()),
    vscode.window.onDidChangeActiveTextEditor(()    => scheduleContextUpdate()),
    vscode.workspace.onDidSaveTextDocument(()       => scheduleContextUpdate()),
  );
}

export function deactivate(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (contextTimer)   clearTimeout(contextTimer);
  if (inlineDebounce) clearTimeout(inlineDebounce);
  if (ws)             ws.terminate();
  if (pendingInlineResolve) pendingInlineResolve("");
}
