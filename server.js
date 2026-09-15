const express = require("express");
const path = require("path");
const fs = require("fs");
const http = require("http");
const session = require("express-session");
const { Server } = require("socket.io");

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

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    session({
        secret: "mediqueue-secret-key-2026",
        resave: false,
        saveUninitialized: false,

        cookie: {
            maxAge: 1000 * 60 * 60 * 8,
            httpOnly: true,
            sameSite: "lax"
        }
    })
);


// ======================================================
// STAFF ACCOUNT
// ======================================================

const STAFF_USERNAME = "admin";
const STAFF_PASSWORD = "hospital123";


// ======================================================
// NORMALIZE DATA
// ======================================================

function normalizeData(data) {

    if (!data || !Array.isArray(data.departments)) {
        data = {
            departments: []
        };
    }

    data.departments.forEach(department => {

        if (!Array.isArray(department.rooms)) {
            department.rooms = [];
        }

        if (!Array.isArray(department.waiting)) {
            department.waiting = [];
        }

        if (!Array.isArray(department.completed)) {
            department.completed = [];
        }

        if (typeof department.nextNumber !== "number") {
            department.nextNumber = 1;
        }

        if (typeof department.open !== "boolean") {
            department.open = true;
        }

        department.rooms.forEach(room => {

            if (!room.status) {
                room.status =
                    room.currentQueue
                        ? "busy"
                        : "available";
            }

            if (room.currentQueue === undefined) {
                room.currentQueue = null;
            }

        });

    });

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

        return {
            departments: []
        };
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

    const data =
        readData();

    io.emit(
        "queue:update",
        data
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
// STAFF LOGIN CHECK
// ======================================================

function requireStaffLogin(
    req,
    res,
    next
) {

    if (
        req.session &&
        req.session.staffLoggedIn === true
    ) {

        return next();
    }

    return res
        .status(401)
        .json({
            error:
                "Staff login required."
        });
}


// ======================================================
// HOME
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

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// ======================================================
// STAFF LOGIN
// ======================================================

app.post(
    "/api/staff/login",
    (req, res) => {

        const {
            username,
            password
        } = req.body;


        if (
            username === STAFF_USERNAME &&
            password === STAFF_PASSWORD
        ) {

            req.session.staffLoggedIn =
                true;

            req.session.staffUsername =
                username;


            req.session.save(
                error => {

                    if (error) {

                        return res
                            .status(500)
                            .json({
                                error:
                                    "Unable to create login session."
                            });
                    }

                    return res.json({
                        success: true
                    });

                }
            );

            return;
        }


        res
            .status(401)
            .json({
                error:
                    "Invalid username or password."
            });
    }
);


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
                    req.session.staffLoggedIn
                ),

            username:
                req.session?.staffUsername || null

        });
    }
);


// ======================================================
// LOGOUT
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
            error => {

                if (error) {

                    return res
                        .status(500)
                        .send(
                            "Unable to logout."
                        );
                }


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
// GET DATA
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
// PATIENT TAKE NUMBER
// ======================================================

app.post(
    "/api/queue/take",
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
                    Number(departmentId)
            );


        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department."
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

        broadcastData();


        res.json({

            success: true,

            queueNumber,

            department:
                department.name

        });
    }
);


// ======================================================
// CALL NEXT
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
                    Number(departmentId)
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
            department.waiting.length === 0
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
// MANUAL ASSIGNMENT
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
                    Number(departmentId)
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
            department.waiting.indexOf(
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

            room:
                room.number,

            department:
                department.name

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
                    Number(departmentId)
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
                    Number(departmentId)
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
// RESET QUEUE
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
                    Number(departmentId)
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

                room.currentQueue = null;
                room.status = "available";

            }
        );


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
            prefix
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


        const data =
            readData();


        let newId = 1;


        if (
            data.departments.length > 0
        ) {

            newId =
                Math.max(
                    ...data.departments.map(
                        dept =>
                            dept.id
                    )
                ) + 1;
        }


        const newDepartment = {

            id:
                newId,

            name:
                name.trim(),

            prefix:
                prefix
                    .trim()
                    .toUpperCase(),

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
            open
        } = req.body;


        const data =
            readData();


        const department =
            data.departments.find(
                dept =>
                    dept.id ===
                    Number(req.params.id)
            );


        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        if (
            name !== undefined
        ) {

            const cleanName =
                String(name).trim();

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


        if (
            prefix !== undefined
        ) {

            const cleanPrefix =
                String(prefix)
                    .trim()
                    .toUpperCase();

            if (!cleanPrefix) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Queue prefix cannot be empty."
                    });
            }

            department.prefix =
                cleanPrefix;
        }


        if (
            open !== undefined
        ) {

            department.open =
                Boolean(open);
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
// DELETE DEPARTMENT
// ======================================================

app.delete(
    "/api/staff/departments/:id",
    requireStaffLogin,
    (req, res) => {

        const data =
            readData();


        const index =
            data.departments.findIndex(
                dept =>
                    dept.id ===
                    Number(req.params.id)
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
            department.waiting.length > 0
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Reset or complete waiting patients first."
                });
        }


        if (
            department.rooms.some(
                room =>
                    room.currentQueue
            )
        ) {

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
                    Number(req.params.id)
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
            roomNumber.trim();


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
            success: true
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
                    Number(req.params.id)
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
                    req.params.roomNumber
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
                newRoomNumber || ""
            ).trim();


        if (!cleanName) {

            return res
                .status(400)
                .json({
                    error:
                        "New room name is required."
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
            success: true
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
                    Number(req.params.id)
            );


        if (!department) {

            return res
                .status(404)
                .json({
                    error:
                        "Department not found."
                });
        }


        const index =
            department.rooms.findIndex(
                room =>
                    room.number ===
                    req.params.roomNumber
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
// START SERVER
// ======================================================

server.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "=============================================="
        );
        console.log(
            "               MediQueue"
        );
        console.log(
            "     Real-Time Hospital Queue System"
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
            "=============================================="
        );
        console.log("");

    }
);