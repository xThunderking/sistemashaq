const $ = id => document.getElementById(id);
const body = $('equipmentBody'), state = $('state'), dialog = $('equipmentDialog');
const form = $('equipmentForm'), areaDialog = $('areaDialog'), areaForm = $('areaForm');
let equipment = [], areas = [];
const auditFields = ['revisionSoftware', 'antivirus', 'usb', 'paginasNoAutorizadas', 'escritorio', 'tiempoBloqueo', 'glpiAntivirus'];

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
const formatDate = value => new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
function toast(message, error = false) { const el = $('toast'); el.textContent = message; el.className = `toast show${error ? ' error' : ''}`; setTimeout(() => el.className = 'toast', 2800); }

function renderEquipment() {
  const q = $('searchInput').value.toLowerCase().trim();
  const rows = equipment.filter(e => [e.serialNumber, e.area, e.ipAddress].some(v => v.toLowerCase().includes(q)));
  body.innerHTML = rows.map(e => { const checked = auditFields.filter(field => Boolean(e[field])).length; const pending = auditFields.length - checked; return `<tr><td data-label="Número de serie">${escapeHtml(e.serialNumber)}</td><td data-label="Área"><span class="area-pill">${escapeHtml(e.area)}</span></td><td data-label="Dirección IP"><span class="ip">${escapeHtml(e.ipAddress)}</span></td><td data-label="Auditoría 2026"><span class="audit-status ${pending === 0 ? 'complete' : 'pending'}">${pending === 0 ? '✓ Revisada' : `◷ ${pending} pendiente${pending === 1 ? '' : 's'}`}</span></td><td data-label="Fecha de registro">${formatDate(e.createdAt)}</td><td class="actions"><button class="icon-button edit" data-id="${e.id}" title="Editar" aria-label="Editar equipo">✎ <span>Editar</span></button><button class="icon-button danger delete" data-id="${e.id}" title="Eliminar" aria-label="Eliminar equipo">⌫ <span>Eliminar</span></button></td></tr>`; }).join('');
  state.hidden = rows.length > 0;
  if (!rows.length) state.innerHTML = `<span class="empty-icon">▧</span><p>${q ? 'No se encontraron coincidencias.' : 'Aún no hay equipos registrados.'}</p>`;
  $('resultCount').textContent = `${rows.length} ${rows.length === 1 ? 'equipo' : 'equipos'}`;
  $('totalCount').textContent = equipment.length;
  $('areaCount').textContent = areas.length;
  $('ipCount').textContent = equipment.filter(e => e.ipAddress).length;
}

