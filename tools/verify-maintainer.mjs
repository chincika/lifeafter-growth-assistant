const port = process.argv[2] ?? "9341";
let targets;
for (let attempt = 0; attempt < 40; attempt += 1) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; }
  catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
}
if (!targets) throw new Error("Maintainer debug endpoint did not become ready");
const page = targets.find((target) => target.type === "page");
if (!page) throw new Error("Maintainer page not found");
const socket = new WebSocket(page.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map(), errors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  if (!message.id || !pending.has(message.id)) return;
  const entry = pending.get(message.id); pending.delete(message.id);
  message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
});
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
function send(method, params = {}) { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); }
await send("Runtime.enable");
await new Promise((resolve) => setTimeout(resolve, 700));
const evaluated = await send("Runtime.evaluate", {
  expression: `(async()=>{
    const data=await window.maintainerApi.load();
    const tabs=[...document.querySelectorAll('aside nav button')];
    for(const tab of tabs){tab.click();await new Promise(r=>setTimeout(r,10));}
    tabs[4]?.click();await new Promise(r=>setTimeout(r,20));
    document.querySelector('.toolbar button')?.click();await new Promise(r=>setTimeout(r,20));
    const localImagePicker=document.body.innerText.includes('选择电脑上的长图');
    const setValue=(element,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));};
    setValue(document.querySelector('.editor input:not([type])'),'E2E 临时快报');
    setValue(document.querySelector('.editor input[type=date]'),'2026-07-17');
    setValue(document.querySelector('.editor input[type=url]'),'https://example.com/e2e-news.png');
    document.querySelector('.editor footer button:last-child')?.click();await new Promise(r=>setTimeout(r,120));
    const newsSaveSucceeded=document.body.innerText.includes('已校验并保存')&&!document.querySelector('.editor');
    tabs[2]?.click();await new Promise(r=>setTimeout(r,20));
    document.querySelector('.record-list button')?.click();await new Promise(r=>setTimeout(r,20));
    return{title:document.title,counts:data.counts,tabs:tabs.length,localImagePicker,newsSaveSucceeded,cookbookEditor:Boolean(document.querySelector('.editor')),releasePanel:Boolean(document.querySelector('.release')),nodeExposed:typeof window.require!=='undefined'||typeof window.process!=='undefined',text:document.body.innerText.slice(0,500)};
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
socket.close();
if (evaluated.exceptionDetails) throw new Error(JSON.stringify(evaluated.exceptionDetails));
const result = { ...evaluated.result.value, errors };
console.log(JSON.stringify(result, null, 2));
if (result.counts.market !== 458 || result.counts.nano !== 159 || result.counts.cookbook !== 566 || result.counts.activities !== 111 || result.counts.news !== 197) throw new Error("Maintainer content counts changed");
if (result.tabs !== 5 || !result.localImagePicker || !result.newsSaveSucceeded || !result.cookbookEditor || !result.releasePanel) throw new Error("Maintainer UI did not render or persist news correctly");
if (result.nodeExposed || errors.length) throw new Error("Maintainer security/runtime check failed");
