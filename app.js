// ===== STATE =====
const state = {
  blocoAtual: 1,
  dispositivos: [],
  dragSrcIndex: null
};

// ===== DOM REFS =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  wrapper: $('#blocos-wrapper'),
  progressLabel: $('#progress-label'),
  progressFill: $('#progress-fill'),
  header: $('#header'),
  main: $('#main'),
  previewScreen: $('#preview-screen'),
  historicoScreen: $('#historico-screen'),
  previewText: $('#preview-text'),
  toast: $('#toast'),
  modalOverlay: $('#modal-overlay'),
  modalText: $('#modal-text'),
  confirmOverlay: $('#confirm-overlay'),
  confirmMsg: $('#confirm-msg'),
  dispositivosLista: $('#dispositivos-lista'),
  fechamentoPreview: $('#fechamento-preview'),
  svScreen: $('#sv-screen'),
  pcScreen: $('#pc-screen'),
  loginScreen: $('#login-screen'),
  appDiv: $('#app')
};

// ===== PWA INSTALL BANNER =====
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  // Não mostra se já foi dispensado antes
  if (localStorage.getItem('install_dismissed')) return;
  // Não mostra se já está instalado (standalone)
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) return;

  const banner = document.getElementById('install-banner');
  if (!banner) return;
  banner.style.display = 'flex';
}

function setupInstallBanner() {
  const banner   = document.getElementById('install-banner');
  const btnInst  = document.getElementById('btn-instalar');
  const btnDism  = document.getElementById('btn-install-dismiss');
  if (!banner || !btnInst || !btnDism) return;

  // iOS: não tem beforeinstallprompt, mostra instrução manual
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (isIOS && !isStandalone && !localStorage.getItem('install_dismissed')) {
    const sub = document.getElementById('install-banner-sub');
    if (sub) sub.textContent = 'Toque em Compartilhar → "Adicionar à Tela Inicial"';
    btnInst.textContent = 'Como instalar?';
    btnInst.addEventListener('click', () => {
      alert('No iPhone/iPad:\n1. Toque no ícone de compartilhar (□↑) na barra do Safari\n2. Role e toque em "Adicionar à Tela de Início"\n3. Toque em "Adicionar"');
    });
    banner.style.display = 'flex';
  }

  btnInst.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      banner.style.display = 'none';
    }
    deferredInstallPrompt = null;
  });

  btnDism.addEventListener('click', () => {
    banner.style.display = 'none';
    localStorage.setItem('install_dismissed', '1');
  });
}

// ===== SESSÃO =====
const SESSION_DURATION_MS = 6 * 60 * 60 * 1000; // 6 horas

function isSessionValid() {
  const loginTime = localStorage.getItem('login_time');
  if (!loginTime) return false;
  return (Date.now() - parseInt(loginTime, 10)) < SESSION_DURATION_MS;
}

function clearSession() {
  localStorage.removeItem('sync_code');
  localStorage.removeItem('login_time');
}

function startSessionWatcher() {
  // Verifica a cada minuto se a sessão expirou
  setInterval(() => {
    if (localStorage.getItem('sync_code') && !isSessionValid()) {
      clearSession();
      showToast('Sessão expirada. Faça login novamente.');
      setTimeout(() => location.reload(), 1500);
    }
  }, 60 * 1000);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  setupInstallBanner();
  setupNavigation();
  setupConditionals();
  setupDispositivos();
  setupPreview();
  setupHistorico();
  setupModal();
  setupSV();
  setupPCMode();
  setupLogin();
  setupFrasesRapidas();
  setupDraftAutoSave();
  requestAnimationFrame(() => updateBlocoView());

  // Limpeza automática de anotações com mais de 60 dias
  cleanupOldAnnotations(60);

  const existingCode = localStorage.getItem('sync_code');
  if (!existingCode || !isSessionValid()) {
    // Sem código ou sessão expirada → login
    clearSession();
    showLogin();
  } else {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) showPCMode();
    startSessionWatcher();
  }

  window.addEventListener('resize', () => updateBlocoView());
});

// ===== NAVIGATION =====
function setupNavigation() {
  $$('.btn-next').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = parseInt(btn.dataset.next);
      if (next) {
        if (validateBloco(state.blocoAtual)) {
          goToBloco(next);
        }
      }
    });
  });

  $$('.btn-prev').forEach(btn => {
    btn.addEventListener('click', () => {
      const prev = parseInt(btn.dataset.prev);
      if (prev) goToBloco(prev);
    });
  });

  $('#btn-gerar').addEventListener('click', () => {
    if (validateBloco(5)) {
      showPreview();
    }
  });
}

function goToBloco(num) {
  state.blocoAtual = num;
  updateBlocoView();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (num === 5) {
    updateFechamentoPreview();
  }
}

function updateBlocoView() {
  const width = els.main.offsetWidth;
  $$('.bloco').forEach(b => { b.style.width = width + 'px'; });
  const offset = (state.blocoAtual - 1) * -width;
  els.wrapper.style.transform = `translateX(${offset}px)`;
  els.progressLabel.textContent = `Bloco ${state.blocoAtual} de 5`;
  els.progressFill.style.width = `${state.blocoAtual * 20}%`;
}

// ===== CONDITIONALS =====
function setupConditionals() {
  // Sexo do paciente — atualiza labels com genero
  $$('input[name="sexo"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateGenderLabels(radio.value);
    });
  });

  // Estado mental
  const mentalCheck = $('#mental-alterado');
  const mentalContainer = $('#mental-desc-container');
  mentalCheck.addEventListener('change', () => {
    mentalContainer.style.display = mentalCheck.checked ? 'block' : 'none';
    if (!mentalCheck.checked) {
      $('#mental-desc').value = '';
    }
  });

  // Deambulacao
  $$('input[name="deambulacao"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const container = $('#deambula-auxilio-container');
      container.style.display = radio.value === 'deambula com auxílio' ? 'block' : 'none';
      if (radio.value !== 'deambula com auxílio') {
        $('#deambula-auxilio').value = '';
      }
    });
  });

  // Respiracao
  $$('input[name="respiracao"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const o2Container     = $('#oxigenio-container');
      const padraoContainer = $('#resp-padrao-container');
      const needsO2     = radio.value === 'cateter nasal de O₂' || radio.value === 'máscara de O₂';
      const needsPadrao = radio.value !== 'ventilação mecânica'; // sempre mostra, exceto VM
      o2Container.style.display     = needsO2     ? 'block' : 'none';
      padraoContainer.style.display = needsPadrao ? 'block' : 'none';
      if (!needsO2)     $('#oxigenio-litros').value = '';
      if (!needsPadrao) $$('input[name="resp-padrao"]').forEach(r => r.checked = false);
    });
  });

  // Acompanhante
  $$('input[name="acompanhante"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const container = $('#acompanhante-container');
      container.style.display = radio.value === 'sim' ? 'block' : 'none';
      if (radio.value !== 'sim') {
        $('#acompanhante-nome').value = '';
        $('#acompanhante-parentesco').value = '';
      }
    });
  });

  // Evacuação — mostrar datepicker quando "Escolher data" for selecionado
  $$('input[name="evacuacao-opcao"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const container = $('#evacuacao-data-container');
      container.style.display = radio.value === 'data' ? 'block' : 'none';
      if (radio.value !== 'data') $('#evacuacao-data').value = '';
    });
  });

  // Diurese SVD (checkbox — show debito when SVD is checked)
  $$('input[name="diurese"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const svdChecked = $('input[name="diurese"][value="SVD"]').checked;
      const container = $('#svd-container');
      container.style.display = svdChecked ? 'block' : 'none';
      if (!svdChecked) {
        $('#svd-debito').value = '';
      }
    });
  });
}

function updateGenderLabels(gender) {
  const attr = gender === 'M' ? 'm' : 'f';
  $$('[data-f-value]').forEach(radio => {
    radio.value = radio.dataset[attr + 'Value'];
    radio.nextElementSibling.textContent = radio.dataset[attr + 'Label'];
  });
}

function getGenero() {
  return getRadioValue('sexo') || 'F';
}

// ===== DISPOSITIVOS =====
let modalDispTipo = null;

function setupDispositivos() {
  // Botões de tipo
  $$('.btn-tipo').forEach(btn => {
    btn.addEventListener('click', () => abrirModalDisp(btn.dataset.tipo));
  });

  // Fechar modal
  $('#modal-disp-fechar').addEventListener('click', fecharModalDisp);
  $('#modal-disp').addEventListener('click', (e) => {
    if (e.target === $('#modal-disp')) fecharModalDisp();
  });

  // Confirmar
  $('#modal-disp-confirmar').addEventListener('click', confirmarDisp);
}

function abrirModalDisp(tipo) {
  modalDispTipo = tipo;
  $('#modal-disp-titulo').textContent = tipo;
  $('#modal-disp-body').innerHTML = buildDispForm(tipo);
  $('#modal-disp-erro').textContent = '';
  $('#modal-disp').style.display = 'flex';
  setupDispModalConditionals(tipo);
}

function fecharModalDisp() {
  $('#modal-disp').style.display = 'none';
  modalDispTipo = null;
}

function confirmarDisp() {
  $('#modal-disp-erro').textContent = '';
  const result = buildDispText(modalDispTipo);
  if (!result) return;
  state.dispositivos.push(result);
  renderDispositivos();
  fecharModalDisp();
}

// — Helpers do modal —
function dRadio(name, value, label) {
  return `<label class="radio-btn"><input type="radio" name="${name}" value="${value}"><span>${label}</span></label>`;
}

function dModalGet(selector) {
  const el = document.querySelector(`#modal-disp-body ${selector}`);
  return el ? el.value.trim() : '';
}

function dModalRadio(name) {
  const el = document.querySelector(`#modal-disp-body input[name="${name}"]:checked`);
  return el ? el.value : null;
}

function dFormatDate(str) {
  if (!str) return '?/?';
  const p = str.split('-');
  return `${p[2]}/${p[1]}`;
}

function dHoje() {
  return new Date().toISOString().split('T')[0];
}

function infusaoFields() {
  return `
    <div id="d-inf" style="display:none">
      <div class="campo">
        <label>Solução <span class="obrigatorio">*</span></label>
        <input type="text" id="d-sol" placeholder="Ex: SF 0,9% 500ml">
      </div>
      <div class="campo">
        <label>Velocidade <span class="obrigatorio">*</span></label>
        <div class="input-suffix-wrap">
          <input type="number" id="d-vel" placeholder="21" min="1">
          <span class="input-suffix">ml/h</span>
        </div>
      </div>
    </div>`;
}

function dataField() {
  // Apenas o container condicional — aparece quando "Datado" é marcado
  return `
    <div id="d-data-container" style="display:none" class="campo">
      <label>Data do curativo</label>
      <input type="date" id="d-data" value="${dHoje()}">
    </div>`;
}

