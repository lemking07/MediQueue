// ======================================================
// MEDIQUEUE SERVER V4
// Real-Time Hospital Queue Management System
// Advanced Patient Portal Designer
// ======================================================

try {
  require("node:process").loadEnvFile();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const express = require("express");
const path = require("path");
const fs = require("fs");
const http = require("http");
const session = require("express-session");
const { Server } = require("socket.io");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { DatabaseSync } = require("node:sqlite");
const scrypt = promisify(crypto.scrypt);
const patientDb = new DatabaseSync(path.join(__dirname, "database", "mediqueue.db"));
patientDb.exec("PRAGMA foreign_keys = ON;");
patientDb.exec(`CREATE TABLE IF NOT EXISTS patients (id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL, department_id INTEGER NOT NULL, department_name TEXT NOT NULL, queue_number TEXT NOT NULL, room_number TEXT, queue_issued_at TEXT NOT NULL, called_at TEXT, completed_at TEXT, status TEXT NOT NULL DEFAULT 'waiting', FOREIGN KEY(patient_id) REFERENCES patients(id));`);
const isoNow = () => new Date().toISOString();
function updateVisit(departmentId, queueNumber, changes) {
    const allowed = ["room_number", "called_at", "completed_at", "status"];
    const keys = Object.keys(changes).filter(key => allowed.includes(key));
    if (!keys.length) return;
    const set = keys.map(key => `${key} = ?`).join(", ");
    patientDb.prepare(`UPDATE visits SET ${set} WHERE id = (SELECT id FROM visits WHERE department_id = ? AND queue_number = ? AND status IN ('waiting','called') ORDER BY id DESC LIMIT 1)`).run(...keys.map(key => changes[key]), departmentId, queueNumber);
}
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(
    __dirname,
    "data",
    "queue.json"
);


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
    express.json({
        limit: "6mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "6mb"
    })
);

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "mediqueue-secret-key-2026",

        resave: false,
        saveUninitialized: false,

        cookie: {
            maxAge: 1000 * 60 * 60 * 8,
            httpOnly: true,
            sameSite: "lax"
        }
    })
);


// Individual staff accounts. Configure ADMIN_STAFF_ID and ADMIN_PASSWORD before first run.
patientDb.exec(`CREATE TABLE IF NOT EXISTS staff_accounts (id INTEGER PRIMARY KEY, staff_id TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff', approved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS staff_shifts (id INTEGER PRIMARY KEY, staff_id INTEGER NOT NULL, clock_in TEXT NOT NULL, clock_out TEXT, FOREIGN KEY(staff_id) REFERENCES staff_accounts(id));
CREATE TABLE IF NOT EXISTS staff_actions (id INTEGER PRIMARY KEY, staff_id INTEGER NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', happened_at TEXT NOT NULL, FOREIGN KEY(staff_id) REFERENCES staff_accounts(id));`);
const staffHash = async password => { const salt=crypto.randomBytes(16).toString('hex'); const hash=await scrypt(password,salt,64); return salt+':'+hash.toString('hex'); };
const staffVerify = async (password,stored) => { const [salt,hex]=String(stored).split(':'); if(!salt||!hex||hex.length!==128)return false; const hash=await scrypt(password,salt,64); return crypto.timingSafeEqual(hash,Buffer.from(hex,'hex')); };
function staffLog(id,action,details='') { if(id)patientDb.prepare('INSERT INTO staff_actions (staff_id,action,details,happened_at) VALUES (?,?,?,?)').run(id,action,details,isoNow()); }
function closeShift(id) { const row=patientDb.prepare('SELECT id FROM staff_shifts WHERE staff_id=? AND clock_out IS NULL ORDER BY id DESC LIMIT 1').get(id); if(row)patientDb.prepare('UPDATE staff_shifts SET clock_out=? WHERE id=?').run(isoNow(),row.id); }
async function seedAdmin() {
  const staffId = process.env.ADMIN_STAFF_ID;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!staffId || !username || !password) {
    console.warn("Admin environment variables are missing.");
    return;
  }

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
  }

  const admin = patientDb.prepare(
    "SELECT id FROM staff_accounts WHERE role = 'admin' LIMIT 1"
  ).get();

  if (admin) {
    patientDb.prepare(
      `UPDATE staff_accounts
       SET staff_id = ?, username = ?, password_hash = ?, approved = 1
       WHERE id = ? AND role = 'admin'`
    ).run(staffId, username, await staffHash(password), admin.id);

    console.log("Administrator credentials updated.");
  } else {
    patientDb.prepare(
      `INSERT INTO staff_accounts
       (staff_id, full_name, username, password_hash, role, approved)
       VALUES (?, 'Administrator', ?, ?, 'admin', 1)`
    ).run(staffId, username, await staffHash(password));

    console.log("Administrator account created.");
  }
}

seedAdmin().catch(error => {
  console.error("Administrator setup:", error.message);
});
// ======================================================
// DEFAULT PATIENT PORTAL SETTINGS
// ======================================================

const DEFAULT_PORTAL_SETTINGS = {

    // ------------------------------------------
    // BRANDING
    // ------------------------------------------

    systemName:
        "MediQueue",

    welcomeText:
        "Smart Hospital Queue Management System",

    announcement:
        "",

    logoDataUrl:
    "",
    faviconDataUrl:
    "",

// Website Settings:
// Automatically use colors extracted
// from the uploaded global website logo.
autoThemeFromLogo:
    false,

bannerDataUrl:
    "",


    // ------------------------------------------
    // COLORS
    // ------------------------------------------

    primaryColor:
        "#0F9D8A",

    secondaryColor:
        "#17324D",

    backgroundColor:
        "#F4FBF9",

    cardColor:
        "#FFFFFF",

    textColor:
        "#17324D",

    buttonTextColor:
        "#FFFFFF",


    // ------------------------------------------
    // THEME
    // ------------------------------------------

    theme:
        "light",

    backgroundStyle:
        "medical",

    cardStyle:
        "soft",

    buttonStyle:
        "rounded",


    // ------------------------------------------
    // LAYOUT
    // ------------------------------------------

    portalWidth:
        "normal",

    departmentLayout:
        "grid",

    queueButtonPosition:
        "bottom",

    textAlignment:
        "left",


    // ------------------------------------------
    // SECTION ORDER
    // Staff will later be able to rearrange these.
    // ------------------------------------------

    sectionOrder: [
        "welcome",
        "announcement",
        "departments",
        "ticket"
    ],


    // ------------------------------------------
    // VISIBILITY
    // ------------------------------------------

    showWelcome:
        true,

    showAnnouncement:
        true,

    showConnectionStatus:
        true,

    showWaitingCount:
        true,

    showEstimatedTime:
        true,

    showFooter:
        true,


    // ------------------------------------------
    // ANIMATIONS
    // ------------------------------------------

    buttonAnimation:
        true,

    cardAnimation:
        true,

    calledAnimation:
        true,


    // ------------------------------------------
    // PATIENT SOUNDS
    // ------------------------------------------

    patientCallSound:
        true,

    recallSound:
        true,

    notificationSoundStyle:
        "medical"
};


// ======================================================
// VALID OPTIONS
// ======================================================

const PORTAL_OPTIONS = {

    theme: [
        "light",
        "dark",
        "glass"
    ],

    backgroundStyle: [
        "solid",
        "soft",
        "gradient",
        "medical"
    ],

    cardStyle: [
        "solid",
        "soft",
        "glass",
        "outline"
    ],

    buttonStyle: [
        "rounded",
        "soft",
        "square",
        "pill"
    ],

    portalWidth: [
        "compact",
        "normal",
        "wide"
    ],

    departmentLayout: [
        "grid",
        "list",
        "compact"
    ],

    queueButtonPosition: [
        "bottom",
        "center",
        "inside",
        "full"
    ],

    textAlignment: [
        "left",
        "center"
    ],

    notificationSoundStyle: [
        "medical",
        "soft",
        "digital"
    ]
};


const VALID_PORTAL_SECTIONS = [
    "welcome",
    "announcement",
    "departments",
    "ticket"
];


// ======================================================
// HELPER FUNCTIONS
// ======================================================

function isHexColor(value) {

    return /^#[0-9A-Fa-f]{6}$/.test(
        String(value || "")
    );
}


function cleanString(
    value,
    maxLength = 500
) {

    return String(
        value === undefined ||
        value === null
            ? ""
            : value
    )
        .trim()
        .slice(
            0,
            maxLength
        );
}


function normalizeBoolean(
    value,
    fallback
) {

    if (
        typeof value ===
        "boolean"
    ) {
        return value;
    }

    return fallback;
}


function normalizeOption(
    value,
    options,
    fallback
) {

    return options.includes(value)
        ? value
        : fallback;
}


function normalizeSectionOrder(
    value
) {

    if (!Array.isArray(value)) {

        return [
            ...DEFAULT_PORTAL_SETTINGS
                .sectionOrder
        ];
    }


    const cleaned = [];

    value.forEach(section => {

        if (
            VALID_PORTAL_SECTIONS
                .includes(section) &&
            !cleaned.includes(section)
        ) {

            cleaned.push(section);
        }

    });


    VALID_PORTAL_SECTIONS
        .forEach(section => {

            if (
                !cleaned.includes(
                    section
                )
            ) {

                cleaned.push(
                    section
                );
            }

        });


    return cleaned;
}


// ======================================================
// NORMALIZE PORTAL SETTINGS
// ======================================================

