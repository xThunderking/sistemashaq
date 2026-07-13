const $ = id => document.getElementById(id);
const body = $('equipmentBody'), state = $('state'), dialog = $('equipmentDialog');
const form = $('equipmentForm'), areaDialog = $('areaDialog'), areaForm = $('areaForm');
const deviceDialog = $('deviceDialog');
const laptopDialog = $('laptopDialog'), laptopForm = $('laptopForm'), laptopBody = $('laptopBody');
let equipment = [], areas = [], laptops = [];
const auditFields = ['revisionSoftware', 'antivirus', 'usb', 'paginasNoAutorizadas', 'escritorio', 'tiempoBloqueo', 'bloqueoConfiguracion', 'glpi'];

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
const formatDate = value => new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
function toast(message, error = false) { const el = $('toast'); el.textContent = message; el.className = `toast show${error ? ' error' : ''}`; setTimeout(() => el.className = 'toast', 2800); }

function renderEquipment() {
  const q = $('searchInput').value.toLowerCase().trim();
  const rows = equipment.filter(e => [e.serialNumber, e.area, e.responsable, e.ipAddress].some(v => v.toLowerCase().includes(q)));
  body.innerHTML = rows.map(e => { const checked = auditFields.filter(field => Boolean(e[field])).length; const pending = auditFields.length - checked; return `<tr><td data-label="Número de serie">${escapeHtml(e.serialNumber)}</td><td data-label="Área"><span class="area-pill">${escapeHtml(e.area)}</span></td><td data-label="Responsable">${escapeHtml(e.responsable)}</td><td data-label="Dirección IP"><span class="ip">${escapeHtml(e.ipAddress)}</span></td><td data-label="Auditoría 2026"><span class="audit-status ${pending === 0 ? 'complete' : 'pending'}">${pending === 0 ? '✓ Revisada' : `◷ ${pending} pendiente${pending === 1 ? '' : 's'}`}</span></td><td data-label="Fecha de registro">${formatDate(e.createdAt)}</td><td class="actions"><button class="icon-button edit" data-id="${e.id}" title="Editar" aria-label="Editar equipo">✎ <span>Editar</span></button><button class="icon-button device" data-id="${e.id}" title="Información Lenovo" aria-label="Ver información del equipo">▣ <span>Equipo</span></button><button class="icon-button danger delete" data-id="${e.id}" title="Eliminar" aria-label="Eliminar equipo">⌫ <span>Eliminar</span></button></td></tr>`; }).join('');
  state.hidden = rows.length > 0;
  if (!rows.length) state.innerHTML = `<span class="empty-icon">▧</span><p>${q ? 'No se encontraron coincidencias.' : 'Aún no hay equipos registrados.'}</p>`;
  $('resultCount').textContent = `${rows.length} ${rows.length === 1 ? 'equipo' : 'equipos'}`;
  $('totalCount').textContent = equipment.length;
  $('areaCount').textContent = areas.length;
  $('ipCount').textContent = equipment.filter(e => e.ipAddress).length;
}

function renderAreas() {
  const options = '<option value="">Selecciona un área</option>' + areas.map(a => `<option value="${escapeHtml(a.nombre)}">${escapeHtml(a.nombre)}</option>`).join('');
  $('area').innerHTML = options; $('laptopArea').innerHTML = options;
  $('areasGrid').innerHTML = areas.map(a => `<article class="area-card"><div class="area-card-name"><span class="area-card-icon">⌑</span>${escapeHtml(a.nombre)}</div><button class="icon-button danger delete-area" data-id="${a.id}" title="Eliminar área">⌫</button></article>`).join('');
  $('areasState').hidden = areas.length > 0;
  $('areaTotal').textContent = `${areas.length} ${areas.length === 1 ? 'área' : 'áreas'}`;
  $('areaCount').textContent = areas.length;
}
function renderLaptops() {
  const q = $('laptopSearchInput').value.toLowerCase().trim();
  const rows = laptops.filter(item => [item.serialNumber, item.area, item.responsable].some(value => value.toLowerCase().includes(q)));
  laptopBody.innerHTML = rows.map(item => `<tr><td data-label="Número de serie">${escapeHtml(item.serialNumber)}</td><td data-label="Área"><span class="area-pill">${escapeHtml(item.area)}</span></td><td data-label="Responsable">${escapeHtml(item.responsable)}</td><td data-label="Fecha de registro">${formatDate(item.createdAt)}</td><td class="actions"><button class="icon-button edit-laptop" data-id="${item.id}" aria-label="Editar laptop">✎ <span>Editar</span></button><button class="icon-button device-laptop" data-id="${item.id}" aria-label="Ver información Lenovo">▣ <span>Equipo</span></button><button class="icon-button danger delete-laptop" data-id="${item.id}" aria-label="Eliminar laptop">⌫ <span>Eliminar</span></button></td></tr>`).join('');
  $('laptopState').hidden = rows.length > 0;
  if (!rows.length) $('laptopState').innerHTML = `<span class="empty-icon">▱</span><p>${q ? 'No se encontraron coincidencias.' : 'Aún no hay laptops registradas.'}</p>`;
  $('laptopCount').textContent = `${rows.length} ${rows.length === 1 ? 'laptop' : 'laptops'}`;
}

