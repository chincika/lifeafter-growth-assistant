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
    growthButtons.find((button) => button.textContent?.trim() === '专研 / 升星')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const researchAttributesCollapsed = document.querySelector('.collapsible-table')?.open === false;
    growthButtons.find((button) => button.textContent?.trim() === '专精')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const masterySelect = document.querySelector('.growth-controls select');
    const versionLevelSelect = document.querySelectorAll('.growth-controls select')[1];
    if (versionLevelSelect) { versionLevelSelect.value = '0'; versionLevelSelect.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 30)); }
    const version80MasteryText = document.querySelector('.growth-page')?.textContent;
    if (versionLevelSelect) { versionLevelSelect.value = '7'; versionLevelSelect.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 20)); }
    const masteryTargetInput = document.querySelectorAll('.growth-controls input[type="number"]')[1];
    if (masteryTargetInput) { masteryTargetInput.value = '35'; masteryTargetInput.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 30)); }
    const version145MasteryText = document.querySelector('.growth-page')?.textContent;
    const evolutionOption = [...(masterySelect?.options ?? [])].find((option) => option.textContent?.includes('蛛酶步枪'));
    if (masterySelect && evolutionOption) {
      masterySelect.value = evolutionOption.value;
      masterySelect.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    const evolutionMasteryRendered = document.querySelector('.result-cards')?.textContent?.includes('精确期望点击');
    const masteryAttributeComparison = document.querySelector('.attribute-comparison')?.textContent;
    growthButtons.find((button) => button.textContent?.trim() === '腰带芯片')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    document.querySelector('.chip-list button')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const chipRange = document.querySelector('.chip-detail input[type="range"]');
    if (chipRange) { chipRange.value = '12'; chipRange.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 20)); }
    const beltDescription = document.querySelector('.chip-detail p:last-of-type')?.textContent;
    document.querySelector('.compare-action')?.click();
    document.querySelectorAll('.chip-list button')[1]?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    document.querySelector('.compare-action')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const comparedChipCount = document.querySelectorAll('.chip-comparison article').length;
    growthButtons.find((button) => button.textContent?.trim() === '人类基因')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const geneNodePlanner = document.querySelector('.node-planner')?.textContent;
    growthButtons.find((button) => button.textContent?.trim() === '图谱养成')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const graphTypeSelect = document.querySelector('.growth-controls select');
    if (graphTypeSelect) { graphTypeSelect.value = '1'; graphTypeSelect.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 20)); }
    document.querySelector('.equipment-catalog article')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const graphRecipePlanner = document.querySelector('.graph-recipe-planner')?.textContent;
    const graphContributionBeforeSkin = Number(document.querySelector('.graph-recipe-planner .result-cards strong')?.textContent);
    document.querySelector('.skin-selector input')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const graphContributionAfterSkin = Number(document.querySelector('.graph-recipe-planner .result-cards strong')?.textContent);
    document.querySelector('.graph-recipe-planner .compare-action')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    [...document.querySelectorAll('.graph-mode-switch button')].find((button) => button.textContent?.includes('复制当前'))?.click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    document.querySelector('.equipment-catalog article')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const targetInputs = document.querySelectorAll('.graph-recipe-planner .growth-controls input[type="number"]');
    if (targetInputs[0]) { targetInputs[0].value = '1'; targetInputs[0].dispatchEvent(new Event('input', { bubbles: true })); }
    if (targetInputs[1]) { targetInputs[1].value = '1'; targetInputs[1].dispatchEvent(new Event('input', { bubbles: true })); }
    await new Promise((resolve) => setTimeout(resolve, 20));
    document.querySelector('.graph-recipe-planner .compare-action')?.click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const graphUpgradeCostText = document.querySelector('.material-price-editor')?.textContent;
    const configuredGraphRecipeCount = document.querySelectorAll('.configured-recipes article').length;
    const graphSearch = document.querySelector('.growth-controls input[placeholder]');
    if (graphSearch) { graphSearch.value = '火焰喷射器'; graphSearch.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 20)); }
    document.querySelector('.equipment-catalog article')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const fireInputs = document.querySelectorAll('.graph-recipe-planner .growth-controls input[type="number"]');
    if (fireInputs[0]) { fireInputs[0].value = '4'; fireInputs[0].dispatchEvent(new Event('input', { bubbles: true })); }
    if (fireInputs[2]) { fireInputs[2].value = '20'; fireInputs[2].dispatchEvent(new Event('input', { bubbles: true })); }
    await new Promise((resolve) => setTimeout(resolve, 20));
    const fireThrowerContribution = Number(document.querySelector('.graph-recipe-planner .result-cards strong')?.textContent);
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
      researchAttributesCollapsed,
      evolutionMasteryRendered,
      version80MasteryText,
      version145MasteryText,
      masteryAttributeComparison,
      beltDescription,
      comparedChipCount,
      geneNodePlanner,
      graphRecipePlanner,
      graphSkinContributionIncreased: graphContributionAfterSkin > graphContributionBeforeSkin,
      configuredGraphRecipeCount,
      graphUpgradeCostText,
      fireThrowerContribution,
      growthPlanPersisted,
      nodeExposed: typeof window.require !== 'undefined' || typeof window.process !== 'undefined'
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});