function normalizePortalSettings(
    settings
) {

    settings =
        settings &&
        typeof settings === "object"
            ? settings
            : {};


    const result = {
        ...DEFAULT_PORTAL_SETTINGS
    };


    // ------------------------------------------
    // TEXT
    // ------------------------------------------

    const systemName =
        cleanString(
            settings.systemName,
            80
        );

    result.systemName =
        systemName ||
        DEFAULT_PORTAL_SETTINGS
            .systemName;


    result.welcomeText =
        settings.welcomeText !==
        undefined

            ? cleanString(
                settings.welcomeText,
                250
            )

            : DEFAULT_PORTAL_SETTINGS
                .welcomeText;


    result.announcement =
        settings.announcement !==
        undefined

            ? cleanString(
                settings.announcement,
                500
            )

            : "";


    // ------------------------------------------
    // IMAGES
    // ------------------------------------------

    result.logoDataUrl =
        typeof settings.logoDataUrl ===
        "string"
            ? settings.logoDataUrl
            : "";

            result.faviconDataUrl =
    typeof settings.faviconDataUrl === "string"
        ? settings.faviconDataUrl
        : "";


    result.bannerDataUrl =
        typeof settings.bannerDataUrl ===
        "string"
            ? settings.bannerDataUrl
            : "";


    // ------------------------------------------
    // COLORS
    // ------------------------------------------

    [
        "primaryColor",
        "secondaryColor",
        "backgroundColor",
        "cardColor",
        "textColor",
        "buttonTextColor"

    ].forEach(key => {

        if (
            isHexColor(
                settings[key]
            )
        ) {

            result[key] =
                settings[key];
        }

    });


    // ------------------------------------------
    // DESIGN OPTIONS
    // ------------------------------------------

    result.theme =
        normalizeOption(
            settings.theme,
            PORTAL_OPTIONS.theme,
            result.theme
        );


    result.backgroundStyle =
        normalizeOption(
            settings.backgroundStyle,
            PORTAL_OPTIONS
                .backgroundStyle,
            result.backgroundStyle
        );


    result.cardStyle =
        normalizeOption(
            settings.cardStyle,
            PORTAL_OPTIONS.cardStyle,
            result.cardStyle
        );


    result.buttonStyle =
        normalizeOption(
            settings.buttonStyle,
            PORTAL_OPTIONS.buttonStyle,
            result.buttonStyle
        );


    result.portalWidth =
        normalizeOption(
            settings.portalWidth,
            PORTAL_OPTIONS.portalWidth,
            result.portalWidth
        );


    result.departmentLayout =
        normalizeOption(
            settings.departmentLayout,
            PORTAL_OPTIONS
                .departmentLayout,
            result.departmentLayout
        );


    result.queueButtonPosition =
        normalizeOption(
            settings.queueButtonPosition,
            PORTAL_OPTIONS
                .queueButtonPosition,
            result.queueButtonPosition
        );


    result.textAlignment =
        normalizeOption(
            settings.textAlignment,
            PORTAL_OPTIONS.textAlignment,
            result.textAlignment
        );


    result.notificationSoundStyle =
        normalizeOption(
            settings
                .notificationSoundStyle,
            PORTAL_OPTIONS
                .notificationSoundStyle,
            result.notificationSoundStyle
        );


    // ------------------------------------------
    // SECTION ORDER
    // ------------------------------------------

    result.sectionOrder =
        normalizeSectionOrder(
            settings.sectionOrder
        );


    // ------------------------------------------
    // BOOLEAN SETTINGS
    // ------------------------------------------

    [
        "autoThemeFromLogo",
        "showWelcome",
        "showAnnouncement",
        "showConnectionStatus",
        "showWaitingCount",
        "showEstimatedTime",
        "showFooter",
        "buttonAnimation",
        "cardAnimation",
        "calledAnimation",
        "patientCallSound",
        "recallSound"

    ].forEach(key => {

        result[key] =
            normalizeBoolean(
                settings[key],
                result[key]
            );

    });


    return result;
}


// ======================================================
// NORMALIZE ALL DATA
// ======================================================

function normalizeData(data) {

    if (
        !data ||
        typeof data !== "object"
    ) {

        data = {};
    }


    if (
        !Array.isArray(
            data.departments
        )
    ) {

        data.departments = [];
    }


    // ------------------------------------------
    // PATIENT PORTAL SETTINGS
    // ------------------------------------------

    data.portalSettings =
        normalizePortalSettings(
            data.portalSettings
        );


    // ------------------------------------------
    // DEPARTMENTS
    // ------------------------------------------

    data.departments.forEach(
        department => {
            // ------------------------------------------
// DEPARTMENT CUSTOM LOGO
// ------------------------------------------

if (
    typeof department.logoDataUrl !==
    "string"
) {
    department.logoDataUrl = "";
}

if (
    department.logoDataUrl &&
    !department.logoDataUrl.startsWith(
        "data:image/"
    )
) {
    department.logoDataUrl = "";
}

            if (
                !Array.isArray(
                    department.rooms
                )
            ) {

                department.rooms = [];
            }


            if (
                !Array.isArray(
                    department.waiting
                )
            ) {

                department.waiting = [];
            }


            if (
                !Array.isArray(
                    department.completed
                )
            ) {

                department.completed = [];
            }


            if (
                typeof department
                    .nextNumber !==
                "number"
            ) {

                department.nextNumber =
                    1;
            }


            if (
                typeof department.open !==
                "boolean"
            ) {

                department.open =
                    true;
            }


            // Estimated service time

            if (
                !Number.isFinite(
                    Number(
                        department
                            .estimatedMinutes
                    )
                ) ||
                Number(
                    department
                        .estimatedMinutes
                ) < 1
            ) {

                department
                    .estimatedMinutes =
                    5;

            } else {

                department
                    .estimatedMinutes =
                    Math.round(
                        Number(
                            department
                                .estimatedMinutes
                        )
                    );
            }


            department.rooms.forEach(
                room => {

                    if (
                        room.currentQueue ===
                        undefined
                    ) {

                        room.currentQueue =
                            null;
                    }


                    if (!room.status) {

                        room.status =
                            room.currentQueue
                                ? "busy"
                                : "available";
                    }

                }
            );

        }
    );


    return data;
}


// ======================================================
// READ DATA
// ======================================================

function readData() {

    try {

        const rawData =
            fs.readFileSync(
                DATA_FILE,
                "utf8"
            );


        return normalizeData(
            JSON.parse(rawData)
        );

    } catch (error) {

        console.error(
            "Unable to read queue.json:",
            error
        );


        return normalizeData({
            departments: []
        });
    }
}


// ======================================================
// SAVE DATA
// ======================================================

function saveData(data) {

    const normalized =
        normalizeData(data);


    fs.writeFileSync(
        DATA_FILE,

        JSON.stringify(
            normalized,
            null,
            2
        )
    );
}


// ======================================================
// REAL-TIME UPDATE
// ======================================================

function broadcastData() {

    io.emit(
        "queue:update",
        readData()
    );
}


// ======================================================
// SOCKET.IO
// ======================================================

io.on(
    "connection",
    socket => {

        console.log(
            "Realtime client connected:",
            socket.id
        );


        socket.emit(
            "queue:update",
            readData()
        );


        socket.on(
            "disconnect",
            () => {

                console.log(
                    "Realtime client disconnected:",
                    socket.id
                );

            }
        );

    }
);


// ======================================================
// STAFF AUTH CHECK
// ======================================================

function requireStaffLogin(
    req,
    res,
    next
) {

    if (
        req.session &&
        req.session.staffLoggedIn ===
        true
    ) {

        const account=patientDb.prepare('SELECT role,approved FROM staff_accounts WHERE id=?').get(req.session.staffId);
        if(account?.approved && account.role===req.session.staffRole)return next();
    }


    return res
        .status(401)
        .json({
            error:
                "Staff login required."
        });
}


// ======================================================
// ROOT PAGE
// ======================================================

app.get(
    "/",
    (req, res) => {

        res.redirect(
            "/patient.html"
        );

    }
);


// ======================================================
// STAFF LOGIN PAGE
// ======================================================

app.get(
    "/staff-login.html",
    (req, res) => {

        if (
            req.session &&
            req.session.staffLoggedIn
        ) {

            return res.redirect(
                "/staff.html"
            );
        }


        res.sendFile(
            path.join(
                __dirname,
                "public",
                "staff-login.html"
            )
        );

    }
);


// ======================================================
// PROTECTED STAFF PAGE
// ======================================================

app.get(
    "/staff.html",
    (req, res) => {

        if (
            !req.session ||
            !req.session.staffLoggedIn
        ) {

            return res.redirect(
                "/staff-login.html"
            );
        }


        res.sendFile(
            path.join(
                __dirname,
                "public",
                "staff.html"
            )
        );

    }
);


// ======================================================
// STATIC FILES
// ======================================================

app.get("/patient.html",(req,res) => {
    if (!req.session?.patientId) return res.redirect("/patient-login.html");
    res.sendFile(path.join(__dirname,"public","patient.html"));
});
app.get('/admin.html', (req,res) => {
  if (!req.session?.staffLoggedIn) return res.redirect('/staff-login.html');
  if (req.session.staffRole !== 'admin') return res.status(403).send('Administrator only.');
  res.set('Cache-Control','no-store');
  res.sendFile(path.join(__dirname,'public','admin.html'));
});

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// ======================================================
// STAFF LOGIN API
// ======================================================

