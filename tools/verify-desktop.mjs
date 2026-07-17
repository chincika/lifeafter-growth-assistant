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
    const overviewRendered = document.body.innerText.includes('今天想计算什么？');
    const before = await window.desktopApi?.listMarketItems();
    const references = await window.desktopApi?.getReferenceContent();
    const settingsBefore = await window.desktopApi?.getSettings();
    await window.desktopApi?.setSettings({ ...settingsBefore, theme: 'dark' });
    const settingsPersisted = (await window.desktopApi?.getSettings())?.theme === 'dark';
    const backupBefore = (await window.desktopApi?.listBackups())?.length ?? 0;
    await window.desktopApi?.createBackup();
    const backupCreated = ((await window.desktopApi?.listBackups())?.length ?? 0) > backupBefore;
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
    [...document.querySelectorAll('.nav-item')].find((button) => button.textContent?.trim() === '地摊')?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const marketRendered = document.body.innerText.includes("458") && document.body.innerText.includes("石纹蜂窝板");
    [...document.querySelectorAll('.nav-item')].find((button) => button.textContent?.trim() === '纳米')?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const nanoRendered = document.body.innerText.includes('纳米塑材收益') && document.querySelectorAll('.nano-table .data-row').length > 0;
    [...document.querySelectorAll('.nav-item')].find((button) => button.textContent?.trim() === '食谱')?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const cookbookRendered = document.body.innerText.includes('566 条原版资料') && document.querySelectorAll('.recipe-card').length > 100;
    document.querySelector('.recipe-card')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const cookbookDetailRendered = Boolean(document.querySelector('.recipe-detail-modal'));
    document.querySelector('.recipe-detail-modal .close-button')?.click();
    [...document.querySelectorAll('.nav-item')].find((button) => button.textContent?.trim() === '活动')?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const activitiesRendered = document.body.innerText.includes('活动计时器') && document.querySelectorAll('.category-tabs button').length === 8;
    [...document.querySelectorAll('.nav-item')].find((button) => button.textContent?.trim() === '幸存者快报')?.click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    document.querySelector('.news-history button')?.click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const newsRendered = document.body.innerText.includes('发布通道暂时关闭') && document.querySelectorAll('.news-history button').length > 100;
    const newsImageIsLocalProtocol = document.querySelector('.news-modal img')?.src.startsWith('lifeafter-news://');
    document.querySelector('.news-modal .close-button')?.click();
    [...document.querySelectorAll('.nav-item')].find((button) => button.textContent?.trim() === '设置')?.click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const settingsRendered = document.body.innerText.includes('设置与数据') && document.querySelectorAll('.settings-card').length >= 4;
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
    const evolutionMasteryRendered = document.querySelector('.result-cards')?.textContent?.includes('完整所需进度');
    const evolutionMasteryText = document.querySelector('.growth-page')?.textContent;
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
    document.querySelectorAll('.graph-category-tabs button')[1]?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    document.querySelector('.equipment-catalog article')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const graphDialogOpened = Boolean(document.querySelector('.graph-editor-dialog'));
    const graphErrorsAfterCurrent = document.querySelectorAll('.growth-page .input-error').length;
    const graphRecipePlanner = document.querySelector('.graph-recipe-planner')?.textContent;
    const graphProgressControlCount = document.querySelectorAll('.graph-progress-control input[type="range"]').length;
    const graphTargetLevelSelect = document.querySelector('.graph-target-level select');
    if (graphTargetLevelSelect?.options[1]) {
      graphTargetLevelSelect.value = graphTargetLevelSelect.options[1].value;
      graphTargetLevelSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const graphTargetLevelOnly =
      !document.querySelector('.graph-mode-switch') &&
      Boolean(graphTargetLevelSelect);
    const graphNeededScoreText = document.querySelector('.growth-page > .result-cards article:last-child strong')?.textContent;
    const graphRanges = document.querySelectorAll('.graph-recipe-planner .graph-progress-control input[type="range"]');
    if (graphRanges[1]) {
      graphRanges[1].value = '16';
      graphRanges[1].dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const graphResearchRaisedRequiredStar =
      graphRanges[0]?.value === '2' && graphRanges[2]?.value === '0';
    if (graphRanges[2]) {
      graphRanges[2].value = '21';
      graphRanges[2].dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const graphMasteryRaisedRequirements =
      graphRanges[0]?.value === '5' &&
      graphRanges[1]?.value === graphRanges[1]?.max;
    if (graphRanges[0]) {
      graphRanges[0].value = '3';
      graphRanges[0].dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const graphStarDropClampedProgress =
      Number(graphRanges[1]?.value) <= 25 && graphRanges[2]?.value === '0';
    if (graphRanges[0]) { graphRanges[0].value = '1'; graphRanges[0].dispatchEvent(new Event('input', { bubbles: true })); }
    if (graphRanges[1]) { graphRanges[1].value = '1'; graphRanges[1].dispatchEvent(new Event('input', { bubbles: true })); }
    await new Promise((resolve) => setTimeout(resolve, 20));
    const graphContributionBeforeSkin = Number(document.querySelector('.graph-recipe-planner .result-cards strong')?.textContent);
    document.querySelector('.skin-selector input')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const graphContributionAfterSkin = Number(document.querySelector('.graph-recipe-planner .result-cards strong')?.textContent);
    const graphErrorsAfterCurrentEdit = document.querySelectorAll('.growth-page .input-error').length;
    document.querySelector('.graph-editor-close')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const configuredGraphRecipeCount = document.querySelectorAll('.configured-recipes article').length;
    const graphSearch = document.querySelector('.graph-toolbar input[placeholder]');
    if (graphSearch) { graphSearch.value = '火焰喷射器'; graphSearch.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 20)); }
    document.querySelector('.equipment-catalog article')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const fireInputs = document.querySelectorAll('.graph-recipe-planner .graph-progress-control input[type="range"]');
    if (fireInputs[0]) { fireInputs[0].value = '4'; fireInputs[0].dispatchEvent(new Event('input', { bubbles: true })); }
    if (fireInputs[2]) { fireInputs[2].value = '20'; fireInputs[2].dispatchEvent(new Event('input', { bubbles: true })); }
    await new Promise((resolve) => setTimeout(resolve, 20));
    const fireThrowerContribution = Number(document.querySelector('.graph-recipe-planner .result-cards strong')?.textContent);
    document.querySelector('.equipment-catalog article.active')?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const graphSecondClickCancelled =
      !document.querySelector('.graph-editor-dialog') &&
      !document.querySelector('.equipment-catalog article.active');
    const preservedGraphPayload = {
      graphTargetLevels: [1, 2, 3, 4, 5, 6, 7],
      graphCurrentPortfolio: {
        '哨兵战术霰弹枪': {
          star: 5,
          research: 30,
          mastery: 35,
          skins: ['雨战'],
        },
      },
    };
    const planId = await window.desktopApi.saveGrowthPlan({
      name: '自动测试图谱方案',
      module: 'graph',
      payload: preservedGraphPayload,
    });
    const growthPlanPersisted = (await window.desktopApi.listGrowthPlans()).some(
      (plan) =>
        plan.id === planId &&
        JSON.stringify(plan.payload) === JSON.stringify(preservedGraphPayload),
    );
    await window.desktopApi.deleteGrowthPlan(planId);
    return {
      title: document.title,
      text: document.body.innerText,
      csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
      runtime: await window.desktopApi?.getRuntimeInfo(),
      overviewRendered,
      referenceCounts: { cookbook: references?.cookbook?.length, activities: references?.activities?.entries?.length, news: references?.news?.entries?.length },
      settingsPersisted,
      backupCreated,
      nanoRendered,
      cookbookRendered,
      cookbookDetailRendered,
      activitiesRendered,
      newsRendered,
      newsImageIsLocalProtocol,
      settingsRendered,
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
      evolutionMasteryText,
      version80MasteryText,
      version145MasteryText,
      masteryAttributeComparison,
      beltDescription,
      comparedChipCount,
      geneNodePlanner,
      graphRecipePlanner,
      graphDialogOpened,
      graphErrorsAfterCurrent,
      graphProgressControlCount,
      graphResearchRaisedRequiredStar,
      graphMasteryRaisedRequirements,
      graphStarDropClampedProgress,
      graphTargetLevelOnly,
      graphNeededScoreText,
      graphErrorsAfterCurrentEdit,
      graphSecondClickCancelled,
      graphSkinContributionIncreased: graphContributionAfterSkin > graphContributionBeforeSkin,
      configuredGraphRecipeCount,
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
if (!result.overviewRendered || !result.nanoRendered || !result.cookbookRendered || !result.cookbookDetailRendered || !result.activitiesRendered || !result.newsRendered || !result.newsImageIsLocalProtocol || !result.settingsRendered)
  throw new Error("One or more primary modules did not render or respond");
if (result.referenceCounts?.cookbook !== 566 || result.referenceCounts?.activities !== 111 || result.referenceCounts?.news !== 197)
  throw new Error("Legacy reference content counts changed");
if (!result.settingsPersisted || !result.backupCreated)
  throw new Error("Settings or backup persistence failed");
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
if (!result.graphDialogOpened)
  throw new Error("Graph recipe details did not open in a dialog");
if (
  result.graphErrorsAfterCurrent !== 0 ||
  result.graphErrorsAfterCurrentEdit !== 0
)
  throw new Error("Graph recipe editing raised an invalid downgrade error");
if (result.graphProgressControlCount < 3)
  throw new Error("Graph research and mastery progress sliders did not render");
if (
  !result.graphResearchRaisedRequiredStar ||
  !result.graphMasteryRaisedRequirements ||
  !result.graphStarDropClampedProgress
)
  throw new Error(
    "Graph star, research, and mastery unlock rules were not enforced",
  );
if (!result.graphTargetLevelOnly)
  throw new Error("Graph target should be configured by level only");
if (
  !result.graphNeededScoreText ||
  Number.parseFloat(result.graphNeededScoreText.replaceAll(",", "")) <= 0
)
  throw new Error(
    "Graph target level did not expose the remaining mastery score",
  );
if (!result.graphSecondClickCancelled)
  throw new Error("Clicking the selected graph recipe again did not cancel it");
if (!result.graphSkinContributionIncreased)
  throw new Error("Graph skin contribution was not calculated");
if (result.configuredGraphRecipeCount !== 1)
  throw new Error("Graph recipe portfolio was not saved");
if (result.fireThrowerContribution !== 355)
  throw new Error(
    "Fire thrower special graph progression table was not applied",
  );
if (!result.researchAttributesCollapsed)
  throw new Error("Research attributes should be collapsed by default");
if (!result.evolutionMasteryRendered)
  throw new Error("Evolution mastery failed to render");
if (
  !result.evolutionMasteryText?.includes("战术护木 60") ||
  !result.evolutionMasteryText?.includes("金条 48,000")
)
  throw new Error(
    "Evolution mastery did not multiply each material and gold cost by required progress",
  );
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
