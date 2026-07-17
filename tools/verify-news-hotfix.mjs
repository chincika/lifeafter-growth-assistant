const port = process.argv[2] ?? "9342";
const expectedId = process.argv[3];
const expectedDate = process.argv[4];

let targets;
for (let attempt = 0; attempt < 80; attempt += 1) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
if (!targets) throw new Error("Client debug endpoint did not become ready");

const page = targets.find((target) => target.type === "page");
if (!page) throw new Error("Client page not found");
const socket = new WebSocket(page.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (!message.id || !pending.has(message.id)) return;
  const entry = pending.get(message.id);
  pending.delete(message.id);
  message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
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
await send("Network.enable");
await send("Network.clearBrowserCache");
const evaluated = await send("Runtime.evaluate", {
  expression: `(async()=>{
    await new Promise(r=>setTimeout(r,1800));
    const update=await window.desktopApi.checkUpdates(true);
    const references=await window.desktopApi.getReferenceContent();
    const target=${JSON.stringify(expectedDate)}?references.news.entries.find(entry=>entry.publishedDate===${JSON.stringify(expectedDate)}):references.news.entries[0];
    document.querySelector('.news-modal .close-button')?.click();
    await new Promise(r=>setTimeout(r,50));
    let newsButton;
    for(let attempt=0;attempt<30&&!newsButton;attempt+=1){
      const navItems=[...document.querySelectorAll('.nav-item')];
      (navItems.find(button=>button.textContent?.trim()==='\u5e78\u5b58\u8005\u5feb\u62a5')??navItems[5])?.click();
      await new Promise(r=>setTimeout(r,100));
      const buttons=[...document.querySelectorAll('.news-history button')];
      newsButton=${JSON.stringify(expectedDate)}?buttons.find(button=>button.textContent?.includes(${JSON.stringify(expectedDate)})):buttons[0];
    }
    newsButton?.click();
    for(let attempt=0;attempt<30&&!document.querySelector('.news-modal img');attempt+=1)await new Promise(r=>setTimeout(r,100));
    await new Promise((resolve,reject)=>{
      const img=document.querySelector('.news-modal img');
      if(!img)return reject(new Error('news image modal did not open'));
      if(img.complete&&img.naturalWidth>0)return resolve();
      img.addEventListener('load',resolve,{once:true});
      img.addEventListener('error',()=>reject(new Error('news image failed to load')),{once:true});
      setTimeout(()=>reject(new Error('news image load timed out')),30000);
    });
    const img=document.querySelector('.news-modal img');
    return{update,target,src:img?.src,naturalWidth:img?.naturalWidth,naturalHeight:img?.naturalHeight};
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
socket.close();
if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description ?? evaluated.exceptionDetails.text);
const result = evaluated.result.value;
console.log(JSON.stringify(result, null, 2));
if (expectedId && result.target?.id !== expectedId) throw new Error(`Expected news ID ${expectedId}, got ${result.target?.id}`);
if (!result.naturalWidth || !result.src?.startsWith("lifeafter-news://") || !result.src.includes("session=")) throw new Error("Updated news image did not render with a launch-specific URL");
