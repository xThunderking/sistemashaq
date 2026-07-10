const $ = (id) => document.getElementById(id);
const body = $('equipmentBody'), state = $('state'), dialog = $('equipmentDialog'), form = $('equipmentForm');
let equipment = [];

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const formatDate = value => new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value));
function toast(message, error=false){const el=$('toast');el.textContent=message;el.className=`toast show${error?' error':''}`;setTimeout(()=>el.className='toast',2800)}

function render(){
  const q=$('searchInput').value.toLowerCase().trim();
  const rows=equipment.filter(e=>[e.serialNumber,e.area,e.ipAddress].some(v=>v.toLowerCase().includes(q)));
  body.innerHTML=rows.map(e=>`<tr><td>${escapeHtml(e.serialNumber)}</td><td><span class="area-pill">${escapeHtml(e.area)}</span></td><td><span class="ip">${escapeHtml(e.ipAddress)}</span></td><td>${formatDate(e.createdAt)}</td><td class="actions"><button class="icon-button edit" data-id="${e.id}" title="Editar">✎</button><button class="icon-button danger delete" data-id="${e.id}" title="Eliminar">⌫</button></td></tr>`).join('');
  state.hidden=rows.length>0;
  if(!rows.length) state.innerHTML=`<span class="empty-icon">▧</span><p>${q?'No se encontraron coincidencias.':'Aún no hay equipos registrados.'}</p>`;
  $('resultCount').textContent=`${rows.length} ${rows.length===1?'equipo':'equipos'}`;
  $('totalCount').textContent=equipment.length;
  $('areaCount').textContent=new Set(equipment.map(e=>e.area.toLowerCase())).size;
  $('ipCount').textContent=equipment.filter(e=>e.ipAddress).length;
}

async function load(){
  state.hidden=false;state.innerHTML='<span class="loader"></span><p>Cargando equipos...</p>';
  try{const res=await fetch('/api/equipos');const data=await res.json();if(!res.ok)throw new Error(data.error);equipment=data;render()}catch(e){state.innerHTML='<span class="empty-icon">!</span><p>No fue posible conectar con la base de datos.</p>';toast(e.message||'Error de conexión',true)}
}
function openForm(item){form.reset();$('formError').textContent='';$('equipmentId').value=item?.id||'';$('modalTitle').textContent=item?'Editar equipo':'Agregar equipo';$('serialNumber').value=item?.serialNumber||'';$('area').value=item?.area||'';$('ipAddress').value=item?.ipAddress||'';dialog.showModal();$('serialNumber').focus()}
function closeForm(){dialog.close()}
$('newButton').onclick=()=>openForm();$('closeDialog').onclick=closeForm;$('cancelDialog').onclick=closeForm;$('refreshButton').onclick=load;$('searchInput').oninput=render;
dialog.onclick=e=>{if(e.target===dialog)closeForm()};
body.onclick=async e=>{const id=e.target.dataset.id;if(!id)return;const item=equipment.find(x=>String(x.id)===id);if(e.target.classList.contains('edit'))openForm(item);if(e.target.classList.contains('delete')){if(!confirm(`¿Eliminar el equipo ${item.serialNumber}?`))return;try{const r=await fetch(`/api/equipos/${id}`,{method:'DELETE'});const d=await r.json();if(!r.ok)throw new Error(d.error);toast('Equipo eliminado');await load()}catch(err){toast(err.message,true)}}};
form.onsubmit=async e=>{e.preventDefault();const id=$('equipmentId').value;const payload={serialNumber:$('serialNumber').value.trim(),area:$('area').value.trim(),ipAddress:$('ipAddress').value.trim()};$('formError').textContent='';$('saveButton').disabled=true;try{const r=await fetch(`/api/equipos${id?'/'+id:''}`,{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.error);closeForm();toast(id?'Equipo actualizado':'Equipo registrado');await load()}catch(err){$('formError').textContent=err.message||'No fue posible guardar.'}finally{$('saveButton').disabled=false}};
load();
