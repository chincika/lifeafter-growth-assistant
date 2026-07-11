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
  expression: `(async () => {
    const before = await window.desktopApi?.listMarketItems();
    const target = before?.[0];
    if (target) await window.desktopApi.setMarketItemState({ id: target.id, marketPrice: 123, focused: true });
    const recipeTarget = before?.find((item) => item.recipe.length > 0);
    const recipeIngredient = recipeTarget?.recipe[0];
    if (recipeTarget && recipeIngredient) await window.desktopApi.setRecipeChoice({ productId: recipeTarget.id, ingredientId: recipeIngredient.ingredientId, acquisitionMode: 'purchase' });
    const after = await window.desktopApi?.listMarketItems();
    const persisted = after?.find((item) => item.id === target?.id);
    const persistedRecipe = after?.find((item) => item.id === recipeTarget?.id)?.recipe[0];
    return {
      title: document.title,
      text: document.body.innerText,
      csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
      runtime: await window.desktopApi?.getRuntimeInfo(),
      marketItemCount: after?.length,
      firstMarketItem: after?.[0]?.name,
      statePersisted: persisted?.marketPrice === 123 && persisted?.focused === true,
      recipeChoicePersisted: persistedRecipe?.acquisitionMode === 'purchase',
      nodeExposed: typeof window.require !== 'undefined' || typeof window.process !== 'undefined'
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});

socket.close();

if (evaluation.exceptionDetails) {
  throw new Error(JSON.stringify(evaluation.exceptionDetails));
}

const result = { ...evaluation.result.value, runtimeErrors };
console.log(JSON.stringify({ ...result, text: undefined, textPreview: result.text.slice(0, 500) }, null, 2));

if (!result.text.includes("明日之后养成助手")) throw new Error("Expected UI text is missing");
if (!result.csp) throw new Error("Content Security Policy is missing");
if (!result.runtime || result.runtime.platform !== "win32") {
  throw new Error("Preload bridge is unavailable");
}
if (result.nodeExposed) throw new Error("Node globals are exposed to the renderer");
if (result.marketItemCount !== 458) throw new Error("Bundled market data was not loaded");
if (result.firstMarketItem !== "木头") throw new Error("Market data is not sorted by legacy type and level");
if (!result.statePersisted) throw new Error("Personal item state was not persisted");
if (!result.recipeChoicePersisted) throw new Error("Recipe acquisition mode was not persisted");
if (!result.text.includes("458") || !result.text.includes("石纹蜂窝板")) {
  throw new Error("Market data was not rendered");
}
if (runtimeErrors.length > 0) throw new Error("Renderer raised runtime exceptions");