async function loadEquipment() {
  state.hidden = false; state.innerHTML = '<span class="loader"></span><p>Cargando equipos...</p>';
  try { const res = await fetch('/api/equipos'); const data = await res.json(); if (!res.ok) throw new Error(data.error); equipment = data; renderEquipment(); }
  catch (e) { state.innerHTML = '<span class="empty-icon">!</span><p>No fue posible conectar con la base de datos.</p>'; toast(e.message || 'Error de conexión', true); }
}
async function loadAreas() {
  try { const res = await fetch('/api/areas'); const data = await res.json(); if (!res.ok) throw new Error(data.error); areas = data; renderAreas(); }
  catch (e) { toast(e.message || 'No fue posible cargar las áreas.', true); }
}
async function loadLaptops() { try { const res = await fetch('/api/laptops'), data = await res.json(); if (!res.ok) throw new Error(data.error); laptops = data; renderLaptops(); } catch (e) { $('laptopState').innerHTML = `<span class="empty-icon">!</span><p>${escapeHtml(e.message)}</p>`; toast(e.message, true); } }
async function loadAll() { await Promise.all([loadEquipment(), loadAreas(), loadLaptops()]); }

function switchView(view) {
  const isAreas = view === 'areas';
  const isLaptops = view === 'laptops';
  $('equipmentView').hidden = isAreas || isLaptops; $('areasView').hidden = !isAreas; $('laptopsView').hidden = !isLaptops;
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $('pageEyebrow').textContent = isAreas ? 'CATÁLOGO' : 'INVENTARIO';
  $('pageTitle').textContent = isAreas ? 'Áreas' : isLaptops ? 'Control de laptops' : 'Control de equipos';
  $('pageSubtitle').textContent = isAreas ? 'Administra las áreas disponibles en el sistema.' : isLaptops ? 'Administra las laptops de la organización.' : 'Administra los activos tecnológicos de tu organización.';
  $('newButton').textContent = isAreas ? '＋ Agregar área' : isLaptops ? '＋ Agregar laptop' : '＋ Agregar equipo';
  $('newButton').dataset.action = isAreas ? 'area' : isLaptops ? 'laptop' : 'equipment';
}

function openEquipmentForm(item) { form.reset(); $('formError').textContent = ''; $('equipmentId').value = item?.id || ''; $('modalTitle').textContent = item ? 'Editar equipo' : 'Agregar equipo'; $('serialNumber').value = item?.serialNumber || ''; $('area').value = item?.area || ''; $('responsable').value = item?.responsable || ''; $('ipAddress').value = item?.ipAddress || ''; auditFields.forEach(field => $(field).checked = Boolean(item?.[field])); dialog.showModal(); $('serialNumber').focus(); }
function openAreaForm() { areaForm.reset(); $('areaFormError').textContent = ''; areaDialog.showModal(); $('areaName').focus(); }
function openLaptopForm(item) { laptopForm.reset(); $('laptopFormError').textContent = ''; $('laptopId').value = item?.id || ''; $('laptopModalTitle').textContent = item ? 'Editar laptop' : 'Agregar laptop'; $('laptopSerialNumber').value = item?.serialNumber || ''; $('laptopArea').value = item?.area || ''; $('laptopResponsable').value = item?.responsable || ''; laptopDialog.showModal(); $('laptopSerialNumber').focus(); }
async function saveLenovoAutomatically(id, type = 'equipment') {
  const path = type === 'laptop' ? `/api/lenovo/laptop/${id}` : `/api/lenovo/${id}`;
  try { const response = await fetch(path); if (!response.ok) throw new Error(); return true; }
  catch { return false; }
}
async function openDeviceInfo(item, type = 'equipment') {
  $('deviceInfo').hidden = true; $('deviceState').hidden = false;
  $('deviceState').innerHTML = '<span class="loader"></span><p>Consultando información en Lenovo...</p>';
  deviceDialog.showModal();
  try {
    const response = await fetch(`/api/lenovo/${type === 'laptop' ? 'laptop/' : ''}${item.id}`), data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No fue posible consultar Lenovo.');
    $('deviceSerial').textContent = data.serialNumber; $('deviceModel').textContent = data.modelo;
    $('deviceMtm').textContent = data.mtm; $('deviceFamily').textContent = data.familia;
    $('deviceWarranty').textContent = data.estadoGarantia; $('deviceConfiguration').textContent = data.configuracionOriginal;
    $('deviceState').hidden = true; $('deviceInfo').hidden = false;
  } catch (error) {
    const url = `https://pcsupport.lenovo.com/us/en/warranty-lookup#/search?serial=${encodeURIComponent(item.serialNumber)}`;
    $('deviceState').innerHTML = `<p class="device-error">${escapeHtml(error.message)}</p><a class="primary official-link" href="${url}" target="_blank" rel="noopener">Consultar en Lenovo</a>`;
  }
}

