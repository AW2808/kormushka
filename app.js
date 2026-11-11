import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, deleteDoc, setDoc, onSnapshot, query, orderBy, limit }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getMessaging, getToken, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

const CFG = self.KOT_CONFIG || {};
const HUNGRY_H = Number(CFG.hungryHours) || 6;
const MEALS = Number(CFG.mealsPerDay) || 3;
const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }
};

/* ---------------- иконки ---------------- */
const ICON = {
  fish: `<svg viewBox="0 0 32 32" fill="none"><path d="M4 16c4-6 10-8 16-7 3 .5 5 2 7 4l-3 3 3 3c-2 2-4 3.5-7 4-6 1-12-1-16-7z" fill="#fff"/><circle cx="21" cy="14" r="1.6" fill="#2a5fd0"/><path d="M14 12c1 2 1 6 0 8" stroke="#2a5fd0" stroke-width="1.6" stroke-linecap="round" opacity=".5"/></svg>`,
  meat: `<svg viewBox="0 0 32 32" fill="none"><path d="M18 4c5.5 0 10 4.2 10 9.4 0 5.8-5.6 9.2-10.8 9.2-2.3 0-4.2-.6-5.6-1.8-1.6-1.4-2.3-3.4-2.3-5.8C9.3 9.4 12.6 4 18 4z" fill="#fff"/><path d="M11 20.5 6.8 24.7" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><circle cx="5.2" cy="24.2" r="2.3" fill="#fff"/><circle cx="7.4" cy="26.6" r="2.3" fill="#fff"/><path d="M15 10c2-2 6-2 8 1" stroke="#c9365a" stroke-width="1.8" stroke-linecap="round" opacity=".55"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  bowl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18a9 9 0 0 1-18 0z"/><path d="M8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5M16 8c0-1.5 1-2 1-3.5"/></svg>`,
  paw: `<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="7" cy="9" rx="2" ry="2.6"/><ellipse cx="12" cy="6.6" rx="2" ry="2.6"/><ellipse cx="17" cy="9" rx="2" ry="2.6"/><path d="M12 11.5c3 0 6 3.4 6 6 0 2-1.6 3-3.4 2.6-1-.2-1.6-.6-2.6-.6s-1.6.4-2.6.6C7.6 20.5 6 19.5 6 17.5c0-2.6 3-6 6-6z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  undo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>`
};
const FOOD = { fish: "Рыбка", meat: "Мясо" };
const AVA = ["linear-gradient(135deg,#6c4cf5,#a98bff)", "linear-gradient(135deg,#ff6f91,#ff9f6b)",
  "linear-gradient(135deg,#12b38a,#5fdcb4)", "linear-gradient(135deg,#2f86f6,#68c3ff)"];

/* ---------------- состояние ---------------- */
let family = { cat: "Кот", members: ["Папа", "Мама", "Ребёнок 1", "Ребёнок 2"] };
let feedings = [], loaded = false, food = null, db = null, fam = null;
let me = store.get("kot-me");

function showNote(t) { $("note").textContent = t || ""; $("note").hidden = !t; }

/* ---------------- код семьи ---------------- */
const validCode = (c) => /^[a-z0-9]{16,40}$/.test(c || "");
function readFamily() {
  const m = location.hash.match(/fam=([a-z0-9]+)/i);
  if (m && validCode(m[1].toLowerCase())) { store.set("kot-fam", m[1].toLowerCase()); }
  const c = store.get("kot-fam");
  return validCode(c) ? c : null;
}
function newCode() {
  const a = new Uint8Array(20); crypto.getRandomValues(a);
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(a, (b) => abc[b % abc.length]).join("");
}
const famPath = (...p) => ["families", fam, ...p].join("/");

