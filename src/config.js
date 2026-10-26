// 构建配置。
// `saveKey` 是**宿主 storage 里的键**（宿主会再套一层 `<gameId>:` 前缀，`__` 开头是宿主保留）。
// 原版叫 `abyss-mine:v2`（云端 KV 的键）；接进宿主后没有历史包袱，直接用 `save`。
export const CONFIG = { saveKey: 'save', autosave: 5 };