document.querySelectorAll('.nav-item').forEach(button => button.onclick = () => switchView(button.dataset.view));
$('newButton').onclick = e => e.currentTarget.dataset.action === 'area' ? openAreaForm() : e.currentTarget.dataset.action === 'laptop' ? openLaptopForm() : openEquipmentForm();
$('closeDialog').onclick = () => dialog.close(); $('cancelDialog').onclick = () => dialog.close();
$('closeAreaDialog').onclick = () => areaDialog.close(); $('cancelAreaDialog').onclick = () => areaDialog.close();
$('closeDeviceDialog').onclick = () => deviceDialog.close();
$('closeLaptopDialog').onclick = () => laptopDialog.close(); $('cancelLaptopDialog').onclick = () => laptopDialog.close();
document.querySelectorAll('.copy-command').forEach(button => button.onclick = async () => { try { await navigator.clipboard.writeText(button.dataset.command); const original = button.textContent; button.textContent = 'Copiado ✓'; setTimeout(() => button.textContent = original, 1600); } catch { toast('No fue posible copiar el comando.', true); } });
$('refreshButton').onclick = loadAll; $('searchInput').oninput = renderEquipment;
$('exportButton').onclick = async () => {
  const button = $('exportButton'), original = button.innerHTML; button.disabled = true; button.innerHTML = '⌛ <span>Generando...</span>';
  try { const response = await fetch('/api/exportar'); if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'No fue posible generar el archivo.'); } const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `inventario-haq-${new Date().toISOString().slice(0, 10)}.xlsx`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); toast('Inventario exportado'); } catch (error) { toast(error.message, true); } finally { button.disabled = false; button.innerHTML = original; }
};
$('syncLenovoButton').onclick = async () => {
  const button = $('syncLenovoButton');
  const items = [...equipment.map(item => ({ id: item.id, type: 'equipment' })), ...laptops.map(item => ({ id: item.id, type: 'laptop' }))];
  if (!items.length) return toast('No hay equipos ni laptops registrados.', true);
  if (!confirm(`Se consultará la información Lenovo de ${items.length} registro${items.length === 1 ? '' : 's'}. ¿Continuar?`)) return;
  const original = button.innerHTML; button.disabled = true;
  let completed = 0, success = 0, failed = 0, cursor = 0;
  const updateProgress = () => { button.innerHTML = `⌛ <span>Lenovo ${completed}/${items.length}</span>`; };
  updateProgress();
  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try { const path = item.type === 'laptop' ? `/api/lenovo/laptop/${item.id}` : `/api/lenovo/${item.id}`; const response = await fetch(path); if (!response.ok) throw new Error(); success++; } catch { failed++; } finally { completed++; updateProgress(); }
    }
  };
  try { await Promise.all(Array.from({ length: Math.min(3, items.length) }, () => worker())); toast(failed ? `${success} guardados · ${failed} sin información` : `Información Lenovo guardada para ${success} registros`, failed > 0); }
  finally { button.disabled = false; button.innerHTML = original; }
};
$('laptopSearchInput').oninput = renderLaptops;
dialog.onclick = e => { if (e.target === dialog) dialog.close(); }; areaDialog.onclick = e => { if (e.target === areaDialog) areaDialog.close(); }; deviceDialog.onclick = e => { if (e.target === deviceDialog) deviceDialog.close(); };
laptopDialog.onclick = e => { if (e.target === laptopDialog) laptopDialog.close(); };

