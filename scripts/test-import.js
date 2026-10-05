const {DatabaseSync}=require('node:sqlite');const fs=require('fs');const path=require('path');const os=require('os');const assert=require('assert/strict');const {pathToFileURL}=require('url');
const {importDatabase}=require('./migrate-turso');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'mq-import-'));const source=path.join(root,'source.db');const dest=path.join(root,'target.db');const queue=path.join(root,'queue.json');
(async()=>{try{
const db=new DatabaseSync(source);db.exec(fs.readFileSync(path.join(__dirname,'../lib/schema.sql'),'utf8'));
db.exec("INSERT INTO patients(id,full_name,username,password_hash) VALUES(42,'Test Patient','testname','unchanged-hash'); INSERT INTO visits(patient_id,department_id,department_name,queue_number,queue_issued_at) VALUES(42,1,'Clinic','T003','2026-10-01T12:00:00Z');");db.close();
const state={departments:[{id:1,name:'Clinic',waiting:['T003'],nextNumber:4}],portalSettings:{primaryColor:'#8833ff'}};fs.writeFileSync(queue,JSON.stringify(state));
const args={url:pathToFileURL(dest).href,database:source,queue};
const counts=await importDatabase(args);assert.equal(counts.patients,1);assert.equal(counts.visits,1);
const target=new DatabaseSync(dest);assert.equal(target.prepare('SELECT password_hash FROM patients WHERE id=42').get().password_hash,'unchanged-hash');assert.deepEqual(JSON.parse(target.prepare('SELECT data FROM queue_state').get().data),state);target.close();
await assert.rejects(()=>importDatabase(args),/already contains/);
const original=new DatabaseSync(source,{readOnly:true});assert.equal(original.prepare('SELECT COUNT(*) AS n FROM patients').get().n,1);original.close();
console.log('PASS: importer preserves account IDs/password hashes, visits and theme/queue settings; refuses a populated destination and leaves source untouched.');
}finally{fs.rmSync(root,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