function statusCheckboxInfFields() {
  // AVP / CVC / PICC: salinizado, ocluído, datado, em infusão — todos opt-in
  return `
    <div class="campo">
      <label>Status <span class="hint-inline">(marque o que se aplica)</span></label>
      <div class="radio-group vertical">
        <label class="checkbox-label"><input type="checkbox" id="d-sal"    name="d-sal-cb"><span>Salinizado</span></label>
        <label class="checkbox-label"><input type="checkbox" id="d-ocl"    name="d-ocl-cb"><span>Ocluído</span></label>
        <label class="checkbox-label"><input type="checkbox" id="d-datado" name="d-datado-cb"><span>Datado</span></label>
        <label class="checkbox-label"><input type="checkbox" id="d-inf-cb" name="d-inf-cb"><span>Em infusão</span></label>
      </div>
    </div>
    ${infusaoFields()}`;
}

function statusSalInfFields() {
  return statusCheckboxInfFields();
}

function statusSalOclFields() {
  // Permcath / Shilley: salinizado, ocluído, datado — todos opt-in
  return `
    <div class="campo">
      <label>Status <span class="hint-inline">(marque o que se aplica)</span></label>
      <div class="radio-group vertical">
        <label class="checkbox-label"><input type="checkbox" id="d-sal"    name="d-sal-cb"><span>Salinizado</span></label>
        <label class="checkbox-label"><input type="checkbox" id="d-ocl"    name="d-ocl-cb"><span>Ocluído</span></label>
        <label class="checkbox-label"><input type="checkbox" id="d-datado" name="d-datado-cb"><span>Datado</span></label>
      </div>
    </div>`;
}

// — Form builders —
function buildDispForm(tipo) {
  switch (tipo) {
    case 'AVP': return `
      <div class="campo">
        <label>Local <span class="obrigatorio">*</span></label>
        <div class="radio-group vertical">
          ${['MSE','MSD','MIE','MID'].map(m => dRadio('d-local-avp', m, m)).join('')}
          ${dRadio('d-local-avp', 'jugular D', 'Jugular D')}
          ${dRadio('d-local-avp', 'jugular E', 'Jugular E')}
        </div>
      </div>
      ${statusSalInfFields()}
      ${dataField()}`;

    case 'CVC': return `
      <div class="campo">
        <label>Local <span class="obrigatorio">*</span></label>
        <div class="radio-group vertical">
          ${['subclávia D','subclávia E','jugular D','jugular E','femoral D','femoral E'].map(l => dRadio('d-local', l, l)).join('')}
        </div>
      </div>
      <div class="campo">
        <label>Lúmens <span class="obrigatorio">*</span></label>
        <div class="radio-group">
          ${dRadio('d-lumens', 'mono', 'Mono')}
          ${dRadio('d-lumens', 'duplo', 'Duplo')}
          ${dRadio('d-lumens', 'triplo', 'Triplo')}
        </div>
      </div>
      ${statusSalInfFields()}
      ${dataField()}`;

    case 'PICC': return `
      <div class="campo">
        <label>Membro <span class="obrigatorio">*</span></label>
        <div class="radio-group">
          ${dRadio('d-membro', 'MSD', 'MSD')}
          ${dRadio('d-membro', 'MSE', 'MSE')}
        </div>
      </div>
      <div class="campo">
        <label>Lúmens <span class="obrigatorio">*</span></label>
        <div class="radio-group">
          ${dRadio('d-lumens', 'mono', 'Mono')}
          ${dRadio('d-lumens', 'duplo', 'Duplo')}
        </div>
      </div>
      ${statusSalInfFields()}
      ${dataField()}`;

    case 'Permcath': return `
      <div class="campo">
        <label>Local <span class="obrigatorio">*</span></label>
        <div class="radio-group vertical">
          ${['subclávia D','subclávia E','jugular D','jugular E','femoral D','femoral E'].map(l => dRadio('d-local', l, l)).join('')}
        </div>
      </div>
      ${statusSalOclFields()}
      ${dataField()}`;

    case 'Shilley': return `
      <div class="campo">
        <label>Local <span class="obrigatorio">*</span></label>
        <div class="radio-group vertical">
          ${['jugular D','jugular E','femoral D','femoral E'].map(l => dRadio('d-local', l, l)).join('')}
        </div>
      </div>
      ${statusSalOclFields()}
      ${dataField()}`;

    case 'SNE': return `
      <div class="campo">
        <label>Narina <span class="obrigatorio">*</span></label>
        <div class="radio-group">
          ${dRadio('d-narina', 'D', 'Direita')}
          ${dRadio('d-narina', 'E', 'Esquerda')}
        </div>
      </div>
      <div class="campo">
        <label>Marcação <span class="obrigatorio">*</span></label>
        <input type="number" id="d-marcacao" placeholder="65" min="1">
      </div>
      <div class="campo">
        <label>Status <span class="obrigatorio">*</span></label>
        <div class="radio-group">
          ${dRadio('d-status', 'aberta', 'Aberta')}
          ${dRadio('d-status', 'fechada', 'Fechada')}
        </div>
      </div>
      <div class="campo">
        <label>Dieta enteral <span class="obrigatorio">*</span></label>
        <div class="radio-group">
          ${dRadio('d-dieta', 'sim', 'Sim')}
          ${dRadio('d-dieta', 'nao', 'Não')}
        </div>
      </div>
      <div id="d-dieta-vel" style="display:none">
        <div class="campo">
          <label>Velocidade <span class="obrigatorio">*</span></label>
          <div class="input-suffix-wrap">
            <input type="number" id="d-vel-dieta" placeholder="60" min="1">
            <span class="input-suffix">ml/h</span>
          </div>
        </div>
      </div>`;

    case 'SNG': return `
      <div class="campo">
        <label>Narina <span class="obrigatorio">*</span></label>
        <div class="radio-group">
          ${dRadio('d-narina', 'D', 'Direita')}
          ${dRadio('d-narina', 'E', 'Esquerda')}
        </div>
      </div>
      <div class="campo">
        <label>Marcação <span class="obrigatorio">*</span></label>
        <input type="number" id="d-marcacao" placeholder="65" min="1">
      </div>
      <div class="campo">
        <label>Modo <span class="obrigatorio">*</span></label>
        <div class="radio-group vertical">
          ${dRadio('d-modo', 'aberta', 'Aberta')}
          ${dRadio('d-modo', 'fechada', 'Fechada')}
          ${dRadio('d-modo', 'dieta', 'Recebendo dieta enteral')}
          ${dRadio('d-modo', 'dren', 'Em drenagem (frasco coletor)')}
        </div>
      </div>
      <div id="d-sng-dieta" style="display:none">
        <div class="campo">
          <label>Velocidade <span class="obrigatorio">*</span></label>
          <div class="input-suffix-wrap">
            <input type="number" id="d-vel-dieta" placeholder="60" min="1">
            <span class="input-suffix">ml/h</span>
          </div>
        </div>
      </div>
      <div id="d-sng-dren" style="display:none">
        <div class="campo">
          <label>Débito <span class="obrigatorio">*</span></label>
          <div class="radio-group">
            ${dRadio('d-debito', 'sem', 'Sem débito')}
            ${dRadio('d-debito', 'com', 'Com débito')}
          </div>
        </div>
        <div id="d-debito-ml" style="display:none">
          <div class="campo">
            <div class="input-suffix-wrap">
              <input type="number" id="d-debito-val" placeholder="200" min="1">
              <span class="input-suffix">ml</span>
            </div>
          </div>
        </div>
        <div class="campo">
          <label>Aspecto <span class="obrigatorio">*</span></label>
          <input type="text" id="d-aspecto" placeholder="Ex: amarelado, esverdeado, bilioso">
        </div>
      </div>`;

    case 'Pulseira': return `
      <div class="campo">
        <label>Membro <span class="obrigatorio">*</span></label>
        <div class="radio-group">
          ${['MSE','MSD','MIE','MID'].map(m => dRadio('d-membro', m, m)).join('')}
        </div>
      </div>
      <div class="campo">
        <label>Tipos de pulseira <span class="obrigatorio">*</span> <span class="hint-inline">(pode marcar mais de uma)</span></label>
        <div class="radio-group vertical">
          <label class="checkbox-label"><input type="checkbox" name="d-pulseira" value="identificação"><span>Identificação</span></label>
          <label class="checkbox-label"><input type="checkbox" name="d-pulseira" value="risco de queda"><span>Risco de queda</span></label>
          <label class="checkbox-label"><input type="checkbox" name="d-pulseira" value="alergia"><span>Alergia</span></label>
          <label class="checkbox-label"><input type="checkbox" name="d-pulseira" value="precaução"><span>Precaução</span></label>
          <label class="checkbox-label"><input type="checkbox" name="d-pulseira" value="preservação de membro"><span>Preservação de membro</span></label>
        </div>
      </div>`;

    case 'Monitor': return `
      <div class="campo">
        <label>Tipo de monitorização <span class="obrigatorio">*</span></label>
        <div class="radio-group vertical">
          ${dRadio('d-monitor', 'monitor multiparamétrico', 'Monitor multiparamétrico')}
          ${dRadio('d-monitor', 'oxímetro de pulso', 'Oxímetro de pulso')}
          ${dRadio('d-monitor', 'monitor cardíaco', 'Monitor cardíaco')}
        </div>
      </div>`;

    case 'Dreno': return `
      <div class="campo">
        <label>Tipo do dreno <span class="obrigatorio">*</span></label>
        <input type="text" id="d-dreno-tipo" placeholder="Ex: tórax, abdominal, penrose, blake">
      </div>
      <div class="campo">
        <label>Localização <span class="obrigatorio">*</span></label>
        <input type="text" id="d-dreno-local" placeholder="Ex: flanco direito, hipocôndrio esquerdo">
      </div>
      <div class="campo">
        <label>Débito drenado</label>
        <div class="input-suffix-wrap">
          <input type="number" id="d-dreno-debito" min="0" placeholder="Ex: 350">
          <span class="input-suffix">ml</span>
        </div>
      </div>
      <div class="campo">
        <label>Aspecto / coloração <span class="obrigatorio">*</span></label>
        <input type="text" id="d-dreno-aspecto" placeholder="Ex: sanguinolento, serossanguinolento, seroso, bilioso">
      </div>
      <div class="campo">
        <label class="checkbox-label" style="margin-bottom:8px">
          <input type="checkbox" id="d-dreno-selo-cb">
          <span>Possui selo d'água</span>
        </label>
        <div id="d-dreno-selo-container" style="display:none">
          <label>Débito no selo d'água</label>
          <div class="input-suffix-wrap">
            <input type="number" id="d-dreno-selo-val" min="0" placeholder="Ex: 100">
            <span class="input-suffix">ml</span>
          </div>
        </div>
      </div>`;

    default: return `
      <div class="campo">
        <label>Dispositivo <span class="obrigatorio">*</span></label>
        <textarea id="d-dreno" rows="3" placeholder="Descreva o dispositivo"></textarea>
      </div>`;
  }
}