body.onclick = async e => {
  const button = e.target.closest('button[data-id]'); if (!button) return; const id = button.dataset.id; const item = equipment.find(x => String(x.id) === id);
  if (button.classList.contains('edit')) openEquipmentForm(item);
  if (button.classList.contains('device')) openDeviceInfo(item);
  if (button.classList.contains('delete')) { if (!confirm(`¿Eliminar el equipo ${item.serialNumber}?`)) return; try { const r = await fetch(`/api/equipos/${id}`, { method: 'DELETE' }); const d = await r.json(); if (!r.ok) throw new Error(d.error); toast('Equipo eliminado'); await loadEquipment(); } catch (err) { toast(err.message, true); } }
};
laptopBody.onclick = async e => {
  const button = e.target.closest('button[data-id]'); if (!button) return; const item = laptops.find(x => String(x.id) === button.dataset.id);
  if (button.classList.contains('edit-laptop')) openLaptopForm(item);
  if (button.classList.contains('device-laptop')) openDeviceInfo(item, 'laptop');
  if (button.classList.contains('delete-laptop')) { if (!confirm(`¿Eliminar la laptop ${item.serialNumber}?`)) return; try { const r = await fetch(`/api/laptops/${item.id}`, { method: 'DELETE' }), d = await r.json(); if (!r.ok) throw new Error(d.error); toast('Laptop eliminada'); await loadLaptops(); } catch (err) { toast(err.message, true); } }
};
$('areasGrid').onclick = async e => {
  if (!e.target.classList.contains('delete-area')) return; const id = e.target.dataset.id; const item = areas.find(a => String(a.id) === id);
  if (!confirm(`¿Eliminar el área ${item.nombre}?`)) return;
  try { const r = await fetch(`/api/areas/${id}`, { method: 'DELETE' }); const d = await r.json(); if (!r.ok) throw new Error(d.error); toast('Área eliminada'); await loadAreas(); } catch (err) { toast(err.message, true); }
};
form.onsubmit = async e => {
  e.preventDefault(); const id = $('equipmentId').value; const auditoria = Object.fromEntries(auditFields.map(field => [field, $(field).checked])); const payload = { serialNumber: $('serialNumber').value.trim(), area: $('area').value, responsable: $('responsable').value.trim(), ipAddress: $('ipAddress').value.trim(), auditoria }; $('formError').textContent = ''; $('saveButton').disabled = true;
  try { const r = await fetch(`/api/equipos${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); dialog.close(); toast(id ? 'Equipo actualizado' : 'Equipo registrado · consultando Lenovo...'); await loadEquipment(); if (!id) { const saved = await saveLenovoAutomatically(d.id); toast(saved ? 'Equipo e información Lenovo guardados' : 'Equipo guardado; Lenovo no respondió', !saved); } } catch (err) { $('formError').textContent = err.message || 'No fue posible guardar.'; } finally { $('saveButton').disabled = false; }
};
areaForm.onsubmit = async e => {
  e.preventDefault(); $('areaFormError').textContent = ''; $('saveAreaButton').disabled = true;
  try { const r = await fetch('/api/areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: $('areaName').value }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); areaDialog.close(); toast('Área registrada'); await loadAreas(); } catch (err) { $('areaFormError').textContent = err.message || 'No fue posible guardar.'; } finally { $('saveAreaButton').disabled = false; }
};
laptopForm.onsubmit = async e => {
  e.preventDefault(); const id = $('laptopId').value; const payload = { serialNumber: $('laptopSerialNumber').value.trim(), area: $('laptopArea').value, responsable: $('laptopResponsable').value.trim() }; $('laptopFormError').textContent = ''; $('saveLaptopButton').disabled = true;
  try { const r = await fetch(`/api/laptops${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), d = await r.json(); if (!r.ok) throw new Error(d.error); laptopDialog.close(); toast(id ? 'Laptop actualizada' : 'Laptop registrada · consultando Lenovo...'); await loadLaptops(); if (!id) { const saved = await saveLenovoAutomatically(d.id, 'laptop'); toast(saved ? 'Laptop e información Lenovo guardadas' : 'Laptop guardada; Lenovo no respondió', !saved); } } catch (err) { $('laptopFormError').textContent = err.message; } finally { $('saveLaptopButton').disabled = false; }
};

switchView('equipment');
loadAll();
