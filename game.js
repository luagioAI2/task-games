import { TITLE, tr as translateText, translateChildren, formatNumber, getLanguage, setLanguage, onLanguage, setStyleRoot } from './i18n.js';
import { createAutosave, snapshotBattle, restoreBattle } from './saves.js';
import { scopeCss } from './scope-css.js';

/** 挂载根（样式与 CSS 变量的作用域） */
let mountRoot = null;
/** 存档适配层（宿主 storage 包出来的 latestSync / putLatest / clearLatest） */
let saveApi = null;
/** 开局收费回调，由插件层注入 */
let chargePlayFn = async () => true;
/** Ai() 的定时器句柄 */
let tickTimer = 0;

/**
 * 独立运行（没有宿主）时的存档兜底：只活在内存里。
 *
 * ⚠️ 故意**不写 localStorage**：插件形态与独立形态各存一份，会出现
 * 「网页上玩过，装进 App 又是新号」—— 而两边都不报错。插件里必须走 `host.storage`。
 */
function makeMemorySaveApi() {
  let cur = null;
  return {
    get latestSync() {
      return cur;
    },
    putLatest: async (d) => {
      cur = d;
      return true;
    },
    clearLatest: async () => {
      cur = null;
      return true;
    },
  };
}

export async function start(opts = {}) {
var to = Object.defineProperty;
var ro = (e, t, r) =>
  t in e
    ? to(e, t, { enumerable: !0, configurable: !0, writable: !0, value: r })
    : (e[t] = r);
var y = (e, t, r) => ro(e, typeof t != "symbol" ? t + "" : t, r);
var ar,
  L,
  Kn,
  tn,
  We,
  Xn,
  Zn,
  Qn,
  Zr,
  Qt,
  At,
  ea,
  rn,
  Qr,
  en,
  no,
  tr = {},
  rr = [],
  ao = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,
  ir = Array.isArray;
function xe(e, t) {
  for (var r in t) e[r] = t[r];
  return e;
}
function nn(e) {
  e && e.parentNode && e.parentNode.removeChild(e);
}
function io(e, t, r) {
  var a,
    n,
    i,
    s = {};
  for (i in t)
    i == "key" ? (a = t[i]) : i == "ref" ? (n = t[i]) : (s[i] = t[i]);
  if (
    (arguments.length > 2 &&
      (s.children = arguments.length > 3 ? ar.call(arguments, 2) : r),
    typeof e == "function" && e.defaultProps != null)
  )
    for (i in e.defaultProps) s[i] === void 0 && (s[i] = e.defaultProps[i]);
  return er(e, s, a, n, null);
}
function er(e, t, r, a, n) {
  var i = {
    type: e,
    props: t,
    key: r,
    ref: a,
    __k: null,
    __: null,
    __b: 0,
    __e: null,
    __c: null,
    constructor: void 0,
    __v: n ?? ++Kn,
    __i: -1,
    __u: 0,
  };
  return (n == null && L.vnode != null && L.vnode(i), i);
}
function re(e) {
  return e.children;
}
function dt(e, t) {
  ((this.props = e), (this.context = t));
}
function Xe(e, t) {
  if (t == null) return e.__ ? Xe(e.__, e.__i + 1) : null;
  for (var r; t < e.__k.length; t++)
    if ((r = e.__k[t]) != null && r.__e != null) return r.__e;
  return typeof e.type == "function" ? Xe(e) : null;
}
function oo(e) {
  if (e.__P && e.__d) {
    var t = e.__v,
      r = t.__e,
      a = [],
      n = [],
      i = xe({}, t);
    ((i.__v = t.__v + 1),
      L.vnode && L.vnode(i),
      an(
        e.__P,
        i,
        t,
        e.__n,
        e.__P.namespaceURI,
        32 & t.__u ? [r] : null,
        a,
        r ?? Xe(t),
        !!(32 & t.__u),
        n,
      ),
      (i.__v = t.__v),
      (i.__.__k[i.__i] = i),
      ia(a, i, n),
      (t.__e = t.__ = null),
      i.__e != r && ta(i));
  }
}
function ta(e) {
  if ((e = e.__) != null && e.__c != null)
    return (
      (e.__e = e.__c.base = null),
      e.__k.some(function (t) {
        if (t != null && t.__e != null) return (e.__e = e.__c.base = t.__e);
      }),
      ta(e)
    );
}
function Vn(e) {
  ((!e.__d && (e.__d = !0) && We.push(e) && !nr.__r++) ||
    Xn != L.debounceRendering) &&
    ((Xn = L.debounceRendering) || Zn)(nr);
}
function nr() {
  try {
    for (var e, t = 1; We.length; )
      (We.length > t && We.sort(Qn), (e = We.shift()), (t = We.length), oo(e));
  } finally {
    We.length = nr.__r = 0;
  }
}
function ra(e, t, r, a, n, i, s, l, c, d, u) {
  var m,
    f,
    p,
    h,
    v,
    g,
    _ = (a && a.__k) || rr,
    k = t.length;
  for (c = so(r, t, _, c, k), m = 0; m < k; m++)
    (p = r.__k[m]) != null &&
      ((f = (p.__i != -1 && _[p.__i]) || tr),
      (p.__i = m),
      (g = an(e, p, f, n, i, s, l, c, d, u)),
      (h = p.__e),
      p.ref &&
        f.ref != p.ref &&
        (f.ref && on(f.ref, null, p), u.push(p.ref, p.__c || h, p)),
      v == null && h != null && (v = h),
      4 & p.__u
        ? ((c = na(p, c, e)), f.__e && (f.__e = null))
        : typeof p.type == "function" && g !== void 0
          ? (c = g)
          : h && (c = h.nextSibling),
      (p.__u &= -7));
  return ((r.__e = v), c);
}
function so(e, t, r, a, n) {
  var i,
    s,
    l,
    c,
    d,
    u = r.length,
    m = u,
    f = 0;
  for (e.__k = new Array(n), i = 0; i < n; i++)
    (s = t[i]) != null && typeof s != "boolean" && typeof s != "function"
      ? (typeof s == "string" ||
        typeof s == "number" ||
        typeof s == "bigint" ||
        s.constructor == String
          ? (s = e.__k[i] = er(null, s, null, null, null))
          : ir(s)
            ? (s = e.__k[i] = er(re, { children: s }, null, null, null))
            : s.constructor === void 0 && s.__b > 0
              ? (s = e.__k[i] =
                  er(s.type, s.props, s.key, s.ref ? s.ref : null, s.__v))
              : (e.__k[i] = s),
        (c = i + f),
        (s.__ = e),
        (s.__b = e.__b + 1),
        (l = null),
        (d = s.__i = lo(s, r, c, m)) != -1 && (m--, (l = r[d]) && (l.__u |= 2)),
        l == null || l.__v == null
          ? (d == -1 && (n > u ? f-- : n < u && f++),
            typeof s.type != "function" && (s.__u |= 4))
          : d != c &&
            (d == c - 1
              ? f--
              : d == c + 1
                ? f++
                : (d > c ? f-- : f++, (s.__u |= 4))))
      : (e.__k[i] = null);
  if (m)
    for (i = 0; i < u; i++)
      (l = r[i]) != null &&
        (2 & l.__u) == 0 &&
        (l.__e == a && (a = Xe(l)), sa(l, l));
  return a;
}
function na(e, t, r) {
  var a, n;
  if (typeof e.type == "function") {
    for (a = e.__k, n = 0; a && n < a.length; n++)
      a[n] && ((a[n].__ = e), (t = na(a[n], t, r)));
    return t;
  }
  e.__e != t &&
    (t && e.type && !t.parentNode && (t = Xe(e)),
    (t = r.insertBefore(e.__e, t || null)));
  do t = t && t.nextSibling;
  while (t != null && t.nodeType == 8);
  return t;
}
function lo(e, t, r, a) {
  var n,
    i,
    s,
    l = e.key,
    c = e.type,
    d = t[r],
    u = d != null && (2 & d.__u) == 0;
  if ((d === null && l == null) || (u && l == d.key && c == d.type)) return r;
  if (a > (u ? 1 : 0)) {
    for (n = r - 1, i = r + 1; n >= 0 || i < t.length; )
      if (
        (d = t[(s = n >= 0 ? n-- : i++)]) != null &&
        (2 & d.__u) == 0 &&
        l == d.key &&
        c == d.type
      )
        return s;
  }
  return -1;
}
function Jn(e, t, r) {
  t[0] == "-"
    ? e.setProperty(t, r ?? "")
    : (e[t] =
        r == null ? "" : typeof r != "number" || ao.test(t) ? r : r + "px");
}
function Zt(e, t, r, a, n) {
  var i, s;
  e: if (t == "style")
    if (typeof r == "string") e.style.cssText = r;
    else {
      if ((typeof a == "string" && (e.style.cssText = a = ""), a))
        for (t in a) (r && t in r) || Jn(e.style, t, "");
      if (r) for (t in r) (a && r[t] == a[t]) || Jn(e.style, t, r[t]);
    }
  else if (t[0] == "o" && t[1] == "n")
    ((i = t != (t = t.replace(ea, "$1"))),
      (s = t.toLowerCase()),
      (t =
        s in e || t == "onFocusOut" || t == "onFocusIn"
          ? s.slice(2)
          : t.slice(2)),
      e.l || (e.l = {}),
      (e.l[t + i] = r),
      r
        ? a
          ? (r[At] = a[At])
          : ((r[At] = rn), e.addEventListener(t, i ? en : Qr, i))
        : e.removeEventListener(t, i ? en : Qr, i));
  else {
    if (n == "http://www.w3.org/2000/svg")
      t = t.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
    else if (
      t != "width" &&
      t != "height" &&
      t != "href" &&
      t != "list" &&
      t != "form" &&
      t != "tabIndex" &&
      t != "download" &&
      t != "rowSpan" &&
      t != "colSpan" &&
      t != "role" &&
      t != "popover" &&
      t in e
    )
      try {
        e[t] = r ?? "";
        break e;
      } catch {}
    typeof r == "function" ||
      (r == null || (r === !1 && t[4] != "-")
        ? e.removeAttribute(t)
        : e.setAttribute(t, t == "popover" && r == 1 ? "" : r));
  }
}
function Yn(e) {
  return function (t) {
    if (this.l) {
      var r = this.l[t.type + e];
      if (t[Qt] == null) t[Qt] = rn++;
      else if (t[Qt] < r[At]) return;
      return r(L.event ? L.event(t) : t);
    }
  };
}
function an(e, t, r, a, n, i, s, l, c, d) {
  var u,
    m,
    f,
    p,
    h,
    v,
    g,
    _,
    k,
    x,
    Q,
    q,
    de,
    it,
    Ce,
    qe,
    ce = t.type;
  if (t.constructor !== void 0) return null;
  (128 & r.__u && ((c = !!(32 & r.__u)), (i = [(l = t.__e = r.__e)])),
    (u = L.__b) && u(t));
  e: if (typeof ce == "function") {
    m = s.length;
    try {
      if (
        ((k = t.props),
        (x = ce.prototype && ce.prototype.render),
        (Q = (u = ce.contextType) && a[u.__c]),
        (q = u ? (Q ? Q.props.value : u.__) : a),
        r.__c
          ? (_ = (f = t.__c = r.__c).__ = f.__E)
          : (x
              ? (t.__c = f = new ce(k, q))
              : ((t.__c = f = new dt(k, q)),
                (f.constructor = ce),
                (f.render = fo)),
            Q && Q.sub(f),
            f.state || (f.state = {}),
            (f.__n = a),
            (p = f.__d = !0),
            (f.__h = []),
            (f._sb = [])),
        x && f.__s == null && (f.__s = f.state),
        x &&
          ce.getDerivedStateFromProps != null &&
          (f.__s == f.state && (f.__s = xe({}, f.__s)),
          xe(f.__s, ce.getDerivedStateFromProps(k, f.__s))),
        (h = f.props),
        (v = f.state),
        (f.__v = t),
        p)
      )
        (x &&
          ce.getDerivedStateFromProps == null &&
          f.componentWillMount != null &&
          f.componentWillMount(),
          x && f.componentDidMount != null && f.__h.push(f.componentDidMount));
      else {
        if (
          (x &&
            ce.getDerivedStateFromProps == null &&
            k !== h &&
            f.componentWillReceiveProps != null &&
            f.componentWillReceiveProps(k, q),
          t.__v == r.__v ||
            (!f.__e &&
              f.shouldComponentUpdate != null &&
              f.shouldComponentUpdate(k, f.__s, q) === !1))
        ) {
          (t.__v != r.__v && ((f.props = k), (f.state = f.__s), (f.__d = !1)),
            (t.__e = r.__e),
            (t.__k = r.__k),
            t.__k.some(function (De) {
              De && (De.__ = t);
            }),
            rr.push.apply(f.__h, f._sb),
            (f._sb = []),
            f.__h.length && s.push(f),
            (l = Xe(r)));
          break e;
        }
        (f.componentWillUpdate != null && f.componentWillUpdate(k, f.__s, q),
          x &&
            f.componentDidUpdate != null &&
            f.__h.push(function () {
              f.componentDidUpdate(h, v, g);
            }));
      }
      if (
        ((f.context = q),
        (f.props = k),
        (f.__P = e),
        (f.__e = !1),
        (de = L.__r),
        (it = 0),
        x)
      )
        ((f.state = f.__s),
          (f.__d = !1),
          de && de(t),
          (u = f.render(f.props, f.state, f.context)),
          rr.push.apply(f.__h, f._sb),
          (f._sb = []));
      else
        do
          ((f.__d = !1),
            de && de(t),
            (u = f.render(f.props, f.state, f.context)),
            (f.state = f.__s));
        while (f.__d && ++it < 25);
      ((f.state = f.__s),
        f.getChildContext != null && (a = xe(xe({}, a), f.getChildContext())),
        x &&
          !p &&
          f.getSnapshotBeforeUpdate != null &&
          (g = f.getSnapshotBeforeUpdate(h, v)),
        (Ce =
          u != null && u.type === re && u.key == null
            ? oa(u.props.children)
            : u),
        (l = ra(e, ir(Ce) ? Ce : [Ce], t, r, a, n, i, s, l, c, d)),
        (f.base = t.__e),
        (t.__u &= -161),
        f.__h.length && s.push(f),
        _ && (f.__E = f.__ = null));
    } catch (De) {
      if (((s.length = m), (t.__v = null), c || i != null)) {
        if (De.then) {
          for (t.__u |= c ? 160 : 128; l && l.nodeType == 8 && l.nextSibling; )
            l = l.nextSibling;
          (i != null && (i[i.indexOf(l)] = null), (t.__e = l));
        } else if (i != null) for (qe = i.length; qe--; ) nn(i[qe]);
      } else t.__e = r.__e;
      (t.__k == null && (t.__k = r.__k || []),
        De.then || aa(t),
        L.__e(De, t, r));
    }
  } else
    i == null && t.__v == r.__v
      ? ((t.__k = r.__k), (t.__e = r.__e))
      : (l = t.__e = co(r.__e, t, r, a, n, i, s, c, d));
  return ((u = L.diffed) && u(t), 128 & t.__u ? void 0 : l);
}
function aa(e) {
  e && (e.__c && (e.__c.__e = !0), e.__k && e.__k.some(aa));
}
function ia(e, t, r) {
  for (var a = 0; a < r.length; a++) on(r[a], r[++a], r[++a]);
  (L.__c && L.__c(t, e),
    e.some(function (n) {
      try {
        ((e = n.__h),
          (n.__h = []),
          e.some(function (i) {
            i.call(n);
          }));
      } catch (i) {
        L.__e(i, n.__v);
      }
    }));
}
function oa(e) {
  return typeof e != "object" || e == null || e.__b > 0
    ? e
    : ir(e)
      ? e.map(oa)
      : e.constructor !== void 0
        ? null
        : xe({}, e);
}
function co(e, t, r, a, n, i, s, l, c) {
  var d,
    u,
    m,
    f,
    p,
    h,
    v,
    g = r.props || tr,
    _ = t.props,
    k = t.type;
  if (
    (k == "svg"
      ? (n = "http://www.w3.org/2000/svg")
      : k == "math"
        ? (n = "http://www.w3.org/1998/Math/MathML")
        : n || (n = "http://www.w3.org/1999/xhtml"),
    i != null)
  ) {
    for (d = 0; d < i.length; d++)
      if (
        (p = i[d]) &&
        "setAttribute" in p == !!k &&
        (k ? p.localName == k : p.nodeType == 3)
      ) {
        ((e = p), (i[d] = null));
        break;
      }
  }
  if (e == null) {
    if (k == null) return document.createTextNode(_);
    ((e = document.createElementNS(n, k, _.is && _)),
      l && (L.__m && L.__m(t, i), (l = !1)),
      (i = null));
  }
  if (k == null) g === _ || (l && e.data == _) || (e.data = _);
  else {
    if (
      ((i =
        k == "textarea" && _.defaultValue != null
          ? null
          : i && ar.call(e.childNodes)),
      !l && i != null)
    )
      for (g = {}, d = 0; d < e.attributes.length; d++)
        g[(p = e.attributes[d]).name] = p.value;
    for (d in g)
      ((p = g[d]),
        d == "dangerouslySetInnerHTML"
          ? (m = p)
          : d == "children" ||
            d in _ ||
            (d == "value" && "defaultValue" in _) ||
            (d == "checked" && "defaultChecked" in _) ||
            Zt(e, d, null, p, n));
    for (d in _)
      ((p = _[d]),
        d == "children"
          ? (f = p)
          : d == "dangerouslySetInnerHTML"
            ? (u = p)
            : d == "value"
              ? (h = p)
              : d == "checked"
                ? (v = p)
                : (l && typeof p != "function") ||
                  g[d] === p ||
                  Zt(e, d, p, g[d], n));
    if (u)
      (l ||
        (m && (u.__html == m.__html || u.__html == e.innerHTML)) ||
        (e.innerHTML = u.__html),
        (t.__k = []));
    else if (
      (m && (e.innerHTML = ""),
      ra(
        t.type == "template" ? e.content : e,
        ir(f) ? f : [f],
        t,
        r,
        a,
        k == "foreignObject" ? "http://www.w3.org/1999/xhtml" : n,
        i,
        s,
        i ? i[0] : r.__k && Xe(r, 0),
        l,
        c,
      ),
      i != null)
    )
      for (d = i.length; d--; ) nn(i[d]);
    (l && k != "textarea") ||
      ((d = "value"),
      k == "progress" && h == null
        ? e.removeAttribute("value")
        : h != null &&
          (h !== e[d] ||
            (k == "progress" && !h) ||
            (k == "option" && h != g[d])) &&
          Zt(e, d, h, g[d], n),
      (d = "checked"),
      v != null && v != e[d] && Zt(e, d, v, g[d], n));
  }
  return e;
}
function on(e, t, r) {
  try {
    if (typeof e == "function") {
      var a = typeof e.__u == "function";
      (a && e.__u(), (a && t == null) || (e.__u = e(t)));
    } else e.current = t;
  } catch (n) {
    L.__e(n, r);
  }
}
function sa(e, t, r) {
  var a, n;
  if (
    (L.unmount && L.unmount(e),
    (a = e.ref) && ((a.current && a.current != e.__e) || on(a, null, t)),
    (a = e.__c) != null)
  ) {
    if (a.componentWillUnmount)
      try {
        a.componentWillUnmount();
      } catch (i) {
        L.__e(i, t);
      }
    a.base = a.__P = a.__n = null;
  }
  if ((a = e.__k))
    for (n = 0; n < a.length; n++)
      a[n] && sa(a[n], t, r || typeof e.type != "function");
  (r || nn(e.__e), (e.__c = e.__ = e.__e = void 0));
}
function fo(e, t, r) {
  return this.constructor(e, r);
}
function la(e, t, r) {
  var a, n, i, s;
  (t == document && (t = document.documentElement),
    L.__ && L.__(e, t),
    (n = (a = typeof r == "function") ? null : (r && r.__k) || t.__k),
    (i = []),
    (s = []),
    an(
      t,
      (e = ((!a && r) || t).__k = io(re, null, [e])),
      n || tr,
      tr,
      t.namespaceURI,
      !a && r ? [r] : n ? null : t.firstChild ? ar.call(t.childNodes) : null,
      i,
      !a && r ? r : n ? n.__e : t.firstChild,
      a,
      s,
    ),
    ia(i, e, s),
    (e.props.children = null));
}
((ar = rr.slice),
  (L = {
    __e: function (e, t, r, a) {
      for (var n, i, s; (t = t.__); )
        if ((n = t.__c) && !n.__)
          try {
            if (
              ((i = n.constructor) &&
                i.getDerivedStateFromError != null &&
                (n.setState(i.getDerivedStateFromError(e)), (s = n.__d)),
              n.componentDidCatch != null &&
                (n.componentDidCatch(e, a || {}), (s = n.__d)),
              s)
            )
              return (n.__E = n);
          } catch (l) {
            e = l;
          }
      throw e;
    },
  }),
  (Kn = 0),
  (tn = function (e) {
    return e != null && e.constructor === void 0;
  }),
  (dt.prototype.setState = function (e, t) {
    var r;
    ((r =
      this.__s != null && this.__s != this.state
        ? this.__s
        : (this.__s = xe({}, this.state))),
      typeof e == "function" && (e = e(xe({}, r), this.props)),
      e && xe(r, e),
      e != null && this.__v && (t && this._sb.push(t), Vn(this)));
  }),
  (dt.prototype.forceUpdate = function (e) {
    this.__v && ((this.__e = !0), e && this.__h.push(e), Vn(this));
  }),
  (dt.prototype.render = re),
  (We = []),
  (Zn =
    typeof Promise == "function"
      ? Promise.prototype.then.bind(Promise.resolve())
      : setTimeout),
  (Qn = function (e, t) {
    return e.__v.__b - t.__v.__b;
  }),
  (nr.__r = 0),
  (Zr = Math.random().toString(8)),
  (Qt = "__d" + Zr),
  (At = "__a" + Zr),
  (ea = /(PointerCapture)$|Capture$/i),
  (rn = 0),
  (Qr = Yn(!1)),
  (en = Yn(!0)),
  (no = 0));
var da = `:root {
  --u: 16px;
  --ink: #2a1a3e;
  --cream: #fff7e6;
  --cream2: #ffe9c2;
  --yellow: #ffd23f;
  --r0: #47d16c;
  --r1: #3ba4ff;
  --r2: #b35cff;
  --r3: #ffae1a;
  --r4: #ff4b4b;
  --font: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
}
* {
  box-sizing: border-box;
}
html,
body {
  font-family: var(--font);
  color: var(--ink);
}
button {
  font-family: inherit;
  color: inherit;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
img.ico {
  display: inline-block;
  vertical-align: middle;
  pointer-events: none;
  flex: none;
}
.root {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 30%, #3b2a7a, #140d26 70%);
  overflow: hidden;
}
.stage {
  position: relative;
  overflow: hidden;
  background: #3a2a8f;
  box-shadow: 0 0 60px rgba(0, 0, 0, 0.6);
  font-size: calc(var(--u) * 1);
  user-select: none;
  -webkit-user-select: none;
}
.outline,
.ribbon,
.chapter-name,
.hud-title,
.btn,
.tab span,
.mode-banner b {
  text-shadow:
    0 0.12em 0 var(--ink),
    0.07em 0.07em 0 var(--ink),
    -0.07em 0.07em 0 var(--ink),
    0.07em -0.07em 0 var(--ink),
    -0.07em -0.07em 0 var(--ink);
}
.muted {
  color: #7a6a8e;
  font-size: calc(var(--u) * 0.78);
}
.small-text {
  font-size: calc(var(--u) * 0.72);
}
.center-text {
  text-align: center;
}
.center-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.7);
}
.tag-green {
  display: inline-block;
  background: #35b84a;
  color: #fff;
  border-radius: calc(var(--u) * 0.5);
  padding: calc(var(--u) * 0.1) calc(var(--u) * 0.45);
  font-size: calc(var(--u) * 0.72);
  font-weight: 800;
  font-style: normal;
  border: calc(var(--u) * 0.12) solid var(--ink);
}

/* ---------- buttons ---------- */
.btn {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 0.05);
  min-width: calc(var(--u) * 5.5);
  padding: calc(var(--u) * 0.55) calc(var(--u) * 1) calc(var(--u) * 0.65);
  border-radius: calc(var(--u) * 1);
  border: calc(var(--u) * 0.16) solid var(--ink);
  color: #fff;
  font-weight: 900;
  font-size: calc(var(--u) * 1);
  letter-spacing: 0.02em;
  box-shadow:
    inset 0 calc(var(--u) * -0.3) 0 rgba(0, 0, 0, 0.18),
    inset 0 calc(var(--u) * 0.2) 0 rgba(255, 255, 255, 0.45),
    0 calc(var(--u) * 0.22) 0 var(--ink);
  transition: transform 0.06s;
}
.btn span {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--u) * 0.2);
}
.btn small {
  font-size: calc(var(--u) * 0.66);
  font-weight: 700;
  opacity: 0.95;
}
.btn:active {
  transform: translateY(calc(var(--u) * 0.16));
  box-shadow:
    inset 0 calc(var(--u) * -0.2) 0 rgba(0, 0, 0, 0.18),
    inset 0 calc(var(--u) * 0.2) 0 rgba(255, 255, 255, 0.45),
    0 calc(var(--u) * 0.06) 0 var(--ink);
}
.btn-yellow {
  background: linear-gradient(#ffe066, #ffb31a);
}
.btn-green {
  background: linear-gradient(#7ef08a, #2fb34a);
}
.btn-blue {
  background: linear-gradient(#6fd3ff, #2f86ff);
}
.btn-red {
  background: linear-gradient(#ff8f8f, #e53b4a);
}
.btn-purple {
  background: linear-gradient(#cf9bff, #8243f5);
}
.btn-gray {
  background: linear-gradient(#e2e2ea, #a4a4b6);
}
.btn.is-disabled {
  filter: grayscale(0.85) brightness(0.92);
}
.btn-sm {
  min-width: calc(var(--u) * 4);
  padding: calc(var(--u) * 0.32) calc(var(--u) * 0.6) calc(var(--u) * 0.42);
  font-size: calc(var(--u) * 0.82);
  border-radius: calc(var(--u) * 0.75);
}
.btn-big {
  min-width: calc(var(--u) * 10);
  padding: calc(var(--u) * 0.75) calc(var(--u) * 1.4) calc(var(--u) * 0.85);
  font-size: calc(var(--u) * 1.25);
  border-radius: calc(var(--u) * 1.2);
}
.row-btns {
  display: flex;
  gap: calc(var(--u) * 0.7);
  justify-content: center;
  flex-wrap: wrap;
  margin-top: calc(var(--u) * 0.4);
}
.dot {
  position: absolute;
  top: calc(var(--u) * -0.25);
  right: calc(var(--u) * -0.25);
  min-width: calc(var(--u) * 1.05);
  height: calc(var(--u) * 1.05);
  padding: 0 calc(var(--u) * 0.2);
  border-radius: calc(var(--u) * 1);
  background: #ff3b4e;
  border: calc(var(--u) * 0.12) solid #fff;
  color: #fff;
  font-size: calc(var(--u) * 0.62);
  font-weight: 900;
  line-height: calc(var(--u) * 0.85);
  text-align: center;
  box-shadow: 0 calc(var(--u) * 0.1) 0 rgba(0, 0, 0, 0.3);
  animation: dotpop 1.4s infinite;
}
.dot.up {
  background: #35b84a;
}
@keyframes dotpop {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.18);
  }
}

/* ---------- bars ---------- */
.bar {
  position: relative;
  width: 100%;
  height: calc(var(--u) * 0.9);
  border-radius: calc(var(--u) * 1);
  background: #3a2c52;
  border: calc(var(--u) * 0.12) solid var(--ink);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: linear-gradient(#7ef08a, #2fb34a);
  border-radius: calc(var(--u) * 1);
  transition: width 0.25s;
}
.bar-label {
  position: absolute;
  inset: 0;
  font-size: calc(var(--u) * 0.6);
  font-weight: 900;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  text-shadow: 0 calc(var(--u) * 0.06) 0 var(--ink);
}

/* ---------- menu frame ---------- */
.menu {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.08) 0 calc(var(--u) * 3), transparent calc(var(--u) * 3.1)),
    radial-gradient(circle at 85% 40%, rgba(255, 255, 255, 0.06) 0 calc(var(--u) * 4), transparent calc(var(--u) * 4.1)),
    linear-gradient(#5a45d6, #3a2a8f 60%, #2c2070);
}
.resbar {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.4);
  padding: calc(var(--u) * 0.5) calc(var(--u) * 2.6) calc(var(--u) * 0.4) calc(var(--u) * 0.5);
  padding-top: max(calc(var(--u) * 0.5), env(safe-area-inset-top));
  z-index: 5;
}
.avatar {
  position: relative;
  flex: none;
  width: calc(var(--u) * 3);
  height: calc(var(--u) * 3);
  border-radius: calc(var(--u) * 0.9);
  background: linear-gradient(#8fe9ff, #3fa9ff);
  border: calc(var(--u) * 0.16) solid var(--ink);
  box-shadow: 0 calc(var(--u) * 0.18) 0 var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.avatar-pow {
  position: absolute;
  bottom: calc(var(--u) * -0.55);
  left: 50%;
  transform: translateX(-50%);
  background: #2a1a3e;
  color: #ffd23f;
  font-size: calc(var(--u) * 0.62);
  font-weight: 900;
  border-radius: calc(var(--u) * 0.6);
  padding: calc(var(--u) * 0.05) calc(var(--u) * 0.35) calc(var(--u) * 0.05) calc(var(--u) * 0.15);
  white-space: nowrap;
  display: flex;
  align-items: center;
}
.chips {
  display: flex;
  gap: calc(var(--u) * 0.3);
  flex: 1;
  min-width: 0;
}
.chip {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.15);
  height: calc(var(--u) * 1.75);
  padding: 0 calc(var(--u) * 1.1) 0 calc(var(--u) * 0.1);
  background: rgba(20, 10, 40, 0.55);
  border: calc(var(--u) * 0.13) solid var(--ink);
  border-radius: calc(var(--u) * 1);
  color: #fff;
  font-weight: 900;
  font-size: calc(var(--u) * 0.78);
  cursor: pointer;
  white-space: nowrap;
}
.chip span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.chip .ico {
  margin-left: calc(var(--u) * -0.25);
}
.chip-sub {
  position: absolute;
  bottom: calc(var(--u) * -0.72);
  left: calc(var(--u) * 1.3);
  font-size: calc(var(--u) * 0.55);
  font-style: normal;
  color: #c9f8a8;
}
.plus {
  position: absolute;
  right: calc(var(--u) * 0.12);
  width: calc(var(--u) * 0.95);
  height: calc(var(--u) * 0.95);
  border-radius: 50%;
  background: #35b84a;
  border: calc(var(--u) * 0.1) solid var(--ink);
  font-size: calc(var(--u) * 0.75);
  line-height: calc(var(--u) * 0.7);
  text-align: center;
  color: #fff;
}
.gear {
  position: absolute;
  top: max(calc(var(--u) * 0.55), env(safe-area-inset-top));
  right: calc(var(--u) * 0.5);
  width: calc(var(--u) * 1.9);
  height: calc(var(--u) * 1.9);
  border-radius: calc(var(--u) * 0.6);
  background: rgba(20, 10, 40, 0.55);
  border: calc(var(--u) * 0.13) solid var(--ink);
  color: #fff;
  font-size: calc(var(--u) * 1.1);
  z-index: 6;
}
.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}
.content::-webkit-scrollbar {
  display: none;
}
.tabbar {
  flex: none;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: calc(var(--u) * 4.4);
  padding: 0 calc(var(--u) * 0.3) max(calc(var(--u) * 0.3), env(safe-area-inset-bottom));
  background: linear-gradient(#2f2360, #1d1540);
  border-top: calc(var(--u) * 0.18) solid var(--ink);
  box-shadow: inset 0 calc(var(--u) * 0.18) 0 rgba(255, 255, 255, 0.12);
}
.tab {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.05);
  padding: calc(var(--u) * 0.35) 0 calc(var(--u) * 0.25);
  border-radius: calc(var(--u) * 0.9) calc(var(--u) * 0.9) 0 0;
  color: #cfc4f5;
  font-weight: 900;
  font-size: calc(var(--u) * 0.72);
  transition: transform 0.15s;
}
.tab .ico {
  filter: saturate(0.6) brightness(0.9);
}
.tab.on {
  color: #fff;
  transform: translateY(calc(var(--u) * -0.35));
}
.tab.on .ico {
  filter: none;
}
.tab.on::before {
  content: "";
  position: absolute;
  inset: 0 calc(var(--u) * 0.15) calc(var(--u) * -0.4);
  z-index: -1;
  border-radius: calc(var(--u) * 0.9);
  background: linear-gradient(#ffd23f, #ff9f1a);
  border: calc(var(--u) * 0.16) solid var(--ink);
}
.tab .dot {
  top: calc(var(--u) * 0.1);
  right: calc(var(--u) * 0.6);
}

/* ---------- panels ---------- */
.screen {
  padding: calc(var(--u) * 0.6) calc(var(--u) * 0.6) calc(var(--u) * 1.2);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.6);
}
.panel {
  position: relative;
  background: linear-gradient(var(--cream), var(--cream2));
  border: calc(var(--u) * 0.18) solid var(--ink);
  border-radius: calc(var(--u) * 1.1);
  padding: calc(var(--u) * 0.7);
  box-shadow:
    inset 0 calc(var(--u) * 0.18) 0 #fff,
    0 calc(var(--u) * 0.25) 0 rgba(20, 10, 40, 0.5);
}
.panel-title {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.4);
  font-weight: 900;
  font-size: calc(var(--u) * 1);
  margin-bottom: calc(var(--u) * 0.5);
}

/* ---------- home ---------- */
.home {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: calc(var(--u) * 0.3) calc(var(--u) * 0.5) calc(var(--u) * 0.6);
  gap: calc(var(--u) * 0.5);
}
.chapter-card {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.3);
  background: linear-gradient(#ffcf5a, #ff9e2c);
  border: calc(var(--u) * 0.18) solid var(--ink);
  border-radius: calc(var(--u) * 1.2);
  padding: calc(var(--u) * 0.4);
  box-shadow:
    inset 0 calc(var(--u) * 0.2) 0 rgba(255, 255, 255, 0.5),
    0 calc(var(--u) * 0.25) 0 var(--ink);
}
.arrow {
  width: calc(var(--u) * 2.2);
  height: calc(var(--u) * 2.6);
  border-radius: calc(var(--u) * 0.8);
  background: var(--cream);
  border: calc(var(--u) * 0.15) solid var(--ink);
  font-size: calc(var(--u) * 1.6);
  font-weight: 900;
  line-height: 1;
}
.arrow {
  position: relative;
}
.arrow:disabled {
  opacity: 0.35;
}
.arrow.pulse {
  background: linear-gradient(#7ef08a, #2fb34a);
  color: #fff;
  animation: breathe 0.9s infinite;
}
.arrow-new {
  position: absolute;
  bottom: calc(var(--u) * -0.85);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: calc(var(--u) * 0.55);
  font-style: normal;
  font-weight: 900;
  color: #fff;
  background: #ff3b4e;
  border: calc(var(--u) * 0.1) solid var(--ink);
  border-radius: calc(var(--u) * 0.5);
  padding: 0 calc(var(--u) * 0.25);
}
.chapter-mid {
  flex: 1;
  text-align: center;
  cursor: pointer;
}
.chapter-name {
  color: #fff;
  font-weight: 900;
  font-size: calc(var(--u) * 1.28);
}
.chapter-sub {
  display: flex;
  justify-content: center;
  gap: calc(var(--u) * 0.4);
  margin-top: calc(var(--u) * 0.15);
}
.diff-tag {
  font-size: calc(var(--u) * 0.72);
  font-weight: 900;
  color: #fff;
  border-radius: calc(var(--u) * 0.6);
  padding: calc(var(--u) * 0.05) calc(var(--u) * 0.5);
  border: calc(var(--u) * 0.12) solid var(--ink);
  background: #35b84a;
}
.diff-tag.d1 {
  background: #ff8a1f;
}
.diff-tag.d2 {
  background: #e53b4a;
}
.rec {
  font-size: calc(var(--u) * 0.75);
  font-weight: 900;
  border-radius: calc(var(--u) * 0.6);
  padding: calc(var(--u) * 0.05) calc(var(--u) * 0.5);
  background: rgba(42, 26, 62, 0.75);
}
.rec.ok {
  color: #9dff8a;
}
.rec.low {
  color: #ff8a8a;
}
.scene-wrap {
  position: relative;
  flex: 1;
  min-height: calc(var(--u) * 15);
  border-radius: calc(var(--u) * 1.2);
  border: calc(var(--u) * 0.18) solid var(--ink);
  overflow: hidden;
  box-shadow: 0 calc(var(--u) * 0.25) 0 rgba(20, 10, 40, 0.5);
}
.scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.quote {
  position: absolute;
  left: 50%;
  bottom: calc(var(--u) * 0.4);
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: calc(var(--u) * 0.72);
  font-weight: 700;
  color: #5a3f22;
  background: rgba(255, 247, 230, 0.85);
  border-radius: calc(var(--u) * 0.8);
  padding: calc(var(--u) * 0.1) calc(var(--u) * 0.6);
  border: calc(var(--u) * 0.1) solid rgba(42, 26, 62, 0.4);
}
.side {
  position: absolute;
  top: calc(var(--u) * 0.5);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.5);
}
.side-l {
  left: calc(var(--u) * 0.4);
}
.side-r {
  right: calc(var(--u) * 0.4);
}
.side-btn {
  position: relative;
  width: calc(var(--u) * 3.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: calc(var(--u) * 0.15) 0 calc(var(--u) * 0.2);
  border-radius: calc(var(--u) * 0.9);
  background: rgba(255, 247, 230, 0.92);
  border: calc(var(--u) * 0.15) solid var(--ink);
  box-shadow: 0 calc(var(--u) * 0.16) 0 var(--ink);
  font-size: calc(var(--u) * 0.6);
  font-weight: 900;
  white-space: nowrap;
}
.miles {
  background: rgba(20, 10, 40, 0.5);
  border: calc(var(--u) * 0.15) solid var(--ink);
  border-radius: calc(var(--u) * 1);
  padding: calc(var(--u) * 0.35) calc(var(--u) * 1.4) calc(var(--u) * 1.7);
}
.miles-label {
  text-align: center;
  color: #fff;
  font-weight: 900;
  font-size: calc(var(--u) * 0.85);
  margin-bottom: calc(var(--u) * 1.3);
}
.miles-label b {
  color: #ffd23f;
}
.miles-track {
  position: relative;
  height: calc(var(--u) * 0.8);
  background: #3a2c52;
  border: calc(var(--u) * 0.13) solid var(--ink);
  border-radius: calc(var(--u) * 1);
}
.miles-fill {
  height: 100%;
  border-radius: calc(var(--u) * 1);
  background: linear-gradient(#7ef08a, #2fb34a);
}
.mile {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -62%);
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
  font-size: calc(var(--u) * 0.66);
  font-weight: 900;
  text-shadow: 0 calc(var(--u) * 0.08) 0 var(--ink);
}
.mile span {
  margin-top: calc(var(--u) * -0.3);
}
.mile.ready .ico {
  animation: bounce 0.8s infinite;
  filter: drop-shadow(0 0 calc(var(--u) * 0.4) #ffe066);
}
.mile.claimed .ico {
  filter: grayscale(1) brightness(0.8);
  opacity: 0.7;
}
@keyframes bounce {
  0%,
  100% {
    transform: translateY(0) rotate(0);
  }
  50% {
    transform: translateY(calc(var(--u) * -0.3)) rotate(-6deg);
  }
}
.start-wrap {
  position: relative;
  display: flex;
  justify-content: center;
  padding-bottom: calc(var(--u) * 0.2);
}
.start-btn {
  font-size: calc(var(--u) * 1.6);
  min-width: calc(var(--u) * 14);
  padding: calc(var(--u) * 0.7) calc(var(--u) * 1.5) calc(var(--u) * 0.75);
  animation: breathe 1.8s infinite;
}
.start-btn .cost {
  font-size: calc(var(--u) * 0.8);
  background: rgba(42, 26, 62, 0.55);
  border-radius: calc(var(--u) * 0.8);
  padding: 0 calc(var(--u) * 0.6) 0 calc(var(--u) * 0.2);
  margin-top: calc(var(--u) * 0.1);
  text-shadow: none;
}
@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.04);
  }
}
.finger {
  position: absolute;
  right: calc(var(--u) * 2.4);
  bottom: calc(var(--u) * -0.6);
  font-size: calc(var(--u) * 2.2);
  animation: tapfinger 1s infinite;
  pointer-events: none;
}
@keyframes tapfinger {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(calc(var(--u) * -0.3), calc(var(--u) * -0.5));
  }
}

/* ---------- modals ---------- */
.modal-back {
  position: absolute;
  inset: 0;
  z-index: 50;
  background: rgba(10, 5, 25, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--u) * 1);
  animation: fadein 0.18s;
}
@keyframes fadein {
  from {
    opacity: 0;
  }
}
.modal {
  position: relative;
  width: 100%;
  max-height: 92%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(var(--cream), var(--cream2));
  border: calc(var(--u) * 0.2) solid var(--ink);
  border-radius: calc(var(--u) * 1.3);
  box-shadow:
    inset 0 calc(var(--u) * 0.2) 0 #fff,
    0 calc(var(--u) * 0.35) 0 var(--ink);
  animation: popin 0.25s cubic-bezier(0.2, 1.4, 0.4, 1);
}
@keyframes popin {
  from {
    transform: scale(0.7);
    opacity: 0;
  }
}
.modal-title {
  margin: calc(var(--u) * -1.1) auto 0;
  padding: calc(var(--u) * 0.35) calc(var(--u) * 1.6);
  background: linear-gradient(#b889ff, #7a3cf0);
  border: calc(var(--u) * 0.18) solid var(--ink);
  border-radius: calc(var(--u) * 0.9);
  color: #fff;
  font-weight: 900;
  font-size: calc(var(--u) * 1.1);
  box-shadow: 0 calc(var(--u) * 0.2) 0 var(--ink);
  text-shadow: 0 calc(var(--u) * 0.1) 0 var(--ink);
}
.modal-x {
  position: absolute;
  top: calc(var(--u) * -0.7);
  right: calc(var(--u) * -0.5);
  width: calc(var(--u) * 2.2);
  height: calc(var(--u) * 2.2);
  border-radius: 50%;
  background: linear-gradient(#ff8f8f, #e53b4a);
  border: calc(var(--u) * 0.18) solid var(--ink);
  color: #fff;
  font-size: calc(var(--u) * 1.4);
  font-weight: 900;
  line-height: 1;
  box-shadow: 0 calc(var(--u) * 0.16) 0 var(--ink);
}
.modal-body {
  padding: calc(var(--u) * 0.9);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.7);
  align-items: stretch;
}
.modal-body > .btn {
  align-self: center;
}
.rewards {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: calc(var(--u) * 0.5);
}
.reward {
  position: relative;
  color: var(--ink);
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: calc(var(--u) * 4.4);
  padding: calc(var(--u) * 0.3) calc(var(--u) * 0.3) calc(var(--u) * 0.35);
  background: #fff;
  border: calc(var(--u) * 0.15) solid var(--ink);
  border-radius: calc(var(--u) * 0.8);
  box-shadow: 0 calc(var(--u) * 0.15) 0 rgba(42, 26, 62, 0.5);
  animation: popin 0.35s both;
}
.reward b {
  font-size: calc(var(--u) * 0.9);
  font-weight: 900;
}
.reward span {
  font-size: calc(var(--u) * 0.62);
  color: #7a6a8e;
  font-weight: 700;
}
.rewards-sm {
  gap: calc(var(--u) * 0.25);
  justify-content: flex-start;
}
.rewards-sm .reward {
  min-width: 0;
  flex-direction: row;
  gap: calc(var(--u) * 0.1);
  padding: calc(var(--u) * 0.1) calc(var(--u) * 0.35) calc(var(--u) * 0.1) calc(var(--u) * 0.1);
  border-radius: calc(var(--u) * 0.6);
  border-width: calc(var(--u) * 0.12);
  animation: none;
  box-shadow: none;
}
.rewards-sm .reward b {
  font-size: calc(var(--u) * 0.75);
}
.reward-back {
  z-index: 60;
}
.reward-pop {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 1);
  padding: calc(var(--u) * 1.5) calc(var(--u) * 0.8);
  animation: popin 0.3s cubic-bezier(0.2, 1.4, 0.4, 1);
}
.reward-rays {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(var(--u) * 26);
  height: calc(var(--u) * 26);
  margin: calc(var(--u) * -13) 0 0 calc(var(--u) * -13);
  background: repeating-conic-gradient(rgba(255, 230, 120, 0.22) 0 12deg, transparent 12deg 30deg);
  border-radius: 50%;
  mask: radial-gradient(circle, #000 30%, transparent 70%);
  -webkit-mask: radial-gradient(circle, #000 30%, transparent 70%);
  animation: spin 12s linear infinite;
  pointer-events: none;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.ribbon {
  position: relative;
  padding: calc(var(--u) * 0.4) calc(var(--u) * 2);
  font-size: calc(var(--u) * 1.4);
  font-weight: 900;
  color: #fff;
  background: linear-gradient(#ffcf5a, #ff8a1f);
  border: calc(var(--u) * 0.2) solid var(--ink);
  border-radius: calc(var(--u) * 0.8);
  box-shadow: 0 calc(var(--u) * 0.25) 0 var(--ink);
}
.toasts {
  position: absolute;
  left: 0;
  right: 0;
  top: 38%;
  z-index: 80;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.4);
  pointer-events: none;
}
.toast {
  max-width: 85%;
  background: rgba(20, 10, 40, 0.88);
  color: #fff;
  font-weight: 800;
  font-size: calc(var(--u) * 0.85);
  border-radius: calc(var(--u) * 1);
  padding: calc(var(--u) * 0.45) calc(var(--u) * 1);
  border: calc(var(--u) * 0.13) solid #ffd23f;
  text-align: center;
  animation: toastin 1.8s both;
}
@keyframes toastin {
  0% {
    opacity: 0;
    transform: translateY(calc(var(--u) * 0.6)) scale(0.9);
  }
  12%,
  80% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
    transform: translateY(calc(var(--u) * -0.6));
  }
}

/* chapter list */
.diff-row {
  display: flex;
  gap: calc(var(--u) * 0.4);
  justify-content: center;
}
.diff-chip {
  padding: calc(var(--u) * 0.3) calc(var(--u) * 1);
  border-radius: calc(var(--u) * 0.8);
  border: calc(var(--u) * 0.15) solid var(--ink);
  background: #e8e2f2;
  font-weight: 900;
}
.diff-chip.on {
  background: linear-gradient(#ffe066, #ffb31a);
}
.diff-chip.locked {
  opacity: 0.45;
}
.chapter-list {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.4);
  max-height: 60vh;
  overflow-y: auto;
}
.chapter-item {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.5);
  padding: calc(var(--u) * 0.35) calc(var(--u) * 0.6);
  background: #fff;
  border: calc(var(--u) * 0.15) solid var(--ink);
  border-radius: calc(var(--u) * 0.9);
  cursor: pointer;
}
.chapter-item.cur {
  background: #fff3c4;
  box-shadow: inset 0 0 0 calc(var(--u) * 0.15) #ffb31a;
}
.chapter-item.locked {
  opacity: 0.55;
}
.ci-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.ci-best {
  font-weight: 900;
}

/* daily / sign / idle / vault */
.task-list {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.45);
}
.task {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.4);
  background: #fff;
  border: calc(var(--u) * 0.15) solid var(--ink);
  border-radius: calc(var(--u) * 0.9);
  padding: calc(var(--u) * 0.45) calc(var(--u) * 0.5);
}
.task-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.25);
  font-size: calc(var(--u) * 0.85);
}
.task .rewards {
  width: auto;
  flex: none;
}
.task-all {
  background: #fff3c4;
}
.sign-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: calc(var(--u) * 0.4);
}
.sign-day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.2);
  padding: calc(var(--u) * 0.35) calc(var(--u) * 0.2);
  background: #fff;
  border: calc(var(--u) * 0.15) solid var(--ink);
  border-radius: calc(var(--u) * 0.8);
  font-size: calc(var(--u) * 0.7);
  font-weight: 900;
}
.sign-day .rewards-sm {
  justify-content: center;
}
.sign-day.big {
  grid-column: span 2;
  background: #fff3c4;
}
.sign-day.today {
  box-shadow: 0 0 0 calc(var(--u) * 0.2) #ffb31a;
  animation: breathe 1.4s infinite;
}
.sign-day.done {
  opacity: 0.55;
}
.sign-check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--u) * 2);
  color: #35b84a;
  text-shadow: 0 calc(var(--u) * 0.1) 0 var(--ink);
}
.idle-top {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.6);
}
.idle-time {
  font-size: calc(var(--u) * 1.2);
  font-weight: 900;
}
.vault-stage {
  min-height: calc(var(--u) * 12);
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, #6a4bd6, #2c1f63);
  border-radius: calc(var(--u) * 1);
  border: calc(var(--u) * 0.15) solid var(--ink);
  padding: calc(var(--u) * 0.6);
}
.vault-pool {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--u) * 0.35);
  justify-content: center;
}
.vault-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.12);
  border: calc(var(--u) * 0.15) solid;
  border-radius: calc(var(--u) * 0.8);
  padding: calc(var(--u) * 0.2) calc(var(--u) * 0.3);
  font-size: calc(var(--u) * 0.65);
  font-weight: 900;
}
.vault-spin {
  animation: shakebox 0.18s infinite;
}
@keyframes shakebox {
  0%,
  100% {
    transform: rotate(-6deg) scale(1.05);
  }
  50% {
    transform: rotate(6deg) scale(1.1);
  }
}
.vault-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.3);
  color: #fff;
  font-weight: 900;
  border: calc(var(--u) * 0.2) solid transparent;
  border-radius: calc(var(--u) * 1);
  padding: calc(var(--u) * 0.5) calc(var(--u) * 1);
  animation: popin 0.4s cubic-bezier(0.2, 1.4, 0.4, 1);
}
.vault-hero b {
  font-size: calc(var(--u) * 1.3);
}

/* ---------- hero screen ---------- */
.hero-head {
  display: flex;
  gap: calc(var(--u) * 0.7);
  align-items: center;
}
.hero-portrait {
  position: relative;
  flex: none;
  border-radius: calc(var(--u) * 1);
  border: calc(var(--u) * 0.22) solid;
  background: radial-gradient(circle at 50% 40%, #bff3ff, #5aa8ff);
}
.stars {
  position: absolute;
  bottom: calc(var(--u) * -0.5);
  left: 0;
  right: 0;
  text-align: center;
  font-size: calc(var(--u) * 0.85);
  color: #7a6a8e;
  text-shadow: 0 calc(var(--u) * 0.08) 0 var(--ink);
}
.stars .on {
  color: #ffd23f;
}
.hero-info {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.2);
  min-width: 0;
}
.hero-name {
  font-size: calc(var(--u) * 1.3);
  font-weight: 900;
}
.hero-name small {
  font-size: calc(var(--u) * 0.75);
  color: #7a6a8e;
}
.hero-lv {
  display: inline-block;
  align-self: flex-start;
  background: #2a1a3e;
  color: #ffd23f;
  border-radius: calc(var(--u) * 0.6);
  padding: 0 calc(var(--u) * 0.5);
  font-weight: 900;
}
.hero-pow {
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.2);
}
.hero-pow b {
  color: #e5533b;
  font-size: calc(var(--u) * 1.15);
}
.stat-row {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.5);
  padding: calc(var(--u) * 0.4) calc(var(--u) * 0.3);
  border-bottom: calc(var(--u) * 0.12) dashed rgba(42, 26, 62, 0.2);
}
.stat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.stat-val {
  font-weight: 900;
  font-size: calc(var(--u) * 1.05);
  color: #3b54d8;
}
.next-reward {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.5);
  margin-top: calc(var(--u) * 0.5);
  font-weight: 800;
  font-size: calc(var(--u) * 0.8);
}
.passives {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: calc(var(--u) * 0.4);
  margin-bottom: calc(var(--u) * 0.4);
}
.passive {
  display: flex;
  flex-direction: column;
  padding: calc(var(--u) * 0.35) calc(var(--u) * 0.5);
  border-radius: calc(var(--u) * 0.8);
  background: #e8e2f2;
  border: calc(var(--u) * 0.13) solid rgba(42, 26, 62, 0.4);
  opacity: 0.6;
  font-size: calc(var(--u) * 0.72);
}
.passive b {
  font-size: calc(var(--u) * 0.85);
}
.passive em {
  color: #e5533b;
  margin-left: calc(var(--u) * 0.2);
}
.passive.on {
  opacity: 1;
  background: #fff3c4;
  border-color: var(--ink);
}
.roster {
  display: flex;
  gap: calc(var(--u) * 0.4);
  overflow-x: auto;
  padding-bottom: calc(var(--u) * 0.3);
}
.roster-cell {
  position: relative;
  flex: none;
  width: calc(var(--u) * 4.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: calc(var(--u) * 0.25) calc(var(--u) * 0.2) calc(var(--u) * 0.35);
  background: #fff;
  border: calc(var(--u) * 0.18) solid;
  border-radius: calc(var(--u) * 0.9);
  font-size: calc(var(--u) * 0.66);
  font-weight: 900;
  cursor: pointer;
}
.roster-cell b {
  font-size: calc(var(--u) * 0.8);
}
.roster-cell.on {
  background: #fff3c4;
  box-shadow: 0 0 0 calc(var(--u) * 0.15) #ffb31a;
}
.roster-cell em {
  position: absolute;
  top: calc(var(--u) * -0.3);
  right: calc(var(--u) * -0.3);
}
.roster-cell.locked {
  background: #d9d3e4;
}
.hero-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.25);
  font-weight: 700;
  font-size: calc(var(--u) * 0.9);
}

/* ---------- weapons ---------- */
.loadout {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: calc(var(--u) * 0.4);
}
.slot {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: calc(var(--u) * 0.2) solid;
  border-radius: calc(var(--u) * 0.9);
  font-size: calc(var(--u) * 0.66);
  font-weight: 900;
}
.slot.empty {
  border: calc(var(--u) * 0.16) dashed rgba(42, 26, 62, 0.35);
  color: rgba(42, 26, 62, 0.3);
  font-size: calc(var(--u) * 1.6);
  background: rgba(255, 255, 255, 0.4);
}
.frag-bar {
  display: flex;
  justify-content: space-around;
  background: rgba(20, 10, 40, 0.55);
  border: calc(var(--u) * 0.15) solid var(--ink);
  border-radius: calc(var(--u) * 1);
  padding: calc(var(--u) * 0.25);
  color: #fff;
  font-weight: 900;
  font-size: calc(var(--u) * 0.78);
}
.frag {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.1);
}
.weapon-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: calc(var(--u) * 0.5);
}
.wcard {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.15);
  padding: calc(var(--u) * 0.4) calc(var(--u) * 0.35) calc(var(--u) * 0.45);
  border-radius: calc(var(--u) * 1);
  border: calc(var(--u) * 0.18) solid var(--ink);
  background: linear-gradient(#fff, #f1e9ff);
  box-shadow: 0 calc(var(--u) * 0.2) 0 rgba(20, 10, 40, 0.5);
  font-size: calc(var(--u) * 0.8);
}
.wcard b {
  font-size: calc(var(--u) * 0.78);
  white-space: nowrap;
}
.wicon {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  border-radius: calc(var(--u) * 0.7);
  padding: calc(var(--u) * 0.2) 0;
}
.r0 .wicon,
.r0 .relic-icon,
.wd-icon.r0,
.relic-icon.r0 {
  background: radial-gradient(circle, #b9f5c8, #47d16c);
}
.r1 .wicon,
.r1 .relic-icon,
.wd-icon.r1,
.relic-icon.r1 {
  background: radial-gradient(circle, #bfe3ff, #3ba4ff);
}
.r2 .wicon,
.r2 .relic-icon,
.wd-icon.r2,
.relic-icon.r2 {
  background: radial-gradient(circle, #e7ccff, #b35cff);
}
.r3 .wicon,
.r3 .relic-icon,
.wd-icon.r3,
.relic-icon.r3 {
  background: radial-gradient(circle, #ffe3a8, #ffae1a);
}
.r4 .wicon,
.r4 .relic-icon,
.wd-icon.r4,
.relic-icon.r4 {
  background: radial-gradient(circle, #ffc2c2, #ff4b4b);
}
.wcard.locked,
.relic.locked {
  filter: grayscale(0.9);
  opacity: 0.75;
}
.wlock {
  position: absolute;
  right: calc(var(--u) * 0.1);
  bottom: calc(var(--u) * 0.1);
}
.wlv {
  font-weight: 900;
  font-size: calc(var(--u) * 0.72);
  color: #3b54d8;
}
.wtag {
  position: absolute;
  top: calc(var(--u) * -0.35);
  left: calc(var(--u) * -0.3);
  z-index: 2;
  background: #ff5f7a;
  color: #fff;
  font-size: calc(var(--u) * 0.62);
  font-weight: 900;
  font-style: normal;
  border: calc(var(--u) * 0.12) solid var(--ink);
  border-radius: calc(var(--u) * 0.5);
  padding: 0 calc(var(--u) * 0.3);
}
.wcard .dot,
.relic .dot {
  z-index: 2;
}
.wd-top {
  display: flex;
  gap: calc(var(--u) * 0.7);
  align-items: flex-start;
}
.wd-icon {
  flex: none;
  border-radius: calc(var(--u) * 1);
  border: calc(var(--u) * 0.18) solid var(--ink);
  padding: calc(var(--u) * 0.3);
}
.wd-info {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.3);
  font-size: calc(var(--u) * 0.85);
}
.wd-tag {
  margin-left: calc(var(--u) * 0.4);
  font-size: calc(var(--u) * 0.7);
  background: #2a1a3e;
  color: #fff;
  border-radius: calc(var(--u) * 0.5);
  padding: 0 calc(var(--u) * 0.35);
}
.wd-stats {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--u) * 0.25);
}
.wd-stats span {
  font-size: calc(var(--u) * 0.7);
  background: #fff;
  border: calc(var(--u) * 0.1) solid rgba(42, 26, 62, 0.3);
  border-radius: calc(var(--u) * 0.5);
  padding: 0 calc(var(--u) * 0.3);
}
.wd-awaken {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.15);
  background: linear-gradient(#ffe9e9, #ffd3d3);
  border: calc(var(--u) * 0.15) solid #ff4b4b;
  border-radius: calc(var(--u) * 0.8);
  padding: calc(var(--u) * 0.4) calc(var(--u) * 0.6);
  font-size: calc(var(--u) * 0.8);
}
.wd-awaken b {
  color: #d9263a;
}
.wd-level {
  display: flex;
  justify-content: space-between;
  font-weight: 900;
  font-size: calc(var(--u) * 0.9);
}
.wd-cost {
  display: flex;
  justify-content: center;
  gap: calc(var(--u) * 1);
  font-weight: 900;
}
.wd-cost span {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.2);
}
.wd-cost .lack {
  color: #e53b4a;
}

/* ---------- relics ---------- */
.relic-box-panel {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.5);
  background: linear-gradient(#dff0ff, #b9d8ff);
}
.rb-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.1);
  font-size: calc(var(--u) * 0.85);
  font-weight: 800;
}
.rb-main b {
  font-size: calc(var(--u) * 1.05);
}
.rb-btns {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.35);
}
.set-panel .panel-title {
  justify-content: space-between;
  font-size: calc(var(--u) * 0.95);
}
.set-panel .panel-title span {
  font-size: calc(var(--u) * 0.7);
  font-weight: 800;
}
.set-on {
  color: #1f9a3a;
}
.relic-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: calc(var(--u) * 0.45);
}
.relic {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.15);
  padding: calc(var(--u) * 0.35);
  background: #fff;
  border: calc(var(--u) * 0.16) solid var(--ink);
  border-radius: calc(var(--u) * 0.9);
  font-size: calc(var(--u) * 0.75);
}
.relic b {
  font-size: calc(var(--u) * 0.75);
  white-space: nowrap;
}
.relic-icon {
  width: 100%;
  display: flex;
  justify-content: center;
  border-radius: calc(var(--u) * 0.7);
  padding: calc(var(--u) * 0.15) 0;
}
.relic-icon.big {
  width: auto;
  padding: calc(var(--u) * 0.4);
  border: calc(var(--u) * 0.18) solid var(--ink);
  border-radius: calc(var(--u) * 1);
}
.relic-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.3);
  text-align: center;
}
.relic-eff {
  display: flex;
  gap: calc(var(--u) * 0.5);
  width: 100%;
}
.relic-eff > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.15);
  background: #fff;
  border: calc(var(--u) * 0.13) solid rgba(42, 26, 62, 0.3);
  border-radius: calc(var(--u) * 0.8);
  padding: calc(var(--u) * 0.4);
  font-size: calc(var(--u) * 0.8);
  font-weight: 800;
}
.relic-eff em {
  font-style: normal;
  color: #7a6a8e;
  font-size: calc(var(--u) * 0.72);
}
.relic-results {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: calc(var(--u) * 0.3);
}
.relic-res {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  border: calc(var(--u) * 0.15) solid var(--ink);
  border-radius: calc(var(--u) * 0.7);
  padding: calc(var(--u) * 0.2) 0;
  font-size: calc(var(--u) * 0.6);
  font-weight: 900;
  animation: popin 0.35s both;
}
.relic-res b {
  white-space: nowrap;
  font-size: calc(var(--u) * 0.6);
}

/* ---------- shop ---------- */
.shop-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: calc(var(--u) * 0.45);
}
.shop-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.2);
  padding: calc(var(--u) * 0.45) calc(var(--u) * 0.25);
  background: #fff;
  border: calc(var(--u) * 0.16) solid var(--ink);
  border-radius: calc(var(--u) * 0.9);
  text-align: center;
}
.shop-item b {
  font-size: calc(var(--u) * 0.8);
}
.shop-item .muted {
  font-size: calc(var(--u) * 0.62);
  min-height: calc(var(--u) * 1.6);
}
.shop-item .btn {
  min-width: 0;
  width: 100%;
}
.shop-item.sold {
  opacity: 0.6;
}
.shop-tag {
  position: absolute;
  top: calc(var(--u) * -0.4);
  right: calc(var(--u) * -0.3);
  background: #ff3b4e;
  color: #fff;
  font-size: calc(var(--u) * 0.6);
  font-weight: 900;
  font-style: normal;
  border: calc(var(--u) * 0.12) solid var(--ink);
  border-radius: calc(var(--u) * 0.5);
  padding: 0 calc(var(--u) * 0.3);
  transform: rotate(8deg);
}

/* ---------- battle ---------- */
.battle {
  position: absolute;
  inset: 0;
  background: #120a22;
  overflow: hidden;
}
.battle-cv {
  position: absolute;
  left: 0;
  top: 0;
  touch-action: none;
}
.hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.5);
  padding: max(calc(var(--u) * 0.5), env(safe-area-inset-top)) calc(var(--u) * 0.5) calc(var(--u) * 0.5);
  pointer-events: none;
  background: linear-gradient(rgba(10, 5, 25, 0.75), rgba(10, 5, 25, 0));
}
.hud > * {
  pointer-events: auto;
}
.hud-btn {
  flex: none;
  width: calc(var(--u) * 2.5);
  height: calc(var(--u) * 2.5);
  border-radius: calc(var(--u) * 0.8);
  background: linear-gradient(#6fd3ff, #2f86ff);
  border: calc(var(--u) * 0.16) solid var(--ink);
  box-shadow: 0 calc(var(--u) * 0.16) 0 var(--ink);
  color: #fff;
  font-weight: 900;
  font-size: calc(var(--u) * 1);
  display: flex;
  align-items: center;
  justify-content: center;
}
.hud-btn.speed.on {
  background: linear-gradient(#ffe066, #ffb31a);
}
.pause-ico {
  width: calc(var(--u) * 0.85);
  height: calc(var(--u) * 1);
  border-left: calc(var(--u) * 0.3) solid #fff;
  border-right: calc(var(--u) * 0.3) solid #fff;
}
.hud-mid {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.2);
}
.hud-title {
  color: #fff;
  font-weight: 900;
  font-size: calc(var(--u) * 0.85);
}
.hud-bar {
  position: relative;
  width: 100%;
  height: calc(var(--u) * 1.3);
  border-radius: calc(var(--u) * 1);
  background: rgba(20, 10, 40, 0.8);
  border: calc(var(--u) * 0.16) solid var(--ink);
  overflow: hidden;
}
.hud-bar.big {
  height: calc(var(--u) * 1.6);
}
.hud-fill {
  height: 100%;
  background: linear-gradient(#ffe066, #ff8a1f);
  border-radius: calc(var(--u) * 1);
  transition: width 0.2s;
  box-shadow: inset 0 calc(var(--u) * 0.2) 0 rgba(255, 255, 255, 0.5);
}
.hud-bar span {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 900;
  font-size: calc(var(--u) * 0.85);
  text-shadow:
    0 calc(var(--u) * 0.08) 0 var(--ink),
    calc(var(--u) * 0.06) 0 0 var(--ink),
    calc(var(--u) * -0.06) 0 0 var(--ink);
}
.mode-banner {
  position: absolute;
  top: 28%;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.3);
  padding: calc(var(--u) * 0.7) 0;
  background: linear-gradient(90deg, transparent, rgba(20, 10, 40, 0.8) 20%, rgba(20, 10, 40, 0.8) 80%, transparent);
  color: #fff;
  pointer-events: none;
  animation: bannerin 2.2s both;
}
.mode-banner b {
  font-size: calc(var(--u) * 2.2);
  font-weight: 900;
  color: #ffd23f;
  letter-spacing: 0.2em;
}
.mode-banner span {
  font-size: calc(var(--u) * 0.85);
  font-weight: 700;
}
@keyframes bannerin {
  0% {
    opacity: 0;
    transform: scaleY(0.2);
  }
  12%,
  80% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
  }
}
.danger-tag,
.frozen-tag {
  position: absolute;
  top: calc(var(--u) * 4.4);
  left: 50%;
  transform: translateX(-50%);
  background: #e53b4a;
  color: #fff;
  font-weight: 900;
  border: calc(var(--u) * 0.15) solid var(--ink);
  border-radius: calc(var(--u) * 1);
  padding: calc(var(--u) * 0.15) calc(var(--u) * 0.8);
  animation: breathe 0.6s infinite;
  pointer-events: none;
}
.frozen-tag {
  top: calc(var(--u) * 6.2);
  background: #3fa9ff;
}
.tray {
  position: absolute;
  transform: translate(-50%, 50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  filter: grayscale(0.85) brightness(0.8);
  opacity: 0.8;
  transition: filter 0.2s;
}
.tray.has {
  filter: none;
  opacity: 1;
  animation: bounce 1s infinite;
}
.tray em {
  position: absolute;
  top: calc(var(--u) * 0.2);
  right: calc(var(--u) * -0.2);
  min-width: calc(var(--u) * 1.4);
  height: calc(var(--u) * 1.4);
  border-radius: calc(var(--u) * 1);
  background: #ff3b4e;
  border: calc(var(--u) * 0.15) solid #fff;
  color: #fff;
  font-style: normal;
  font-weight: 900;
  font-size: calc(var(--u) * 0.8);
  line-height: calc(var(--u) * 1.1);
}
.tray span {
  margin-top: calc(var(--u) * -0.6);
  background: rgba(20, 10, 40, 0.8);
  color: #fff;
  font-weight: 900;
  font-size: calc(var(--u) * 0.7);
  border-radius: calc(var(--u) * 0.6);
  padding: 0 calc(var(--u) * 0.4);
  border: calc(var(--u) * 0.12) solid var(--ink);
}
.tip-back {
  position: absolute;
  inset: 0;
  z-index: 30;
  background: rgba(10, 5, 25, 0.55);
}
.tip-bubble {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: calc(var(--u) * 17);
  background: #fff;
  border: calc(var(--u) * 0.18) solid var(--ink);
  border-radius: calc(var(--u) * 1);
  padding: calc(var(--u) * 0.6) calc(var(--u) * 0.8);
  font-weight: 900;
  font-size: calc(var(--u) * 0.95);
  box-shadow: 0 calc(var(--u) * 0.2) 0 var(--ink);
}
.tip-bubble small {
  font-weight: 700;
  font-size: calc(var(--u) * 0.72);
  color: #7a6a8e;
}
.tip-hand {
  position: absolute;
  transform: translate(-50%, 0);
  font-size: calc(var(--u) * 2.6);
  animation: tapfinger 0.8s infinite;
}

.ov {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 0.7);
  padding: calc(var(--u) * 1) calc(var(--u) * 0.6);
  background: rgba(10, 5, 25, 0.78);
  animation: fadein 0.2s;
}
.rar-legend {
  display: flex;
  gap: calc(var(--u) * 0.25);
}
.rar-legend span {
  width: calc(var(--u) * 1.6);
  text-align: center;
  color: #fff;
  font-weight: 900;
  font-size: calc(var(--u) * 0.7);
  border-radius: calc(var(--u) * 0.5);
  border: calc(var(--u) * 0.12) solid var(--ink);
  text-shadow: 0 calc(var(--u) * 0.06) 0 var(--ink);
}
.cards {
  display: flex;
  gap: calc(var(--u) * 0.5);
  width: 100%;
  justify-content: center;
}
.card-wrap {
  flex: 1;
  max-width: calc(var(--u) * 7.6);
  transition:
    transform 0.2s,
    opacity 0.2s;
}
.card-wrap.chosen {
  transform: scale(1.1) translateY(calc(var(--u) * -0.5));
}
.card-wrap.dim {
  opacity: 0.25;
  transform: scale(0.9);
}
.card {
  position: relative;
  display: block;
  width: 100%;
  padding-top: calc(var(--u) * 2.1);
  animation: cardin 0.35s both cubic-bezier(0.2, 1.3, 0.4, 1);
}
.card-shape {
  filter: drop-shadow(calc(var(--u) * 0.16) 0 0 var(--ink)) drop-shadow(calc(var(--u) * -0.16) 0 0 var(--ink)) drop-shadow(0 calc(var(--u) * 0.16) 0 var(--ink))
    drop-shadow(0 calc(var(--u) * -0.16) 0 var(--ink)) drop-shadow(0 calc(var(--u) * 0.3) 0 rgba(0, 0, 0, 0.35));
}
.card-body {
  min-height: calc(var(--u) * 12.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.4);
  padding: calc(var(--u) * 2.95) calc(var(--u) * 0.45) calc(var(--u) * 2);
  border-radius: calc(var(--u) * 0.9) calc(var(--u) * 0.9) 0 0;
  clip-path: polygon(0 0, 100% 0, 100% 86%, 50% 100%, 0 86%);
  background:
    radial-gradient(circle at 50% 0, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0) 55%),
    linear-gradient(color-mix(in srgb, var(--rc) 72%, #fff), color-mix(in srgb, var(--rc) 80%, #1a0a30));
  color: #fff;
}
@keyframes cardin {
  from {
    transform: translateY(calc(var(--u) * 2)) rotateY(80deg);
    opacity: 0;
  }
}
.card-wrap {
  position: relative;
}
.card-gem {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: calc(var(--u) * 4);
  height: calc(var(--u) * 4);
  border: calc(var(--u) * 0.2) solid var(--ink);
  border-radius: calc(var(--u) * 0.8);
  background: linear-gradient(135deg, #fff, var(--rc));
  box-shadow: 0 0 calc(var(--u) * 0.9) var(--rc);
  z-index: 2;
}
.card-gem-in {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(-45deg);
}
.card-badge {
  position: absolute;
  right: calc(var(--u) * -0.9);
  bottom: calc(var(--u) * -0.2);
  transform: rotate(-45deg);
  background: var(--ink);
  color: #fff;
  font-style: normal;
  font-weight: 900;
  font-size: calc(var(--u) * 0.6);
  border-radius: calc(var(--u) * 0.5);
  padding: calc(var(--u) * 0.05) calc(var(--u) * 0.3);
  white-space: nowrap;
  border: calc(var(--u) * 0.1) solid #fff;
}
.card-title {
  font-size: calc(var(--u) * 1);
  font-weight: 900;
  text-align: center;
  line-height: 1.2;
  text-shadow:
    0 calc(var(--u) * 0.1) 0 var(--ink),
    calc(var(--u) * 0.06) calc(var(--u) * 0.06) 0 var(--ink),
    calc(var(--u) * -0.06) calc(var(--u) * 0.06) 0 var(--ink),
    calc(var(--u) * 0.06) calc(var(--u) * -0.06) 0 var(--ink),
    calc(var(--u) * -0.06) calc(var(--u) * -0.06) 0 var(--ink);
}
.card-desc {
  font-size: calc(var(--u) * 0.82);
  font-weight: 800;
  text-align: center;
  background: rgba(20, 10, 40, 0.45);
  border-radius: calc(var(--u) * 0.5);
  padding: calc(var(--u) * 0.25) calc(var(--u) * 0.3);
  width: 100%;
  line-height: 1.35;
}
.card-note {
  font-size: calc(var(--u) * 0.66);
  font-weight: 800;
  color: #fff7c2;
}
.card.r4 .card-gem {
  animation: glowpulse 1s infinite;
}
@keyframes glowpulse {
  50% {
    box-shadow: 0 0 calc(var(--u) * 1.8) var(--rc);
  }
}
.card.r3 .card-gem {
  box-shadow: 0 0 calc(var(--u) * 1.3) var(--rc);
}
.chest-hint {
  color: #cfc4f5;
  font-size: calc(var(--u) * 0.8);
  font-weight: 800;
}
.chest-btns {
  display: flex;
  gap: calc(var(--u) * 0.6);
}
.chest-btns .btn {
  min-width: calc(var(--u) * 8.5);
}
.owned {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: calc(var(--u) * 0.3);
}
.owned-w {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.12);
  border: calc(var(--u) * 0.13) solid var(--ink);
  border-radius: calc(var(--u) * 0.7);
  padding: calc(var(--u) * 0.1) calc(var(--u) * 0.2);
}
.owned-w em {
  font-style: normal;
  font-size: calc(var(--u) * 0.6);
  font-weight: 900;
  color: #ffd23f;
}
.owned-w.awk {
  box-shadow: 0 0 calc(var(--u) * 0.6) #ff4b4b;
}
.owned.detail .owned-w {
  background: #fff;
  min-width: calc(var(--u) * 4.2);
}
.owned.detail b {
  font-size: calc(var(--u) * 0.62);
}
.owned.detail em {
  color: #e5533b;
}
.owned-glob {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--u) * 0.3) calc(var(--u) * 0.8);
  justify-content: center;
}
.revive-card,
.result-card {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.6);
  background: linear-gradient(#4b3a9e, #2c2070);
  border: calc(var(--u) * 0.2) solid var(--ink);
  border-radius: calc(var(--u) * 1.4);
  padding: calc(var(--u) * 1.2) calc(var(--u) * 0.9) calc(var(--u) * 1);
  color: #fff;
  box-shadow: 0 calc(var(--u) * 0.35) 0 var(--ink);
  animation: popin 0.3s cubic-bezier(0.2, 1.4, 0.4, 1);
}
.revive-card .ribbon {
  background: linear-gradient(#6fd3ff, #2f86ff);
}
.revive-hero,
.result-hero {
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.3), transparent 70%);
}
.revive-text {
  font-size: calc(var(--u) * 1.2);
  font-weight: 900;
}
.revive-text b {
  color: #ffd23f;
  font-size: calc(var(--u) * 1.5);
}
.revive-sub {
  color: #ffd23f;
  font-weight: 900;
}
.result-card.win .ribbon {
  background: linear-gradient(#7ef08a, #2fb34a);
}
.result-card.lose .ribbon {
  background: linear-gradient(#cf9bff, #8243f5);
}
.result-stats {
  display: flex;
  gap: calc(var(--u) * 0.5);
  width: 100%;
}
.result-stats div {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(0, 0, 0, 0.25);
  border-radius: calc(var(--u) * 0.8);
  padding: calc(var(--u) * 0.3);
  font-size: calc(var(--u) * 0.7);
}
.result-stats b {
  font-size: calc(var(--u) * 1.15);
  color: #ffd23f;
}
.result-note {
  color: #9dff8a;
  font-weight: 900;
  font-size: calc(var(--u) * 0.85);
}
.result-card .reward {
  color: var(--ink);
}
.dmg-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.2);
}
.dmg-row {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.35);
  font-size: calc(var(--u) * 0.72);
  font-weight: 800;
}
.dmg-name {
  width: calc(var(--u) * 5.2);
  white-space: nowrap;
  overflow: hidden;
}
.dmg-bar {
  flex: 1;
  height: calc(var(--u) * 0.55);
  background: rgba(0, 0, 0, 0.35);
  border-radius: calc(var(--u) * 1);
  overflow: hidden;
}
.dmg-bar div {
  height: 100%;
  border-radius: calc(var(--u) * 1);
}
.pause-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.7);
  padding-top: calc(var(--u) * 1.4);
}
.pause-card .ribbon {
  position: absolute;
  top: calc(var(--u) * -1.4);
}
.herocv {
  display: block;
}
  button {min-width:48px;min-height:48px;}
  .resbar {padding-right:58px;}
  .gear {width:48px;height:48px;}
  .mile {min-width:48px;min-height:48px;}
  .arrow {flex:none;}
  .tabbar {min-height:58px;}
  .tab {min-width:48px;min-height:48px;}
  .game-title { color:var(--cream); text-align:center; font-weight:900; font-size:calc(var(--u) * 0.8); padding:calc(var(--u) * 0.15); }
  .pause-card .game-title { color:var(--ink); }
  .language-row {display:flex;flex-wrap:wrap;justify-content:center;gap:8px;width:100%;}
  .language-button {min-width:64px;min-height:48px;padding:8px;border:2px solid var(--ink);border-radius:12px;background:var(--cream);font:700 14px var(--font);}
  .language-button[aria-pressed=true] {background:var(--yellow);}
  .save-status {font-size:14px;text-align:center;line-height:1.4;max-width:100%;}
  .save-status p {margin:calc(var(--u) * 0.3) 0;}
  .quote {white-space:normal;width:90%;text-align:center;line-height:1.3;}
  .side-btn,.wcard b,.relic b,.relic-res b,.dmg-name {white-space:normal;overflow-wrap:anywhere;}
  .chapter-mid,.hud-mid,.task-main,.rb-main,.wd-info {min-width:0;}
  .chapter-name {font-size:calc(var(--u) * 1.1);line-height:1.25;}
  .btn span {max-width:100%;flex-wrap:wrap;justify-content:center;}
  .card-title,.card-desc,.modal-title {overflow-wrap:anywhere;}
  .ov {overflow-y:auto;justify-content:safe center;}
  .rar-legend span {width:auto;min-width:calc(var(--u) * 1.6);}
  html[lang=en] .side-btn,html[lang=ja] .side-btn {width:calc(var(--u) * 3.6);font-size:calc(var(--u) * 0.62);}
  html[lang=en] .mode-banner b {font-size:calc(var(--u) * 1.7);letter-spacing:0;}
  .mode-banner span {max-width:92%;text-align:center;}
  .chest-btns {flex-wrap:wrap;justify-content:center;}
  .panel-title {flex-wrap:wrap;}
  .task {flex-wrap:wrap;}
  @media (orientation:landscape) and (max-height:600px) {
    .home {display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,0.8fr);grid-template-rows:22px 65px 1fr;gap:8px;min-height:100%;height:100%;padding:4px 12px;}
    .home>.game-title {grid-column:1/-1;grid-row:1;}
    .home>.chapter-card {grid-column:2;grid-row:2;}
    .home>.scene-wrap {grid-column:1;grid-row:2/4;min-height:0;}
    .home>.miles {grid-column:2;grid-row:3;align-self:start;height:85px;padding:3px 20px 22px;}
    .home>.start-wrap {grid-column:2;grid-row:3;align-self:end;}
    .start-btn {min-width:180px;font-size:20px;padding:4px 18px;}
    .start-btn .cost {font-size:12px;}
    .home .finger {right:4px;bottom:0;}
    .miles-label {margin-bottom:18px;font-size:12px;}
    .quote {font-size:11px;}
    .side {gap:4px;}
    .side-btn {min-height:48px;font-size:11px;}
    .side-btn .ico {width:24px!important;height:24px!important;}
    .resbar {min-height:52px;padding-top:4px;padding-bottom:4px;}
    .tabbar {height:56px;min-height:56px;}
    .tab .ico {width:22px!important;height:22px!important;}
    .tab.on {transform:none;}
    .chapter-name {font-size:16px;}
    .chapter-sub {font-size:12px;}
    .ov {justify-content:flex-start;}
  }
  .roster-cell b {text-align:center;}
`;
var Me = ["普通", "稀有", "史诗", "传说", "神话"],
  Et = ["绿色", "蓝色", "紫色", "橙色", "红色"],
  H = ["#47d16c", "#3ba4ff", "#b35cff", "#ffae1a", "#ff4b4b"],
  ca = ["#1f7a3a", "#1a5aa8", "#6325a8", "#b36b00", "#a81f1f"],
  Te = [
    {
      id: "dart",
      name: "抗体飞弹",
      rarity: 0,
      tag: "远程·追踪",
      desc: "自动瞄准最近的病毒发射抗体弹。",
      awakenName: "分裂抗体",
      awakenDesc: "命中后分裂出2枚小抗体继续攻击。",
      base: { dmg: 1, cd: 0.5, count: 1, pierce: 0, speed: 900, area: 0 },
      ups: ["dmg", "rate", "speed", "pierce", "count", "awaken"],
      caps: { count: 7, pierce: 6 },
      unlock: "start",
      countLabel: "弹数",
      rateLabel: "射速",
      areaLabel: "",
    },
    {
      id: "needle",
      name: "穿刺针剂",
      rarity: 0,
      tag: "远程·穿透",
      desc: "阵地战中垂直向上发射，天生穿透2个目标。",
      awakenName: "无限贯穿",
      awakenDesc: "针剂可无限穿透，伤害+60%。",
      base: { dmg: 1.5, cd: 1, count: 1, pierce: 2, speed: 1150, area: 0 },
      ups: ["dmg", "rate", "speed", "pierce", "count", "awaken"],
      caps: { count: 6, pierce: 12 },
      unlock: "start",
      countLabel: "针数",
      rateLabel: "射速",
      areaLabel: "",
    },
    {
      id: "orbit",
      name: "环绕胶囊",
      rarity: 1,
      tag: "近战·环绕",
      desc: "胶囊环绕英雄旋转，持续撞击靠近的病毒。",
      awakenName: "胶囊风暴",
      awakenDesc: "胶囊+2，旋转半径周期性大幅扩张。",
      base: { dmg: 0.9, cd: 0.3, count: 2, pierce: 0, speed: 0, area: 120 },
      ups: ["dmg", "rate", "count", "area", "awaken"],
      caps: { count: 8 },
      unlock: "start",
      countLabel: "胶囊数",
      rateLabel: "转速",
      areaLabel: "半径",
    },
    {
      id: "spray",
      name: "消毒喷雾",
      rarity: 1,
      tag: "近战·范围",
      desc: "向前方扇形持续喷洒，伤害范围内所有病毒。",
      awakenName: "强效消毒",
      awakenDesc: "射程+50%，喷射角度更大，并使病毒减速。",
      base: { dmg: 0.42, cd: 0.12, count: 1, pierce: 0, speed: 0, area: 250 },
      ups: ["dmg", "rate", "area", "awaken"],
      caps: {},
      unlock: "start",
      countLabel: "",
      rateLabel: "频率",
      areaLabel: "射程",
    },
    {
      id: "boomerang",
      name: "创可贴回旋镖",
      rarity: 1,
      tag: "远程·往返",
      desc: "飞出后折返，往返路径上的病毒都会受伤。",
      awakenName: "三重回旋",
      awakenDesc: "回旋镖+2，体积与伤害大幅提升。",
      base: { dmg: 1.3, cd: 1.5, count: 1, pierce: 999, speed: 720, area: 470 },
      ups: ["dmg", "rate", "speed", "count", "area", "awaken"],
      caps: { count: 6 },
      unlock: "start",
      countLabel: "数量",
      rateLabel: "投掷速度",
      areaLabel: "射程",
    },
    {
      id: "chain",
      name: "高烧电弧",
      rarity: 2,
      tag: "连锁·弹射",
      desc: "释放电弧，在病毒之间连续跳跃。",
      awakenName: "雷暴",
      awakenDesc: "跳跃次数+3，每次命中有概率再次落雷。",
      base: { dmg: 1.5, cd: 1, count: 3, pierce: 0, speed: 0, area: 180 },
      ups: ["dmg", "rate", "count", "area", "awaken"],
      caps: { count: 14 },
      unlock: 1,
      countLabel: "跳跃",
      rateLabel: "施放速度",
      areaLabel: "跳跃距离",
    },
    {
      id: "bomb",
      name: "泡腾炸弹",
      rarity: 2,
      tag: "范围·爆炸",
      desc: "投掷泡腾弹，落地爆炸造成范围伤害。",
      awakenName: "持续泡腾",
      awakenDesc: "爆炸后留下泡腾区域，持续灼烧病毒。",
      base: { dmg: 2.6, cd: 1.7, count: 1, pierce: 0, speed: 0, area: 90 },
      ups: ["dmg", "rate", "count", "area", "awaken"],
      caps: { count: 6 },
      unlock: 2,
      countLabel: "数量",
      rateLabel: "投掷速度",
      areaLabel: "爆炸范围",
    },
    {
      id: "frost",
      name: "冷冻针",
      rarity: 2,
      tag: "远程·减速",
      desc: "命中后使整条病毒链减速，最多叠加3层。",
      awakenName: "绝对零度",
      awakenDesc: "每隔一段时间冻结病毒链1.5秒。",
      base: { dmg: 1.2, cd: 0.85, count: 1, pierce: 1, speed: 820, area: 0 },
      ups: ["dmg", "rate", "speed", "pierce", "count", "awaken"],
      caps: { count: 5, pierce: 6 },
      unlock: 3,
      countLabel: "针数",
      rateLabel: "射速",
      areaLabel: "",
    },
    {
      id: "pulse",
      name: "声波脉冲",
      rarity: 3,
      tag: "近战·冲击",
      desc: "以英雄为中心释放扩散声波，伤害沿途所有病毒。",
      awakenName: "双重共振",
      awakenDesc: "声波范围+50%，并连续释放两道。",
      base: { dmg: 2.4, cd: 2, count: 1, pierce: 0, speed: 0, area: 270 },
      ups: ["dmg", "rate", "area", "awaken"],
      caps: {},
      unlock: 4,
      countLabel: "",
      rateLabel: "释放速度",
      areaLabel: "范围",
    },
    {
      id: "homing",
      name: "追踪抗体",
      rarity: 3,
      tag: "远程·追踪爆炸",
      desc: "发射会自动追踪的抗体导弹，命中小范围爆炸。",
      awakenName: "饱和打击",
      awakenDesc: "导弹+3，爆炸范围大幅提升。",
      base: { dmg: 1.9, cd: 1.2, count: 2, pierce: 0, speed: 500, area: 45 },
      ups: ["dmg", "rate", "speed", "count", "area", "awaken"],
      caps: { count: 10 },
      unlock: 5,
      countLabel: "导弹数",
      rateLabel: "射速",
      areaLabel: "爆炸范围",
    },
    {
      id: "beam",
      name: "紫外光束",
      rarity: 3,
      tag: "直线·持续",
      desc: "发射持续的紫外光束，灼烧直线上所有病毒。",
      awakenName: "广谱照射",
      awakenDesc: "光束更宽，持续时间+50%。",
      base: { dmg: 0.5, cd: 3, count: 1, pierce: 999, speed: 0, area: 28 },
      ups: ["dmg", "rate", "count", "area", "awaken"],
      caps: { count: 4 },
      unlock: 6,
      countLabel: "光束数",
      rateLabel: "充能速度",
      areaLabel: "宽度",
    },
    {
      id: "saber",
      name: "抗生素光剑",
      rarity: 4,
      tag: "近战·斩击",
      desc: "向前方挥出巨大的扇形斩击，造成海量伤害。",
      awakenName: "回旋斩",
      awakenDesc: "同时向前后斩击，范围+30%。",
      base: { dmg: 6.5, cd: 2.4, count: 1, pierce: 999, speed: 0, area: 310 },
      ups: ["dmg", "rate", "area", "awaken"],
      caps: {},
      unlock: 8,
      countLabel: "",
      rateLabel: "挥砍速度",
      areaLabel: "范围",
    },
  ],
  I = Object.fromEntries(Te.map((e) => [e.id, e]));
function Ve(e) {
  return 1 + 0.12 * (e - 1);
}
function ct(e, t) {
  let r = [6, 5, 4, 3, 2][e];
  return Math.round(r * (1 + (t - 1) * 0.6));
}
function Lt(e, t) {
  return Math.round((80 + e * 60) * Math.pow(1.22, t - 1));
}
var Be = 8,
  fa = {
    dmg: [0.2, 0.35, 0.55, 0.85, 1.3],
    rate: [0.1, 0.16, 0.24, 0.35, 0.5],
    speed: [0.15, 0.25, 0.4, 0.6, 0.85],
    pierce: [1, 1, 2, 2, 3],
    count: [1, 1, 1, 2, 2],
    area: [0.12, 0.2, 0.3, 0.45, 0.6],
  },
  or = [
    {
      id: "allDmg",
      name: "全面强化",
      values: [0.08, 0.12, 0.18, 0.26, 0.36],
      text: (e) => `所有武器伤害 +${Math.round(e * 100)}%`,
      minRarity: 0,
    },
    {
      id: "crit",
      name: "精准打击",
      values: [0.03, 0.05, 0.08, 0.12, 0.16],
      text: (e) => `暴击率 +${Math.round(e * 100)}%`,
      minRarity: 0,
    },
    {
      id: "critDmg",
      name: "致命要害",
      values: [0.2, 0.3, 0.45, 0.65, 0.9],
      text: (e) => `暴击伤害 +${Math.round(e * 100)}%`,
      minRarity: 0,
    },
    {
      id: "allRate",
      name: "肾上腺素",
      values: [0.05, 0.08, 0.12, 0.16, 0.22],
      text: (e) => `所有武器攻速 +${Math.round(e * 100)}%`,
      minRarity: 1,
    },
    {
      id: "slow",
      name: "病毒迟缓",
      values: [0.03, 0.05, 0.07, 0.1, 0.12],
      text: (e) => `病毒移动速度 -${Math.round(e * 100)}%`,
      minRarity: 1,
    },
    {
      id: "knock",
      name: "紧急击退",
      values: [220, 330, 480, 680, 950],
      text: (e) => `立即将病毒击退 ${Math.round(e)} 距离`,
      minRarity: 0,
    },
  ],
  zt = Object.fromEntries(or.map((e) => [e.id, e])),
  ft = [46, 31, 16, 6, 1],
  ua = { count: 1 },
  ma = 4,
  mo = [
    ["熬夜病毒", 265, "“再刷五分钟就睡。”——凌晨三点"],
    ["拖延症病毒", 200, "“明天再说吧。”"],
    ["手机上瘾病毒", 190, "解锁手机，只为了看一眼时间。"],
    ["脱发病毒", 30, "发际线正在战略性撤退。"],
    ["社恐病毒", 320, "电话响了，假装不在家。"],
    ["暴食病毒", 10, "“吃饱了才有力气减肥。”"],
    ["内卷病毒", 290, "别人卷，你也不得不卷。"],
    ["选择困难病毒", 150, "中午吃什么？这是个哲学问题。"],
    ["起床困难病毒", 45, "闹钟响了八次，被窝赢了八次。"],
    ["摸鱼病毒", 175, "看起来在工作，其实在摸鱼。"],
    ["健忘病毒", 225, "我进这个房间是要干嘛来着？"],
    ["躺平病毒", 340, "终极病毒：什么都不想干。"],
  ],
  X = mo.map(([e, t, r], a) => ({
    id: a + 1,
    name: e,
    hue: t,
    quote: r,
    rec: Math.round((100 * Math.pow(1.36, a)) / 10) * 10,
    segs: Math.min(104, 60 + a * 4),
  })),
  sr = [0.55, 0.68, 0.95, 1.05, 1.12, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8],
  ue = [
    { name: "普通", hp: 1, reward: 1, rec: 1 },
    { name: "困难", hp: 2.4, reward: 2, rec: 2.2 },
    { name: "噩梦", hp: 6, reward: 3.5, rec: 5 },
  ],
  ve = [
    {
      id: "amian",
      name: "阿免",
      title: "见习免疫卫士",
      rarity: 1,
      weapon: "dart",
      bonus: { atkPct: 0.05 },
      bonusText: "攻击力 +5%",
      body: "#5fe3c0",
      accent: "#3a7bff",
      deco: "cape",
    },
    {
      id: "vita",
      name: "橙小维",
      title: "维C爆破手",
      rarity: 2,
      weapon: "bomb",
      bonus: { atkPct: 0.08, area: 0.15 },
      bonusText: "攻击力 +8%，范围 +15%",
      body: "#ffab3d",
      accent: "#3fbf4f",
      deco: "leaf",
    },
    {
      id: "volt",
      name: "雷小伏",
      title: "高烧电工",
      rarity: 2,
      weapon: "chain",
      bonus: { crit: 0.08, critDmg: 0.2 },
      bonusText: "暴击率 +8%，暴击伤害 +20%",
      body: "#b27bff",
      accent: "#ffe14a",
      deco: "bolt",
    },
    {
      id: "frosty",
      name: "冰小凝",
      title: "冷敷专家",
      rarity: 3,
      weapon: "frost",
      bonus: { slow: 0.1, rate: 0.08 },
      bonusText: "病毒减速 10%，攻速 +8%",
      body: "#8fdcff",
      accent: "#ffffff",
      deco: "snow",
    },
    {
      id: "lumen",
      name: "光小剑",
      title: "紫外线骑士",
      rarity: 4,
      weapon: "beam",
      bonus: { atkPct: 0.18, luck: 0.05 },
      bonusText: "攻击力 +18%，高品质词条概率 +5%",
      body: "#ffe066",
      accent: "#ff4f6a",
      deco: "visor",
    },
  ],
  D = Object.fromEntries(ve.map((e) => [e.id, e])),
  $t = 0.06,
  lr = 5,
  Ie = [
    {
      id: "cup",
      name: "保温杯",
      rarity: 0,
      set: "health",
      per: { atkPct: 0.03 },
      flavor: "人到中年不得已，保温杯里泡枸杞。",
    },
    {
      id: "goji",
      name: "一包枸杞",
      rarity: 0,
      set: "health",
      per: { crit: 0.006 },
      flavor: "养生从娃娃抓起。",
    },
    {
      id: "tub",
      name: "泡脚桶",
      rarity: 1,
      set: "health",
      per: { wDmg: ["orbit", 0.1], critDmg: 0.02 },
      flavor: "泡完脚，环绕胶囊都转得更快了。",
    },
    {
      id: "mask",
      name: "蒸汽眼罩",
      rarity: 0,
      set: "night",
      per: { rate: 0.012 },
      flavor: "闭眼五分钟，攻速提升百分之一。",
    },
    {
      id: "coffee",
      name: "速溶咖啡",
      rarity: 1,
      set: "night",
      per: { wDmg: ["dart", 0.1] },
      start: { weapon: "dart", count: 1 },
      flavor: "三合一，开局多一发抗体。",
    },
    {
      id: "glasses",
      name: "防蓝光眼镜",
      rarity: 2,
      set: "night",
      per: { wDmg: ["beam", 0.14], critDmg: 0.03 },
      flavor: "专业对付紫外线和蓝光。",
    },
    {
      id: "belt",
      name: "护腰",
      rarity: 1,
      set: "worker",
      per: { critDmg: 0.05 },
      flavor: "久坐一族的最后防线。",
    },
    {
      id: "pillow",
      name: "U型颈枕",
      rarity: 0,
      set: "worker",
      per: { atkPct: 0.025 },
      flavor: "在哪都能睡，在哪都能战。",
    },
    {
      id: "keyboard",
      name: "机械键盘",
      rarity: 2,
      set: "worker",
      per: { wDmg: ["needle", 0.12] },
      start: { weapon: "needle", pierce: 1 },
      flavor: "青轴的声音，就是针剂的穿透力。",
    },
    {
      id: "clover",
      name: "四叶草",
      rarity: 3,
      set: "luck",
      per: { luck: 0.015, atkPct: 0.02 },
      flavor: "据说能刷出更好的词条。",
    },
    {
      id: "koi",
      name: "锦鲤贴纸",
      rarity: 2,
      set: "luck",
      per: { reward: 0.05 },
      flavor: "转发这条锦鲤，战斗奖励翻倍（并不会）。",
    },
    {
      id: "rope",
      name: "转运红绳",
      rarity: 3,
      set: "luck",
      per: { knock: 0.05, atkPct: 0.03 },
      flavor: "复活时击退更远。",
    },
  ],
  ut = Object.fromEntries(Ie.map((e) => [e.id, e])),
  dr = [
    {
      id: "health",
      name: "养生三件套",
      bonus: { atkPct: 0.12 },
      text: "攻击力 +12%",
    },
    { id: "night", name: "熬夜冠军", bonus: { rate: 0.1 }, text: "攻速 +10%" },
    {
      id: "worker",
      name: "打工人套装",
      bonus: { critDmg: 0.35 },
      text: "暴击伤害 +35%",
    },
    {
      id: "luck",
      name: "欧皇附体",
      bonus: { luck: 0.06, reward: 0.1 },
      text: "高品质词条概率 +6%，奖励 +10%",
    },
  ],
  mt = 10;
function Je(e) {
  return e <= 0 ? 1 : e + 1;
}
var pt = {
    luck: { id: "luck", name: "欧气满满", text: "高品质词条出现概率 +5%" },
    refresh: {
      id: "refresh",
      name: "再来一次",
      text: "每个宝箱额外 1 次免费刷新",
    },
    treasure: { id: "treasure", name: "寻宝达人", text: "战斗奖励 +10%" },
    startChest: {
      id: "startChest",
      name: "开局补给",
      text: "战斗开始时获得 1 个银色宝箱",
    },
    tough: { id: "tough", name: "绝地反击", text: "复活时击退距离 +15%" },
  },
  Dt = [
    [3, "refresh"],
    [6, "startChest"],
    [10, "luck"],
    [14, "treasure"],
    [18, "tough"],
    [23, "luck"],
    [28, "startChest"],
    [34, "treasure"],
    [40, "refresh"],
    [47, "luck"],
    [55, "tough"],
    [63, "treasure"],
    [72, "startChest"],
    [82, "luck"],
    [95, "treasure"],
  ],
  pa = 20,
  cr = 2,
  ha = 0.05,
  fr = 0.008,
  ur = 0.03,
  ba = 1.5,
  mr = 0.012,
  ga = 0.75,
  va = 1.2;
function ht(e) {
  return Math.round(50 * Math.pow(1.115, e - 1) + e * 10);
}
var me = 30,
  pr = 300,
  bt = 5,
  Wt = 12 * 3600;
function W(e) {
  return formatNumber(e);
}
function sn(e) {
  return e >= 100
    ? String(Math.floor(e))
    : (e >= 10, (Math.floor(e * 10) / 10).toString());
}
function Ye(e, t = 0) {
  let r = Math.pow(10, t);
  return `${Math.round(e * 100 * r) / r}%`;
}
function Ke(e) {
  e = Math.max(0, Math.floor(e));
  let t = Math.floor(e / 3600),
    r = Math.floor((e % 3600) / 60),
    a = e % 60,
    n = (i) => String(i).padStart(2, "0");
  return t > 0 ? `${n(t)}:${n(r)}:${n(a)}` : `${n(r)}:${n(a)}`;
}
function ln(e) {
  let t = new Date(e);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
var dn = 1,
  Oe = (e, t) => `${e}-${t}`;
function cn(e) {
  return {
    day: ln(e),
    battles: 0,
    chests: 0,
    heroUps: 0,
    idleClaims: 0,
    claimed: 0,
    staminaBuys: 0,
    freeChest: !1,
    freeGold: !1,
    signed: !1,
    purpleBox: 0,
  };
}
function gr(e) {
  let t = {};
  for (let r of Te) r.unlock === "start" && (t[r.id] = { lv: 1 });
  return {
    version: dn,
    gold: 300,
    gems: 150,
    stamina: me,
    staminaAt: e,
    keyGold: 1,
    keySilver: 3,
    frags: [10, 0, 0, 0, 0],
    pts: { atk: 0, crit: 0, rate: 0 },
    heroes: { amian: { stars: 0 } },
    hero: "amian",
    pity: 0,
    weapons: t,
    loadout: Te.filter((r) => r.unlock === "start").map((r) => r.id),
    relics: {},
    chapter: 1,
    diff: 0,
    best: {},
    miles: {},
    fails: {},
    cleared: 0,
    clearedDiff: [0, 0, 0],
    idleAt: e,
    idlePts: 0,
    signCount: 0,
    daily: cn(e),
    lvRewarded: 1,
    settings: { sfx: !0, music: !0 },
    stats: { battles: 0, wins: 0, kills: 0, chests: 0 },
    tut: { battle: !1, chest: !1, hero: !1, focus: !1 },
    seen: e,
  };
}
function fn(e, t) {
  if (!e || typeof e != "object") return null;
  let r = e;
  if (typeof r.version != "number" || r.version > dn) return null;
  let a = gr(t),
    n = { ...a, ...r };
  ((n.pts = { ...a.pts, ...(r.pts ?? {}) }),
    (n.settings = { ...a.settings, ...(r.settings ?? {}) }),
    (n.stats = { ...a.stats, ...(r.stats ?? {}) }),
    (n.tut = { ...a.tut, ...(r.tut ?? {}) }),
    (n.daily = { ...cn(t), ...(r.daily ?? {}) }),
    (!Array.isArray(n.frags) || n.frags.length !== 5) && (n.frags = a.frags),
    (!Array.isArray(n.clearedDiff) || n.clearedDiff.length !== 3) &&
      (n.clearedDiff = [n.cleared || 0, 0, 0]),
    (!n.heroes || !n.heroes[n.hero]) &&
      (n.heroes = { ...(n.heroes || {}), amian: { stars: 0 } }),
    D[n.hero] || (n.hero = "amian"),
    (n.loadout = (n.loadout || [])
      .filter((i) => I[i] && n.weapons[i])
      .slice(0, Be)),
    n.loadout.length === 0 && (n.loadout = ["dart"]));
  for (let i of ["gold", "gems", "stamina", "keyGold", "keySilver"])
    (typeof n[i] != "number" || !isFinite(n[i])) && (n[i] = a[i]);
  return ((n.version = dn), n);
}
function Bt(e, t) {
  if (
    (t < e.seen - 6e4 &&
      ((e.staminaAt = t), (e.idleAt = Math.min(e.idleAt, t))),
    (e.seen = Math.max(e.seen, t)),
    e.stamina >= me)
  )
    e.staminaAt = t;
  else {
    let a = Math.floor((t - e.staminaAt) / (pr * 1e3));
    a > 0 &&
      ((e.stamina = Math.min(me, e.stamina + a)),
      (e.staminaAt = e.stamina >= me ? t : e.staminaAt + a * pr * 1e3));
  }
  let r = ln(t);
  e.daily.day !== r && (e.daily = cn(t));
}
function ka(e, t) {
  return e.stamina >= me ? 0 : Math.max(0, pr - (t - e.staminaAt) / 1e3);
}
function pe(e, t) {
  if (
    ((e.gold += Math.round(t.gold ?? 0)),
    (e.gems += Math.round(t.gems ?? 0)),
    (e.stamina += Math.round(t.stamina ?? 0)),
    (e.keyGold += t.keyGold ?? 0),
    (e.keySilver += t.keySilver ?? 0),
    t.frags)
  )
    for (let [r, a] of Object.entries(t.frags))
      e.frags[Number(r)] += Math.round(a ?? 0);
  (t.weapon && po(e, t.weapon), t.relic && _a(e, t.relic));
}
function po(e, t) {
  return e.weapons[t]
    ? !1
    : ((e.weapons[t] = { lv: 1 }),
      e.loadout.length < Be && e.loadout.push(t),
      !0);
}
function _a(e, t) {
  var a;
  let r = (a = e.relics)[t] ?? (a[t] = { lv: 0, shards: 0 });
  r.lv === 0 ? (r.lv = 1) : (r.shards += 1);
}
function ho(e) {
  let t = {};
  for (let r of e) {
    for (let a of ["gold", "gems", "stamina", "keyGold", "keySilver"])
      r[a] && (t[a] = (t[a] ?? 0) + r[a]);
    if (r.frags) {
      t.frags ?? (t.frags = {});
      for (let [a, n] of Object.entries(r.frags)) {
        let i = Number(a);
        t.frags[i] = (t.frags[i] ?? 0) + (n ?? 0);
      }
    }
    (r.weapon && (t.weapon = r.weapon),
      r.relic && (t.relic = r.relic),
      r.hero && (t.hero = r.hero));
  }
  return t;
}
function un(e, t, r) {
  let a = ue[t].reward,
    n = Math.round(90 * Math.pow(1.3, e - 1) * a);
  if (r === 0) return { gold: n, frags: { 0: 6 + e } };
  if (r === 1) return { gold: n * 2, stamina: 6, gems: 30 };
  let i = { gems: Math.round(100 * a), frags: { 0: 10 + e * 2, 1: 5 + e } };
  return (
    e >= 3 && (i.frags[2] = Math.floor(e / 2) * a),
    (e % 2 === 0 || t > 0) && (i.keyGold = 1),
    (i.keySilver = 2),
    i
  );
}
function bo(e, t, r, a, n, i) {
  let s = ue[t].reward * n,
    l = Math.max(0, Math.min(1, r)),
    c = Math.round(
      (90 + 130 * Math.pow(1.3, e - 1)) * (0.25 + l) * s * (a ? 1.5 : 1),
    ),
    d = {},
    u = Math.round((3 + e * 0.8) * (0.3 + l) * s);
  ((d[0] = Math.max(1, Math.round(u * 0.7))),
    (d[1] = Math.round(u * 0.3 * (0.5 + i.next()))),
    e >= 3 &&
      a &&
      (d[2] = Math.max(0, Math.round((e - 2) * 0.5 * s * i.next() + 0.3))),
    e >= 6 && a && i.chance(0.3 + t * 0.2) && (d[3] = 1));
  let m = { gold: c, frags: d };
  return (a && (m.gems = Math.round(10 + e * 2)), m);
}
function mn(e) {
  let t = Math.max(1, e.cleared + 1),
    r = go(e.idlePts),
    a = 1 + r * 0.15;
  return {
    goldMin: Math.round((4 + t * 3.5) * a),
    fragHour: (2 + t * 0.6) * a,
    blueHour: t >= 3 ? (0.4 + t * 0.2) * a : 0,
    quality: r,
  };
}
function go(e) {
  return Math.min(5, Math.floor(Math.sqrt(e / 10)));
}
function Qe(e, t) {
  return Math.max(0, Math.min(Wt, (t - e.idleAt) / 1e3));
}
function pn(e, t) {
  let r = Qe(e, t),
    a = mn(e);
  return {
    gold: Math.floor((a.goldMin * r) / 60),
    frags: {
      0: Math.floor((a.fragHour * r) / 3600),
      1: Math.floor((a.blueHour * r) / 3600),
    },
    gems: Math.floor(r / 3600) * 5,
  };
}
function wa(e, t) {
  let r = Qe(e, t);
  if (r < 60) return null;
  let a = pn(e, t);
  return (
    pe(e, a),
    (e.idlePts += Math.floor(r / 1800)),
    (e.idleAt = t),
    (e.daily.idleClaims += 1),
    a
  );
}
function Ae(e) {
  return 1 + e.pts.atk + e.pts.crit + e.pts.rate;
}
function vr(e) {
  let t = Ae(e),
    r = { luck: 0, refresh: 0, treasure: 0, startChest: 0, tough: 0 };
  for (let [a, n] of Dt) t >= a && (r[n] += 1);
  return r;
}
function yr(e) {
  if (e % 5 !== 0) return null;
  let t = e / 5;
  return t % 4 === 0
    ? { keyGold: 1, gems: 50 }
    : t % 4 === 2
      ? { keySilver: 2, gems: 30 }
      : t % 4 === 1
        ? { gems: 60, frags: { 0: 8, 1: 3 } }
        : { gems: 40, frags: { 1: 5, 2: 1 } };
}
function Sa(e, t) {
  let r = Ae(e),
    a = ht(r);
  if (e.gold < a) return { ok: !1 };
  ((e.gold -= a), (e.pts[t] += 1), (e.daily.heroUps += 1));
  let n = Ae(e),
    i = null;
  if (n > e.lvRewarded) {
    let s = [];
    for (let l = e.lvRewarded + 1; l <= n; l++) {
      let c = yr(l);
      c && s.push(c);
    }
    ((e.lvRewarded = n), s.length && ((i = ho(s)), pe(e, i)));
  }
  return { ok: !0, reward: i };
}
function gt(e, t) {
  let r = e.weapons[t];
  if (!r) return !1;
  let a = I[t];
  return (
    e.frags[a.rarity] >= ct(a.rarity, r.lv) && e.gold >= Lt(a.rarity, r.lv)
  );
}
function Ma(e, t) {
  if (!gt(e, t)) return !1;
  let r = e.weapons[t],
    a = I[t];
  return (
    (e.frags[a.rarity] -= ct(a.rarity, r.lv)),
    (e.gold -= Lt(a.rarity, r.lv)),
    (r.lv += 1),
    !0
  );
}
function Ta(e, t) {
  if (!e.weapons[t]) return "locked";
  let r = e.loadout.indexOf(t);
  return r >= 0
    ? e.loadout.length <= 1
      ? "last"
      : (e.loadout.splice(r, 1), "off")
    : e.loadout.length >= Be
      ? "full"
      : (e.loadout.push(t), "on");
}
function vt(e, t) {
  let r = e.relics[t];
  return !!r && r.lv > 0 && r.lv < mt && r.shards >= Je(r.lv);
}
function Pa(e, t) {
  if (!vt(e, t)) return !1;
  let r = e.relics[t];
  return ((r.shards -= Je(r.lv)), (r.lv += 1), !0);
}
var vo = [50, 30, 15, 5, 0];
function Ca(e, t, r) {
  if (e.keySilver < t) return null;
  e.keySilver -= t;
  let a = [];
  for (let n = 0; n < t; n++) {
    let i = r.weighted(vo),
      s = Ie.filter((c) => c.rarity === i),
      l = r.pick(s.length ? s : Ie);
    (_a(e, l.id), a.push(l.id));
  }
  return a;
}
var yo = { amian: 30, vita: 30, volt: 30, frosty: 14, lumen: 5 };
function Ra(e, t) {
  if (e.keyGold < 1) return null;
  if (((e.keyGold -= 1), (e.pity += 1), e.pity >= 6 || t.chance(0.22))) {
    e.pity = 0;
    let s = ve.map((m) => m.id),
      l = t.weighted(s.map((m) => yo[m] ?? 10)),
      c = s[Math.max(0, l)],
      d = e.heroes[c];
    if (!d) return ((e.heroes[c] = { stars: 0 }), { hero: c, dup: !1 });
    if (d.stars < lr) return ((d.stars += 1), { hero: c, dup: !0 });
    let u = { gems: 200 };
    return (pe(e, u), { hero: c, dup: !0, reward: u });
  }
  let a = t.int(4),
    n = Math.max(1, e.cleared),
    i =
      a === 0
        ? { gold: 400 + n * 150 }
        : a === 1
          ? { frags: { 1: 6 + n, 2: 1 + Math.floor(n / 3) } }
          : a === 2
            ? { gems: 60 }
            : { keySilver: 2 };
  return (pe(e, i), { reward: i });
}
var z = {
  staminaGems: 50,
  staminaAmount: 15,
  staminaBuysPerDay: 5,
  blueBoxGems: 30,
  purpleBoxGems: 200,
  purpleBoxPerDay: 3,
  silverKeyGems: 90,
  goldKeyGems: 280,
  goldPacks: [
    { gems: 50, mult: 1 },
    { gems: 220, mult: 5 },
    { gems: 600, mult: 15 },
  ],
};
function Ot(e, t) {
  return Math.round((500 + e.cleared * 250) * t);
}
function kr(e) {
  return e.gems < z.staminaGems || e.daily.staminaBuys >= z.staminaBuysPerDay
    ? !1
    : ((e.gems -= z.staminaGems),
      (e.stamina += z.staminaAmount),
      (e.daily.staminaBuys += 1),
      !0);
}
function ya(e, t) {
  return Te.filter(
    (r) => !e.weapons[r.id] && r.rarity <= t && r.rarity < 4,
  ).map((r) => r.id);
}
function _r(e, t, r) {
  let a = Math.max(1, e.cleared);
  if (t === "free") {
    if (e.daily.freeChest) return null;
    e.daily.freeChest = !0;
    let s = {
      frags: { 0: 6 + a, 1: 2 + Math.floor(a / 2) },
      gold: 100 + a * 40,
    };
    return (pe(e, s), s);
  }
  if (t === "blue") {
    if (e.gems < z.blueBoxGems) return null;
    e.gems -= z.blueBoxGems;
    let s = { frags: { 0: 8 + r.int(6), 1: 3 + r.int(4) } },
      l = ya(e, 1);
    return (l.length && r.chance(0.08) && (s.weapon = r.pick(l)), pe(e, s), s);
  }
  if (e.gems < z.purpleBoxGems || e.daily.purpleBox >= z.purpleBoxPerDay)
    return null;
  ((e.gems -= z.purpleBoxGems), (e.daily.purpleBox += 1));
  let n = {
      frags: { 1: 10 + r.int(6), 2: 4 + r.int(4), 3: r.chance(0.4) ? 2 : 1 },
    },
    i = ya(e, 3);
  return (i.length && r.chance(0.25) && (n.weapon = r.pick(i)), pe(e, n), n);
}
function xa(e, t) {
  let r = z.goldPacks[t];
  if (!r || e.gems < r.gems) return 0;
  e.gems -= r.gems;
  let a = Ot(e, r.mult);
  return ((e.gold += a), a);
}
function Ia(e) {
  if (e.daily.freeGold) return 0;
  e.daily.freeGold = !0;
  let t = Ot(e, 0.6);
  return ((e.gold += t), t);
}
function hn(e, t) {
  let r = t === "gold" ? z.goldKeyGems : z.silverKeyGems;
  return e.gems < r
    ? !1
    : ((e.gems -= r), t === "gold" ? (e.keyGold += 1) : (e.keySilver += 1), !0);
}
var Ze = [
    {
      id: 0,
      name: "完成 3 场战斗",
      goal: 3,
      value: (e) => e.daily.battles,
      reward: { gems: 50 },
    },
    {
      id: 1,
      name: "开启 10 个局内宝箱",
      goal: 10,
      value: (e) => e.daily.chests,
      reward: { gems: 40 },
    },
    {
      id: 2,
      name: "英雄升级 3 次",
      goal: 3,
      value: (e) => e.daily.heroUps,
      reward: { gold: 800 },
    },
    {
      id: 3,
      name: "领取 1 次挂机奖励",
      goal: 1,
      value: (e) => e.daily.idleClaims,
      reward: { gems: 30, stamina: 5 },
    },
  ],
  hr = { keyGold: 1, keySilver: 1 };
function bn(e, t) {
  if (t === 4)
    return !Ze.every((n) => e.daily.claimed & (1 << n.id)) ||
      e.daily.claimed & 16
      ? null
      : ((e.daily.claimed |= 16), pe(e, hr), hr);
  let r = Ze[t];
  return !r || e.daily.claimed & (1 << t) || r.value(e) < r.goal
    ? null
    : ((e.daily.claimed |= 1 << t), pe(e, r.reward), r.reward);
}
function wr(e) {
  let t = 0;
  for (let r of Ze)
    !(e.daily.claimed & (1 << r.id)) && r.value(e) >= r.goal && t++;
  return (
    Ze.every((r) => e.daily.claimed & (1 << r.id)) &&
      !(e.daily.claimed & 16) &&
      t++,
    t
  );
}
var br = [
  { gems: 100 },
  { gold: 1500 },
  { keySilver: 2 },
  { frags: { 0: 25, 1: 8 } },
  { keyGold: 1 },
  { frags: { 1: 15, 2: 4 } },
  { keyGold: 2, gems: 200 },
];
function Aa(e) {
  if (e.daily.signed) return null;
  e.daily.signed = !0;
  let t = br[e.signCount % br.length];
  return ((e.signCount += 1), pe(e, t), t);
}
function yt(e, t, r) {
  return t < 1 || t > X.length
    ? !1
    : r === 0
      ? t <= e.cleared + 1
      : e.clearedDiff[r - 1] >= t && t <= e.clearedDiff[r] + 1;
}
function Ea(e, t) {
  // 体力（能量）是「不上线就亏」的钩子 —— 整条拆掉：开局收多少由宿主的积分闸门决定。
  // 保留这个函数（返回 !0）是为了不改所有调用点：它原来只做「扣体力 / 不够就拦」。
  Bt(e, t);
  return !0;
}
function La(e, t, r, a, n, i) {
  let s = Oe(t, r),
    l = Math.floor(a.progress * 100),
    c = e.best[s] ?? 0,
    d = l > c;
  (d && (e.best[s] = l),
    (e.stats.battles += 1),
    (e.stats.kills += a.kills),
    (e.stats.chests += a.chests),
    (e.daily.battles += 1));
  let u = bo(t, r, a.progress, a.won, n, i),
    m = !1,
    f;
  if (a.won) {
    if (
      ((e.stats.wins += 1),
      (e.fails[s] = 0),
      e.clearedDiff[r] < t &&
        ((e.clearedDiff[r] = t),
        (m = !0),
        (u.gems = (u.gems ?? 0) + 50 * (r + 1)),
        r === 0))
    ) {
      e.cleared = t;
      let p = Te.find((h) => h.unlock === t && !e.weapons[h.id]);
      p && ((u.weapon = p.id), (f = p.id));
    }
  } else e.fails[s] = (e.fails[s] ?? 0) + 1;
  return (
    pe(e, u),
    { reward: u, firstClear: m, newBest: d, unlockedWeapon: f }
  );
}
function za(e, t, r, a) {
  let n = Oe(t, r),
    i = [25, 50, 100][a],
    s = 1 << a;
  if ((e.best[n] ?? 0) < i || (e.miles[n] ?? 0) & s) return null;
  e.miles[n] = (e.miles[n] ?? 0) | s;
  let l = un(t, r, a);
  return (pe(e, l), l);
}
function $a(e) {
  let t = 0;
  for (let [r, a] of Object.entries(e.best)) {
    let n = e.miles[r] ?? 0;
    (a >= 25 && !(n & 1) && t++,
      a >= 50 && !(n & 2) && t++,
      a >= 100 && !(n & 4) && t++);
  }
  return t;
}
var autosave, resumedBattle=null, liveBattle=null, liveOverlay=()=>({t:'none'}), liveSpeed=()=>1, saveEnabled=false;
function Wa(api) {
  autosave=createAutosave(api ?? undefined,fn,gr,()=>{saveSignal.value++;});
  resumedBattle=autosave.battle;
  return autosave.meta;
}
function _t(e) {
  saveEnabled=true;
  void autosave.write(e,snapshotBattle(liveBattle,liveOverlay(),liveSpeed()));
}
function Oa(e) { _t(e); }
async function Ga() { const ok=await autosave.reset(); if(!ok)A('重置失败，请稍后再试'); return ok; }
function checkpoint() {if(saveEnabled || liveBattle) _t(j());}
var kn = [];
var T = null,
  Gt = null,
  Ee = null,
  oe = null,
  Pr = null,
  Sn = !0,
  Ua = !0,
  Ha = {},
  _o = {
    shoot: 0.07,
    hit: 0.05,
    pop: 0.045,
    bigpop: 0.08,
    zap: 0.08,
    boom: 0.07,
    chest: 0.1,
    pulse: 0.1,
    slash: 0.1,
  };
function ja() {
  if (T) {
    T.state === "suspended" && T.resume();
    return;
  }
  let e = window.AudioContext || window.webkitAudioContext;
  if (!e) return;
  try {
    T = new e();
  } catch {
    T = null;
    return;
  }
  ((Gt = T.createGain()),
    (Gt.gain.value = 0.8),
    Gt.connect(T.destination),
    (Ee = T.createGain()),
    (Ee.gain.value = Sn ? 0.55 : 0),
    Ee.connect(Gt),
    (oe = T.createGain()),
    (oe.gain.value = Ua ? 0.22 : 0),
    oe.connect(Gt),
    (Pr = T.createBuffer(1, T.sampleRate * 0.5, T.sampleRate)));
  let t = Pr.getChannelData(0);
  for (let r = 0; r < t.length; r++) t[r] = Math.random() * 2 - 1;
  (_n && tt(_n), So());
}
var Mn = new Map(),
  Na = !1,
  wo = { shoot: 0.35, hit: 0.35, pop: 0.7, click: 0.6, warn: 0.7 };
async function So() {
  if (Na || !T || !kn.length) return;
  Na = !0;
  let e = T;
  if (
    (await Promise.all(
      kn.map(async (t) => {
        try {
          let r = await fetch(`assets/audio/${t}.mp3`);
          if (!r.ok) return;
          Mn.set(t, await e.decodeAudioData(await r.arrayBuffer()));
        } catch {}
      }),
    ),
    ye)
  ) {
    let t = ye;
    ((ye = null), tt(t));
  }
}
function Mo(e, t, r = 1) {
  if (!T || !Ee) return;
  let a = T.createBufferSource();
  ((a.buffer = e), (a.playbackRate.value = r));
  let n = T.createGain();
  ((n.gain.value = t), a.connect(n), n.connect(Ee), a.start());
}
var Ht = null,
  Tr = null;
function qa() {
  if (!T || !Ht || !Tr) return;
  let e = Ht;
  (Tr.gain.setTargetAtTime(0, T.currentTime, 0.25),
    setTimeout(() => {
      try {
        e.stop();
      } catch {}
    }, 1200),
    (Ht = null),
    (Tr = null));
}
function To(e) {
  if (!T || !oe) return;
  qa();
  let t = T.createBufferSource();
  ((t.buffer = e), (t.loop = !0));
  let r = e.getChannelData(0),
    a = 0,
    n = r.length - 1;
  for (; a < r.length && Math.abs(r[a]) < 0.004; ) a++;
  for (; n > a && Math.abs(r[n]) < 0.004; ) n--;
  ((t.loopStart = a / e.sampleRate),
    (t.loopEnd = Math.max(t.loopStart + 1, n / e.sampleRate)));
  let i = T.createGain();
  (i.gain.setValueAtTime(0, T.currentTime),
    i.gain.linearRampToValueAtTime(2.2, T.currentTime + 1.2),
    t.connect(i),
    i.connect(oe),
    t.start(0, t.loopStart),
    (Ht = t),
    (Tr = i));
}
function Ge(e, t) {
  ((Sn = e),
    (Ua = t),
    T &&
      Ee &&
      oe &&
      (Ee.gain.setTargetAtTime(e ? 0.55 : 0, T.currentTime, 0.05),
      oe.gain.setTargetAtTime(t ? 0.22 : 0, T.currentTime, 0.1)));
}
function O(e, t, r, a, n = {}) {
  if (!T) return;
  let i = T.currentTime + (n.delay ?? 0),
    s = T.createOscillator(),
    l = T.createGain();
  ((s.type = r),
    s.frequency.setValueAtTime(e, i),
    n.slide &&
      s.frequency.exponentialRampToValueAtTime(Math.max(20, n.slide), i + t));
  let c = n.attack ?? 0.005;
  (l.gain.setValueAtTime(1e-4, i),
    l.gain.linearRampToValueAtTime(a, i + c),
    l.gain.exponentialRampToValueAtTime(1e-4, i + t),
    s.connect(l),
    l.connect(n.bus ?? Ee),
    s.start(i),
    s.stop(i + t + 0.02));
}
function Pe(e, t, r, a = {}) {
  if (!T || !Pr) return;
  let n = T.currentTime + (a.delay ?? 0),
    i = T.createBufferSource();
  i.buffer = Pr;
  let s = T.createBiquadFilter();
  ((s.type = a.type ?? "bandpass"),
    (s.frequency.value = r),
    (s.Q.value = a.q ?? 1));
  let l = T.createGain();
  (l.gain.setValueAtTime(t, n),
    l.gain.exponentialRampToValueAtTime(1e-4, n + e),
    i.connect(s),
    s.connect(l),
    l.connect(a.bus ?? Ee),
    i.start(n),
    i.stop(n + e + 0.02));
}
function M(e) {
  if (!T || !Sn) return;
  let t = T.currentTime,
    r = _o[e] ?? 0.03;
  if (t - (Ha[e] ?? -1) < r) return;
  Ha[e] = t;
  let a = Mn.get(e);
  if (a) {
    Mo(a, wo[e] ?? 0.85, 1 + (Math.random() - 0.5) * 0.08);
    return;
  }
  let n = 1 + (Math.random() - 0.5) * 0.1;
  switch (e) {
    case "shoot":
      O(880 * n, 0.06, "square", 0.05, { slide: 440 });
      break;
    case "hit":
      O(300 * n, 0.04, "triangle", 0.08, { slide: 150 });
      break;
    case "pop":
      (O(520 * n, 0.09, "sine", 0.22, { slide: 140 }),
        Pe(0.06, 0.08, 1800, { q: 0.8 }));
      break;
    case "bigpop":
      (O(320 * n, 0.18, "sine", 0.3, { slide: 70 }),
        Pe(0.14, 0.14, 900, { q: 0.7 }));
      break;
    case "chest":
      [1047, 1319, 1568].forEach((i, s) =>
        O(i, 0.16, "triangle", 0.16, { delay: s * 0.05 }),
      );
      break;
    case "zap":
      (Pe(0.12, 0.16, 3500, { q: 2 }),
        O(1400 * n, 0.1, "sawtooth", 0.04, { slide: 300 }));
      break;
    case "boom":
      (Pe(0.28, 0.28, 400, { q: 0.6, type: "lowpass" }),
        O(140, 0.25, "sine", 0.25, { slide: 45 }));
      break;
    case "slash":
      (Pe(0.2, 0.2, 2600, { q: 0.6, type: "highpass" }),
        O(600, 0.18, "sawtooth", 0.05, { slide: 1500 }));
      break;
    case "pulse":
      (O(220, 0.3, "sine", 0.2, { slide: 90 }),
        O(440, 0.25, "triangle", 0.06, { slide: 180 }));
      break;
    case "freeze":
      ([1760, 2093, 2637, 3136].forEach((i, s) =>
        O(i, 0.25, "sine", 0.06, { delay: s * 0.04 }),
      ),
        Pe(0.4, 0.06, 6e3, { q: 3 }));
      break;
    case "knock":
      (O(180, 0.35, "sine", 0.3, { slide: 60 }),
        Pe(0.35, 0.18, 700, { q: 0.5 }));
      break;
    case "click":
      O(1200, 0.04, "square", 0.05);
      break;
    case "open":
      [523, 659, 784, 1047].forEach((i, s) =>
        O(i, 0.2, "triangle", 0.14, { delay: s * 0.06 }),
      );
      break;
    case "pick":
      (O(784, 0.1, "square", 0.08),
        O(1175, 0.2, "square", 0.08, { delay: 0.08 }));
      break;
    case "coin":
      (O(1319, 0.06, "square", 0.06),
        O(1760, 0.16, "square", 0.06, { delay: 0.06 }));
      break;
    case "up":
      [659, 880, 1109, 1319].forEach((i, s) =>
        O(i, 0.14, "triangle", 0.12, { delay: s * 0.045 }),
      );
      break;
    case "win":
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((i, s) =>
        O(i, s === 6 ? 0.6 : 0.16, "square", 0.08, { delay: s * 0.12 }),
      );
      break;
    case "lose":
      [392, 349, 311, 262].forEach((i, s) =>
        O(i, s === 3 ? 0.6 : 0.22, "triangle", 0.14, { delay: s * 0.2 }),
      );
      break;
    case "warn":
      (O(880, 0.12, "square", 0.05),
        O(660, 0.12, "square", 0.05, { delay: 0.14 }));
      break;
    case "revive":
      ([392, 523, 659, 784, 1047].forEach((i, s) =>
        O(i, 0.2, "triangle", 0.14, { delay: s * 0.06 }),
      ),
        Pe(0.5, 0.1, 1200, { q: 0.5 }));
      break;
  }
}
var _n = null,
  ye = null,
  et = null,
  Mr = 0,
  wn = 0,
  Fa = (e) => 220 * Math.pow(2, e / 12),
  Xa = {
    menu: {
      bpm: 104,
      bass: [
        -12, -99, -5, -99, -9, -99, -5, -99, -14, -99, -7, -99, -12, -99, -7,
        -99,
      ],
      lead: [
        12, -99, 15, 17, 19, -99, 17, 15, 12, -99, 10, 12, 15, -99, -99, -99,
        12, -99, 15, 17, 22, -99, 19, 17, 15, -99, 12, 10, 12, -99, -99, -99,
      ],
      drums: "k.h.s.h.k.h.s.hh",
    },
    battle: {
      bpm: 138,
      bass: [
        -12, -12, -99, -12, -5, -99, -7, -99, -9, -9, -99, -9, -7, -99, -5, -99,
      ],
      lead: [
        12, 15, 17, 15, 19, 17, 15, 12, 10, 12, 15, 12, 17, 15, 12, 10, 12, 15,
        17, 19, 22, 19, 17, 15, 17, 15, 12, 15, 10, 12, -99, -99,
      ],
      drums: "k.hsk.hsk.hsk.hs",
    },
  };
function Po(e) {
  if (!T || !ye || !oe) return;
  let t = Xa[ye],
    r = wn,
    a = t.bass[r % t.bass.length],
    n = t.lead[r % t.lead.length],
    i = 60 / t.bpm / 2,
    s = t.drums[r % t.drums.length],
    l = e - T.currentTime;
  (a > -99 && O(Fa(a), i * 1.6, "triangle", 0.5, { delay: l, bus: oe }),
    n > -99 &&
      O(Fa(n), i * 0.9, "square", 0.12, { delay: l, bus: oe, attack: 0.01 }),
    s === "k" && O(110, 0.14, "sine", 0.6, { delay: l, slide: 40, bus: oe }),
    s === "s" && Pe(0.12, 0.25, 1800, { delay: l, q: 0.7, bus: oe }),
    s === "h" &&
      Pe(0.04, 0.12, 8e3, { delay: l, q: 1, type: "highpass", bus: oe }),
    wn++);
}
function tt(e) {
  if (((_n = e), !T)) return;
  let t = Mn.get(`bgm_${e}`);
  if (t) {
    if (ye === e && Ht) return;
    ((ye = e), et !== null && window.clearInterval(et), (et = null), To(t));
    return;
  }
  (ye === e && et !== null) ||
    (qa(),
    (ye = e),
    (wn = 0),
    (Mr = T.currentTime + 0.1),
    et !== null && window.clearInterval(et),
    (et = window.setInterval(() => {
      if (!T || !ye) return;
      let r = 60 / Xa[ye].bpm / 2;
      for (; Mr < T.currentTime + 0.25; ) (Po(Mr), (Mr += r));
    }, 60)));
}
function Va(e) {
  T && (e ? T.suspend() : T.resume());
}
var Nt,
  V,
  Tn,
  Ja,
  Rr = 0,
  ni = [],
  Y = L,
  Ya = Y.__b,
  Ka = Y.__r,
  Za = Y.diffed,
  Qa = Y.__c,
  ei = Y.unmount,
  ti = Y.__;
function Cn(e, t) {
  (Y.__h && Y.__h(V, e, Rr || t), (Rr = 0));
  var r = V.__H || (V.__H = { __: [], __h: [] });
  return (e >= r.__.length && r.__.push({}), r.__[e]);
}
function he(e) {
  return ((Rr = 1), Co(ii, e));
}
function Co(e, t, r) {
  var a = Cn(Nt++, 2);
  if (
    ((a.t = e),
    !a.__c &&
      ((a.__ = [
        r ? r(t) : ii(void 0, t),
        function (l) {
          var c = a.__N ? a.__N[0] : a.__[0],
            d = a.t(c, l);
          c !== d && ((a.__N = [d, a.__[1]]), a.__c.setState({}));
        },
      ]),
      (a.__c = V),
      !V.__f))
  ) {
    var n = function (l, c, d) {
      if (!a.__c.__H) return !0;
      var u = !1,
        m = a.__c.props !== l;
      if (
        (a.__c.__H.__.some(function (p) {
          if (p.__N) {
            u = !0;
            var h = p.__[0];
            ((p.__ = p.__N), (p.__N = void 0), h !== p.__[0] && (m = !0));
          }
        }),
        i)
      ) {
        var f = i.call(this, l, c, d);
        return u ? f || m : f;
      }
      return !u || m;
    };
    V.__f = !0;
    var i = V.shouldComponentUpdate,
      s = V.componentWillUpdate;
    ((V.componentWillUpdate = function (l, c, d) {
      if (this.__e) {
        var u = i;
        ((i = void 0), n(l, c, d), (i = u));
      }
      s && s.call(this, l, c, d);
    }),
      (V.shouldComponentUpdate = n));
  }
  return a.__N || a.__;
}
function ke(e, t) {
  var r = Cn(Nt++, 3);
  !Y.__s && ai(r.__H, t) && ((r.__ = e), (r.u = t), V.__H.__h.push(r));
}
function se(e) {
  return (
    (Rr = 5),
    xr(function () {
      return { current: e };
    }, [])
  );
}
function xr(e, t) {
  var r = Cn(Nt++, 7);
  return (ai(r.__H, t) && ((r.__ = e()), (r.__H = t), (r.__h = e)), r.__);
}
function Ro() {
  for (var e; (e = ni.shift()); ) {
    var t = e.__H;
    if (e.__P && t)
      try {
        (t.__h.some(Cr), t.__h.some(Pn), (t.__h = []));
      } catch (r) {
        ((t.__h = []), Y.__e(r, e.__v));
      }
  }
}
((Y.__b = function (e) {
  ((V = null), Ya && Ya(e));
}),
  (Y.__ = function (e, t) {
    (e && t.__k && t.__k.__m && (e.__m = t.__k.__m), ti && ti(e, t));
  }),
  (Y.__r = function (e) {
    (Ka && Ka(e), (Nt = 0));
    var t = (V = e.__c).__H;
    (t &&
      (Tn === V
        ? ((t.__h = []),
          (V.__h = []),
          t.__.some(function (r) {
            (r.__N && (r.__ = r.__N), (r.u = r.__N = void 0));
          }))
        : (t.__h.some(Cr), t.__h.some(Pn), (t.__h = []), (Nt = 0))),
      (Tn = V));
  }),
  (Y.diffed = function (e) {
    Za && Za(e);
    var t = e.__c;
    (t &&
      t.__H &&
      (t.__H.__h.length &&
        ((ni.push(t) !== 1 && Ja === Y.requestAnimationFrame) ||
          ((Ja = Y.requestAnimationFrame) || xo)(Ro)),
      t.__H.__.some(function (r) {
        r.u && ((r.__H = r.u), (r.u = void 0));
      })),
      (Tn = V = null));
  }),
  (Y.__c = function (e, t) {
    (t.some(function (r) {
      try {
        (r.__h.some(Cr),
          (r.__h = r.__h.filter(function (a) {
            return !a.__ || Pn(a);
          })));
      } catch (a) {
        (t.some(function (n) {
          n.__h && (n.__h = []);
        }),
          (t = []),
          Y.__e(a, r.__v));
      }
    }),
      Qa && Qa(e, t));
  }),
  (Y.unmount = function (e) {
    ei && ei(e);
    var t,
      r = e.__c;
    r &&
      r.__H &&
      (r.__H.__.some(function (a) {
        try {
          Cr(a);
        } catch (n) {
          t = n;
        }
      }),
      (r.__H = void 0),
      t && Y.__e(t, r.__v));
  }));
var ri = typeof requestAnimationFrame == "function";
function xo(e) {
  var t,
    r = function () {
      (clearTimeout(a), ri && cancelAnimationFrame(t), setTimeout(e));
    },
    a = setTimeout(r, 35);
  ri && (t = requestAnimationFrame(r));
}
function Cr(e) {
  var t = V,
    r = e.__c;
  (typeof r == "function" && ((e.__c = void 0), r()), (V = t));
}
function Pn(e) {
  var t = V;
  ((e.__c = e.__()), (V = t));
}
function ai(e, t) {
  return (
    !e ||
    e.length !== t.length ||
    t.some(function (r, a) {
      return r !== e[a];
    })
  );
}
function ii(e, t) {
  return typeof t == "function" ? t(e) : t;
}
var be = class {
  constructor(t) {
    y(this, "s");
    this.s = t >>> 0 || 2654435769;
  }
  next() {
    let t = (this.s = (this.s + 1831565813) >>> 0);
    return (
      (t = Math.imul(t ^ (t >>> 15), t | 1)),
      (t ^= t + Math.imul(t ^ (t >>> 7), t | 61)),
      ((t ^ (t >>> 14)) >>> 0) / 4294967296
    );
  }
  range(t, r) {
    return t + (r - t) * this.next();
  }
  int(t) {
    return Math.floor(this.next() * t);
  }
  chance(t) {
    return this.next() < t;
  }
  pick(t) {
    return t[this.int(t.length)];
  }
  weighted(t) {
    let r = 0;
    for (let n of t) r += Math.max(0, n);
    if (r <= 0) return -1;
    let a = this.next() * r;
    for (let n = 0; n < t.length; n++)
      if (((a -= Math.max(0, t[n])), a < 0)) return n;
    return t.length - 1;
  }
  shuffle(t) {
    for (let r = t.length - 1; r > 0; r--) {
      let a = this.int(r + 1);
      [t[r], t[a]] = [t[a], t[r]];
    }
    return t;
  }
};
function oi(e, t, r, a) {
  (t.atkPct && (a.v += t.atkPct * r),
    t.crit && (e.crit += t.crit * r),
    t.critDmg && (e.critDmg += t.critDmg * r),
    t.rate && (e.rate += t.rate * r),
    t.luck && (e.luck += t.luck * r),
    t.reward && (e.reward += t.reward * r),
    t.knock && (e.knock += t.knock * r),
    t.wDmg && (e.wDmg[t.wDmg[0]] = (e.wDmg[t.wDmg[0]] ?? 0) + t.wDmg[1] * r));
}
function He(e) {
  var c, d;
  let t = D[e.hero] ?? D.amian,
    r = e.heroes[e.hero]?.stars ?? 0,
    a = vr(e),
    n = {
      atk: 0,
      crit: ha + e.pts.crit * fr,
      critDmg: ba + e.pts.crit * ur,
      rate: e.pts.rate * mr,
      luck: a.luck * 0.05,
      reward: a.treasure * 0.1,
      knock: a.tough * 0.15,
      slow: 0,
      area: 0,
      freeRefresh: 1 + a.refresh,
      startChests: a.startChest,
      wDmg: {},
      wStart: {},
      wLevel: {},
    },
    i = { v: r * $t },
    s = t.bonus;
  ((i.v += s.atkPct ?? 0),
    (n.crit += s.crit ?? 0),
    (n.critDmg += s.critDmg ?? 0),
    (n.rate += s.rate ?? 0),
    (n.slow += s.slow ?? 0),
    (n.luck += s.luck ?? 0),
    (n.area += s.area ?? 0));
  let l = {};
  for (let [u, m] of Object.entries(e.relics)) {
    let f = ut[u];
    if (
      !(!f || m.lv <= 0) &&
      (oi(n, f.per, m.lv, i), (l[f.set] = (l[f.set] ?? 0) + 1), f.start)
    ) {
      let p =
        (c = n.wStart)[(d = f.start.weapon)] ??
        (c[d] = { count: 0, pierce: 0 });
      ((p.count += f.start.count ?? 0), (p.pierce += f.start.pierce ?? 0));
    }
  }
  for (let u of dr) (l[u.id] ?? 0) >= 3 && oi(n, u.bonus, 1, i);
  ((n.atk = (pa + e.pts.atk * cr) * (1 + i.v)),
    (n.crit = Math.min(ga, n.crit)),
    (n.rate = Math.min(va, n.rate)));
  for (let [u, m] of Object.entries(e.weapons)) m && (n.wLevel[u] = m.lv);
  return n;
}
function Io(e, t) {
  let r = D[e.hero] ?? D.amian,
    a = new Set([...e.loadout, r.weapon]),
    n = 0,
    i = 0;
  for (let s of a) {
    let l = t.wLevel[s] ?? 1,
      c = 1 + I[s].rarity * 0.08;
    ((n += Ve(l) * c * (1 + (t.wDmg[s] ?? 0))), i++);
  }
  return i ? n / i : 1;
}
function wt(e, t = He(e)) {
  let r = 1 + t.crit * (t.critDmg - 1),
    a = t.atk * r * (1 + t.rate) * Io(e, t) * (1 + t.luck * 0.5) * 5;
  return Math.round(a * 0.94);
}
function Rn(e, t) {
  let r = X[e - 1] ?? X[X.length - 1];
  return Math.round((r.rec * ue[t].rec) / 10) * 10;
}
function Ao(e, t, r = 0) {
  let a = Math.max(0, Math.min(0.6, t)),
    n = [
      ft[0] * Math.max(0.15, 1 - a * 2.2),
      ft[1],
      ft[2] * (1 + a * 4),
      ft[3] * (1 + a * 7),
      ft[4] * (1 + a * 10),
    ];
  for (let i = 0; i < r; i++) n[i] = 0;
  return Math.max(r, e.weighted(n));
}
function si(e, t) {
  let r = I[t.id];
  return r.ups.filter((a) =>
    a === "awaken"
      ? !t.awakened && t.ups >= ma
      : !(
          (a === "count" &&
            r.caps.count !== void 0 &&
            t.count >= r.caps.count) ||
          (a === "pierce" &&
            r.caps.pierce !== void 0 &&
            t.pierce >= r.caps.pierce) ||
          (a === "pierce" && t.id === "needle" && t.awakened)
        ),
  );
}
function li(e, t, r) {
  if (t === "awaken")
    return { t: "up", weapon: e, stat: t, rarity: 4, value: 1 };
  let a = Math.max(r, ua[t] ?? 0);
  return { t: "up", weapon: e, stat: t, rarity: a, value: fa[t][a] };
}
function Eo(e, t) {
  let r = zt[e],
    a = Math.max(t, r.minRarity);
  return { t: "glob", stat: e, rarity: a, value: r.values[a] };
}
var di = (e) =>
  e.t === "glob"
    ? `g:${e.stat}`
    : e.t === "new"
      ? `n:${e.weapon}`
      : `u:${e.weapon}:${e.stat}`;
function xn(e, t, r = 0, a = 3) {
  let n = [],
    i = new Set(),
    s = e.owned.filter((c) => si(e, c).includes("awaken"));
  if (s.length && t.chance(0.4 + e.luck)) {
    let c = t.pick(s),
      d = li(c.id, "awaken", 4);
    (n.push(d), i.add(di(d)));
  }
  let l = 0;
  for (; n.length < a && l++ < 60; ) {
    let c,
      d = Ao(t, e.luck, r);
    if (e.owned.length && t.chance(0.72)) {
      let m = t.weighted(e.owned.map((h) => 1 + Math.min(4, h.ups) * 0.25)),
        f = e.owned[Math.max(0, m)],
        p = si(e, f).filter((h) => h !== "awaken");
      if (!p.length) continue;
      c = li(f.id, t.pick(p), d);
    } else {
      let m =
        or[
          t.weighted(
            or.map((f) => (f.id === "knock" ? 0.6 : f.id === "slow" ? 0.7 : 1)),
          )
        ];
      c = Eo(m.id, d);
    }
    let u = di(c);
    i.has(u) || (i.add(u), n.push(c));
  }
  return n;
}
function ci(e, t, r = 3) {
  let a = new Set(e.owned.map((s) => s.id)),
    n = e.loadout.filter((s) => !a.has(s));
  t.shuffle(n);
  let i = n
    .slice(0, r)
    .map((s) => ({ t: "new", weapon: s, rarity: I[s].rarity }));
  if (i.length < r) {
    let s = xn(e, t, 2, r - i.length + 1).slice(0, r - i.length);
    i.push(...s);
  }
  return i;
}
function In(e) {
  if (e.t === "new") {
    let a = I[e.weapon];
    return { title: a.name, desc: a.desc, badge: "新武器", icon: e.weapon };
  }
  if (e.t === "glob") {
    let a = zt[e.stat];
    return {
      title: a.name,
      desc: a.text(e.value),
      badge: "全局",
      icon: e.stat,
    };
  }
  let t = I[e.weapon],
    r = (a) => `+${Math.round(a * 100)}%`;
  switch (e.stat) {
    case "awaken":
      return {
        title: t.awakenName,
        desc: t.awakenDesc,
        badge: "觉醒",
        icon: e.weapon,
      };
    case "dmg":
      return {
        title: `${t.name}`,
        desc: `伤害 ${r(e.value)}`,
        badge: "伤害",
        icon: e.weapon,
      };
    case "rate":
      return {
        title: `${t.name}`,
        desc: `${t.rateLabel} ${r(e.value)}`,
        badge: t.rateLabel,
        icon: e.weapon,
      };
    case "speed":
      return {
        title: `${t.name}`,
        desc: `飞行速度 ${r(e.value)}`,
        badge: "弹速",
        icon: e.weapon,
      };
    case "pierce":
      return {
        title: `${t.name}`,
        desc: `穿透 +${e.value}`,
        badge: "穿透",
        icon: e.weapon,
      };
    case "count":
      return {
        title: `${t.name}`,
        desc: `${t.countLabel} +${e.value}`,
        badge: t.countLabel,
        icon: e.weapon,
      };
    case "area":
      return {
        title: `${t.name}`,
        desc: `${t.areaLabel} ${r(e.value)}`,
        badge: t.areaLabel,
        icon: e.weapon,
      };
  }
}
var Ar = class {
    constructor(t, r = 2) {
      y(this, "xs");
      y(this, "ys");
      y(this, "step");
      y(this, "length");
      y(this, "n");
      y(this, "sx");
      y(this, "sy");
      y(this, "ex");
      y(this, "ey");
      let a = [0];
      for (let m = 1; m < t.length; m++)
        a.push(a[m - 1] + Math.hypot(t[m].x - t[m - 1].x, t[m].y - t[m - 1].y));
      let n = a[a.length - 1],
        i = Math.max(2, Math.ceil(n / r) + 1);
      ((this.xs = new Float32Array(i)), (this.ys = new Float32Array(i)));
      let s = 0;
      for (let m = 0; m < i; m++) {
        let f = Math.min(n, m * r);
        for (; s < a.length - 2 && a[s + 1] < f; ) s++;
        let p = a[s + 1] - a[s] || 1,
          h = (f - a[s]) / p;
        ((this.xs[m] = t[s].x + (t[s + 1].x - t[s].x) * h),
          (this.ys[m] = t[s].y + (t[s + 1].y - t[s].y) * h));
      }
      ((this.step = r), (this.length = (i - 1) * r), (this.n = i));
      let l = Math.min(i - 1, 4),
        c = Math.hypot(this.xs[l] - this.xs[0], this.ys[l] - this.ys[0]) || 1;
      ((this.sx = (this.xs[l] - this.xs[0]) / c),
        (this.sy = (this.ys[l] - this.ys[0]) / c));
      let d = Math.max(0, i - 5),
        u =
          Math.hypot(
            this.xs[i - 1] - this.xs[d],
            this.ys[i - 1] - this.ys[d],
          ) || 1;
      ((this.ex = (this.xs[i - 1] - this.xs[d]) / u),
        (this.ey = (this.ys[i - 1] - this.ys[d]) / u));
    }
    at(t, r = { x: 0, y: 0 }) {
      if (t <= 0)
        return (
          (r.x = this.xs[0] + this.sx * t),
          (r.y = this.ys[0] + this.sy * t),
          r
        );
      if (t >= this.length) {
        let s = t - this.length;
        return (
          (r.x = this.xs[this.n - 1] + this.ex * s),
          (r.y = this.ys[this.n - 1] + this.ey * s),
          r
        );
      }
      let a = t / this.step,
        n = Math.floor(a),
        i = a - n;
      return (
        (r.x = this.xs[n] + (this.xs[n + 1] - this.xs[n]) * i),
        (r.y = this.ys[n] + (this.ys[n + 1] - this.ys[n]) * i),
        r
      );
    }
    angle(t) {
      if (t <= 0) return Math.atan2(this.sy, this.sx);
      if (t >= this.length) return Math.atan2(this.ey, this.ex);
      let r = Math.min(this.n - 2, Math.floor(t / this.step)),
        a = Math.min(this.n - 1, r + 3),
        n = Math.max(0, r - 2);
      return Math.atan2(this.ys[a] - this.ys[n], this.xs[a] - this.xs[n]);
    }
  },
  fi = 132;
function Ir(e, t, r, a, n, i, s = 6) {
  let l = Math.max(2, Math.ceil((Math.abs(i - n) * a) / s));
  for (let c = 1; c <= l; c++) {
    let d = n + ((i - n) * c) / l;
    e.push({ x: t + Math.cos(d) * a, y: r + Math.sin(d) * a });
  }
}
function ui(e, t) {
  let r = t - 215,
    a = r - 78,
    n = 250,
    i = 8,
    l = (r - 215 - n) / (i - 1),
    c = 66,
    d = [{ x: -40, y: n }],
    u = 1;
  for (let p = 0; p < i; p++) {
    let h = n + p * l,
      v = p === i - 1,
      g = v ? e / 2 + (u > 0 ? -l / 2 : l / 2) : u > 0 ? e - c : c;
    if ((d.push({ x: g, y: h }), v)) {
      let _ = g,
        k = h + l / 2;
      u > 0
        ? Ir(d, _, k, l / 2, -Math.PI / 2, 0)
        : Ir(d, _, k, l / 2, -Math.PI / 2, -Math.PI);
    } else {
      let _ = g,
        k = h + l / 2;
      (u > 0
        ? Ir(d, _, k, l / 2, -Math.PI / 2, Math.PI / 2)
        : Ir(d, _, k, l / 2, -Math.PI / 2, -Math.PI * 1.5),
        (u = -u));
    }
  }
  d.push({ x: e / 2, y: r - 34 });
  let m = new Ar(d),
    f = m.length / fi;
  return {
    mode: "line",
    W: e,
    H: t,
    path: m,
    hero: { x: e / 2, y: r },
    lineY: a,
    cx: e / 2,
    cy: r,
    spacing: f,
    radius: f * 0.5,
  };
}
function mi(e, t) {
  let r = e / 2,
    a = Math.round(t * 0.5),
    n = e / 2 - 38,
    i = 92,
    s = Math.max(1, Math.min(1.55, (a - 250) / n)),
    l = 3.25,
    c = [{ x: r, y: -60 }],
    d = -Math.PI / 2,
    u = Math.PI * 2 * l,
    m = 900;
  for (let g = 0; g <= m; g++) {
    let _ = g / m,
      k = d + u * _,
      x = n - (n - i) * _;
    c.push({
      x: r + Math.cos(k) * x,
      y: a + Math.sin(k) * x * (s - (s - 1) * _),
    });
  }
  let f = c[c.length - 1],
    p = Math.atan2(a - f.y, r - f.x);
  c.push({ x: r - Math.cos(p) * 34, y: a - Math.sin(p) * 34 });
  let h = new Ar(c),
    v = h.length / fi;
  return {
    mode: "ring",
    W: e,
    H: t,
    path: h,
    hero: { x: r, y: a },
    lineY: a,
    cx: r,
    cy: a,
    spacing: v,
    radius: v * 0.5,
  };
}
var An = globalThis.process?.env ?? {},
  Lo = Number(An.HP_K ?? 1.4),
  zo = Number(An.LINE_HP ?? 0.85),
  $o = Number(An.TRAV ?? 105),
  Do = 3.2,
  Wo = 0.24,
  Bo = 0.34,
  Lr = 20,
  zr = 60,
  $r = 2,
  Oo = 3,
  Go = [0, 40, 80],
  pi = 3,
  Er = class {
    constructor(t) {
      y(this, "setup");
      y(this, "layout");
      y(this, "rng");
      y(this, "stats");
      y(this, "total");
      y(this, "segs", []);
      y(this, "weapons", []);
      y(this, "projs", []);
      y(this, "lobs", []);
      y(this, "zones", []);
      y(this, "pulses", []);
      y(this, "slashes", []);
      y(this, "fx", []);
      y(this, "sfx", []);
      y(this, "fxOn", !0);
      y(this, "state", "play");
      y(this, "paused", !1);
      y(this, "time", 0);
      y(this, "killed", 0);
      y(this, "chests", { gold: 0, silver: 0 });
      y(this, "chestsOpened", 0);
      y(this, "revives", 0);
      y(this, "takeAllUsed", 0);
      y(this, "focus", null);
      y(this, "run", { allDmg: 0, crit: 0, critDmg: 0, allRate: 0, slow: 0 });
      y(this, "frost", []);
      y(this, "freezeT", 0);
      y(this, "heroKick", 0);
      y(this, "damageDealt", 0);
      y(this, "bestProgress", 0);
      y(this, "entering", !0);
      y(this, "baseSpeed");
      y(this, "tmp", { x: 0, y: 0 });
      ((this.setup = t),
        (this.stats = t.stats),
        (this.rng = new be(t.seed)),
        (this.layout = t.mode === "line" ? ui(t.W, t.H) : mi(t.W, t.H)),
        (this.baseSpeed = this.layout.path.length / $o),
        this.buildChain(),
        (this.total = this.segs.length));
      let r = D[t.hero] ?? D.amian;
      (this.addWeapon(r.weapon),
        (this.chests.silver += this.stats.startChests));
    }
    buildChain() {
      let { chapter: t, diff: r, fails: a } = this.setup,
        n = X[t - 1] ?? X[0],
        i = this.setup.tutorial ? 56 : n.segs,
        s = 1 - Math.min(0.175, a * 0.035),
        l = sr[t - 1] ?? sr[sr.length - 1],
        c = this.setup.mode === "line" ? zo : 1,
        d =
          Lo * n.rec * l * c * ue[r].hp * s * (this.setup.tutorial ? 0.55 : 1),
        u = 26 + t * 1.5,
        m = Math.pow(u, 1 / (i - 1)),
        f = new Set(
          [0.09, 0.3, 0.52, 0.74].map((h) => Math.round(h * (i - 1))),
        ),
        p = this.layout.spacing;
      for (let h = 0; h < i; h++) {
        let v = 0;
        f.has(h) ? (v = 2) : h >= 4 && h % 7 === 4 && h < i - 2 && (v = 1);
        let g = Math.round(
          d *
            Math.pow(m, h) *
            (v === 2 ? 1.6 : v === 1 ? 1.3 : 1) *
            (0.94 + 0.12 * this.rng.next()),
        );
        this.segs.push({
          id: h + 1,
          idx: h,
          d: -h * p,
          x: 0,
          y: 0,
          hp: g,
          maxHp: g,
          kind: v,
          alive: !0,
          flash: 0,
        });
      }
      this.placeSegs();
    }
    makeWeapon(t) {
      let r = I[t],
        a = this.stats.wLevel[t] ?? 1,
        n = this.stats.wStart[t];
      return {
        id: t,
        base:
          this.stats.atk * r.base.dmg * Ve(a) * (1 + (this.stats.wDmg[t] ?? 0)),
        dmgPct: 0,
        ratePct: 0,
        speedPct: 0,
        areaPct: 0,
        count: r.base.count + (n?.count ?? 0),
        pierce: r.base.pierce + (n?.pierce ?? 0),
        awakened: !1,
        ups: 0,
        timer: 0.2 + this.rng.next() * 0.3,
        phase: this.rng.next() * Math.PI * 2,
        beamT: 0,
        beamAng: [],
        aux: 0,
        hitCd: new Map(),
        dealt: 0,
      };
    }
    addWeapon(t) {
      this.weapons.some((r) => r.id === t) ||
        this.weapons.push(this.makeWeapon(t));
    }
    dmgOf(t) {
      let r = 1 + t.dmgPct + this.run.allDmg;
      return (
        t.awakened &&
          (r *= t.id === "needle" ? 1.6 : t.id === "boomerang" ? 1.35 : 1.25),
        t.base * r
      );
    }
    cdOf(t) {
      return (
        I[t.id].base.cd /
        ((1 + t.ratePct) * (1 + this.stats.rate + this.run.allRate))
      );
    }
    speedOf(t) {
      return I[t.id].base.speed * (1 + t.speedPct);
    }
    areaOf(t) {
      let r = I[t.id].base.area * (1 + t.areaPct + this.stats.area);
      return (
        t.awakened && (t.id === "spray" || t.id === "pulse") && (r *= 1.5),
        t.awakened && t.id === "saber" && (r *= 1.3),
        t.awakened && t.id === "homing" && (r *= 1.8),
        t.awakened && t.id === "beam" && (r *= 1.9),
        r
      );
    }
    get progress() {
      return this.total ? this.killed / this.total : 0;
    }
    get front() {
      return this.segs[0] ?? null;
    }
    get danger() {
      let t = this.front;
      return t
        ? Math.max(0, this.layout.path.length - t.d)
        : this.layout.path.length;
    }
    get speedMul() {
      if (this.freezeT > 0) return 0;
      let t = this.frost.length * 0.08;
      return Math.max(0.35, 1 - this.run.slow - this.stats.slow - t);
    }
    step(t) {
      if (
        !(this.state !== "play" || this.paused) &&
        ((this.time += t),
        (this.heroKick = Math.max(0, this.heroKick - t * 6)),
        this.moveChain(t),
        this.state === "play")
      ) {
        for (let r of this.weapons) this.updateWeapon(r, t);
        (this.updateProjs(t),
          this.updateLobs(t),
          this.updateZones(t),
          this.updatePulses(t));
        for (let r = this.slashes.length - 1; r >= 0; r--)
          ((this.slashes[r].t -= t),
            this.slashes[r].t <= 0 && this.slashes.splice(r, 1));
        for (let r of this.segs) r.flash > 0 && (r.flash -= t);
        (this.cleanup(),
          this.segs.length === 0 &&
            this.state === "play" &&
            ((this.state = "won"), (this.bestProgress = 1)));
      }
    }
    moveChain(t) {
      let r = this.segs,
        a = r.length;
      if (!a) return;
      this.freezeT > 0 && (this.freezeT -= t);
      for (let l = this.frost.length - 1; l >= 0; l--)
        this.frost[l] <= this.time && this.frost.splice(l, 1);
      let n = this.layout.path.length,
        i = this.layout.spacing,
        s = this.baseSpeed * this.speedMul;
      (this.entering && (r[0].d < n * Wo ? (s *= Do) : (this.entering = !1)),
        (r[a - 1].d += s * t));
      for (let l = a - 2; l >= 0; l--) {
        let c = r[l + 1].d + i;
        r[l].d < c && (r[l].d = c);
      }
      (this.placeSegs(),
        r[0].d >= n &&
          ((this.state = "dead"),
          (this.bestProgress = Math.max(this.bestProgress, this.progress))));
    }
    placeSegs() {
      let t = this.layout.path;
      for (let r of this.segs)
        (t.at(r.d, this.tmp), (r.x = this.tmp.x), (r.y = this.tmp.y));
    }
    cleanup() {
      (this.segs.some((t) => !t.alive) &&
        (this.segs = this.segs.filter((t) => t.alive)),
        this.focus && !this.focus.alive && (this.focus = null));
    }
    targetable(t) {
      let { W: r, H: a } = this.layout;
      return (
        t.alive &&
        t.d > 0 &&
        t.x > -10 &&
        t.x < r + 10 &&
        t.y > 60 &&
        t.y < a + 10
      );
    }
    pickTarget() {
      if (this.focus && this.targetable(this.focus)) return this.focus;
      for (let t of this.segs) if (this.targetable(t)) return t;
      return null;
    }
    nearest(t, r, a, n) {
      let i = null,
        s = a * a;
      for (let l of this.segs) {
        if (!this.targetable(l) || (n && n.has(l.id))) continue;
        let c = l.x - t,
          d = l.y - r,
          u = c * c + d * d;
        u < s && ((s = u), (i = l));
      }
      return i;
    }
    segAt(t, r) {
      let a = null,
        n = (this.layout.radius * 1.9) ** 2;
      for (let i of this.segs) {
        if (!this.targetable(i)) continue;
        let s = (i.x - t) ** 2 + (i.y - r) ** 2;
        s < n && ((n = s), (a = i));
      }
      return a;
    }
    setFocus(t) {
      this.focus = t && t !== this.focus ? t : null;
    }
    damage(t, r, a, n = t.x, i = t.y) {
      if (!t.alive) return;
      let s = this.stats.crit + this.run.crit,
        l = this.rng.next() < s,
        c = l ? r * (this.stats.critDmg + this.run.critDmg) : r,
        d = Math.min(t.hp, c);
      ((t.hp -= c),
        (t.flash = 0.07),
        (a.dealt += d),
        (this.damageDealt += d),
        this.fxOn &&
          this.fx.push({ t: "hit", x: n, y: i, dmg: c, crit: l, kind: a.id }),
        t.hp <= 0 && this.kill(t));
    }
    kill(t) {
      if (
        t.alive &&
        ((t.alive = !1),
        (this.killed += 1),
        t.kind === 2
          ? (this.chests.gold += 1)
          : t.kind === 1 && (this.chests.silver += 1),
        this.fxOn)
      ) {
        let r = t === this.segs[0] || t.kind > 0;
        (this.fx.push({
          t: "kill",
          x: t.x,
          y: t.y,
          r: this.layout.radius,
          kind: t.kind,
          big: r,
        }),
          t.kind && this.fx.push({ t: "chest", x: t.x, y: t.y, kind: t.kind }),
          this.sfx.push(t.kind ? "chest" : r ? "bigpop" : "pop"));
      }
    }
    aoe(t, r, a, n, i) {
      let s = this.layout.radius;
      for (let l of this.segs) {
        if (!this.targetable(l)) continue;
        (l.x - t) ** 2 + (l.y - r) ** 2 < (a + s * 0.8) ** 2 &&
          this.damage(l, n, i);
      }
    }
    kick(t, r) {
      if (((this.heroKick = 1), this.fxOn)) {
        let a = this.layout.hero;
        (this.fx.push({
          t: "muzzle",
          x: a.x + Math.cos(t) * 34,
          y: a.y + Math.sin(t) * 34,
          ang: t,
          kind: r,
        }),
          this.sfx.push("shoot"));
      }
    }
    updateWeapon(t, r) {
      let a = this.layout.hero;
      switch (t.id) {
        case "orbit":
          return this.updateOrbit(t, r);
        case "spray":
          return this.updateSpray(t, r);
        case "beam":
          this.updateBeam(t, r);
          break;
        case "frost":
          t.awakened &&
            ((t.aux -= r),
            t.aux <= 0 &&
              ((t.aux = 7),
              (this.freezeT = 1.5),
              this.fxOn &&
                (this.fx.push({ t: "freeze" }), this.sfx.push("freeze"))));
          break;
      }
      if (((t.timer -= r), t.timer > 0)) return;
      let n = this.pickTarget();
      if (!n) {
        t.timer = 0.05;
        return;
      }
      ((t.timer += this.cdOf(t)), t.timer < 0 && (t.timer = 0));
      let i = Math.atan2(n.y - a.y, n.x - a.x);
      switch (t.id) {
        case "dart":
        case "frost": {
          let s = t.count,
            l = 0.09;
          for (let c = 0; c < s; c++) {
            let d = i + (c - (s - 1) / 2) * l;
            this.shoot(t, d, 0, t.id === "frost" ? 11 : 10);
          }
          this.kick(i, t.id);
          break;
        }
        case "needle": {
          let s = this.layout.mode === "line" ? -Math.PI / 2 : i,
            l = t.count;
          for (let c = 0; c < l; c++)
            this.shoot(t, s, (c - (l - 1) / 2) * 24, 8);
          this.kick(s, t.id);
          break;
        }
        case "boomerang": {
          let s = t.count + (t.awakened ? 2 : 0);
          for (let l = 0; l < s; l++) {
            let c = i + (l - (s - 1) / 2) * 0.32,
              d = this.shoot(
                t,
                c,
                0,
                18 * (t.awakened ? 1.4 : 1) * (1 + t.areaPct * 0.3),
              );
            ((d.out = !0),
              (d.travelled = 0),
              (d.range = this.areaOf(t)),
              (d.pierce = 999),
              (d.life = 6));
          }
          this.kick(i, t.id);
          break;
        }
        case "chain":
          this.fireChain(t, n);
          break;
        case "bomb": {
          let s = t.count,
            l = this.areaOf(t);
          for (let c = 0; c < s; c++) {
            let d =
                c === 0 ? null : this.segs.filter((p) => this.targetable(p)),
              u =
                c === 0 || !d || !d.length
                  ? n
                  : d[Math.min(d.length - 1, c * 3)],
              m = 0.55,
              f = this.layout.path.at(
                u.d + this.baseSpeed * this.speedMul * m * 0.8,
                { x: 0, y: 0 },
              );
            this.lobs.push({
              sx: a.x,
              sy: a.y - 20,
              tx: f.x,
              ty: f.y,
              t: 0,
              T: m,
              dmg: this.dmgOf(t),
              r: l,
              w: t,
            });
          }
          this.kick(i, t.id);
          break;
        }
        case "homing": {
          let s = t.count + (t.awakened ? 3 : 0);
          for (let l = 0; l < s; l++) {
            let c =
                -Math.PI / 2 +
                (l - (s - 1) / 2) * 0.5 +
                (this.rng.next() - 0.5) * 0.3,
              d = this.shoot(
                t,
                this.layout.mode === "line" ? c : i + (l - (s - 1) / 2) * 0.6,
                0,
                9,
              ),
              u = this.segs.filter((m) => this.targetable(m));
            ((d.target = u[Math.min(u.length - 1, l)] ?? n),
              (d.explode = this.areaOf(t)),
              (d.life = 4),
              (d.pierce = 0));
          }
          this.kick(i, t.id);
          break;
        }
        case "beam": {
          let s = t.count;
          ((t.beamT = 1.1 * (t.awakened ? 1.5 : 1)), (t.beamAng = []));
          for (let l = 0; l < s; l++)
            t.beamAng.push(i + (l - (s - 1) / 2) * 0.2);
          ((t.aux = 0), this.kick(i, t.id));
          break;
        }
        case "pulse": {
          let s = this.areaOf(t),
            l = t.awakened ? 2 : 1;
          for (let c = 0; c < l; c++)
            this.pulses.push({
              x: a.x,
              y: a.y,
              r: 20,
              maxR: s,
              speed: s / 0.45,
              dmg: this.dmgOf(t),
              hit: new Set(),
              w: t,
              delay: c * 0.28,
            });
          ((this.heroKick = 1), this.fxOn && this.sfx.push("pulse"));
          break;
        }
        case "saber": {
          let s = this.areaOf(t),
            l = t.awakened ? [i, i + Math.PI] : [i],
            c = (70 * Math.PI) / 180;
          for (let d of l) {
            this.slashes.push({
              x: a.x,
              y: a.y,
              ang: d,
              half: c,
              r: s,
              t: 0.28,
            });
            for (let u of this.segs) {
              if (!this.targetable(u)) continue;
              let m = u.x - a.x,
                f = u.y - a.y;
              if (Math.hypot(m, f) > s + this.layout.radius) continue;
              let h = Math.atan2(f, m) - d;
              ((h = Math.atan2(Math.sin(h), Math.cos(h))),
                Math.abs(h) <= c && this.damage(u, this.dmgOf(t), t));
            }
          }
          ((this.heroKick = 1), this.fxOn && this.sfx.push("slash"));
          break;
        }
        default:
          break;
      }
    }
    shoot(t, r, a, n) {
      let i = this.layout.hero,
        s = this.speedOf(t) || 600,
        l = -Math.sin(r) * a,
        c = Math.cos(r) * a,
        d = {
          kind: t.id,
          x: i.x + Math.cos(r) * 30 + l,
          y: i.y + Math.sin(r) * 30 + c,
          vx: Math.cos(r) * s,
          vy: Math.sin(r) * s,
          r: n,
          dmg: this.dmgOf(t),
          pierce: t.id === "needle" && t.awakened ? 999 : t.pierce,
          life: 2.2,
          hit: new Set(),
          w: t,
          spin: 0,
        };
      return (this.projs.push(d), d);
    }
    updateOrbit(t, r) {
      let a = this.layout.hero,
        n = t.count + (t.awakened ? 2 : 0),
        i = 3 * (1 + t.ratePct * 0.5);
      t.phase += i * r;
      let s = this.areaOf(t);
      (t.awakened && (s *= 1.25 + 0.65 * Math.sin(this.time * 2.4)),
        (t.aux = s));
      let l = 17,
        c = this.cdOf(t),
        d = this.dmgOf(t);
      for (let u = 0; u < n; u++) {
        let m = t.phase + (u * Math.PI * 2) / n,
          f = a.x + Math.cos(m) * s,
          p = a.y + Math.sin(m) * s;
        for (let h of this.segs) {
          if (
            !this.targetable(h) ||
            (h.x - f) ** 2 + (h.y - p) ** 2 > (l + this.layout.radius) ** 2
          )
            continue;
          let v = h.id * 16 + u;
          (t.hitCd.get(v) ?? 0) > this.time ||
            (t.hitCd.set(v, this.time + c), this.damage(h, d, t, f, p));
        }
      }
      t.hitCd.size > 4e3 && t.hitCd.clear();
    }
    updateSpray(t, r) {
      let a = this.layout.hero,
        n = this.areaOf(t),
        i = this.nearest(a.x, a.y, n + this.layout.radius);
      if (!i) {
        t.beamT = 0;
        return;
      }
      let s = Math.atan2(i.y - a.y, i.x - a.x);
      if (((t.beamAng = [s]), (t.beamT = 0.2), (t.timer -= r), t.timer > 0))
        return;
      ((t.timer += this.cdOf(t)), t.timer < 0 && (t.timer = 0));
      let l = ((t.awakened ? 42 : 27) * Math.PI) / 180,
        c = this.dmgOf(t),
        d = !1;
      for (let u of this.segs) {
        if (!this.targetable(u)) continue;
        let m = u.x - a.x,
          f = u.y - a.y;
        if (m * m + f * f > (n + this.layout.radius) ** 2) continue;
        let p = Math.atan2(f, m) - s;
        ((p = Math.atan2(Math.sin(p), Math.cos(p))),
          Math.abs(p) <= l + 0.12 && (this.damage(u, c, t), (d = !0)));
      }
      d &&
        t.awakened &&
        this.frost.length < 1 &&
        this.frost.push(this.time + 0.4);
    }
    updateBeam(t, r) {
      if (t.beamT <= 0) return;
      t.beamT -= r;
      let a = this.layout.hero,
        n = this.pickTarget();
      if (n) {
        let c = Math.atan2(n.y - a.y, n.x - a.x),
          d = t.beamAng.length;
        for (let u = 0; u < d; u++) {
          let f = c + (u - (d - 1) / 2) * 0.2 - t.beamAng[u];
          ((f = Math.atan2(Math.sin(f), Math.cos(f))),
            (t.beamAng[u] += f * Math.min(1, r * 5)));
        }
      }
      if (((t.aux -= r), t.aux > 0)) return;
      t.aux += 0.1;
      let i = this.areaOf(t),
        s = this.dmgOf(t),
        l = 1800;
      for (let c of t.beamAng) {
        let d = Math.cos(c),
          u = Math.sin(c);
        for (let m of this.segs) {
          if (!this.targetable(m)) continue;
          let f = m.x - a.x,
            p = m.y - a.y,
            h = f * d + p * u;
          if (h < 0 || h > l) continue;
          Math.abs(f * u - p * d) < i / 2 + this.layout.radius &&
            this.damage(m, s, t);
        }
      }
    }
    fireChain(t, r) {
      let a = this.layout.hero,
        n = t.count + (t.awakened ? 3 : 0),
        i = this.areaOf(t),
        s = this.dmgOf(t),
        l = new Set(),
        c = [{ x: a.x, y: a.y - 20 }],
        d = r;
      for (let u = 0; u <= n && d; u++) {
        (l.add(d.id), c.push({ x: d.x, y: d.y }));
        let m = d;
        (this.damage(m, s, t),
          t.awakened && this.rng.chance(0.25) && this.damage(m, s, t),
          (s *= 0.92),
          (d = this.nearest(m.x, m.y, i, l)));
      }
      ((this.heroKick = 1),
        this.fxOn &&
          (this.fx.push({ t: "arc", pts: c }), this.sfx.push("zap")));
    }
    updateProjs(t) {
      let r = this.layout.radius,
        { W: a, H: n } = this.layout,
        i = this.layout.hero;
      for (let s = this.projs.length - 1; s >= 0; s--) {
        let l = this.projs[s];
        if (((l.life -= t), (l.spin += t * 14), l.kind === "boomerang")) {
          let d = this.speedOf(l.w);
          if (l.out)
            ((l.travelled += d * t),
              l.travelled >= l.range && ((l.out = !1), l.hit.clear()));
          else {
            let u = i.x - l.x,
              m = i.y - l.y,
              f = Math.hypot(u, m) || 1;
            ((l.vx += ((u / f) * d * 1.1 - l.vx) * Math.min(1, t * 6)),
              (l.vy += ((m / f) * d * 1.1 - l.vy) * Math.min(1, t * 6)),
              f < 30 && (l.life = 0));
          }
        } else if (
          l.kind === "homing" &&
          ((!l.target || !l.target.alive) &&
            (l.target = this.nearest(l.x, l.y, 2e3)),
          l.target)
        ) {
          let d = Math.atan2(l.target.y - l.y, l.target.x - l.x),
            u = Math.atan2(l.vy, l.vx),
            m = d - u;
          m = Math.atan2(Math.sin(m), Math.cos(m));
          let f = Math.sign(m) * Math.min(Math.abs(m), 6.5 * t),
            p = Math.min(
              this.speedOf(l.w) * 1.6,
              Math.hypot(l.vx, l.vy) + 500 * t,
            ),
            h = u + f;
          ((l.vx = Math.cos(h) * p), (l.vy = Math.sin(h) * p));
        }
        if (
          ((l.x += l.vx * t),
          (l.y += l.vy * t),
          l.life <= 0 || l.x < -60 || l.x > a + 60 || l.y < -60 || l.y > n + 60)
        ) {
          this.projs.splice(s, 1);
          continue;
        }
        let c = !1;
        for (let d of this.segs) {
          if (!d.alive || d.d <= 0) continue;
          let u = l.r + r,
            m = d.x - l.x,
            f = d.y - l.y;
          if (!(m * m + f * f > u * u) && !l.hit.has(d.id)) {
            if ((l.hit.add(d.id), l.explode)) {
              (this.aoe(l.x, l.y, l.explode, l.dmg, l.w),
                this.fxOn &&
                  (this.fx.push({
                    t: "boom",
                    x: l.x,
                    y: l.y,
                    r: l.explode,
                    color: "#8ff7ff",
                  }),
                  this.sfx.push("boom")),
                (c = !0));
              break;
            }
            if (
              (this.damage(d, l.dmg, l.w, l.x, l.y),
              l.kind === "frost" &&
                (this.frost.length < 3
                  ? this.frost.push(this.time + 2.5)
                  : (this.frost[0] = this.time + 2.5)),
              l.kind === "dart" && l.w.awakened && !l.mini)
            ) {
              let p = Math.atan2(l.vy, l.vx);
              for (let h of [-0.6, 0.6]) {
                let v = Math.hypot(l.vx, l.vy),
                  g = {
                    kind: "dart",
                    x: l.x,
                    y: l.y,
                    vx: Math.cos(p + h) * v,
                    vy: Math.sin(p + h) * v,
                    r: 7,
                    dmg: l.dmg * 0.5,
                    pierce: 0,
                    life: 0.8,
                    hit: new Set([d.id]),
                    w: l.w,
                    mini: !0,
                    spin: 0,
                  };
                this.projs.push(g);
              }
            }
            if (l.pierce <= 0) {
              c = !0;
              break;
            }
            l.pierce -= 1;
          }
        }
        c && this.projs.splice(s, 1);
      }
    }
    updateLobs(t) {
      for (let r = this.lobs.length - 1; r >= 0; r--) {
        let a = this.lobs[r];
        ((a.t += t),
          !(a.t < a.T) &&
            (this.lobs.splice(r, 1),
            this.aoe(a.tx, a.ty, a.r, a.dmg, a.w),
            a.w.awakened &&
              this.zones.push({
                x: a.tx,
                y: a.ty,
                r: a.r * 0.85,
                t: 3,
                tick: 0,
                dmg: a.dmg * 0.16,
                w: a.w,
              }),
            this.fxOn &&
              (this.fx.push({
                t: "boom",
                x: a.tx,
                y: a.ty,
                r: a.r,
                color: "#ffcf4a",
              }),
              this.sfx.push("boom"))));
      }
    }
    updateZones(t) {
      for (let r = this.zones.length - 1; r >= 0; r--) {
        let a = this.zones[r];
        ((a.t -= t),
          (a.tick -= t),
          a.tick <= 0 &&
            ((a.tick += 0.25), this.aoe(a.x, a.y, a.r, a.dmg, a.w)),
          a.t <= 0 && this.zones.splice(r, 1));
      }
    }
    updatePulses(t) {
      let r = this.layout.radius;
      for (let a = this.pulses.length - 1; a >= 0; a--) {
        let n = this.pulses[a];
        if (n.delay > 0) {
          n.delay -= t;
          continue;
        }
        let i = n.r;
        n.r += n.speed * t;
        for (let s of this.segs) {
          if (!this.targetable(s) || n.hit.has(s.id)) continue;
          let l = Math.hypot(s.x - n.x, s.y - n.y);
          l >= i - r &&
            l <= n.r + r &&
            (n.hit.add(s.id), this.damage(s, n.dmg, n.w));
        }
        n.r >= n.maxR && this.pulses.splice(a, 1);
      }
    }
    rollContext() {
      let t = this.stats.luck + Math.min(0.1, this.setup.fails * 0.02);
      return {
        loadout: this.setup.loadout,
        owned: this.weapons.map((r) => ({
          id: r.id,
          ups: r.ups,
          count: r.count,
          pierce: r.pierce,
          awakened: r.awakened,
        })),
        luck: t,
      };
    }
    openChest(t) {
      return (t === 2 ? this.chests.gold <= 0 : this.chests.silver <= 0)
        ? null
        : (t === 2 ? (this.chests.gold -= 1) : (this.chests.silver -= 1),
          (this.chestsOpened += 1),
          {
            kind: t,
            cards: this.roll(t),
            freeLeft: this.stats.freeRefresh,
            paidLeft: Oo,
          });
    }
    roll(t) {
      let r = this.rollContext();
      return t === 2 ? ci(r, this.rng) : xn(r, this.rng);
    }
    reroll(t, r) {
      if (r) {
        if (t.paidLeft <= 0) return !1;
        t.paidLeft -= 1;
      } else {
        if (t.freeLeft <= 0) return !1;
        t.freeLeft -= 1;
      }
      return ((t.cards = this.roll(t.kind)), !0);
    }
    apply(t) {
      if (t.t === "new") {
        this.addWeapon(t.weapon);
        return;
      }
      if (t.t === "glob") {
        switch (t.stat) {
          case "allDmg":
            this.run.allDmg += t.value;
            break;
          case "crit":
            this.run.crit += t.value;
            break;
          case "critDmg":
            this.run.critDmg += t.value;
            break;
          case "allRate":
            this.run.allRate += t.value;
            break;
          case "slow":
            this.run.slow = Math.min(0.4, this.run.slow + t.value);
            break;
          case "knock":
            this.knockBack(t.value);
            break;
        }
        return;
      }
      let r = this.weapons.find((n) => n.id === t.weapon);
      if (!r) return;
      r.ups += 1;
      let a = I[r.id];
      switch (t.stat) {
        case "dmg":
          r.dmgPct += t.value;
          break;
        case "rate":
          r.ratePct += t.value;
          break;
        case "speed":
          r.speedPct += t.value;
          break;
        case "area":
          r.areaPct += t.value;
          break;
        case "pierce":
          r.pierce = Math.min(a.caps.pierce ?? 99, r.pierce + t.value);
          break;
        case "count":
          r.count = Math.min(a.caps.count ?? 99, r.count + t.value);
          break;
        case "awaken":
          ((r.awakened = !0), (r.aux = 0.5));
          break;
      }
    }
    knockBack(t) {
      for (let r of this.segs) r.d -= t;
      (this.placeSegs(),
        this.fxOn && (this.fx.push({ t: "knock" }), this.sfx.push("knock")));
    }
    reviveCost() {
      return this.revives >= pi ? null : Go[this.revives];
    }
    revive() {
      return this.state !== "dead" || this.revives >= pi
        ? !1
        : ((this.revives += 1),
          (this.state = "play"),
          (this.projs = []),
          this.knockBack(this.layout.path.length * Bo * (1 + this.stats.knock)),
          !0);
    }
    summary() {
      return {
        won: this.state === "won",
        progress:
          this.state === "won" ? 1 : Math.max(this.bestProgress, this.progress),
        kills: this.killed,
        chests: this.chestsOpened,
        time: this.time,
        top: this.weapons
          .map((t) => ({ id: t.id, dealt: t.dealt }))
          .sort((t, r) => r.dealt - t.dealt),
      };
    }
  };
var $ = "#2a1a3e";
function w(e, t, r, a, n, i) {
  let s = Math.min(i, a / 2, n / 2);
  (e.beginPath(),
    e.moveTo(t + s, r),
    e.arcTo(t + a, r, t + a, r + n, s),
    e.arcTo(t + a, r + n, t, r + n, s),
    e.arcTo(t, r + n, t, r, s),
    e.arcTo(t, r, t + a, r, s),
    e.closePath());
}
function B(e, t, r, a) {
  (e.beginPath(), e.arc(t, r, a, 0, Math.PI * 2));
}
function K(e, t, r, a, n, i = 0) {
  (e.beginPath(),
    e.ellipse(t, r, Math.max(0.01, a), Math.max(0.01, n), i, 0, Math.PI * 2));
}
function b(e, t, r, a = $) {
  ((e.fillStyle = t),
    e.fill(),
    r > 0 &&
      ((e.lineWidth = r),
      (e.strokeStyle = a),
      (e.lineJoin = "round"),
      e.stroke()));
}
function _e(e, t) {
  let r = parseInt(e.slice(1), 16),
    a = (r >> 16) & 255,
    n = (r >> 8) & 255,
    i = r & 255;
  return (
    t >= 0
      ? ((a += (255 - a) * t), (n += (255 - n) * t), (i += (255 - i) * t))
      : ((a *= 1 + t), (n *= 1 + t), (i *= 1 + t)),
    `rgb(${a | 0},${n | 0},${i | 0})`
  );
}
function Ft(e, t, r, a, n = 0.45, i = 5, s = -Math.PI / 2) {
  e.beginPath();
  for (let l = 0; l < i * 2; l++) {
    let c = s + (l * Math.PI) / i,
      d = l % 2 ? a * n : a,
      u = t + Math.cos(c) * d,
      m = r + Math.sin(c) * d;
    l === 0 ? e.moveTo(u, m) : e.lineTo(u, m);
  }
  e.closePath();
}
function St(e, t, r, a) {
  (e.beginPath(),
    e.moveTo(t + 0.15 * a, r - 0.5 * a),
    e.lineTo(t - 0.28 * a, r + 0.08 * a),
    e.lineTo(t - 0.02 * a, r + 0.08 * a),
    e.lineTo(t - 0.15 * a, r + 0.5 * a),
    e.lineTo(t + 0.3 * a, r - 0.1 * a),
    e.lineTo(t + 0.04 * a, r - 0.1 * a),
    e.closePath());
}
function rt(e, t, r, a, n, i) {
  let s = i.t,
    l = i.kick ?? 0,
    c = Math.sin(s * 3.2) * n * 0.04,
    d = 1 + Math.sin(s * 3.2) * 0.025 - l * 0.06,
    u = Math.max(2, n * 0.09),
    m = i.silhouette,
    f = m ? "#3b3052" : t.body,
    p = m ? "#2f2744" : t.accent;
  if (
    (e.save(),
    e.translate(r, a + c),
    (e.fillStyle = "rgba(0,0,0,0.25)"),
    K(e, 0, n * 0.98 - c, n * 0.85, n * 0.2),
    e.fill(),
    t.deco === "cape" || t.deco === "visor")
  ) {
    let g = Math.sin(s * 5) * n * 0.08;
    (e.beginPath(),
      e.moveTo(-n * 0.62, -n * 0.2),
      e.quadraticCurveTo(-n * 1.15, n * 0.5, -n * 0.9 + g, n * 0.98),
      e.lineTo(n * 0.9 - g, n * 0.98),
      e.quadraticCurveTo(n * 1.15, n * 0.5, n * 0.62, -n * 0.2),
      e.closePath(),
      b(e, p, u));
  }
  for (let g of [-1, 1])
    (K(e, g * n * 0.38, n * 0.86, n * 0.26, n * 0.16),
      b(e, m ? f : _e(t.body, -0.35), u));
  (e.save(), e.scale(1 / d, d), B(e, 0, 0, n));
  let h = f;
  if (
    (m ||
      ((h = e.createRadialGradient(
        -n * 0.35,
        -n * 0.4,
        n * 0.1,
        0,
        0,
        n * 1.05,
      )),
      h.addColorStop(0, _e(t.body, 0.45)),
      h.addColorStop(0.55, t.body),
      h.addColorStop(1, _e(t.body, -0.25))),
    b(e, h, u),
    !m &&
      ((e.fillStyle = "rgba(255,255,255,0.28)"),
      K(e, -n * 0.38, -n * 0.5, n * 0.22, n * 0.13, -0.6),
      e.fill(),
      t.deco === "leaf"))
  ) {
    ((e.strokeStyle = "rgba(255,255,255,0.35)"), (e.lineWidth = u * 0.6));
    for (let g = 0; g < 6; g++) {
      let _ = (g * Math.PI) / 3 + 0.3;
      (e.beginPath(),
        e.moveTo(Math.cos(_) * n * 0.55, Math.sin(_) * n * 0.55 + n * 0.25),
        e.lineTo(Math.cos(_) * n * 0.8, Math.sin(_) * n * 0.8 + n * 0.1),
        e.stroke());
    }
  }
  e.restore();
  let v = l * n * 0.25;
  for (let g of [-1, 1])
    (K(
      e,
      g * n * 0.98,
      n * 0.18 - (g > 0 ? v : 0),
      n * 0.19,
      n * 0.24,
      g * 0.4,
    ),
      b(e, f, u));
  if (!m) {
    let g = i.look ?? -Math.PI / 2,
      _ = Math.cos(g) * n * 0.06,
      k = Math.sin(g) * n * 0.05;
    if (t.deco === "visor")
      (w(e, -n * 0.72, -n * 0.42, n * 1.44, n * 0.42, n * 0.2),
        b(e, t.accent, u),
        (e.fillStyle = "rgba(255,255,255,0.7)"),
        w(e, -n * 0.55, -n * 0.34, n * 0.4, n * 0.1, n * 0.05),
        e.fill(),
        (e.fillStyle = "#fff"),
        K(e, -n * 0.3 + _, -n * 0.2, n * 0.1, n * 0.08),
        e.fill(),
        K(e, n * 0.3 + _, -n * 0.2, n * 0.1, n * 0.08),
        e.fill());
    else
      for (let x of [-1, 1])
        (K(e, x * n * 0.32, -n * 0.18, n * 0.2, n * 0.25),
          b(e, "#fff", u * 0.7),
          i.happy
            ? (e.beginPath(),
              e.arc(
                x * n * 0.32,
                -n * 0.12,
                n * 0.12,
                Math.PI * 1.1,
                Math.PI * 1.9,
              ),
              (e.lineWidth = u),
              (e.strokeStyle = $),
              e.stroke())
            : (K(e, x * n * 0.32 + _, -n * 0.14 + k, n * 0.11, n * 0.14),
              (e.fillStyle = $),
              e.fill(),
              (e.fillStyle = "#fff"),
              B(e, x * n * 0.32 + _ - n * 0.04, -n * 0.2 + k, n * 0.045),
              e.fill()));
    (t.deco === "bolt" &&
      ((e.strokeStyle = $),
      (e.lineWidth = u * 0.8),
      e.beginPath(),
      e.moveTo(-n * 0.95, -n * 0.3),
      e.lineTo(-n * 0.52, -n * 0.24),
      e.moveTo(n * 0.52, -n * 0.24),
      e.lineTo(n * 0.95, -n * 0.3),
      e.stroke()),
      (e.fillStyle = "rgba(255,90,120,0.35)"),
      K(e, -n * 0.58, n * 0.12, n * 0.14, n * 0.08),
      e.fill(),
      K(e, n * 0.58, n * 0.12, n * 0.14, n * 0.08),
      e.fill(),
      e.beginPath(),
      l > 0.3
        ? (K(e, 0, n * 0.2, n * 0.13, n * 0.12), b(e, "#a8243f", u * 0.7))
        : (e.arc(0, n * 0.1, n * 0.16, Math.PI * 0.15, Math.PI * 0.85),
          (e.lineWidth = u * 0.9),
          (e.strokeStyle = $),
          (e.lineCap = "round"),
          e.stroke()));
  }
  if (t.deco === "cape")
    (e.beginPath(),
      e.arc(0, 0, n * 0.98, Math.PI * 1.13, Math.PI * 1.87),
      (e.lineWidth = n * 0.17),
      (e.strokeStyle = m ? p : $),
      e.stroke(),
      (e.lineWidth = n * 0.1),
      (e.strokeStyle = m ? p : "#ffffff"),
      e.stroke(),
      Ft(e, 0, -n * 0.93, n * 0.24),
      b(e, m ? p : "#ffd23f", u * 0.8),
      Ft(e, 0, n * 0.55, n * 0.13),
      b(e, m ? p : "#ffd23f", u * 0.6));
  else if (t.deco === "leaf")
    (e.save(),
      e.translate(n * 0.1, -n * 0.95),
      e.rotate(0.5 + Math.sin(s * 4) * 0.08),
      K(e, n * 0.22, 0, n * 0.3, n * 0.14),
      b(e, p, u * 0.8),
      e.restore(),
      w(e, -n * 0.05, -n * 1.1, n * 0.1, n * 0.22, n * 0.05),
      b(e, m ? p : "#7a4a1a", u * 0.6),
      w(e, -n * 0.7, n * 0.46, n * 1.4, n * 0.2, n * 0.1),
      b(e, p, u * 0.8));
  else if (t.deco === "bolt")
    (St(e, n * 0.05, -n * 1.12, n * 0.75), b(e, p, u * 0.8));
  else if (t.deco === "snow") {
    (e.save(),
      e.translate(n * 0.55, -n * 0.72),
      (e.strokeStyle = m ? p : "#ffffff"),
      (e.lineWidth = n * 0.07),
      (e.lineCap = "round"));
    for (let g = 0; g < 3; g++)
      (e.rotate(Math.PI / 3),
        e.beginPath(),
        e.moveTo(-n * 0.22, 0),
        e.lineTo(n * 0.22, 0),
        e.stroke());
    (e.restore(),
      w(e, -n * 0.75, n * 0.42, n * 1.5, n * 0.22, n * 0.11),
      b(e, m ? p : "#e8f7ff", u * 0.8));
  } else
    t.deco === "visor" &&
      (e.beginPath(),
      e.moveTo(0, -n * 0.95),
      e.quadraticCurveTo(n * 0.2, -n * 1.5, n * 0.65, -n * 1.35),
      e.quadraticCurveTo(n * 0.3, -n * 1.2, n * 0.18, -n * 0.9),
      e.closePath(),
      b(e, p, u * 0.8));
  e.restore();
}
function U(e, t, r, a = 1) {
  return `hsla(${e},${t}%,${r}%,${a})`;
}
function Ne(e, t, r, a, n, i, s) {
  let l = Math.max(1.5, n * 0.1),
    c = i ? 10 : 8,
    d = U(t, 55, 18);
  (e.save(), e.translate(r, a));
  for (let m = 0; m < c; m++) {
    let f = (m / c) * Math.PI * 2 + s * 0.7,
      p = n * (i ? 1.32 : 1.24),
      h = Math.cos(f) * n * 0.8,
      v = Math.sin(f) * n * 0.8,
      g = Math.cos(f) * p,
      _ = Math.sin(f) * p;
    ((e.strokeStyle = d),
      (e.lineWidth = n * 0.2),
      (e.lineCap = "round"),
      e.beginPath(),
      e.moveTo(h, v),
      e.lineTo(g, _),
      e.stroke(),
      (e.strokeStyle = U(t, 70, 50)),
      (e.lineWidth = n * 0.09),
      e.stroke(),
      B(e, g, _, n * 0.16),
      b(e, U(t, 85, 72), l * 0.7, d));
  }
  B(e, 0, 0, n);
  let u = e.createRadialGradient(-n * 0.35, -n * 0.4, n * 0.1, 0, 0, n);
  (u.addColorStop(0, U(t, 90, 78)),
    u.addColorStop(0.6, U(t, 75, 58)),
    u.addColorStop(1, U(t, 70, 40)),
    b(e, u, l, d),
    (e.fillStyle = U(t, 70, 38, 0.45)));
  for (let m = 0; m < 3; m++) {
    let f = s * 2.1 + m * 2.2;
    (B(
      e,
      Math.cos(f) * n * 0.45,
      Math.sin(f) * n * 0.45 + n * 0.1,
      n * (0.12 + 0.05 * m),
    ),
      e.fill());
  }
  if (
    ((e.fillStyle = "rgba(255,255,255,0.45)"),
    K(e, -n * 0.38, -n * 0.45, n * 0.25, n * 0.14, -0.6),
    e.fill(),
    i)
  ) {
    for (let m of [-1, 1])
      (K(e, m * n * 0.36, -n * 0.12, n * 0.22, n * 0.2),
        b(e, "#fff", l * 0.7, d),
        B(e, m * n * 0.3, -n * 0.08, n * 0.1),
        (e.fillStyle = $),
        e.fill(),
        e.beginPath(),
        e.moveTo(m * n * 0.62, -n * 0.46),
        e.lineTo(m * n * 0.12, -n * 0.26),
        (e.lineWidth = l * 1.1),
        (e.strokeStyle = d),
        (e.lineCap = "round"),
        e.stroke());
    (e.beginPath(),
      e.moveTo(-n * 0.42, n * 0.28),
      e.quadraticCurveTo(0, n * 0.7, n * 0.42, n * 0.28),
      e.closePath(),
      b(e, "#5a0d24", l * 0.8, d),
      (e.fillStyle = "#fff"));
    for (let m of [-1, 1])
      (e.beginPath(),
        e.moveTo(m * n * 0.3, n * 0.31),
        e.lineTo(m * n * 0.18, n * 0.31),
        e.lineTo(m * n * 0.24, n * 0.44),
        e.closePath(),
        e.fill());
  }
  e.restore();
}
function Mt(e, t, r, a, n, i = 0) {
  let s = Math.max(1.5, a * 0.07),
    l = a * 1.9,
    c = a * 1.45,
    d = n ? "#ffc43d" : "#cfd8e6",
    u = n ? "#b86b0c" : "#6b7a96",
    m = n ? "#e0621f" : "#4f6ee0";
  (e.save(), e.translate(t, r));
  let f = e.createRadialGradient(0, 0, a * 0.2, 0, 0, a * 1.6);
  (f.addColorStop(0, n ? "rgba(255,220,90,0.55)" : "rgba(170,210,255,0.5)"),
    f.addColorStop(1, "rgba(255,255,255,0)"),
    (e.fillStyle = f),
    B(e, 0, 0, a * 1.6),
    e.fill(),
    w(e, -l / 2, -c * 0.12, l, c * 0.62, a * 0.14));
  let p = e.createLinearGradient(0, -c * 0.1, 0, c * 0.5);
  (p.addColorStop(0, _e(d, 0.2)),
    p.addColorStop(1, _e(d, -0.2)),
    b(e, p, s),
    e.save(),
    e.translate(0, -c * 0.12),
    e.rotate(-i * 0.5),
    e.beginPath(),
    e.moveTo(-l / 2, 0),
    e.lineTo(-l / 2, -c * 0.22),
    e.quadraticCurveTo(0, -c * 0.62, l / 2, -c * 0.22),
    e.lineTo(l / 2, 0),
    e.closePath());
  let h = e.createLinearGradient(0, -c * 0.5, 0, 0);
  (h.addColorStop(0, _e(d, 0.35)),
    h.addColorStop(1, d),
    b(e, h, s),
    e.restore(),
    (e.fillStyle = u));
  for (let v of [-l * 0.32, l * 0.32])
    e.fillRect(v - a * 0.1, -c * 0.5, a * 0.2, c * 0.98);
  ((e.strokeStyle = $), (e.lineWidth = s * 0.6));
  for (let v of [-l * 0.32, l * 0.32])
    e.strokeRect(v - a * 0.1, -c * 0.12, a * 0.2, c * 0.62);
  (e.beginPath(),
    e.moveTo(0, -c * 0.34),
    e.lineTo(a * 0.26, -c * 0.1),
    e.lineTo(0, c * 0.16),
    e.lineTo(-a * 0.26, -c * 0.1),
    e.closePath(),
    b(e, m, s * 0.8),
    (e.fillStyle = "rgba(255,255,255,0.7)"),
    e.beginPath(),
    e.moveTo(0, -c * 0.28),
    e.lineTo(a * 0.1, -c * 0.12),
    e.lineTo(-a * 0.06, -c * 0.12),
    e.closePath(),
    e.fill(),
    e.restore());
}
function hi(e, t, r, a, n, i, s, l, c) {
  (e.save(),
    e.translate(t, r),
    e.rotate(i),
    e.beginPath(),
    e.arc(-a / 2, 0, n, Math.PI / 2, Math.PI * 1.5),
    e.lineTo(0, -n),
    e.lineTo(0, n),
    e.closePath(),
    (e.fillStyle = s),
    e.fill(),
    e.beginPath(),
    e.arc(a / 2, 0, n, -Math.PI / 2, Math.PI / 2),
    e.lineTo(0, n),
    e.lineTo(0, -n),
    e.closePath(),
    (e.fillStyle = l),
    e.fill(),
    e.beginPath(),
    e.arc(-a / 2, 0, n, Math.PI / 2, Math.PI * 1.5),
    e.lineTo(a / 2, -n),
    e.arc(a / 2, 0, n, -Math.PI / 2, Math.PI / 2),
    e.closePath(),
    (e.lineWidth = c),
    (e.strokeStyle = $),
    e.stroke(),
    (e.fillStyle = "rgba(255,255,255,0.55)"),
    w(e, -a / 2, -n * 0.6, a * 0.8, n * 0.35, n * 0.2),
    e.fill(),
    e.restore());
}
function bi(e, t, r, a, n, i, s) {
  (e.save(),
    e.translate(t, r),
    e.rotate(n + Math.PI / 2),
    (e.lineCap = "round"),
    (e.lineJoin = "round"));
  let l = () => {
    (e.beginPath(),
      e.moveTo(0, a * 0.55),
      e.lineTo(0, 0),
      e.lineTo(-a * 0.4, -a * 0.5),
      e.moveTo(0, 0),
      e.lineTo(a * 0.4, -a * 0.5));
  };
  (l(),
    (e.strokeStyle = $),
    (e.lineWidth = a * 0.34 + s),
    e.stroke(),
    l(),
    (e.strokeStyle = i),
    (e.lineWidth = a * 0.34),
    e.stroke(),
    e.restore());
}
function Ho(e, t, r, a, n) {
  let i = Math.max(1.5, n * 0.06);
  switch ((e.save(), e.translate(r, a), t)) {
    case "dart":
      (bi(e, -n * 0.18, n * 0.12, n * 0.55, -Math.PI / 4, "#7ff0ff", i),
        bi(e, n * 0.22, -n * 0.18, n * 0.42, -Math.PI / 4, "#ffffff", i));
      break;
    case "needle": {
      (e.rotate(-Math.PI / 4),
        w(e, -n * 0.5, -n * 0.13, n * 0.62, n * 0.26, n * 0.05),
        b(e, "#bff3ff", i),
        (e.fillStyle = "#39b8ff"),
        e.fillRect(-n * 0.46, -n * 0.07, n * 0.36, n * 0.14),
        w(e, -n * 0.66, -n * 0.2, n * 0.16, n * 0.4, n * 0.04),
        b(e, "#8a9bb8", i),
        e.beginPath(),
        e.moveTo(n * 0.12, -n * 0.05),
        e.lineTo(n * 0.62, 0),
        e.lineTo(n * 0.12, n * 0.05),
        e.closePath(),
        b(e, "#e6edf5", i * 0.7));
      break;
    }
    case "orbit":
      ((e.strokeStyle = "rgba(255,255,255,0.5)"),
        (e.lineWidth = i),
        e.setLineDash([n * 0.08, n * 0.08]),
        B(e, 0, 0, n * 0.42),
        e.stroke(),
        e.setLineDash([]),
        hi(
          e,
          -n * 0.3,
          -n * 0.28,
          n * 0.36,
          n * 0.14,
          -0.6,
          "#ff5f7a",
          "#ffffff",
          i,
        ),
        hi(
          e,
          n * 0.3,
          n * 0.28,
          n * 0.36,
          n * 0.14,
          -0.6,
          "#3fd0ff",
          "#ffffff",
          i,
        ));
      break;
    case "spray": {
      (w(e, -n * 0.45, -n * 0.1, n * 0.4, n * 0.6, n * 0.1),
        b(e, "#6ee07a", i),
        w(e, -n * 0.36, -n * 0.3, n * 0.22, n * 0.22, n * 0.04),
        b(e, "#f2f2f2", i),
        (e.fillStyle = "#fff"),
        w(e, -n * 0.38, n * 0.05, n * 0.26, n * 0.2, n * 0.05),
        e.fill(),
        (e.fillStyle = "rgba(200,255,220,0.9)"));
      for (let s = 0; s < 6; s++)
        (B(
          e,
          n * (0 + s * 0.09),
          -n * 0.2 + (s % 3) * n * 0.1 - n * 0.05 * s * 0.2,
          n * (0.05 + s * 0.012),
        ),
          e.fill());
      break;
    }
    case "boomerang": {
      (e.rotate(-0.5),
        w(e, -n * 0.55, -n * 0.18, n * 1.1, n * 0.36, n * 0.18),
        b(e, "#f5c79a", i),
        w(e, -n * 0.18, -n * 0.14, n * 0.36, n * 0.28, n * 0.06),
        b(e, "#fff1e3", i * 0.6),
        (e.fillStyle = "#c98f5e"));
      for (let s of [-0.4, -0.3, 0.3, 0.4])
        (B(e, n * s, 0, n * 0.025), e.fill());
      break;
    }
    case "chain":
      (St(e, 0, 0, n * 1.15),
        b(e, "#ffe14a", i),
        (e.fillStyle = "rgba(255,255,255,0.7)"),
        St(e, -n * 0.03, -n * 0.06, n * 0.5),
        e.fill());
      break;
    case "bomb": {
      (B(e, 0, n * 0.05, n * 0.42),
        b(e, "#ff9f2e", i),
        (e.strokeStyle = "rgba(255,255,255,0.8)"),
        (e.lineWidth = i * 0.8),
        B(e, 0, n * 0.05, n * 0.26),
        e.stroke(),
        (e.fillStyle = "rgba(255,255,255,0.9)"));
      for (let [s, l, c] of [
        [0.35, -0.38, 0.09],
        [0.5, -0.52, 0.06],
        [0.2, -0.5, 0.05],
      ])
        (B(e, n * s, n * l, n * c), e.fill());
      ((e.font = `900 ${n * 0.34}px sans-serif`),
        (e.textAlign = "center"),
        (e.textBaseline = "middle"),
        (e.fillStyle = "#fff"),
        e.fillText("C", 0, n * 0.07));
      break;
    }
    case "frost": {
      (e.rotate(-Math.PI / 4),
        e.beginPath(),
        e.moveTo(n * 0.6, 0),
        e.lineTo(0, -n * 0.18),
        e.lineTo(-n * 0.55, 0),
        e.lineTo(0, n * 0.18),
        e.closePath(),
        b(e, "#aee9ff", i),
        (e.fillStyle = "rgba(255,255,255,0.8)"),
        e.beginPath(),
        e.moveTo(n * 0.45, 0),
        e.lineTo(0, -n * 0.08),
        e.lineTo(-n * 0.2, 0),
        e.closePath(),
        e.fill());
      break;
    }
    case "pulse":
      for (let s = 3; s >= 1; s--)
        (e.beginPath(),
          e.arc(-n * 0.3, 0, n * 0.22 * s, -0.9, 0.9),
          (e.lineWidth = n * 0.1),
          (e.strokeStyle = $),
          e.stroke(),
          (e.lineWidth = n * 0.06),
          (e.strokeStyle =
            s === 3 ? "#ff8ad8" : s === 2 ? "#ffc0ec" : "#ffffff"),
          e.stroke());
      (B(e, -n * 0.34, 0, n * 0.1), b(e, "#ff5fc4", i));
      break;
    case "homing": {
      (e.rotate(-Math.PI / 4),
        (e.fillStyle = "#ffb13d"),
        e.beginPath(),
        e.moveTo(-n * 0.4, -n * 0.1),
        e.lineTo(-n * 0.7, 0),
        e.lineTo(-n * 0.4, n * 0.1),
        e.closePath(),
        e.fill(),
        w(e, -n * 0.42, -n * 0.13, n * 0.72, n * 0.26, n * 0.12),
        b(e, "#f4f7ff", i),
        e.beginPath(),
        e.moveTo(n * 0.25, -n * 0.13),
        e.quadraticCurveTo(n * 0.55, 0, n * 0.25, n * 0.13),
        e.closePath(),
        b(e, "#ff4b6a", i),
        e.beginPath(),
        e.moveTo(-n * 0.3, -n * 0.12),
        e.lineTo(-n * 0.42, -n * 0.3),
        e.lineTo(-n * 0.12, -n * 0.12),
        e.moveTo(-n * 0.3, n * 0.12),
        e.lineTo(-n * 0.42, n * 0.3),
        e.lineTo(-n * 0.12, n * 0.12),
        b(e, "#ff4b6a", i * 0.8));
      break;
    }
    case "beam": {
      let s = e.createLinearGradient(-n * 0.5, 0, n * 0.6, 0);
      (s.addColorStop(0, "#b35cff"),
        s.addColorStop(1, "#ffffff"),
        e.rotate(-Math.PI / 4),
        w(e, -n * 0.1, -n * 0.12, n * 0.75, n * 0.24, n * 0.12),
        (e.fillStyle = s),
        e.fill(),
        w(e, -n * 0.6, -n * 0.22, n * 0.5, n * 0.44, n * 0.12),
        b(e, "#6a4bd6", i),
        B(e, -n * 0.35, 0, n * 0.1),
        (e.fillStyle = "#e9d8ff"),
        e.fill());
      break;
    }
    case "saber": {
      e.rotate(-Math.PI / 4);
      let s = e.createLinearGradient(-n * 0.2, 0, n * 0.7, 0);
      (s.addColorStop(0, "#74ffb4"),
        s.addColorStop(1, "#e5fff1"),
        w(e, -n * 0.15, -n * 0.11, n * 0.85, n * 0.22, n * 0.11),
        (e.fillStyle = s),
        e.fill(),
        (e.lineWidth = i),
        (e.strokeStyle = "#1c8f57"),
        e.stroke(),
        w(e, -n * 0.62, -n * 0.09, n * 0.42, n * 0.18, n * 0.06),
        b(e, "#6d7b93", i),
        w(e, -n * 0.24, -n * 0.24, n * 0.1, n * 0.48, n * 0.04),
        b(e, "#ffd23f", i));
      break;
    }
  }
  e.restore();
}
function gi(e, t, r, a) {
  let n = r ? "#ffcf3a" : "#d6e0ee";
  (e.save(),
    e.rotate(-Math.PI / 4),
    w(e, -t * 0.05, -t * 0.09, t * 0.62, t * 0.18, t * 0.06),
    b(e, n, a),
    w(e, t * 0.38, t * 0.02, t * 0.1, t * 0.2, t * 0.03),
    b(e, n, a),
    w(e, t * 0.2, t * 0.02, t * 0.1, t * 0.15, t * 0.03),
    b(e, n, a),
    B(e, -t * 0.25, 0, t * 0.27),
    b(e, n, a),
    B(e, -t * 0.25, 0, t * 0.1),
    b(e, r ? "#b8741a" : "#6f7f9a", a * 0.7),
    e.restore());
}
function No(e, t, r) {
  B(e, 0, 0, t * 0.46);
  let a = e.createRadialGradient(-t * 0.15, -t * 0.18, t * 0.05, 0, 0, t * 0.5);
  (a.addColorStop(0, "#fff3a8"),
    a.addColorStop(0.6, "#ffcc2f"),
    a.addColorStop(1, "#e08d0b"),
    b(e, a, r),
    B(e, 0, 0, t * 0.32),
    (e.strokeStyle = "#c77a08"),
    (e.lineWidth = r * 0.8),
    e.stroke(),
    w(e, -t * 0.1, -t * 0.1, t * 0.2, t * 0.2, t * 0.02),
    b(e, "#c77a08", r * 0.6));
}
function Fo(e, t, r, a = "#c56bff") {
  (e.beginPath(),
    e.moveTo(-t * 0.42, -t * 0.12),
    e.lineTo(-t * 0.22, -t * 0.38),
    e.lineTo(t * 0.22, -t * 0.38),
    e.lineTo(t * 0.42, -t * 0.12),
    e.lineTo(0, t * 0.45),
    e.closePath());
  let n = e.createLinearGradient(0, -t * 0.4, 0, t * 0.45);
  (n.addColorStop(0, _e(a, 0.45)),
    n.addColorStop(1, _e(a, -0.25)),
    b(e, n, r),
    (e.strokeStyle = "rgba(255,255,255,0.65)"),
    (e.lineWidth = r * 0.6),
    e.beginPath(),
    e.moveTo(-t * 0.42, -t * 0.12),
    e.lineTo(t * 0.42, -t * 0.12),
    e.moveTo(-t * 0.12, -t * 0.38),
    e.lineTo(-t * 0.18, -t * 0.12),
    e.lineTo(0, t * 0.42),
    e.moveTo(t * 0.12, -t * 0.38),
    e.lineTo(t * 0.18, -t * 0.12),
    e.stroke());
}
function Uo(e, t, r, a) {
  let n = H[a];
  (e.beginPath(),
    e.moveTo(0, -t * 0.46),
    e.lineTo(t * 0.3, -t * 0.05),
    e.lineTo(t * 0.12, t * 0.46),
    e.lineTo(-t * 0.22, t * 0.3),
    e.lineTo(-t * 0.3, -t * 0.12),
    e.closePath());
  let i = e.createLinearGradient(-t * 0.3, -t * 0.4, t * 0.3, t * 0.4);
  (i.addColorStop(0, _e(n, 0.5)),
    i.addColorStop(1, ca[a]),
    b(e, i, r),
    (e.strokeStyle = "rgba(255,255,255,0.7)"),
    (e.lineWidth = r * 0.6),
    e.beginPath(),
    e.moveTo(0, -t * 0.46),
    e.lineTo(-t * 0.02, t * 0.1),
    e.lineTo(t * 0.12, t * 0.46),
    e.stroke());
}
function jo(e, t, r, a) {
  switch (t) {
    case "cup": {
      (w(e, -r * 0.2, -r * 0.3, r * 0.4, r * 0.72, r * 0.1),
        b(e, "#5b8cff", a),
        w(e, -r * 0.24, -r * 0.44, r * 0.48, r * 0.16, r * 0.05),
        b(e, "#c9d6ff", a),
        (e.fillStyle = "rgba(255,255,255,0.4)"),
        w(e, -r * 0.14, -r * 0.2, r * 0.07, r * 0.5, r * 0.03),
        e.fill(),
        (e.fillStyle = "#ff5a5a"),
        B(e, r * 0.02, r * 0.08, r * 0.06),
        e.fill());
      break;
    }
    case "goji": {
      (w(e, -r * 0.32, -r * 0.28, r * 0.64, r * 0.66, r * 0.12),
        b(e, "#f8e2b0", a));
      for (let n = 0; n < 7; n++) {
        let i = n * 0.9;
        (K(
          e,
          Math.cos(i) * r * 0.16,
          r * 0.06 + Math.sin(i) * r * 0.14,
          r * 0.09,
          r * 0.05,
          i,
        ),
          b(e, "#ff3d3d", a * 0.5));
      }
      (w(e, -r * 0.34, -r * 0.36, r * 0.68, r * 0.12, r * 0.04),
        b(e, "#e05c2a", a));
      break;
    }
    case "tub": {
      (e.beginPath(),
        e.moveTo(-r * 0.42, -r * 0.12),
        e.lineTo(r * 0.42, -r * 0.12),
        e.lineTo(r * 0.32, r * 0.4),
        e.lineTo(-r * 0.32, r * 0.4),
        e.closePath(),
        b(e, "#b0764a", a),
        (e.strokeStyle = "#7a4a28"),
        (e.lineWidth = a * 0.7));
      for (let n of [0.05, 0.25])
        (e.beginPath(),
          e.moveTo(-r * 0.4, r * n),
          e.lineTo(r * 0.4, r * n),
          e.stroke());
      (K(e, 0, -r * 0.12, r * 0.42, r * 0.1),
        b(e, "#7fd6ff", a),
        (e.strokeStyle = "rgba(255,255,255,0.8)"),
        (e.lineWidth = a * 0.7));
      for (let n of [-0.15, 0.05, 0.22])
        (e.beginPath(),
          e.moveTo(r * n, -r * 0.28),
          e.quadraticCurveTo(r * (n + 0.08), -r * 0.36, r * n, -r * 0.46),
          e.stroke());
      break;
    }
    case "mask": {
      (K(e, -r * 0.2, 0, r * 0.24, r * 0.2),
        b(e, "#ffb3cf", a),
        K(e, r * 0.2, 0, r * 0.24, r * 0.2),
        b(e, "#ffb3cf", a),
        (e.strokeStyle = $),
        (e.lineWidth = a),
        e.beginPath(),
        e.arc(-r * 0.2, -r * 0.02, r * 0.1, 0.2, Math.PI - 0.2),
        e.moveTo(r * 0.3, -r * 0.02),
        e.arc(r * 0.2, -r * 0.02, r * 0.1, 0.2, Math.PI - 0.2),
        e.stroke(),
        (e.strokeStyle = "#ff7aa8"),
        (e.lineWidth = a * 1.4),
        e.beginPath(),
        e.moveTo(-r * 0.44, -r * 0.04),
        e.lineTo(-r * 0.5, -r * 0.1),
        e.moveTo(r * 0.44, -r * 0.04),
        e.lineTo(r * 0.5, -r * 0.1),
        e.stroke());
      break;
    }
    case "coffee": {
      (w(e, -r * 0.18, -r * 0.46, r * 0.36, r * 0.9, r * 0.06),
        b(e, "#8a4b2a", a),
        (e.fillStyle = "#ffd98a"),
        e.fillRect(-r * 0.18, -r * 0.12, r * 0.36, r * 0.22),
        (e.fillStyle = "#8a4b2a"),
        (e.font = `900 ${r * 0.18}px sans-serif`),
        (e.textAlign = "center"),
        (e.textBaseline = "middle"),
        e.fillText("3in1", 0, 0),
        (e.strokeStyle = $),
        (e.lineWidth = a * 0.6),
        e.beginPath(),
        e.moveTo(-r * 0.18, -r * 0.36),
        e.lineTo(r * 0.18, -r * 0.36),
        e.stroke());
      break;
    }
    case "glasses": {
      ((e.strokeStyle = $),
        (e.lineWidth = a * 1.5),
        e.beginPath(),
        e.moveTo(-r * 0.1, -r * 0.05),
        e.quadraticCurveTo(0, -r * 0.12, r * 0.1, -r * 0.05),
        e.stroke());
      for (let n of [-1, 1])
        (w(e, n * r * 0.28 - r * 0.19, -r * 0.18, r * 0.38, r * 0.3, r * 0.1),
          b(e, "rgba(120,160,255,0.75)", a),
          (e.fillStyle = "rgba(255,255,255,0.6)"),
          e.fillRect(n * r * 0.28 - r * 0.12, -r * 0.12, r * 0.08, r * 0.06));
      break;
    }
    case "belt": {
      (w(e, -r * 0.48, -r * 0.2, r * 0.96, r * 0.4, r * 0.12),
        b(e, "#6b5bd6", a),
        w(e, -r * 0.14, -r * 0.16, r * 0.28, r * 0.32, r * 0.05),
        b(e, "#ffd23f", a),
        (e.strokeStyle = "rgba(255,255,255,0.5)"),
        (e.lineWidth = a * 0.6),
        e.setLineDash([r * 0.05, r * 0.05]),
        e.beginPath(),
        e.moveTo(-r * 0.44, -r * 0.12),
        e.lineTo(-r * 0.18, -r * 0.12),
        e.moveTo(r * 0.18, -r * 0.12),
        e.lineTo(r * 0.44, -r * 0.12),
        e.stroke(),
        e.setLineDash([]));
      break;
    }
    case "pillow": {
      (e.beginPath(),
        e.arc(0, 0, r * 0.4, Math.PI * 0.05, Math.PI * 0.95, !0),
        (e.lineWidth = r * 0.26 + a * 2),
        (e.strokeStyle = $),
        (e.lineCap = "round"),
        e.stroke(),
        (e.lineWidth = r * 0.26),
        (e.strokeStyle = "#7ad0a0"),
        e.stroke(),
        (e.lineWidth = r * 0.06),
        (e.strokeStyle = "rgba(255,255,255,0.5)"),
        e.beginPath(),
        e.arc(0, 0, r * 0.44, Math.PI * 1.2, Math.PI * 1.8),
        e.stroke());
      break;
    }
    case "keyboard": {
      (w(e, -r * 0.48, -r * 0.24, r * 0.96, r * 0.48, r * 0.08),
        b(e, "#3d4560", a));
      for (let n = 0; n < 3; n++)
        for (let i = 0; i < 5; i++)
          (w(
            e,
            -r * 0.4 + i * r * 0.165,
            -r * 0.16 + n * r * 0.12,
            r * 0.13,
            r * 0.09,
            r * 0.02,
          ),
            (e.fillStyle = (n + i) % 4 === 0 ? "#6ff0ff" : "#e8ecf5"),
            e.fill());
      break;
    }
    case "clover": {
      for (let n = 0; n < 4; n++)
        (e.save(),
          e.rotate((n * Math.PI) / 2 + Math.PI / 4),
          e.beginPath(),
          e.moveTo(0, 0),
          e.bezierCurveTo(
            -r * 0.35,
            -r * 0.1,
            -r * 0.2,
            -r * 0.5,
            0,
            -r * 0.28,
          ),
          e.bezierCurveTo(r * 0.2, -r * 0.5, r * 0.35, -r * 0.1, 0, 0),
          b(e, "#4ed26a", a),
          e.restore());
      ((e.strokeStyle = "#2c8c43"),
        (e.lineWidth = a * 1.4),
        e.beginPath(),
        e.moveTo(0, 0),
        e.quadraticCurveTo(r * 0.1, r * 0.3, r * 0.25, r * 0.45),
        e.stroke());
      break;
    }
    case "koi": {
      (e.beginPath(),
        e.moveTo(-r * 0.4, 0),
        e.quadraticCurveTo(-r * 0.1, -r * 0.32, r * 0.25, -r * 0.05),
        e.lineTo(r * 0.45, -r * 0.22),
        e.lineTo(r * 0.4, r * 0.2),
        e.lineTo(r * 0.25, r * 0.05),
        e.quadraticCurveTo(-r * 0.1, r * 0.32, -r * 0.4, 0),
        b(e, "#ff6a3d", a),
        (e.fillStyle = "#fff"),
        K(e, -r * 0.08, -r * 0.02, r * 0.12, r * 0.08),
        e.fill(),
        (e.fillStyle = $),
        B(e, -r * 0.28, -r * 0.04, r * 0.04),
        e.fill());
      break;
    }
    case "rope": {
      ((e.strokeStyle = $),
        (e.lineWidth = r * 0.14 + a * 2),
        (e.lineCap = "round"));
      let n = () => {
        (e.beginPath(),
          e.moveTo(-r * 0.42, r * 0.1),
          e.bezierCurveTo(
            -r * 0.2,
            -r * 0.5,
            r * 0.2,
            r * 0.5,
            r * 0.42,
            -r * 0.1,
          ));
      };
      (n(),
        e.stroke(),
        (e.strokeStyle = "#ff3b4e"),
        (e.lineWidth = r * 0.14),
        n(),
        e.stroke(),
        B(e, 0, 0, r * 0.12),
        b(e, "#ffd23f", a));
      break;
    }
  }
}
function qo(e, t, r, a) {
  switch (t) {
    case "allDmg":
    case "atk": {
      (e.save(),
        e.rotate(-Math.PI / 4),
        w(e, -r * 0.07, -r * 0.5, r * 0.14, r * 0.7, r * 0.04),
        b(e, "#e8eef8", a),
        w(e, -r * 0.24, r * 0.16, r * 0.48, r * 0.1, r * 0.04),
        b(e, "#ffd23f", a),
        w(e, -r * 0.06, r * 0.24, r * 0.12, r * 0.22, r * 0.04),
        b(e, "#a0522d", a),
        e.restore(),
        t === "allDmg" &&
          (e.beginPath(),
          e.moveTo(r * 0.32, -r * 0.46),
          e.lineTo(r * 0.5, -r * 0.2),
          e.lineTo(r * 0.14, -r * 0.2),
          e.closePath(),
          b(e, "#4cd964", a * 0.8)));
      break;
    }
    case "crit": {
      (B(e, 0, 0, r * 0.42),
        b(e, "#ff5a5a", a),
        B(e, 0, 0, r * 0.28),
        b(e, "#fff", a * 0.7),
        B(e, 0, 0, r * 0.13),
        b(e, "#ff5a5a", a * 0.7));
      break;
    }
    case "critDmg": {
      (Ft(e, 0, 0, r * 0.48, 0.5, 8),
        b(e, "#ff8a1f", a),
        Ft(e, 0, 0, r * 0.26, 0.5, 8),
        (e.fillStyle = "#fff3b0"),
        e.fill());
      break;
    }
    case "allRate":
    case "rate": {
      for (let n of [-0.18, 0.12])
        (e.beginPath(),
          e.moveTo(-r * 0.35, r * (n + 0.2)),
          e.lineTo(0, r * (n - 0.12)),
          e.lineTo(r * 0.35, r * (n + 0.2)),
          (e.lineWidth = r * 0.16 + a * 2),
          (e.strokeStyle = $),
          (e.lineCap = "round"),
          (e.lineJoin = "round"),
          e.stroke(),
          (e.lineWidth = r * 0.16),
          (e.strokeStyle = "#3fd0ff"),
          e.stroke());
      break;
    }
    case "slow": {
      (K(e, 0, r * 0.25, r * 0.45, r * 0.12),
        b(e, "#b6e36c", a),
        B(e, -r * 0.02, -r * 0.02, r * 0.28),
        b(e, "#f2a64a", a),
        (e.strokeStyle = "#a45a12"),
        (e.lineWidth = a),
        e.beginPath());
      for (let n = 0; n < Math.PI * 4; n += 0.2) {
        let i = r * 0.02 + n * r * 0.018,
          s = -r * 0.02 + Math.cos(n) * i,
          l = -r * 0.02 + Math.sin(n) * i;
        n === 0 ? e.moveTo(s, l) : e.lineTo(s, l);
      }
      (e.stroke(),
        (e.strokeStyle = $),
        e.beginPath(),
        e.moveTo(r * 0.34, r * 0.18),
        e.lineTo(r * 0.42, -r * 0.12),
        e.moveTo(r * 0.28, r * 0.18),
        e.lineTo(r * 0.28, -r * 0.1),
        e.stroke());
      break;
    }
    case "knock": {
      for (let n = 0; n < 3; n++)
        (e.beginPath(),
          e.arc(
            0,
            r * 0.3,
            r * (0.2 + n * 0.16),
            Math.PI * 1.15,
            Math.PI * 1.85,
          ),
          (e.lineWidth = r * 0.08 + a * 2),
          (e.strokeStyle = $),
          e.stroke(),
          (e.lineWidth = r * 0.08),
          (e.strokeStyle = ["#fff", "#9fe6ff", "#3fa9ff"][n]),
          e.stroke());
      break;
    }
  }
}
function En(e, t, r, a) {
  (w(e, -t * 0.42, -t * 0.12, t * 0.84, t * 0.54, t * 0.08),
    b(e, a, r),
    w(e, -t * 0.46, -t * 0.3, t * 0.92, t * 0.22, t * 0.06),
    b(e, _e(a, 0.25), r),
    (e.fillStyle = "#ffd23f"),
    e.fillRect(-t * 0.08, -t * 0.3, t * 0.16, t * 0.72),
    (e.strokeStyle = $),
    (e.lineWidth = r * 0.7),
    e.strokeRect(-t * 0.08, -t * 0.3, t * 0.16, t * 0.72));
}
function Xo(e, t, r, a = 0) {
  let n = Math.max(1.5, r * 0.055);
  if (t.startsWith("weapon_")) return Ho(e, t.slice(7), 0, 0, r * 0.9);
  if (t.startsWith("relic_")) return jo(e, t.slice(6), r * 0.95, n);
  if (t.startsWith("hero_")) {
    let i = D[t.slice(5)] ?? D.amian;
    return rt(e, i, 0, r * 0.02, r * 0.32, { t: a, look: Math.PI / 2 });
  }
  if (t.startsWith("virus_"))
    return Ne(e, Number(t.slice(6)), 0, 0, r * 0.3, !0, 1);
  switch (t) {
    case "gold":
      return No(e, r, n);
    case "gem":
      return Fo(e, r, n);
    case "stamina":
      (St(e, 0, 0, r * 1.05),
        b(e, "#8cf04a", n),
        (e.fillStyle = "rgba(255,255,255,0.6)"),
        St(e, -r * 0.03, -r * 0.06, r * 0.45),
        e.fill());
      return;
    case "keyGold":
      return gi(e, r, !0, n);
    case "keySilver":
      return gi(e, r, !1, n);
    case "frag0":
    case "frag1":
    case "frag2":
    case "frag3":
    case "frag4":
      return Uo(e, r, n, Number(t.slice(4)));
    case "chestGold":
      return Mt(e, 0, r * 0.06, r * 0.36, !0);
    case "chestSilver":
      return Mt(e, 0, r * 0.06, r * 0.36, !1);
    case "boxBlue":
      return En(e, r, n, "#3ba4ff");
    case "boxPurple":
      return En(e, r, n, "#b35cff");
    case "gift":
      return En(e, r, n, "#ff5f7a");
    case "idle": {
      (Mt(e, 0, r * 0.1, r * 0.3, !0),
        B(e, r * 0.26, -r * 0.24, r * 0.18),
        b(e, "#fff", n),
        (e.strokeStyle = $),
        (e.lineWidth = n),
        e.beginPath(),
        e.moveTo(r * 0.26, -r * 0.34),
        e.lineTo(r * 0.26, -r * 0.24),
        e.lineTo(r * 0.34, -r * 0.2),
        e.stroke());
      return;
    }
    case "task": {
      (w(e, -r * 0.34, -r * 0.42, r * 0.68, r * 0.84, r * 0.08),
        b(e, "#fff7e0", n),
        w(e, -r * 0.16, -r * 0.48, r * 0.32, r * 0.14, r * 0.04),
        b(e, "#ff9f2e", n),
        (e.strokeStyle = "#4cd964"),
        (e.lineWidth = n * 1.3),
        (e.lineCap = "round"));
      for (let i of [-0.18, 0.06, 0.28])
        (e.beginPath(),
          e.moveTo(-r * 0.22, r * i),
          e.lineTo(-r * 0.16, r * (i + 0.05)),
          e.lineTo(-r * 0.08, r * (i - 0.05)),
          e.stroke());
      e.strokeStyle = "#b9a98a";
      for (let i of [-0.18, 0.06, 0.28])
        (e.beginPath(),
          e.moveTo(r * 0, r * i),
          e.lineTo(r * 0.22, r * i),
          e.stroke());
      return;
    }
    case "sign": {
      (w(e, -r * 0.4, -r * 0.34, r * 0.8, r * 0.74, r * 0.1),
        b(e, "#fff", n),
        w(e, -r * 0.4, -r * 0.34, r * 0.8, r * 0.24, r * 0.1),
        b(e, "#ff5a5a", n),
        (e.fillStyle = $),
        (e.font = `900 ${r * 0.32}px sans-serif`),
        (e.textAlign = "center"),
        (e.textBaseline = "middle"),
        e.fillText('✓', 0, r * 0.14));
      return;
    }
    case "lock": {
      (e.beginPath(),
        e.arc(0, -r * 0.08, r * 0.2, Math.PI, 0),
        (e.lineWidth = r * 0.1 + n * 2),
        (e.strokeStyle = $),
        e.stroke(),
        (e.lineWidth = r * 0.1),
        (e.strokeStyle = "#c9d2e3"),
        e.stroke(),
        w(e, -r * 0.3, -r * 0.1, r * 0.6, r * 0.46, r * 0.08),
        b(e, "#ffcf3a", n),
        B(e, 0, r * 0.1, r * 0.07),
        (e.fillStyle = $),
        e.fill());
      return;
    }
    case "power": {
      (e.beginPath(),
        e.moveTo(0, -r * 0.46),
        e.lineTo(r * 0.38, -r * 0.3),
        e.lineTo(r * 0.34, r * 0.12),
        e.quadraticCurveTo(r * 0.2, r * 0.36, 0, r * 0.46),
        e.quadraticCurveTo(-r * 0.2, r * 0.36, -r * 0.34, r * 0.12),
        e.lineTo(-r * 0.38, -r * 0.3),
        e.closePath(),
        b(e, "#ff5a5a", n),
        St(e, 0, 0, r * 0.6),
        (e.fillStyle = "#ffe14a"),
        e.fill());
      return;
    }
    case "star":
      (Ft(e, 0, 0, r * 0.46), b(e, "#ffd23f", n));
      return;
    case "vault": {
      (w(e, -r * 0.42, -r * 0.36, r * 0.84, r * 0.76, r * 0.12),
        b(e, "#6a4bd6", n),
        B(e, 0, r * 0.02, r * 0.24),
        b(e, "#ffd23f", n),
        (e.strokeStyle = $),
        (e.lineWidth = n));
      for (let i = 0; i < 4; i++) {
        let s = (i * Math.PI) / 2 + a;
        (e.beginPath(),
          e.moveTo(Math.cos(s) * r * 0.08, r * 0.02 + Math.sin(s) * r * 0.08),
          e.lineTo(Math.cos(s) * r * 0.2, r * 0.02 + Math.sin(s) * r * 0.2),
          e.stroke());
      }
      return;
    }
    default:
      return qo(e, t, r, n);
  }
}
var vi = new Map();
function yi(e, t = 96) {
  let r = `${e}@${t}`,
    a = vi.get(r);
  if (a) return a;
  let n = document.createElement("canvas");
  ((n.width = t), (n.height = t));
  let i = n.getContext("2d");
  (i.translate(t / 2, t / 2), Xo(i, e, t * 0.86));
  let s = n.toDataURL("image/png");
  return (vi.set(r, s), s);
}
var we = { gold: { x: 92, dy: 118 }, silver: { x: 628, dy: 118 } },
  ki =
    '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
function Vo(e, t, r, a) {
  let n = document.createElement("canvas");
  ((n.width = Math.max(1, Math.ceil(e * r))),
    (n.height = Math.max(1, Math.ceil(t * r))));
  let i = n.getContext("2d");
  return (i.scale(r, r), i.translate(e / 2, t / 2), a(i), n);
}
var Dr = class {
  constructor(t, r) {
    y(this, "canvas");
    y(this, "ctx");
    y(this, "b");
    y(this, "scale", 1);
    y(this, "dpr", 1);
    y(this, "bg", null);
    y(this, "spr", new Map());
    y(this, "parts", []);
    y(this, "texts", []);
    y(this, "flies", []);
    y(this, "arcs", []);
    y(this, "booms", []);
    y(this, "muzzles", []);
    y(this, "shake", 0);
    y(this, "flash", 0);
    y(this, "iceFlash", 0);
    y(this, "time", 0);
    y(this, "hue");
    y(this, "onChestLanded");
    ((this.canvas = t),
      (this.ctx = t.getContext("2d")),
      (this.b = r),
      (this.hue = (X[r.setup.chapter - 1] ?? X[0]).hue));
  }
  get W() {
    return this.b.layout.W;
  }
  get H() {
    return this.b.layout.H;
  }
  resize(t, r) {
    ((this.dpr = Math.min(2, window.devicePixelRatio || 1)),
      (this.canvas.width = Math.round(t * this.dpr)),
      (this.canvas.height = Math.round(r * this.dpr)),
      (this.canvas.style.width = `${t}px`),
      (this.canvas.style.height = `${r}px`),
      (this.scale = (t * this.dpr) / this.W),
      (this.bg = null),
      this.spr.clear());
  }
  toWorld(t, r) {
    let a = this.dpr / this.scale;
    return { x: t * a, y: r * a };
  }
  getSprite(t, r, a, n) {
    let i = this.spr.get(t);
    return (i || ((i = Vo(r, a, this.scale, n)), this.spr.set(t, i)), i);
  }
  segSprite(t, r, a) {
    let n = this.b.layout.radius;
    if (t === 1 || t === 2) {
      let c = n * 1.05;
      return this.getSprite(`chest${t}`, c * 3.4, c * 3.4, (d) =>
        Mt(d, 0, 0, c, t === 2),
      );
    }
    let i = r ? n * 1.38 : n * 0.96,
      s = a % 3,
      l = this.hue + (s - 1) * 8;
    return this.getSprite(`v${r ? "h" : "b"}${s}`, i * 2.9, i * 2.9, (c) =>
      Ne(c, l, 0, 0, i, r, s),
    );
  }
  projSprite(t, r) {
    let a = `p_${t}${r ? "m" : ""}`,
      n = r ? 0.7 : 1;
    switch (t) {
      case "dart":
        return this.getSprite(a, 40 * n, 40 * n, (i) => {
          i.scale(n, n);
          let s = i.createRadialGradient(0, 0, 2, 0, 0, 18);
          (s.addColorStop(0, "rgba(140,250,255,0.9)"),
            s.addColorStop(1, "rgba(140,250,255,0)"),
            (i.fillStyle = s),
            i.beginPath(),
            i.arc(0, 0, 18, 0, Math.PI * 2),
            i.fill(),
            i.rotate(Math.PI / 2),
            (i.lineCap = "round"),
            (i.lineJoin = "round"));
          let l = () => {
            (i.beginPath(),
              i.moveTo(0, 9),
              i.lineTo(0, 0),
              i.lineTo(-7, -8),
              i.moveTo(0, 0),
              i.lineTo(7, -8));
          };
          (l(),
            (i.strokeStyle = $),
            (i.lineWidth = 7.5),
            i.stroke(),
            l(),
            (i.strokeStyle = "#e8feff"),
            (i.lineWidth = 4),
            i.stroke());
        });
      case "needle":
        return this.getSprite(a, 56, 20, (i) => {
          let s = i.createLinearGradient(-26, 0, 26, 0);
          (s.addColorStop(0, "rgba(90,200,255,0)"),
            s.addColorStop(0.5, "rgba(90,200,255,0.6)"),
            s.addColorStop(1, "rgba(255,255,255,1)"),
            (i.fillStyle = s),
            w(i, -26, -4, 50, 8, 4),
            i.fill(),
            (i.fillStyle = "#fff"),
            i.beginPath(),
            i.moveTo(26, 0),
            i.lineTo(8, -3),
            i.lineTo(8, 3),
            i.closePath(),
            i.fill());
        });
      case "frost":
        return this.getSprite(a, 40, 24, (i) => {
          ((i.fillStyle = "rgba(160,230,255,0.35)"),
            w(i, -20, -6, 30, 12, 6),
            i.fill(),
            i.beginPath(),
            i.moveTo(18, 0),
            i.lineTo(2, -8),
            i.lineTo(-12, 0),
            i.lineTo(2, 8),
            i.closePath(),
            (i.fillStyle = "#c9f2ff"),
            i.fill(),
            (i.lineWidth = 2),
            (i.strokeStyle = "#2d7fb3"),
            i.stroke());
        });
      case "homing":
        return this.getSprite(a, 40, 24, (i) => {
          ((i.fillStyle = "#ffb13d"),
            i.beginPath(),
            i.moveTo(-10, -5),
            i.lineTo(-20, 0),
            i.lineTo(-10, 5),
            i.fill(),
            w(i, -12, -5, 22, 10, 5),
            (i.fillStyle = "#f4f7ff"),
            i.fill(),
            (i.lineWidth = 2),
            (i.strokeStyle = $),
            i.stroke(),
            i.beginPath(),
            i.moveTo(6, -5),
            i.quadraticCurveTo(16, 0, 6, 5),
            i.closePath(),
            (i.fillStyle = "#ff4b6a"),
            i.fill(),
            i.stroke());
        });
      case "boomerang":
        return this.getSprite(a, 64, 64, (i) => {
          (w(i, -26, -9, 52, 18, 9),
            (i.fillStyle = "#f5c79a"),
            i.fill(),
            (i.lineWidth = 3),
            (i.strokeStyle = $),
            i.stroke(),
            w(i, -9, -7, 18, 14, 3),
            (i.fillStyle = "#fff1e3"),
            i.fill(),
            (i.lineWidth = 2),
            i.stroke());
        });
      default:
        return this.getSprite(a, 30, 30, (i) => {
          ((i.fillStyle = "#fff"),
            i.beginPath(),
            i.arc(0, 0, 8, 0, Math.PI * 2),
            i.fill());
        });
    }
  }
  buildBg() {
    let {
        W: t,
        H: r,
        mode: a,
        path: n,
        hero: i,
        lineY: s,
        radius: l,
      } = this.b.layout,
      c = document.createElement("canvas");
    ((c.width = Math.ceil(t * this.scale)),
      (c.height = Math.ceil(r * this.scale)));
    let d = c.getContext("2d");
    d.scale(this.scale, this.scale);
    let u = (this.hue + 190) % 360;
    if (a === "line") {
      let v = d.createLinearGradient(0, 0, 0, r);
      (v.addColorStop(0, U(u, 42, 30)),
        v.addColorStop(1, U(u, 48, 16)),
        (d.fillStyle = v));
    } else {
      let v = d.createRadialGradient(
        t / 2,
        this.b.layout.cy,
        40,
        t / 2,
        this.b.layout.cy,
        r * 0.7,
      );
      (v.addColorStop(0, U(u, 45, 32)),
        v.addColorStop(1, U(u, 52, 13)),
        (d.fillStyle = v));
    }
    d.fillRect(0, 0, t, r);
    let m = 7 + this.b.setup.chapter * 13,
      f = () => ((m = (m * 16807) % 2147483647), m / 2147483647);
    for (let v = 0; v < 46; v++) {
      let g = f() * t,
        _ = f() * r,
        k = 14 + f() * 48;
      (d.beginPath(),
        d.arc(g, _, k, 0, Math.PI * 2),
        (d.fillStyle = U(u, 45, 40, 0.25)),
        d.fill(),
        (d.lineWidth = 3),
        (d.strokeStyle = U(u, 50, 55, 0.22)),
        d.stroke(),
        d.beginPath(),
        d.arc(g + k * 0.25, _ - k * 0.1, k * 0.28, 0, Math.PI * 2),
        (d.fillStyle = U(u, 50, 60, 0.18)),
        d.fill());
    }
    if (a === "ring") {
      ((d.strokeStyle = U(u, 50, 50, 0.1)), (d.lineWidth = 2));
      for (let v = 120; v < r; v += 110)
        (d.beginPath(),
          d.arc(t / 2, this.b.layout.cy, v, 0, Math.PI * 2),
          d.stroke());
    }
    let p = () => {
      d.beginPath();
      let v = 8;
      for (let _ = 0; _ <= n.length; _ += v) {
        let k = n.at(_);
        _ === 0 ? d.moveTo(k.x, k.y) : d.lineTo(k.x, k.y);
      }
      let g = n.at(n.length);
      d.lineTo(g.x, g.y);
    };
    if (
      ((d.lineCap = "round"),
      (d.lineJoin = "round"),
      p(),
      (d.lineWidth = l * 2 + 24),
      (d.strokeStyle = "rgba(10,0,20,0.35)"),
      d.stroke(),
      p(),
      (d.lineWidth = l * 2 + 10),
      (d.strokeStyle = U(u, 30, 22, 0.9)),
      d.stroke(),
      p(),
      (d.lineWidth = l * 2 - 4),
      (d.strokeStyle = U(u, 32, 27, 0.9)),
      d.stroke(),
      p(),
      d.setLineDash([6, 16]),
      (d.lineWidth = 3),
      (d.strokeStyle = U(u, 60, 70, 0.14)),
      d.stroke(),
      d.setLineDash([]),
      a === "line")
    ) {
      let v = d.createLinearGradient(0, s - 18, 0, s + 18);
      (v.addColorStop(0, "rgba(90,240,255,0)"),
        v.addColorStop(0.5, "rgba(90,240,255,0.35)"),
        v.addColorStop(1, "rgba(90,240,255,0)"),
        (d.fillStyle = v),
        d.fillRect(0, s - 18, t, 36),
        (d.strokeStyle = "rgba(160,250,255,0.8)"),
        (d.lineWidth = 3),
        d.setLineDash([22, 12]),
        d.beginPath(),
        d.moveTo(0, s),
        d.lineTo(t, s),
        d.stroke(),
        d.setLineDash([]));
      for (let g = 30; g < t; g += 110)
        (w(d, g - 7, s - 16, 14, 32, 5),
          (d.fillStyle = "#3a5a7a"),
          d.fill(),
          (d.lineWidth = 3),
          (d.strokeStyle = $),
          d.stroke(),
          (d.fillStyle = "#8ff7ff"),
          d.beginPath(),
          d.arc(g, s - 10, 4, 0, Math.PI * 2),
          d.fill());
    }
    let h = d.createRadialGradient(i.x, i.y + 20, 10, i.x, i.y + 20, 90);
    return (
      h.addColorStop(0, "rgba(120,255,230,0.35)"),
      h.addColorStop(1, "rgba(120,255,230,0)"),
      (d.fillStyle = h),
      d.beginPath(),
      d.ellipse(i.x, i.y + 24, 90, 40, 0, 0, Math.PI * 2),
      d.fill(),
      (d.strokeStyle = "rgba(160,255,235,0.55)"),
      (d.lineWidth = 3),
      d.beginPath(),
      d.ellipse(i.x, i.y + 26, 58, 22, 0, 0, Math.PI * 2),
      d.stroke(),
      c
    );
  }
  consumeFx() {
    let t = this.b;
    for (let r of t.fx)
      switch (r.t) {
        case "hit": {
          if (this.texts.length > 70 && !r.crit) break;
          this.texts.push({
            x: r.x + (Math.random() - 0.5) * 18,
            y: r.y - 10,
            vy: -70 - Math.random() * 30,
            text: W(r.dmg),
            life: r.crit ? 0.8 : 0.55,
            max: r.crit ? 0.8 : 0.55,
            size: r.crit ? 34 : 22,
            color: r.crit ? "#ffd23f" : "#ffffff",
          });
          break;
        }
        case "kill": {
          let a = r.big ? 18 : 10,
            n =
              r.kind === 2
                ? "#ffd23f"
                : r.kind === 1
                  ? "#dfe8ff"
                  : U(this.hue, 80, 62);
          for (let i = 0; i < a; i++) {
            let s = Math.random() * Math.PI * 2,
              l = 90 + Math.random() * (r.big ? 320 : 220);
            this.parts.push({
              x: r.x,
              y: r.y,
              vx: Math.cos(s) * l,
              vy: Math.sin(s) * l,
              life: 0.55,
              max: 0.55,
              r: 4 + Math.random() * 6,
              color: n,
              kind: r.kind ? 1 : 0,
              drag: 3,
            });
          }
          (this.parts.push({
            x: r.x,
            y: r.y,
            vx: 0,
            vy: 0,
            life: 0.3,
            max: 0.3,
            r: r.r * (r.big ? 2.2 : 1.6),
            color: "#ffffff",
            kind: 3,
            drag: 0,
          }),
            r.big && (this.shake = Math.max(this.shake, 5)));
          break;
        }
        case "chest": {
          let a = r.kind === 2 ? we.gold : we.silver;
          this.flies.push({
            x: r.x,
            y: r.y,
            tx: a.x,
            ty: this.H - a.dy,
            t: 0,
            kind: r.kind,
          });
          break;
        }
        case "boom":
          this.booms.push({ x: r.x, y: r.y, r: r.r, t: 0, color: r.color });
          for (let a = 0; a < 8; a++) {
            let n = Math.random() * Math.PI * 2,
              i = 60 + Math.random() * 140;
            this.parts.push({
              x: r.x,
              y: r.y,
              vx: Math.cos(n) * i,
              vy: Math.sin(n) * i,
              life: 0.45,
              max: 0.45,
              r: 5 + Math.random() * 5,
              color: r.color,
              kind: 2,
              drag: 2,
            });
          }
          break;
        case "arc":
          this.arcs.push({ pts: r.pts, t: 0.2 });
          break;
        case "muzzle":
          this.muzzles.length < 8 &&
            this.muzzles.push({ x: r.x, y: r.y, t: 0.08 });
          break;
        case "knock":
          ((this.flash = 0.35),
            this.parts.push({
              x: this.b.layout.hero.x,
              y: this.b.layout.hero.y,
              vx: 0,
              vy: 0,
              life: 0.5,
              max: 0.5,
              r: 700,
              color: "#bff6ff",
              kind: 3,
              drag: 0,
            }));
          break;
        case "freeze":
          this.iceFlash = 0.4;
          break;
      }
    t.fx.length = 0;
  }
  frame(t) {
    let r = this.b;
    ((this.time += t), this.consumeFx());
    let a = this.ctx,
      { W: n, H: i } = this;
    (a.setTransform(1, 0, 0, 1, 0, 0), this.bg || (this.bg = this.buildBg()));
    let s = 0,
      l = 0;
    (this.shake > 0 &&
      ((this.shake = Math.max(0, this.shake - t * 30)),
      (s = (Math.random() - 0.5) * this.shake * this.scale),
      (l = (Math.random() - 0.5) * this.shake * this.scale)),
      a.drawImage(this.bg, s, l),
      a.setTransform(this.scale, 0, 0, this.scale, s, l),
      this.drawZones(),
      this.drawChain(),
      this.drawPulses(),
      this.drawSlashes(),
      this.drawBeams(),
      this.drawHero(),
      this.drawOrbits(),
      this.drawProjs(),
      this.drawLobs(),
      this.updateParticles(t),
      this.drawArcs(t),
      this.drawBooms(t),
      this.drawMuzzles(t),
      this.drawFlies(t),
      this.drawTexts(t),
      this.drawFocus(),
      (r.freezeT > 0 || this.iceFlash > 0) &&
        ((this.iceFlash = Math.max(0, this.iceFlash - t)),
        (a.fillStyle = `rgba(150,220,255,${0.08 + this.iceFlash * 0.5})`),
        a.fillRect(0, 0, n, i)),
      this.flash > 0 &&
        ((this.flash = Math.max(0, this.flash - t)),
        (a.fillStyle = `rgba(255,255,255,${this.flash})`),
        a.fillRect(0, 0, n, i)));
    let c = r.danger;
    if (r.state === "play" && c < 800) {
      let u = (1 - c / 800) * (0.45 + 0.2 * Math.sin(this.time * 9)),
        m = a.createRadialGradient(
          n / 2,
          i / 2,
          i * 0.3,
          n / 2,
          i / 2,
          i * 0.75,
        );
      (m.addColorStop(0, "rgba(255,0,40,0)"),
        m.addColorStop(1, `rgba(255,20,60,${u})`),
        (a.fillStyle = m),
        a.fillRect(0, 0, n, i));
    }
  }
  drawChain() {
    let t = this.ctx,
      r = this.b,
      a = r.segs,
      n = r.layout.radius,
      i = this.time,
      s = r.freezeT > 0,
      l = -1;
    for (let c = a.length - 1; c >= 0; c--) {
      let d = a[c];
      if (d.d < -n * 2 || d.y < -60 || d.x < -60 || d.x > this.W + 60) continue;
      let u = c === 0 && d.kind === 0,
        m = this.segSprite(d.kind, u, d.idx),
        f = m.width / this.scale,
        p = m.height / this.scale,
        h = 1 + Math.sin(i * 6 + d.id * 1.7) * 0.04;
      (t.save(),
        t.translate(d.x, d.y),
        d.kind === 0 && t.rotate(Math.sin(i * 1.6 + d.id) * (u ? 0.08 : 0.25)),
        t.scale(h, h),
        t.drawImage(m, -f / 2, -p / 2, f, p),
        d.flash > 0 &&
          ((t.globalAlpha = Math.min(1, d.flash / 0.07) * 0.55),
          (t.fillStyle = "#fff"),
          t.beginPath(),
          t.arc(0, 0, u ? n * 1.38 : n, 0, Math.PI * 2),
          t.fill(),
          (t.globalAlpha = 1)),
        s &&
          ((t.fillStyle = "rgba(180,235,255,0.45)"),
          t.beginPath(),
          t.arc(0, 0, u ? n * 1.38 : n, 0, Math.PI * 2),
          t.fill()),
        t.restore());
      let v = W(Math.max(1, d.hp)),
        g = Math.round(
          (u ? n * 0.95 : n * 0.82) *
            (v.length > 4 ? 0.78 : v.length > 3 ? 0.9 : 1),
        );
      (g !== l && ((t.font = `900 ${g}px ${ki}`), (l = g)),
        (t.textAlign = "center"),
        (t.textBaseline = "middle"));
      let _ = d.kind ? d.y + n * 1.15 : u ? d.y + n * 0.62 : d.y + 1;
      ((t.lineWidth = g * 0.28),
        (t.lineJoin = "round"),
        (t.strokeStyle = "rgba(30,10,40,0.9)"),
        t.strokeText(v, d.x, _),
        (t.fillStyle = "#fff"),
        t.fillText(v, d.x, _));
    }
  }
  drawHero() {
    let t = this.b,
      r = D[t.setup.hero] ?? D.amian,
      a = t.pickTarget(),
      n = t.layout.hero,
      i = a ? Math.atan2(a.y - n.y, a.x - n.x) : -Math.PI / 2;
    rt(this.ctx, r, n.x, n.y, 38, { t: this.time, kick: t.heroKick, look: i });
  }
  drawOrbits() {
    let t = this.ctx,
      r = this.b.layout.hero;
    for (let a of this.b.weapons) {
      if (a.id !== "orbit") continue;
      let n = a.count + (a.awakened ? 2 : 0),
        i = a.aux || 120;
      ((t.strokeStyle = "rgba(255,255,255,0.12)"),
        (t.lineWidth = 2),
        t.beginPath(),
        t.arc(r.x, r.y, i, 0, Math.PI * 2),
        t.stroke());
      for (let s = 0; s < n; s++) {
        let l = a.phase + (s * Math.PI * 2) / n,
          c = r.x + Math.cos(l) * i,
          d = r.y + Math.sin(l) * i;
        (t.save(), t.translate(c, d), t.rotate(l + Math.PI / 2));
        let u = s % 2 ? "#3fd0ff" : "#ff5f7a";
        (w(t, -20, -10, 40, 20, 10),
          (t.fillStyle = "#fff"),
          t.fill(),
          t.save(),
          t.beginPath(),
          t.rect(-20, -10, 20, 20),
          t.clip(),
          w(t, -20, -10, 40, 20, 10),
          (t.fillStyle = u),
          t.fill(),
          t.restore(),
          w(t, -20, -10, 40, 20, 10),
          (t.lineWidth = 3),
          (t.strokeStyle = $),
          t.stroke(),
          (t.fillStyle = "rgba(255,255,255,0.6)"),
          w(t, -14, -6, 22, 4, 2),
          t.fill(),
          t.restore());
      }
    }
  }
  drawBeams() {
    let t = this.ctx,
      r = this.b,
      a = r.layout.hero;
    for (let n of r.weapons) {
      if (n.id === "spray" && n.beamT > 0) {
        let l = n.beamAng[0],
          c = r.areaOf(n),
          d = ((n.awakened ? 42 : 27) * Math.PI) / 180;
        for (let u = 0; u < 3; u++) {
          let m = l + (Math.random() - 0.5) * 2 * d,
            f = c * (1.6 + Math.random() * 0.8);
          this.parts.push({
            x: a.x + Math.cos(l) * 26,
            y: a.y + Math.sin(l) * 26,
            vx: Math.cos(m) * f,
            vy: Math.sin(m) * f,
            life: 0.42,
            max: 0.42,
            r: 8 + Math.random() * 8,
            color: n.awakened ? "#bff3ff" : "#c8ffd6",
            kind: 2,
            drag: 1.5,
          });
        }
      }
      if (n.id !== "beam" || n.beamT <= 0) continue;
      let i = r.areaOf(n),
        s = 0.85 + Math.random() * 0.3;
      for (let l of n.beamAng) {
        let c = a.x + Math.cos(l) * 1800,
          d = a.y + Math.sin(l) * 1800;
        ((t.lineCap = "round"),
          (t.strokeStyle = `rgba(170,90,255,${0.35 * s})`),
          (t.lineWidth = i * 1.9),
          t.beginPath(),
          t.moveTo(a.x, a.y),
          t.lineTo(c, d),
          t.stroke(),
          (t.strokeStyle = `rgba(215,170,255,${0.8 * s})`),
          (t.lineWidth = i),
          t.stroke(),
          (t.strokeStyle = "rgba(255,255,255,0.95)"),
          (t.lineWidth = i * 0.35),
          t.stroke());
      }
    }
  }
  drawPulses() {
    let t = this.ctx;
    for (let r of this.b.pulses) {
      if (r.delay > 0) continue;
      let a = r.r / r.maxR;
      ((t.strokeStyle = `rgba(255,150,230,${0.9 * (1 - a)})`),
        (t.lineWidth = 16 * (1 - a) + 4),
        t.beginPath(),
        t.arc(r.x, r.y, r.r, 0, Math.PI * 2),
        t.stroke(),
        (t.strokeStyle = `rgba(255,255,255,${0.9 * (1 - a)})`),
        (t.lineWidth = 3),
        t.stroke());
    }
  }
  drawSlashes() {
    let t = this.ctx;
    for (let r of this.b.slashes) {
      let a = r.t / 0.28,
        n = 1 - a,
        i = r.ang - r.half,
        s = i + r.half * 2 * Math.min(1, n * 1.6);
      (t.save(),
        (t.globalAlpha = Math.min(1, a * 2)),
        t.beginPath(),
        t.arc(r.x, r.y, r.r, i, s),
        t.arc(r.x, r.y, r.r * 0.72, s, i, !0),
        t.closePath());
      let l = t.createRadialGradient(r.x, r.y, r.r * 0.7, r.x, r.y, r.r);
      (l.addColorStop(0, "rgba(120,255,190,0)"),
        l.addColorStop(0.7, "rgba(140,255,200,0.75)"),
        l.addColorStop(1, "rgba(240,255,250,0.95)"),
        (t.fillStyle = l),
        t.fill(),
        t.restore());
    }
  }
  drawZones() {
    let t = this.ctx;
    for (let r of this.b.zones) {
      ((t.fillStyle = `rgba(255,180,60,${0.16 + 0.05 * Math.sin(this.time * 12)})`),
        t.beginPath(),
        t.arc(r.x, r.y, r.r, 0, Math.PI * 2),
        t.fill(),
        (t.fillStyle = "rgba(255,240,200,0.7)"));
      for (let a = 0; a < 5; a++) {
        let n = this.time * 2 + a * 1.3,
          i = r.r * ((this.time * 0.8 + a * 0.37) % 1) * 0.9;
        (t.beginPath(),
          t.arc(
            r.x + Math.cos(n) * i,
            r.y + Math.sin(n) * i,
            4,
            0,
            Math.PI * 2,
          ),
          t.fill());
      }
    }
  }
  drawProjs() {
    let t = this.ctx;
    for (let r of this.b.projs) {
      let a = this.projSprite(r.kind, !!r.mini),
        n = a.width / this.scale,
        i = a.height / this.scale;
      if ((t.save(), t.translate(r.x, r.y), r.kind === "boomerang")) {
        let s = r.r / 18;
        (t.scale(s, s), t.rotate(r.spin));
      } else t.rotate(Math.atan2(r.vy, r.vx));
      (t.drawImage(a, -n / 2, -i / 2, n, i),
        t.restore(),
        r.kind === "homing" &&
          Math.random() < 0.5 &&
          this.parts.push({
            x: r.x,
            y: r.y,
            vx: -r.vx * 0.1,
            vy: -r.vy * 0.1,
            life: 0.3,
            max: 0.3,
            r: 4,
            color: "#ffc46b",
            kind: 2,
            drag: 2,
          }));
    }
  }
  drawLobs() {
    let t = this.ctx;
    for (let r of this.b.lobs) {
      let a = Math.min(1, r.t / r.T),
        n = r.sx + (r.tx - r.sx) * a,
        i = r.sy + (r.ty - r.sy) * a,
        s = Math.sin(a * Math.PI) * 140;
      ((t.fillStyle = "rgba(0,0,0,0.25)"),
        t.beginPath(),
        t.ellipse(n, i, 14, 6, 0, 0, Math.PI * 2),
        t.fill(),
        t.save(),
        t.translate(n, i - s),
        t.rotate(a * 8),
        t.beginPath(),
        t.arc(0, 0, 15, 0, Math.PI * 2),
        (t.fillStyle = "#ff9f2e"),
        t.fill(),
        (t.lineWidth = 3),
        (t.strokeStyle = $),
        t.stroke(),
        (t.strokeStyle = "rgba(255,255,255,0.85)"),
        (t.lineWidth = 2.5),
        t.beginPath(),
        t.arc(0, 0, 8, 0, Math.PI * 2),
        t.moveTo(-15, 0),
        t.lineTo(15, 0),
        t.stroke(),
        t.restore());
    }
  }
  updateParticles(t) {
    let r = this.ctx;
    this.parts.length > 500 && this.parts.splice(0, this.parts.length - 500);
    for (let a = this.parts.length - 1; a >= 0; a--) {
      let n = this.parts[a];
      if (((n.life -= t), n.life <= 0)) {
        this.parts.splice(a, 1);
        continue;
      }
      let i = n.life / n.max;
      ((n.x += n.vx * t), (n.y += n.vy * t));
      let s = Math.max(0, 1 - n.drag * t);
      if (((n.vx *= s), (n.vy *= s), n.kind === 3)) {
        let l = n.r * (1 - i) + 6;
        ((r.strokeStyle = n.color),
          (r.globalAlpha = i * 0.8),
          (r.lineWidth = 6 * i + 2),
          r.beginPath(),
          r.arc(n.x, n.y, l, 0, Math.PI * 2),
          r.stroke(),
          (r.globalAlpha = 1));
        continue;
      }
      if (
        ((r.globalAlpha = n.kind === 2 ? i * 0.5 : Math.min(1, i * 1.6)),
        (r.fillStyle = n.color),
        n.kind === 1)
      ) {
        let l = n.r * (0.6 + i * 0.6);
        r.beginPath();
        for (let c = 0; c < 8; c++) {
          let d = (c * Math.PI) / 4 + n.life * 6,
            u = c % 2 ? l * 0.4 : l,
            m = n.x + Math.cos(d) * u,
            f = n.y + Math.sin(d) * u;
          c === 0 ? r.moveTo(m, f) : r.lineTo(m, f);
        }
        (r.closePath(), r.fill());
      } else
        (r.beginPath(),
          r.arc(
            n.x,
            n.y,
            n.kind === 2 ? n.r * (1.6 - i * 0.6) : n.r * (0.5 + i * 0.5),
            0,
            Math.PI * 2,
          ),
          r.fill());
      r.globalAlpha = 1;
    }
  }
  drawArcs(t) {
    let r = this.ctx;
    for (let a = this.arcs.length - 1; a >= 0; a--) {
      let n = this.arcs[a];
      if (((n.t -= t), n.t <= 0)) {
        this.arcs.splice(a, 1);
        continue;
      }
      let i = [];
      for (let l = 0; l < n.pts.length - 1; l++) {
        let c = n.pts[l],
          d = n.pts[l + 1],
          u = 5;
        for (let m = 0; m < u; m++) {
          let f = m / u,
            p = m === 0 ? 0 : 14;
          i.push({
            x: c.x + (d.x - c.x) * f + (Math.random() - 0.5) * p,
            y: c.y + (d.y - c.y) * f + (Math.random() - 0.5) * p,
          });
        }
      }
      i.push(n.pts[n.pts.length - 1]);
      let s = n.t / 0.2;
      for (let [l, c] of [
        [12, `rgba(255,230,80,${0.35 * s})`],
        [5, `rgba(255,250,200,${s})`],
      ])
        ((r.strokeStyle = c),
          (r.lineWidth = l),
          (r.lineJoin = "round"),
          r.beginPath(),
          i.forEach((d, u) => (u ? r.lineTo(d.x, d.y) : r.moveTo(d.x, d.y))),
          r.stroke());
    }
  }
  drawBooms(t) {
    let r = this.ctx;
    for (let a = this.booms.length - 1; a >= 0; a--) {
      let n = this.booms[a];
      n.t += t;
      let i = n.t / 0.35;
      if (i >= 1) {
        this.booms.splice(a, 1);
        continue;
      }
      r.globalAlpha = 1 - i;
      let s = r.createRadialGradient(
        n.x,
        n.y,
        0,
        n.x,
        n.y,
        n.r * (0.6 + i * 0.5),
      );
      (s.addColorStop(0, "rgba(255,255,255,0.9)"),
        s.addColorStop(0.5, n.color),
        s.addColorStop(1, "rgba(255,255,255,0)"),
        (r.fillStyle = s),
        r.beginPath(),
        r.arc(n.x, n.y, n.r * (0.6 + i * 0.5), 0, Math.PI * 2),
        r.fill(),
        (r.globalAlpha = 1));
    }
  }
  drawMuzzles(t) {
    let r = this.ctx;
    for (let a = this.muzzles.length - 1; a >= 0; a--) {
      let n = this.muzzles[a];
      if (((n.t -= t), n.t <= 0)) {
        this.muzzles.splice(a, 1);
        continue;
      }
      ((r.fillStyle = `rgba(255,255,220,${n.t / 0.08})`),
        r.beginPath(),
        r.arc(n.x, n.y, 12, 0, Math.PI * 2),
        r.fill());
    }
  }
  drawFlies(t) {
    let r = this.ctx;
    for (let a = this.flies.length - 1; a >= 0; a--) {
      let n = this.flies[a];
      if (((n.t += t / 0.7), n.t >= 1)) {
        (this.flies.splice(a, 1), this.onChestLanded?.(n.kind));
        continue;
      }
      let i = n.t * n.t * (3 - 2 * n.t),
        s = n.x + (n.tx - n.x) * i,
        l = n.y + (n.ty - n.y) * i - Math.sin(n.t * Math.PI) * 120;
      Mt(r, s, l, 22 + Math.sin(n.t * Math.PI) * 10, n.kind === 2);
    }
  }
  drawTexts(t) {
    let r = this.ctx;
    ((r.textAlign = "center"),
      (r.textBaseline = "middle"),
      (r.lineJoin = "round"));
    for (let a = this.texts.length - 1; a >= 0; a--) {
      let n = this.texts[a];
      if (((n.life -= t), n.life <= 0)) {
        this.texts.splice(a, 1);
        continue;
      }
      ((n.y += n.vy * t), (n.vy *= 1 - t * 3));
      let i = n.max - n.life,
        s = i < 0.1 ? 1.5 - i * 5 : 1,
        l = n.size * s;
      ((r.globalAlpha = Math.min(1, n.life / (n.max * 0.4))),
        (r.font = `900 ${l}px ${ki}`),
        (r.lineWidth = l * 0.22),
        (r.strokeStyle = "rgba(40,10,40,0.95)"),
        r.strokeText(n.text, n.x, n.y),
        (r.fillStyle = n.color),
        r.fillText(n.text, n.x, n.y),
        (r.globalAlpha = 1));
    }
  }
  drawFocus() {
    let t = this.b.focus;
    if (!t || !t.alive) return;
    let r = this.ctx,
      a = this.b.layout.radius * 1.7;
    (r.save(),
      r.translate(t.x, t.y),
      r.rotate(this.time * 2),
      (r.strokeStyle = "#ff3b5c"),
      (r.lineWidth = 4),
      r.setLineDash([10, 8]),
      r.beginPath(),
      r.arc(0, 0, a, 0, Math.PI * 2),
      r.stroke(),
      r.setLineDash([]));
    for (let n = 0; n < 4; n++)
      (r.rotate(Math.PI / 2),
        r.beginPath(),
        r.moveTo(a + 2, 0),
        r.lineTo(a + 14, -7),
        r.lineTo(a + 14, 7),
        r.closePath(),
        (r.fillStyle = "#ff3b5c"),
        r.fill());
    r.restore();
  }
};
var Jo = Symbol.for("preact-signals");
function Gr() {
  if (Le > 1) Le--;
  else {
    var e,
      t = !1;
    for (
      (function () {
        var n = Br;
        for (Br = void 0; n !== void 0; ) {
          var i = n.S;
          if (i.v === n.v)
            for (var s = i.t; s !== void 0; s = s.x) s.i === n.i && (s.i = i.i);
          n = n.o;
        }
      })();
      jt !== void 0;

    ) {
      var r = jt;
      for (jt = void 0, Wr++; r !== void 0; ) {
        var a = r.u;
        if (((r.u = void 0), (r.f &= -3), !(8 & r.f) && wi(r)))
          try {
            r.c();
          } catch (n) {
            t || ((e = n), (t = !0));
          }
        r = a;
      }
    }
    if (((Wr = 0), Le--, t)) throw e;
  }
}
function zn(e) {
  if (Le > 0) return e();
  ((Ln = ++Yo), Le++);
  try {
    return e();
  } finally {
    Gr();
  }
}
var Ut,
  F = void 0;
function qt(e) {
  var t = F,
    r = Ut;
  ((F = void 0), (Ut = void 0));
  try {
    return e();
  } finally {
    ((F = t), (Ut = r));
  }
}
var jt = void 0,
  Le = 0,
  Wr = 0,
  Yo = 0,
  Ln = 0,
  Br = void 0,
  Or = 0;
function _i(e) {
  if (F !== void 0) {
    var t = e.n;
    if (t === void 0 || t.t !== F)
      return (
        (t = {
          i: 0,
          S: e,
          p: F.s,
          n: void 0,
          t: F,
          e: void 0,
          x: void 0,
          r: t,
        }),
        F.s !== void 0 && (F.s.n = t),
        (F.s = t),
        (e.n = t),
        32 & F.f && e.S(t),
        t
      );
    if (t.i === -1)
      return (
        (t.i = 0),
        t.n !== void 0 &&
          ((t.n.p = t.p),
          t.p !== void 0 && (t.p.n = t.n),
          (t.p = F.s),
          (t.n = void 0),
          (F.s.n = t),
          (F.s = t)),
        t
      );
  }
}
function ee(e, t) {
  ((this.v = e),
    (this.i = 0),
    (this.n = void 0),
    (this.t = void 0),
    (this.l = 0),
    (this.W = t?.watched),
    (this.Z = t?.unwatched),
    (this.name = t?.name));
}
ee.prototype.brand = Jo;
ee.prototype.h = function () {
  return !0;
};
ee.prototype.S = function (e) {
  var t = this,
    r = this.t;
  r !== e &&
    e.e === void 0 &&
    ((e.x = r),
    (this.t = e),
    r !== void 0
      ? (r.e = e)
      : qt(function () {
          var a;
          (a = t.W) == null || a.call(t);
        }));
};
ee.prototype.U = function (e) {
  var t = this;
  if (this.t !== void 0) {
    var r = e.e,
      a = e.x;
    (r !== void 0 && ((r.x = a), (e.e = void 0)),
      a !== void 0 && ((a.e = r), (e.x = void 0)),
      e === this.t &&
        ((this.t = a),
        a === void 0 &&
          qt(function () {
            var n;
            (n = t.Z) == null || n.call(t);
          })));
  }
};
ee.prototype.subscribe = function (e) {
  var t = this;
  return at(
    function () {
      var r = t.value;
      qt(function () {
        return e(r);
      });
    },
    { name: "sub" },
  );
};
ee.prototype.valueOf = function () {
  return this.value;
};
ee.prototype.toString = function () {
  return this.value + "";
};
ee.prototype.toJSON = function () {
  return this.value;
};
ee.prototype.peek = function () {
  var e = this;
  return qt(function () {
    return e.value;
  });
};
Object.defineProperty(ee.prototype, "value", {
  get: function () {
    var e = _i(this);
    return (e !== void 0 && (e.i = this.i), this.v);
  },
  set: function (e) {
    if (e !== this.v) {
      if (Wr > 100) throw new Error("Cycle detected");
      ((function (r) {
        Le !== 0 &&
          Wr === 0 &&
          r.l !== Ln &&
          ((r.l = Ln), (Br = { S: r, v: r.v, i: r.i, o: Br }));
      })(this),
        (this.v = e),
        this.i++,
        Or++,
        Le++);
      try {
        for (var t = this.t; t !== void 0; t = t.x) t.t.N();
      } finally {
        Gr();
      }
    }
  },
});
function ge(e, t) {
  return new ee(e, t);
}
function wi(e) {
  for (var t = e.s; t !== void 0; t = t.n)
    if (t.S.i !== t.i || !t.S.h() || t.S.i !== t.i) return !0;
  return !1;
}
function Si(e) {
  for (var t = e.s; t !== void 0; t = t.n) {
    var r = t.S.n;
    if ((r !== void 0 && (t.r = r), (t.S.n = t), (t.i = -1), t.n === void 0)) {
      e.s = t;
      break;
    }
  }
}
function Mi(e) {
  for (var t = e.s, r = void 0; t !== void 0; ) {
    var a = t.p;
    (t.i === -1
      ? (t.S.U(t), a !== void 0 && (a.n = t.n), t.n !== void 0 && (t.n.p = a))
      : (r = t),
      (t.S.n = t.r),
      t.r !== void 0 && (t.r = void 0),
      (t = a));
  }
  e.s = r;
}
function nt(e, t) {
  (ee.call(this, void 0, t),
    (this.x = e),
    (this.s = void 0),
    (this.g = Or - 1),
    (this.f = 4));
}
nt.prototype = new ee();
nt.prototype.h = function () {
  if (((this.f &= -3), 1 & this.f)) return !1;
  if ((36 & this.f) == 32 || ((this.f &= -5), this.g === Or)) return !0;
  if (((this.g = Or), (this.f |= 1), this.i > 0 && !wi(this)))
    return ((this.f &= -2), !0);
  var e = F;
  try {
    (Si(this), (F = this));
    var t = this.x();
    (16 & this.f || this.v !== t || this.i === 0) &&
      ((this.v = t), (this.f &= -17), this.i++);
  } catch (r) {
    ((this.v = r), (this.f |= 16), this.i++);
  }
  return ((F = e), Mi(this), (this.f &= -2), !0);
};
nt.prototype.S = function (e) {
  if (this.t === void 0) {
    this.f |= 36;
    for (var t = this.s; t !== void 0; t = t.n) t.S.S(t);
  }
  ee.prototype.S.call(this, e);
};
nt.prototype.U = function (e) {
  if (this.t !== void 0 && (ee.prototype.U.call(this, e), this.t === void 0)) {
    this.f &= -33;
    for (var t = this.s; t !== void 0; t = t.n) t.S.U(t);
  }
};
nt.prototype.N = function () {
  if (!(2 & this.f)) {
    this.f |= 6;
    for (var e = this.t; e !== void 0; e = e.x) e.t.N();
  }
};
Object.defineProperty(nt.prototype, "value", {
  get: function () {
    if (1 & this.f) throw new Error("Cycle detected");
    var e = _i(this);
    if ((this.h(), e !== void 0 && (e.i = this.i), 16 & this.f)) throw this.v;
    return this.v;
  },
});
function Hr(e, t) {
  return new nt(e, t);
}
function Ti(e) {
  var t = e.m;
  if (((e.m = void 0), typeof t == "function")) {
    Le++;
    var r = F;
    F = void 0;
    try {
      t();
    } catch (a) {
      throw ((e.f &= -2), (e.f |= 8), $n(e), a);
    } finally {
      ((F = r), Gr());
    }
  }
}
function $n(e) {
  for (var t = e.s; t !== void 0; t = t.n) t.S.U(t);
  ((e.x = void 0), (e.s = void 0), Ti(e));
}
function Ko(e) {
  if (F !== this) throw new Error("Out-of-order effect");
  (Mi(this), (F = e), (this.f &= -2), 8 & this.f && $n(this), Gr());
}
function Tt(e, t) {
  ((this.x = e),
    (this.m = void 0),
    (this.s = void 0),
    (this.u = void 0),
    (this.f = 32),
    (this.name = t?.name),
    Ut && Ut.push(this));
}
Tt.prototype.c = function () {
  var e = this.S();
  try {
    if (8 & this.f || this.x === void 0) return;
    var t = this.x();
    typeof t == "function" && (this.m = t);
  } finally {
    e();
  }
};
Tt.prototype.S = function () {
  if (1 & this.f) throw new Error("Cycle detected");
  ((this.f |= 1), (this.f &= -9), Ti(this), Si(this), Le++);
  var e = F;
  return ((F = this), Ko.bind(this, e));
};
Tt.prototype.N = function () {
  2 & this.f || ((this.f |= 2), (this.u = jt), (jt = this));
};
Tt.prototype.d = function () {
  ((this.f |= 8), 1 & this.f || $n(this));
};
Tt.prototype.dispose = function () {
  this.d();
};
function at(e, t) {
  var r = new Tt(e, t);
  try {
    r.c();
  } catch (n) {
    throw (r.d(), n);
  }
  var a = r.d.bind(r);
  return ((a[Symbol.dispose] = a), a);
}
var Pi,
  Fr,
  Nr,
  Zo = typeof window < "u" && !!window.__PREACT_SIGNALS_DEVTOOLS__;
var Ci = [];
at(function () {
  Pi = this.N;
})();
function Pt(e, t) {
  L[e] = t.bind(null, L[e] || function () {});
}
function Xt(e) {
  if (Nr) {
    var t = Nr;
    ((Nr = void 0), t());
  }
  Nr = e && e.S();
}
function Ri(e) {
  var t = this,
    r = e.data,
    a = es(r);
  ((a.name = "ReactiveDom"), (a.value = r));
  var n = xr(function () {
      for (var l = t, c = t.__v; (c = c.__); )
        if (c.__c) {
          c.__c.__$f |= 4;
          break;
        }
      var d = Hr(function () {
          var p = a.value.value;
          return p === 0 ? 0 : p === !0 ? "" : p || "";
        }),
        u = Hr(function () {
          return !Array.isArray(d.value) && !tn(d.value);
        }),
        m = at(function () {
          if (((this.N = xi), u.value)) {
            var p = d.value;
            l.__v &&
              l.__v.__e &&
              l.__v.__e.nodeType === 3 &&
              (l.__v.__e.data = p);
          }
        }),
        f = t.__$u.d;
      return (
        (t.__$u.d = function () {
          (m(), f.call(this));
        }),
        [u, d]
      );
    }, []),
    i = n[0],
    s = n[1];
  return i.value ? s.peek() : s.value;
}
Ri.displayName = "ReactiveTextNode";
Object.defineProperties(ee.prototype, {
  constructor: { configurable: !0, value: void 0 },
  type: { configurable: !0, value: Ri },
  props: {
    configurable: !0,
    get: function () {
      var e = this;
      return {
        data: {
          get value() {
            return e.value;
          },
        },
      };
    },
  },
  __b: { configurable: !0, value: 1 },
});
Pt("__b", function (e, t) {
  if ((Xt(), (Fr = void 0), typeof t.type == "string")) {
    var r,
      a = t.props;
    for (var n in a)
      if (n !== "children") {
        var i = a[n];
        i instanceof ee &&
          (r || (t.__np = r = {}), (r[n] = i), (a[n] = i.peek()));
      }
  }
  e(t);
});
Pt("__r", function (e, t) {
  if ((e(t), t.type !== re)) {
    Xt();
    var r,
      a = t.__c;
    (a &&
      ((a.__$f &= -2),
      (r = a.__$u) === void 0 &&
        (a.__$u = r =
          (function (n, i) {
            var s;
            return (
              at(
                function () {
                  s = this;
                },
                { name: i },
              ),
              (s.c = n),
              s
            );
          })(
            (function (n) {
              return function () {
                var i;
                (Zo && ((i = this.y) == null || i.call(this)),
                  (n.__$f |= 1),
                  n.setState({}));
              };
            })(a),
            typeof t.type == "function"
              ? t.type.displayName || t.type.name
              : "",
          ))),
      (Fr = a),
      Xt(r));
  }
});
Pt("__e", function (e, t, r, a) {
  (Xt(), (Fr = void 0), e(t, r, a));
});
Pt("diffed", function (e, t) {
  (Xt(), (Fr = void 0));
  var r;
  if (typeof t.type == "string" && (r = t.__e)) {
    var a = t.__np,
      n = t.props,
      i = r.U;
    if (i)
      for (var s in i) {
        var l = i[s];
        l === void 0 || (a && s in a) || (l.d(), (i[s] = void 0));
      }
    if (a) {
      i || ((i = {}), (r.U = i));
      for (var c in a) {
        var d = i[c],
          u = a[c];
        d === void 0 ? ((d = Qo(r, c, u, n)), (i[c] = d)) : d.o(u, n);
      }
    }
  }
  e(t);
});
function Qo(e, t, r, a) {
  var n = t in e && e.ownerSVGElement === void 0,
    i = ge(r);
  return {
    o: function (s, l) {
      ((i.value = s), (a = l));
    },
    d: at(function () {
      this.N = xi;
      var s = i.value.value;
      a[t] !== s &&
        ((a[t] = s),
        n
          ? (e[t] = s)
          : s != null && (s !== !1 || t[4] === "-")
            ? e.setAttribute(t, s)
            : e.removeAttribute(t));
    }),
  };
}
Pt("unmount", function (e, t) {
  if (typeof t.type == "string") {
    var r = t.__e;
    if (r) {
      var a = r.U;
      if (a) {
        r.U = void 0;
        for (var n in a) {
          var i = a[n];
          i && i.d();
        }
      }
    }
    var s = t.__np;
    if (s) {
      var l = t.props;
      for (var c in s) l[c] = s[c];
    }
    t.__np = void 0;
  } else {
    var d = t.__c;
    if (d) {
      var u = d.__$u;
      u && ((d.__$u = void 0), u.d());
    }
  }
  e(t);
});
Pt("__h", function (e, t, r, a) {
  (a < 3 && (t.__$f |= 2), e(t, r, a));
});
dt.prototype.shouldComponentUpdate = function (e, t) {
  if (this.__R) return !0;
  var r = this.__$u,
    a = r && r.s !== void 0;
  for (var n in t) return !0;
  if (this.__f || (typeof this.u == "boolean" && this.u === !0)) {
    var i = 2 & this.__$f;
    if (!(a || i || 4 & this.__$f) || 1 & this.__$f) return !0;
  } else if (!(a || 4 & this.__$f) || 3 & this.__$f) return !0;
  for (var s in e) if (s !== "__source" && e[s] !== this.props[s]) return !0;
  for (var l in this.props) if (!(l in e)) return !0;
  return !1;
};
function es(e, t) {
  return xr(function () {
    return ge(e, t);
  }, []);
}
var ts = function (e) {
  queueMicrotask(function () {
    queueMicrotask(e);
  });
};
function rs() {
  zn(function () {
    for (var e; (e = Ci.shift()); ) Pi.call(e);
  });
}
function xi() {
  Ci.push(this) === 1 && (L.requestAnimationFrame || ts)(rs);
}
var languageSignal=ge(0), saveSignal=ge(0);
onLanguage(()=>{languageSignal.value++; Dn.value++;});
var ze = null,
  Dn = ge(0),
  Fe = ge("home"),
  Ur = ge(!1),
  jr = ge(null),
  Ct = ge([]),
  $e = ge(Date.now());
function Ii(e) {
  ((ze = e), Dn.value++);
}
function j() {
  if (!ze) throw new Error("meta not loaded");
  return ze;
}
function N() {
  return (languageSignal.value, Dn.value, j());
}
function P(e = !1) {
  (Dn.value++, e ? _t(j()) : Oa(j()));
}
var ns = 0;
function A(e) {
  let t = ++ns;
  ((Ct.value = [...Ct.value.slice(-2), { id: t, text: e }]),
    setTimeout(() => {
      Ct.value = Ct.value.filter((r) => r.id !== t);
    }, 1800));
}
function Z(e) {
  jr.value = e;
}
function le() {
  jr.value = null;
}
var Rt = ge([]);
function ie(e, t, r) {
  Rt.value = [...Rt.value, { title: e, reward: t, note: r }];
}
function Ai() {
  return setInterval(() => {
    let e = Date.now();
    if ((($e.value = e), ze)) {
      let t = ze.stamina,
        r = ze.daily.day;
      (Bt(ze, e), (ze.stamina !== t || ze.daily.day !== r) && P());
    }
  }, 1e3);
}
var as = 0;
function o(e, t, r, a, n, i) {
  languageSignal.value;
  t || (t = {});
  if (typeof e === 'string' || e === re) {
    if ('children' in t) t = { ...t, children: translateChildren(t.children) };
    for (const key of ['title','aria-label','placeholder']) if (typeof t[key] === 'string') t[key] = translateText(t[key]);
    if (typeof t.class === 'string' && /(?:content|modal-body|chapter-list|roster|ov)/.test(t.class)) t['data-mp-scroll'] = '';
  }
  var s,
    l,
    c = t;
  if ("ref" in c)
    for (l in ((c = {}), t)) l == "ref" ? (s = t[l]) : (c[l] = t[l]);
  var d = {
    type: e,
    props: c,
    key: r,
    ref: s,
    __k: null,
    __: null,
    __b: 0,
    __e: null,
    __c: null,
    constructor: void 0,
    __v: --as,
    __i: -1,
    __u: 0,
    __source: n,
    __self: i,
  };
  if (typeof e == "function" && (s = e.defaultProps))
    for (l in s) c[l] === void 0 && (c[l] = s[l]);
  return (L.vnode && L.vnode(d), d);
}
function S({ id: e, size: t = 1.6, class: r }) {
  return o("img", {
    class: `ico ${r ?? ""}`,
    src: yi(e, 128),
    style: { width: `calc(var(--u) * ${t})`, height: `calc(var(--u) * ${t})` },
    draggable: !1,
    alt: "",
  });
}
function C(e) {
  let t = e.color ?? "yellow";
  return o("button", {
    class: `btn btn-${t} ${e.small ? "btn-sm" : ""} ${e.big ? "btn-big" : ""} ${e.disabled ? "is-disabled" : ""} ${e.class ?? ""}`,
    style: e.style,
    onClick: (r) => {
      if ((r.stopPropagation(), e.disabled)) {
        M("click");
        return;
      }
      (M("click"), e.onClick?.());
    },
    children: e.children,
  });
}
function Ue({ show: e, n: t }) {
  return e ? o("span", { class: "dot", children: t && t > 1 ? t : "" }) : null;
}
function Ei({ onPlus: e }) {
  let t = N(),
    r = $e.value,
    a = ka(t, r),
    n = D[t.hero] ?? D.amian;
  return o("div", {
    class: "resbar",
    children: [
      o("div", {
        class: "avatar",
        onClick: () => (Fe.value = "hero"),
        children: [
          o(Se, { heroId: n.id, size: 2.6 }),
          o("div", {
            class: "avatar-pow",
            children: [o(S, { id: "power", size: 0.9 }), W(wt(t))],
          }),
        ],
      }),
      o("div", {
        class: "chips",
        children: [
          o("div", {
            class: "chip",
            onClick: () => e?.("gold"),
            children: [
              o(S, { id: "gold", size: 1.25 }),
              o("span", { children: W(t.gold) }),
              o("b", { class: "plus", children: "+" }),
            ],
          }),
          o("div", {
            class: "chip",
            onClick: () => e?.("gems"),
            children: [
              o(S, { id: "gem", size: 1.25 }),
              o("span", { children: W(t.gems) }),
              o("b", { class: "plus", children: "+" }),
            ],
          }),
        ],
      }),
    ],
  });
}
var is = [
  { id: "shop", label: "商店", icon: "gift" },
  { id: "weapons", label: "武器", icon: "weapon_needle" },
  { id: "home", label: "战斗", icon: "atk" },
  { id: "hero", label: "英雄", icon: "hero_amian" },
  { id: "relics", label: "藏品", icon: "relic_cup" },
];
function Li({ dots: e }) {
  let t = Fe.value;
  return o("nav", {
    class: "tabbar",
    children: is.map((r) =>
      o(
        "button",
        {
          class: `tab ${t === r.id ? "on" : ""} ${r.id === "home" ? "tab-main" : ""}`,
          onClick: () => {
            (M("click"), (Fe.value = r.id));
          },
          children: [
            o(S, { id: r.icon, size: r.id === "home" ? 2.3 : 1.9 }),
            o("span", { children: r.label }),
            o(Ue, { show: !!e[r.id] }),
          ],
        },
        r.id,
      ),
    ),
  });
}
function te(e) {
  let t = e.onClose ?? le;
  return o("div", {
    class: "modal-back",
    onClick: () => !e.noClose && t(),
    children: o("div", {
      class: `modal ${e.class ?? ""}`,
      onClick: (r) => r.stopPropagation(),
      children: [
        e.title && o("div", { class: "modal-title", children: e.title }),
        !e.noClose &&
          o("button", {
            class: "modal-x",
            onClick: () => {
              (M("click"), t());
            },
            children: "×",
          }),
        o("div", { class: "modal-body", children: e.children }),
      ],
    }),
  });
}
function os(e) {
  let t = [];
  if (
    (e.gold && t.push({ icon: "gold", label: "金币", amount: W(e.gold) }),
    e.gems && t.push({ icon: "gem", label: "钻石", amount: W(e.gems) }),
    e.keyGold &&
      t.push({ icon: "keyGold", label: "密宝钥匙", amount: String(e.keyGold) }),
    e.keySilver &&
      t.push({
        icon: "keySilver",
        label: "藏品钥匙",
        amount: String(e.keySilver),
      }),
    e.frags)
  ) {
    let r = ["绿色碎片", "蓝色碎片", "紫色碎片", "橙色碎片", "红色碎片"];
    for (let [a, n] of Object.entries(e.frags)) {
      let i = Number(a);
      n &&
        t.push({ icon: `frag${i}`, label: r[i], amount: String(n), rarity: i });
    }
  }
  return (
    e.weapon &&
      t.push({
        icon: `weapon_${e.weapon}`,
        label: I[e.weapon].name,
        amount: "解锁",
        rarity: I[e.weapon].rarity,
      }),
    e.relic &&
      t.push({
        icon: `relic_${e.relic}`,
        label: ut[e.relic].name,
        amount: "+1",
        rarity: ut[e.relic].rarity,
      }),
    e.hero &&
      t.push({
        icon: `hero_${e.hero}`,
        label: D[e.hero].name,
        amount: "英雄",
        rarity: D[e.hero].rarity,
      }),
    t
  );
}
function ae({ reward: e, small: t }) {
  let r = os(e);
  return o("div", {
    class: `rewards ${t ? "rewards-sm" : ""}`,
    children: r.map((a, n) =>
      o(
        "div",
        {
          class: "reward",
          style: {
            animationDelay: `${n * 0.06}s`,
            borderColor: a.rarity !== void 0 ? H[a.rarity] : void 0,
          },
          children: [
            o(S, { id: a.icon, size: t ? 1.6 : 2.2 }),
            o("b", { children: a.amount }),
            !t && o("span", { children: a.label }),
          ],
        },
        n,
      ),
    ),
  });
}
function Se({ heroId: e, size: t, happy: r, silhouette: a, virusHue: n }) {
  let i = se(null);
  return (
    ke(() => {
      let s = i.current,
        l =
          parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
        c = Math.min(2, window.devicePixelRatio || 1),
        d = Math.round(t * l);
      ((s.width = d * c), (s.height = d * c));
      let u = s.getContext("2d"),
        m = 0,
        f = performance.now(),
        p = () => {
          let h = (performance.now() - f) / 1e3;
          (u.setTransform(c, 0, 0, c, 0, 0),
            u.clearRect(0, 0, d, d),
            n !== void 0
              ? Ne(
                  u,
                  n,
                  d / 2,
                  d / 2 + Math.sin(h * 2) * d * 0.03,
                  d * 0.3,
                  !0,
                  1,
                )
              : rt(u, D[e] ?? D.amian, d / 2, d * 0.52, d * 0.3, {
                  t: h,
                  happy: r,
                  silhouette: a,
                  look: Math.PI / 2,
                }),
            (m = requestAnimationFrame(p)));
        };
      return (p(), () => cancelAnimationFrame(m));
    }, [e, t, r, a, n]),
    o("canvas", {
      ref: i,
      class: "herocv",
      style: { width: `calc(var(--u) * ${t})`, height: `calc(var(--u) * ${t})` },
    })
  );
}
function xt({ value: e, max: t, color: r, label: a }) {
  let n = t > 0 ? Math.max(0, Math.min(1, e / t)) : 0;
  return o("div", {
    class: "bar",
    children: [
      o("div", {
        class: "bar-fill",
        style: { width: `${n * 100}%`, background: r },
      }),
      a !== void 0 && o("span", { class: "bar-label", children: a }),
    ],
  });
}
function zi(e, t, r, a = "确定") {
  Z(() =>
    o(te, {
      title: e,
      children: [
        o("p", { class: "center-text", children: t }),
        o("div", {
          class: "row-btns",
          children: [
            o(C, { color: "gray", onClick: le, children: "取消" }),
            o(C, {
              color: "red",
              onClick: () => {
                (le(), r());
              },
              children: a,
            }),
          ],
        }),
      ],
    }),
  );
}
function ss(e) {
  return e.t === "glob" ? e.stat : `weapon_${e.weapon}`;
}
function ls({ c: e, onPick: t, idx: r }) {
  let a = In(e),
    n = H[e.rarity];
  return o("button", {
    class: `card r${e.rarity}`,
    style: { animationDelay: `${r * 0.07}s`, "--rc": n },
    onClick: t,
    children: [
      o("div", {
        class: "card-shape",
        children: o("div", {
          class: "card-body",
          children: [
            o("b", { class: "card-title", children: a.title }),
            o("span", { class: "card-desc", children: a.desc }),
            e.t === "new" &&
              o("span", { class: "card-note", children: I[e.weapon].tag }),
            e.t === "up" &&
              e.stat === "awaken" &&
              o("span", { class: "card-note", children: "超级强化" }),
          ],
        }),
      }),
      o("div", {
        class: "card-gem",
        children: [
          o("div", {
            class: "card-gem-in",
            children: o(S, { id: ss(e), size: 2.6 }),
          }),
          o("em", { class: "card-badge", children: a.badge }),
        ],
      }),
    ],
  });
}
function Di({ onExit: e }) {
  let t = se(null),
    r = se(null),
    a = se(null),
    n = se(null),
    [i, s] = he({ pct: 0, gold: 0, silver: 0, danger: !1, frozen: !1 }),
    [l, c] = he({ t: "none" }),
    d = se(l);
  d.current = l;
  if(liveBattle===a.current) liveOverlay=()=>d.current;
  let [u, m] = he(1),
    f = se(1);
  f.current = u;
  let [p, h] = he(!0),
    [, v] = he(0),
    [g, _] = he(null),
    k = j(),
    x = Oe(k.chapter, k.diff),
    Q = X[k.chapter - 1] ?? X[0],
    q = !k.tut.battle,
    it = se(resumedBattle?.setup?.mode ?? (q || Math.random() < 0.5 ? "line" : "ring")).current;
  ke(() => {
    let R = t.current,
      E = R.clientWidth,
      G = R.clientHeight,
      fe = 720,
      ot = Math.round((fe * G) / E),
      st = He(k),
      J = new Er({
        chapter: k.chapter,
        diff: k.diff,
        mode: it,
        W: fe,
        H: ot,
        seed: (Date.now() & 16777215) ^ 1540483477,
        stats: st,
        hero: k.hero,
        loadout: k.loadout,
        fails: k.fails[x] ?? 0,
        tutorial: q,
      });
    if(resumedBattle) {
      try { const saved=restoreBattle(resumedBattle,Er); J=saved.battle; c(saved.overlay); d.current=saved.overlay; m(saved.speed); f.current=saved.speed; }
      catch { A('存档无法读取，已保留原数据'); }
      resumedBattle=null;
    }
    a.current = J;
    liveBattle=J;liveOverlay=()=>d.current;liveSpeed=()=>f.current;
    if(saveEnabled)checkpoint();
    let checkpointAt=performance.now();
    let Jt = new Dr(r.current, J);
    (Jt.resize(E, G),
      (n.current = Jt),
      (Jt.onChestLanded = () => {
        !j().tut.chest &&
          d.current.t === "none" &&
          ((J.paused = !0), c({ t: "tip-chest" }));
      }),
      tt("battle"));
    let Xr = 0,
      On = performance.now(),
      Yt = 0,
      Gn = "",
      Vr = !1,
      Hn = !1,
      Jr = 0,
      Nn = (Un) => {
        let Yr = Math.min(0.05, (Un - On) / 1e3);
        On = Un;
        if(Un-checkpointAt>=10000){checkpointAt=Un; if(d.current.t!=='result')checkpoint();}
        let Kr = J.paused || d.current.t !== "none";
        if (!Kr && J.state === "play") {
          Yt += Yr * f.current;
          let Kt = 0;
          for (
            ;
            Yt >= 1 / 60 &&
            Kt++ < 8 &&
            (J.step(1 / 60), (Yt -= 1 / 60), J.state === "play");

          );
          Kt >= 8 && (Yt = 0);
        }
        Jt.frame(Kr ? 0 : Yr * Math.min(f.current, 1.5));
        for (let Kt of J.sfx) M(Kt);
        J.sfx.length = 0;
        let jn = J.danger < 520 && J.state === "play";
        jn && !Kr && ((Jr -= Yr), Jr <= 0 && (M("warn"), (Jr = 1.2)));
        let lt = {
            pct: Math.floor(J.progress * 100),
            gold: J.chests.gold,
            silver: J.chests.silver,
            danger: jn,
            frozen: J.freezeT > 0,
          },
          qn = `${lt.pct}|${lt.gold}|${lt.silver}|${lt.danger}|${lt.frozen}`;
        (qn !== Gn && ((Gn = qn), s(lt)),
          J.state === "dead" &&
            !Vr &&
            ((Vr = !0), M("lose"), J.revives < 3 ? c({ t: "revive" }) : Ce(!1)),
          J.state === "play" && (Vr = !1),
          J.state === "won" &&
            !Hn &&
            ((Hn = !0), setTimeout(() => Ce(!0), 700)),
          (Xr = requestAnimationFrame(Nn)));
      };
    Xr = requestAnimationFrame(Nn);
    let Qi = setTimeout(() => h(!1), 2200),
      eo = setTimeout(() => {
        j().tut.focus ||
          (A("小技巧：点击病毒可以集火攻击它！"), (j().tut.focus = !0));
      }, 9e3),
      Fn = () => {
        checkpoint();
        document.hidden &&
          d.current.t === "none" &&
          J.state === "play" &&
          c({ t: "pause" });
      };
    return (
      document.addEventListener("visibilitychange", Fn),
      () => {
        (liveBattle=null,
          cancelAnimationFrame(Xr),
          clearTimeout(Qi),
          clearTimeout(eo),
          document.removeEventListener("visibilitychange", Fn),
          tt("menu"));
      }
    );
  }, []);
  let Ce = (R) => {
      let E = a.current,
        G = j(),
        fe = E.summary(),
        ot = He(G),
        st = La(
          G,
          G.chapter,
          G.diff,
          { won: R, progress: fe.progress, kills: fe.kills, chests: fe.chests },
          1 + ot.reward,
          new be(Date.now() >>> 0),
        );
      ((G.tut.battle = !0),
        (G.tut.chest = !0),
        (liveBattle=null),
        P(!0),
        R && M("win"),
        c({ t: "result", won: R, settle: st, summary: fe }));
    },
    qe = (R) => {
      let E = a.current;
      if (!E || E.state !== "play") return;
      let G = E.openChest(R);
      if (!G) {
        A(R === 2 ? "击破金色宝箱获得新武器" : "击破银色宝箱获得强化");
        return;
      }
      ((j().daily.chests += 1),
        (j().tut.chest = !0),
        M("open"),
        _(null),
        c({ t: "chest", s: G }),
        d.current={t:'chest',s:G}, P());
    },
    ce = (R, E) => {
      g === null &&
        (_(E),
        M("pick"),
        setTimeout(() => {
          (a.current.apply(R.cards[E]), _(null), c({ t: "none" }), d.current={t:'none'}, P());
        }, 260));
    },
    De = (R) => {
      let E = a.current,
        G = j();
      if (E.takeAllUsed >= $r) return A("本局次数已用完");
      if (G.gems < zr) return A("钻石不足");
      ((G.gems -= zr), (E.takeAllUsed += 1));
      for (let fe of R.cards) E.apply(fe);
      (M("up"), c({ t: "none" }), d.current={t:'none'}, P());
    },
    Wn = (R) => {
      let E = a.current,
        G = j();
      if (R.freeLeft > 0) E.reroll(R, !1);
      else {
        if (R.paidLeft <= 0) return A("刷新次数已用完");
        if (G.gems < Lr) return A("钻石不足");
        ((G.gems -= Lr), E.reroll(R, !0), P());
      }
      (M("open"), c({ t: "chest", s: { ...R } }), d.current={t:'chest',s:{...R}}, P());
    },
    Yi = () => {
      let R = a.current,
        E = j(),
        G = R.reviveCost();
      if (G !== null) {
        if (E.gems < G) return A("钻石不足");
        ((E.gems -= G), R.revive(), M("revive"), c({ t: "none" }), d.current={t:'none'}, P());
      }
    },
    Ki = (R) => {
      let E = a.current,
        G = n.current;
      if (!E || !G || d.current.t !== "none") return;
      let fe = r.current.getBoundingClientRect(),
        ot = G.toWorld(R.clientX - fe.left, R.clientY - fe.top),
        st = E.segAt(ot.x, ot.y);
      st && (E.setFocus(st), M("click"));
    },
    Re = a.current,
    Bn = Re?.layout.H ?? 1280,
    qr = (R, E) => ({
      left: `${(R / 720) * 100}%`,
      bottom: `${(E / Bn) * 100}%`,
    }),
    Zi = 100 - i.pct,
    ne = j();
  return o("div", {
    class: "battle",
    ref: t,
    children: [
      o("canvas", { ref: r, class: "battle-cv", onPointerDown: (R) => Ki(R) }),
      o("div", {
        class: "hud",
        children: [
          o("button", {
            class: "hud-btn",
            onClick: () => (M("click"), c({ t: "pause" })),
            children: o("span", { class: "pause-ico" }),
          }),
          o("div", {
            class: "hud-mid",
            children: [
              o("div", {
                class: "hud-title",
                children: ["第", Q.id, "章 ", Q.name, " · ", ue[ne.diff].name],
              }),
              o("div", {
                class: "hud-bar",
                children: [
                  o("div", {
                    class: "hud-fill",
                    style: { width: `${i.pct}%` },
                  }),
                  o("span", { children: [i.pct, "%"] }),
                ],
              }),
            ],
          }),
          o("button", {
            class: `hud-btn speed ${u > 1 ? "on" : ""}`,
            onClick: () => (M("click"), m(u > 1 ? 1 : 2)),
            children: ["×", u],
          }),
        ],
      }),
      p &&
        o("div", {
          class: "mode-banner",
          children: [
            o("b", { children: it === "line" ? "阵地战" : "包围战" }),
            o("span", {
              children:
                it === "line"
                  ? "病毒从上方蜿蜒而下，穿透与直线武器更强！"
                  : "病毒四面合围，近战与范围武器更强！",
            }),
          ],
        }),
      i.danger && o("div", { class: "danger-tag", children: "⚠ 病毒逼近！" }),
      i.frozen && o("div", { class: "frozen-tag", children: "❄ 冻结" }),
      o("button", {
        class: `tray tray-gold ${i.gold ? "has" : ""}`,
        style: qr(we.gold.x, we.gold.dy),
        onClick: () => qe(2),
        children: [
          o(S, { id: "chestGold", size: 3.6 }),
          o("em", { children: i.gold }),
          o("span", { children: "新武器" }),
        ],
      }),
      o("button", {
        class: `tray tray-silver ${i.silver ? "has" : ""}`,
        style: qr(we.silver.x, we.silver.dy),
        onClick: () => qe(1),
        children: [
          o(S, { id: "chestSilver", size: 3.6 }),
          o("em", { children: i.silver }),
          o("span", { children: "强化" }),
        ],
      }),
      l.t === "tip-chest" &&
        o("div", {
          class: "tip-back",
          onClick: () => (
            (a.current.paused = !1),
            c({ t: "none" }),
            qe(i.gold ? 2 : 1)
          ),
          children: [
            o("div", {
              class: "tip-bubble",
              style: { bottom: `${((we.gold.dy + 150) / Bn) * 100}%` },
              children: [
                "宝箱掉落啦！点击宝箱挑选强化",
                o("br", {}),
                o("small", {
                  children:
                    "金色宝箱＝新武器，银色宝箱＝强化属性。可以先攒着，等拿到好武器再开！",
                }),
              ],
            }),
            o("div", {
              class: "tip-hand",
              style: qr(i.gold ? we.gold.x : we.silver.x, we.gold.dy + 40),
              children: "👇",
            }),
          ],
        }),
      l.t === "chest" &&
        o("div", {
          class: "ov ov-chest",
          children: [
            o("div", {
              class: "ribbon",
              children:
                l.s.kind === 2
                  ? "金色宝箱 · 选择新武器"
                  : "银色宝箱 · 强化属性",
            }),
            o("div", {
              class: "rar-legend",
              children: Et.map((R, E) =>
                o(
                  "span",
                  { style: { background: H[E] }, children: R.slice(0, 1) },
                  E,
                ),
              ),
            }),
            o("div", {
              class: `cards ${g !== null ? "picking" : ""}`,
              children: l.s.cards.map((R, E) =>
                o(
                  "div",
                  {
                    class: `card-wrap ${g === E ? "chosen" : g !== null ? "dim" : ""}`,
                    children: o(ls, { c: R, idx: E, onPick: () => ce(l.s, E) }),
                  },
                  `${E}-${In(R).title}-${R.rarity}`,
                ),
              ),
            }),
            o("div", {
              class: "chest-hint",
              children:
                He(ne).luck > 0
                  ? `高品质词条概率 +${Math.round(He(ne).luck * 100)}%`
                  : "刷新可能出现更高级的词条",
            }),
            o("div", {
              class: "chest-btns",
              children: [
                l.s.freeLeft > 0
                  ? o(C, {
                      color: "blue",
                      onClick: () => Wn(l.s),
                      children: [
                        "免费刷新",
                        o("small", {
                          children: ["剩余 ", l.s.freeLeft, " 次"],
                        }),
                      ],
                    })
                  : o(C, {
                      color: "blue",
                      disabled: l.s.paidLeft <= 0,
                      onClick: () => Wn(l.s),
                      children: [
                        o("span", {
                          children: [
                            o(S, { id: "gem", size: 1 }),
                            " ",
                            Lr,
                            " 刷新",
                          ],
                        }),
                        o("small", {
                          children: ["剩余 ", l.s.paidLeft, " 次"],
                        }),
                      ],
                    }),
                o(C, {
                  color: "yellow",
                  disabled: l.s.freeLeft > 0 || (Re?.takeAllUsed ?? 0) >= $r,
                  onClick: () => De(l.s),
                  children: [
                    o("span", {
                      children: [
                        o(S, { id: "gem", size: 1 }),
                        " ",
                        zr,
                        " 获得全部",
                      ],
                    }),
                    o("small", {
                      children:
                        l.s.freeLeft > 0
                          ? "免费刷新后可用"
                          : `本局剩余 ${$r - (Re?.takeAllUsed ?? 0)} 次`,
                    }),
                  ],
                }),
              ],
            }),
            o($i, { b: Re }),
          ],
        }),
      l.t === "revive" &&
        Re &&
        o("div", {
          class: "ov ov-revive",
          children: o("div", {
            class: "revive-card",
            children: [
              o("div", {
                class: "revive-hero",
                children: o(Se, { heroId: ne.hero, size: 6 }),
              }),
              o("div", { class: "ribbon", children: "复活" }),
              o("div", {
                class: "revive-text",
                children: ["只差 ", o("b", { children: [Zi, "%"] }), " 通关"],
              }),
              o("div", {
                class: "hud-bar big",
                children: [
                  o("div", {
                    class: "hud-fill",
                    style: { width: `${i.pct}%` },
                  }),
                  o("span", { children: [i.pct, "%"] }),
                ],
              }),
              o("div", {
                class: "revive-sub",
                children: "复活后大幅度击退病毒",
              }),
              o("div", {
                class: "row-btns",
                children: [
                  o(C, {
                    color: "yellow",
                    big: !0,
                    onClick: Yi,
                    children: [
                      o("span", {
                        children:
                          Re.reviveCost() === 0
                            ? "免费复活"
                            : o(re, {
                                children: [
                                  o(S, { id: "gem", size: 1.1 }),
                                  " ",
                                  Re.reviveCost(),
                                  " 复活",
                                ],
                              }),
                      }),
                      o("small", { children: ["剩余次数 ×", 3 - Re.revives] }),
                    ],
                  }),
                  o(C, {
                    color: "gray",
                    big: !0,
                    onClick: () => Ce(!1),
                    children: "放弃复活",
                  }),
                ],
              }),
            ],
          }),
        }),
      l.t === "pause" &&
        o("div", {
          class: "ov ov-pause",
          children: o("div", {
            class: "panel pause-card",
            children: [
              o("div", { class: "ribbon", children: "暂停" }),
              o('div', {class:'game-title notranslate',lang:'en',translate:'no',children:TITLE}),
              o(LanguageRow, {}),
              o($i, { b: Re, detail: !0 }),
              o("div", {
                class: "row-btns",
                children: [
                  o(C, {
                    color: "gray",
                    small: !0,
                    onClick: () => {
                      ((ne.settings.sfx = !ne.settings.sfx),
                        Ge(ne.settings.sfx, ne.settings.music),
                        Dn.value++,
                        v((R) => R + 1));
                    },
                    children: ["音效：", ne.settings.sfx ? "开" : "关"],
                  }),
                  o(C, {
                    color: "gray",
                    small: !0,
                    onClick: () => {
                      ((ne.settings.music = !ne.settings.music),
                        Ge(ne.settings.sfx, ne.settings.music),
                        Dn.value++,
                        v((R) => R + 1));
                    },
                    children: ["音乐：", ne.settings.music ? "开" : "关"],
                  }),
                ],
              }),
              o("div", {
                class: "row-btns",
                children: [
                  o(C, {
                    color: "red",
                    onClick: () => Ce(!1),
                    children: "退出战斗",
                  }),
                  o(C, {
                    color: "green",
                    onClick: () => c({ t: "none" }),
                    children: "继续战斗",
                  }),
                ],
              }),
            ],
          }),
        }),
      l.t === "result" &&
        o("div", {
          class: "ov ov-result",
          children: o("div", {
            class: `result-card ${l.won ? "win" : "lose"}`,
            children: [
              o("div", {
                class: "ribbon",
                children: l.won ? "胜利！" : "战斗结束",
              }),
              o("div", {
                class: "result-hero",
                children: o(Se, { heroId: ne.hero, size: 6, happy: l.won }),
              }),
              o("div", {
                class: "result-stats",
                children: [
                  o("div", {
                    children: [
                      o("span", { children: "生存进度" }),
                      o("b", {
                        children: [Math.floor(l.summary.progress * 100), "%"],
                      }),
                    ],
                  }),
                  o("div", {
                    children: [
                      o("span", { children: "消灭病毒" }),
                      o("b", { children: l.summary.kills }),
                    ],
                  }),
                  o("div", {
                    children: [
                      o("span", { children: "战斗时长" }),
                      o("b", { children: Ke(l.summary.time) }),
                    ],
                  }),
                ],
              }),
              l.settle.newBest &&
                !l.won &&
                o("div", { class: "result-note", children: "新的最高进度！" }),
              l.settle.firstClear &&
                o("div", {
                  class: "result-note",
                  children: "首次通关！额外钻石奖励",
                }),
              l.settle.unlockedWeapon &&
                o("div", {
                  class: "result-note",
                  children: [
                    "解锁新武器：",
                    I[l.settle.unlockedWeapon].name,
                    "（已自动上阵）",
                  ],
                }),
              o(ae, { reward: l.settle.reward }),
              o(ds, { top: l.summary.top }),
              o("div", {
                class: "row-btns",
                children: o(C, {
                  color: l.won ? "green" : "yellow",
                  big: !0,
                  onClick: () => e({}),
                  children: "返回",
                }),
              }),
            ],
          }),
        }),
    ],
  });
}
function $i({ b: e, detail: t }) {
  return e
    ? o("div", {
        class: `owned ${t ? "detail" : ""}`,
        children: [
          e.weapons.map((r) =>
            o(
              "div",
              {
                class: `owned-w r${I[r.id].rarity} ${r.awakened ? "awk" : ""}`,
                children: [
                  o(S, { id: `weapon_${r.id}`, size: t ? 2.2 : 1.7 }),
                  t && o("b", { children: I[r.id].name }),
                  o("em", { children: r.awakened ? "觉醒" : `+${r.ups}` }),
                ],
              },
              r.id,
            ),
          ),
          t &&
            o("div", {
              class: "owned-glob muted",
              children: [
                e.run.allDmg > 0 &&
                  o("span", {
                    children: [
                      zt.allDmg.name,
                      " +",
                      Math.round(e.run.allDmg * 100),
                      "%",
                    ],
                  }),
                e.run.crit > 0 &&
                  o("span", {
                    children: ["暴击率 +", Math.round(e.run.crit * 100), "%"],
                  }),
                e.run.critDmg > 0 &&
                  o("span", {
                    children: ["暴伤 +", Math.round(e.run.critDmg * 100), "%"],
                  }),
                e.run.allRate > 0 &&
                  o("span", {
                    children: ["攻速 +", Math.round(e.run.allRate * 100), "%"],
                  }),
                e.run.slow > 0 &&
                  o("span", {
                    children: ["病毒减速 ", Math.round(e.run.slow * 100), "%"],
                  }),
              ],
            }),
        ],
      })
    : null;
}
function ds({ top: e }) {
  let t = Math.max(1, ...e.map((r) => r.dealt));
  return o("div", {
    class: "dmg-list",
    children: e
      .slice(0, 5)
      .map((r) =>
        o(
          "div",
          {
            class: "dmg-row",
            children: [
              o(S, { id: `weapon_${r.id}`, size: 1.5 }),
              o("span", { class: "dmg-name", children: I[r.id].name }),
              o("div", {
                class: "dmg-bar",
                children: o("div", {
                  style: {
                    width: `${(r.dealt / t) * 100}%`,
                    background: H[I[r.id].rarity],
                  },
                }),
              }),
              o("b", { children: W(r.dealt) }),
            ],
          },
          r.id,
        ),
      ),
  });
}
function Wi() {
  let e = () => {
    let t = N(),
      r = Ze.every((a) => t.daily.claimed & (1 << a.id));
    return o(te, {
      title: "每日任务",
      class: "modal-daily",
      children: [
        o("div", {
          class: "task-list",
          children: [
            Ze.map((a) => {
              let n = Math.min(a.goal, a.value(t)),
                i = !!(t.daily.claimed & (1 << a.id));
              return o(
                "div",
                {
                  class: "task",
                  children: [
                    o("div", {
                      class: "task-main",
                      children: [
                        o("b", { children: a.name }),
                        o(xt, {
                          value: n,
                          max: a.goal,
                          label: `${n}/${a.goal}`,
                        }),
                      ],
                    }),
                    o(ae, { reward: a.reward, small: !0 }),
                    i
                      ? o("span", { class: "tag-green", children: "已领取" })
                      : o(C, {
                          small: !0,
                          color: n >= a.goal ? "green" : "gray",
                          disabled: n < a.goal,
                          onClick: () => {
                            let s = bn(t, a.id);
                            s && (M("coin"), P(!0), ie("任务奖励", s));
                          },
                          children: "领取",
                        }),
                  ],
                },
                a.id,
              );
            }),
            o("div", {
              class: "task task-all",
              children: [
                o("div", {
                  class: "task-main",
                  children: [
                    o("b", { children: "完成全部任务" }),
                    o("span", { class: "muted", children: "额外奖励" }),
                  ],
                }),
                o(ae, { reward: hr, small: !0 }),
                t.daily.claimed & 16
                  ? o("span", { class: "tag-green", children: "已领取" })
                  : o(C, {
                      small: !0,
                      color: r ? "green" : "gray",
                      disabled: !r,
                      onClick: () => {
                        let a = bn(t, 4);
                        a && (M("coin"), P(!0), ie("全部完成", a));
                      },
                      children: "领取",
                    }),
              ],
            }),
          ],
        }),
        o("p", { class: "muted center-text", children: "每日 0 点刷新" }),
      ],
    });
  };
  Z(() => o(e, {}));
}
function Bi() {
  let e = () => {
    let t = N(),
      r = t.signCount % 7,
      a = t.daily.signed ? (t.signCount - 1) % 7 : r;
    return o(te, {
      title: "七日签到",
      class: "modal-sign",
      children: [
        o("div", {
          class: "sign-grid",
          children: br.map((n, i) => {
            let s = t.daily.signed ? i <= a : i < r,
              l = !t.daily.signed && i === r;
            return o(
              "div",
              {
                class: `sign-day ${s ? "done" : ""} ${l ? "today" : ""} ${i === 6 ? "big" : ""}`,
                children: [
                  o("span", { class: "sign-n", children: ["第", i + 1, "天"] }),
                  o(ae, { reward: n, small: !0 }),
                  s && o("span", { class: "sign-check", children: "✓" }),
                ],
              },
              i,
            );
          }),
        }),
        o(C, {
          big: !0,
          disabled: t.daily.signed,
          onClick: () => {
            let n = Aa(t);
            if (!n) return A("今天已经签到过了");
            (M("coin"), P(!0), ie("签到奖励", n));
          },
          children: t.daily.signed ? "明天再来" : "签到",
        }),
      ],
    });
  };
  Z(() => o(e, {}));
}
function Vt() {
  let e = () => {
    let t = N(),
      [r, a] = he(null),
      [n, i] = he(!1),
      s = () => {
        if (t.keyGold < 1) return A("密宝钥匙不足（可在商店购买）");
        (i(!0),
          M("open"),
          setTimeout(() => {
            let l = Ra(
              t,
              new be((Date.now() ^ (t.stats.battles * 7919)) >>> 0),
            );
            (i(!1), a(l), l?.hero ? M("win") : M("coin"), P(!0));
          }, 900));
      };
    return o(te, {
      title: "英雄密宝",
      class: "modal-vault",
      children: [
        o("div", {
          class: "vault-stage",
          children: n
            ? o("div", {
                class: "vault-spin",
                children: o(S, { id: "vault", size: 6 }),
              })
            : r?.hero
              ? o("div", {
                  class: "vault-hero",
                  style: { borderColor: H[D[r.hero].rarity] },
                  children: [
                    o(Se, { heroId: r.hero, size: 7, happy: !0 }),
                    o("b", { children: D[r.hero].name }),
                    o("span", {
                      children: r.dup
                        ? r.reward
                          ? "已满星，转化为钻石"
                          : "重复获得 · 星级+1"
                        : "新英雄！",
                    }),
                    r.reward && o(ae, { reward: r.reward, small: !0 }),
                  ],
                })
              : r?.reward
                ? o("div", {
                    class: "vault-hero",
                    children: [
                      o(ae, { reward: r.reward }),
                      o("span", {
                        children: [
                          "再抽 ",
                          Math.max(1, 6 - t.pity),
                          " 次内必出英雄！",
                        ],
                      }),
                    ],
                  })
                : o("div", {
                    class: "vault-pool",
                    children: ve.map((l) =>
                      o(
                        "div",
                        {
                          class: "vault-cell",
                          style: { borderColor: H[l.rarity] },
                          children: [
                            o(Se, {
                              heroId: l.id,
                              size: 3.2,
                              silhouette: !t.heroes[l.id],
                            }),
                            o("span", {
                              style: { color: H[l.rarity] },
                              children: Me[l.rarity],
                            }),
                          ],
                        },
                        l.id,
                      ),
                    ),
                  }),
        }),
        o("p", {
          class: "muted center-text",
          children: [
            "每次消耗 1 把密宝钥匙 · 最多 6 次必出英雄（已抽 ",
            t.pity,
            " 次）· 重复英雄提升星级（最高 ",
            lr,
            " 星）",
          ],
        }),
        o("div", {
          class: "row-btns",
          children: o(C, {
            big: !0,
            disabled: n || t.keyGold < 1,
            onClick: s,
            children: [
              o(S, { id: "keyGold", size: 1.4 }),
              " 开启 ×1（拥有 ",
              t.keyGold,
              "）",
            ],
          }),
        }),
      ],
    });
  };
  Z(() => o(e, {}));
}
function Oi() {
  let e = N(),
    t = He(e),
    r = Ae(e),
    a = ht(r),
    n = vr(e),
    i = Dt.find(([f]) => f > r),
    s = r + 1;
  for (; !yr(s) && s < r + 10; ) s++;
  let l = yr(s),
    c = ve.find((f) => f.id === e.hero),
    d = e.heroes[e.hero]?.stars ?? 0,
    u = (f) => {
      let p = Sa(e, f);
      if (!p.ok) return A("金币不足");
      (M("up"),
        (e.tut.hero = !0),
        P(),
        p.reward && ie(`英雄 Lv.${Ae(e)} 奖励`, p.reward));
      let h = Ae(e),
        v = Dt.find(([g]) => g === h);
      v && A(`解锁被动：${pt[v[1]].name}`);
    },
    m = [
      {
        id: "atk",
        icon: "atk",
        name: "攻击力",
        value: W(t.atk),
        next: `基础攻击 +${cr}`,
      },
      {
        id: "crit",
        icon: "crit",
        name: "暴击",
        value: `${Ye(t.crit, 1)} / ${Ye(t.critDmg)}`,
        next: `暴击率 +${Ye(fr, 1)} 暴伤 +${Ye(ur)}`,
      },
      {
        id: "rate",
        icon: "rate",
        name: "攻速",
        value: `+${Ye(t.rate, 1)}`,
        next: `攻速 +${Ye(mr, 1)}`,
      },
    ];
  return o("div", {
    class: "screen hero-screen",
    children: [
      o("div", {
        class: "hero-head panel",
        children: [
          o("div", {
            class: "hero-portrait",
            style: { borderColor: H[c.rarity] },
            children: [
              o(Se, { heroId: e.hero, size: 7.5 }),
              o("div", {
                class: "stars",
                children: Array.from({ length: 5 }, (f, p) =>
                  o("span", { class: p < d ? "on" : "", children: "★" }, p),
                ),
              }),
            ],
          }),
          o("div", {
            class: "hero-info",
            children: [
              o("div", {
                class: "hero-name",
                children: [c.name, " ", o("small", { children: c.title })],
              }),
              o("div", { class: "hero-lv", children: ["Lv.", r] }),
              o("div", {
                class: "hero-pow",
                children: [
                  o(S, { id: "power", size: 1.2 }),
                  " 战斗力 ",
                  o("b", { children: W(wt(e)) }),
                ],
              }),
              o("div", {
                class: "muted",
                children: ["专属武器：", I[c.weapon].name],
              }),
              o("div", {
                class: "muted",
                children: [
                  "天赋：",
                  c.bonusText,
                  d ? `，星级攻击 +${Math.round(d * $t * 100)}%` : "",
                ],
              }),
            ],
          }),
        ],
      }),
      o("div", {
        class: "panel stat-panel",
        children: [
          o("div", {
            class: "panel-title",
            children: [
              "属性加点 ",
              o("span", {
                class: "muted",
                children: "（任意加一点，英雄升一级）",
              }),
            ],
          }),
          m.map((f) =>
            o(
              "div",
              {
                class: "stat-row",
                children: [
                  o(S, { id: f.icon, size: 2 }),
                  o("div", {
                    class: "stat-main",
                    children: [
                      o("b", { children: f.name }),
                      o("span", { class: "stat-val", children: f.value }),
                      o("span", { class: "muted", children: f.next }),
                    ],
                  }),
                  o(C, {
                    small: !0,
                    color: e.gold >= a ? "green" : "gray",
                    onClick: () => u(f.id),
                    children: [o(S, { id: "gold", size: 1 }), " ", W(a)],
                  }),
                ],
              },
              f.id,
            ),
          ),
          l &&
            o("div", {
              class: "next-reward",
              children: [
                o("span", { children: ["Lv.", s, " 奖励"] }),
                o(ae, { reward: l, small: !0 }),
              ],
            }),
        ],
      }),
      o("div", {
        class: "panel",
        children: [
          o("div", {
            class: "panel-title",
            children: [
              "被动技能 ",
              o("span", { class: "muted", children: "（可重复获得并叠加）" }),
            ],
          }),
          o("div", {
            class: "passives",
            children: Object.keys(pt).map((f) =>
              o(
                "div",
                {
                  class: `passive ${n[f] ? "on" : ""}`,
                  children: [
                    o("b", {
                      children: [
                        pt[f].name,
                        n[f] > 0 && o("em", { children: ["×", n[f]] }),
                      ],
                    }),
                    o("span", { children: pt[f].text }),
                  ],
                },
                f,
              ),
            ),
          }),
          i &&
            o("div", {
              class: "muted center-text",
              children: ["Lv.", i[0], " 解锁：", pt[i[1]].name],
            }),
        ],
      }),
      o("div", {
        class: "panel",
        children: [
          o("div", {
            class: "panel-title",
            children: [
              "英雄 ",
              o(C, {
                small: !0,
                color: "purple",
                onClick: Vt,
                style: { marginLeft: "auto" },
                children: [
                  o(S, { id: "keyGold", size: 1 }),
                  " 英雄密宝 (",
                  e.keyGold,
                  ")",
                ],
              }),
            ],
          }),
          o("div", {
            class: "roster",
            children: ve.map((f) => {
              let p = e.heroes[f.id],
                h = e.hero === f.id;
              return o(
                "div",
                {
                  class: `roster-cell ${h ? "on" : ""} ${p ? "" : "locked"}`,
                  style: { borderColor: H[f.rarity] },
                  onClick: () => cs(f.id),
                  children: [
                    o(Se, { heroId: f.id, size: 3.6, silhouette: !p }),
                    o("b", { children: f.name }),
                    o("span", {
                      style: { color: H[f.rarity] },
                      children: Me[f.rarity],
                    }),
                    h && o("em", { class: "tag-green", children: "出战" }),
                  ],
                },
                f.id,
              );
            }),
          }),
        ],
      }),
    ],
  });
}
function cs(e) {
  let t = () => {
    let r = N(),
      a = ve.find((i) => i.id === e),
      n = r.heroes[e];
    return o(te, {
      title: a.name,
      children: [
        o("div", {
          class: "hero-detail",
          children: [
            o(Se, { heroId: e, size: 8, silhouette: !n, happy: !!n }),
            o("div", { class: "muted", children: a.title }),
            o("div", {
              children: [
                "品质：",
                o("b", {
                  style: { color: H[a.rarity] },
                  children: Me[a.rarity],
                }),
              ],
            }),
            o("div", {
              children: ["专属武器：", I[a.weapon].name, "（开局自带）"],
            }),
            o("div", { children: ["天赋：", a.bonusText] }),
            n &&
              o("div", {
                children: [
                  "星级：",
                  n.stars,
                  " / 5（每星攻击 +",
                  Math.round($t * 100),
                  "%）",
                ],
              }),
          ],
        }),
        n
          ? o(C, {
              big: !0,
              color: r.hero === e ? "gray" : "green",
              disabled: r.hero === e,
              onClick: () => {
                ((r.hero = e), P(), le(), A(`${a.name} 出战！`));
              },
              children: r.hero === e ? "出战中" : "设为出战",
            })
          : o(C, {
              big: !0,
              color: "purple",
              onClick: Vt,
              children: "去英雄密宝抽取",
            }),
      ],
    });
  };
  Z(() => o(t, {}));
}
function fs(e, t, r, a, n, i) {
  let s = e.createLinearGradient(0, 0, 0, r);
  (s.addColorStop(0, "#7fd8ff"),
    s.addColorStop(0.7, "#c9f3ff"),
    s.addColorStop(1, "#e9fbff"),
    (e.fillStyle = s),
    e.fillRect(0, 0, t, r),
    (e.fillStyle = "rgba(255,255,255,0.9)"));
  for (let u = 0; u < 4; u++) {
    let m = ((u * 0.31 + a * 0.012 * (1 + u * 0.3)) % 1.3) * t * 1.1 - t * 0.15,
      f = r * (0.12 + u * 0.07);
    for (let [p, h, v] of [
      [0, 0, 0.05],
      [0.05, -0.02, 0.06],
      [0.1, 0, 0.045],
    ])
      (e.beginPath(),
        e.arc(m + p * t, f + h * t, v * t, 0, Math.PI * 2),
        e.fill());
  }
  e.fillStyle = "#9fd0e8";
  for (let u = 0; u < 9; u++) {
    let m = t * 0.11,
      f = r * (0.18 + ((u * 37) % 5) * 0.045);
    e.fillRect(u * t * 0.115 - t * 0.02, r * 0.68 - f, m, f);
  }
  e.fillStyle = "rgba(255,255,255,0.5)";
  for (let u = 0; u < 9; u++) {
    let m = r * (0.18 + ((u * 37) % 5) * 0.045);
    for (let f = 0; f < 3; f++)
      e.fillRect(
        u * t * 0.115 + t * 0.01,
        r * 0.68 - m + r * 0.03 + f * r * 0.05,
        t * 0.025,
        r * 0.025,
      );
  }
  let l = e.createLinearGradient(0, r * 0.66, 0, r);
  (l.addColorStop(0, "#8fdc6a"),
    l.addColorStop(1, "#5cb84a"),
    (e.fillStyle = l),
    e.beginPath(),
    e.moveTo(0, r * 0.7),
    e.quadraticCurveTo(t * 0.5, r * 0.62, t, r * 0.7),
    e.lineTo(t, r),
    e.lineTo(0, r),
    e.fill(),
    (e.fillStyle = "#e8d7a8"),
    e.beginPath(),
    e.ellipse(t * 0.5, r * 0.9, t * 0.42, r * 0.1, 0, 0, Math.PI * 2),
    e.fill());
  let c = e.createRadialGradient(
    t * 0.5,
    r * 0.4,
    10,
    t * 0.5,
    r * 0.4,
    t * 0.45,
  );
  (c.addColorStop(0, U(n, 80, 60, 0.35)),
    c.addColorStop(1, U(n, 80, 60, 0)),
    (e.fillStyle = c),
    e.fillRect(0, 0, t, r));
  let d = Math.sin(a * 1.8) * r * 0.02;
  for (let u = 0; u < 5; u++) {
    let m = a * 0.8 + (u * Math.PI * 2) / 5;
    Ne(
      e,
      n + 10,
      t * 0.5 + Math.cos(m) * t * 0.3,
      r * 0.4 + Math.sin(m) * r * 0.1 + d,
      t * 0.045,
      !1,
      u,
    );
  }
  (Ne(e, n, t * 0.5, r * 0.4 + d, t * 0.15, !0, 3),
    rt(e, D[i] ?? D.amian, t * 0.5, r * 0.82, t * 0.09, {
      t: a,
      look: -Math.PI / 2,
    }));
}
function us({ hue: e, heroId: t }) {
  let r = se(null);
  return (
    ke(() => {
      let a = r.current,
        n = Math.min(2, window.devicePixelRatio || 1),
        i = 0,
        s = performance.now(),
        l = () => {
          let c = a.clientWidth,
            d = a.clientHeight;
          (a.width !== Math.round(c * n) || a.height !== Math.round(d * n)) &&
            ((a.width = Math.round(c * n)), (a.height = Math.round(d * n)));
          let u = a.getContext("2d");
          (u.setTransform(n, 0, 0, n, 0, 0),
            fs(u, c, d, (performance.now() - s) / 1e3, e, t),
            (i = requestAnimationFrame(l)));
        };
      return (l(), () => cancelAnimationFrame(i));
    }, [e, t]),
    o("canvas", { ref: r, class: "scene" })
  );
}
function ms() {
  let e = () => {
    let t = N(),
      r = $e.value,
      a = Qe(t, r),
      n = mn(t),
      i = pn(t, r);
    return o(te, {
      title: "挂机宝箱",
      class: "modal-idle",
      children: [
        o("div", {
          class: "idle-top",
          children: [
            o(S, { id: "idle", size: 5 }),
            o("div", {
              children: [
                o("div", { class: "idle-time", children: ["已挂机 ", Ke(a)] }),
                o("div", {
                  class: "muted",
                  children: [
                    "最多累积 ",
                    Wt / 3600,
                    " 小时 · 宝箱品质 Lv.",
                    n.quality + 1,
                  ],
                }),
                o("div", {
                  class: "muted",
                  children: [
                    "每分钟 ",
                    n.goldMin,
                    " 金币 · 每小时 ",
                    n.fragHour.toFixed(1),
                    " 绿色碎片",
                  ],
                }),
              ],
            }),
          ],
        }),
        o(ae, { reward: i }),
        o("p", {
          class: "muted center-text",
          children: "领取次数越多，挂机宝箱品质越高",
        }),
        o(C, {
          big: !0,
          disabled: a < 60,
          onClick: () => {
            let s = wa(t, Date.now());
            if (!s) return A("再挂机一会儿吧");
            (M("coin"), P(!0), le(), ie("挂机收益", s));
          },
          children: "领取",
        }),
      ],
    });
  };
  Z(() => o(e, {}));
}
function Gi(e) {
  let t = () => {
    let r = N();
    return o(te, {
      title: "关卡选择",
      class: "modal-chapters",
      children: [
        o("div", {
          class: "diff-row",
          children: ue.map((a, n) =>
            o(
              "button",
              {
                class: `diff-chip ${r.diff === n ? "on" : ""} ${yt(r, 1, n) ? "" : "locked"}`,
                onClick: () => {
                  if (!yt(r, 1, n))
                    return A(`通关普通难度第1章后解锁${a.name}`);
                  ((r.diff = n),
                    yt(r, r.chapter, n) ||
                      (r.chapter = Math.max(
                        1,
                        Math.min(r.chapter, r.clearedDiff[n] + 1),
                      )),
                    P());
                },
                children: a.name,
              },
              n,
            ),
          ),
        }),
        o("div", {
          class: "chapter-list",
          children: X.map((a) => {
            let n = yt(r, a.id, r.diff),
              i = r.best[Oe(a.id, r.diff)] ?? 0,
              s = r.clearedDiff[r.diff] >= a.id;
            return o(
              "div",
              {
                class: `chapter-item ${n ? "" : "locked"} ${r.chapter === a.id ? "cur" : ""}`,
                onClick: () => {
                  if (!n) return A("请先通关上一章");
                  ((r.chapter = a.id), P(), le());
                },
                children: [
                  o("div", {
                    class: "ci-virus",
                    children: n
                      ? o(S, { id: `virus_${a.hue}`, size: 2.6 })
                      : o(S, { id: "lock", size: 2 }),
                  }),
                  o("div", {
                    class: "ci-main",
                    children: [
                      o("b", { children: ["第", a.id, "章 ", a.name] }),
                      o("span", {
                        class: "muted",
                        children: ["推荐战力 ", W(Rn(a.id, r.diff))],
                      }),
                    ],
                  }),
                  o("div", {
                    class: "ci-best",
                    children: s
                      ? o("span", { class: "tag-green", children: "已通关" })
                      : n
                        ? `${i}%`
                        : "",
                  }),
                ],
              },
              a.id,
            );
          }),
        }),
      ],
    });
  };
  Z(() => o(t, {}));
}
function Hi({ onStart: e }) {
  let t = N(),
    r = $e.value,
    a = X[t.chapter - 1] ?? X[0],
    n = Oe(t.chapter, t.diff),
    i = t.best[n] ?? 0,
    s = t.miles[n] ?? 0,
    l = Rn(t.chapter, t.diff),
    c = wt(t),
    d = Qe(t, r),
    u = wr(t),
    m = t.chapter > 1,
    f = yt(t, t.chapter + 1, t.diff),
    p = (x) => {
      let Q = Oe(x, t.diff),
        q = t.best[Q] ?? 0,
        de = t.miles[Q] ?? 0;
      return (
        (q >= 25 && !(de & 1)) ||
        (q >= 50 && !(de & 2)) ||
        (q >= 100 && !(de & 4))
      );
    },
    h = X.some((x) => x.id < t.chapter && p(x.id)),
    v = X.some((x) => x.id > t.chapter && p(x.id)),
    g = f && t.clearedDiff[t.diff] >= t.chapter,
    _ = [
      [25, 0],
      [50, 1],
      [100, 2],
    ],
    k = (x) => {
      let Q = [25, 50, 100][x];
      if (i < Q) {
        Z(() =>
          o(te, {
            title: `进度 ${Q}% 宝箱`,
            children: [
              o("p", {
                class: "center-text",
                children: ["最高生存进度达到 ", Q, "% 即可领取"],
              }),
              o(ae, { reward: un(t.chapter, t.diff, x) }),
              o(C, { onClick: le, children: "知道了" }),
            ],
          }),
        );
        return;
      }
      let q = za(t, t.chapter, t.diff, x);
      q && (M("open"), P(!0), ie(`${Q}% 进度宝箱`, q));
    };
  return o("div", {
    class: "home",
    children: [
      o('div',{class:'game-title notranslate',lang:'en',translate:'no',children:TITLE}),
      o("div", {
        class: "chapter-card",
        children: [
          o("button", {
            class: "arrow",
            disabled: !m,
            onClick: () => m && ((t.chapter -= 1), P(), M("click")),
            children: ["‹", o(Ue, { show: h })],
          }),
          o("div", {
            class: "chapter-mid",
            onClick: () => Gi(t),
            children: [
              o("div", {
                class: "chapter-name",
                children: ["第", a.id, "章 · ", a.name],
              }),
              o("div", {
                class: "chapter-sub",
                children: [
                  o("span", {
                    class: `diff-tag d${t.diff}`,
                    children: ue[t.diff].name,
                  }),
                  o("span", {
                    class: `rec ${c >= l ? "ok" : "low"}`,
                    children: ["推荐战力 ", W(l)],
                  }),
                ],
              }),
            ],
          }),
          o("button", {
            class: `arrow ${g ? "pulse" : ""}`,
            disabled: !f,
            onClick: () => f && ((t.chapter += 1), P(), M("click")),
            children: [
              "›",
              o(Ue, { show: v }),
              g && o("em", { class: "arrow-new", children: "下一章" }),
            ],
          }),
        ],
      }),
      o("div", {
        class: "scene-wrap",
        children: [
          o(us, { hue: a.hue, heroId: t.hero }),
          o("div", { class: "quote", children: a.quote }),
          o("div", {
            class: "side side-l",
            children: [
              o("button", {
                class: "side-btn",
                onClick: () => Gi(t),
                children: [
                  o(S, { id: `virus_${a.hue}`, size: 2.2 }),
                  o("span", { children: "关卡选择" }),
                ],
              }),
            ],
          }),
          o("div", {
            class: "side side-r",
            children: [
              o("button", {
                class: "side-btn",
                onClick: () => Vt(),
                children: [
                  o(S, { id: "vault", size: 2.2 }),
                  o("span", { children: "英雄密宝" }),
                  o(Ue, { show: t.keyGold > 0, n: t.keyGold }),
                ],
              }),
            ],
          }),
        ],
      }),
      o("div", {
        class: "miles",
        children: [
          o("div", {
            class: "miles-label",
            children: ["最高生存进度：", o("b", { children: [i, "%"] })],
          }),
          o("div", {
            class: "miles-track",
            children: [
              o("div", { class: "miles-fill", style: { width: `${i}%` } }),
              _.map(([x, Q]) => {
                let q = !!(s & (1 << Q)),
                  de = i >= x && !q;
                return o(
                  "button",
                  {
                    class: `mile ${de ? "ready" : ""} ${q ? "claimed" : ""}`,
                    style: { left: `${x === 100 ? 94 : x}%` },
                    onClick: () => k(Q),
                    children: [
                      o(S, { id: q ? "chestSilver" : "chestGold", size: 2.4 }),
                      o("span", { children: [x, "%"] }),
                    ],
                  },
                  x,
                );
              }),
            ],
          }),
        ],
      }),
      o("div", {
        class: "start-wrap",
        children: [
          o(C, {
            big: !0,
            class: "start-btn",
            onClick: e,
            children: "开始战斗",
          }),
          !t.tut.battle && o("div", { class: "finger", children: "👆" }),
        ],
      }),
    ],
  });
}
function Ni(e, t) {
  let r = [],
    a = (n, i = 0) =>
      `${Math.round(n * t * 100 * Math.pow(10, i)) / Math.pow(10, i)}%`;
  return (
    e.atkPct && r.push(`攻击力 +${a(e.atkPct, 1)}`),
    e.crit && r.push(`暴击率 +${a(e.crit, 1)}`),
    e.critDmg && r.push(`暴击伤害 +${a(e.critDmg)}`),
    e.rate && r.push(`攻速 +${a(e.rate, 1)}`),
    e.luck && r.push(`高品质词条概率 +${a(e.luck, 1)}`),
    e.reward && r.push(`战斗奖励 +${a(e.reward)}`),
    e.knock && r.push(`复活击退 +${a(e.knock)}`),
    e.wDmg &&
      r.push(`${I[e.wDmg[0]].name}伤害 +${Math.round(e.wDmg[1] * t * 100)}%`),
    r
  );
}
function ps(e) {
  if (!e.start) return null;
  let t = I[e.start.weapon].name;
  return e.start.count
    ? `${t}初始${I[e.start.weapon].countLabel} +${e.start.count}`
    : e.start.pierce
      ? `${t}初始穿透 +${e.start.pierce}`
      : null;
}
function Ui() {
  let e = N();
  return o("div", {
    class: "screen relics-screen",
    children: [
      o("div", {
        class: "panel relic-box-panel",
        children: [
          o(S, { id: "chestSilver", size: 4 }),
          o("div", {
            class: "rb-main",
            children: [
              o("b", { children: "藏品宝箱" }),
              o("span", { class: "muted", children: "随机获得藏品或藏品碎片" }),
              o("span", {
                children: [
                  o(S, { id: "keySilver", size: 1.2 }),
                  " 藏品钥匙 × ",
                  e.keySilver,
                ],
              }),
            ],
          }),
          o("div", {
            class: "rb-btns",
            children: [
              o(C, {
                small: !0,
                color: "blue",
                onClick: () => Fi(1),
                children: "开启 ×1",
              }),
              o(C, {
                small: !0,
                color: "purple",
                onClick: () => Fi(10),
                children: "开启 ×10",
              }),
            ],
          }),
        ],
      }),
      dr.map((t) => {
        let r = Ie.filter((n) => n.set === t.id),
          a = r.every((n) => (e.relics[n.id]?.lv ?? 0) > 0);
        return o(
          "div",
          {
            class: "panel set-panel",
            children: [
              o("div", {
                class: "panel-title",
                children: [
                  t.name,
                  o("span", {
                    class: a ? "set-on" : "muted",
                    children: [a ? "✓ " : "", "套装：", t.text],
                  }),
                ],
              }),
              o("div", {
                class: "relic-row",
                children: r.map((n) => {
                  let i = e.relics[n.id],
                    s = i?.lv ?? 0;
                  return o(
                    "button",
                    {
                      class: `relic r${n.rarity} ${s ? "" : "locked"}`,
                      onClick: () => hs(n),
                      children: [
                        s > 0 &&
                          vt(e, n.id) &&
                          o("span", { class: "dot up", children: "↑" }),
                        o("div", {
                          class: "relic-icon",
                          children: o(S, { id: `relic_${n.id}`, size: 2.8 }),
                        }),
                        o("b", { children: n.name }),
                        s > 0
                          ? o(re, {
                              children: [
                                o("span", {
                                  class: "wlv",
                                  children: ["Lv.", s],
                                }),
                                s < mt
                                  ? o(xt, {
                                      value: i.shards,
                                      max: Je(s),
                                      color: H[n.rarity],
                                      label: `${i.shards}/${Je(s)}`,
                                    })
                                  : o("span", {
                                      class: "tag-green",
                                      children: "满级",
                                    }),
                              ],
                            })
                          : o("span", { class: "muted", children: "未获得" }),
                      ],
                    },
                    n.id,
                  );
                }),
              }),
            ],
          },
          t.id,
        );
      }),
    ],
  });
}
function Fi(e) {
  let t = j();
  if (t.keySilver < e) {
    A(`藏品钥匙不足（需要 ${e} 把），进度宝箱、签到和商店都能获得`);
    return;
  }
  let r = Ca(t, e, new be((Date.now() * 31 + t.stats.chests) >>> 0));
  r &&
    (M("open"),
    P(!0),
    Z(() =>
      o(te, {
        title: "获得藏品",
        class: "modal-reward",
        children: o("div", {
          class: "relic-results",
          children: r.map((a, n) => {
            let i = Ie.find((s) => s.id === a);
            return o(
              "div",
              {
                class: `relic-res r${i.rarity}`,
                style: { animationDelay: `${n * 0.08}s` },
                children: [
                  o(S, { id: `relic_${a}`, size: 2.6 }),
                  o("b", { children: i.name }),
                  o("span", {
                    style: { color: H[i.rarity] },
                    children: Me[i.rarity],
                  }),
                ],
              },
              n,
            );
          }),
        }),
      }),
    ));
}
function hs(e) {
  let t = () => {
    let r = N(),
      a = r.relics[e.id],
      n = a?.lv ?? 0,
      i = ps(e);
    return o(te, {
      title: e.name,
      class: `r${e.rarity}`,
      children: [
        o("div", {
          class: "relic-detail",
          children: [
            o("div", {
              class: `relic-icon big r${e.rarity}`,
              children: o(S, { id: `relic_${e.id}`, size: 5 }),
            }),
            o("b", { style: { color: H[e.rarity] }, children: Me[e.rarity] }),
            o("p", { class: "muted", children: e.flavor }),
            o("div", {
              class: "relic-eff",
              children: [
                o("div", {
                  children: [
                    o("em", { children: ["当前 Lv.", n] }),
                    (n ? Ni(e.per, n) : ["未获得"]).map((s) =>
                      o("span", { children: s }, s),
                    ),
                    n > 0 && i && o("span", { children: i }),
                  ],
                }),
                n > 0 &&
                  n < mt &&
                  o("div", {
                    children: [
                      o("em", { children: ["下一级 Lv.", n + 1] }),
                      Ni(e.per, n + 1).map((s) =>
                        o("span", { children: s }, s),
                      ),
                    ],
                  }),
              ],
            }),
          ],
        }),
        n > 0 &&
          n < mt &&
          o(C, {
            big: !0,
            color: "green",
            disabled: !vt(r, e.id),
            onClick: () => {
              if (!Pa(r, e.id)) return A("碎片不足，多开藏品宝箱吧");
              (M("up"), P());
            },
            children: ["升级（", a.shards, "/", Je(n), "）"],
          }),
      ],
    });
  };
  Z(() => o(t, {}));
}
function je(e) {
  return o("div", {
    class: `shop-item ${e.disabled ? "sold" : ""}`,
    children: [
      e.tag && o("em", { class: "shop-tag", children: e.tag }),
      o(S, { id: e.icon, size: 3.4 }),
      o("b", { children: e.name }),
      o("span", { class: "muted", children: e.desc }),
      o(C, {
        small: !0,
        color: e.disabled ? "gray" : "green",
        disabled: e.disabled,
        onClick: e.onBuy,
        children: e.price,
      }),
    ],
  });
}
var It = (e) => o(re, { children: [o(S, { id: "gem", size: 1 }), " ", e] });
function ji() {
  let e = N(),
    t = () => new be((Date.now() ^ (e.gems * 131)) >>> 0),
    r = () => A("钻石不足");
  return o("div", {
    class: "screen shop-screen",
    children: [
      o("div", {
        class: "panel",
        children: [
          o("div", { class: "panel-title", children: "武器宝箱" }),
          o("div", {
            class: "shop-grid",
            children: [
              o(je, {
                icon: "boxBlue",
                name: "蓝色武器箱",
                desc: "绿/蓝碎片，小概率开出新武器",
                price: It(z.blueBoxGems),
                onBuy: () => {
                  let a = _r(e, "blue", t());
                  if (!a) return r();
                  (M("open"), P(!0), ie("蓝色武器箱", a));
                },
              }),
              o(je, {
                icon: "boxPurple",
                name: "紫色武器箱",
                desc: `高级碎片，概率开出新武器（今日 ${z.purpleBoxPerDay - e.daily.purpleBox}）`,
                tag: "超值",
                price: It(z.purpleBoxGems),
                disabled: e.daily.purpleBox >= z.purpleBoxPerDay,
                onBuy: () => {
                  let a = _r(e, "purple", t());
                  if (!a)
                    return e.gems < z.purpleBoxGems ? r() : A("今日次数已用完");
                  (M("open"), P(!0), ie("紫色武器箱", a));
                },
              }),
            ],
          }),
        ],
      }),
      o("div", {
        class: "panel",
        children: [
          o("div", { class: "panel-title", children: "钥匙" }),
          o("div", {
            class: "shop-grid",
            children: [
              o(je, {
                icon: "keySilver",
                name: "藏品钥匙",
                desc: "开启藏品宝箱",
                price: It(z.silverKeyGems),
                onBuy: () => {
                  if (!hn(e, "silver")) return r();
                  (M("coin"), P(!0), A("藏品钥匙 +1"));
                },
              }),
              o(je, {
                icon: "keyGold",
                name: "密宝钥匙",
                desc: "开启英雄密宝",
                price: It(z.goldKeyGems),
                onBuy: () => {
                  if (!hn(e, "gold")) return r();
                  (M("coin"), P(!0), A("密宝钥匙 +1"));
                },
              }),
            ],
          }),
        ],
      }),
      o("div", {
        class: "panel",
        children: [
          o("div", { class: "panel-title", children: "金币商店" }),
          o("div", {
            class: "shop-grid",
            children: z.goldPacks.map((a, n) =>
              o(
                je,
                {
                  icon: "gold",
                  name: `${W(Ot(e, a.mult))} 金币`,
                  desc: n === 2 ? "最划算" : n === 1 ? "常用" : "小袋",
                  tag: n === 2 ? "推荐" : void 0,
                  price: It(a.gems),
                  onBuy: () => {
                    let i = xa(e, n);
                    if (!i) return r();
                    (M("coin"), P(!0), A(`金币 +${W(i)}`));
                  },
                },
                n,
              ),
            ),
          }),
        ],
      }),
    ],
  });
}
function Xi() {
  let e = N(),
    t = Array.from({ length: Be }, (r, a) => e.loadout[a] ?? null);
  return o("div", {
    class: "screen weapons-screen",
    children: [
      o("div", {
        class: "panel",
        children: [
          o("div", {
            class: "panel-title",
            children: [
              "上阵武器 ",
              o("span", {
                class: "muted",
                children: [e.loadout.length, "/", Be],
              }),
            ],
          }),
          o("div", {
            class: "loadout",
            children: t.map((r, a) =>
              r
                ? o(
                    "button",
                    {
                      class: "slot",
                      style: { borderColor: H[I[r].rarity] },
                      onClick: () => qi(r),
                      children: [
                        o(S, { id: `weapon_${r}`, size: 2.4 }),
                        o("span", { children: ["Lv.", e.weapons[r]?.lv ?? 1] }),
                      ],
                    },
                    a,
                  )
                : o("div", { class: "slot empty", children: "+" }, a),
            ),
          }),
          o("p", {
            class: "muted small-text",
            children:
              "金色宝箱只会开出上阵的武器——根据战场类型搭配你的武器池！",
          }),
        ],
      }),
      o("div", {
        class: "frag-bar",
        children: e.frags.map((r, a) =>
          o(
            "div",
            {
              class: "frag",
              children: [
                o(S, { id: `frag${a}`, size: 1.3 }),
                o("span", { children: W(r) }),
              ],
            },
            a,
          ),
        ),
      }),
      o("div", {
        class: "weapon-grid",
        children: Te.map((r) => {
          let a = e.weapons[r.id],
            n = e.loadout.includes(r.id),
            i = a ? ct(r.rarity, a.lv) : 0;
          return o(
            "button",
            {
              class: `wcard r${r.rarity} ${a ? "" : "locked"}`,
              onClick: () => qi(r.id),
              children: [
                n && o("em", { class: "wtag", children: "上阵" }),
                a &&
                  gt(e, r.id) &&
                  o("span", { class: "dot up", children: "↑" }),
                o("div", {
                  class: "wicon",
                  children: [
                    o(S, { id: `weapon_${r.id}`, size: 3 }),
                    !a && o(S, { id: "lock", size: 1.4, class: "wlock" }),
                  ],
                }),
                o("b", { children: r.name }),
                a
                  ? o(re, {
                      children: [
                        o("span", { class: "wlv", children: ["Lv.", a.lv] }),
                        o(xt, {
                          value: e.frags[r.rarity],
                          max: i,
                          color: H[r.rarity],
                          label: `${W(e.frags[r.rarity])}/${i}`,
                        }),
                      ],
                    })
                  : o("span", {
                      class: "muted",
                      children:
                        typeof r.unlock == "number"
                          ? `通关第${r.unlock}章`
                          : "未解锁",
                    }),
              ],
            },
            r.id,
          );
        }),
      }),
    ],
  });
}
function bs(e) {
  let t = I[e],
    r = t.base,
    a = [`伤害：攻击力×${r.dmg}`, `间隔：${r.cd}秒`];
  return (
    t.countLabel && r.count && a.push(`${t.countLabel}：${r.count}`),
    r.pierce && r.pierce < 99 && a.push(`穿透：${r.pierce}`),
    r.pierce >= 99 && a.push("穿透：无限"),
    t.areaLabel && r.area && a.push(`${t.areaLabel}：${r.area}`),
    a
  );
}
function qi(e) {
  let t = () => {
    let r = N(),
      a = I[e],
      n = r.weapons[e],
      i = r.loadout.includes(e),
      s = n?.lv ?? 1,
      l = ct(a.rarity, s),
      c = Lt(a.rarity, s);
    return o(te, {
      title: a.name,
      class: `modal-weapon r${a.rarity}`,
      children: [
        o("div", {
          class: "wd-top",
          children: [
            o("div", {
              class: `wd-icon r${a.rarity}`,
              children: o(S, { id: `weapon_${e}`, size: 5 }),
            }),
            o("div", {
              class: "wd-info",
              children: [
                o("div", {
                  children: [
                    o("b", {
                      style: { color: H[a.rarity] },
                      children: [Me[a.rarity], " · ", Et[a.rarity]],
                    }),
                    o("span", { class: "wd-tag", children: a.tag }),
                  ],
                }),
                o("div", { children: a.desc }),
                o("div", {
                  class: "wd-stats",
                  children: bs(e).map((d) => o("span", { children: d }, d)),
                }),
              ],
            }),
          ],
        }),
        o("div", {
          class: "wd-awaken",
          children: [
            o("b", { children: ["觉醒 · ", a.awakenName] }),
            o("span", { children: a.awakenDesc }),
            o("em", {
              class: "muted",
              children: "局内获得 4 次强化后，银色宝箱可能出现觉醒",
            }),
          ],
        }),
        n
          ? o(re, {
              children: [
                o("div", {
                  class: "wd-level",
                  children: [
                    o("span", { children: ["Lv.", s, " → Lv.", s + 1] }),
                    o("span", {
                      children: [
                        "伤害 ×",
                        Ve(s).toFixed(2),
                        " → ×",
                        Ve(s + 1).toFixed(2),
                      ],
                    }),
                  ],
                }),
                o("div", {
                  class: "wd-cost",
                  children: [
                    o("span", {
                      class: r.frags[a.rarity] >= l ? "" : "lack",
                      children: [
                        o(S, { id: `frag${a.rarity}`, size: 1.3 }),
                        " ",
                        W(r.frags[a.rarity]),
                        "/",
                        l,
                      ],
                    }),
                    o("span", {
                      class: r.gold >= c ? "" : "lack",
                      children: [o(S, { id: "gold", size: 1.3 }), " ", W(c)],
                    }),
                  ],
                }),
                o("div", {
                  class: "row-btns",
                  children: [
                    o(C, {
                      color: i ? "gray" : "blue",
                      onClick: () => {
                        let d = Ta(r, e);
                        if (d === "full") return A(`最多上阵 ${Be} 把武器`);
                        if (d === "last") return A("至少保留 1 把上阵武器");
                        (P(), A(d === "on" ? "已上阵" : "已下阵"));
                      },
                      children: i ? "下阵" : "上阵",
                    }),
                    o(C, {
                      color: "green",
                      disabled: !gt(r, e),
                      onClick: () => {
                        if (!Ma(r, e))
                          return A(
                            r.frags[a.rarity] < l
                              ? `${Et[a.rarity]}碎片不足`
                              : "金币不足",
                          );
                        (M("up"), P());
                      },
                      children: "升级",
                    }),
                  ],
                }),
              ],
            })
          : o("p", {
              class: "center-text muted",
              children:
                typeof a.unlock == "number"
                  ? `普通难度通关第 ${a.unlock} 章解锁，商店武器宝箱也有概率获得`
                  : "",
            }),
      ],
    });
  };
  Z(() => o(t, {}));
}
function gs() {
  let e = () => {
      // ★ 量容器，不量视口：宿主上面有顶栏、下面有底栏，量 window 会溢出到容器外
      let a = (mountRoot && mountRoot.clientWidth) || window.innerWidth,
        n = (mountRoot && mountRoot.clientHeight) || window.innerHeight,
        i = Math.floor(a > n && n < 600 ? Math.min(a, 920) : Math.min(a, Math.max(320, n / 1.6))),
        s = Math.floor(Math.min(n, i * 2.25));
      return { w: i, h: s };
    },
    [t, r] = he(e);
  return (
    ke(() => {
      let a = () => r(e());
      return (
        window.addEventListener("resize", a),
        window.addEventListener("orientationchange", a),
        () => {
          (window.removeEventListener("resize", a),
            window.removeEventListener("orientationchange", a));
        }
      );
    }, []),
    ke(() => {
      // ★ 不写 documentElement：那是宿主的地基（Tailwind 全用 rem）⇒ 会把顶栏底栏一起放大
      const cw = (mountRoot && mountRoot.clientWidth) || window.innerWidth;
      const ch = (mountRoot && mountRoot.clientHeight) || window.innerHeight;
      if (mountRoot) mountRoot.style.setProperty('--u', `${cw > ch && ch < 600 ? 14 : (16 * t.w) / 390}px`);
    }, [t.w]),
    t
  );
}
function Vi() {
  let e = () => {
    let t = N(),
      r = z.staminaBuysPerDay - t.daily.staminaBuys;
    return o(te, {
      title: "体力不足",
      children: o("div", {
        class: "center-col",
        children: [
          o(S, { id: "stamina", size: 4 }),
          o("p", {
            class: "center-text",
            children: ["当前体力 ", t.stamina, "/", me, "，每 5 分钟恢复 1 点"],
          }),
          o(C, {
            big: !0,
            color: "green",
            disabled: r <= 0,
            onClick: () => {
              if (!kr(t))
                return A(
                  t.gems < z.staminaGems ? "钻石不足" : "今日次数已用完",
                );
              (M("coin"), P(!0), le(), A(`体力 +${z.staminaAmount}`));
            },
            children: [
              o(S, { id: "gem", size: 1.1 }),
              " ",
              z.staminaGems,
              " 购买 ",
              z.staminaAmount,
              " 体力（今日剩余 ",
              r,
              "）",
            ],
          }),
          o("p", {
            class: "muted center-text",
            children: "完成每日任务、领取进度宝箱也能获得体力",
          }),
        ],
      }),
    });
  };
  Z(() => o(e, {}));
}
function LanguageRow() {
  languageSignal.value;
  return o('div', {class:'language-row', role:'group', 'aria-label':translateText('语言'), children:[['zh','中文'],['en','English'],['ja','日本語']].map(([id,label])=>o('button',{class:'language-button',lang:id,'aria-pressed':getLanguage()===id,onClick:()=>setLanguage(id),children:label},id))});
}
function SaveStatus() {
  saveSignal.value;
  const status = autosave.status;
  const message = status === 'invalid' ? '存档无法读取，已保留原数据' : status === 'error' ? '暂未保存成功，请重试' : status === 'saving' ? '正在保存进度…' : status === 'accepted' ? '进度已交给平台保存' : '自动存档已启用';
  return o('div',{class:'save-status',role:'status',children:[o('p',{children:message}),o('p',{children:'战斗每10秒自动记录，离开时再次记录'}),status==='error' && o(C,{onClick:()=>autosave.retry(),children:'重试存档'})]});
}
function vs() {
  let e = () => {
    let t = N();
    return o(te, {
      title: "设置",
      children: o("div", {
        class: "center-col",
        children: [
          o(LanguageRow, {}),
          o(SaveStatus, {}),
          o("div", {
            class: "row-btns",
            children: [
              o(C, {
                color: t.settings.sfx ? "green" : "gray",
                onClick: () => {
                  ((t.settings.sfx = !t.settings.sfx),
                    Ge(t.settings.sfx, t.settings.music),
                    Dn.value++);
                },
                children: ["音效：", t.settings.sfx ? "开" : "关"],
              }),
              o(C, {
                color: t.settings.music ? "green" : "gray",
                onClick: () => {
                  ((t.settings.music = !t.settings.music),
                    Ge(t.settings.sfx, t.settings.music),
                    Dn.value++);
                },
                children: ["音乐：", t.settings.music ? "开" : "关"],
              }),
            ],
          }),
          o("div", {
            class: "muted center-text",
            children: [
              "战斗 ",
              t.stats.battles,
              " 场 · 胜利 ",
              t.stats.wins,
              " 场 · 消灭病毒 ",
              W(t.stats.kills),
            ],
          }),
          o(C, {
            color: "red",
            small: !0,
            onClick: () =>
              zi(
                "重置存档",
                "确定清空全部进度重新开始吗？此操作无法撤销。",
                () => {
                  Ga().then(ok => {if(ok){saveEnabled=false;liveBattle=null;location.reload();}});
                },
                "重置",
              ),
            children: "重置存档",
          }),
          o("p", {
            class: "muted center-text small-text",
            children:
              `${TITLE} · 原创轻度塔防肉鸽 · 所有角色与美术均为程序绘制`,
          }),
        ],
      }),
    });
  };
  Z(() => o(e, {}));
}
function ys() {
  let e = Rt.value;
  if (!e.length) return null;
  let t = e[0],
    r = () => {
      Rt.value = Rt.value.slice(1);
    };
  return o("div", {
    class: "modal-back reward-back",
    onClick: r,
    children: o("div", {
      class: "reward-pop",
      onClick: (a) => a.stopPropagation(),
      children: [
        o("div", { class: "reward-rays" }),
        o("div", { class: "ribbon", children: t.title }),
        o(ae, { reward: t.reward }),
        t.note && o("p", { class: "center-text", children: t.note }),
        o(C, { big: !0, onClick: r, children: "收下" }),
      ],
    }),
  });
}
function Ji() {
  languageSignal.value;
  let e = gs(),
    t = N();
  $e.value;
  let r = Ur.value,
    a = Fe.value,
    n = jr.value;
  ke(() => {
    r || tt("menu");
  }, [r]);
  let i = async () => {
      // ★ 收费点：每点一次「开始战斗」就是一局（「继续」接着打不再收）
      if (!(await chargePlayFn())) return;
      let d = j();
      if (!Ea(d, Date.now())) {
        Vi();
        return;
      }
      (M("open"), P(!0), le(), (Ur.value = !0));
    },
    s = Ae(t),
    c = !t.tut.battle
      ? { home: !1 }
      : {
          home: $a(t) > 0,
          hero: t.gold >= ht(s) || (t.tut.battle && !t.tut.hero),
          weapons: Te.some((d) => t.weapons[d.id] && gt(t, d.id)),
          relics: t.keySilver > 0 || Ie.some((d) => vt(t, d.id)),
          shop: !1,
        };
  return o("div", {
    class: "root",
    children: o("div", {
      class: "stage",
      style: { width: `${e.w}px`, height: `${e.h}px` },
      children: [
        r
          ? o(Di, {
              onExit: () => {
                ((Ur.value = !1), (Fe.value = "home"));
              },
            })
          : o("div", {
              class: `menu tab-${a}`,
              children: [
                o(Ei, {
                  onPlus: (d) => {
                    d === "stamina" ? Vi() : (Fe.value = "shop");
                  },
                }),
                o("button", {
                  class: "gear",
                  onClick: () => (M("click"), vs()),
                  children: "⚙",
                }),
                o("div", {
                  class: "content",
                  children: [
                    a === "home" && o(Hi, { onStart: i }),
                    a === "hero" && o(Oi, {}),
                    a === "weapons" && o(Xi, {}),
                    a === "relics" && o(Ui, {}),
                    a === "shop" && o(ji, {}),
                  ],
                }),
                o(Li, { dots: c }),
              ],
            }),
        n && o(n, {}),
        o(ys, {}),
        o("div", {
          class: "toasts",
          children: Ct.value.map((d) =>
            o("div", { class: "toast", children: d.text }, d.id),
          ),
        }),
      ],
    }),
  });
}
async function ks(opts = {}) {
  const container = opts.container ?? document.getElementById("app");
  saveApi = opts.store ?? makeMemorySaveApi();
  chargePlayFn = typeof opts.chargePlay === "function" ? opts.chargePlay : async () => true;

  const styleEl = document.createElement("style");
  styleEl.textContent = scopeCss(da, ".cg");
  document.head.appendChild(styleEl);

  mountRoot = document.createElement("div");
  mountRoot.className = "cg";
  mountRoot.style.cssText = "position:relative;width:100%;height:100%;overflow:hidden";
  container.appendChild(mountRoot);
  setStyleRoot(mountRoot);

  // 上一次挂载留下的界面状态（模块级信号）必须清掉：
  // 不清的话第二次挂载会直接进「战斗」，而 liveBattle / resumedBattle 是空的
  (Fe.value = "home"), (Ur.value = !1), (jr.value = null), (Ct.value = []);

  let t = Date.now(),
    r = await Wa(saveApi);
  (Bt(r, t), Ii(r), Ge(r.settings.sfx, r.settings.music));
  tickTimer = Ai();
  setLanguage(navigator.language, false);
  if (resumedBattle) Ur.value = true;
  la(o(Ji, {}), mountRoot);

  const off = [];
  const on = (target, type, fn, opt) => {
    target.addEventListener(type, fn, opt);
    off.push(() => target.removeEventListener(type, fn, opt));
  };
  let n = () => ja();
  (on(window, "pointerdown", n, { passive: !0 }),
    on(window, "keydown", n),
    on(document, "visibilitychange", () => {
      (document.hidden && checkpoint(), Va(document.hidden));
    }),
    on(window, "pagehide", checkpoint),
    on(document, "gesturestart", (i) => i.preventDefault()),
    on(document, "contextmenu", (i) => i.preventDefault()));

  const bridge = {
    ready: true,
    state: () => {
      const m = N();
      return {
        tab: Fe.value,
        battle: !!Ur.value,
        chapter: m.chapter,
        diff: m.diff,
        gold: m.gold,
        gems: m.gems,
        battles: m.stats.battles,
        modal: !!jr.value,
        pct: liveBattle ? Math.floor(liveBattle.progress * 100) : 0,
        killed: liveBattle ? liveBattle.killed : 0,
      };
    },
  };
  window.__cellguard = bridge;

  return async function destroy() {
    off.forEach((f) => f());
    clearInterval(tickTimer);
    tickTimer = 0;
    try {
      if (autosave) await autosave.write(j(), snapshotBattle(liveBattle, liveOverlay(), liveSpeed()));
    } catch {}
    try {
      la(null, mountRoot);
    } catch {}
    try {
      if (T) {
        await T.close();
        T = null;
      }
    } catch {}
    styleEl.remove();
    mountRoot.remove();
    mountRoot = null;
    saveApi = null;
    setStyleRoot(null);
    liveBattle = null;
    saveEnabled = false;
    if (window.__cellguard === bridge) delete window.__cellguard;
  };
}  return await ks(opts);
}
