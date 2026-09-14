let currentTicket = null;

let latestData = null;

let audioContext = null;

let soundUnlocked = false;

let notificationPermissionAsked = false;


// ======================================================
// SOCKET.IO
// ======================================================

const socket = io();


socket.on(
    "connect",
    () => {

        setConnectionStatus(
            true
        );

    }
);


socket.on(
    "disconnect",
    () => {

        setConnectionStatus(
            false
        );

    }
);


socket.on(
    "queue:update",
    data => {

        latestData =
            data;

        if (currentTicket) {

            updateQueueStatusFromData(
                data
            );

        } else {

            renderDepartments(
                data
            );
        }

    }
);


socket.on(
    "patient:called",
    callData => {

        if (!currentTicket) {
            return;
        }


        if (
            callData.queueNumber !==
            currentTicket.queueNumber
        ) {

            return;
        }


        showCalledState(
            callData.room
        );


        notifyPatient(
            currentTicket.queueNumber,
            callData.room,
            callData.type === "recall"
        );

    }
);


// ======================================================
// CONNECTION STATUS
// ======================================================

function setConnectionStatus(
    connected
) {

    const badge =
        document.getElementById(
            "patient-connection"
        );


    if (!badge) {
        return;
    }


    if (connected) {

        badge.textContent =
            "● Live";

        badge.className =
            "connection-badge online";

    } else {

        badge.textContent =
            "● Reconnecting";

        badge.className =
            "connection-badge offline";

    }
}


// ======================================================
// SOUND
// ======================================================

async function unlockSound() {

    try {

        if (!audioContext) {

            audioContext =
                new (
                    window.AudioContext ||
                    window.webkitAudioContext
                )();

        }


        if (
            audioContext.state ===
            "suspended"
        ) {

            await audioContext.resume();

        }


        soundUnlocked =
            true;


        const button =
            document.getElementById(
                "enable-sound-button"
            );


        if (button) {

            button.textContent =
                "🔔 Notifications Enabled";

        }


    } catch (error) {

        console.error(
            "Audio error:",
            error
        );

    }
}


// ======================================================
// BROWSER NOTIFICATION
// ======================================================

async function enableNotifications() {

    await unlockSound();


    if (
        "Notification" in window &&
        !notificationPermissionAsked
    ) {

        notificationPermissionAsked =
            true;


        try {

            await Notification
                .requestPermission();

        } catch (error) {

            console.log(
                "Notification permission error:",
                error
            );

        }

    }
}


// ======================================================
// PLAY CALL SOUND
// ======================================================

function playCalledSound() {

    if (
        !soundUnlocked ||
        !audioContext
    ) {

        return;
    }


    const frequencies = [
        880,
        1100,
        1320
    ];


    frequencies.forEach(
        (frequency, index) => {

            const oscillator =
                audioContext
                    .createOscillator();


            const gain =
                audioContext
                    .createGain();


            const start =
                audioContext.currentTime +
                index * 0.35;


            oscillator.type =
                "sine";


            oscillator.frequency.value =
                frequency;


            gain.gain.setValueAtTime(
                0.001,
                start
            );


            gain.gain
                .exponentialRampToValueAtTime(
                    0.35,
                    start + 0.03
                );


            gain.gain
                .exponentialRampToValueAtTime(
                    0.001,
                    start + 0.3
                );


            oscillator.connect(
                gain
            );


            gain.connect(
                audioContext.destination
            );


            oscillator.start(
                start
            );


            oscillator.stop(
                start + 0.32
            );

        }
    );
}


// ======================================================
// NOTIFY PATIENT
// ======================================================

function notifyPatient(
    queueNumber,
    roomNumber,
    force = false
) {

    const key =
        `mediqueue-called-${queueNumber}`;


    if (
        !force &&
        sessionStorage.getItem(key)
    ) {

        return;
    }


    playCalledSound();


    if (
        "vibrate" in navigator
    ) {

        navigator.vibrate([
            500,
            200,
            500,
            200,
            800
        ]);

    }


    if (
        "Notification" in window &&
        Notification.permission ===
        "granted"
    ) {

        new Notification(
            `MediQueue - ${queueNumber}`,
            {
                body:
                    `Your queue number has been called. Please proceed to ${roomNumber}.`
            }
        );

    }


    sessionStorage.setItem(
        key,
        "true"
    );
}


// ======================================================
// LOAD INITIAL DATA
// ======================================================

async function loadInitialData() {

    try {

        const response =
            await fetch(
                "/api/data"
            );


        const data =
            await response.json();


        latestData =
            data;


        if (currentTicket) {

            updateQueueStatusFromData(
                data
            );

        } else {

            renderDepartments(
                data
            );
        }


    } catch (error) {

        console.error(
            "Unable to load data:",
            error
        );

    }
}


// ======================================================
// DISPLAY DEPARTMENTS
// ======================================================

function renderDepartments(
    data
) {

    const departmentList =
        document.querySelector(
            ".department-list"
        );


    if (!departmentList) {
        return;
    }


    departmentList.innerHTML =
        "";


    if (
        !data.departments ||
        data.departments.length === 0
    ) {

        departmentList.innerHTML =
            `
                <div class="empty-state">
                    No departments available.
                </div>
            `;

        return;
    }


    data.departments.forEach(
        department => {

            const button =
                document.createElement(
                    "button"
                );


            button.className =
                "department-button";


            button.disabled =
                !department.open;


            button.innerHTML = `

                <div>

                    <strong>
                        ${escapeHtml(
                            department.name
                        )}
                    </strong>

                    <span>
                        ${
                            department.open
                                ? "Open"
                                : "Closed"
                        }
                    </span>

                </div>

                <span class="department-arrow">
                    →
                </span>

            `;


            button.addEventListener(
                "click",
                async () => {

                    await unlockSound();

                    await getQueueNumber(
                        department.id
                    );

                }
            );


            departmentList
                .appendChild(
                    button
                );

        }
    );
}