/* ---------------- время ---------------- */
const pad = (n) => String(n).padStart(2, "0");
const hm = (ms) => { const d = new Date(ms); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
function ago(ms) {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (m < 1) return "только что"; if (m < 60) return m + " мин назад";
  const h = Math.floor(m / 60), r = m % 60; return h + " ч" + (r ? " " + r + " мин" : "") + " назад";
}
function dayLabel(ms) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((t - new Date(ms).setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return "Сегодня"; if (diff === 1) return "Вчера";
  return new Date(ms).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}

/* ---------------- отрисовка ---------------- */
function renderWho() {
  const box = $("who"); box.innerHTML = "";
  box.style.gridTemplateColumns = `repeat(${Math.max(1, family.members.length)},1fr)`;
  family.members.forEach((name, i) => {
    const b = document.createElement("button"); b.className = "person"; b.type = "button";
    b.setAttribute("aria-pressed", String(name === me));
    b.innerHTML = `<span class="ava" style="background:${AVA[i % AVA.length]}"></span><span></span>`;
    b.firstChild.textContent = name.trim().charAt(0).toUpperCase(); b.lastChild.textContent = name;
    b.onclick = () => { me = name; store.set("kot-me", name); renderWho(); updateBtn(); };
    box.appendChild(b);
  });
}
function renderFood() {
  $("food").innerHTML = Object.keys(FOOD).map((k) =>
    `<button class="food" type="button" data-food="${k}" aria-pressed="${k === food}"><span class="fi ${k}">${ICON[k]}</span>${FOOD[k]}</button>`).join("");
  $("food").querySelectorAll(".food").forEach((b) => b.onclick = () => { food = b.dataset.food; renderFood(); updateBtn(); });
}
function updateBtn() {
  const b = $("feedBtn"); b.disabled = !(me && food && db);
  b.innerHTML = ICON.paw + "<span></span>";
  b.lastChild.textContent = !me ? "Выберите, кто кормит" : !food ? "Выберите корм" : `${me}: покормил(а)`;
}
function renderStatus() {
  $("title").textContent = "Кормушка · " + family.cat;
  document.title = "Кормушка · " + family.cat;
  if (!loaded) return;
  const st = $("status"), last = feedings[0], badge = $("badge");
  document.body.classList.remove("is-fed", "is-hungry");
  if (!last) {
    st.className = "glass status"; badge.hidden = true; $("ring").style.setProperty("--p", 0);
    $("verdict").textContent = family.cat + " ждёт первую запись";
    $("since").textContent = ""; $("next").textContent = "Отметьте кормление ниже."; $("today").innerHTML = ""; return;
  }
  const hrs = (Date.now() - last.at) / 3600000, hungry = hrs >= HUNGRY_H;
  st.className = "glass status " + (hungry ? "hungry" : "fed");
  document.body.classList.add(hungry ? "is-hungry" : "is-fed");
  badge.hidden = false; badge.innerHTML = hungry ? ICON.bowl : ICON.check;
  $("ring").style.setProperty("--p", hungry ? 100 : Math.max(4, Math.round(100 - hrs / HUNGRY_H * 100)));
  $("verdict").textContent = hungry ? family.cat + " голоден!" : family.cat + " сыт";
  $("since").innerHTML = ICON.clock + "<span></span>";
  $("since").lastChild.textContent = `${hm(last.at)} · ${last.who} · ${(FOOD[last.food] || "").toLowerCase()} · ${ago(last.at)}`;
  $("next").textContent = hungry ? `Прошло больше ${HUNGRY_H} ч с последней кормёжки.`
    : `Проголодается примерно в ${hm(last.at + HUNGRY_H * 3600000)}`;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const n = feedings.filter((x) => x.at >= t0.getTime()).length;
  $("today").innerHTML = "<span>Сегодня</span>" + Array.from({ length: MEALS }, (_, i) => `<span class="meal${i < n ? " on" : ""}"></span>`).join("") + `<span>${n} из ${MEALS}</span>`;
}
function renderHistory() {
  const ul = $("history"); ul.innerHTML = "";
  if (!feedings.length) { ul.innerHTML = `<li><p class="hint">Пока ни одной записи. Покормите кота и нажмите кнопку выше.</p></li>`; return; }
  let lastDay = "";
  feedings.slice(0, 30).forEach((x, idx) => {
    const dl = dayLabel(x.at);
    if (dl !== lastDay) { const h = document.createElement("li"); h.className = "day"; h.textContent = dl; ul.appendChild(h); lastDay = dl; }
    const k = FOOD[x.food] ? x.food : "meat";
    const li = document.createElement("li"); li.className = "item";
    li.innerHTML = `<span class="fi ${k}">${ICON[k]}</span><span class="what"><b></b><span></span></span><span class="time"><span>${hm(x.at)}</span></span>`;
    li.querySelector("b").textContent = FOOD[k]; li.querySelector(".what span").textContent = x.who;
    if (idx === 0 && Date.now() - x.at < 30 * 60000) {
      const d = document.createElement("button"); d.className = "del"; d.type = "button"; d.innerHTML = ICON.undo + "отменить";
      d.onclick = async () => { d.disabled = true; try { await deleteDoc(doc(db, famPath("feedings", x.id))); } catch { d.disabled = false; showNote("Не получилось отменить. Проверьте интернет."); } };
      li.querySelector(".time").appendChild(d);
    }
    ul.appendChild(li);
  });
}
const renderAll = () => { renderStatus(); renderHistory(); };

/* ---------------- уведомления ---------------- */
const pushSupportedHere = () => "Notification" in window && "serviceWorker" in navigator;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function renderPushBtn() {
  const b = $("pushBtn"); b.hidden = false;
  const on = pushSupportedHere() && Notification.permission === "granted" && store.get("kot-push") === "1";
  b.innerHTML = ICON.bell + "<span></span>";
  b.lastChild.textContent = on ? "Уведомления включены" : "Включить уведомления «Кот голоден»";
  b.disabled = on;
}
async function sha(s) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function enablePush() {
  if (isIOS && !standalone) {
    showNote("На iPhone уведомления работают только из приложения на главном экране: Safari → «Поделиться» → «На экран „Домой“», затем откройте его оттуда.");
    return;
  }
  if (!pushSupportedHere()) { showNote("Этот браузер не поддерживает уведомления. Откройте приложение в Chrome (Android) или с главного экрана (iPhone)."); return; }
  const perm = await Notification.requestPermission(); // вызывается сразу по нажатию — так требует iPhone
  if (perm !== "granted") { showNote("Уведомления запрещены. Разрешите их в настройках телефона для этого приложения."); return; }
  try {
    if (!(await isSupported())) throw new Error("unsupported");
    const reg = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(), { vapidKey: CFG.vapidKey, serviceWorkerRegistration: reg });
    if (!token) throw new Error("no token");
    await setDoc(doc(db, famPath("tokens", await sha(token))), { token, who: me || "", at: Date.now(), ua: navigator.userAgent.slice(0, 120) });
    store.set("kot-push", "1"); showNote(""); renderPushBtn();
    $("toast").textContent = "Готово! Пришлём уведомление, если кот проголодается.";
    setTimeout(() => $("toast").textContent = "", 5000);
  } catch (e) {
    console.error(e);
    showNote("Не удалось включить уведомления. Проверьте интернет и ключ vapidKey в config.js.");
  }
}

/* ---------------- действия ---------------- */
$("feedBtn").onclick = async () => {
  $("feedBtn").disabled = true;
  try {
    await addDoc(collection(db, famPath("feedings")), { at: Date.now(), who: me, food });
    $("toast").textContent = "Записано! " + family.cat + " сыт.";
    food = null; renderFood(); setTimeout(() => $("toast").textContent = "", 4000);
  } catch (e) { console.error(e); showNote("Не удалось сохранить. Проверьте интернет и попробуйте снова."); }
  updateBtn();
};
$("pushBtn").onclick = enablePush;
$("openSettings").onclick = () => {
  $("catName").value = family.cat;
  [0, 1, 2, 3].forEach((i) => $("m" + i).value = family.members[i] || "");
  const link = location.origin + location.pathname + "#fam=" + fam;
  $("inviteLink").textContent = link; $("famCode").textContent = fam;
  $("settings").hidden = false; $("settings").scrollIntoView({ behavior: "smooth" });
};
$("closeSettings").onclick = () => $("settings").hidden = true;
$("copyLink").onclick = async () => {
  try { await navigator.clipboard.writeText($("inviteLink").textContent); $("copyLink").textContent = "Скопировано"; }
  catch { getSelection().selectAllChildren($("inviteLink")); }
  setTimeout(() => $("copyLink").textContent = "Скопировать ссылку", 2500);
};
$("saveSettings").onclick = async () => {
  const next = { cat: $("catName").value.trim() || "Кот", members: [0, 1, 2, 3].map((i) => $("m" + i).value.trim()).filter(Boolean) };
  if (!next.members.length) next.members = ["Я"];
  try { await setDoc(doc(db, famPath("meta", "settings")), next); $("settings").hidden = true; }
  catch { showNote("Не удалось сохранить настройки."); }
};
function enterFamily(code) {
  fam = code; store.set("kot-fam", code);
  history.replaceState(null, "", location.pathname + "#fam=" + code);
  $("setup").hidden = true; start();
}
$("createFamily").onclick = () => enterFamily(newCode());
$("joinFamily").onclick = () => {
  let v = $("joinCode").value.trim().toLowerCase();
  const m = v.match(/fam=([a-z0-9]+)/); if (m) v = m[1];
  if (!validCode(v)) { showNote("Код не подходит. Скопируйте его целиком из настроек у того, кто создал семью."); return; }
  showNote(""); enterFamily(v);
};

/* ---------------- запуск ---------------- */
async function start() {
  $("main").hidden = false; $("openSettings").hidden = false;
  renderWho(); renderFood(); updateBtn(); renderPushBtn();
  const timer = setTimeout(() => { if (!loaded) showNote("Данные пока не загрузились. Проверьте интернет."); }, 10000);
  try { await signInAnonymously(getAuth()); }
  catch (e) { console.error(e); clearTimeout(timer); showNote("Не удалось подключиться. Проверьте интернет и что в Firebase включён анонимный вход."); return; }
  db = getFirestore(); updateBtn();
  onSnapshot(doc(db, famPath("meta", "settings")), (s) => {
    if (s.exists()) { const d = s.data(); family = { cat: d.cat || "Кот", members: Array.isArray(d.members) && d.members.length ? d.members : family.members }; }
    renderWho(); renderAll();
  }, (e) => console.error(e));
  onSnapshot(query(collection(db, famPath("feedings")), orderBy("at", "desc"), limit(60)), (snap) => {
    feedings = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => typeof x.at === "number");
    loaded = true; clearTimeout(timer); showNote(""); renderAll();
  }, (e) => { console.error(e); clearTimeout(timer); showNote("Нет доступа к данным. Проверьте правила Firestore (шаг 2 инструкции)."); });
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./firebase-messaging-sw.js").catch(console.error);
setInterval(renderAll, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) renderAll(); });

if (!CFG.firebase || String(CFG.firebase.apiKey).startsWith("ВСТАВЬТЕ")) {
  showNote("Приложение ещё не настроено: заполните файл config.js (шаг 3 инструкции).");
} else {
  initializeApp(CFG.firebase);
  fam = readFamily();
  if (fam) start(); else $("setup").hidden = false;
}
