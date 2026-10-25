// Run with a display and Playwright Core supplied by the development environment.
const {_electron}=require(process.env.RECHLY_PLAYWRIGHT_PATH || 'playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'rechly-business-'));
const launch=()=>_electron.launch({executablePath:process.env.RECHLY_EXECUTABLE||require(path.join(root,'node_modules/electron')),args:[...(process.env.RECHLY_EXECUTABLE?[]:[root]),'--no-sandbox','--disable-gpu','--user-data-dir='+profile],env:{...process.env,XDG_CONFIG_HOME:profile}});
(async()=>{
 let app=await launch();
 try {
  const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>window.rechly);
  await page.evaluate(()=>window.rechly.completeOnboarding({cloud_ai_opt_in:false,remove_sample_data:false}));
  await page.reload();await page.waitForSelector('.business-hero');
  await page.locator('#nav-projects').click();await page.getByRole('button',{name:'+ Projekt anlegen',exact:true}).click();
  await page.locator('[name=name]').fill('Kundenportal');await page.locator('[name=client_id]').selectOption('client-sample-1');await page.locator('[name=budget]').fill('2500');
  await page.locator('#business-form [type=submit]').click();await page.waitForSelector('#business-editor',{state:'hidden'});await page.waitForSelector('.business-record');
  await page.getByRole('button',{name:'+ Aufgabe',exact:true}).click();await page.locator('[name=title]').fill('Konzept freigeben');await page.locator('[name=assignee]').fill('Anna');await page.locator('[name=due_date]').fill('2026-01-01');
  await page.locator('#business-form [type=submit]').click();await page.waitForSelector('#business-editor',{state:'hidden'});
  await page.locator('#nav-tasks').click();await page.waitForSelector('[data-task-id]');await page.locator('[data-task-id]').selectOption('doing');await page.waitForFunction(()=>document.querySelector('.task-column:nth-child(2) .task-card'));
  await page.locator('#nav-business').click();await page.getByRole('button',{name:/Geschäftsbrief Korrespondenz/}).click();
  await page.locator('[name=title]').fill('Projektbestätigung');await page.locator('[name=body]').fill('Vielen Dank für Ihren Auftrag.\nWir freuen uns auf die Zusammenarbeit.');
  const projectId=await page.evaluate(async()=>(await window.rechly.getBusiness()).projects[0].id);await page.locator('[name=project_id]').selectOption(projectId);
  await page.locator('#business-form [type=submit]').click();await page.waitForSelector('#business-editor',{state:'hidden'});
  await page.locator('#nav-documents').click();await page.waitForSelector('.business-record');
  await page.locator('#business-search').fill('kein-treffer');assert.match(await page.locator('#business-results').innerText(),/Keine Treffer/);await page.locator('#business-search').fill('Projektbestätigung');assert.equal(await page.locator('.business-record').count(),1);
  const pdfPath=path.join(profile,'document.pdf');await app.evaluate(({dialog},p)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:p});},pdfPath);
  await page.getByRole('button',{name:'PDF',exact:true}).click();await page.waitForFunction(()=>document.getElementById('toast').textContent==='Dokument exportiert.');assert.equal(fs.readFileSync(pdfPath).subarray(0,4).toString(),'%PDF');
  const txtPath=path.join(profile,'document.txt');await app.evaluate(({dialog},p)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:p});},txtPath);
  const docId=await page.evaluate(async()=>(await window.rechly.getBusiness()).documents[0].id);await page.evaluate(id=>window.rechly.exportDocument(id,'txt'),docId);assert.match(fs.readFileSync(txtPath,'utf8'),/Vielen Dank/);
  const blocked=await page.evaluate(async id=>{try{await window.rechly.deleteBusiness('projects',id);return false;}catch{return true;}},projectId);assert.equal(blocked,true);
  await page.getByRole('button',{name:'Öffnen',exact:true}).click();await page.locator('[name=body]').fill('Ungespeichert');
  page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Abbrechen',exact:true}).click();assert.equal(await page.locator('#business-editor').isVisible(),true);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Abbrechen',exact:true}).click();await page.waitForSelector('#business-editor',{state:'hidden'});
  await page.locator('#nav-business').click();await page.waitForSelector('.business-hero');assert.equal(await page.locator('.nav-item.active').getAttribute('id'),'nav-business');await page.screenshot({path:path.join(profile,'workspace.png')});
  assert.deepEqual(errors,[]);await app.close();app=await launch();const restored=await app.firstWindow();await restored.waitForSelector('.business-hero');
  const data=await restored.evaluate(()=>window.rechly.getBusiness());assert.equal(data.projects.length,1);assert.equal(data.tasks[0].status,'doing');assert.equal(data.documents[0].title,'Projektbestätigung');assert.match(data.documents[0].body,/Vielen Dank/);
  await restored.locator('#nav-tasks').click();await restored.getByRole('button',{name:'Bearbeiten',exact:true}).click();restored.once('dialog',d=>d.accept());await restored.getByRole('button',{name:'Löschen',exact:true}).click();await restored.waitForSelector('#business-editor',{state:'hidden'});assert.equal((await restored.evaluate(()=>window.rechly.getBusiness())).tasks.length,0);
  console.log('PASS: project/customer links, task creation/status, document templates, search, PDF/text export, linked deletion protection, dirty-edit protection, restart persistence.');console.log('Artifacts:',profile);
 } finally {await app.close();}
})().catch(e=>{console.error(e);process.exit(1)});