// ======================================================
// GET QUEUE NUMBER
// ======================================================

async function getQueueNumber(
    departmentId
) {

    try {

        const response =
            await fetch(
                "/api/queue/take",
                {

                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            departmentId
                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            alert(
                result.error
            );

            return;
        }


        currentTicket = {

            departmentId:
                Number(
                    departmentId
                ),

            queueNumber:
                result.queueNumber,

            department:
                result.department

        };


        localStorage.setItem(
            "hospitalQueueTicket",
            JSON.stringify(
                currentTicket
            )
        );


        showTicket();


        if (latestData) {

            updateQueueStatusFromData(
                latestData
            );

        }


    } catch (error) {

        console.error(
            error
        );


        alert(
            "Unable to get queue number."
        );

    }
}


// ======================================================
// SHOW TICKET
// ======================================================

function showTicket() {

    document.getElementById(
        "department-section"
    ).style.display =
        "none";


    document.getElementById(
        "ticket-section"
    ).style.display =
        "block";


    document.getElementById(
        "ticket-department"
    ).textContent =
        currentTicket.department;


    document.getElementById(
        "ticket-number"
    ).textContent =
        currentTicket.queueNumber;
}


// ======================================================
// UPDATE STATUS
// ======================================================

function updateQueueStatusFromData(
    data
) {

    if (!currentTicket) {
        return;
    }


    const department =
        data.departments.find(
            department =>
                department.id ===
                currentTicket.departmentId
        );


    const ticketStatus =
        document.getElementById(
            "ticket-status"
        );


    const peopleBefore =
        document.getElementById(
            "people-before"
        );


    const roomMessage =
        document.getElementById(
            "room-message"
        );


    if (!department) {

        ticketStatus.textContent =
            "Unavailable";

        peopleBefore.textContent =
            "-";

        roomMessage.style.display =
            "none";

        return;
    }


    const assignedRoom =
        department.rooms.find(
            room =>
                room.currentQueue ===
                currentTicket.queueNumber
        );


    if (assignedRoom) {

        showCalledState(
            assignedRoom.number
        );

        return;
    }


    const waitingIndex =
        department.waiting.indexOf(
            currentTicket.queueNumber
        );


    if (waitingIndex !== -1) {

        ticketStatus.textContent =
            "WAITING";

        peopleBefore.textContent =
            waitingIndex;

        roomMessage.style.display =
            "none";

        return;
    }


    if (
        department.completed &&
        department.completed.includes(
            currentTicket.queueNumber
        )
    ) {

        ticketStatus.textContent =
            "COMPLETED";

        peopleBefore.textContent =
            "0";

        roomMessage.style.display =
            "none";

        return;
    }


    ticketStatus.textContent =
        "QUEUE RESET";

    peopleBefore.textContent =
        "-";

    roomMessage.style.display =
        "none";
}


// ======================================================
// CALLED STATE
// ======================================================

function showCalledState(
    roomNumber
) {

    document.getElementById(
        "ticket-status"
    ).textContent =
        "CALLED";


    document.getElementById(
        "people-before"
    ).textContent =
        "0";


    document.getElementById(
        "room-message"
    ).style.display =
        "block";


    document.getElementById(
        "assigned-room"
    ).textContent =
        roomNumber;
}


// ======================================================
// NEW QUEUE
// ======================================================

function takeNewQueue() {

    const yes =
        confirm(
            "Clear your current ticket and take a new queue number?"
        );


    if (!yes) {
        return;
    }


    localStorage.removeItem(
        "hospitalQueueTicket"
    );


    currentTicket =
        null;


    document.getElementById(
        "ticket-section"
    ).style.display =
        "none";


    document.getElementById(
        "department-section"
    ).style.display =
        "block";


    if (latestData) {

        renderDepartments(
            latestData
        );

    } else {

        loadInitialData();

    }
}


// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHtml(
    value
) {

    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


// ======================================================
// RESTORE TICKET
// ======================================================

function restoreTicket() {

    const saved =
        localStorage.getItem(
            "hospitalQueueTicket"
        );


    if (!saved) {

        loadInitialData();

        return;
    }


    try {

        currentTicket =
            JSON.parse(saved);


        showTicket();

        loadInitialData();


    } catch (error) {

        localStorage.removeItem(
            "hospitalQueueTicket"
        );


        currentTicket =
            null;


        loadInitialData();

    }
}


// ======================================================
// BUTTONS
// ======================================================

document
    .getElementById(
        "new-queue-button"
    )
    .addEventListener(
        "click",
        takeNewQueue
    );


document
    .getElementById(
        "enable-sound-button"
    )
    .addEventListener(
        "click",
        enableNotifications
    );


// ======================================================
// FALLBACK SYNC
// ======================================================

setInterval(
    () => {

        loadInitialData();

    },
    15000
);


// ======================================================
// START
// ======================================================

restoreTicket();