// — Conditionals dentro do modal —
function setupDispModalConditionals(tipo) {
  // Infusão checkbox (AVP, CVC, PICC)
  if (['AVP','CVC','PICC'].includes(tipo)) {
    const infCb = document.querySelector('#modal-disp-body #d-inf-cb');
    if (infCb) {
      infCb.addEventListener('change', () => {
        const inf = document.querySelector('#modal-disp-body #d-inf');
        if (inf) inf.style.display = infCb.checked ? 'block' : 'none';
      });
    }
  }

  // SNE dieta
  if (tipo === 'SNE') {
    $$('#modal-disp-body input[name="d-dieta"]').forEach(r => {
      r.addEventListener('change', () => {
        const vel = document.querySelector('#modal-disp-body #d-dieta-vel');
        if (vel) vel.style.display = r.value === 'sim' ? 'block' : 'none';
      });
    });
  }

  // SNG modo
  if (tipo === 'SNG') {
    $$('#modal-disp-body input[name="d-modo"]').forEach(r => {
      r.addEventListener('change', () => {
        const dieta = document.querySelector('#modal-disp-body #d-sng-dieta');
        const dren = document.querySelector('#modal-disp-body #d-sng-dren');
        if (dieta) dieta.style.display = r.value === 'dieta' ? 'block' : 'none';
        if (dren) dren.style.display = r.value === 'dren' ? 'block' : 'none';
      });
    });

    // Checkbox "Sem data" — esconde/mostra o campo de data
  const semDataCb = document.querySelector('#modal-disp-body #d-sem-data');
  if (semDataCb) {
    semDataCb.addEventListener('change', () => {
      const dataInput = document.querySelector('#modal-disp-body #d-data');
      if (dataInput) dataInput.style.display = semDataCb.checked ? 'none' : '';
    });
  }

  // SNG débito
    $$('#modal-disp-body input[name="d-debito"]').forEach(r => {
      r.addEventListener('change', () => {
        const ml = document.querySelector('#modal-disp-body #d-debito-ml');
        if (ml) ml.style.display = r.value === 'com' ? 'block' : 'none';
      });
    });
  }

  // Dreno — selo d'água
  if (tipo === 'Dreno') {
    const seloCb = document.querySelector('#modal-disp-body #d-dreno-selo-cb');
    if (seloCb) {
      seloCb.addEventListener('change', () => {
        const container = document.querySelector('#modal-disp-body #d-dreno-selo-container');
        if (container) container.style.display = seloCb.checked ? 'block' : 'none';
        if (!seloCb.checked) {
          const val = document.querySelector('#modal-disp-body #d-dreno-selo-val');
          if (val) val.value = '';
        }
      });
    }
  }

  // Datado — mostra datepicker ao marcar (AVP, CVC, PICC, Permcath, Shilley)
  if (['AVP','CVC','PICC','Permcath','Shilley'].includes(tipo)) {
    const datadoCb = document.querySelector('#modal-disp-body #d-datado');
    if (datadoCb) {
      datadoCb.addEventListener('change', () => {
        const container = document.querySelector('#modal-disp-body #d-data-container');
        if (container) container.style.display = datadoCb.checked ? 'block' : 'none';
        if (!datadoCb.checked) {
          const dataInput = document.querySelector('#modal-disp-body #d-data');
          if (dataInput) dataInput.value = dHoje();
        }
      });
    }
  }
}

// — Geração do texto —
function buildDispText(tipo) {
  const erro = (msg) => { $('#modal-disp-erro').textContent = msg; return null; };

  switch (tipo) {
    case 'AVP': {
      const local    = dModalRadio('d-local-avp');
      const isSal    = document.querySelector('#modal-disp-body #d-sal')?.checked;
      const isOcl    = document.querySelector('#modal-disp-body #d-ocl')?.checked;
      const isDatado = document.querySelector('#modal-disp-body #d-datado')?.checked;
      const isInf    = document.querySelector('#modal-disp-body #d-inf-cb')?.checked;
      const datePart = isDatado ? `, datado de ${dFormatDate(dModalGet('#d-data'))}` : '';
      if (!local) return erro('Selecione o local');
      if (isInf) {
        const sol = dModalGet('#d-sol');
        const vel = dModalGet('#d-vel');
        if (!sol) return erro('Informe a solução');
        if (!vel) return erro('Informe a velocidade');
        const parts = [];
        if (isSal) parts.push('salinizado');
        if (isOcl) parts.push('ocluído');
        const statusStr = parts.length ? ', ' + parts.join(' e ') : '';
        return `AVP em ${local}, recebendo ${sol} a ${vel}ml/h${statusStr}${datePart}`;
      }
      const parts = [];
      if (isSal) parts.push('salinizado');
      if (isOcl) parts.push('ocluído');
      const statusStr = parts.length ? ', ' + parts.join(' e ') : '';
      return `AVP em ${local}${statusStr}${datePart}`;
    }

    case 'CVC': {
      const local    = dModalRadio('d-local');
      const lumens   = dModalRadio('d-lumens');
      const isSal    = document.querySelector('#modal-disp-body #d-sal')?.checked;
      const isOcl    = document.querySelector('#modal-disp-body #d-ocl')?.checked;
      const isDatado = document.querySelector('#modal-disp-body #d-datado')?.checked;
      const isInf    = document.querySelector('#modal-disp-body #d-inf-cb')?.checked;
      const datePart = isDatado ? `, datado de ${dFormatDate(dModalGet('#d-data'))}` : '';
      if (!local)  return erro('Selecione o local');
      if (!lumens) return erro('Selecione os lúmens');
      const base = `CVC ${lumens} lúmen em ${local}`;
      if (isInf) {
        const sol = dModalGet('#d-sol');
        const vel = dModalGet('#d-vel');
        if (!sol) return erro('Informe a solução');
        if (!vel) return erro('Informe a velocidade');
        const parts = [];
        if (isSal) parts.push('salinizado');
        if (isOcl) parts.push('ocluído');
        const statusStr = parts.length ? ', ' + parts.join(' e ') : '';
        return `${base}, recebendo ${sol} a ${vel}ml/h${statusStr}${datePart}`;
      }
      const parts = [];
      if (isSal) parts.push('salinizado');
      if (isOcl) parts.push('ocluído');
      const statusStr = parts.length ? ', ' + parts.join(' e ') : '';
      return `${base}${statusStr}${datePart}`;
    }

    case 'PICC': {
      const membro   = dModalRadio('d-membro');
      const lumens   = dModalRadio('d-lumens');
      const isSal    = document.querySelector('#modal-disp-body #d-sal')?.checked;
      const isOcl    = document.querySelector('#modal-disp-body #d-ocl')?.checked;
      const isDatado = document.querySelector('#modal-disp-body #d-datado')?.checked;
      const isInf    = document.querySelector('#modal-disp-body #d-inf-cb')?.checked;
      const datePart = isDatado ? `, datado de ${dFormatDate(dModalGet('#d-data'))}` : '';
      if (!membro) return erro('Selecione o membro');
      if (!lumens) return erro('Selecione os lúmens');
      const base = `PICC ${lumens} lúmen em ${membro}`;
      if (isInf) {
        const sol = dModalGet('#d-sol');
        const vel = dModalGet('#d-vel');
        if (!sol) return erro('Informe a solução');
        if (!vel) return erro('Informe a velocidade');
        const parts = [];
        if (isSal) parts.push('salinizado');
        if (isOcl) parts.push('ocluído');
        const statusStr = parts.length ? ', ' + parts.join(' e ') : '';
        return `${base}, recebendo ${sol} a ${vel}ml/h${statusStr}${datePart}`;
      }
      const parts = [];
      if (isSal) parts.push('salinizado');
      if (isOcl) parts.push('ocluído');
      const statusStr = parts.length ? ', ' + parts.join(' e ') : '';
      return `${base}${statusStr}${datePart}`;
    }

    case 'Permcath': {
      const local    = dModalRadio('d-local');
      const isSal    = document.querySelector('#modal-disp-body #d-sal')?.checked;
      const isOcl    = document.querySelector('#modal-disp-body #d-ocl')?.checked;
      const isDatado = document.querySelector('#modal-disp-body #d-datado')?.checked;
      const datePart = isDatado ? `, datado de ${dFormatDate(dModalGet('#d-data'))}` : '';
      if (!local) return erro('Selecione o local');
      const parts = [];
      if (isSal) parts.push('salinizado');
      if (isOcl) parts.push('ocluído');
      const statusStr = parts.length ? ', ' + parts.join(' e ') : '';
      return `Permcath em ${local}${statusStr}${datePart}`;
    }

    case 'Shilley': {
      const local    = dModalRadio('d-local');
      const isSal    = document.querySelector('#modal-disp-body #d-sal')?.checked;
      const isOcl    = document.querySelector('#modal-disp-body #d-ocl')?.checked;
      const isDatado = document.querySelector('#modal-disp-body #d-datado')?.checked;
      const datePart = isDatado ? `, datado de ${dFormatDate(dModalGet('#d-data'))}` : '';
      if (!local) return erro('Selecione o local');
      const parts = [];
      if (isSal) parts.push('salinizado');
      if (isOcl) parts.push('ocluído');
      const statusStr = parts.length ? ', ' + parts.join(' e ') : '';
      return `Shilley em ${local}${statusStr}${datePart}`;
    }

    case 'SNE': {
      const narina = dModalRadio('d-narina');
      const marc = dModalGet('#d-marcacao');
      const status = dModalRadio('d-status');
      const dieta = dModalRadio('d-dieta');
      if (!narina) return erro('Selecione a narina');
      if (!marc) return erro('Informe a marcação');
      if (!status) return erro('Selecione o status');
      if (!dieta) return erro('Informe sobre dieta enteral');
      let txt = `SNE em narina ${narina}, marcação ${marc}, ${status}`;
      if (dieta === 'sim') {
        const vel = dModalGet('#d-vel-dieta');
        if (!vel) return erro('Informe a velocidade da dieta');
        txt += `, recebendo dieta enteral a ${vel}ml/h`;
      }
      return txt;
    }

    case 'SNG': {
      const narina = dModalRadio('d-narina');
      const marc = dModalGet('#d-marcacao');
      const modo = dModalRadio('d-modo');
      if (!narina) return erro('Selecione a narina');
      if (!marc) return erro('Informe a marcação');
      if (!modo) return erro('Selecione o modo');
      const base = `SNG em narina ${narina}, marcação ${marc}`;
      if (modo === 'aberta') return `${base}, aberta`;
      if (modo === 'fechada') return `${base}, fechada`;
      if (modo === 'dieta') {
        const vel = dModalGet('#d-vel-dieta');
        if (!vel) return erro('Informe a velocidade da dieta');
        return `${base}, aberta, recebendo dieta enteral a ${vel}ml/h`;
      }
      if (modo === 'dren') {
        const debito = dModalRadio('d-debito');
        const aspecto = dModalGet('#d-aspecto');
        if (!debito) return erro('Informe o débito');
        if (!aspecto) return erro('Informe o aspecto');
        const debStr = debito === 'sem' ? 'sem débito' : `débito de ${dModalGet('#d-debito-val')}ml`;
        return `${base}, aberta com frasco coletor, ${debStr}, de aspecto ${aspecto}`;
      }
      return null;
    }

    case 'Pulseira': {
      const membro = dModalRadio('d-membro');
      const tipos = [...document.querySelectorAll('#modal-disp-body input[name="d-pulseira"]:checked')]
        .map(cb => cb.value);
      if (!membro) return erro('Selecione o membro');
      if (tipos.length === 0) return erro('Selecione pelo menos um tipo de pulseira');
      const tiposStr = tipos.join(', ');
      return `Pulseira${tipos.length > 1 ? 's' : ''} em ${membro}: ${tiposStr}`;
    }

    case 'Monitor': {
      const tipo = dModalRadio('d-monitor');
      if (!tipo) return erro('Selecione o tipo de monitorização');
      return `em monitorização com ${tipo}`;
    }

    case 'Dreno': {
      const tipo    = dModalGet('#d-dreno-tipo');
      const local   = dModalGet('#d-dreno-local');
      const aspecto = dModalGet('#d-dreno-aspecto');
      if (!tipo)    return erro('Informe o tipo do dreno');
      if (!local)   return erro('Informe a localização');
      if (!aspecto) return erro('Informe o aspecto/coloração');
      const debito  = dModalGet('#d-dreno-debito');
      const seloCheck = document.querySelector('#modal-disp-body #d-dreno-selo-cb')?.checked;
      const seloVal   = dModalGet('#d-dreno-selo-val');
      let txt = `Dreno de ${tipo} em ${local}`;
      if (debito) txt += `, com débito de ${debito}ml`;
      txt += `, de coloração ${aspecto}`;
      if (seloCheck) {
        txt += seloVal ? `, selo d'água em ${seloVal}ml` : `, selo d'água`;
      }
      return txt;
    }

    default: {
      const txt = dModalGet('#d-dreno');
      if (!txt) return erro('Descreva o dispositivo');
      return txt;
    }
  }
}

