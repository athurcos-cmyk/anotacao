// ===== FIREBASE SYNC =====
// Quando o firebaseConfig estiver disponível, este módulo cuida de:
//   1. Gerar/recuperar código de sync pessoal (4 letras, salvo em localStorage)
//   2. Salvar anotações na nuvem quando há internet
//   3. Sincronizar fila offline quando a internet volta
//   4. Exibir tela "Ver no PC" com todas as anotações do dia

// ─────────────────────────────────────────────
// CONFIGURAÇÃO — preencher com seus dados Firebase
// ─────────────────────────────────────────────
const FIREBASE_CONFIG = null;
// Quando tiver o firebaseConfig do painel Firebase, substituir a linha acima por:
//
// const FIREBASE_CONFIG = {
//   apiKey: "...",
//   authDomain: "...",
//   databaseURL: "https://SEU-PROJETO-default-rtdb.firebaseio.com",
//   projectId: "...",
//   storageBucket: "...",
//   messagingSenderId: "...",
//   appId: "..."
// };
// ─────────────────────────────────────────────

const SYNC_ENABLED = FIREBASE_CONFIG !== null;

// ── Código de sync pessoal ──────────────────
function getSyncCode() {
  let code = localStorage.getItem('sync_code');
  if (!code) {
    // Gera código de 4 letras maiúsculas aleatórias
    code = Array.from({ length: 4 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]
    ).join('');
    localStorage.setItem('sync_code', code);
  }
  return code;
}

// ── Fila offline ────────────────────────────
function getOfflineQueue() {
  return JSON.parse(localStorage.getItem('sync_queue') || '[]');
}
function addToOfflineQueue(item) {
  const q = getOfflineQueue();
  q.push(item);
  localStorage.setItem('sync_queue', JSON.stringify(q));
}
function clearOfflineQueue() {
  localStorage.removeItem('sync_queue');
}

// ── Inicializar Firebase e processar fila ───
let db = null;

async function initSync() {
  if (!SYNC_ENABLED) return;

  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getDatabase, ref, set, get, child } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');

    const app = initializeApp(FIREBASE_CONFIG);
    db = { getDatabase, ref, set, get, child, instance: getDatabase(app) };

    // Processar fila offline pendente
    await processOfflineQueue();

    console.log('[Sync] Firebase inicializado. Código:', getSyncCode());
  } catch (err) {
    console.warn('[Sync] Firebase não disponível:', err.message);
  }
}

// ── Salvar anotação na nuvem ─────────────────
async function syncSaveAnnotation(anot) {
  if (!SYNC_ENABLED) return;

  const code = getSyncCode();
  const item = { ...anot, syncCode: code };

  if (!db || !navigator.onLine) {
    addToOfflineQueue(item);
    console.log('[Sync] Offline — anotação adicionada à fila');
    return;
  }

  try {
    const { ref, set, instance } = db;
    const path = `sync/${code}/${anot.timestamp}`;
    await set(ref(instance, path), anot);
    console.log('[Sync] ✅ Anotação sincronizada:', path);
  } catch (err) {
    addToOfflineQueue(item);
    console.warn('[Sync] Falha — adicionado à fila:', err.message);
  }
}

// ── Processar fila offline ───────────────────
async function processOfflineQueue() {
  if (!db || !navigator.onLine) return;

  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  console.log(`[Sync] Processando ${queue.length} anotação(ões) em fila...`);
  const { ref, set, instance } = db;

  for (const item of queue) {
    try {
      const path = `sync/${item.syncCode || getSyncCode()}/${item.timestamp}`;
      await set(ref(instance, path), item);
    } catch (err) {
      console.warn('[Sync] Fila — falha ao enviar:', err.message);
      return; // Para na primeira falha; tenta de novo na próxima conexão
    }
  }

  clearOfflineQueue();
  console.log('[Sync] ✅ Fila processada com sucesso');
}

// ── Buscar anotações do código no PC ─────────
async function syncFetchByCode(code) {
  if (!db) throw new Error('Firebase não inicializado');

  const { ref, get, instance } = db;
  const snapshot = await get(ref(instance, `sync/${code.toUpperCase()}`));

  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  return Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
}

// ── Reconectar quando voltar online ──────────
window.addEventListener('online', () => {
  console.log('[Sync] Conexão restaurada — processando fila...');
  processOfflineQueue();
});

// ── Inicializar ao carregar ───────────────────
initSync();

// ── Exportar para uso no app.js ──────────────
window.syncSaveAnnotation = syncSaveAnnotation;
window.syncFetchByCode    = syncFetchByCode;
window.getSyncCode        = getSyncCode;
window.SYNC_ENABLED       = SYNC_ENABLED;
