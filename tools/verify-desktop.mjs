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
    const initialFirstItem = before?.[0]?.name;
    const target = before?.[10];
    if (target) await window.desktopApi.setMarketItemState({ id: target.id, marketPrice: 123, focused: true });
    const recipeTarget = before?.find((item) => item.recipe.length > 0);
    const recipeIngredient = recipeTarget?.recipe[0];
    if (recipeTarget && recipeIngredient) await window.desktopApi.setRecipeChoice({ productId: recipeTarget.id, ingredientId: recipeIngredient.ingredientId, acquisitionMode: 'purchase' });
    if (before?.[0]) await window.desktopApi.addCustomMarketItem({ name: '自动测试产品', resourceType: 5, level: 3, marketPrice: 1000, couponCost: 0, ingredients: [{ ingredientId: before[0].id, quantity: 2, acquisitionMode: 'craft' }] });
    const after = await window.desktopApi?.listMarketItems();
    const persisted = after?.find((item) => item.id === target?.id);
    const persistedRecipe = after?.find((item) => item.id === recipeTarget?.id)?.recipe[0];
    const marketRendered = document.body.innerText.includes("458") && document.body.innerText.includes("石纹蜂窝板");
    [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === '养成计算')?.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const growthButtons = [...document.querySelectorAll('.growth-tabs button')];
    const growthPages = [];
    for (const button of growthButtons) {
      button.click(); await new Promise((resolve) => setTimeout(resolve, 20));
      growthPages.push({ name: button.textContent?.trim(), text: document.querySelector('.growth-page')?.textContent?.slice(0, 300) });
    }
    growthButtons.find((button) => button.textContent?.trim() === '图谱养成')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    document.querySelector('.equipment-catalog article')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const graphRecipePlanner = document.querySelector('.graph-recipe-planner')?.textContent;
    const planId = await window.desktopApi.saveGrowthPlan({ name: '自动测试养成方案', module: 'research', payload: { from: 0, to: 30 } });
    const growthPlanPersisted = (await window.desktopApi.listGrowthPlans()).some((plan) => plan.id === planId && plan.payload.to === 30);
    await window.desktopApi.deleteGrowthPlan(planId);
    return {
      title: document.title,
      text: document.body.innerText,
      csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
      runtime: await window.desktopApi?.getRuntimeInfo(),
      marketItemCount: after?.length,
      marketRendered,
      initialFirstItem,
      focusedFirst: after?.[0]?.id === target?.id,
      customItemCreated: after?.some((item) => item.name === '自动测试产品' && item.recipe.length === 1),
      statePersisted: persisted?.marketPrice === 123 && persisted?.focused === true,
      recipeChoicePersisted: persistedRecipe?.acquisitionMode === 'purchase',
      growthPages,
      graphRecipePlanner,
      growthPlanPersisted,
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
console.log(
  JSON.stringify(
    { ...result, text: undefined, textPreview: result.text.slice(0, 500) },
    null,
    2,
  ),
);

if (!result.text.includes("明日之后养成助手"))
  throw new Error("Expected UI text is missing");
if (!result.csp) throw new Error("Content Security Policy is missing");
if (!result.runtime || result.runtime.platform !== "win32") {
  throw new Error("Preload bridge is unavailable");
}
if (result.nodeExposed)
  throw new Error("Node globals are exposed to the renderer");
if (result.marketItemCount !== 459)
  throw new Error("Bundled or custom market data was not loaded");
if (result.initialFirstItem !== "木头")
  throw new Error("Market data is not sorted by legacy type and level");
if (!result.focusedFirst)
  throw new Error("Focused market item was not moved to the top");
if (!result.customItemCreated)
  throw new Error("Custom market item was not persisted");
if (!result.statePersisted)
  throw new Error("Personal item state was not persisted");
if (!result.recipeChoicePersisted)
  throw new Error("Recipe acquisition mode was not persisted");
if (
  result.growthPages?.length !== 8 ||
  result.growthPages.some((page) => !page.text)
)
  throw new Error("Growth modules did not render");
if (!result.graphRecipePlanner?.includes("配方精通规划"))
  throw new Error("Graph recipe planner did not render");
if (!result.growthPlanPersisted)
  throw new Error("Growth plan was not persisted");
if (!result.marketRendered) {
  throw new Error("Market data was not rendered");
}
if (runtimeErrors.length > 0)
  throw new Error("Renderer raised runtime exceptions");