function renderDispositivos() {
  const lista = els.dispositivosLista;
  lista.innerHTML = '';

  state.dispositivos.forEach((disp, i) => {
    const item = document.createElement('div');
    item.className = 'dispositivo-item';
    item.draggable = true;
    item.dataset.index = i;

    item.innerHTML = `
      <div class="disp-handle" aria-label="Arrastar">&#9776;</div>
      <div class="disp-text">${escapeHtml(disp)}</div>
      <button type="button" class="disp-remove" data-index="${i}" aria-label="Remover">&times;</button>
    `;

    // Drag events
    item.addEventListener('dragstart', (e) => {
      state.dragSrcIndex = i;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      $$('.dispositivo-item').forEach(el => el.classList.remove('drag-over'));
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const from = state.dragSrcIndex;
      const to = i;
      if (from !== null && from !== to) {
        const moved = state.dispositivos.splice(from, 1)[0];
        state.dispositivos.splice(to, 0, moved);
        renderDispositivos();
      }
    });

    // Touch drag
    let touchCurrentItem = null;
    const handle = item.querySelector('.disp-handle');

    handle.addEventListener('touchstart', (e) => {
      touchCurrentItem = item;
      item.classList.add('dragging');
      state.dragSrcIndex = i;
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      [...$$('.dispositivo-item')].forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        el.classList.toggle('drag-over', touchY > rect.top && touchY < rect.bottom && idx !== state.dragSrcIndex);
      });
    }, { passive: false });

    handle.addEventListener('touchend', (e) => {
      const touchY = e.changedTouches[0].clientY;
      const items = [...$$('.dispositivo-item')];
      let targetIndex = -1;
      items.forEach((el, idx) => {
        el.classList.remove('drag-over');
        const rect = el.getBoundingClientRect();
        if (touchY > rect.top && touchY < rect.bottom) targetIndex = idx;
      });
      if (touchCurrentItem) touchCurrentItem.classList.remove('dragging');
      if (targetIndex >= 0 && targetIndex !== state.dragSrcIndex) {
        const moved = state.dispositivos.splice(state.dragSrcIndex, 1)[0];
        state.dispositivos.splice(targetIndex, 0, moved);
        renderDispositivos();
      }
    });

    // Remover
    item.querySelector('.disp-remove').addEventListener('click', () => {
      state.dispositivos.splice(i, 1);
      renderDispositivos();
    });

    lista.appendChild(item);
  });
}

// ===== VALIDATION =====
function validateBloco(num) {
  const erroEl = $(`#erro-bloco${num}`);
  if (erroEl) erroEl.textContent = '';

  // Clear all invalid states in current bloco
  $$(`#bloco-${num} .campo.invalido`).forEach(c => c.classList.remove('invalido'));

  switch (num) {
    case 1:
      return validateBloco1();
    case 2:
      return validateBloco2();
    case 3:
      return true; // dispositivos always optional
    case 4:
      return validateBloco4();
    case 5:
      return true;
    default:
      return true;
  }
}

function validateBloco1() {
  const erros = [];

  if (!getRadioValue('sexo')) {
    erros.push('Selecione o sexo do paciente');
  }

  const horario = $('#horario');
  if (!horario.value) {
    erros.push('Horário é obrigatório');
    horario.closest('.campo').classList.add('invalido');
  }

  const campos = ['posicao-cama', 'rodas', 'grades', 'decubito'];
  campos.forEach(name => {
    if (!getRadioValue(name)) {
      erros.push(`Selecione ${name.replace('-', ' ')}`);
    }
  });

  if (erros.length) {
    $('#erro-bloco1').textContent = erros[0];
    return false;
  }
  return true;
}

function validateBloco2() {
  const erros = [];

  // Mental state
  if ($('#mental-alterado').checked && !$('#mental-desc').value.trim()) {
    erros.push('Descreva o estado mental observado');
    $('#mental-desc').closest('.campo').classList.add('invalido');
  }

  // Colaboracao
  if (!getRadioValue('colaboracao')) {
    erros.push('Selecione colaboração');
  }

  // Deambulacao
  const deamb = getRadioValue('deambulacao');
  if (!deamb) {
    erros.push('Selecione deambulação');
  } else if (deamb === 'deambula com auxílio' && !$('#deambula-auxilio').value.trim()) {
    erros.push('Especifique o tipo de auxílio');
    $('#deambula-auxilio').closest('.campo').classList.add('invalido');
  }

  // Respiracao
  const resp = getRadioValue('respiracao');
  if (!resp) {
    erros.push('Selecione respiração');
  } else if (resp === 'cateter nasal de O₂' || resp === 'máscara de O₂') {
    if (!$('#oxigenio-litros').value) {
      erros.push('Informe os litros por minuto');
      $('#oxigenio-litros').closest('.campo').classList.add('invalido');
    }
    if (!document.querySelector('input[name="resp-padrao"]:checked')) {
      erros.push('Selecione o padrão respiratório');
      $('#resp-padrao-container').classList.add('invalido');
    }
  }
  // padrão respiratório é opcional para ar ambiente

  // Acompanhante
  const acomp = getRadioValue('acompanhante');
  if (!acomp) {
    erros.push('Selecione acompanhante');
  } else if (acomp === 'sim') {
    if (!$('#acompanhante-nome').value.trim()) {
      erros.push('Informe o nome do acompanhante');
      $('#acompanhante-nome').closest('.campo').classList.add('invalido');
    }
    if (!$('#acompanhante-parentesco').value.trim()) {
      erros.push('Informe o parentesco');
      $('#acompanhante-parentesco').closest('.campo').classList.add('invalido');
    }
  }

  if (erros.length) {
    $('#erro-bloco2').textContent = erros[0];
    return false;
  }
  return true;
}

function validateBloco4() {
  const erros = [];

  const evacOpcao = getRadioValue('evacuacao-opcao');
  if (!evacOpcao) {
    erros.push('Informe a última evacuação');
  } else if (evacOpcao === 'data' && !$('#evacuacao-data').value) {
    erros.push('Selecione a data da última evacuação');
    $('#evacuacao-data').closest('.campo').classList.add('invalido');
  }

  const diureseChecked = getCheckedValues('diurese');
  if (diureseChecked.length === 0) {
    erros.push('Selecione ao menos uma opção de diurese');
  } else if (diureseChecked.includes('SVD') && !$('#svd-debito').value.trim()) {
    erros.push('Informe o débito da SVD');
    $('#svd-debito').closest('.campo').classList.add('invalido');
  }

  if (erros.length) {
    $('#erro-bloco4').textContent = erros[0];
    return false;
  }
  return true;
}

// ===== TEXT GENERATION =====
function formatHorario(timeValue) {
  // Convert "14:00" to "14h00"
  return timeValue.replace(':', 'h');
}

