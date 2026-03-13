// ===== FIREBASE SYNC =====
// Quando o firebaseConfig estiver disponível, este módulo cuida de:
//   1. Gerar/recuperar código de sync pessoal (4 letras, salvo em localStorage)
//   2. Salvar anotações na nuvem quando há internet
//   3. Sincronizar fila offline quando a internet volta
//   4. Exibir tela "Ver no PC" com todas as anotações do dia

// ─────────────────────────────────────────────
// CONFIGURAÇÃO — preencher com seus dados Firebase
// ─────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCHW_CTip-v1oOsbYvMJ79Ql1JvbUY7NC4",
  authDomain: "anotacao-hc.firebaseapp.com",
  databaseURL: "https://anotacao-hc-default-rtdb.firebaseio.com",
  projectId: "anotacao-hc",
  storageBucket: "anotacao-hc.firebasestorage.app",
  messagingSenderId: "879065842847",
  appId: "1:879065842847:web:ae2e8ac6c3fe44388a4eaa"
};
// ─────────────────────────────────────────────

const SYNC_ENABLED = FIREBASE_CONFIG !== null;

// ── Código de sync pessoal ──────────────────
// Retorna o código salvo no localStorage (definido pelo login).
// Não gera código automaticamente — o usuário deve passar pelo login.
function getSyncCode() {
  return localStorage.getItem('sync_code') || null;
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

    console.log('[Sync] Firebase inicializado.');
  } catch (err) {
    console.warn('[Sync] Firebase não disponível:', err.message);
  }
}

// ── Salvar anotação na nuvem ─────────────────
async function syncSaveAnnotation(anot) {
  if (!SYNC_ENABLED) return;

  const code = getSyncCode();
  if (!code) return; // Usuário ainda não fez login — não sincroniza

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

  const failed = [];
  for (const item of queue) {
    try {
      const path = `sync/${item.syncCode || getSyncCode() || 'UNKNOWN'}/${item.timestamp}`;
      await set(ref(instance, path), item);
    } catch (err) {
      console.warn('[Sync] Fila — falha ao enviar item:', err.message);
      failed.push(item); // Guarda os que falharam, continua com os demais
    }
  }

  // Salva só os que falharam (os demais foram enviados com sucesso)
  if (failed.length > 0) {
    localStorage.setItem('sync_queue', JSON.stringify(failed));
    console.warn(`[Sync] ${failed.length} item(ns) permanece(m) na fila`);
  } else {
    clearOfflineQueue();
    console.log('[Sync] ✅ Fila processada com sucesso');
  }
}

// ── Verificar se código está disponível ──────
async function checkCode(code) {
  if (!db) {
    await new Promise(r => setTimeout(r, 3000));
    if (!db) return { exists: false, nome: null, offline: true };
  }
  const { ref, get, instance } = db;
  try {
    const snap = await get(ref(instance, `users/${code.toUpperCase()}`));
    if (snap.exists()) {
      return { exists: true, nome: snap.val().nome || null };
    }
    return { exists: false, nome: null };
  } catch {
    return { exists: false, nome: null, offline: true };
  }
}

// ── Registrar novo código ─────────────────────
async function registerCode(code, nome) {
  if (!db) return false;
  const { ref, set, instance } = db;
  try {
    await set(ref(instance, `users/${code.toUpperCase()}`), {
      nome: nome || '',
      createdAt: Date.now()
    });
    return true;
  } catch {
    return false;
  }
}

// ── Carregar anotações da nuvem ao fazer login ─
async function loadAnnotationsFromCloud(code) {
  const annotations = await syncFetchByCode(code);
  if (annotations.length === 0) return 0;
  const existing = JSON.parse(localStorage.getItem('anotacoes_hc') || '[]');
  const merged = [...existing];
  annotations.forEach(a => {
    if (!merged.find(e => e.timestamp === a.timestamp)) merged.push(a);
  });
  localStorage.setItem('anotacoes_hc', JSON.stringify(merged));
  return annotations.length;
}

// ── Buscar anotações do código no PC ─────────
async function syncFetchByCode(code) {
  if (!db) {
    // Firebase ainda não inicializou — aguarda até 5s
    await new Promise((resolve) => setTimeout(resolve, 5000));
    if (!db) return [];
  }

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
window.syncSaveAnnotation      = syncSaveAnnotation;
window.syncFetchByCode         = syncFetchByCode;
window.getSyncCode             = getSyncCode;
window.checkCode               = checkCode;
window.registerCode            = registerCode;
window.loadAnnotationsFromCloud = loadAnnotationsFromCloud;
window.SYNC_ENABLED       = SYNC_ENABLED;