app.post('/api/staff/signup',async(req,res)=>{
 try {const {staffId,fullName,username,password}=req.body||{};
 if(!/^[A-Za-z0-9-]{3,32}$/.test(staffId||'')||!String(fullName||'').trim()||!/^[A-Za-z0-9_.-]{3,32}$/.test(username||'')||typeof password!=='string'||password.length<10)return res.status(400).json({error:'Enter a valid college ID, name, username and password (at least 10 characters).'});
 patientDb.prepare('INSERT INTO staff_accounts (staff_id,full_name,username,password_hash) VALUES (?,?,?,?)').run(staffId,fullName.trim(),username,await staffHash(password));
 res.status(201).json({success:true,message:'Account submitted for administrator approval.'});
 }catch(e){res.status(409).json({error:'College ID or username already registered.'});}
});
app.post('/api/staff/login',async(req,res)=>{
 try {const {username,password,loginRole}=req.body||{};if(loginRole!==undefined&&!['staff','admin'].includes(loginRole))return res.status(400).json({error:'Invalid login type.'});const account=patientDb.prepare('SELECT * FROM staff_accounts WHERE username=? OR staff_id=?').get(username,username);
 if(!account||typeof password!=='string'||!(await staffVerify(password,account.password_hash)))return res.status(401).json({error:'Invalid login details.'});
 if(loginRole&&account.role!==loginRole)return res.status(403).json({error:loginRole==='admin'?'This account does not have administrator access.':'Use Admin Login for this account.'});
 if(!account.approved)return res.status(403).json({error:'Your account is awaiting administrator approval.'});
 req.session.regenerate(error=>{if(error)return res.status(500).json({error:'Unable to create session.'});req.session.staffLoggedIn=true;req.session.staffUsername=account.username;req.session.staffId=account.id;req.session.staffRole=account.role;req.session.save(err=>{if(err)return res.status(500).json({error:'Unable to save session.'});staffLog(account.id,'login');res.json({success:true});});});
 }catch(e){res.status(500).json({error:'Login failed.'});}
});
app.get('/api/staff/pending',requireStaffLogin,(req,res)=>{
 if(req.session.staffRole!=='admin')return res.status(403).json({error:'Administrator only.'});
 res.json(patientDb.prepare('SELECT id,staff_id,full_name,username,created_at FROM staff_accounts WHERE approved=0').all());
});
app.post('/api/staff/approve/:id',requireStaffLogin,(req,res)=>{
 if(req.session.staffRole!=='admin')return res.status(403).json({error:'Administrator only.'});
 const result=patientDb.prepare("UPDATE staff_accounts SET approved=1 WHERE id=? AND role='staff'").run(req.params.id);
 staffLog(req.session.staffId,'approve_staff',String(req.params.id));res.json({success:result.changes>0});
});
app.post('/api/staff/clock-in',requireStaffLogin,(req,res)=>{
 const id=req.session.staffId;if(!id)return res.status(403).json({error:'Individual account required.'});
 if(patientDb.prepare('SELECT id FROM staff_shifts WHERE staff_id=? AND clock_out IS NULL').get(id))return res.status(409).json({error:'Already clocked in.'});
 patientDb.prepare('INSERT INTO staff_shifts (staff_id,clock_in) VALUES (?,?)').run(id,isoNow());staffLog(id,'clock_in');res.json({success:true});
});
app.post('/api/staff/clock-out',requireStaffLogin,(req,res)=>{
 const id=req.session.staffId;if(!patientDb.prepare('SELECT id FROM staff_shifts WHERE staff_id=? AND clock_out IS NULL').get(id))return res.status(409).json({error:'Not clocked in.'});
 closeShift(id);staffLog(id,'clock_out');res.json({success:true});
});
// V5 phase 1: administrator-only overview; no patient-identifying information.
app.get('/api/admin/overview', requireStaffLogin, (req, res) => {
  if (req.session.staffRole !== 'admin') return res.status(403).json({error:'Administrator only.'});
  const data = readData();
  const departments = data.departments.map(d => ({
    id:d.id, name:d.name, open:Boolean(d.open),
    waiting:Array.isArray(d.waiting)?d.waiting.length:0,
    serving:Array.isArray(d.rooms)?d.rooms.filter(r=>Boolean(r.currentQueue)).length:0,
    rooms:Array.isArray(d.rooms)?d.rooms.length:0
  }));
  const staff = patientDb.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN approved=0 THEN 1 ELSE 0 END) AS pending FROM staff_accounts WHERE role='staff'").get();
  res.set('Cache-Control','no-store');
  res.json({departments, staff:{total:staff.total,pending:staff.pending||0},
    waiting:departments.reduce((n,d)=>n+d.waiting,0),
    serving:departments.reduce((n,d)=>n+d.serving,0)});
});
// Administrative account management: server-side role checks on every endpoint.
const requireAdmin=(req,res,next)=>req.session.staffRole==='admin'?next():res.status(403).json({error:'Administrator only.'});
app.get('/api/staff/accounts',requireStaffLogin,requireAdmin,(req,res)=>{
 res.json(patientDb.prepare('SELECT id,staff_id,full_name,username,role,approved,created_at FROM staff_accounts ORDER BY id DESC').all());
});
app.patch('/api/staff/accounts/:id',requireStaffLogin,requireAdmin,(req,res)=>{
 const id=Number(req.params.id), approved=req.body?.approved;
 if(!Number.isSafeInteger(id)||id<1||typeof approved!=='boolean')return res.status(400).json({error:'Invalid account or approval status.'});
 const target=patientDb.prepare('SELECT id,role,approved FROM staff_accounts WHERE id=?').get(id);
 if(!target)return res.status(404).json({error:'Account not found.'});
 if(target.role==='admin'||id===req.session.staffId)return res.status(403).json({error:'Administrator accounts cannot be changed here.'});
 patientDb.prepare('UPDATE staff_accounts SET approved=? WHERE id=?').run(approved?1:0,id);
 staffLog(req.session.staffId,approved?'enable_staff':'disable_staff',String(id));
 res.json({success:true});
});
app.get('/api/staff/work-report',requireStaffLogin,(req,res)=>{
 const admin=req.session.staffRole==='admin', id=req.session.staffId;
 const shifts=admin?patientDb.prepare('SELECT s.*,a.staff_id AS college_id,a.full_name FROM staff_shifts s JOIN staff_accounts a ON a.id=s.staff_id ORDER BY s.id DESC LIMIT 500').all():patientDb.prepare('SELECT * FROM staff_shifts WHERE staff_id=? ORDER BY id DESC LIMIT 100').all(id);
 const actions=admin?patientDb.prepare('SELECT l.*,a.staff_id AS college_id,a.full_name FROM staff_actions l JOIN staff_accounts a ON a.id=l.staff_id ORDER BY l.id DESC LIMIT 500').all():patientDb.prepare('SELECT * FROM staff_actions WHERE staff_id=? ORDER BY id DESC LIMIT 100').all(id);
 res.json({shifts,actions,serverTime:isoNow()});
});
// V5 Phase 2: department permissions. Existing staff are unassigned until an admin grants access.
patientDb.exec(`CREATE TABLE IF NOT EXISTS staff_department_permissions (
 staff_account_id INTEGER NOT NULL,
 department_id INTEGER NOT NULL,
 PRIMARY KEY(staff_account_id,department_id),
 FOREIGN KEY(staff_account_id) REFERENCES staff_accounts(id) ON DELETE CASCADE
);`);
function allowedDepartment(staffId, departmentId) {
 return Boolean(patientDb.prepare('SELECT 1 FROM staff_department_permissions WHERE staff_account_id=? AND department_id=?').get(staffId,departmentId));
}
app.get('/api/staff/permissions/me',requireStaffLogin,(req,res)=>{
 const admin=req.session.staffRole==='admin';
 const departmentIds=admin?readData().departments.map(d=>d.id):patientDb.prepare('SELECT department_id FROM staff_department_permissions WHERE staff_account_id=? ORDER BY department_id').all(req.session.staffId).map(row=>row.department_id);
 res.set('Cache-Control','no-store').json({role:req.session.staffRole,departmentIds});
});
app.get('/api/admin/staff-permissions',requireStaffLogin,requireAdmin,(req,res)=>{
 const staff=patientDb.prepare("SELECT id,staff_id,full_name,username,approved FROM staff_accounts WHERE role='staff' ORDER BY full_name").all();
 const permissions=patientDb.prepare('SELECT staff_account_id,department_id FROM staff_department_permissions ORDER BY department_id').all();
 res.set('Cache-Control','no-store').json({staff:staff.map(a=>({...a,departmentIds:permissions.filter(p=>p.staff_account_id===a.id).map(p=>p.department_id)})),departments:readData().departments.map(d=>({id:d.id,name:d.name}))});
});
app.put('/api/admin/staff-permissions/:id',requireStaffLogin,requireAdmin,(req,res)=>{
 const id=Number(req.params.id), ids=req.body?.departmentIds;
 if(!Number.isSafeInteger(id)||id<1||!Array.isArray(ids)||ids.length>100||ids.some(v=>!Number.isSafeInteger(v)||v<1)||new Set(ids).size!==ids.length)return res.status(400).json({error:'Invalid staff or department list.'});
 const staff=patientDb.prepare("SELECT id FROM staff_accounts WHERE id=? AND role='staff'").get(id);
 if(!staff)return res.status(404).json({error:'Staff account not found.'});
 const valid=new Set(readData().departments.map(d=>d.id));
 if(ids.some(v=>!valid.has(v)))return res.status(400).json({error:'Department not found.'});
 patientDb.exec('BEGIN IMMEDIATE');
 try{
  patientDb.prepare('DELETE FROM staff_department_permissions WHERE staff_account_id=?').run(id);
  const insert=patientDb.prepare('INSERT INTO staff_department_permissions(staff_account_id,department_id) VALUES(?,?)');
  ids.forEach(deptId=>insert.run(id,deptId));
  patientDb.exec('COMMIT');
 }catch(e){patientDb.exec('ROLLBACK');return res.status(500).json({error:'Unable to save permissions.'});}
 staffLog(req.session.staffId,'update_staff_permissions',String(id));
 res.json({success:true,departmentIds:ids});
});
// Enforce permissions before all existing mutation handlers; UI hiding alone is insufficient.
app.use((req,res,next)=>{
 if(!/^(POST|PUT|PATCH|DELETE)$/.test(req.method))return next();
 const queueAction=/^\/api\/queue\/(call-next|assign|recall|complete|reset)$/.test(req.path);
 const departmentAction=/^\/api\/staff\/departments(?:\/|$)/.test(req.path);
 const settingsAction=/^\/api\/staff\/portal-settings(?:\/|$)/.test(req.path);
 if(!queueAction&&!departmentAction&&!settingsAction)return next();
 if(!req.session?.staffLoggedIn)return res.status(401).json({error:'Staff login required.'});
 const account=patientDb.prepare('SELECT role,approved FROM staff_accounts WHERE id=?').get(req.session.staffId);
 if(!account||!account.approved)return res.status(403).json({error:'Staff account is not approved.'});
 if(account.role==='admin')return next();
 if(settingsAction||req.path==='/api/staff/departments')return res.status(403).json({error:'Administrator access required for system configuration.'});
 const id=queueAction?Number(req.body?.departmentId):Number(req.path.split('/')[4]);
 if(!Number.isSafeInteger(id)||id<1||!allowedDepartment(req.session.staffId,id))return res.status(403).json({error:'You are not assigned to this department.'});
 // Structural changes are administrator-only; assigned staff can update department details and operate queues.
 if(departmentAction && (req.method==='DELETE'||/\/rooms(?:\/|$)|\/logo$/.test(req.path)))return res.status(403).json({error:'Administrator access required to change department structure.'});
 next();
});
// Audit successful staff operations; only record action identifiers, never patient names or passwords.
app.use((req,res,next)=>{
 if(req.session?.staffId && /^(POST|PUT|PATCH|DELETE)$/.test(req.method) && (/^\/api\/queue\//.test(req.path)||/^\/api\/staff\/(departments|portal-settings)/.test(req.path))){
 const id=req.session.staffId, action=req.method+' '+req.path;
 res.on('finish',()=>{if(res.statusCode>=200&&res.statusCode<300)staffLog(id,action);});
 }next();
});

// ======================================================
// STAFF SESSION
// ======================================================

app.get(
    "/api/staff/session",
    (req, res) => {

        res.json({

            loggedIn:
                Boolean(
                    req.session &&
                    req.session
                        .staffLoggedIn
                ),

            username:
                req.session
                    ?.staffUsername ||
                null,
            staffId: req.session?.staffId || null,
            accountId: req.session?.staffId || null,
            role: req.session?.staffRole || null

        });

    }
);


// ======================================================
// STAFF LOGOUT
// ======================================================

app.post(
    "/api/staff/logout",
    (req, res) => {

        if (!req.session) {

            return res.json({
                success: true
            });
        }


        if(req.session.staffId){staffLog(req.session.staffId,"logout");closeShift(req.session.staffId);}
        req.session.destroy(
            error => {

                if (error) {

                    return res
                        .status(500)
                        .json({
                            error:
                                "Unable to logout."
                        });
                }


                res.clearCookie(
                    "connect.sid"
                );


                res.json({
                    success: true
                });

            }
        );

    }
);


// ======================================================
// FORCE LOGOUT
// ======================================================

app.get(
    "/force-logout",
    (req, res) => {

        if (!req.session) {

            return res.redirect(
                "/staff-login.html"
            );
        }


        req.session.destroy(
            () => {

                res.clearCookie(
                    "connect.sid"
                );


                res.redirect(
                    "/staff-login.html"
                );

            }
        );

    }
);


// ======================================================
// GET QUEUE + PATIENT PORTAL SETTINGS
// ======================================================

app.get(
    "/api/data",
    (req, res) => {

        res.json(
            readData()
        );

    }
);
// ======================================================
// PATIENT TAKES QUEUE NUMBER
// ======================================================

// Patient accounts: college prototype only. No real medical records.
const loginAttempts = new Map();
function requirePatient(req, res, next) {
    if (!req.session?.patientId) return res.status(401).json({error:"Please log in first."});
    next();
}
app.post("/api/patient/signup", async (req,res) => {
    const fullName = String(req.body?.fullName || "").trim();
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = req.body?.password;
    if (fullName.length < 2 || fullName.length > 100 || !/^[a-z0-9_.-]{3,32}$/.test(username) || typeof password !== "string" || password.length < 10 || password.length > 128)
        return res.status(400).json({error:"Enter a full name, a 3–32 character username, and a password of at least 10 characters."});
    if (patientDb.prepare("SELECT id FROM patients WHERE username = ?").get(username)) return res.status(409).json({error:"Username already taken."});
    try {
        const salt = crypto.randomBytes(16).toString("hex");
        const hash = (await scrypt(password, salt, 64)).toString("hex");
        const result = patientDb.prepare("INSERT INTO patients(full_name,username,password_hash) VALUES(?,?,?)").run(fullName,username,`${salt}:${hash}`);
        req.session.regenerate(error => {
            if(error) return res.status(500).json({error:"Unable to start session."});
            req.session.patientId = Number(result.lastInsertRowid);
            req.session.save(error => error ? res.status(500).json({error:"Unable to save session."}) : res.json({success:true,fullName}));
        });
    } catch(error) { res.status(500).json({error:"Unable to create account."}); }
});
app.post("/api/patient/login", async (req,res) => {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = req.body?.password;
    const key = String(req.ip || "unknown");
    const attempt = loginAttempts.get(key);
    if (attempt && attempt.count >= 8 && Date.now() - attempt.since < 15*60*1000) return res.status(429).json({error:"Too many attempts. Try again later."});
    const patient = patientDb.prepare("SELECT * FROM patients WHERE username = ?").get(username);
    let valid = false;
    if (typeof password === "string" && password.length <= 128) {
        const [salt, stored] = (patient?.password_hash || "0".repeat(32)+":"+"0".repeat(128)).split(":");
        const calculated = await scrypt(password,salt,64);
        valid = !!patient && crypto.timingSafeEqual(calculated,Buffer.from(stored,"hex"));
    }
    if(!valid) {
        const current = loginAttempts.get(key);
        loginAttempts.set(key,{count:current && Date.now()-current.since<15*60*1000 ? current.count+1 : 1,since:current && Date.now()-current.since<15*60*1000 ? current.since : Date.now()});
        return res.status(401).json({error:"Invalid username or password."});
    }
    loginAttempts.delete(key);
    req.session.regenerate(error => {
        if(error) return res.status(500).json({error:"Unable to start session."});
        req.session.patientId = patient.id;
        req.session.save(error => error ? res.status(500).json({error:"Unable to save session."}) : res.json({success:true,fullName:patient.full_name}));
    });
});
app.get("/api/patient/me",requirePatient,(req,res) => {
    const patient = patientDb.prepare("SELECT id,full_name,username FROM patients WHERE id=?").get(req.session.patientId);
    if(!patient) return res.status(401).json({error:"Session expired."});
    res.json(patient);
});
// V5 Phase 3: self-service patient profile. All queries are scoped to the session patient ID.
app.patch('/api/patient/profile',requirePatient,(req,res)=>{
 const fullName=typeof req.body?.fullName==='string'?req.body.fullName.trim():'';
 if(fullName.length<2||fullName.length>100||/[\x00-\x1f\x7f]/.test(fullName))return res.status(400).json({error:'Name must contain 2–100 valid characters.'});
 const result=patientDb.prepare('UPDATE patients SET full_name=? WHERE id=?').run(fullName,req.session.patientId);
 if(!result.changes)return res.status(401).json({error:'Account not found.'});
 res.set('Cache-Control','no-store').json({success:true,fullName});
});
app.post('/api/patient/change-password',requirePatient,async(req,res)=>{
 const current=req.body?.currentPassword,newPassword=req.body?.newPassword;
 if(typeof current!=='string'||typeof newPassword!=='string'||newPassword.length<10||newPassword.length>128||current.length>128)return res.status(400).json({error:'Provide your current password and a new password of 10–128 characters.'});
 if(current===newPassword)return res.status(400).json({error:'Choose a different new password.'});
 const account=patientDb.prepare('SELECT password_hash FROM patients WHERE id=?').get(req.session.patientId);
 if(!account)return res.status(401).json({error:'Account not found.'});
 const [salt,hex]=String(account.password_hash).split(':');
 if(!salt||!/^[a-f0-9]{128}$/i.test(hex))return res.status(500).json({error:'Password verification unavailable.'});
 const calculated=await scrypt(current,salt,64);
 if(!crypto.timingSafeEqual(calculated,Buffer.from(hex,'hex')))return res.status(403).json({error:'Current password is incorrect.'});
 const newSalt=crypto.randomBytes(16).toString('hex');
 const newHash=(await scrypt(newPassword,newSalt,64)).toString('hex');
 patientDb.prepare('UPDATE patients SET password_hash=? WHERE id=?').run(newSalt+':'+newHash,req.session.patientId);
 res.set('Cache-Control','no-store').json({success:true});
});
app.get("/api/patient/history",requirePatient,(req,res) => {
    res.json(patientDb.prepare("SELECT id,department_name,queue_number,room_number,queue_issued_at,called_at,completed_at,status FROM visits WHERE patient_id=? ORDER BY id DESC LIMIT 100").all(req.session.patientId));
});
app.post("/api/patient/logout",requirePatient,(req,res) => req.session.destroy(error => error ? res.status(500).json({error:"Unable to log out."}) : res.clearCookie("connect.sid").json({success:true})));

// V5 Phase 4: appointments. Appointment slots are administrative schedules, not queue tickets.
patientDb.exec(`CREATE TABLE IF NOT EXISTS appointment_slots (
 id INTEGER PRIMARY KEY AUTOINCREMENT, department_id INTEGER NOT NULL, appointment_date TEXT NOT NULL,
 appointment_time TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 100),
 created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(department_id,appointment_date,appointment_time));
CREATE TABLE IF NOT EXISTS appointments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, slot_id INTEGER NOT NULL REFERENCES appointment_slots(id),
 patient_id INTEGER NOT NULL REFERENCES patients(id), status TEXT NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','confirmed','cancelled')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS appointment_patient_idx ON appointments(patient_id,created_at);
CREATE INDEX IF NOT EXISTS appointment_slot_idx ON appointments(slot_id,status);`);
const appointmentDateValid = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const appointmentTimeValid = value => typeof value==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const appointmentToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:process.env.APPOINTMENT_TIMEZONE||'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const appointmentDepartments = () => readData().departments.map(d=>({id:d.id,name:d.name}));
const appointmentSelect = `SELECT a.id,a.status,a.created_at,a.updated_at,s.id AS slot_id,s.department_id,s.appointment_date,s.appointment_time,p.full_name AS patient_name,p.username AS patient_username
 FROM appointments a JOIN appointment_slots s ON s.id=a.slot_id JOIN patients p ON p.id=a.patient_id`;
app.get('/api/appointments/departments',requirePatient,(req,res)=>res.set('Cache-Control','no-store').json(appointmentDepartments()));
app.get('/api/appointments/slots',requirePatient,(req,res)=>{
 const date=req.query.date,departmentId=Number(req.query.departmentId);
 if(!appointmentDateValid(date)||date<appointmentToday()||!Number.isSafeInteger(departmentId)||!appointmentDepartments().some(d=>d.id===departmentId))return res.status(400).json({error:'Choose a valid department and a current or future date.'});
 const slots=patientDb.prepare(`SELECT s.id,s.department_id,s.appointment_date,s.appointment_time,s.capacity, s.capacity-(SELECT COUNT(*) FROM appointments a WHERE a.slot_id=s.id AND a.status IN ('pending','confirmed')) AS available FROM appointment_slots s WHERE s.department_id=? AND s.appointment_date=? ORDER BY s.appointment_time`).all(departmentId,date);
 res.set('Cache-Control','no-store').json(slots.filter(s=>date>appointmentToday()||s.appointment_time>new Intl.DateTimeFormat('en-GB',{timeZone:process.env.APPOINTMENT_TIMEZONE||'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())));
});
app.get('/api/appointments/mine',requirePatient,(req,res)=>res.set('Cache-Control','no-store').json(patientDb.prepare(appointmentSelect+' WHERE a.patient_id=? ORDER BY s.appointment_date DESC,s.appointment_time DESC LIMIT 100').all(req.session.patientId).map(a=>({...a,department_name:appointmentDepartments().find(d=>d.id===a.department_id)?.name||'Department unavailable'}))));
app.post('/api/appointments/book',requirePatient,(req,res)=>{
 const slotId=Number(req.body?.slotId);
 if(!Number.isSafeInteger(slotId)||slotId<1)return res.status(400).json({error:'Choose a valid slot.'});
 try{
 patientDb.exec('BEGIN IMMEDIATE');
 const slot=patientDb.prepare('SELECT * FROM appointment_slots WHERE id=?').get(slotId);
 const nowTime=new Intl.DateTimeFormat('en-GB',{timeZone:process.env.APPOINTMENT_TIMEZONE||'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
 if(!slot||!appointmentDepartments().some(d=>d.id===slot.department_id)||slot.appointment_date<appointmentToday()||(slot.appointment_date===appointmentToday()&&slot.appointment_time<=nowTime)){patientDb.exec('ROLLBACK');return res.status(400).json({error:'This slot is no longer available.'});}
 const existing=patientDb.prepare(`SELECT 1 FROM appointments a JOIN appointment_slots s ON s.id=a.slot_id WHERE a.patient_id=? AND s.appointment_date=? AND s.appointment_time=? AND a.status IN ('pending','confirmed')`).get(req.session.patientId,slot.appointment_date,slot.appointment_time);
 const used=patientDb.prepare("SELECT COUNT(*) AS n FROM appointments WHERE slot_id=? AND status IN ('pending','confirmed')").get(slotId).n;
 if(existing||used>=slot.capacity){patientDb.exec('ROLLBACK');return res.status(409).json({error:existing?'You already have an appointment at this time.':'This slot is fully booked.'});}
 const result=patientDb.prepare('INSERT INTO appointments(slot_id,patient_id) VALUES(?,?)').run(slotId,req.session.patientId);
 patientDb.exec('COMMIT');res.status(201).json({success:true,id:Number(result.lastInsertRowid),status:'pending'});
 }catch(error){try{patientDb.exec('ROLLBACK')}catch{}res.status(500).json({error:'Unable to complete booking.'});}
});
app.post('/api/appointments/mine/:id/cancel',requirePatient,(req,res)=>{
 const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid appointment.'});
 const result=patientDb.prepare("UPDATE appointments SET status='cancelled',updated_at=? WHERE id=? AND patient_id=? AND status IN ('pending','confirmed') AND slot_id IN (SELECT id FROM appointment_slots WHERE appointment_date>=?)").run(isoNow(),id,req.session.patientId,appointmentToday());
 if(!result.changes)return res.status(409).json({error:'Appointment cannot be cancelled.'});res.json({success:true});
});
app.get('/api/staff/appointments/slots',requireStaffLogin,(req,res)=>{
 const departmentId=Number(req.query.departmentId);if(!Number.isSafeInteger(departmentId)||!appointmentDepartments().some(d=>d.id===departmentId))return res.status(400).json({error:'Choose a department.'});
 if(req.session.staffRole!=='admin'&&!allowedDepartment(req.session.staffId,departmentId))return res.status(403).json({error:'Department not assigned.'});
 res.set('Cache-Control','no-store').json(patientDb.prepare(`SELECT s.*, (SELECT COUNT(*) FROM appointments a WHERE a.slot_id=s.id AND a.status IN ('pending','confirmed')) AS booked FROM appointment_slots s WHERE department_id=? AND appointment_date>=? ORDER BY appointment_date,appointment_time LIMIT 300`).all(departmentId,appointmentToday()));
});
app.post('/api/staff/appointments/slots',requireStaffLogin,(req,res)=>{
 const departmentId=Number(req.body?.departmentId),date=req.body?.date,time=req.body?.time,capacity=Number(req.body?.capacity);
 if(!Number.isSafeInteger(departmentId)||!appointmentDepartments().some(d=>d.id===departmentId)||!appointmentDateValid(date)||date<appointmentToday()||!appointmentTimeValid(time)||!Number.isSafeInteger(capacity)||capacity<1||capacity>100)return res.status(400).json({error:'Enter a valid department, future date, time and capacity (1–100).'});
 if(req.session.staffRole!=='admin'&&!allowedDepartment(req.session.staffId,departmentId))return res.status(403).json({error:'Department not assigned.'});
 try{const result=patientDb.prepare('INSERT INTO appointment_slots(department_id,appointment_date,appointment_time,capacity,created_by) VALUES(?,?,?,?,?)').run(departmentId,date,time,capacity,req.session.staffId);staffLog(req.session.staffId,'create_appointment_slot',String(result.lastInsertRowid));res.status(201).json({success:true,id:Number(result.lastInsertRowid)});}catch(error){res.status(409).json({error:'A slot already exists at that date and time for this department.'});}
});
app.get('/api/staff/appointments',requireStaffLogin,(req,res)=>{
 const departmentId=Number(req.query.departmentId);if(!Number.isSafeInteger(departmentId)||!appointmentDepartments().some(d=>d.id===departmentId))return res.status(400).json({error:'Choose a department.'});
 if(req.session.staffRole!=='admin'&&!allowedDepartment(req.session.staffId,departmentId))return res.status(403).json({error:'Department not assigned.'});
 res.set('Cache-Control','no-store').json(patientDb.prepare(appointmentSelect+' WHERE s.department_id=? AND s.appointment_date>=? ORDER BY s.appointment_date,s.appointment_time,a.id LIMIT 300').all(departmentId,appointmentToday()));
});
app.patch('/api/staff/appointments/:id',requireStaffLogin,(req,res)=>{
 const id=Number(req.params.id),status=req.body?.status;
 if(!Number.isSafeInteger(id)||id<1||!['confirmed','cancelled'].includes(status))return res.status(400).json({error:'Invalid appointment or status.'});
 const appointment=patientDb.prepare('SELECT a.status,s.department_id,s.appointment_date FROM appointments a JOIN appointment_slots s ON s.id=a.slot_id WHERE a.id=?').get(id);
 if(!appointment)return res.status(404).json({error:'Appointment not found.'});
 if(req.session.staffRole!=='admin'&&!allowedDepartment(req.session.staffId,appointment.department_id))return res.status(403).json({error:'Department not assigned.'});
 if(appointment.status==='cancelled'||appointment.appointment_date<appointmentToday())return res.status(409).json({error:'This appointment cannot be changed.'});
 patientDb.prepare('UPDATE appointments SET status=?,updated_at=? WHERE id=?').run(status,isoNow(),id);staffLog(req.session.staffId,'appointment_'+status,String(id));res.json({success:true,status});
});

app.post(
    "/api/queue/take",
    requirePatient,
    (req, res) => {

        const {
            departmentId
        } = req.body;


        const data =
            readData();


        const department =
            data.departments.find(
                dept =>
                    dept.id ===
                    Number(
                        departmentId
                    )
            );


        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        if (!department.open) {

            return res
                .status(400)
                .json({
                    error:
                        "Department is currently closed."
                });
        }


        const queueNumber =

            department.prefix +

            String(
                department.nextNumber
            ).padStart(
                3,
                "0"
            );


        department.waiting.push(
            queueNumber
        );


        department.nextNumber++;


        saveData(data);
        patientDb.prepare("INSERT INTO visits(patient_id,department_id,department_name,queue_number,queue_issued_at,status) VALUES(?,?,?,?,?,?)").run(req.session.patientId,department.id,department.name,queueNumber,isoNow(),"waiting");

        broadcastData();


        res.json({

            success: true,

            queueNumber,

            department:
                department.name,

            estimatedMinutes:
                department
                    .estimatedMinutes

        });

    }
);


// ======================================================
// CALL NEXT PATIENT
// ======================================================

app.post(
    "/api/queue/call-next",
    requireStaffLogin,
    (req, res) => {

        const {
            departmentId,
            roomNumber
        } = req.body;


        const data =
            readData();


        const department =
            data.departments.find(
                dept =>
                    dept.id ===
                    Number(
                        departmentId
                    )
            );


        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        const room =
            department.rooms.find(
                room =>
                    room.number ===
                    roomNumber
            );


        if (!room) {

            return res
                .status(404)
                .json({
                    error:
                        "Room not found."
                });
        }


        if (room.currentQueue) {

            return res
                .status(400)
                .json({
                    error:
                        "Complete the current patient first."
                });
        }


        if (
            department.waiting
                .length === 0
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "No patients are waiting."
                });
        }


        const queueNumber =
            department.waiting.shift();


        room.currentQueue =
            queueNumber;

        room.status =
            "busy";


        updateVisit(department.id,queueNumber,{room_number:room.number,called_at:isoNow(),status:"called"});
        saveData(data);


        io.emit(
            "patient:called",
            {

                queueNumber,

                departmentId:
                    department.id,

                department:
                    department.name,

                room:
                    room.number,

                type:
                    "call"

            }
        );


        broadcastData();


        res.json({

            success: true,

            queueNumber,

            department:
                department.name,

            room:
                room.number

        });

    }
);


// ======================================================
// MANUAL QUEUE ASSIGNMENT
// ======================================================

app.post(
    "/api/queue/assign",
    requireStaffLogin,
    (req, res) => {

        const {
            departmentId,
            queueNumber,
            roomNumber
        } = req.body;


        const data =
            readData();


        const department =
            data.departments.find(
                dept =>
                    dept.id ===
                    Number(
                        departmentId
                    )
            );


        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        const room =
            department.rooms.find(
                room =>
                    room.number ===
                    roomNumber
            );


        if (!room) {

            return res
                .status(404)
                .json({
                    error:
                        "Room not found."
                });
        }


        if (room.currentQueue) {

            return res
                .status(400)
                .json({
                    error:
                        "Room is currently busy."
                });
        }


        const queueIndex =
            department.waiting
                .indexOf(
                    queueNumber
                );


        if (queueIndex === -1) {

            return res
                .status(404)
                .json({
                    error:
                        "Queue number is not waiting."
                });
        }


        department.waiting.splice(
            queueIndex,
            1
        );


        room.currentQueue =
            queueNumber;

        room.status =
            "busy";


        updateVisit(department.id,queueNumber,{room_number:room.number,called_at:isoNow(),status:"called"});
        saveData(data);


        io.emit(
            "patient:called",
            {

                queueNumber,

                departmentId:
                    department.id,

                department:
                    department.name,

                room:
                    room.number,

                type:
                    "call"

            }
        );


        broadcastData();


        res.json({

            success: true,

            queueNumber,

            department:
                department.name,

            room:
                room.number

        });

    }
);


// ======================================================
// RECALL PATIENT
// ======================================================

app.post(
    "/api/queue/recall",
    requireStaffLogin,
    (req, res) => {

        const {
            departmentId,
            roomNumber
        } = req.body;


        const data =
            readData();


        const department =
            data.departments.find(
                dept =>
                    dept.id ===
                    Number(
                        departmentId
                    )
            );


        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        const room =
            department.rooms.find(
                room =>
                    room.number ===
                    roomNumber
            );


        if (
            !room ||
            !room.currentQueue
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "There is no patient to recall."
                });
        }


        io.emit(
            "patient:called",
            {

                queueNumber:
                    room.currentQueue,

                departmentId:
                    department.id,

                department:
                    department.name,

                room:
                    room.number,

                type:
                    "recall"

            }
        );


        res.json({

            success: true,

            queueNumber:
                room.currentQueue,

            room:
                room.number

        });

    }
);


// ======================================================
// COMPLETE PATIENT
// ======================================================

app.post(
    "/api/queue/complete",
    requireStaffLogin,
    (req, res) => {

        const {
            departmentId,
            roomNumber
        } = req.body;


        const data =
            readData();


        const department =
            data.departments.find(
                dept =>
                    dept.id ===
                    Number(
                        departmentId
                    )
            );


        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        const room =
            department.rooms.find(
                room =>
                    room.number ===
                    roomNumber
            );


        if (
            !room ||
            !room.currentQueue
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "No patient is assigned to this room."
                });
        }


        const completedQueue =
            room.currentQueue;


        department.completed.push(
            completedQueue
        );


        room.currentQueue =
            null;

        room.status =
            "available";


        updateVisit(department.id,completedQueue,{completed_at:isoNow(),status:"completed"});
        saveData(data);

        broadcastData();


        res.json({

            success: true,

            completedQueue,

            room:
                room.number

        });

    }
);


// ======================================================
// RESET DEPARTMENT QUEUE
// ======================================================

app.post(
    "/api/queue/reset",
    requireStaffLogin,
    (req, res) => {

        const {
            departmentId,
            confirmReset
        } = req.body;


        if (
            confirmReset !== true
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Reset confirmation required."
                });
        }


        const data =
            readData();


        const department =
            data.departments.find(
                dept =>
                    dept.id ===
                    Number(
                        departmentId
                    )
            );


        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        department.waiting = [];

        department.completed = [];

        department.nextNumber = 1;


        department.rooms.forEach(
            room => {

                room.currentQueue =
                    null;

                room.status =
                    "available";

            }
        );


        patientDb.prepare("UPDATE visits SET status = ? WHERE department_id = ? AND status IN ('waiting','called')").run("cancelled",department.id);
        saveData(data);

        broadcastData();


        res.json({

            success: true,

            message:
                `${department.name} queue reset to ${department.prefix}001.`

        });

    }
);


