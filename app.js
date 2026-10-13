'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  calendar:'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m3 11h2m4 0h2m-8 4h2',
  video:'M15 8l6-3v14l-6-3M4 5h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2',
  record:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6v6h6M8 13h8M8 17h5',
  shield:'M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4m-4 10 3 3 5-5',
  help:'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  home:'M3 10l9-8 9 8M5 9v12h5v-7h4v7h5V9',
  people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M15 3.1a4 4 0 0 1 0 7.8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  exchange:'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',
  check:'M5 12l4 4L19 6',
  mic:'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8',
  logout:'M9 4H4v16h5m6-12 4 4-4 4m-7-4h11',
};
function icon(name, size=24) { return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.help}"/></svg>`; }
const roleNames = {patient:'Paciente', doctor:'Profesional', admin:'Administración', auditor:'Auditoría'};
const statusNames = {booked:'Agendada', completed:'Atendida', cancelled:'Cancelada'};
const state = {user:null, csrf:null, route:'', request:0, doctors:[], doctor:'d1', day:localDay(1), slot:null, slots:[], filter:'booked', dirty:false, call:null};
let toastTimer, confirmAction, integrationRefresh;

function localDay(offset=0) { const date = new Date(); date.setDate(date.getDate()+offset); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function dateLabel(day, includeWeekday=true) { return new Date(day+'T12:00:00').toLocaleDateString('es-CL', {day:'numeric', month:'long', ...(includeWeekday ? {weekday:'long'} : {})}); }
function dateTime(value) { return new Date(value).toLocaleString('es-CL', {dateStyle:'medium', timeStyle:'short'}); }
function toast(message, error=false) {
  clearTimeout(toastTimer); const target=$('#toast'); target.textContent=message; target.classList.toggle('error',error); target.hidden=false;
  if(error) $('#urgent-error').textContent=message;
  toastTimer=setTimeout(()=>{target.hidden=true;},error?9000:6000);
}
async function api(path, options={}) {
  return window.cercaDemo.request(path, options);
}
const post=(path, data={})=>api(path,{method:'POST',body:JSON.stringify(data)});
function setPage(html,title) { $('#main').innerHTML=html;document.title=`${title} · Cerca`; }
function heading(title, subtitle, action='') { return `<div class="page-top"><div><p class="eyebrow">Tu espacio de salud</p><h1>${esc(title)}</h1><p class="muted">${esc(subtitle)}</p></div>${action}</div>`; }
function empty(title,description,action='') { return `<div class="empty"><h2>${esc(title)}</h2><p>${esc(description)}</p>${action}</div>`; }
function actionLink(route,name,description,kind) { return `<a class="action-link" href="#${route}"><span class="action-icon">${icon(kind)}</span><span><strong>${esc(name)}</strong><small>${esc(description)}</small></span><span class="action-arrow" aria-hidden="true">›</span></a>`; }
function statusTag(status) { return `<span class="tag ${status==='completed'?'success':status==='cancelled'?'cancelled':''}">${statusNames[status]||esc(status)}</span>`; }
function go(route) { if(location.hash==='#'+route) renderRoute();else location.hash=route; }

function applySettings(settings) {
  document.documentElement.dataset.font=settings.font || 'normal';
  document.documentElement.dataset.contrast=String(!!settings.contrast);
  document.documentElement.dataset.motion=String(!!settings.motion);
  document.querySelectorAll('[data-font]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.font===(settings.font||'normal'))));
  $('#contrast-toggle').checked=!!settings.contrast;$('#motion-toggle').checked=!!settings.motion;
  try{localStorage.setItem('cerca-accessibility',JSON.stringify(settings));}catch{}
}
function settings() { return {font:document.documentElement.dataset.font,contrast:$('#contrast-toggle').checked,motion:$('#motion-toggle').checked}; }
try{applySettings(JSON.parse(localStorage.getItem('cerca-accessibility')||'{}'));}catch{applySettings({});}

function closeMenu(returnFocus=false) { $('#main-menu').hidden=true;$('#menu-toggle').setAttribute('aria-expanded','false');if(returnFocus)$('#menu-toggle').focus(); }
function renderChrome() {
  $('#menu-wrap').hidden=!state.user;$('#session-strip').hidden=!state.user;
  if(!state.user) return;
  const user=state.user;
  $('#session-strip').innerHTML=`<div class="session-person"><span class="avatar blue" aria-hidden="true">${esc(user.initials)}</span><span><strong>${esc(user.name)}</strong> · ${roleNames[user.role]}</span></div><span class="prototype-label">Demo en el navegador · Datos ficticios</span>`;
  let links=[['inicio','Inicio','home']];
  if(user.role==='patient')links.push(['agendar','Agendar una hora','calendar'],['citas','Mis citas','video'],['ficha/'+user.id,'Mi ficha clínica','record']);
  if(user.role==='doctor')links.push(['citas','Mi agenda','calendar'],['pacientes','Mis pacientes','people']);
  if(user.role==='admin')links.push(['citas','Agenda del centro','calendar'],['integraciones','Intercambio de registros','exchange']);
  if(user.role==='auditor')links.push(['auditoria','Registro de accesos','shield']);
  links.push(['ayuda','Ayuda paso a paso','help']);
  $('#main-menu').innerHTML=links.map(([route,label,kind])=>`<a href="#${route}" ${state.route===route?'aria-current="page"':''}>${icon(kind,21)}${esc(label)}</a>`).join('')+`<button class="logout" data-action="logout">${icon('logout',21)}Cambiar de perfil</button>`;
}

function loginView() {
  setPage(`<div class="login-layout"><section class="welcome-intro"><p class="eyebrow">Bienvenido a Cerca</p><h1>Tu salud,<br>más cerca.</h1><p class="muted">Un espacio sencillo para agendar tu hora y revisar tus atenciones. Explora cómo sería usar nuestra plataforma.</p><ul class="intro-list"><li>${icon('calendar')}Agenda a tu ritmo.</li><li>${icon('record')}Encuentra tus atenciones en un lugar.</li><li>${icon('help')}Elige una experiencia a tu medida.</li></ul></section><section class="login-card" aria-labelledby="login-title"><p class="eyebrow">Prueba la experiencia</p><h2 id="login-title">¿Cómo quieres entrar?</h2><p class="muted">Elige un perfil de ejemplo. No necesitas una cuenta ni una contraseña.</p><div class="demo-profiles"><button class="button primary" data-demo="elena">${icon('people')}Como paciente</button><button class="button secondary" data-demo="valentina">${icon('record')}Como profesional</button><button class="button secondary" data-demo="admin">${icon('calendar')}Administración</button><button class="button secondary" data-demo="auditor">${icon('shield')}Auditoría</button></div><p class="help-inline">Todos los perfiles, citas y fichas son ficticios. La videollamada y el intercambio de registros solo se muestran como ejemplos.</p></section></div>`, 'Bienvenido');
}

function appointmentCard(appointment) {
  const a=appointment,isPatient=state.user.role==='patient',isAdmin=state.user.role==='admin';
  const date=new Date(a.day+'T12:00:00');
  let buttons='';
  if(a.status==='booked'&&!isAdmin)buttons+=`<a class="button primary" href="#consulta/${a.id}">${icon('video',20)}Entrar a consulta</a>`;
  if(state.user.role==='doctor')buttons+=`<a class="button secondary" href="#ficha/${esc(a.patient_id)}">Ver ficha</a>`;
  if(a.status==='booked')buttons+=`<button class="button ${isAdmin?'secondary':'quiet'}" data-action="cancel" data-id="${a.id}">Cancelar cita</button>`;
  return `<article class="appointment-card"><div class="date-tile" aria-hidden="true"><strong>${date.getDate()}</strong><span>${date.toLocaleDateString('es-CL',{month:'short'})}</span></div><div>${statusTag(a.status)}<h3>${esc(isPatient?a.doctor_name:a.patient_name)}</h3><p>${esc(dateLabel(a.day))} · ${esc(a.time)} h · 30 min</p><p>${esc(a.specialty)} · Videoconsulta</p></div><div class="appointment-buttons">${buttons}</div></article>`;
}

async function homeView(version) {
  const info=await api('/overview');if(version!==state.request)return;
  const user=state.user,name=user.role==='patient'?user.name.split(' ')[0]:user.role==='doctor'?user.name.split(' ').slice(0,2).join(' '):user.name;
  const today=new Date().toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'});
  let subtitle=user.role==='patient'?'Qué bueno tenerte aquí. ¿Cómo podemos ayudarte hoy?':'Todo lo que necesitas para acompañar cada atención.';
  let top=`<div class="dashboard-top"><div><p class="eyebrow">Un poco más cerca, cada día</p><h1>Hola, ${esc(name)}.</h1><p class="muted">${subtitle}</p></div><span class="date-label">${esc(today)}</span></div>`;
  if(user.role==='patient') {
    const a=info.next;
    const next=a?`<span class="tag">${icon('calendar',17)}Tu próxima cita</span><h2>Un momento para cuidarte.</h2><p class="appointment-date">${esc(dateLabel(a.day))}</p><p class="appointment-time">${esc(a.time)} h · Videoconsulta de 30 minutos</p><div class="doctor-row"><span class="avatar" aria-hidden="true">${esc(a.doctor_initials)}</span><span><strong>${esc(a.doctor_name)}</strong><small class="muted">${esc(a.specialty)}</small></span></div><a class="button primary" href="#consulta/${a.id}">${icon('video',21)}Entrar a mi consulta</a><p class="help-inline">Explora una vista previa de la sala, sin conexión real.</p>`:`<span class="tag">${icon('calendar',17)}Tu próxima cita</span><h2>Hagamos espacio para tu salud.</h2><p class="muted">Aún no tienes una próxima hora reservada. Elige el profesional y el horario que prefieras.</p><a class="button primary" href="#agendar">Agendar mi primera hora</a>`;
    top+=`<div class="dashboard-grid"><section class="next-card">${next}</section><section class="quick-actions" aria-label="¿Qué necesitas hacer?">${actionLink('agendar','Agendar una hora','Elige tu profesional y horario.','calendar')}${actionLink('ficha/'+user.id,'Mi ficha clínica','Revisa tus atenciones anteriores.','record')}${actionLink('ayuda','Estoy aquí para ayudarte','Encuentra una guía paso a paso.','help')}</section></div><p class="gentle-note">${icon('help',22)}<span>¿Prefieres letras más grandes? Abre <strong>Accesibilidad</strong> en la parte superior. Tú eliges cómo ver Cerca.</span></p>`;
  } else if(user.role==='doctor'||user.role==='admin') {
    top+=`<div class="stat-row"><div class="stat"><strong>${info.booked}</strong><span>Citas agendadas</span></div><div class="stat"><strong>${info.completed}</strong><span>Atenciones registradas</span></div><div class="stat"><strong>${user.role==='doctor'?info.patients:info.pending}</strong><span>${user.role==='doctor'?'Pacientes vinculados':'Envíos pendientes'}</span></div></div><div class="quick-actions">${user.role==='doctor'?actionLink('pacientes','Mis pacientes','Consulta fichas y registra una atención.','people'):actionLink('integraciones','Intercambio de registros','Revisa envíos y prueba una caída del receptor.','exchange')}</div><div class="section-title"><h2>Próximas atenciones</h2><a href="#citas">Ver toda la agenda</a></div><div class="appointment-list">${info.appointments.filter(a=>a.status==='booked').slice(0,3).map(appointmentCard).join('')||empty('Agenda disponible','Las próximas reservas aparecerán aquí.')}</div>`;
  } else {
    top+=`<div class="stat-row"><div class="stat"><strong>${info.events}</strong><span>Eventos registrados</span></div><div class="stat"><strong>${info.denied}</strong><span>Accesos rechazados</span></div><div class="stat"><strong>0</strong><span>Contenidos clínicos en el log</span></div></div>${actionLink('auditoria','Revisar accesos','Quién accedió, a qué recurso y con qué resultado.','shield')}<p class="gentle-note">El perfil de auditoría consulta trazabilidad. Los textos de la ficha clínica no forman parte de este registro.</p>`;
  }
  setPage(top,'Inicio');
}

function slotButtons() { return state.slots.length?state.slots.map(s=>`<button type="button" class="slot" data-slot="${s.id}" aria-pressed="${state.slot?.id===s.id}">${esc(s.time)} h</button>`).join(''):`<p class="muted">No hay horas disponibles para esta fecha. Prueba otro día.</p>`; }
function bookingSummary() {
  const doctor=state.doctors.find(d=>d.id===state.doctor);
  return `<h2>Tu nueva cita</h2><div class="summary-item"><small>Profesional</small><strong>${esc(doctor?.name||'Elige un profesional')}</strong><span class="small muted">${esc(doctor?.specialty||'')}</span></div><div class="summary-item"><small>Fecha</small><strong>${esc(dateLabel(state.day))}</strong></div><div class="summary-item"><small>Hora</small><strong>${state.slot?esc(state.slot.time)+' h':'Elige un horario'}</strong></div><div class="summary-item"><small>Modalidad</small><strong>Videoconsulta · 30 minutos</strong></div><button type="submit" form="booking-form" class="button primary full" id="book-submit" ${state.slot?'':'disabled'}>Confirmar mi hora</button><p class="help-inline">Tu hora quedará reservada al confirmar.</p>`;
}
async function bookingView(version) {
  if(state.user.role!=='patient'){go('inicio');return;}
  const [doctors,slots]=await Promise.all([api('/professionals'),api(`/slots?doctor=${encodeURIComponent(state.doctor)}&day=${encodeURIComponent(state.day)}`)]);
  if(version!==state.request)return;state.doctors=doctors;state.slots=slots;state.slot=null;
  setPage(heading('Agendar una hora','Vamos paso a paso. Elige con quién y cuándo quieres atenderte.')+`<div class="booking-layout"><form id="booking-form" class="card"><div class="step-label"><span class="step-number">1</span>Elige un profesional</div><div class="doctor-options">${doctors.map(d=>`<label class="doctor-option"><input type="radio" name="doctor" value="${esc(d.id)}" ${d.id===state.doctor?'checked':''}><span><strong>${esc(d.name)}</strong><small>${esc(d.specialty)}</small></span></label>`).join('')}</div><div class="step-label"><span class="step-number">2</span>Elige una fecha</div><div class="field date-input"><label class="sr-only" for="booking-day">Fecha de la consulta</label><input type="date" id="booking-day" name="day" min="${localDay()}" max="${localDay(14)}" value="${esc(state.day)}" required></div><div class="step-label"><span class="step-number">3</span>Elige una hora disponible</div><div class="slots" id="slots" role="group" aria-label="Horas disponibles">${slotButtons()}</div><div id="slot-status" class="sr-only" role="status"></div><div class="step-label"><span class="step-number">4</span>¿Qué te gustaría consultar?</div><div class="field"><label for="reason">Motivo de consulta <span class="muted">(opcional)</span></label><textarea id="reason" name="reason" maxlength="500" rows="3" placeholder="Puedes escribir un motivo breve. Usa solo datos ficticios para esta prueba."></textarea></div><div id="book-error" class="form-error" role="alert" hidden></div></form><aside class="booking-summary" id="booking-summary" aria-label="Resumen de la reserva">${bookingSummary()}</aside></div>`,'Agendar una hora');
}
let slotRequest=0;
async function refreshSlots() {
  const request=++slotRequest;state.slot=null;$('#booking-summary').innerHTML=bookingSummary();$('#slots').innerHTML='<p role="status">Buscando horas disponibles…</p>';
  try{const slots=await api(`/slots?doctor=${encodeURIComponent(state.doctor)}&day=${encodeURIComponent(state.day)}`);if(request!==slotRequest||!$('#slots'))return;state.slots=slots;$('#slots').innerHTML=slotButtons();$('#slot-status').textContent=`${slots.length} horas disponibles.`;}
  catch(error){if($('#slots'))$('#slots').innerHTML=`<p class="form-error">${esc(error.message)}</p>`;}
}

async function confirmationView(id,version) {
  const appointments=await api('/appointments');if(version!==state.request)return;const a=appointments.find(a=>a.id===Number(id));
  if(!a){go('citas');return;}
  setPage(`<section class="success-panel"><div class="success-symbol" aria-hidden="true">✓</div><p class="eyebrow">Reserva confirmada</p><h1>Tu hora ya está agendada.</h1><p class="muted">La encontrarás en “Mis citas” cuando quieras revisarla.</p><p class="appointment-date">${esc(dateLabel(a.day))}</p><p>${esc(a.time)} h · ${esc(a.doctor_name)}<br><span class="muted">${esc(a.specialty)} · Videoconsulta</span></p><div class="dialog-actions"><a class="button primary" href="#citas">Ver mis citas</a><a class="button secondary" href="#inicio">Volver al inicio</a></div></section>`,'Reserva confirmada');
}
async function appointmentsView(version) {
  const appointments=await api('/appointments');if(version!==state.request)return;
  const role=state.user.role;
  let title=role==='patient'?'Mis citas':role==='doctor'?'Mi agenda':'Agenda del centro';
  const action=role==='patient'?'<a class="button primary" href="#agendar">Agendar otra hora</a>':'';
  const filtered=appointments.filter(a=>a.status===state.filter);
  setPage(heading(title,'Tus reservas y atenciones, ordenadas en un solo lugar.',action)+`<div class="filters" role="group" aria-label="Estado de las citas">${[['booked','Agendadas'],['completed','Atendidas'],['cancelled','Canceladas']].map(([value,label])=>`<button class="button secondary" data-filter="${value}" aria-pressed="${state.filter===value}">${label} (${appointments.filter(a=>a.status===value).length})</button>`).join('')}</div><div class="appointment-list">${filtered.map(appointmentCard).join('')||empty('No tienes citas en esta sección','Aquí aparecerán las citas que correspondan a este estado.',role==='patient'?'<a href="#agendar" class="button primary">Agendar una hora</a>':'')}</div>` ,title);
}
async function patientsView(version) {
  const patients=await api('/patients');if(version!==state.request)return;
  setPage(heading('Mis pacientes','Ejemplos de fichas asociadas a este perfil.')+`<div class="patient-grid">${patients.map(p=>`<a class="card patient-link" href="#ficha/${esc(p.id)}"><span class="avatar blue" aria-hidden="true">${esc(p.initials)}</span><span><h3>${esc(p.name)}</h3><p>${p.age} años · Paciente de demostración</p></span><span class="action-arrow" aria-hidden="true">›</span></a>`).join('')||empty('Aún no tienes pacientes vinculados','Las nuevas reservas vinculan al paciente con su profesional.')}</div>`,'Mis pacientes');
}
async function clinicalView(id,version) {
  const [data, appointments]=await Promise.all([api('/patients/'+encodeURIComponent(id)),state.user.role==='doctor'?api('/appointments'):Promise.resolve([])]);
  if(version!==state.request)return;const p=data.patient;
  const pending=appointments.filter(a=>a.patient_id===id&&a.status==='booked');
  let html=`<div class="clinical-layout">${state.user.role==='doctor'?'<a class="back-link" href="#pacientes">‹ Volver a mis pacientes</a>':''}${heading(state.user.role==='patient'?'Mi ficha clínica':'Ficha clínica','Aquí están registradas las atenciones de demostración.',`<div class="page-actions"><button class="button secondary" data-action="export" data-patient="${esc(id)}">${icon('record',20)}Descargar ficha (JSON)</button></div>`)}<div class="patient-head"><span class="avatar" aria-hidden="true">${esc(p.initials)}</span><span><h2>${esc(p.name)}</h2><p>${p.age} años · Datos ficticios</p></span></div><h2>Historial de atenciones</h2>`;
  html+=data.records.map(r=>`<article class="card record"><div class="record-head"><h3>${esc(r.title)}</h3>${r.export_state?`<span class="tag ${r.export_state==='sent'?'success':'pending'}">${r.export_state==='sent'?'Copia enviada':'Envío pendiente'}</span>`:''}</div><p class="record-meta">${esc(dateTime(r.created_at))} · ${esc(r.doctor_name)}</p><p>${esc(r.note)}</p>${r.plan?`<h4>Plan registrado</h4><p>${esc(r.plan)}</p>`:''}</article>`).join('')||empty('Sin atenciones anteriores','Cuando se registre una atención, podrás verla aquí.');
  if(state.user.role==='doctor') {
    html+=`<section class="card record-form"><h2>Registrar una atención</h2><p class="muted small">Al guardar, la cita quedará atendida y se preparará una copia para el receptor de demostración.</p>${pending.length?`<form id="record-form" data-patient="${esc(id)}"><div class="field"><label for="record-appointment">Cita de esta atención</label><select id="record-appointment" name="appointment_id" required>${pending.map(a=>`<option value="${a.id}">${esc(dateLabel(a.day,false))} · ${esc(a.time)} h</option>`).join('')}</select></div><div class="field"><label for="record-title">Título de la atención</label><input id="record-title" name="title" maxlength="140" required placeholder="Ej.: Atención de demostración"></div><div class="field"><label for="record-note">Registro de la consulta</label><textarea id="record-note" name="note" maxlength="8000" required placeholder="Escribe aquí un registro ficticio de la atención."></textarea></div><div class="field"><label for="record-plan">Plan o acuerdos <span class="muted">(opcional)</span></label><textarea id="record-plan" name="plan" maxlength="4000" rows="3" placeholder="Solo contenido de demostración, sin indicaciones médicas reales."></textarea></div><div id="record-error" class="form-error" role="alert" hidden></div><button class="button primary" type="submit">Guardar atención y finalizar cita</button></form>`:'<p class="muted no-margin">Este paciente no tiene citas agendadas contigo pendientes de registrar.</p>'}</section>`;
  }
  html+='<p class="gentle-note">Esta ficha contiene datos ficticios. La trazabilidad se simula en este navegador; no es un sistema de seguridad real.</p></div>';
  setPage(html,'Ficha clínica');state.dirty=false;
}

const auditNames={'session.login':'Ingreso a la cuenta','session.logout':'Cierre de sesión','appointment.book':'Reserva de hora','appointment.cancel':'Cancelación de cita','clinical.read':'Lectura de ficha','clinical.write':'Registro de atención','clinical.export':'Descarga de ficha','video.join':'Ingreso a videoconsulta','video.leave':'Salida de videoconsulta','integration.deliver':'Envío simulado','integration.availability':'Cambio de disponibilidad'};
async function auditView(version) {
  const data=await api('/audit');if(version!==state.request)return;
  setPage(heading('Registro de accesos','Trazabilidad de las acciones. Este registro no incluye textos clínicos.','<button class="button secondary" data-action="refresh">Actualizar</button>')+(data.length?`<div class="table-wrap" tabindex="0" role="region" aria-label="Eventos de auditoría; desplaza horizontalmente si es necesario"><table><caption class="sr-only">Últimos 300 eventos de auditoría, desde el más reciente</caption><thead><tr><th scope="col">Fecha y hora</th><th scope="col">Persona</th><th scope="col">Acción</th><th scope="col">Recurso</th><th scope="col">Resultado</th></tr></thead><tbody>${data.map(r=>`<tr><td>${esc(dateTime(r.created_at))}</td><td>${esc(r.actor_name)}</td><td>${esc(auditNames[r.action]||r.action)}</td><td><code>${esc(r.resource)}</code></td><td><span class="tag ${r.result==='denied'?'pending':'success'}">${r.result==='denied'?'Rechazado':'Permitido'}</span></td></tr>`).join('')}</tbody></table></div>`:empty('Todavía no hay eventos','Las acciones de los perfiles de prueba aparecerán aquí.')),'Auditoría');
}
async function integrationsView(version) {
  const data=await api('/integrations');if(version!==state.request)return;
  setPage(heading('Intercambio de registros','Prueba cómo continúa el guardado local cuando el receptor no está disponible.')+`<section class="card integration-switch"><div><h2>Receptor simulado</h2><p class="muted">${data.available?'Disponible. Los envíos pendientes se procesan automáticamente.':'No disponible. Las atenciones se guardan y sus envíos quedan pendientes.'}</p></div><button class="button ${data.available?'secondary':'primary'}" data-action="legacy" data-available="${!data.available}">${data.available?'Simular caída del receptor':'Restablecer receptor'}</button></section><div class="stat-row"><div class="stat"><strong>${data.pending}</strong><span>Envíos pendientes</span></div><div class="stat"><strong>${data.sent}</strong><span>Envíos recibidos</span></div><div class="stat"><strong>${data.available?'Disponible':'Pausado'}</strong><span>Estado del receptor simulado</span></div></div><div class="section-title"><h2>Estado de los envíos</h2><button class="button secondary" data-action="refresh">Actualizar</button></div>${data.events.length?`<div class="table-wrap" tabindex="0" role="region" aria-label="Estado de los envíos de demostración"><table><caption class="sr-only">Envíos al receptor local</caption><thead><tr><th scope="col">Registro</th><th scope="col">Estado</th><th scope="col">Intentos</th><th scope="col">Creación</th><th scope="col">Último resultado</th></tr></thead><tbody>${data.events.map(r=>`<tr><td>Atención #${r.record_id}</td><td><span class="tag ${r.state==='sent'?'success':'pending'}">${r.state==='sent'?'Recibido':'Pendiente'}</span></td><td>${r.attempts}</td><td>${esc(dateTime(r.created_at))}</td><td>${esc(r.last_error||(r.delivered_at?'Recibido: '+dateTime(r.delivered_at):'Esperando envío'))}</td></tr>`).join('')}</tbody></table></div>`:empty('Aún no hay registros por enviar','Guarda una nueva atención con el perfil profesional para probar el intercambio.')}<p class="gentle-note">El receptor se simula en tu navegador. No se envían datos a instituciones externas. La descarga JSON es un ejemplo de la demo; no es una integración FHIR validada.</p>`,'Intercambio de registros');
}

function helpView() {
  setPage(heading('Vamos paso a paso','Explora la propuesta de Cerca a tu ritmo.')+`<div class="help-grid"><section class="card help-card"><h2>Reservar una hora</h2><ol><li>Entra como paciente.</li><li>Abre Menú → Agendar una hora.</li><li>Elige profesional, fecha y horario.</li><li>Confirma y revisa Mis citas.</li></ol><p>Puedes cancelar una reserva para liberar el horario.</p></section><section class="card help-card"><h2>Explorar los perfiles</h2><p>Cierra el perfil desde el menú y entra como profesional para revisar la agenda y registrar una atención ficticia.</p><p>Administración muestra la agenda y una simulación del intercambio de registros. Auditoría muestra ejemplos de trazabilidad.</p></section><section class="card help-card"><h2>A tu manera</h2><p>Abre Accesibilidad para aumentar el texto, activar alto contraste o reducir movimiento. Navega con Tab y activa controles con Enter; Escape cierra el menú.</p></section><section class="card help-card"><h2>¿Qué hace esta demo?</h2><p>Funciona solo en tu navegador, sin servidor ni base de datos. Los cambios se reinician al recargar o pulsar Reiniciar demo.</p><p>No hay cuentas reales, videollamadas ni envíos externos. Cada visitante tiene su propia simulación y no comparte cambios con otros.</p></section></div>`, 'Ayuda');
}

async function videoView(id,version) {
  const appointments=await api('/appointments');if(version!==state.request)return;
  const a=appointments.find(a=>a.id===Number(id));if(!a||a.status!=='booked'||!['patient','doctor'].includes(state.user.role)){go('citas');return;}
  const other=state.user.role==='patient'?a.doctor_name:a.patient_name;
  setPage(`<a class="back-link" href="#citas">‹ Volver a mis citas</a>${heading('Así se vería tu consulta', `${dateLabel(a.day)} · ${a.time} h · ${other}`)}<div class="video-layout"><section class="video-stage"><div class="video-waiting"><span class="round-icon">${icon('video',40)}</span><h2>Un espacio para conversar.</h2><p>Vista de ejemplo de la sala de atención. La videollamada no está habilitada en esta demo.</p><span class="tag">Vista previa · Sin cámara ni micrófono</span></div></section><aside class="card video-info"><div><h2>Tu atención, paso a paso</h2><ol><li>Reservas tu hora.</li><li>Ingresas a la consulta.</li><li>Conversas con tu profesional.</li><li>Revisas tu atención en la ficha.</li></ol></div><p class="small muted">Esta pantalla muestra el diseño propuesto. No conecta con otras personas ni solicita permisos de dispositivos.</p><a class="button secondary" href="#citas">Volver a mis citas</a></aside></div>`, 'Vista previa de consulta');
}
async function endCall() {}

async function renderRoute() {
  let route=location.hash.replace(/^#/,'')||'inicio';
  if(state.dirty&&route!==state.route&&!window.confirm('Tienes un registro sin guardar. ¿Quieres salir y perder lo escrito?')){history.replaceState(null,'','#'+state.route);return;}
  state.dirty=false;closeMenu();clearTimeout(integrationRefresh);
  if(state.call&&route!==state.route)await endCall(true);
  state.route=route;const version=++state.request;renderChrome();
  if(!state.user){loginView();return;}
  $('#main').setAttribute('aria-busy','true');
  try {
    const [page,id]=route.split('/');
    if(page==='inicio')await homeView(version);
    else if(page==='agendar')await bookingView(version);
    else if(page==='reserva')await confirmationView(id,version);
    else if(page==='citas')await appointmentsView(version);
    else if(page==='pacientes')await patientsView(version);
    else if(page==='ficha')await clinicalView(id||state.user.id,version);
    else if(page==='consulta')await videoView(id,version);
    else if(page==='auditoria')await auditView(version);
    else if(page==='integraciones')await integrationsView(version);
    else if(page==='ayuda')helpView();
    else{go('inicio');return;}
    if(version===state.request){$('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  }catch(error){
    if(version!==state.request)return;
    if(error.status===401){state.user=null;state.csrf=null;renderChrome();loginView();toast(error.message,true);}
    else setPage(heading('No pudimos abrir esta sección',error.message)+'<a class="button primary" href="#inicio">Volver al inicio</a>','Revisar acceso');
  }finally {if(version===state.request)$('#main').removeAttribute('aria-busy');}
}

$('#access-open').addEventListener('click',()=>{$('#access-dialog').showModal();});
$('#menu-toggle').addEventListener('click',()=>{const opening=$('#main-menu').hidden;$('#main-menu').hidden=!opening;$('#menu-toggle').setAttribute('aria-expanded',String(opening));if(opening)$('#main-menu a')?.focus();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#main-menu').hidden)closeMenu(true);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)&&$('#main-menu').contains(document.activeElement)){const items=[...$('#main-menu').querySelectorAll('a,button')],current=items.indexOf(document.activeElement);event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}});
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');
  if(!$('#menu-wrap').contains(event.target))closeMenu();
  if(event.target.closest('#main-menu a'))closeMenu();
  if(!button)return;
  if(button.dataset.close){$('#'+button.dataset.close).close();return;}
  if(button.dataset.font){applySettings({...settings(),font:button.dataset.font});return;}
  if(button.id==='show-password'){const input=$('#password'),show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Ocultar':'Ver';button.setAttribute('aria-label',show?'Ocultar contraseña':'Mostrar contraseña');button.setAttribute('aria-pressed',String(show));return;}
  if(button.id==='reset-demo'){location.reload();return;}
  if(button.dataset.demo){button.disabled=true;try{const data=await post('/login',{email:button.dataset.demo+'@cerca.local'});state.user=data.user;state.csrf=data.csrf;state.filter='booked';state.doctor='d1';history.replaceState(null,'','#inicio');await renderRoute();}catch(error){toast(error.message,true);}finally{button.disabled=false;}return;}
  if(button.dataset.slot){state.slot=state.slots.find(s=>s.id===Number(button.dataset.slot));document.querySelectorAll('[data-slot]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('#booking-summary').innerHTML=bookingSummary();$('#slot-status').textContent=`Hora seleccionada: ${state.slot.time}.`;return;}
  if(button.dataset.filter){state.filter=button.dataset.filter;await renderRoute();return;}
  if(button.id==='confirm-yes'&&confirmAction){const action=confirmAction;confirmAction=null;$('#confirm-dialog').close();await action();return;}
  const action=button.dataset.action;if(!action)return;
  try{
    if(action==='logout'){
      if(state.dirty&&!window.confirm('Tienes un registro sin guardar. ¿Quieres cerrar sesión?'))return;
      await endCall(true);await post('/logout');state.user=null;state.csrf=null;state.dirty=false;go('inicio');await renderRoute();return;
    }
    if(action==='cancel'){
      $('#confirm-title').textContent='¿Quieres cancelar esta cita?';$('#confirm-message').textContent='La hora volverá a estar disponible. Podrás reservar otra cuando lo necesites.';$('#confirm-yes').textContent='Sí, cancelar cita';
      confirmAction=async()=>{try{await post(`/appointments/${button.dataset.id}/cancel`);await renderRoute();toast('Tu cita fue cancelada. Puedes reservar otra hora.');}catch(error){toast(error.message,true);}};$('#confirm-dialog').showModal();return;
    }
    if(action==='refresh'){await renderRoute();return;}
    if(action==='legacy'){button.disabled=true;await post('/integrations',{available:button.dataset.available==='true'});await renderRoute();toast('Estado del receptor actualizado.');return;}
    if(action==='export'){
      button.disabled=true;const data=await api(`/patients/${encodeURIComponent(button.dataset.patient)}/export`);const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='ficha-demo.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('La copia de demostración está lista.');return;
    }
  }catch(error){toast(error.message,true);}finally{button.disabled=false;}
});
document.addEventListener('change',event=>{
  if(['contrast-toggle','motion-toggle'].includes(event.target.id))applySettings(settings());
  if(event.target.name==='doctor'){state.doctor=event.target.value;refreshSlots();}
  if(event.target.id==='booking-day'){if(!event.target.value)return;state.day=event.target.value;refreshSlots();}
});
document.addEventListener('input',event=>{if(event.target.closest('#record-form'))state.dirty=true;});
document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target,body=Object.fromEntries(new FormData(form)),submit=form.querySelector('[type=submit]')||$('#book-submit');
  if(submit)submit.disabled=true;
  try {
    if(form.id==='login-form'){
      $('#login-error').hidden=true;const data=await post('/login',body);state.user=data.user;state.csrf=data.csrf;state.filter='booked';history.replaceState(null,'','#inicio');await renderRoute();return;
    }
    if(form.id==='booking-form'){
      if(!state.slot)throw new Error('Selecciona una hora antes de confirmar.');
      const appointment=await post('/appointments',{slot_id:state.slot.id,reason:body.reason});state.slot=null;go('reserva/'+appointment.id);return;
    }
    if(form.id==='record-form'){
      body.appointment_id=Number(body.appointment_id);await post(`/patients/${form.dataset.patient}/records`,body);state.dirty=false;await renderRoute();toast('Atención guardada. La cita quedó atendida y se preparó el envío.');return;
    }
  }catch(error){
    const target=form.id==='login-form'?$('#login-error'):form.id==='booking-form'?$('#book-error'):$('#record-error');
    if(target){target.textContent=error.message;target.hidden=false;target.setAttribute('tabindex','-1');target.focus();}else toast(error.message,true);
    if(form.id==='booking-form'&&error.status===409)await refreshSlots();
  }finally{if(submit)submit.disabled=false;}
});
window.addEventListener('hashchange',renderRoute);
window.addEventListener('beforeunload',event=>{if(state.dirty){event.preventDefault();event.returnValue='';}});

async function init(){try{const session=await api('/session');state.user=session.user;state.csrf=session.csrf;await renderRoute();}catch{setPage(heading('No pudimos conectar con Cerca','Vuelve a cargar la página para reiniciar la demostración.'), 'Conexión local');}}
init();
