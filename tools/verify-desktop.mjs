const port = process.argv[2] ?? "9340";
const endpoint = `http://127.0.0.1:${port}/json`;

let targets;
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    targets = await (await fetch(endpoint)).json();
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

if (!targets) throw new Error("Desktop debug endpoint did not become ready");
const page = targets.find((target) => target.type === "page");
if (!page) throw new Error("Desktop page target was not found");

const socket = new WebSocket(page.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
const runtimeErrors = [];

socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (message.method === "Runtime.exceptionThrown") {
    runtimeErrors.push(message.params.exceptionDetails.text);
  }
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(JSON.stringify(message.error)));
  else resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await send("Runtime.enable");
await new Promise((resolve) => setTimeout(resolve, 1_000));

const evaluation = await send("Runtime.evaluate", {
  expression: `(async () => ({
    title: document.title,
    text: document.body.innerText,
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
    runtime: await window.desktopApi?.getRuntimeInfo(),
    nodeExposed: typeof window.require !== 'undefined' || typeof window.process !== 'undefined'
  }))()`,
  awaitPromise: true,
  returnByValue: true,
});

socket.close();

if (evaluation.exceptionDetails) {
  throw new Error(JSON.stringify(evaluation.exceptionDetails));
}

const result = { ...evaluation.result.value, runtimeErrors };
console.log(JSON.stringify(result, null, 2));

if (!result.text.includes("明日之后养成助手")) throw new Error("Expected UI text is missing");
if (!result.csp) throw new Error("Content Security Policy is missing");
if (!result.runtime || result.runtime.platform !== "win32") {
  throw new Error("Preload bridge is unavailable");
}
if (result.nodeExposed) throw new Error("Node globals are exposed to the renderer");
if (runtimeErrors.length > 0) throw new Error("Renderer raised runtime exceptions");