// ======================================================
// ADD DEPARTMENT
// ======================================================

app.post(
    "/api/staff/departments",
    requireStaffLogin,
    (req, res) => {

        const {
            name,
            prefix,
            estimatedMinutes
        } = req.body;


        if (
            !name ||
            !prefix
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Department name and prefix are required."
                });
        }


        let minutes =
            Number(
                estimatedMinutes
            );


        if (
            !Number.isFinite(minutes) ||
            minutes < 1
        ) {

            minutes = 5;
        }


        if (minutes > 240) {

            return res
                .status(400)
                .json({
                    error:
                        "Estimated time cannot be more than 240 minutes."
                });
        }


        const data =
            readData();


        let newId = 1;


        if (
            data.departments.length >
            0
        ) {

            newId =
                Math.max(
                    ...data.departments
                        .map(
                            department =>
                                department.id
                        )
                ) + 1;
        }


        const cleanPrefix =
            String(prefix)
                .trim()
                .toUpperCase();


        if (
            !cleanPrefix ||
            cleanPrefix.length > 4
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Queue prefix must contain 1 to 4 characters."
                });
        }


        const newDepartment = {

    id:
        newId,

    name:
        String(name)
            .trim(),

    prefix:
        cleanPrefix,

    // Custom patient portal department logo.
    // Empty = use automatic medical icon.
    logoDataUrl:
        "",


            estimatedMinutes:
                Math.round(minutes),

            rooms:
                [],

            open:
                true,

            nextNumber:
                1,

            waiting:
                [],

            completed:
                []

        };


        data.departments.push(
            newDepartment
        );


        saveData(data);

        broadcastData();


        res.json({

            success: true,

            department:
                newDepartment

        });

    }
);