function gerarTexto() {
  const parts = [];

  // BLOCO 1 - Abertura
  const horario = formatHorario($('#horario').value);
  const posicao = getRadioValue('posicao-cama');
  const rodas = getRadioValue('rodas');
  const grades = getRadioValue('grades');
  const decubito = getRadioValue('decubito');

  parts.push(`${horario} \u2013 Recebo plant\u00e3o com paciente em seu leito com cama ${posicao}, rodas ${rodas}, grades ${grades} e dec\u00fabito ${decubito}.`);

  // BLOCO 2 - Apresenta
  // Mental state is separate — ends with period if present
  const mentalAlterado = $('#mental-alterado').checked;
  if (mentalAlterado) {
    const descMental = $('#mental-desc').value.trim();
    parts.push(`Aparentemente ${descMental}.`);
  }

  // Remaining apresenta items flow together
  const apresentaParts = [];

  // Colaboracao — lowercase "sendo" because it flows mid-text
  const colaboracao = getRadioValue('colaboracao');
  apresentaParts.push(colaboracao);

  // Deambulacao — "nao deambula" omite do texto
  const deamb = getRadioValue('deambulacao');
  if (deamb === 'deambula com auxílio') {
    const auxilio = $('#deambula-auxilio').value.trim();
    apresentaParts.push(`deambula com auxílio de ${auxilio}`);
  } else if (deamb === 'não deambula') {
    // omite do texto
  } else {
    apresentaParts.push(deamb);
  }

  // Respiracao
  const resp   = getRadioValue('respiracao');
  const genero = getGenero();
  const padraoEl  = document.querySelector('input[name="resp-padrao"]:checked');
  const padraoVal = padraoEl
    ? (genero === 'M' ? (padraoEl.dataset.mValue || padraoEl.value) : (padraoEl.dataset.fValue || padraoEl.value))
    : '';

  if (resp === 'cateter nasal de O₂' || resp === 'máscara de O₂') {
    const litros = $('#oxigenio-litros').value;
    const padraoTxt = padraoVal ? `, ${padraoVal}` : '';
    apresentaParts.push(`em ${resp} a ${litros}L/min${padraoTxt}`);
  } else if (resp === 'eupneica em ar ambiente' && padraoVal && padraoVal !== 'eupneica' && padraoVal !== 'eupneico') {
    // Paciente em ar ambiente mas com padrão alterado (ex: dispneica em ar ambiente)
    apresentaParts.push(`${padraoVal} em ar ambiente`);
  } else if (resp === 'eupneica em ar ambiente') {
    apresentaParts.push(resp);
  } else {
    // ventilação mecânica ou outro
    apresentaParts.push(resp);
  }

  // Acompanhante
  const acomp = getRadioValue('acompanhante');
  if (acomp === 'sim') {
    const nome = $('#acompanhante-nome').value.trim();
    const parentesco = $('#acompanhante-parentesco').value.trim();
    const acompGen = getGenero() === 'M' ? 'acompanhado' : 'acompanhada';
    apresentaParts.push(`${acompGen} de ${parentesco} ${nome}`);
  }

  // Obs do bloco 2 — entra na frase do Apresenta com "apresenta ..."
  const obsApresenta = $('#obs-apresenta').value.trim();
  if (obsApresenta) {
    const obsLower = obsApresenta.charAt(0).toLowerCase() + obsApresenta.slice(1);
    apresentaParts.push(`apresenta ${obsLower}`);
  }

  // Monta o texto do Apresenta (ainda não empurra — ordem MAR)
  let apresentaText = apresentaParts.join(', ');
  apresentaText = apresentaText.charAt(0).toUpperCase() + apresentaText.slice(1);

  // BLOCO 3 - Mantém vem ANTES do Apresenta (ordem M-A-R)
  if (state.dispositivos.length > 0) {
    const dispTexto = state.dispositivos.map((d, i) => {
      if (i === 0) return `Mant\u00e9m ${d}`;
      return d;
    }).join('; ');
    parts.push(dispTexto + '.');
  }

  // Apresenta vem depois do Mantém
  parts.push(apresentaText + '.');

  // BLOCO 4 - Refere
  const refereParts = [];

  const evacOpcao = getRadioValue('evacuacao-opcao');
  if (evacOpcao === 'hoje') {
    refereParts.push('Refere \u00faltima evacua\u00e7\u00e3o hoje');
  } else if (evacOpcao === 'ontem') {
    refereParts.push('Refere \u00faltima evacua\u00e7\u00e3o ontem');
  } else if (evacOpcao === 'data') {
    const dataEvac = $('#evacuacao-data').value;
    if (dataEvac) {
      const [ano, mes, dia] = dataEvac.split('-');
      refereParts.push(`Refere \u00faltima evacua\u00e7\u00e3o em ${dia}/${mes}`);
    }
  } else if (evacOpcao === 'nao-avaliado') {
    refereParts.push('Evacua\u00e7\u00e3o n\u00e3o avaliada');
  }

  const diureseVals = getCheckedValues('diurese');
  if (diureseVals.includes('não avaliado')) {
    refereParts.push('diurese n\u00e3o avaliada');
  } else {
    const diuTexts = diureseVals.map(d => {
      if (d === 'SVD') {
        const debito = $('#svd-debito').value.trim();
        return `SVD com d\u00e9bito presente de ${debito}ml`;
      }
      if (d === 'banheiro')  return 'diurese espontânea ao banheiro';
      if (d === 'papagaio')  return 'diurese espontânea em uso de papagaio';
      if (d === 'comadre')   return 'diurese espontânea em uso de comadre';
      if (d === 'fralda')    return 'diurese em fralda';
      return d;
    });
    // Filtra os que já têm "diurese" no texto (banheiro/papagaio/comadre/fralda)
    const completos = diuTexts.filter(t => t.startsWith('diurese') || t.startsWith('SVD'));
    const simples   = diuTexts.filter(t => !t.startsWith('diurese') && !t.startsWith('SVD'));
    if (completos.length > 0) {
      refereParts.push(...completos);
    }
    if (simples.length > 0) {
      if (simples.length === 1) {
        refereParts.push(`diurese em ${simples[0]}`);
      } else {
        const last = simples[simples.length - 1];
        refereParts.push(`diurese em ${simples.slice(0, -1).join(', ')} e ${last}`);
      }
    }
  }

  // Queixas do bloco 4 — entram na frase Refere
  const queixas = $('#queixas').value.trim();
  if (queixas) {
    const queixasLower = queixas.charAt(0).toLowerCase() + queixas.slice(1);
    refereParts.push(queixasLower);
  }

  parts.push(refereParts.join(', ') + '.');

  // BLOCO 5 - Fechamento (usa o valor editável do textarea)
  const fechamentoEditado = els.fechamentoPreview.value.trim();
  parts.push(fechamentoEditado || `Mantenho cama ${posicao}, rodas ${rodas}, grades ${grades} e dec\u00fabito ${decubito}, campainha pr\u00f3xima e oriento a chamar sempre que necess\u00e1rio.`);

  return parts.join(' ');
}

function updateFechamentoPreview() {
  const posicao = getRadioValue('posicao-cama') || '___';
  const rodas = getRadioValue('rodas') || '___';
  const grades = getRadioValue('grades') || '___';
  const decubito = getRadioValue('decubito') || '___';

  els.fechamentoPreview.value = `Mantenho cama ${posicao}, rodas ${rodas}, grades ${grades} e dec\u00fabito ${decubito}, campainha pr\u00f3xima e oriento a chamar sempre que necess\u00e1rio.`;
}

// ===== PREVIEW =====
function setupPreview() {
  $('#btn-copiar').addEventListener('click', () => {
    copyText(els.previewText.textContent);
  });

  $('#btn-salvar').addEventListener('click', () => {
    const nomePaciente = $('#nome-paciente').value.trim();
    const leitoPaciente = $('#leito-paciente').value.trim();
    salvarAnotacao(els.previewText.textContent, nomePaciente, 'recebimento', leitoPaciente);
    clearDraft();
    showToast('Anotação salva!');
  });

  $('#btn-nova').addEventListener('click', () => {
    resetForm();
  });

  // Voltar ao formulário sem apagar
  $('#btn-voltar-preview').addEventListener('click', () => {
    showForm();
    goToBloco(5);
    window.scrollTo({ top: 0 });
  });

  $('#btn-whatsapp').addEventListener('click', () => {
    const texto = els.previewText.textContent;
    const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(texto);
    window.open(url, '_blank');
  });
}

function hideAllScreens() {
  els.header.style.display        = 'none';
  els.main.style.display          = 'none';
  els.previewScreen.style.display = 'none';
  els.historicoScreen.style.display = 'none';
  els.svScreen.style.display      = 'none';
  els.pcScreen.style.display      = 'none';
}

function showPreview() {
  const texto = gerarTexto();
  els.previewText.textContent = texto;
  hideAllScreens();
  els.previewScreen.style.display = 'block';
  window.scrollTo({ top: 0 });
}

function showForm() {
  hideAllScreens();
  els.header.style.display = 'block';
  els.main.style.display   = 'block';
  // Recalcular largura dos blocos após exibir o main
  requestAnimationFrame(() => updateBlocoView());
}

function showPCMode() {
  hideAllScreens();
  els.pcScreen.style.display = 'block';
}

// ===== HISTORICO =====
let histFiltroAtivo = 'todos';

function setupHistorico() {
  $('#btn-historico').addEventListener('click', showHistorico);
  $('#btn-voltar-historico').addEventListener('click', showForm);

  // Botão Sair (celular)
  $('#btn-sair-celular').addEventListener('click', () => {
    showConfirm('Deseja sair da sua conta? Você precisará do seu código e PIN para entrar novamente.', () => {
      clearSession();
      showLogin();
    });
  });

  // Revelar/ocultar código no banner
  let codigoRevelado = false;
  $('#btn-revelar-codigo').addEventListener('click', () => {
    const code = localStorage.getItem('sync_code') || '????';
    const display = $('#sync-code-display');
    codigoRevelado = !codigoRevelado;
    display.textContent = codigoRevelado ? code : maskCode(code);
    $('#icon-eye-show').style.display = codigoRevelado ? 'none' : '';
    $('#icon-eye-hide').style.display = codigoRevelado ? '' : 'none';
    // Auto-oculta após 5 segundos
    if (codigoRevelado) {
      setTimeout(() => {
        codigoRevelado = false;
        if (display) display.textContent = maskCode(code);
        const s = $('#icon-eye-show'); const h = $('#icon-eye-hide');
        if (s) s.style.display = ''; if (h) h.style.display = 'none';
      }, 5000);
    }
  });

  $('#btn-copiar-codigo').addEventListener('click', () => {
    const code = (window.getSyncCode && window.getSyncCode()) || localStorage.getItem('sync_code') || '';
    copyText(code);
    const btn = $('#btn-copiar-codigo');
    btn.style.background = 'rgba(67, 160, 71, 0.25)';
    btn.style.borderColor = '#43A047';
    btn.style.color = '#43A047';
    setTimeout(() => {
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 1800);
  });

  // Busca em tempo real
  $('#hist-busca').addEventListener('input', () => renderHistorico());

  // Filtros de data
  $$('.btn-filtro').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.btn-filtro').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      histFiltroAtivo = btn.dataset.filtro;
      renderHistorico();
    });
  });
}

function maskCode(code) {
  if (!code || code === '????') return '????';
  const visible = Math.max(1, Math.floor(code.length / 2));
  return code.slice(0, visible) + '*'.repeat(code.length - visible);
}

function showHistorico() {
  hideAllScreens();
  els.historicoScreen.style.display = 'block';

  // Mostra o código mascarado por padrão
  const codeEl = $('#sync-code-display');
  if (codeEl) {
    const code = localStorage.getItem('sync_code') || '????';
    codeEl.textContent = maskCode(code);
  }

  renderHistorico();
  window.scrollTo({ top: 0 });
}

