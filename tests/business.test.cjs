const {test}=require('node:test');
const assert=require('node:assert/strict');
const {emptyBusiness,saveBusinessRecord,deleteBusinessRecord,documentHtml,collection}=require('../out/business');
const project={name:'Website',description:'Relaunch',client_id:'c',status:'active',due_date:'2026-12-01',budget:1500};
const task={title:'Konzept',assignee:'Anna',priority:'high',status:'todo',due_date:'2026-11-01',project_id:''};
const document={title:'Protokoll',kind:'minutes',recipient:'Team',body:'Entscheidung',project_id:''};
test('creates and updates projects without modifying the input snapshot',()=>{
 const initial=emptyBusiness();const next=saveBusinessRecord(initial,'projects',project,['c']);assert.equal(initial.projects.length,0);assert.equal(next.projects.length,1);
 const edited=saveBusinessRecord(next,'projects',{...next.projects[0],name:'Neuer Name'},['c']);assert.equal(edited.projects.length,1);assert.equal(edited.projects[0].name,'Neuer Name');
});
test('validates required fields, references, dates, status and budget',()=>{
 for(const patch of [{name:''},{budget:-1},{budget:NaN},{due_date:'2026-02-30'},{status:'unknown'},{client_id:'missing'}]) assert.throws(()=>saveBusinessRecord(emptyBusiness(),'projects',{...project,...patch},['c']));
 assert.throws(()=>collection('__proto__'));assert.throws(()=>saveBusinessRecord(emptyBusiness(),'documents',{...document,id:'invented'},[]));
 assert.throws(()=>saveBusinessRecord(emptyBusiness(),'tasks',{...task,project_id:'missing'},[]));
});
test('protects linked projects and allows removal after unlinking',()=>{
 let data=saveBusinessRecord(emptyBusiness(),'projects',project,['c']);const id=data.projects[0].id;
 data=saveBusinessRecord(data,'tasks',{...task,project_id:id},['c']);
 assert.throws(()=>deleteBusinessRecord(data,'projects',id),/verknüpfungen/);
 data=saveBusinessRecord(data,'tasks',{...data.tasks[0],project_id:''},['c']);
 assert.equal(deleteBusinessRecord(data,'projects',id).projects.length,0);
});
test('exports document text as escaped HTML with no network resources',()=>{
 const data=saveBusinessRecord(emptyBusiness(),'documents',{...document,body:'<script>alert(1)</script>',title:'A & B'},[]);
 const html=documentHtml(data.documents[0],'<img src=x>');assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('A &amp; B'));assert.ok(html.includes("default-src 'none'"));assert.ok(!html.includes('<script>'));
});