// ======================================================
// EDIT DEPARTMENT
// ======================================================

app.put(
    "/api/staff/departments/:id",
    requireStaffLogin,
    (req, res) => {

        const {
            name,
            prefix,
            open,
            estimatedMinutes
        } = req.body;


        const data =
            readData();


        const department =
            data.departments.find(
                dept =>
                    dept.id ===
                    Number(
                        req.params.id
                    )
            );


        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        // NAME

        if (
            name !== undefined
        ) {

            const cleanName =
                String(name)
                    .trim();


            if (!cleanName) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Department name cannot be empty."
                    });
            }


            department.name =
                cleanName;
        }


        // PREFIX

        if (
            prefix !== undefined
        ) {

            const cleanPrefix =
                String(prefix)
                    .trim()
                    .toUpperCase();


            if (
                !cleanPrefix ||
                cleanPrefix.length > 4
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Queue prefix must contain 1 to 4 characters."
                    });
            }


            department.prefix =
                cleanPrefix;
        }


        // OPEN / CLOSED

        if (
            open !== undefined
        ) {

            department.open =
                Boolean(open);
        }


        // ESTIMATED TIME

        if (
            estimatedMinutes !==
            undefined
        ) {

            const minutes =
                Number(
                    estimatedMinutes
                );


            if (
                !Number.isFinite(
                    minutes
                ) ||
                minutes < 1 ||
                minutes > 240
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Estimated time must be between 1 and 240 minutes."
                    });
            }


            department
                .estimatedMinutes =
                Math.round(
                    minutes
                );
        }


        saveData(data);

        broadcastData();


        res.json({

            success: true,

            department

        });

    }
);
// ======================================================
// ADVANCED PATIENT PORTAL CUSTOMIZATION
// ======================================================

