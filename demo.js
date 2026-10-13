'use strict';
// Standalone teaching demo. In-memory data only; no network or real authorization.
window.cercaDemo = (() => {
  const day = offset => {const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const now = () => new Date().toISOString();
  const users = [
    {id:'p1',name:'Elena Morales',initials:'EM',age:68,role:'patient',email:'elena@cerca.local'},
    {id:'p2',name:'Carlos Rojas',initials:'CR',age:72,role:'patient',email:'carlos@cerca.local'},
    {id:'d1',name:'Dra. Valentina Silva',initials:'VS',role:'doctor',specialty:'Medicina general',email:'valentina@cerca.local'},
    {id:'d2',name:'Dr. Tomás Herrera',initials:'TH',role:'doctor',specialty:'Medicina familiar',email:'tomas@cerca.local'},
    {id:'a1',name:'Administración Cerca',initials:'AC',role:'admin',email:'admin@cerca.local'},
    {id:'u1',name:'Auditoría Cerca',initials:'AU',role:'auditor',email:'auditor@cerca.local'}
  ];
  const doctors=users.filter(u=>u.role==='doctor');
  const slots=[];
  for(let i=0;i<=14;i++)for(const doc of doctors)for(const time of ['09:00','09:30','10:00','10:30','11:00','11:30','15:00','15:30','16:00','16:30'])slots.push({id:slots.length+1,doctor_id:doc.id,day:day(i),time});
  const seedSlot=slots.find(s=>s.doctor_id==='d1'&&s.day===day(1)&&s.time==='10:00');
  const appointments=[{id:1,patient_id:'p1',doctor_id:'d1',slot_id:seedSlot.id,day:seedSlot.day,time:seedSlot.time,status:'booked',reason:'Consulta de demostración'},
    {id:2,patient_id:'p2',doctor_id:'d1',slot_id:0,day:day(-2),time:'11:00',status:'completed',reason:'Seguimiento ficticio'}];
  const records=[{id:1,patient_id:'p1',doctor_id:'d1',title:'Primera atención de ejemplo',created_at:new Date(Date.now()-7*86400000).toISOString(),note:'Registro ficticio para mostrar la organización de la ficha clínica. Se conversó sobre las necesidades de la paciente y el uso de la plataforma.',plan:'Ejemplo de acuerdos registrados. Este texto no contiene indicaciones médicas.',export_state:'sent'},
    {id:2,patient_id:'p2',doctor_id:'d1',title:'Seguimiento de ejemplo',created_at:new Date(Date.now()-2*86400000).toISOString(),note:'Atención ficticia que permite explorar el historial del segundo paciente.',plan:'Ejemplo de seguimiento.',export_state:'sent'}];
  const events=[{record_id:1,state:'sent',attempts:1,created_at:records[0].created_at,delivered_at:records[0].created_at,last_error:''}];
  const audit=[{created_at:now(),actor_name:'Sistema de demostración',action:'demo.start',resource:'demo',result:'allowed'}];
  let current=null, available=true;
  const fail=(message,status=403)=>{const e=new Error(message);e.status=status;throw e;};
  const log=(action,resource,result='allowed')=>audit.unshift({created_at:now(),actor_name:current?.name||'Visitante',action,resource,result});
  const role=(...roles)=>{if(!current)fail('Elige un perfil para continuar.',401);if(!roles.includes(current.role)){log('demo.access','seccion','denied');fail('Esta sección corresponde a otro perfil de demostración.');}};
  const visible=()=>appointments.filter(a=>current.role==='admin'||(current.role==='doctor'&&a.doctor_id===current.id)||(current.role==='patient'&&a.patient_id===current.id));
  const enrich=a=>({...a,patient_name:users.find(u=>u.id===a.patient_id).name,doctor_name:users.find(u=>u.id===a.doctor_id).name,doctor_initials:users.find(u=>u.id===a.doctor_id).initials,specialty:users.find(u=>u.id===a.doctor_id).specialty});
  const canRead=id=>current.role==='patient'?current.id===id:current.role==='doctor'&&appointments.some(a=>a.patient_id===id&&a.doctor_id===current.id);
  const flush=()=>{if(available)for(const event of events.filter(e=>e.state==='pending')){event.state='sent';event.attempts++;event.delivered_at=now();event.last_error='';records.find(r=>r.id===event.record_id).export_state='sent';log('integration.deliver','demo/record/'+event.record_id);}};
  async function request(path,options={}) {
    const [route,query='']=path.split('?'),params=new URLSearchParams(query),method=options.method||'GET',body=options.body?JSON.parse(options.body):{};
    if(route==='/session')return {user:current,csrf:'static-demo'};
    if(route==='/login') {
      current=users.find(u=>u.email===body.email)||null;
      if(!current)fail('Elige uno de los perfiles de ejemplo.',400);
      log('session.login',current.id);return {user:current,csrf:'static-demo'};
    }
    if(!current)fail('Elige un perfil para continuar.',401);
    if(route==='/logout'){log('session.logout',current.id);current=null;return {ok:true};}
    if(route==='/overview') {
      const list=visible().map(enrich);
      return {next:list.filter(a=>a.status==='booked').sort((a,b)=>(a.day+a.time).localeCompare(b.day+b.time))[0]||null,
        appointments:list,booked:list.filter(a=>a.status==='booked').length,completed:list.filter(a=>a.status==='completed').length,
        patients:new Set(list.map(a=>a.patient_id)).size,pending:events.filter(e=>e.state==='pending').length,events:audit.length,denied:audit.filter(e=>e.result==='denied').length};
    }
    if(route==='/professionals'){role('patient');return doctors;}
    if(route==='/slots') {
      role('patient');return slots.filter(s=>s.doctor_id===params.get('doctor')&&s.day===params.get('day')&&new Date(s.day+'T'+s.time)>new Date()&&!appointments.some(a=>a.slot_id===s.id&&a.status==='booked'));
    }
    if(route==='/appointments') {
      role('patient','doctor','admin');
      if(method==='GET')return visible().map(enrich);
      role('patient');const s=slots.find(s=>s.id===Number(body.slot_id));
      if(!s||new Date(s.day+'T'+s.time)<=new Date())fail('Elige una hora futura.',400);
      if(appointments.some(a=>a.slot_id===s.id&&a.status==='booked'))fail('Esa hora ya está reservada en esta demo.',409);
      const a={id:appointments.length+1,patient_id:current.id,doctor_id:s.doctor_id,slot_id:s.id,day:s.day,time:s.time,status:'booked',reason:body.reason||''};
      appointments.push(a);log('appointment.book','appointment/'+a.id);return enrich(a);
    }
    const cancel=route.match(/^\/appointments\/(\d+)\/cancel$/);
    if(cancel){role('patient','doctor','admin');const a=visible().find(a=>a.id===Number(cancel[1]));if(!a||a.status!=='booked')fail('No hay una cita agendada para cancelar.',404);a.status='cancelled';log('appointment.cancel','appointment/'+a.id);return {ok:true};}
    if(route==='/patients'){role('doctor');return users.filter(u=>u.role==='patient'&&canRead(u.id));}
    const clinical=route.match(/^\/patients\/([^/]+)(?:\/(records|export))?$/);
    if(clinical) {
      role('patient','doctor');const id=decodeURIComponent(clinical[1]),kind=clinical[2];
      if(!canRead(id)){log('clinical.read','patient/'+id,'denied');fail('Este perfil no tiene una ficha asociada a esa persona.');}
      const patient=users.find(u=>u.id===id&&u.role==='patient');if(!patient)fail('No se encontró la ficha de ejemplo.',404);
      if(kind==='records') {
        role('doctor');const a=visible().find(a=>a.id===Number(body.appointment_id)&&a.patient_id===id&&a.status==='booked');
        if(!a)fail('Elige una cita agendada de este paciente.',400);
        if(!body.title?.trim()||!body.note?.trim())fail('Completa el título y el registro de ejemplo.',400);
        const record={id:records.length+1,patient_id:id,doctor_id:current.id,title:body.title,note:body.note,plan:body.plan||'',created_at:now(),export_state:'pending'};
        records.unshift(record);a.status='completed';events.push({record_id:record.id,state:'pending',attempts:0,created_at:now(),delivered_at:null,last_error:available?'':'Receptor simulado no disponible'});log('clinical.write','patient/'+id);flush();return {ok:true};
      }
      const data={patient,records:records.filter(r=>r.patient_id===id).map(r=>({...r,doctor_name:users.find(u=>u.id===r.doctor_id).name}))};
      log(kind==='export'?'clinical.export':'clinical.read','patient/'+id);
      return kind==='export'?{demo:true,description:'Datos ficticios. No es un documento FHIR validado.',...data}:data;
    }
    if(route==='/audit'){role('auditor');return audit.slice(0,300);}
    if(route==='/integrations') {
      role('admin');if(method==='POST'){available=!!body.available;log('integration.availability','demo/receiver');flush();}
      return {available,pending:events.filter(e=>e.state==='pending').length,sent:events.filter(e=>e.state==='sent').length,events};
    }
    fail('Esta función no está incluida en la demo.',404);
  }
  return {request};
})();