function renderHistorico() {
  const lista = els.historicoScreen.querySelector('#historico-lista');
  let anotacoes = getAnotacoes();

  if (anotacoes.length === 0) {
    lista.innerHTML = '<div class="historico-vazio">Nenhuma anotação salva ainda</div>';
    return;
  }

  anotacoes.sort((a, b) => b.timestamp - a.timestamp);

  // Filtro por data
  const agora = Date.now();
  const inicioDia   = new Date(); inicioDia.setHours(0,0,0,0);
  const inicioSemana = new Date(); inicioSemana.setDate(inicioSemana.getDate() - 7); inicioSemana.setHours(0,0,0,0);

  if (histFiltroAtivo === 'hoje') {
    anotacoes = anotacoes.filter(a => a.timestamp >= inicioDia.getTime());
  } else if (histFiltroAtivo === 'semana') {
    anotacoes = anotacoes.filter(a => a.timestamp >= inicioSemana.getTime());
  }

  // Filtro por busca
  const busca = ($('#hist-busca') || {}).value || '';
  if (busca.trim()) {
    const termo = busca.toLowerCase();
    anotacoes = anotacoes.filter(a =>
      (a.nome || '').toLowerCase().includes(termo) ||
      (a.texto || '').toLowerCase().includes(termo)
    );
  }

  if (anotacoes.length === 0) {
    lista.innerHTML = '<div class="historico-vazio">Nenhuma anotação encontrada</div>';
    return;
  }

  lista.innerHTML = '';

  anotacoes.forEach((anot, i) => {
    const item = document.createElement('div');
    item.className = 'historico-item';

    const date = new Date(anot.timestamp);
    const dateStr = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const nomeLeito = [anot.nome, anot.leito ? 'Leito ' + anot.leito : ''].filter(Boolean).join(' — ');
    const nomeLine = nomeLeito ? `<div class="hist-nome">${escapeHtml(nomeLeito)}</div>` : '';
    const preview = anot.texto.substring(0, 80) + (anot.texto.length > 80 ? '...' : '');
    const isSV = anot.tipo === 'sv';
    const tipoBadge = isSV
      ? `<span class="hist-tipo hist-tipo-sv">❤️ Sinais Vitais</span>`
      : `<span class="hist-tipo hist-tipo-rec">📋 Recebimento</span>`;

    item.innerHTML = `
      <div class="hist-header-row">
        <div class="hist-date">${dateStr}</div>
        ${tipoBadge}
      </div>
      ${nomeLine}
      <div class="hist-preview">${escapeHtml(preview)}</div>
    `;

    item.addEventListener('click', () => {
      openModal(anot);
    });

    lista.appendChild(item);
  });
}

// ===== MODAL =====
let currentModalAnot = null;

function setupModal() {
  $('#modal-close').addEventListener('click', closeModal);
  els.modalOverlay.addEventListener('click', (e) => {
    if (e.target === els.modalOverlay) closeModal();
  });

  $('#modal-copiar').addEventListener('click', () => {
    if (currentModalAnot) {
      copyText(currentModalAnot.texto);
    }
  });

  $('#modal-whatsapp').addEventListener('click', () => {
    if (currentModalAnot) {
      const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(currentModalAnot.texto);
      window.open(url, '_blank');
    }
  });

  $('#modal-editar').addEventListener('click', () => {
    if (!currentModalAnot) return;
    const editArea = $('#modal-edit-area');
    const isOpen = editArea.style.display !== 'none';
    if (isOpen) {
      editArea.style.display = 'none';
    } else {
      $('#modal-edit-nome').value  = currentModalAnot.nome  || '';
      $('#modal-edit-leito').value = currentModalAnot.leito || '';
      editArea.style.display = 'block';
      $('#modal-edit-nome').focus();
    }
  });

  $('#modal-edit-salvar').addEventListener('click', () => {
    if (!currentModalAnot) return;
    const novoNome  = $('#modal-edit-nome').value.trim();
    const novoLeito = $('#modal-edit-leito').value.trim();
    const atualizado = editarIdentificacaoAnotacao(currentModalAnot.timestamp, novoNome, novoLeito);
    if (atualizado) {
      currentModalAnot = atualizado;
      // Atualiza o título do modal
      const tituloPartes = [atualizado.nome, atualizado.leito].filter(Boolean);
      $('#modal-title').textContent = tituloPartes.length ? tituloPartes.join(' — Leito ') : 'Anotação';
      $('#modal-edit-area').style.display = 'none';
      renderHistorico();
      showToast('Identificação atualizada!');
    }
  });

  $('#modal-deletar').addEventListener('click', () => {
    if (currentModalAnot) {
      showConfirm('Tem certeza que deseja deletar esta anotação?', () => {
        deletarAnotacao(currentModalAnot.timestamp);
        closeModal();
        renderHistorico();
        showToast('Anotação deletada');
      });
    }
  });

  $('#confirm-no').addEventListener('click', closeConfirm);
}

function openModal(anot) {
  currentModalAnot = anot;
  const tituloPartes = [anot.nome, anot.leito ? 'Leito ' + anot.leito : ''].filter(Boolean);
  $('#modal-title').textContent = tituloPartes.length ? tituloPartes.join(' — ') : 'Anotação';
  els.modalText.textContent = anot.texto;
  $('#modal-edit-area').style.display = 'none';
  els.modalOverlay.style.display = 'flex';
}

function closeModal() {
  els.modalOverlay.style.display = 'none';
  currentModalAnot = null;
}

let confirmCallback = null;

function showConfirm(msg, cb) {
  els.confirmMsg.textContent = msg;
  confirmCallback = cb;
  els.confirmOverlay.style.display = 'flex';

  // Re-bind yes button
  $('#confirm-yes').onclick = () => {
    const cb = confirmCallback;
    closeConfirm();
    if (cb) cb();
  };
}

function closeConfirm() {
  els.confirmOverlay.style.display = 'none';
  confirmCallback = null;
}

// ===== STORAGE =====
function getAnotacoes() {
  try {
    return JSON.parse(localStorage.getItem('anotacoes_hc') || '[]');
  } catch {
    return [];
  }
}

function salvarAnotacao(texto, nomePaciente, tipo, leito) {
  const anot = {
    texto,
    nome: nomePaciente || '',
    leito: leito || '',
    timestamp: Date.now(),
    tipo: tipo || 'recebimento'
  };
  const anotacoes = getAnotacoes();
  anotacoes.push(anot);
  localStorage.setItem('anotacoes_hc', JSON.stringify(anotacoes));

  // Sync Firebase (se configurado)
  if (window.syncSaveAnnotation) window.syncSaveAnnotation(anot);
}

function editarIdentificacaoAnotacao(timestamp, novoNome, novoLeito) {
  let anotacoes = getAnotacoes();
  const idx = anotacoes.findIndex(a => a.timestamp === timestamp);
  if (idx === -1) return false;
  anotacoes[idx].nome  = novoNome  !== undefined ? novoNome  : anotacoes[idx].nome;
  anotacoes[idx].leito = novoLeito !== undefined ? novoLeito : anotacoes[idx].leito;
  localStorage.setItem('anotacoes_hc', JSON.stringify(anotacoes));
  // Re-sync para Firebase
  if (window.syncSaveAnnotation) window.syncSaveAnnotation(anotacoes[idx]);
  return anotacoes[idx];
}

function deletarAnotacao(timestamp) {
  let anotacoes = getAnotacoes();
  anotacoes = anotacoes.filter(a => a.timestamp !== timestamp);
  localStorage.setItem('anotacoes_hc', JSON.stringify(anotacoes));
  // Apagar também do Firebase
  if (window.syncDeleteAnnotation) {
    window.syncDeleteAnnotation(timestamp);
  }
}

function cleanupOldAnnotations(dias) {
  const limite = (dias || 60) * 24 * 60 * 60 * 1000;
  const agora  = Date.now();
  let anotacoes = getAnotacoes();
  const antigas = anotacoes.filter(a => (agora - a.timestamp) > limite);
  if (antigas.length === 0) return;
  const novas = anotacoes.filter(a => (agora - a.timestamp) <= limite);
  localStorage.setItem('anotacoes_hc', JSON.stringify(novas));
  // Apagar do Firebase também
  antigas.forEach(a => {
    if (window.syncDeleteAnnotation) window.syncDeleteAnnotation(a.timestamp);
  });
  console.log(`[Cleanup] ${antigas.length} anotação(ões) com mais de ${dias} dias removida(s).`);
}

// ===== CLIPBOARD =====
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Texto copiado!');
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Texto copiado!');
  }
}

// ===== TOAST =====
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  setTimeout(() => {
    els.toast.classList.remove('show');
  }, 2000);
}