app.put(
    "/api/staff/portal-settings",
    requireStaffLogin,
    (req, res) => {

        const data =
            readData();

        const current =
            normalizePortalSettings(
                data.portalSettings
            );


        // ==================================================
        // SYSTEM NAME
        // ==================================================

        if (
            req.body.systemName !==
            undefined
        ) {

            const systemName =
                cleanString(
                    req.body.systemName,
                    80
                );


            if (!systemName) {

                return res
                    .status(400)
                    .json({
                        error:
                            "System name cannot be empty."
                    });
            }


            current.systemName =
                systemName;
        }


        // ==================================================
        // WELCOME TEXT
        // ==================================================

        if (
            req.body.welcomeText !==
            undefined
        ) {

            current.welcomeText =
                cleanString(
                    req.body.welcomeText,
                    250
                );
        }


        // ==================================================
        // ANNOUNCEMENT
        // ==================================================

        if (
            req.body.announcement !==
            undefined
        ) {

            current.announcement =
                cleanString(
                    req.body.announcement,
                    500
                );
        }


        // ==================================================
        // COLORS
        // ==================================================

        const colorFields = [
            "primaryColor",
            "secondaryColor",
            "backgroundColor",
            "cardColor",
            "textColor",
            "buttonTextColor"
        ];


        for (
            const field of colorFields
        ) {

            if (
                req.body[field] ===
                undefined
            ) {

                continue;
            }


            const color =
                String(
                    req.body[field]
                ).trim();


            if (
                !isHexColor(color)
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            `Invalid color for ${field}.`
                    });
            }


            current[field] =
                color;
        }


        // ==================================================
