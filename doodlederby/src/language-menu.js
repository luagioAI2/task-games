/**
 * language-menu.js —— 顶栏那个语言下拉。
 *
 * ## 插件里改了两处
 *
 * 1. **坐标基准**：原来 `#language-menu` 是 `position:fixed`，`open()` 直接把
 *    `trigger.getBoundingClientRect()`（**视口坐标**）写进 `left/top`。样式里
 *    `fixed` 已经全改成 `absolute`（见 `scripts/gen-styles.mjs`），包含块变成挂载根
 *    ⇒ 必须减掉挂载根的 `left/top`，否则菜单会按宿主顶栏的高度错开一段。
 * 2. **可卸载**：原来往 `document` / `window` 上挂了捕获阶段 `pointerdown` 与
 *    `resize`，卸载后还活着（切走再切回来会叠第二个）。
 *    现在返回 `dispose()`，由 `game.js` 的 `destroy()` 调。
 */
export function mountLanguageMenu(root, select, scope) {
  const trigger = root.querySelector('#language-toggle')
  const menu = root.querySelector('#language-menu')
  const options = [...menu.querySelectorAll('[data-language]')]

  function sync() {
    const current = options.find((b) => b.dataset.language === select.value) || options[0]
    trigger.querySelector('.language-label').textContent = current.textContent.trim()
    trigger.setAttribute(
      'aria-label',
      (select.getAttribute('aria-label') || '') + ': ' + current.textContent.trim(),
    )
    menu.setAttribute('aria-label', select.getAttribute('aria-label') || '')
    options.forEach((b) => b.setAttribute('aria-checked', String(b === current)))
  }

  function close(restore = false) {
    menu.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
    if (restore) trigger.focus()
  }

  function open(index) {
    sync()
    menu.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
    const box = scope.getBoundingClientRect()
    const r = trigger.getBoundingClientRect()
    const width = menu.offsetWidth
    const height = menu.offsetHeight
    // ★ 相对**挂载根**，不是视口：`position:absolute` 的包含块是 `#dd-app`
    const availW = scope.clientWidth || box.width
    const availH = scope.clientHeight || box.height
    menu.style.left = Math.max(12, Math.min(availW - width - 12, r.right - box.left - width)) + 'px'
    menu.style.top = Math.max(12, Math.min(availH - height - 12, r.bottom - box.top + 8)) + 'px'
    if (index !== undefined) options[index].focus()
  }

  const onTrigger = () => {
    if (menu.hidden) open()
    else close()
  }
  trigger.addEventListener('click', onTrigger)

  const optionHandlers = options.map((b) => {
    const fn = () => {
      select.value = b.dataset.language
      select.dispatchEvent(new Event('change', { bubbles: true }))
      sync()
      close(true)
    }
    b.addEventListener('click', fn)
    return [b, fn]
  })

  const onRootDown = (e) => e.stopPropagation()
  root.addEventListener('pointerdown', onRootDown)

  const onKey = (e) => {
    e.stopPropagation()
    const i = options.indexOf(document.activeElement)
    if (e.key === 'Escape') {
      if (!menu.hidden) {
        e.preventDefault()
        close(true)
      }
      return
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault()
      const next =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? options.length - 1
            : i < 0
              ? options.findIndex((b) => b.dataset.language === select.value)
              : (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
      open(Math.max(0, next))
    }
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault()
      document.activeElement.click()
    }
  }
  root.addEventListener('keydown', onKey)

  const onFocusOut = (e) => {
    if (!(e.relatedTarget instanceof Node) || !root.contains(e.relatedTarget)) close()
  }
  root.addEventListener('focusout', onFocusOut)

  // ★ 捕获阶段：点菜单外面就关。**必须能摘掉** —— 它是 `document` 级的。
  const onDocDown = (e) => {
    if (!menu.hidden && !root.contains(e.target)) {
      close()
      e.stopPropagation()
    }
  }
  document.addEventListener('pointerdown', onDocDown, true)

  const onResize = () => close()
  window.addEventListener('resize', onResize)

  sync()

  return {
    sync,
    close,
    dispose() {
      trigger.removeEventListener('click', onTrigger)
      for (const [b, fn] of optionHandlers) b.removeEventListener('click', fn)
      root.removeEventListener('pointerdown', onRootDown)
      root.removeEventListener('keydown', onKey)
      root.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('pointerdown', onDocDown, true)
      window.removeEventListener('resize', onResize)
    },
  }
}
