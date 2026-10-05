'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const vm=require('node:vm');
const {createDatabase}=require('../lib/database');const {setupPush,validSubscription}=require('../lib/push-notifications');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mq-push-'));const db=createDatabase({url:'file:'+path.join(dir,'test.db')});
 try{
 await db.exec('CREATE TABLE app_metadata(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE visits(id INTEGER PRIMARY KEY,patient_id INTEGER,department_id INTEGER,queue_number TEXT,status TEXT);');
 const routes={};const app={get:(p,...h)=>routes[p]=h,post:(p,...h)=>routes[p]=h};const sent=[];
 const transport={sendNotification:async(s,p)=>{sent.push({endpoint:s.endpoint,payload:JSON.parse(p)});if(s.endpoint.endsWith('expired'))throw {statusCode:410};}};
 const service=await setupPush(db,app,()=>{},transport);
 const key=(await db.prepare("SELECT value FROM app_metadata WHERE key='push_vapid'").get()).value;
 await setupPush(db,app,()=>{},transport);
 assert.equal((await db.prepare("SELECT value FROM app_metadata WHERE key='push_vapid'").get()).value,key);
 const sub={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'A'.repeat(87),auth:'A'.repeat(22)}};
 assert(validSubscription(sub));assert(!validSubscription({...sub,endpoint:'https://127.0.0.1/private'}));assert(!validSubscription({...sub,endpoint:'https://fcm.googleapis.com.evil.test/x'}));
 for(const [endpoint,patient,sid] of [['test',1,'a'],['expired',1,'b'],['other',2,'c']])await db.prepare('INSERT INTO patient_push VALUES (?,?,?,?,?)').run('https://fcm.googleapis.com/fcm/send/'+endpoint,patient,sid,JSON.stringify({...sub,endpoint:sub.endpoint.replace('test',endpoint)}),Date.now());
 await db.prepare("INSERT INTO visits VALUES(1,1,3,'A001','called')").run();
 await service.send({departmentId:3,queueNumber:'A001',room:'2',type:'call'});
 assert.equal(sent.length,2);assert(sent.every(s=>!s.endpoint.endsWith('other')));assert(sent[0].payload.body.includes('room 2'));
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM patient_push').get()).n,2);
 await service.logout('a');assert.equal((await db.prepare('SELECT COUNT(*) n FROM patient_push WHERE patient_id=1').get()).n,0);
 await service.send({departmentId:99,queueNumber:'A001'});assert.equal(sent.length,2);
 const events={};const shown=[];let opened;
 const self={location:{origin:'https://example.test'},addEventListener:(n,f)=>events[n]=f,registration:{showNotification:async(t,o)=>shown.push({t,o})},clients:{matchAll:async()=>[],openWindow:async u=>opened=u}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/queue-alert-sw.js'),'utf8'),{self,URL,Date});
 let pending;events.push({data:{json:()=>sent[0].payload},waitUntil:p=>pending=p});await pending;assert.equal(shown.length,1);assert.equal(shown[0].o.vibrate[0],500);
 events.push({data:{json:()=>({...sent[0].payload,sentAt:Date.now()-120000})},waitUntil:p=>pending=p});await pending;assert.equal(shown.length,1);
 events.notificationclick({notification:{close(){}},waitUntil:p=>pending=p});await pending;assert.equal(opened,'https://example.test/patient.html');
 console.log('PASS: push recipient isolation, expired subscription removal, logout cleanup, persistent keys, endpoint validation, notification rendering/expiry and click destination.');
 }finally{await db.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