// LOGO
// ==================================================

if (
    req.body.logoDataUrl !==
    undefined
) {

    const logo =
        String(
            req.body.logoDataUrl ||
            ""
        );


    if (logo === "") {

        current.logoDataUrl =
            "";

    } else {

        if (
            !logo.startsWith(
                "data:image/"
            )
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Invalid logo image format."
                });
        }


        if (
            logo.length >
            4500000
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Website logo is too large. Please use an image smaller than 3 MB."
                });
        }


        current.logoDataUrl =
            logo;
    }
}

// ==================================================
// BROWSER ICON / FAVICON
// ==================================================

if (req.body.faviconDataUrl !== undefined) {

    const favicon = req.body.faviconDataUrl;

    if (typeof favicon !== "string") {
        return res.status(400).json({
            error: "Invalid browser icon."
        });
    }

    if (favicon === "") {

        // Reset to the default browser icon.
        current.faviconDataUrl = "";

    } else {

        // Accept only PNG, JPG and WebP images.
        const validFormat =
            /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
                favicon
            );

        if (!validFormat) {
            return res.status(400).json({
                error: "Choose a valid PNG, JPG or WebP browser icon."
            });
        }

        const base64 = favicon.split(",")[1];

        const imageBytes =
            Buffer.from(base64, "base64").length;

        if (imageBytes > 1024 * 1024) {
            return res.status(400).json({
                error: "Browser icon must be 1 MB or smaller."
            });
        }

        current.faviconDataUrl = favicon;
    }
}

        // ==================================================
        // BANNER IMAGE
        // ==================================================

        if (
            req.body.bannerDataUrl !==
            undefined
        ) {

            const banner =
                String(
                    req.body.bannerDataUrl ||
                    ""
                );


            if (banner === "") {

                current.bannerDataUrl =
                    "";

            } else {

                if (
                    !banner.startsWith(
                        "data:image/"
                    )
                ) {

                    return res
                        .status(400)
                        .json({
                            error:
                                "Invalid banner image format."
                        });
                }


                if (
                    banner.length >
                    2500000
                ) {

                    return res
                        .status(400)
                        .json({
                            error:
                                "Banner image is too large. Please use a smaller image."
                        });
                }


                current.bannerDataUrl =
                    banner;
            }
        }


        // ==================================================
        // THEME
        // ==================================================

        if (
            req.body.theme !==
            undefined
        ) {

            if (
                !PORTAL_OPTIONS
                    .theme
                    .includes(
                        req.body.theme
                    )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid patient portal theme."
                    });
            }


            current.theme =
                req.body.theme;
        }


        // ==================================================
        // BACKGROUND STYLE
        // ==================================================

        if (
            req.body.backgroundStyle !==
            undefined
        ) {

            if (
                !PORTAL_OPTIONS
                    .backgroundStyle
                    .includes(
                        req.body
                            .backgroundStyle
                    )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid background style."
                    });
            }


            current.backgroundStyle =
                req.body
                    .backgroundStyle;
        }


        // ==================================================
        // CARD STYLE
        // ==================================================

        if (
            req.body.cardStyle !==
            undefined
        ) {

            if (
                !PORTAL_OPTIONS
                    .cardStyle
                    .includes(
                        req.body.cardStyle
                    )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid card style."
                    });
            }


            current.cardStyle =
                req.body.cardStyle;
        }


        // ==================================================
        // BUTTON STYLE
        // ==================================================

        if (
            req.body.buttonStyle !==
            undefined
        ) {

            if (
                !PORTAL_OPTIONS
                    .buttonStyle
                    .includes(
                        req.body.buttonStyle
                    )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid button style."
                    });
            }


            current.buttonStyle =
                req.body.buttonStyle;
        }


        // ==================================================
        // PORTAL WIDTH
        // ==================================================

        if (
            req.body.portalWidth !==
            undefined
        ) {

            if (
                !PORTAL_OPTIONS
                    .portalWidth
                    .includes(
                        req.body.portalWidth
                    )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid portal width."
                    });
            }


            current.portalWidth =
                req.body.portalWidth;
        }


        // ==================================================
        // DEPARTMENT LAYOUT
        // ==================================================

        if (
            req.body.departmentLayout !==
            undefined
        ) {

            if (
                !PORTAL_OPTIONS
                    .departmentLayout
                    .includes(
                        req.body
                            .departmentLayout
                    )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid department layout."
                    });
            }


            current.departmentLayout =
                req.body
                    .departmentLayout;
        }


        // ==================================================
        // QUEUE BUTTON POSITION
        // ==================================================

        if (
            req.body
                .queueButtonPosition !==
            undefined
        ) {

            if (
                !PORTAL_OPTIONS
                    .queueButtonPosition
                    .includes(
                        req.body
                            .queueButtonPosition
                    )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid queue button position."
                    });
            }


            current.queueButtonPosition =
                req.body
                    .queueButtonPosition;
        }


        // ==================================================
        // TEXT ALIGNMENT
        // ==================================================

        if (
            req.body.textAlignment !==
            undefined
        ) {

            if (
                !PORTAL_OPTIONS
                    .textAlignment
                    .includes(
                        req.body
                            .textAlignment
                    )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid text alignment."
                    });
            }


            current.textAlignment =
                req.body.textAlignment;
        }


        // ==================================================
        // NOTIFICATION SOUND
        // ==================================================

        if (
            req.body
                .notificationSoundStyle !==
            undefined
        ) {

            if (
                !PORTAL_OPTIONS
                    .notificationSoundStyle
                    .includes(
                        req.body
                            .notificationSoundStyle
                    )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid notification sound style."
                    });
            }


            current
                .notificationSoundStyle =
                req.body
                    .notificationSoundStyle;
        }


        // ==================================================
        // SECTION ORDER
        // ==================================================

        if (
            req.body.sectionOrder !==
            undefined
        ) {

            if (
                !Array.isArray(
                    req.body.sectionOrder
                )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Section order must be an array."
                    });
            }


            const requestedOrder =
                req.body.sectionOrder;


            const invalidSection =
                requestedOrder.some(
                    section =>
                        !VALID_PORTAL_SECTIONS
                            .includes(
                                section
                            )
                );


            if (invalidSection) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid patient portal section."
                    });
            }


            current.sectionOrder =
                normalizeSectionOrder(
                    requestedOrder
                );
        }


        // ==================================================
        // BOOLEAN SETTINGS
        // ==================================================

        const booleanFields = [

            "autoThemeFromLogo",

            "showWelcome",

            "showAnnouncement",

            "showConnectionStatus",

            "showWaitingCount",

            "showEstimatedTime",

            "showFooter",

            "buttonAnimation",

            "cardAnimation",

            "calledAnimation",

            "patientCallSound",

            "recallSound"

        ];


        for (
            const field of booleanFields
        ) {

            if (
                req.body[field] ===
                undefined
            ) {

                continue;
            }


            if (
                typeof req.body[field] !==
                "boolean"
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            `${field} must be true or false.`
                    });
            }


            current[field] =
                req.body[field];
        }


        // ==================================================
