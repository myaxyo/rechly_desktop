const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
function fixture(t) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rechly-store-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let fail=false;
 const mockedFs={...fs,renameSync:(...args)=>{if(fail)throw Error('Simulated disk error');return fs.renameSync(...args)}};
 const exports={};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../out/store.js'),'utf8'),{exports,structuredClone,console:{error(){}},require:name=>name==='electron'?{app:{getPath:()=>dir}}:name==='node:fs'?mockedFs:require(name)});
 return {store:exports.default,dir,fail:()=>{fail=true}};
}
test('atomically replaces the vault and retains the previous version as backup', t=>{
 const {store,dir}=fixture(t);const before=fs.readFileSync(store.getVaultPath(),'utf8');
 store.set('company',{name:'Test Company'});
 assert.equal(JSON.parse(fs.readFileSync(store.getVaultPath(),'utf8')).company.name,'Test Company');
 assert.equal(fs.readFileSync(path.join(dir,'rechly_vault.backup.json'),'utf8'),before);
 assert.equal(fs.existsSync(store.getVaultPath()+'.tmp'),false);
});
test('failed writes preserve the original file and roll back in-memory updates', t=>{
 const {store,fail}=fixture(t);const before=fs.readFileSync(store.getVaultPath(),'utf8');const company=store.get('company');
 fail();assert.throws(()=>store.set('company',{name:'Must not persist'}),/nicht gespeichert/);
 assert.equal(fs.readFileSync(store.getVaultPath(),'utf8'),before);assert.deepEqual(store.get('company'),company);
});
test('callers cannot mutate records before successful persistence',t=>{
 const {store}=fixture(t);const invoices=store.get('invoices');invoices[0].invoice_number='MUTATED';
 assert.notEqual(store.get('invoices')[0].invoice_number,'MUTATED');
});
