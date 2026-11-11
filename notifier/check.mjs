// Проверка «Кот голоден»: запускается GitHub Actions каждые 30 минут.
// Если с последнего кормления прошло больше HUNGRY_HOURS часов — отправляет push всем телефонам семьи.
// Одно уведомление на каждое «голодное» окно, повторно — только после нового кормления.
import admin from "firebase-admin";

const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Не задан секрет ${k}`); process.exit(1); } return v; };
const sa = JSON.parse(need("FIREBASE_SERVICE_ACCOUNT"));
const FAM = need("FAMILY_ID").trim().toLowerCase();
const HOURS = Number(process.env.HUNGRY_HOURS || 6);
const TZ = process.env.TIMEZONE || "Europe/Berlin";

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const base = db.collection("families").doc(FAM);

const lastSnap = await base.collection("feedings").orderBy("at", "desc").limit(1).get();
if (lastSnap.empty) { console.log("Записей о кормлении нет — ничего не делаю."); process.exit(0); }
const last = lastSnap.docs[0], f = last.data();
const hrs = (Date.now() - f.at) / 3600000;
console.log(`Последнее кормление: ${new Date(f.at).toISOString()} (${hrs.toFixed(1)} ч назад), ${f.who}`);
if (hrs < HOURS) { console.log("Кот сыт."); process.exit(0); }

const stateRef = base.collection("meta").doc("notifier");
const state = (await stateRef.get()).data() || {};
if (state.feedingId === last.id) { console.log("Уведомление уже отправляли."); process.exit(0); }

const settings = (await base.collection("meta").doc("settings").get()).data() || {};
const cat = settings.cat || "Кот";
const time = new Date(f.at).toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const food = { fish: "рыбкой", meat: "мясом" }[f.food] || "";

const tokSnap = await base.collection("tokens").get();
const tokens = tokSnap.docs.map((d) => ({ ref: d.ref, token: d.data().token })).filter((t) => t.token);
if (!tokens.length) { console.log("Нет телефонов с включёнными уведомлениями."); process.exit(0); }

let sent = 0;
for (let i = 0; i < tokens.length; i += 500) {
  const chunk = tokens.slice(i, i + 500);
  const res = await admin.messaging().sendEachForMulticast({
    tokens: chunk.map((t) => t.token),
    webpush: {
      notification: {
        title: `${cat} голоден! 🐾`,
        body: `Последний раз ${f.who} кормил(а) ${food} в ${time} — прошло больше ${HOURS} ч.`,
        icon: "icons/icon-192.png",
        tag: "kot-hungry",
        renotify: true
      }
    }
  });
  sent += res.successCount;
  await Promise.all(res.responses.map(async (r, j) => {
    const code = r.error?.code || "";
    if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
      await chunk[j].ref.delete(); console.log("Удалил устаревший токен.");
    } else if (r.error) console.log("Ошибка отправки:", code);
  }));
}
await stateRef.set({ feedingId: last.id, at: Date.now() });
console.log(`Отправлено уведомлений: ${sent} из ${tokens.length}.`);