// ===== RESET =====
function resetForm() {
  // Reset all inputs
  $$('input[type="text"], input[type="time"], input[type="number"], textarea').forEach(input => {
    input.value = '';
  });

  // Reset radios
  $$('input[type="radio"]').forEach(radio => {
    radio.checked = false;
  });

  // Reset checkboxes
  $$('input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  // Hide conditionals
  $$('.condicional').forEach(el => {
    el.style.display = 'none';
  });

  // Clear dispositivos
  state.dispositivos = [];
  renderDispositivos();

  // Clear errors
  $$('.erro-msg').forEach(el => {
    el.textContent = '';
  });
  $$('.campo.invalido').forEach(el => {
    el.classList.remove('invalido');
  });

  // Limpa rascunho
  clearDraft();

  // Go to bloco 1
  state.blocoAtual = 1;
  showForm();
  updateBlocoView();
}

// ===== SINAIS VITAIS =====
function setupSV() {
  // Abrir tela SV
  $('#btn-sv').addEventListener('click', () => {
    showSV();
  });

  // Voltar
  $('#btn-voltar-sv').addEventListener('click', () => {
    hideSV();
  });

  // Algias: mostrar campo de dor
  $$('input[name="sv-algias"]').forEach(r => {
    r.addEventListener('change', () => {
      const dorContainer = $('#sv-dor-container');
      dorContainer.style.display = r.value === 'refere' ? 'block' : 'none';
      if (r.value !== 'refere') $('#sv-dor-desc').value = '';
    });
  });

  // Gerar
  $('#btn-gerar-sv').addEventListener('click', () => {
    const texto = gerarTextoSV();
    if (!texto) return;
    mostrarPreviewSV(texto);
  });
}

function showSV() {
  hideAllScreens();
  els.svScreen.style.display = 'block';
  window.scrollTo({ top: 0 });
}

function hideSV() {
  // Restaurar form SV para próxima abertura
  const svPreview = $('#sv-preview-area');
  if (svPreview) svPreview.style.display = 'none';
  const svForm = document.querySelector('.sv-form');
  if (svForm) svForm.style.display = '';
  $('#sv-erro').textContent = '';

  showForm(); // usa hideAllScreens + mostra header/main corretamente
  updateBlocoView(); // garante que os blocos têm tamanho e posição corretos
}

function gerarTextoSV() {
  const erro = (msg) => { $('#sv-erro').textContent = msg; return null; };
  $('#sv-erro').textContent = '';

  const horario = $('#sv-horario').value;
  if (!horario) return erro('Informe o horário');

  const h = formatHorario(horario);

  // Coletar sinais
  const paSis  = $('#sv-pa-sis').value.trim();
  const paDia  = $('#sv-pa-dia').value.trim();
  const pam    = $('#sv-pam').value.trim();
  const fc     = $('#sv-fc').value.trim();
  const fr     = $('#sv-fr').value.trim();
  const temp   = $('#sv-temp').value.trim();
  const sat    = $('#sv-sat').value.trim();
  const dextro = $('#sv-dextro').value.trim();

  // Algias
  const algiasVal = getRadioValue('sv-algias');
  let algiasText  = '';
  if (algiasVal === 'nega') {
    algiasText = ', nega algias';
  } else if (algiasVal === 'refere') {
    const desc = $('#sv-dor-desc').value.trim();
    if (!desc) return erro('Descreva a dor do paciente');
    algiasText = `, refere ${desc}`;
  }

  // Sinais vitais — um por linha
  const sv = [];
  if (paSis && paDia) sv.push(`PA ${paSis}/${paDia}mmHg`);
  if (pam)            sv.push(`PAM ${pam}mmHg`);
  if (fc)             sv.push(`FC ${fc}bpm`);
  if (fr)             sv.push(`FR ${fr}rpm`);
  if (temp)           sv.push(`T ${temp}°C`);
  if (sat)            sv.push(`SAT ${sat}%`);
  if (dextro)         sv.push(`Dextro ${dextro}mg/dL`);

  // Abertura adaptada: completa (≥4 sinais principais) ou parcial
  const maiores = [paSis && paDia, fc, fr, temp, sat].filter(Boolean).length;
  const abertura = maiores >= 4
    ? `${h} \u2013 Realizado aferição de sinais vitais${algiasText}.`
    : `${h} \u2013 Realizado aferição parcial de sinais vitais${algiasText}.`;

  let texto = abertura;
  if (sv.length > 0) {
    texto += '\n' + sv.join('\n');
  }

  return texto;
}

function mostrarPreviewSV(texto) {
  // Verifica se já existe uma área de preview dentro do sv-screen
  let svPreview = $('#sv-preview-area');
  if (!svPreview) {
    svPreview = document.createElement('div');
    svPreview.id = 'sv-preview-area';
    svPreview.innerHTML = `
      <div class="sv-preview-text" id="sv-preview-text"></div>
      <div class="salvar-identificacao" style="margin-bottom:16px">
        <div class="campo" style="margin-bottom:0">
          <label for="sv-nome-paciente">Nome do paciente</label>
          <input type="text" id="sv-nome-paciente" placeholder="Ex: João Silva">
        </div>
        <div class="campo" style="margin-bottom:0">
          <label for="sv-leito-paciente">Leito</label>
          <input type="text" id="sv-leito-paciente" placeholder="Ex: 2A">
        </div>
      </div>
      <div class="preview-actions">
        <button type="button" class="btn-action" id="sv-btn-copiar">Copiar texto</button>
        <button type="button" class="btn-action btn-secondary" id="sv-btn-salvar">Salvar</button>
        <button type="button" class="btn-action btn-outline" id="sv-btn-nova">Nova aferição</button>
      </div>
    `;
    document.querySelector('.sv-form').after(svPreview);

    $('#sv-btn-copiar').addEventListener('click', () => {
      copyText($('#sv-preview-text').textContent);
    });

    $('#sv-btn-salvar').addEventListener('click', () => {
      const t     = $('#sv-preview-text').textContent;
      const nome  = $('#sv-nome-paciente').value.trim();
      const leito = $('#sv-leito-paciente') ? $('#sv-leito-paciente').value.trim() : '';
      salvarAnotacao(t, nome, 'sv', leito);
      showToast('Salvo!');
    });

    $('#sv-btn-nova').addEventListener('click', () => {
      svPreview.style.display = 'none';
      document.querySelector('.sv-form').style.display = '';
      // Limpar campos vitais
      ['sv-horario','sv-pa-sis','sv-pa-dia','sv-pam','sv-fc','sv-fr','sv-temp','sv-sat','sv-dextro','sv-dor-desc'].forEach(id => {
        const el = $(`#${id}`);
        if (el) el.value = '';
      });
      $$('input[name="sv-algias"]').forEach(r => r.checked = false);
      $('#sv-dor-container').style.display = 'none';
      $('#sv-erro').textContent = '';
      // Limpar nome/leito para nova aferição
      const nomeEl  = $('#sv-nome-paciente');
      const leitoEl = $('#sv-leito-paciente');
      if (nomeEl) nomeEl.value = '';
      if (leitoEl) leitoEl.value = '';
      window.scrollTo({ top: 0 });
    });
  }

  $('#sv-preview-text').textContent = texto;
  svPreview.style.display = 'block';
  document.querySelector('.sv-form').style.display = 'none';
  window.scrollTo({ top: 0 });
}

// ===== FRASES RÁPIDAS =====
function setupFrasesRapidas() {
  $$('.frase-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const target = chip.dataset.target;
      const texto  = chip.dataset.texto;
      const el = $('#' + target);
      if (!el) return;
      const atual = el.value.trim();
      el.value = atual ? atual + ', ' + texto : texto;
      el.dispatchEvent(new Event('input')); // dispara auto-save
    });
  });
}

// ===== AUTO-SAVE RASCUNHO =====
const DRAFT_KEY = 'anotacao_draft';
let draftTimeout = null;

function setupDraftAutoSave() {
  // Escuta qualquer mudança nos campos do formulário
  const form = $('#blocos-wrapper');
  if (!form) return;

  form.addEventListener('change', scheduleDraftSave);
  form.addEventListener('input',  scheduleDraftSave);

  // Restaura rascunho se existir
  restoreDraft();
}

function scheduleDraftSave() {
  clearTimeout(draftTimeout);
  draftTimeout = setTimeout(saveDraft, 800);
}

function saveDraft() {
  const draft = {};

  // Inputs e textareas
  $$('#blocos-wrapper input[type="text"], #blocos-wrapper input[type="time"], #blocos-wrapper input[type="number"], #blocos-wrapper textarea').forEach(el => {
    if (el.id) draft[el.id] = el.value;
  });

  // Radios
  $$('#blocos-wrapper input[type="radio"]:checked').forEach(el => {
    draft['radio_' + el.name] = el.value;
  });

  // Checkboxes
  $$('#blocos-wrapper input[type="checkbox"]').forEach(el => {
    if (el.id) draft['cb_' + el.id] = el.checked;
    else if (el.name && el.value) draft['cb_' + el.name + '_' + el.value] = el.checked;
  });

  draft._bloco = state.blocoAtual;
  draft._ts    = Date.now();

  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);

    // Não restaura rascunhos com mais de 24h
    if (Date.now() - (draft._ts || 0) > 86400000) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }

    let restored = false;

    Object.entries(draft).forEach(([key, val]) => {
      if (key === '_bloco' || key === '_ts') return;

      if (key.startsWith('radio_')) {
        const name = key.slice(6);
        const radio = document.querySelector(`input[name="${name}"][value="${val}"]`);
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); restored = true; }
      } else if (key.startsWith('cb_')) {
        // checkboxes by id
        const el = document.getElementById(key.slice(3));
        if (el) { el.checked = val; el.dispatchEvent(new Event('change')); restored = true; }
      } else {
        const el = document.getElementById(key);
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          el.value = val;
          el.dispatchEvent(new Event('input'));
          if (val) restored = true;
        }
      }
    });

    if (restored) {
      if (draft._bloco && draft._bloco > 1) {
        state.blocoAtual = draft._bloco;
        updateBlocoView();
      }
      showToast('📋 Rascunho restaurado');
    }
  } catch {
    localStorage.removeItem(DRAFT_KEY);
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  clearTimeout(draftTimeout);
}

// ===== LOGIN =====
// Controle de tentativas de PIN (anti-brute-force)
const PIN_MAX_ATTEMPTS = 3;
const PIN_LOCKOUT_MS   = 60000; // 60 segundos
let pinAttempts   = 0;
let pinLockedUntil = 0;
let pinCountdownInterval = null;

function isPinLocked() {
  return Date.now() < pinLockedUntil;
}

function registerPinFailure(erroEl, btnEntrar) {
  pinAttempts++;
  if (pinAttempts >= PIN_MAX_ATTEMPTS) {
    pinLockedUntil = Date.now() + PIN_LOCKOUT_MS;
    pinAttempts = 0;
    startPinCountdown(erroEl, btnEntrar);
  } else {
    const restantes = PIN_MAX_ATTEMPTS - pinAttempts;
    erroEl.textContent = `❌ PIN incorreto. ${restantes} tentativa${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''}.`;
  }
}

function startPinCountdown(erroEl, btnEntrar) {
  clearInterval(pinCountdownInterval);
  btnEntrar.disabled = true;
  const update = () => {
    const remaining = Math.ceil((pinLockedUntil - Date.now()) / 1000);
    if (remaining <= 0) {
      clearInterval(pinCountdownInterval);
      erroEl.textContent = 'Tente novamente.';
      btnEntrar.disabled = false;
    } else {
      erroEl.textContent = `🔒 Muitas tentativas. Aguarde ${remaining}s para tentar novamente.`;
    }
  };
  update();
  pinCountdownInterval = setInterval(update, 1000);
}

