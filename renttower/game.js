// Entry point — the game lives in ./game/ (main = boot + loop; sim = economy; view = building; ui = screens).
//
// ★ 模块体**不再自执行**：`main.js` 导出 `start(opts)`，由 `index.html`（独立网页）或
//   `plugin.js`（宿主）调。忘了改入口的症状是**整页全白 + 零报错**。
export { start } from "./game/main.js";
