/* Offline workspace. All writes go through validated main-process handlers. */
window.Business = (() => {
  let data = {documents:[],projects:[],tasks:[]};
  let view = 'business';
  let query = '';
  let editor = null;
  let busy = false;
  let request = 0;
  const labels = {documents:'Dokumente',projects:'Projekte',tasks:'Aufgaben'};
  const statuses = {active:'Aktiv',paused:'Pausiert',done:'Erledigt',todo:'Offen',doing:'In Arbeit'};
  const kinds = {letter:'Geschäftsbrief',minutes:'Besprechungsprotokoll',note:'Notiz'};
  const e = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day = value => value ? value.split('-').reverse().join('.') : 'Ohne Termin';
  const currency = n => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n||0);
  const projectName = id => data.projects.find(p=>p.id===id)?.name || 'Ohne Projekt';
  const button = (action,label,id='',key='',cls='btn btn-secondary') => `<button type="button" class="${cls}" data-action="${action}" data-id="${e(id)}" data-key="${key}">${label}</button>`;
  const select = (name,options,value) => `<select name="${name}">${options.map(([v,l])=>`<option value="${e(v)}" ${v===value?'selected':''}>${e(l)}</option>`).join('')}</select>`;
  const field = (label,control) => `<label class="business-field"><span>${label}</span>${control}</label>`;
  const input = (name,value,type='text',required=false,max=200) => `<input name="${name}" type="${type}" value="${e(value)}" ${required?'required':''} maxlength="${max}" ${type==='number'?'min="0" max="1000000000000" step="0.01"':''}>`;
  const projectSelect = value => select('project_id',[['','Ohne Projekt'],...data.projects.map(p=>[p.id,p.name])],value);
  const badge = status => `<span class="business-badge ${e(status)}">${e(statuses[status]||status)}</span>`;
  function matching(rows) { return rows.filter(r=>[r.title,r.name,r.description,r.body,r.assignee,projectName(r.project_id)].join(' ').toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de'))); }
  function empty(title,text,action,key) { return `<div class="empty-state"><div class="empty-symbol">＋</div><h3>${title}</h3><p>${text}</p>${button(action,'Jetzt anlegen','',key,'btn btn-primary')}</div>`; }
  function cards(key,rows) {
    if(!rows.length) return query?'<div class="empty-state"><h3>Keine Treffer</h3><p>Versuchen Sie einen anderen Suchbegriff.</p></div>':empty(`Ihre ${labels[key]} beginnen hier`,key==='documents'?'Briefe, Protokolle und Ideen an einem Ort.':'Verknüpfen Sie Ihre Arbeit mit Kunden und klaren Terminen.','new',key);
    return `<div class="business-cards">${rows.map(r=>`<article class="business-record"><div class="record-top"><span class="eyebrow">${key==='documents'?e(kinds[r.kind]):'PROJEKT'}</span>${key==='projects'?badge(r.status):'<span class="business-badge">Lokal</span>'}</div><h2>${e(r.title||r.name)}</h2><p class="record-description">${e((r.body||r.description||'Noch keine Beschreibung.').slice(0,150))}</p><div class="record-meta">${key==='documents'?e(projectName(r.project_id)):`${e(currentStore.clients.find(c=>c.id===r.client_id)?.name||'Ohne Kunde')} · ${day(r.due_date)}`}</div>${key==='projects'?`<div class="project-progress"><progress max="${Math.max(1,data.tasks.filter(t=>t.project_id===r.id).length)}" value="${data.tasks.filter(t=>t.project_id===r.id&&t.status==='done').length}"></progress><small>${data.tasks.filter(t=>t.project_id===r.id&&t.status==='done').length}/${data.tasks.filter(t=>t.project_id===r.id).length} Aufgaben · Budget ${currency(r.budget)}</small></div>`:''}<div class="record-actions">${button('edit','Öffnen',r.id,key)}${key==='documents'?button('export','PDF',r.id,key):button('new-task','+ Aufgabe',r.id)}${button('delete','Löschen',r.id,key,'btn btn-danger-outline btn-sm')}</div></article>`).join('')}</div>`;
  }
  function board() {
    const rows=matching(data.tasks);
    return `<div class="task-board">${['todo','doing','done'].map(status=>`<section class="task-column"><h2>${statuses[status]} <span>${rows.filter(t=>t.status===status).length}</span></h2>${rows.filter(t=>t.status===status).map(t=>`<article class="task-card"><div class="record-top"><span class="business-badge ${t.priority==='high'?'high':''}">${t.priority==='high'?'Hohe Priorität':'Normal'}</span>${button('edit','Bearbeiten',t.id,'tasks','text-button')}</div><h3>${e(t.title)}</h3><p>${e(projectName(t.project_id))}</p><div class="task-details"><span class="${t.due_date && t.due_date<localToday()&&t.status!=='done'?'overdue-text':''}">${day(t.due_date)}</span><span>${e(t.assignee||'Meine Aufgabe')}</span></div><label class="task-move">Status ändern<select aria-label="Status für ${e(t.title)}" data-task-id="${e(t.id)}">${['todo','doing','done'].map(s=>`<option value="${s}" ${s===status?'selected':''}>${statuses[s]}</option>`).join('')}</select></label></article>`).join('')||'<p class="column-empty">Hier ist alles aufgeräumt.</p>'}</section>`).join('')}</div>`;
  }
  function hub() {
    const overdue=data.tasks.filter(t=>t.status!=='done'&&t.due_date&&t.due_date<localToday());
    const upcoming=data.tasks.filter(t=>t.status!=='done').sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999')).slice(0,5);
    return `<section class="business-hero"><div><span class="eyebrow">RECHLY BUSINESS WORKSPACE</span><h2>Ein guter Arbeitstag<br>beginnt mit Überblick.</h2><p>Dokumente, Projekte und Finanzen. Gemeinsam organisiert, lokal gespeichert.</p>${button('new','+ Neues Dokument','','documents','btn btn-primary')}${button('navigate','Finanzübersicht','dashboard')}</div><div class="hero-mark" aria-hidden="true"><span>R</span><small>BUSINESS<br>WORKSPACE</small></div></section>
      <div class="business-stats">${[['projects','Aktive Projekte',data.projects.filter(p=>p.status==='active').length],['tasks','Offene Aufgaben',data.tasks.filter(t=>t.status!=='done').length],['documents','Dokumente',data.documents.length]].map(([key,label,count])=>`<button data-action="navigate" data-id="${key}"><span>${label}</span><strong>${count}</strong><small>Öffnen →</small></button>`).join('')}<div class="deadline-stat"><span>Überfällige Aufgaben</span><strong>${overdue.length}</strong><small>${overdue.length?'Termine prüfen und neu planen':'Alles im Zeitplan'}</small></div></div>
      <div class="business-home-grid"><section class="card"><div class="section-heading"><h2>Als Nächstes</h2>${button('navigate','Alle Aufgaben →','tasks')}</div>${upcoming.map(t=>`<div class="agenda-row"><span class="agenda-date">${day(t.due_date)}</span><div><b>${e(t.title)}</b><small>${e(projectName(t.project_id))}</small></div>${button('edit','Öffnen',t.id,'tasks','text-button')}</div>`).join('')||empty('Freiraum für Ihre nächsten Schritte','Planen Sie eine Aufgabe und behalten Sie Termine im Blick.','new','tasks')}</section><section class="card"><div class="section-heading"><h2>Direkt loslegen</h2></div>${[['letter','Geschäftsbrief','Korrespondenz mit Kunden und Partnern'],['minutes','Besprechungsprotokoll','Entscheidungen und nächste Schritte festhalten'],['note','Projektnotiz','Ideen und Anforderungen strukturieren']].map(([id,title,sub])=>`<button class="template-row" data-action="template" data-id="${id}"><span class="template-icon">${id==='letter'?'Aa':id==='minutes'?'≡':'✎'}</span><span><b>${title}</b><small>${sub}</small></span><span>→</span></button>`).join('')}</section></div>`;
  }
  function paint() {
    if (currentView !== view) return;
    const container=document.getElementById('content-container');
    container.innerHTML=`<div class="page-header"><div><div class="eyebrow">BUSINESS SUITE</div><h1 class="page-title">${view==='business'?'Ihr Arbeitsplatz':labels[view]}</h1><p class="page-subtitle">${view==='business'?'Guten Überblick. Klare Prioritäten. Mehr Zeit für Ihr Geschäft.':view==='tasks'?'Von der Idee bis zum Abschluss – jeder Schritt hat seinen Platz.':view==='documents'?'Geschäftsbriefe, Protokolle und Notizen mit PDF- und Text-Export.':'Kunden, Budgets, Dokumente und Aufgaben zusammenbringen.'}</p></div>${view==='business'?'':button('new',`+ ${view==='documents'?'Dokument':view==='projects'?'Projekt':'Aufgabe'} anlegen`,'',view,'btn btn-primary')}</div>${view==='business'?hub():`<div class="business-toolbar"><label>Durchsuchen<input id="business-search" type="search" placeholder="${labels[view]} durchsuchen …" value="${e(query)}"></label><span>${data[view].length} Einträge · auf diesem Gerät</span></div><div id="business-results">${view==='tasks'?board():cards(view,matching(data[view]))}</div>`}`;
    container.onclick=onAction;
    const search=document.getElementById('business-search');
    if(search) search.oninput=()=>{query=search.value;document.getElementById('business-results').innerHTML=view==='tasks'?board():cards(view,matching(data[view]));};
    container.onchange=async event=>{
      const id=event.target.dataset.taskId;if(!id)return;
      const task=data.tasks.find(t=>t.id===id);event.target.disabled=true;
      try{data=await window.rechly.saveBusiness('tasks',{...task,status:event.target.value});paint();}catch(err){showToast(err.message,'error');paint();}
    };
  }
  function templates(kind) {
    return kind==='letter'?{title:'Geschäftsbrief',recipient:'',body:'Sehr geehrte Damen und Herren,\n\n[Ihr Anliegen]\n\n[Weitere Informationen und nächste Schritte]\n\nMit freundlichen Grüßen\n'+(currentStore.company.name||'')}:kind==='minutes'?{title:'Besprechungsprotokoll',recipient:'',body:'Datum: '+new Date().toLocaleDateString('de-DE')+'\nTeilnehmende: \n\nTAGESORDNUNG\n1. \n\nENTSCHEIDUNGEN\n• \n\nNÄCHSTE SCHRITTE\nAufgabe | Verantwortlich | Termin\n'}:{title:'Projektnotiz',recipient:'',body:'ZIEL\n\n\nANFORDERUNGEN\n\n\nOFFENE FRAGEN\n\n\nNÄCHSTE SCHRITTE\n'};
  }
  function openEditor(key,id='',preset={}) {
    const record=id?data[key].find(r=>r.id===id):{};if(!record)return;
    const r={...record,...preset};
    editor={key,id,dirty:false,opener:document.activeElement};
    let fields='';
    if(key==='documents') fields=field('Titel',input('title',r.title,'text',true))+`<div class="form-grid">${field('Dokumenttyp',select('kind',Object.entries(kinds),r.kind||'note'))}${field('Projekt',projectSelect(r.project_id||''))}</div>`+field('Empfänger / Teilnehmende',`<textarea name="recipient" rows="2" maxlength="1000">${e(r.recipient)}</textarea>`)+field('Dokumentinhalt',`<textarea class="document-body" name="body" rows="14" maxlength="100000" placeholder="Ihr Text …">${e(r.body)}</textarea>`);
    if(key==='projects') fields=field('Projektname',input('name',r.name,'text',true))+`<div class="form-grid">${field('Kunde',select('client_id',[['','Ohne Kunde'],...currentStore.clients.map(c=>[c.id,c.name])],r.client_id||''))}${field('Status',select('status',[['active','Aktiv'],['paused','Pausiert'],['done','Erledigt']],r.status||'active'))}${field('Zieldatum',input('due_date',r.due_date,'date'))}${field('Geplantes Budget (€)',input('budget',r.budget||0,'number'))}</div>`+field('Beschreibung',`<textarea name="description" rows="5" maxlength="10000">${e(r.description)}</textarea>`);
    if(key==='tasks') fields=field('Aufgabe',input('title',r.title,'text',true,300))+`<div class="form-grid">${field('Projekt',projectSelect(r.project_id||''))}${field('Kontakt / Notiz (optional)',input('assignee',r.assignee))}${field('Termin',input('due_date',r.due_date,'date'))}${field('Priorität',select('priority',[['normal','Normal'],['high','Hoch']],r.priority||'normal'))}${field('Status',select('status',[['todo','Offen'],['doing','In Arbeit'],['done','Erledigt']],r.status||'todo'))}</div>`;
    const dialog=document.getElementById('business-editor');
    dialog.innerHTML=`<form id="business-form"><header><div><span class="eyebrow">${labels[key]}</span><h2 id="business-editor-title">${id?'Bearbeiten':'Neu anlegen'}</h2></div>${button('close','Schließen')}</header><div class="business-form-body">${fields}<p id="business-form-error" role="alert"></p></div><footer><span id="business-save-state" role="status">${id?'Gespeicherten Eintrag bearbeiten':'Noch nicht gespeichert'}</span><div>${id&&key==='tasks'?button('delete','Löschen',id,key,'btn btn-danger-outline'):''}${id&&key==='documents'?button('export-text','Text exportieren',id):''}${button('close','Abbrechen')}<button class="btn btn-primary" type="submit">Speichern</button></div></footer></form>`;
    dialog.onclick=onAction;
    const form=dialog.querySelector('form');form.oninput=()=>{editor.dirty=true;document.getElementById('business-save-state').textContent='Ungespeicherte Änderungen';};
    form.onsubmit=async event=>{
      event.preventDefault();if(busy)return;busy=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;
      const payload=Object.fromEntries(new FormData(form));if(id)payload.id=id;if(key==='projects')payload.budget=Number(payload.budget);
      try{data=await window.rechly.saveBusiness(key,payload);editor.dirty=false;closeEditor();paint();showToast('Erfolgreich gespeichert.');}catch(err){document.getElementById('business-form-error').textContent=err.message;}finally{busy=false;submit.disabled=false;}
    };
    dialog.showModal();form.querySelector('input').focus();
  }
  function closeEditor() {
    if(busy && editor?.dirty)return;
    if(editor?.dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;
    const opener=editor?.opener;document.getElementById('business-editor').close();editor=null;opener?.focus();
  }
  async function onAction(event) {
    const el=event.target.closest('[data-action]');if(!el)return;
    const {action,id,key}=el.dataset;
    try {
      if(action==='navigate')showView(id);
      if(action==='new')openEditor(key);
      if(action==='edit')openEditor(key,id);
      if(action==='new-task')openEditor('tasks','',{project_id:id});
      if(action==='template')openEditor('documents','',{...templates(id),kind:id});
      if(action==='close')closeEditor();
      if(action==='delete'&&confirm('Diesen Eintrag dauerhaft löschen?')) {data=await window.rechly.deleteBusiness(key,id);if(editor){editor.dirty=false;closeEditor();}paint();showToast('Eintrag gelöscht.');}
      if(action==='export'||action==='export-text') {
        if(editor?.dirty){showToast('Bitte speichern Sie Ihre Änderungen vor dem Export.','error');return;}
        el.disabled=true;const result=await window.rechly.exportDocument(id,action==='export'?'pdf':'txt');if(result.success)showToast('Dokument exportiert.');
      }
    }catch(err){showToast(err.message,'error');}finally{el.disabled=false;}
  }
  async function render(nextView) {
    view=nextView;query='';const generation=++request;
    document.getElementById('content-container').innerHTML='<div class="empty-state" role="status">Arbeitsplatz wird geladen …</div>';
    try { const result=await window.rechly.getBusiness();if(generation!==request||currentView!==nextView)return;data=result;paint(); }
    catch(err){if(currentView===nextView)document.getElementById('content-container').innerHTML=`<div class="empty-state" role="alert"><h3>Arbeitsplatz konnte nicht geladen werden</h3><p>${e(err.message)}</p><button class="btn btn-secondary" onclick="Business.render('${nextView}')">Erneut versuchen</button></div>`;}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const dialog=document.createElement('dialog');dialog.id='business-editor';dialog.setAttribute('aria-labelledby','business-editor-title');document.body.append(dialog);
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
    window.addEventListener('beforeunload',event=>{if(editor?.dirty){event.preventDefault();event.returnValue='';}});
  });
  return {render};
})();