function setupLogin() {
  const inputCodigo    = $('#login-codigo');
  const inputPin       = $('#login-pin');
  const inputNome      = $('#login-nome');
  const pinContainer   = $('#login-pin-container');
  const pinLabel       = $('#login-pin-label');
  const pinDica        = $('#login-pin-dica');
  const nomeContainer  = $('#login-nome-container');
  const status         = $('#login-codigo-status');
  const erro           = $('#login-erro');
  const btnEntrar      = $('#btn-login-entrar');

  let checkTimeout = null;
  let codeState    = null; // 'available' | 'returning' | 'offline' | null

  // Só dígitos no PIN
  inputPin.addEventListener('input', () => {
    inputPin.value = inputPin.value.replace(/\D/g, '').slice(0, 4);
    erro.textContent = '';
    btnEntrar.disabled = inputPin.value.length < 4;
  });

  inputCodigo.addEventListener('input', () => {
    inputCodigo.value = inputCodigo.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const code = inputCodigo.value;

    // Reset estado
    status.textContent = '';
    status.className   = 'login-status';
    btnEntrar.disabled = true;
    pinContainer.style.display  = 'none';
    nomeContainer.style.display = 'none';
    inputPin.value = '';
    codeState = null;
    erro.textContent = '';
    clearTimeout(checkTimeout);

    if (code.length < 3) return;

    status.textContent = 'Verificando...';
    status.className   = 'login-status status-wait';

    checkTimeout = setTimeout(async () => {
      const result = window.checkCode
        ? await window.checkCode(code)
        : { exists: false, nome: null };

      if (result.offline) {
        status.textContent = '⚠️ Sem conexão — entrando offline';
        status.className   = 'login-status status-err';
        // Offline: mostra PIN mas não valida contra Firebase
        pinLabel.textContent = 'PIN';
        pinDica.textContent  = '';
        pinContainer.style.display = 'block';
        nomeContainer.style.display = 'block';
        codeState = 'offline';
        return;
      }

      const ajuda = $('#login-ajuda');
      if (result.exists) {
        const nome = result.nome ? `, ${result.nome}` : '';
        status.textContent = `👋 Olá${nome}! Bem-vinda de volta.`;
        status.className   = 'login-status status-back';
        const lbl = $('#login-codigo-label');
        const dic = $('#login-codigo-dica');
        if (lbl) lbl.textContent = 'Seu código';
        if (dic) dic.textContent = 'Código reconhecido — agora digite seu PIN para entrar.';
        pinLabel.textContent = 'Digite seu PIN';
        pinDica.innerHTML    = '';
        pinContainer.style.display  = 'block';
        nomeContainer.style.display = 'none';
        if (ajuda) ajuda.style.display = 'block'; // mostra ajuda de PIN/código esquecido
        codeState = 'returning';
      } else {
        status.textContent = '✅ Código disponível! Faça seu cadastro abaixo.';
        status.className   = 'login-status status-ok';
        const lbl = $('#login-codigo-label');
        const dic = $('#login-codigo-dica');
        if (lbl) lbl.textContent = 'Escolha seu código pessoal';
        if (dic) dic.textContent = 'Novo por aqui! Anote este código — você vai precisar dele para acessar novamente.';
        pinLabel.textContent = 'Crie um PIN de 4 dígitos';
        pinDica.innerHTML    = 'Anote seu PIN — será pedido em cada acesso.<br><strong>⚠️ Evite PINs óbvios:</strong> 1234, 0000, 1111 ou data de nascimento.';
        pinContainer.style.display  = 'block';
        nomeContainer.style.display = 'block';
        if (ajuda) ajuda.style.display = 'none';
        codeState = 'available';
      }
      // Botão fica desabilitado até PIN ter 4 dígitos
      btnEntrar.disabled = inputPin.value.length < 4;
    }, 500);
  });

  btnEntrar.addEventListener('click', async () => {
    // Bloqueio anti-brute-force
    if (isPinLocked()) {
      startPinCountdown(erro, btnEntrar);
      return;
    }

    const code = inputCodigo.value.trim().toUpperCase();
    const pin  = inputPin ? inputPin.value.trim() : '';
    const nome = inputNome ? inputNome.value.trim() : '';

    if (code.length < 3) {
      erro.textContent = 'Código deve ter pelo menos 3 caracteres.';
      return;
    }
    if (!codeState) {
      erro.textContent = 'Aguarde a verificação do código.';
      return;
    }
    if (pin.length < 4) {
      erro.textContent = 'PIN deve ter 4 dígitos.';
      return;
    }

    btnEntrar.disabled    = true;
    btnEntrar.textContent = 'Entrando...';
    erro.textContent      = '';

    if (codeState === 'returning') {
      // Verificar PIN antes de liberar acesso
      const check = window.verifyPin
        ? await window.verifyPin(code, pin)
        : { ok: true };

      if (check.offline) {
        erro.textContent      = 'Sem conexão. Não foi possível verificar o PIN. Tente novamente.';
        btnEntrar.disabled    = false;
        btnEntrar.textContent = 'Entrar';
        return;
      }
      if (!check.ok) {
        inputPin.value        = '';
        btnEntrar.disabled    = false;
        btnEntrar.textContent = 'Entrar';
        registerPinFailure(erro, btnEntrar);
        return;
      }
      // PIN correto — reseta contagem e carrega anotações
      pinAttempts = 0;
      if (window.loadAnnotationsFromCloud) {
        await window.loadAnnotationsFromCloud(code);
      }
    } else if (codeState === 'available') {
      // Novo registro com PIN
      if (window.registerCode) {
        await window.registerCode(code, nome, pin);
      }
      // Mesmo sendo "novo" cadastro, pode haver anotações antigas no sync/{code}
      // (ex: users/ foi apagado mas sync/ ainda existe)
      if (window.loadAnnotationsFromCloud) {
        await window.loadAnnotationsFromCloud(code);
      }
    }
    // offline: entra sem verificar (sem outra opção)

    localStorage.setItem('sync_code', code);
    localStorage.setItem('login_time', Date.now().toString());
    startSessionWatcher();
    hideLogin();
  });
}

function showLogin() {
  if (els.loginScreen) els.loginScreen.style.display = 'flex';
  if (els.appDiv)      els.appDiv.style.display = 'none';
}

function hideLogin() {
  if (els.loginScreen) els.loginScreen.style.display = 'none';
  if (els.appDiv)      els.appDiv.style.display = '';

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) {
    showPCMode();
  } else {
    showForm();
    updateBlocoView();
  }
}

// ===== HELPERS =====
function getRadioValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : null;
}

function getCheckedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(cb => cb.value);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== PC MODE =====
function setupPCMode() {
  // Botão Sair → limpa sessão e volta ao login
  $('#btn-pc-sair').addEventListener('click', () => {
    clearSession();
    $('#pc-lista').innerHTML = '';
    $('#pc-erro').textContent = '';
    if ($('#pc-codigo')) $('#pc-codigo').value = '';
    if ($('#pc-pin')) $('#pc-pin').value = '';
    $('#pc-view').style.display = 'none';
    $('#pc-mode-selector').style.display = 'flex';
    showLogin();
  });

  // Botão Celular → vai pro form normal
  $('#btn-modo-celular').addEventListener('click', () => {
    showForm();
  });

  // Botão PC → abre view de busca
  $('#btn-modo-pc').addEventListener('click', () => {
    $('#pc-mode-selector').style.display = 'none';
    $('#pc-view').style.display = 'block';
    setTimeout(() => $('#pc-codigo').focus(), 100);
  });

  // Voltar do PC view → volta pro seletor
  $('#btn-pc-voltar').addEventListener('click', () => {
    $('#pc-view').style.display = 'none';
    $('#pc-mode-selector').style.display = 'flex';
    $('#pc-lista').innerHTML = '';
    $('#pc-erro').textContent = '';
    $('#pc-codigo').value = '';
    if ($('#pc-pin')) $('#pc-pin').value = '';
  });

  // Formata input: só letras/números maiúsculos no código
  $('#pc-codigo').addEventListener('input', () => {
    $('#pc-codigo').value = $('#pc-codigo').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  // PIN: só dígitos
  if ($('#pc-pin')) {
    $('#pc-pin').addEventListener('input', () => {
      $('#pc-pin').value = $('#pc-pin').value.replace(/\D/g, '').slice(0, 4);
    });
    $('#pc-pin').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') pcBuscar();
    });
  }

  // Enter no campo código dispara busca
  $('#pc-codigo').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') pcBuscar();
  });

  $('#pc-btn-buscar').addEventListener('click', pcBuscar);
}

async function pcBuscar() {
  const code    = $('#pc-codigo').value.trim().toUpperCase();
  const pin     = $('#pc-pin') ? $('#pc-pin').value.trim() : '';
  const erroEl  = $('#pc-erro');
  const listaEl = $('#pc-lista');

  erroEl.textContent = '';

  if (code.length < 3) {
    erroEl.textContent = 'O código deve ter pelo menos 3 caracteres.';
    return;
  }
  if (pin.length < 4) {
    erroEl.textContent = 'Informe o PIN de 4 dígitos.';
    return;
  }

  listaEl.innerHTML = `
    <div class="pc-estado">
      <div class="pc-spinner"></div>
      <p>Verificando PIN...</p>
    </div>`;
  $('#pc-btn-buscar').disabled = true;

  try {
    // Verificar PIN antes de buscar as anotações
    if (window.verifyPin) {
      const check = await window.verifyPin(code, pin);
      if (check.offline) {
        erroEl.textContent = 'Sem conexão. Não foi possível verificar o PIN.';
        listaEl.innerHTML = '';
        return;
      }
      if (!check.ok) {
        erroEl.textContent = '❌ Código ou PIN incorreto.';
        listaEl.innerHTML = '';
        if ($('#pc-pin')) $('#pc-pin').value = '';
        return;
      }
    }

    listaEl.innerHTML = `
      <div class="pc-estado">
        <div class="pc-spinner"></div>
        <p>Buscando anotações...</p>
      </div>`;

    if (!window.syncFetchByCode) throw new Error('Sincronização não disponível');
    const anotacoes = await window.syncFetchByCode(code);

    if (!anotacoes || anotacoes.length === 0) {
      listaEl.innerHTML = `<div class="pc-estado"><p>Nenhuma anotação encontrada para <strong>${escapeHtml(code)}</strong>.</p></div>`;
      return;
    }
    pcRenderLista(anotacoes);
  } catch (err) {
    erroEl.textContent = 'Erro: ' + err.message;
    listaEl.innerHTML = '';
  } finally {
    $('#pc-btn-buscar').disabled = false;
  }
}

let pcListaCompleta = []; // guarda para filtrar

function pcRenderLista(lista) {
  pcListaCompleta = lista;

  // Mostrar campo de busca
  const buscaContainer = $('#pc-busca-container');
  if (buscaContainer) {
    buscaContainer.style.display = 'block';
    const buscaInput = $('#pc-busca');
    buscaInput.value = '';
    buscaInput.oninput = () => {
      const termo = buscaInput.value.trim().toLowerCase();
      const filtrada = termo
        ? lista.filter(a => (a.nome || '').toLowerCase().includes(termo) || (a.texto || '').toLowerCase().includes(termo))
        : lista;
      pcRenderItens(filtrada);
    };
  }

  const listaEl = $('#pc-lista');
  listaEl.innerHTML = '';
  pcRenderItens(lista);
}

function pcRenderItens(lista) {
  const listaEl = $('#pc-lista');
  listaEl.innerHTML = '';

  lista.forEach(anot => {
    const data  = anot.timestamp ? new Date(anot.timestamp) : null;
    const tempo = data ? data.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }) : '';

    const card = document.createElement('div');
    card.className = 'pc-anot-card';
    const isSV = anot.tipo === 'sv';
    const tipoBadgePC = isSV
      ? `<span class="pc-tipo-badge pc-tipo-sv">❤️ Sinais Vitais</span>`
      : `<span class="pc-tipo-badge pc-tipo-rec">📋 Recebimento</span>`;
    const pcTituloPartes = [anot.nome, anot.leito ? 'Leito ' + anot.leito : ''].filter(Boolean);
    const pcTitulo = pcTituloPartes.join(' — ') || 'Anotação';
    card.innerHTML = `
      <div class="pc-anot-header">
        <span class="pc-anot-title">${escapeHtml(pcTitulo)}</span>
        <div class="pc-anot-header-right">
          ${tipoBadgePC}
          <span class="pc-anot-time">${tempo}</span>
        </div>
      </div>
      <div class="pc-anot-body">${escapeHtml(anot.texto || '')}</div>
      <div class="pc-anot-footer">
        <button class="btn-copiar-pc">📋 Copiar texto</button>
      </div>
    `;

    card.querySelector('.btn-copiar-pc').addEventListener('click', function () {
      navigator.clipboard.writeText(anot.texto || '').then(() => {
        this.textContent = '✅ Copiado!';
        this.classList.add('copiado');
        setTimeout(() => {
          this.textContent = '📋 Copiar texto';
          this.classList.remove('copiado');
        }, 2500);
      }).catch(() => {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = anot.texto || '';
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        this.textContent = '✅ Copiado!';
        setTimeout(() => { this.textContent = '📋 Copiar texto'; }, 2500);
      });
    });

    listaEl.appendChild(card);
  });
}
