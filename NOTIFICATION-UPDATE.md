# MediQueue phone alerts update

## Install in VS Code
1. Back up your current project. Stop the server with Ctrl+C.
2. Extract the updated ZIP. Open the outer HOSPITAL QUEUE WEB NEW folder containing server.js and package.json, not the nested older copy.
3. Keep your private .env values and database/data files. No import or reset is needed for this update.
4. Run npm install, then npm test, then npm start.

The server creates patient_push and a persistent push key in app_metadata automatically, using your existing Turso connection. No Firebase account is needed. Optional VAPID_SUBJECT can be your public HTTPS website URL or mailto contact. Do not remove/change the stored push_vapid key after users subscribe.

## Update GitHub / Render
If using a separate extracted folder, copy the changed files into your existing Git checkout. Run there:

    git add server.js package.json package-lock.json lib/push-notifications.js public/patient.js public/patient.html public/queue-push.js public/queue-alert-sw.js scripts/test-push.js NOTIFICATION-UPDATE.md
    git commit -m "Add patient phone push alerts and stronger sound"
    git push origin main

Wait for Render to report Live for that commit. Keep your existing Turso environment variables. Keep .env, database files, node_modules and the ZIP out of GitHub.

## Enable on each phone
1. Open the HTTPS Render patient website and sign in.
2. Take a queue number; find the alert buttons in your ticket panel.
3. Tap the existing Enable alerts button for stronger in-page sound and vibration.
4. Tap Enable phone notifications, then choose Allow in the browser prompt.
5. Enable Chrome/site notification sound, vibration, lock-screen alerts and pop-up banners in Android settings. Names vary by phone. Raise media volume for website sound and notification volume for background alerts.
6. Stay signed in. After logging out and back in, enable phone notifications again. Enable separately on every device you want notified.

After enabling, the same button disables phone alerts. Logout removes subscriptions registered to that login session. Another patient enabling alerts on the same browser replaces its previous subscription owner.

## Test with two devices
- Patient phone: take a ticket and enable both buttons.
- Staff device: call the queue. Check the popup, stronger sound and vibration.
- Minimize Chrome on the patient phone and Recall from staff. Check the system notification.
- Lock the phone screen and Recall again. Tap the notification to open the current queue page.
- Complete/cancel the ticket; confirm the page reflects its current status.
- Restart the server and repeat with a new ticket. Keys/subscriptions persist in Turso.

## Phone limitations
The website displays a calling popup in its page and a native system notification when background push arrives. It cannot display a custom incoming-call screen over other apps, override silent/Do Not Disturb, force a loud system ringtone or guarantee a heads-up banner. Browser support and phone settings control these behaviors. Foreground sound is boosted 2.5x with bounded gain; background alerts use the phone's notification sound.

A locked screen can receive alerts. A powered-off phone, no internet, force-stopped browser, battery restrictions or unavailable server can prevent/delay delivery. Push messages expire after 60 seconds to reduce stale calls. Already displayed notifications may remain after completion; opening them retrieves current status. Calls and recalls send alerts, not a continuous alarm. Notification text contains queue and room only, not name or department.

The service worker does not cache pages/themes. This update does not change the existing database importer.

## Verification
Existing account/storage/queue/appointment tests passed. Push recipient isolation, expired endpoint cleanup, logout cleanup, stable keys and endpoint validation passed with a mock transport. Service-worker notification display, expiry and click destination passed in an isolated JavaScript test. Live external delivery and physical phone sound/vibration still need the two-device test above.
