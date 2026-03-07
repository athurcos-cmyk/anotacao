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
  fechamentoPreview: $('#fechamento-preview')
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupConditionals();
  setupDispositivos();
  setupPreview();
  setupHistorico();
  setupModal();
  updateBlocoView();

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
      const container = $('#oxigenio-container');
      const needsO2 = radio.value === 'cateter nasal de O₂' || radio.value === 'máscara de O₂';
      container.style.display = needsO2 ? 'block' : 'none';
      if (!needsO2) {
        $('#oxigenio-litros').value = '';
      }
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
function setupDispositivos() {
  $('#btn-add-dispositivo').addEventListener('click', () => {
    const input = $('#dispositivo-input');
    const text = input.value.trim();
    if (!text) return;

    state.dispositivos.push(text);
    input.value = '';
    renderDispositivos();
  });
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

    // Touch drag support
    let touchStartY = 0;
    let touchCurrentItem = null;

    const handle = item.querySelector('.disp-handle');
    handle.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      touchCurrentItem = item;
      item.classList.add('dragging');
      state.dragSrcIndex = i;
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      const items = [...$$('.dispositivo-item')];
      items.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        if (touchY > rect.top && touchY < rect.bottom && idx !== state.dragSrcIndex) {
          el.classList.add('drag-over');
        } else {
          el.classList.remove('drag-over');
        }
      });
    }, { passive: false });

    handle.addEventListener('touchend', (e) => {
      const touchY = e.changedTouches[0].clientY;
      const items = [...$$('.dispositivo-item')];
      let targetIndex = -1;
      items.forEach((el, idx) => {
        el.classList.remove('drag-over');
        const rect = el.getBoundingClientRect();
        if (touchY > rect.top && touchY < rect.bottom) {
          targetIndex = idx;
        }
      });

      if (touchCurrentItem) {
        touchCurrentItem.classList.remove('dragging');
      }

      if (targetIndex >= 0 && targetIndex !== state.dragSrcIndex) {
        const moved = state.dispositivos.splice(state.dragSrcIndex, 1)[0];
        state.dispositivos.splice(targetIndex, 0, moved);
        renderDispositivos();
      }
    });

    // Remove button
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
  } else if ((resp === 'cateter nasal de O₂' || resp === 'máscara de O₂') && !$('#oxigenio-litros').value) {
    erros.push('Informe os litros por minuto');
    $('#oxigenio-litros').closest('.campo').classList.add('invalido');
  }

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

  if (!$('#evacuacao').value.trim()) {
    erros.push('Informe a última evacuação');
    $('#evacuacao').closest('.campo').classList.add('invalido');
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
  const resp = getRadioValue('respiracao');
  if (resp === 'cateter nasal de O₂' || resp === 'máscara de O₂') {
    const litros = $('#oxigenio-litros').value;
    apresentaParts.push(`em ${resp} a ${litros}L/min`);
  } else {
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

  // Capitalize first letter (after period it starts a new sentence)
  let apresentaText = apresentaParts.join(', ');
  apresentaText = apresentaText.charAt(0).toUpperCase() + apresentaText.slice(1);
  parts.push(apresentaText + '.');

  // BLOCO 3 - Mantem (omite se vazio) — MAR: Mantem vem antes de Apresenta observacoes
  if (state.dispositivos.length > 0) {
    const dispTexto = state.dispositivos.map((d, i) => {
      if (i === 0) {
        return `Mant\u00e9m ${d}`;
      }
      return d;
    }).join('; ');
    parts.push(dispTexto + '.');
  }

  // Obs apresenta (ex: hematomas) — vem depois dos dispositivos
  const obsApresenta = $('#obs-apresenta').value.trim();
  if (obsApresenta) {
    const obsText = obsApresenta.charAt(0).toUpperCase() + obsApresenta.slice(1);
    parts.push(obsText + '.');
  }

  // Pulseira (if in dispositivos, it's already there)

  // BLOCO 4 - Refere
  const refereParts = [];

  const evacuacao = $('#evacuacao').value.trim();
  refereParts.push(`Refere \u00faltima evacua\u00e7\u00e3o a ${evacuacao}`);

  const diureseVals = getCheckedValues('diurese');
  if (diureseVals.includes('não avaliado')) {
    refereParts.push('diurese n\u00e3o avaliada');
  } else {
    const diuTexts = diureseVals.map(d => {
      if (d === 'SVD') {
        const debito = $('#svd-debito').value.trim();
        return `SVD com d\u00e9bito presente de ${debito}`;
      }
      return d;
    });
    if (diuTexts.length === 1) {
      refereParts.push(`diurese em ${diuTexts[0]}`);
    } else if (diuTexts.length > 1) {
      const last = diuTexts.pop();
      refereParts.push(`diurese em ${diuTexts.join(', ')} e ${last}`);
    }
  }

  parts.push(refereParts.join(', ') + '.');

  // Queixas
  const queixas = $('#queixas').value.trim();
  if (queixas) {
    parts.push(`Refere ${queixas}.`);
  }

  // BLOCO 5 - Fechamento
  parts.push(`Mantenho cama ${posicao}, rodas ${rodas}, grades ${grades} e dec\u00fabito ${decubito}, campainha pr\u00f3xima e oriento a chamar sempre que necess\u00e1rio.`);

  return parts.join(' ');
}

function updateFechamentoPreview() {
  const posicao = getRadioValue('posicao-cama') || '___';
  const rodas = getRadioValue('rodas') || '___';
  const grades = getRadioValue('grades') || '___';
  const decubito = getRadioValue('decubito') || '___';

  els.fechamentoPreview.textContent = `Mantenho cama ${posicao}, rodas ${rodas}, grades ${grades} e dec\u00fabito ${decubito}, campainha pr\u00f3xima e oriento a chamar sempre que necess\u00e1rio.`;
}

// ===== PREVIEW =====
function setupPreview() {
  $('#btn-copiar').addEventListener('click', () => {
    copyText(els.previewText.textContent);
  });

  $('#btn-salvar').addEventListener('click', () => {
    const nomePaciente = $('#nome-paciente').value.trim();
    salvarAnotacao(els.previewText.textContent, nomePaciente);
    showToast('Anotação salva!');
  });

  $('#btn-nova').addEventListener('click', () => {
    resetForm();
  });
}

function showPreview() {
  const texto = gerarTexto();
  els.previewText.textContent = texto;

  els.header.style.display = 'none';
  els.main.style.display = 'none';
  els.previewScreen.style.display = 'block';
  els.historicoScreen.style.display = 'none';

  window.scrollTo({ top: 0 });
}

function showForm() {
  els.header.style.display = 'block';
  els.main.style.display = 'block';
  els.previewScreen.style.display = 'none';
  els.historicoScreen.style.display = 'none';
}

// ===== HISTORICO =====
function setupHistorico() {
  $('#btn-historico').addEventListener('click', showHistorico);
  $('#btn-voltar-historico').addEventListener('click', showForm);
}

function showHistorico() {
  els.header.style.display = 'none';
  els.main.style.display = 'none';
  els.previewScreen.style.display = 'none';
  els.historicoScreen.style.display = 'block';

  renderHistorico();
  window.scrollTo({ top: 0 });
}

function renderHistorico() {
  const lista = els.historicoScreen.querySelector('#historico-lista');
  const anotacoes = getAnotacoes();

  if (anotacoes.length === 0) {
    lista.innerHTML = '<div class="historico-vazio">Nenhuma anotação salva ainda</div>';
    return;
  }

  lista.innerHTML = '';
  anotacoes.sort((a, b) => b.timestamp - a.timestamp);

  anotacoes.forEach((anot, i) => {
    const item = document.createElement('div');
    item.className = 'historico-item';

    const date = new Date(anot.timestamp);
    const dateStr = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const nomeLine = anot.nome ? `<div class="hist-nome">${escapeHtml(anot.nome)}</div>` : '';
    const preview = anot.texto.substring(0, 80) + (anot.texto.length > 80 ? '...' : '');

    item.innerHTML = `
      <div class="hist-date">${dateStr}</div>
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
  $('#modal-title').textContent = anot.nome || 'Anotação';
  els.modalText.textContent = anot.texto;
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
    closeConfirm();
    if (confirmCallback) confirmCallback();
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

function salvarAnotacao(texto, nomePaciente) {
  const anotacoes = getAnotacoes();
  anotacoes.push({
    texto,
    nome: nomePaciente || '',
    timestamp: Date.now()
  });
  localStorage.setItem('anotacoes_hc', JSON.stringify(anotacoes));
}

function deletarAnotacao(timestamp) {
  let anotacoes = getAnotacoes();
  anotacoes = anotacoes.filter(a => a.timestamp !== timestamp);
  localStorage.setItem('anotacoes_hc', JSON.stringify(anotacoes));
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

  // Go to bloco 1
  state.blocoAtual = 1;
  showForm();
  updateBlocoView();
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