await send("Emulation.setDeviceMetricsOverride", {
  width: 600,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await new Promise((resolve) => setTimeout(resolve, 100));
const responsiveEvaluation = await send("Runtime.evaluate", {
  expression: `(() => { const page = document.querySelector('.growth-workspace'); return page ? page.scrollWidth <= page.clientWidth + 1 : false; })()`,
  returnByValue: true,
});

socket.close();

if (evaluation.exceptionDetails) {
  throw new Error(JSON.stringify(evaluation.exceptionDetails));
}

const result = {
  ...evaluation.result.value,
  responsiveGrowthLayout: responsiveEvaluation.result.value,
  runtimeErrors,
};
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
if (!result.responsiveGrowthLayout)
  throw new Error("Growth workspace overflowed at compact width");
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
if (!result.graphSkinContributionIncreased)
  throw new Error("Graph skin contribution was not calculated");
if (result.configuredGraphRecipeCount !== 1)
  throw new Error("Graph recipe portfolio was not saved");
if (
  !result.graphUpgradeCostText?.includes("配方残页") ||
  !result.graphUpgradeCostText?.includes("纳米")
)
  throw new Error(
    "Graph upgrade costs did not include star and research materials",
  );
if (result.fireThrowerContribution !== 355)
  throw new Error(
    "Fire thrower special graph progression table was not applied",
  );
if (!result.researchAttributesCollapsed)
  throw new Error("Research attributes should be collapsed by default");
if (!result.evolutionMasteryRendered)
  throw new Error("Evolution mastery failed to render");
if (
  !result.version80MasteryText?.includes("特种电阻") ||
  result.version80MasteryText?.includes("光纤模块")
)
  throw new Error("80-level version mastery materials are incorrect");
if (
  !result.version145MasteryText?.includes("航空板材") ||
  !result.version145MasteryText?.includes("全钢框架")
)
  throw new Error(
    "145-level version mastery material replacements are incorrect",
  );
if (!result.masteryAttributeComparison?.includes("目标 Lv 35"))
  throw new Error("Mastery attribute comparison did not render");
if (
  !result.beltDescription?.includes("27.0%") ||
  result.beltDescription.includes("数值")
)
  throw new Error("Belt chip placeholders were not resolved");
if (result.comparedChipCount !== 2)
  throw new Error("Belt chip comparison did not render two chips");
if (!result.geneNodePlanner?.includes("规划单个基因节点"))
  throw new Error("Gene node planner did not render");
if (!result.growthPlanPersisted)
  throw new Error("Growth plan was not persisted");
if (!result.marketRendered) {
  throw new Error("Market data was not rendered");
}
if (runtimeErrors.length > 0)
  throw new Error("Renderer raised runtime exceptions");