function renderAreas() {
  $('area').innerHTML = '<option value="">Selecciona un área</option>' + areas.map(a => `<option value="${escapeHtml(a.nombre)}">${escapeHtml(a.nombre)}</option>`).join('');
  $('areasGrid').innerHTML = areas.map(a => `<article class="area-card"><div class="area-card-name"><span class="area-card-icon">⌑</span>${escapeHtml(a.nombre)}</div><button class="icon-button danger delete-area" data-id="${a.id}" title="Eliminar área">⌫</button></article>`).join('');
  $('areasState').hidden = areas.length > 0;
  $('areaTotal').textContent = `${areas.length} ${areas.length === 1 ? 'área' : 'áreas'}`;
  $('areaCount').textContent = areas.length;
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
async function loadAll() { await Promise.all([loadEquipment(), loadAreas()]); }

function switchView(view) {
  const isAreas = view === 'areas';
  $('equipmentView').hidden = isAreas; $('areasView').hidden = !isAreas;
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $('pageEyebrow').textContent = isAreas ? 'CATÁLOGO' : 'INVENTARIO';
  $('pageTitle').textContent = isAreas ? 'Áreas' : 'Control de equipos';
  $('pageSubtitle').textContent = isAreas ? 'Administra las áreas disponibles en el sistema.' : 'Administra los activos tecnológicos de tu organización.';
  $('newButton').textContent = isAreas ? '＋ Agregar área' : '＋ Agregar equipo';
  $('newButton').dataset.action = isAreas ? 'area' : 'equipment';
}

function openEquipmentForm(item) { form.reset(); $('formError').textContent = ''; $('equipmentId').value = item?.id || ''; $('modalTitle').textContent = item ? 'Editar equipo' : 'Agregar equipo'; $('serialNumber').value = item?.serialNumber || ''; $('area').value = item?.area || ''; $('ipAddress').value = item?.ipAddress || ''; auditFields.forEach(field => $(field).checked = Boolean(item?.[field])); dialog.showModal(); $('serialNumber').focus(); }
function openAreaForm() { areaForm.reset(); $('areaFormError').textContent = ''; areaDialog.showModal(); $('areaName').focus(); }

document.querySelectorAll('.nav-item').forEach(button => button.onclick = () => switchView(button.dataset.view));
$('newButton').onclick = e => e.currentTarget.dataset.action === 'area' ? openAreaForm() : openEquipmentForm();
$('closeDialog').onclick = () => dialog.close(); $('cancelDialog').onclick = () => dialog.close();
$('closeAreaDialog').onclick = () => areaDialog.close(); $('cancelAreaDialog').onclick = () => areaDialog.close();
$('refreshButton').onclick = loadAll; $('searchInput').oninput = renderEquipment;
dialog.onclick = e => { if (e.target === dialog) dialog.close(); }; areaDialog.onclick = e => { if (e.target === areaDialog) areaDialog.close(); };

body.onclick = async e => {
  const id = e.target.dataset.id; if (!id) return; const item = equipment.find(x => String(x.id) === id);
  if (e.target.classList.contains('edit')) openEquipmentForm(item);
  if (e.target.classList.contains('delete')) { if (!confirm(`¿Eliminar el equipo ${item.serialNumber}?`)) return; try { const r = await fetch(`/api/equipos/${id}`, { method: 'DELETE' }); const d = await r.json(); if (!r.ok) throw new Error(d.error); toast('Equipo eliminado'); await loadEquipment(); } catch (err) { toast(err.message, true); } }
};
$('areasGrid').onclick = async e => {
  if (!e.target.classList.contains('delete-area')) return; const id = e.target.dataset.id; const item = areas.find(a => String(a.id) === id);
  if (!confirm(`¿Eliminar el área ${item.nombre}?`)) return;
  try { const r = await fetch(`/api/areas/${id}`, { method: 'DELETE' }); const d = await r.json(); if (!r.ok) throw new Error(d.error); toast('Área eliminada'); await loadAreas(); } catch (err) { toast(err.message, true); }
};
form.onsubmit = async e => {
  e.preventDefault(); const id = $('equipmentId').value; const auditoria = Object.fromEntries(auditFields.map(field => [field, $(field).checked])); const payload = { serialNumber: $('serialNumber').value.trim(), area: $('area').value, ipAddress: $('ipAddress').value.trim(), auditoria }; $('formError').textContent = ''; $('saveButton').disabled = true;
  try { const r = await fetch(`/api/equipos${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); dialog.close(); toast(id ? 'Equipo actualizado' : 'Equipo registrado'); await loadEquipment(); } catch (err) { $('formError').textContent = err.message || 'No fue posible guardar.'; } finally { $('saveButton').disabled = false; }
};
areaForm.onsubmit = async e => {
  e.preventDefault(); $('areaFormError').textContent = ''; $('saveAreaButton').disabled = true;
  try { const r = await fetch('/api/areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: $('areaName').value }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); areaDialog.close(); toast('Área registrada'); await loadAreas(); } catch (err) { $('areaFormError').textContent = err.message || 'No fue posible guardar.'; } finally { $('saveAreaButton').disabled = false; }
};

switchView('equipment');
loadAll();
