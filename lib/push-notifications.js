'use strict';
const webpush = require('web-push');
function validSubscription(s) {
  try {
    const u = new URL(s.endpoint);
    const allowed = u.hostname === 'fcm.googleapis.com' || u.hostname === 'updates.push.services.mozilla.com' || u.hostname.endsWith('.notify.windows.com') || u.hostname === 'web.push.apple.com';
    return allowed && u.protocol === 'https:' && !u.port && !u.username && !u.password && s.endpoint.length < 2048 && /^[\w-]{87}$/.test(s.keys.p256dh) && /^[\w-]{22}$/.test(s.keys.auth);
  } catch { return false; }
}
async function setupPush(db, app, requirePatient, transport = webpush) {
  await db.exec('CREATE TABLE IF NOT EXISTS patient_push (endpoint TEXT PRIMARY KEY, patient_id INTEGER NOT NULL, session_id TEXT NOT NULL, subscription TEXT NOT NULL, updated_at INTEGER NOT NULL);');
  const keys = webpush.generateVAPIDKeys();
  await db.prepare("INSERT OR IGNORE INTO app_metadata(key,value) VALUES ('push_vapid',?)").run(JSON.stringify(keys));
  const stored = JSON.parse((await db.prepare("SELECT value FROM app_metadata WHERE key='push_vapid'").get()).value);
  const options = {vapidDetails:{subject: process.env.VAPID_SUBJECT || 'https://mediqueue-44ip.onrender.com', ...stored}, TTL:60, urgency:'high', timeout:8000};
  function sameOrigin(req,res,next) {
    if (req.get('sec-fetch-site') === 'cross-site') return res.sendStatus(403);
    next();
  }
  app.get('/api/patient/push-key',requirePatient,(req,res)=>res.set('Cache-Control','no-store').json({publicKey:stored.publicKey}));
  app.post('/api/patient/push-subscription', requirePatient,sameOrigin,async(req,res)=>{
    const s=req.body;
    if(!validSubscription(s)) return res.status(400).json({error:'Unsupported browser push subscription.'});
    const result = await db.transaction(async()=>{
      const count=await db.prepare('SELECT COUNT(*) AS n FROM patient_push WHERE patient_id=?').get(req.session.patientId);
      const existing=await db.prepare('SELECT endpoint FROM patient_push WHERE endpoint=?').get(s.endpoint);
      if(!existing && count.n>=10) return false;
      await db.prepare('INSERT INTO patient_push VALUES (?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET patient_id=excluded.patient_id,session_id=excluded.session_id,subscription=excluded.subscription,updated_at=excluded.updated_at').run(s.endpoint,req.session.patientId,req.sessionID,JSON.stringify({endpoint:s.endpoint,keys:s.keys}),Date.now());
      return true;
    });
    if(!result) return res.status(409).json({error:"Too many enabled devices. Disable alerts on another device first."});
    res.json({success:true});
  });
  app.post('/api/patient/push-disable',requirePatient,sameOrigin,async(req,res)=>{
    await db.prepare('DELETE FROM patient_push WHERE endpoint=? AND patient_id=?').run(String(req.body.endpoint||''),req.session.patientId);
    res.json({success:true});
  });
  return {
    async logout(sid) {await db.prepare('DELETE FROM patient_push WHERE session_id=?').run(sid);},
    async send(call) {
      const visit=await db.prepare("SELECT id,patient_id FROM visits WHERE department_id=? AND queue_number=? AND status='called' ORDER BY id DESC LIMIT 1").get(call.departmentId,call.queueNumber);
      if(!visit) return;
      const subscriptions=await db.prepare('SELECT * FROM patient_push WHERE patient_id=?').all(visit.patient_id);
      const payload=JSON.stringify({title:call.type==='recall'?'Your queue is being called again':'It is your turn',body:`Queue ${call.queueNumber} — please go to room ${call.room}.`,tag:`mq-visit-${visit.id}`,sentAt:Date.now()});
      await Promise.all(subscriptions.map(async row=>{
        try {await transport.sendNotification(JSON.parse(row.subscription),payload,options);}
        catch(e) {
          if(e.statusCode===404 || e.statusCode===410) await db.prepare('DELETE FROM patient_push WHERE endpoint=? AND subscription=?').run(row.endpoint,row.subscription);
          else console.warn('Queue push delivery failed:',e.statusCode||e.code||'network');
        }
      }));
    }
  };
}
module.exports={setupPush,validSubscription};