// SAVE
// ==================================================

data.portalSettings =
    normalizePortalSettings(
        current
    );


saveData(data);

broadcastData();

res.json({

    success: true,

    message:
        "Patient portal design saved successfully.",

    portalSettings:
        data.portalSettings

});

}
);


// ======================================================
// RESET PATIENT PORTAL DESIGN
// ======================================================

app.post(
    "/api/staff/portal-settings/reset",
    requireStaffLogin,
    (req, res) => {

        const data =
            readData();


        data.portalSettings = {

            ...DEFAULT_PORTAL_SETTINGS,

            sectionOrder: [
                ...DEFAULT_PORTAL_SETTINGS
                    .sectionOrder
            ]

        };


        saveData(data);

        broadcastData();


        res.json({

            success: true,

            message:
                "Patient portal design restored to default.",

            portalSettings:
                data.portalSettings

        });

    }
);


// ======================================================
// GET PORTAL DESIGN SETTINGS
// ======================================================
// This makes it easier for the designer/live preview
// to request only the patient portal settings.

app.get(
    "/api/portal-settings",
    (req, res) => {

        const data =
            readData();


        res.json({

            success: true,

            portalSettings:
                data.portalSettings

        });

    }
);


// ======================================================
// DELETE DEPARTMENT
// ======================================================

app.delete(
    "/api/staff/departments/:id",
    requireStaffLogin,
    (req, res) => {

        const data =
            readData();


        const index =
            data.departments
                .findIndex(
                    dept =>
                        dept.id ===
                        Number(
                            req.params.id
                        )
                );


        if (index === -1) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        const department =
            data.departments[index];


        if (
            department.waiting
                .length > 0
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Reset or complete waiting patients first."
                });
        }


        const hasActivePatient =
            department.rooms.some(
                room =>
                    room.currentQueue
            );


        if (hasActivePatient) {

            return res
                .status(400)
                .json({
                    error:
                        "Complete active patients before deleting this department."
                });
        }


        data.departments.splice(
            index,
            1
        );


        saveData(data);

        broadcastData();


        res.json({
            success: true
        });

    }
);


// ======================================================
// ADD ROOM
// ======================================================

app.post(
    "/api/staff/departments/:id/rooms",
    requireStaffLogin,
    (req, res) => {

        const {
            roomNumber
        } = req.body;


        if (!roomNumber) {

            return res
                .status(400)
                .json({
                    error:
                        "Room name is required."
                });
        }


        const data =
            readData();


        const department =
            data.departments.find(
                dept =>
                    dept.id ===
                    Number(
                        req.params.id
                    )
            );


        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        const cleanRoom =
            String(
                roomNumber
            ).trim();


        if (!cleanRoom) {

            return res
                .status(400)
                .json({
                    error:
                        "Room name cannot be empty."
                });
        }


        if (
            cleanRoom.length >
            50
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Room name is too long."
                });
        }


        const exists =
            department.rooms.some(
                room =>
                    room.number
                        .toLowerCase() ===
                    cleanRoom
                        .toLowerCase()
            );


        if (exists) {

            return res
                .status(400)
                .json({
                    error:
                        "Room already exists."
                });
        }


        department.rooms.push({

            number:
                cleanRoom,

            status:
                "available",

            currentQueue:
                null

        });


        saveData(data);

        broadcastData();


        res.json({

            success: true,

            room: {
                number:
                    cleanRoom,
                status:
                    "available",
                currentQueue:
                    null
            }

        });

    }
);


// ======================================================
// RENAME ROOM
// ======================================================

app.put(
    "/api/staff/departments/:id/rooms/:roomNumber",
    requireStaffLogin,
    (req, res) => {

        const {
            newRoomNumber
        } = req.body;


        const data =
            readData();


        const department =
            data.departments.find(
                dept =>
                    dept.id ===
                    Number(
                        req.params.id
                    )
            );


        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        const oldRoomName =
            decodeURIComponent(
                req.params.roomNumber
            );


        const room =
            department.rooms.find(
                room =>
                    room.number ===
                    oldRoomName
            );


        if (!room) {

            return res
                .status(404)
                .json({
                    error:
                        "Room not found."
                });
        }


        const cleanName =
            String(
                newRoomNumber ||
                ""
            ).trim();


        if (!cleanName) {

            return res
                .status(400)
                .json({
                    error:
                        "New room name is required."
                });
        }


        if (
            cleanName.length >
            50
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Room name is too long."
                });
        }


        const duplicate =
            department.rooms.some(
                otherRoom =>

                    otherRoom !== room &&

                    otherRoom.number
                        .toLowerCase() ===

                    cleanName
                        .toLowerCase()
            );


        if (duplicate) {

            return res
                .status(400)
                .json({
                    error:
                        "Another room already uses this name."
                });
        }


        room.number =
            cleanName;


        saveData(data);

        broadcastData();


        res.json({

            success: true,

            room

        });

    }
);


// ======================================================
// DELETE ROOM
// ======================================================

app.delete(
    "/api/staff/departments/:id/rooms/:roomNumber",
    requireStaffLogin,
    (req, res) => {

        const data =
            readData();


        const department =
            data.departments.find(
                dept =>
                    dept.id ===
                    Number(
                        req.params.id
                    )
            );


        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        const roomName =
            decodeURIComponent(
                req.params.roomNumber
            );


        const index =
            department.rooms
                .findIndex(
                    room =>
                        room.number ===
                        roomName
                );


        if (index === -1) {

            return res
                .status(404)
                .json({
                    error:
                        "Room not found."
                });
        }


        if (
            department.rooms[index]
                .currentQueue
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Complete the current patient first."
                });
        }


        department.rooms.splice(
            index,
            1
        );


        saveData(data);

        broadcastData();


        res.json({
            success: true
        });

    }
);
// ======================================================
// MEDIQUEUE SERVER STARTUP
// ======================================================

// ======================================================
// DEPARTMENT LOGO CUSTOMIZATION
// ======================================================

app.put(
    "/api/staff/departments/:id/logo",
    requireStaffLogin,
    (req, res) => {

        const departmentId =
            Number(req.params.id);

        const data =
            readData();

        const department =
            data.departments.find(
                dept =>
                    Number(dept.id) ===
                    departmentId
            );


        // ------------------------------------------
        // DEPARTMENT CHECK
        // ------------------------------------------

        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        // ------------------------------------------
        // GET LOGO
        // ------------------------------------------

        const logoDataUrl =
            typeof req.body.logoDataUrl ===
            "string"

                ? req.body.logoDataUrl

                : "";


        // ------------------------------------------
        // REMOVE CUSTOM LOGO
        // ------------------------------------------

        if (!logoDataUrl) {

            department.logoDataUrl =
                "";

            saveData(data);

            broadcastData();

            return res.json({

                success:
                    true,

                message:
                    "Custom department logo removed. Automatic medical icon will be used.",

                departmentId:
                    department.id,

                logoDataUrl:
                    ""

            });
        }


        // ------------------------------------------
        // IMAGE FORMAT VALIDATION
        // ------------------------------------------

        if (
            !logoDataUrl.startsWith(
                "data:image/"
            )
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Invalid image format."
                });
        }


        // ------------------------------------------
        // IMAGE SIZE LIMIT
        // ------------------------------------------
        // Approximately 1.5 MB encoded image limit.

        if (logoDataUrl.length > 4500000) {

            return res
                .status(400)
                .json({
                    error:
    "Department logo is too large. Please use an image smaller than 3 MB."
                });
        }


        // ------------------------------------------
        // SAVE CUSTOM LOGO
        // ------------------------------------------

        department.logoDataUrl =
            logoDataUrl;


        saveData(data);

        broadcastData();


        return res.json({

            success:
                true,

            message:
                `${department.name} logo updated successfully.`,

            departmentId:
                department.id,

            logoDataUrl:
                department.logoDataUrl

        });

    }
);
server.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "=============================================="
        );

        console.log(
            "               MediQueue V4"
        );

        console.log(
            "     Real-Time Hospital Queue System"
        );

        console.log(
            "     Advanced Patient Portal Designer"
        );

        console.log(
            "=============================================="
        );

        console.log(
            `Patient: http://localhost:${PORT}/patient.html`
        );

        console.log(
            `Staff:   http://localhost:${PORT}/staff.html`
        );

        console.log(
            `Login:   http://localhost:${PORT}/staff-login.html`
        );

        console.log(
            "=============================================="
        );

        console.log(
            "Server status: ONLINE"
        );

        console.log(
            "Socket.IO:     ENABLED"
        );

        console.log(
            "Portal design: ENABLED"
        );

        console.log(
            "=============================================="
        );

        console.log("");

    }
);