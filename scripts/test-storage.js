const {spawn}=require('child_process');const assert=require('assert/strict');const fs=require('fs');const os=require('os');const path=require('path');const {DatabaseSync}=require('node:sqlite');
const cwd=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mediqueue-turso-'));const filename=path.join(temp,'test.db');
const env={...process.env,TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',RENDER:'',MEDIQUEUE_SQLITE_PATH:filename,PORT:'3291',ADMIN_STAFF_ID:'testadmin',ADMIN_USERNAME:'testadmin',ADMIN_PASSWORD:'test-only-password-2026'};
let server,logs='';const base='http://127.0.0.1:3291';
async function start(){server=spawn(process.execPath,['server.js'],{cwd,env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);for(let i=0;i<100;i++){try{let r=await fetch(base+'/api/data');if(r.ok)return}catch{}if(server.exitCode!==null)throw new Error(logs);await new Promise(r=>setTimeout(r,100));}throw new Error('Startup timed out '+logs);}
async function stop(){const s=server;if(!s||s.exitCode!==null)return;await new Promise(r=>{s.once('exit',r);s.kill();});}
async function req(jar,url,body,status=200,method){if(body?.loginRole==='admin')jar.admin=true;const r=await fetch(base+(jar.admin?'/admin':'')+url,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(jar.cookie?{cookie:jar.cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});let c=r.headers.get('set-cookie');if(c)jar.cookie=c.split(';')[0];let data;try{data=await r.json()}catch{throw new Error(url+' non JSON '+r.status)}assert.equal(r.status,status,url+' '+JSON.stringify(data));return data;}
(async()=>{try{
await start();
const seed=new DatabaseSync(filename);seed.prepare('UPDATE queue_state SET data=? WHERE id=1').run(JSON.stringify({departments:[{id:1,name:'Test Clinic',prefix:'T',open:true,nextNumber:1,waiting:[],rooms:[{number:'1',currentQueue:null}]}],portalSettings:{systemName:'MediQueue Test',primaryColor:'#8833ff'}}));seed.close();
const a={},b={},other={},admin={},staff={};
await req({},'/api/patient/active-ticket',null,401);
await req(a,'/api/patient/signup',{fullName:'Test Patient',username:'sharedname',password:'password-test1'});
await req(b,'/api/patient/login',{username:'sharedname',password:'password-test1'});
await req({},'/api/staff/signup',{staffId:'TEST-1',fullName:'Test Staff',username:'sharedname',password:'password-test1'},201);
await req({},'/api/staff/login',{username:'sharedname',password:'password-test1',loginRole:'staff'},403);
await req(admin,'/api/staff/login',{username:'testadmin',password:env.ADMIN_PASSWORD,loginRole:'admin'});
const pending=await req(admin,'/api/staff/pending');await req(admin,'/api/staff/approve/'+pending[0].id,{});
await req(staff,'/api/staff/login',{username:'sharedname',password:'password-test1',loginRole:'staff'});
await req({},'/api/staff/login',{username:'sharedname',password:'password-test1',loginRole:'staff'});
// A real browser sends both cookies: the URL must select exactly one session.
async function browserSession(url,method='GET') {
 const r=await fetch(base+url,{method,headers:{cookie:staff.cookie+'; '+admin.cookie}});
 assert.equal(r.status,200,url);return r.json();
}
assert.equal((await browserSession('/api/staff/session')).role,'staff');
assert.equal((await browserSession('/admin/api/staff/session')).role,'admin');
await browserSession('/admin/api/staff/logout','POST');
assert.equal((await browserSession('/api/staff/session')).loggedIn,true);
assert.equal((await browserSession('/admin/api/staff/session')).loggedIn,false);
await req(admin,'/api/staff/login',{username:'testadmin',password:env.ADMIN_PASSWORD,loginRole:'admin'});
await browserSession('/api/staff/logout','POST');
assert.equal((await browserSession('/admin/api/staff/session')).loggedIn,true);
assert.equal((await browserSession('/api/staff/session')).loggedIn,false);
await req(staff,'/api/staff/login',{username:'sharedname',password:'password-test1',loginRole:'staff'});
console.log('PASS: same-browser staff/admin cookies and logout are independent in both directions.');
await req(staff,'/api/queue/call-next',{departmentId:1,roomNumber:'1'},403);
await req(admin,'/api/admin/staff-permissions/'+pending[0].id,{departmentIds:[1]},200,'PUT');
assert.deepEqual((await req(staff,'/api/staff/permissions/me')).departmentIds,[1]);
const repeated=await Promise.all(Array.from({length:8},(_,i)=>req(i%2?a:b,'/api/queue/take',{departmentId:1})));
assert(repeated.every(x=>x.queueNumber==='T001'));assert.equal(new Set(repeated.map(x=>x.ticket.visitId)).size,1);
const first=repeated[0].ticket;assert.equal((await req(b,'/api/patient/active-ticket')).ticket.visitId,first.visitId);
await req(a,'/api/patient/logout',{});await req(a,'/api/patient/login',{username:'sharedname',password:'password-test1'});
assert.equal((await req(a,'/api/patient/active-ticket')).ticket.queueNumber,'T001');
await req(other,'/api/patient/signup',{fullName:'Other Patient',username:'othername',password:'password-test2'});
assert.equal((await req(other,'/api/patient/active-ticket')).ticket,null);
assert.equal((await req(other,'/api/queue/take',{departmentId:1})).queueNumber,'T002');
const before=(await req({},'/api/data'));
await stop();await start();
assert.equal((await req(b,'/api/patient/me')).username,'sharedname');
assert.equal((await req(b,'/api/patient/active-ticket')).ticket.visitId,first.visitId);
assert.deepEqual((await req({},'/api/data')).portalSettings,before.portalSettings);
await req({},'/api/patient/login',{username:'sharedname',password:'password-test1'});
await req({},'/api/staff/login',{username:'sharedname',password:'password-test1',loginRole:'staff'});
await req(staff,'/api/queue/call-next',{departmentId:1,roomNumber:'1'});
assert.equal((await req(b,'/api/patient/active-ticket')).ticket.status,'called');
await req(staff,'/api/queue/complete',{departmentId:1,roomNumber:'1'});
assert.equal((await req(b,'/api/patient/active-ticket')).ticket,null);
assert.equal((await req(b,'/api/queue/take',{departmentId:1})).queueNumber,'T003');
await req(admin,'/api/queue/reset',{departmentId:1,confirmReset:true});
assert.equal((await req(other,'/api/patient/active-ticket')).ticket,null);
assert.equal((await req(b,'/api/queue/take',{departmentId:1})).queueNumber,'T001');
const date=new Date(Date.now()+86400000*2).toISOString().slice(0,10);
const slot=await req(staff,'/api/staff/appointments/slots',{departmentId:1,date,time:'10:00',capacity:1},201);
await req(b,'/api/appointments/book',{slotId:slot.id},201);
await req(other,'/api/appointments/book',{slotId:slot.id},409);
const mine=await req(b,'/api/appointments/mine');assert.equal(mine[0].department_name,'Test Clinic');
await req(b,'/api/appointments/mine/'+mine[0].id+'/cancel',{});
await req(other,'/api/appointments/book',{slotId:slot.id},201);
// Inject a write failure after queue state changes: the whole issuance must roll back.
const inspect=new DatabaseSync(filename);inspect.exec("CREATE TRIGGER reject_visit BEFORE INSERT ON visits BEGIN SELECT RAISE(ABORT,'test failure'); END;");inspect.close();
const p={};await req(p,'/api/patient/signup',{fullName:'Fail Patient',username:'failname',password:'password-test3'});
const queueBefore=await req({},'/api/data');await req(p,'/api/queue/take',{departmentId:1},503);
assert.deepEqual((await req({},'/api/data')).departments,queueBefore.departments);
assert.equal((await req(p,'/api/patient/active-ticket')).ticket,null);
console.log('PASS: separate patient/staff accounts, cross-session login, approval/permissions, concurrent ticket issuance, logout/login, restart persistence for accounts/tickets/sessions/theme, completion/reset, appointments/capacity and atomic rollback.');
}catch(e){console.error(e);console.error(logs);process.exitCode=1;}finally{await stop();fs.rmSync(temp,{recursive:true,force:true});}})();
