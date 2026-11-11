// =====================================================================
//  НАСТРОЙКИ ПРИЛОЖЕНИЯ — заполните по инструкции (README.md, шаг 3)
//  Эти данные не секретные: их видит любой, кто открывает приложение.
// =====================================================================
self.KOT_CONFIG = {
  // Firebase: Настройки проекта → Общие → Ваши приложения → «Конфигурация»
  firebase: {
    apiKey: "AIzaSyBckPQ0ntN8hZNoYyyz7e_9dxPmoT9NpKg",
    authDomain: "kormushka-dd4b8.firebaseapp.com",
    projectId: "kormushka-dd4b8",
    storageBucket: "kormushka-dd4b8.firebasestorage.app",
    messagingSenderId: "846260426843",
    appId: "1:846260426843:web:6046a988a1c28b1963077e"
  },

  // Firebase: Настройки проекта → Cloud Messaging → Web Push certificates → «Key pair»
  vapidKey: "BI0XRTFFJYQtI9cGXoDtJuob9l7uGvVfjUfdugg_0fzYFlgDsOSvSM465JJp87RGSL4t0ypdY5rdYrxaFa34RE4",

  // Через сколько часов после кормления кот считается голодным
  hungryHours: 6,

  // Сколько раз в день кот обычно ест
  mealsPerDay: 3
};
