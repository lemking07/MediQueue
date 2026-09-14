let hospitalData = {
    departments: []
};

const expandedDepartments =
    new Set();


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

        hospitalData =
            data;

        renderDashboard();

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
            "staff-connection"
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
// LIVE CLOCK
// ======================================================

function updateClock() {

    const now =
        new Date();


    document.getElementById(
        "live-time"
    ).textContent =
        now.toLocaleTimeString(
            [],
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit",

                second:
                    "2-digit"
            }
        );


    document.getElementById(
        "live-date"
    ).textContent =
        now.toLocaleDateString(
            [],
            {
                weekday:
                    "long",

                year:
                    "numeric",

                month:
                    "long",

                day:
                    "numeric"
            }
        );
}


setInterval(
    updateClock,
    1000
);


updateClock();


// ======================================================
// INITIAL LOAD
// ======================================================

async function loadData() {

    try {

        const response =
            await fetch(
                "/api/data"
            );


        hospitalData =
            await response.json();


        renderDashboard();


    } catch (error) {

        console.error(
            error
        );

    }
}


// ======================================================
// RENDER DASHBOARD
// ======================================================

function renderDashboard() {

    renderSummary();

    renderDepartments();

}


// ======================================================
// SUMMARY CARDS
// ======================================================

function renderSummary() {

    const departments =
        hospitalData.departments || [];


    let waiting = 0;

    let busy = 0;

    let available = 0;


    departments.forEach(
        department => {

            waiting +=
                department.waiting.length;


            department.rooms.forEach(
                room => {

                    if (
                        room.currentQueue
                    ) {

                        busy++;

                    } else {

                        available++;

                    }

                }
            );

        }
    );


    document.getElementById(
        "summary-departments"
    ).textContent =
        departments.length;


    document.getElementById(
        "summary-waiting"
    ).textContent =
        waiting;


    document.getElementById(
        "summary-busy"
    ).textContent =
        busy;


    document.getElementById(
        "summary-available"
    ).textContent =
        available;
}


// ======================================================
// RENDER DEPARTMENTS
// ======================================================

function renderDepartments() {

    const container =
        document.getElementById(
            "departments-container"
        );


    container.innerHTML =
        "";


    if (
        hospitalData.departments.length ===
        0
    ) {

        container.innerHTML = `

            <div class="empty-state">
                No departments have been created yet.
            </div>

        `;

        return;
    }


    hospitalData.departments.forEach(
        department => {

            const expanded =
                expandedDepartments.has(
                    department.id
                );


            const availableRooms =
                department.rooms.filter(
                    room =>
                        !room.currentQueue
                ).length;


            const busyRooms =
                department.rooms.length -
                availableRooms;


            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "department-admin-card";


            card.innerHTML = `

                <div class="department-summary">

                    <div class="department-summary-main">

                        <div>

                            <div class="department-name-row">

                                <h2>
                                    ${escapeHtml(
                                        department.name
                                    )}
                                </h2>

                                <span
                                    class="
                                        status-badge
                                        ${
                                            department.open
                                                ? "status-open"
                                                : "status-closed"
                                        }
                                    "
                                >

                                    ${
                                        department.open
                                            ? "OPEN"
                                            : "CLOSED"
                                    }

                                </span>

                            </div>


                            <p>
                                Prefix:
                                <strong>
                                    ${escapeHtml(
                                        department.prefix
                                    )}
                                </strong>
                            </p>

                        </div>


                        <button
                            class="
                                button
                                compact-button
                                manage-button
                            "
                        >

                            ${
                                expanded
                                    ? "Close"
                                    : "Manage"
                            }

                        </button>

                    </div>


                    <div class="department-mini-stats">

                        <div>

                            <span>
                                Waiting
                            </span>

                            <strong>
                                ${department.waiting.length}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Rooms
                            </span>

                            <strong>
                                ${department.rooms.length}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Busy
                            </span>

                            <strong>
                                ${busyRooms}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Available
                            </span>

                            <strong>
                                ${availableRooms}
                            </strong>

                        </div>

                    </div>


                    ${
                        expanded
                            ? buildManagePanel(
                                department
                            )
                            : ""
                    }

                </div>

            `;


            card
                .querySelector(
                    ".manage-button"
                )
                .addEventListener(
                    "click",
                    () => {

                        if (
                            expandedDepartments.has(
                                department.id
                            )
                        ) {

                            expandedDepartments.delete(
                                department.id
                            );

                        } else {

                            expandedDepartments.add(
                                department.id
                            );

                        }


                        renderDepartments();

                    }
                );


            if (expanded) {

                attachDepartmentControls(
                    card,
                    department
                );

            }


            container.appendChild(
                card
            );

        }
    );
}


// ======================================================
// BUILD MANAGE PANEL
// ======================================================

function buildManagePanel(
    department
) {

    const availableRooms =
        department.rooms.filter(
            room =>
                !room.currentQueue
        );


    return `

        <div class="manage-panel">

            <!-- QUEUE CONTROL -->

            <section class="manage-section">

                <div class="manage-title">

                    <div>

                        <span class="section-kicker">
                            QUEUE
                        </span>

                        <h3>
                            Waiting Patients
                        </h3>

                    </div>

                    <strong class="waiting-counter">
                        ${department.waiting.length}
                    </strong>

                </div>


                <div class="waiting-list">

                    ${
                        department.waiting.length
                            ? department.waiting
                                .map(
                                    number => `
                                        <span>
                                            ${escapeHtml(
                                                number
                                            )}
                                        </span>
                                    `
                                )
                                .join("")

                            : `
                                <div class="empty-small">
                                    No patients waiting.
                                </div>
                            `
                    }

                </div>

            </section>


            <!-- MANUAL ASSIGNMENT -->

            <section class="manage-section">

                <span class="section-kicker">
                    QUICK ASSIGN
                </span>

                <h3>
                    Assign Patient to Room
                </h3>


                <div class="inline-form">

                    <select
                        class="manual-queue"
                    >

                        <option value="">
                            Select queue number
                        </option>

                        ${
                            department.waiting
                                .map(
                                    number => `
                                        <option
                                            value="${escapeHtml(
                                                number
                                            )}"
                                        >
                                            ${escapeHtml(
                                                number
                                            )}
                                        </option>
                                    `
                                )
                                .join("")
                        }

                    </select>


                    <select
                        class="manual-room"
                    >

                        <option value="">
                            Select available room
                        </option>

                        ${
                            availableRooms
                                .map(
                                    room => `
                                        <option
                                            value="${escapeHtml(
                                                room.number
                                            )}"
                                        >
                                            ${escapeHtml(
                                                room.number
                                            )}
                                        </option>
                                    `
                                )
                                .join("")
                        }

                    </select>


                    <button
                        class="
                            button
                            compact-button
                            assign-button
                        "
                    >
                        Assign
                    </button>

                </div>

            </section>


            <!-- ROOMS -->

            <section class="manage-section">

                <div class="manage-title">

                    <div>

                        <span class="section-kicker">
                            ROOMS
                        </span>

                        <h3>
                            Room Control
                        </h3>

                    </div>

                </div>


                <div class="room-admin-list">

                    ${
                        department.rooms.length
                            ? department.rooms
                                .map(
                                    room =>
                                        buildRoomRow(
                                            department,
                                            room
                                        )
                                )
                                .join("")

                            : `
                                <div class="empty-small">
                                    No rooms created.
                                </div>
                            `
                    }

                </div>


                <div class="inline-form add-room-form">

                    <input
                        type="text"
                        class="new-room-name"
                        placeholder="New room name e.g. Room 4"
                    >


                    <button
                        class="
                            button
                            compact-button
                            add-room-button
                        "
                    >
                        + Add Room
                    </button>

                </div>

            </section>


            <!-- SETTINGS -->

            <section class="manage-section">

                <span class="section-kicker">
                    CUSTOMIZATION
                </span>

                <h3>
                    Department Settings
                </h3>


                <div class="settings-grid">

                    <label>

                        Department Name

                        <input
                            type="text"
                            class="setting-name"
                            value="${escapeHtml(
                                department.name
                            )}"
                        >

                    </label>


                    <label>

                        Queue Prefix

                        <input
                            type="text"
                            class="setting-prefix"
                            maxlength="4"
                            value="${escapeHtml(
                                department.prefix
                            )}"
                        >

                    </label>

                </div>


                <label class="switch-row">

                    <span>

                        <strong>
                            Department Open
                        </strong>

                        <small>
                            Patients can take new numbers.
                        </small>

                    </span>


                    <input
                        type="checkbox"
                        class="setting-open"

                        ${
                            department.open
                                ? "checked"
                                : ""
                        }
                    >

                </label>


                <button
                    class="
                        button
                        compact-button
                        save-department-button
                    "
                >
                    Save Changes
                </button>

            </section>


            <!-- DANGER -->

            <section class="manage-section danger-section">

                <span class="section-kicker">
                    ADVANCED
                </span>

                <h3>
                    Reset / Remove
                </h3>


                <p>
                    These actions affect the whole department.
                </p>


                <div class="danger-actions">

                    <button
                        class="
                            button
                            warning-button
                            reset-button
                        "
                    >
                        Reset Queue
                    </button>


                    <button
                        class="
                            button
                            danger-button
                            delete-department-button
                        "
                    >
                        Delete Department
                    </button>

                </div>

            </section>

        </div>

    `;
}


// ======================================================
// BUILD ROOM ROW
// ======================================================

function buildRoomRow(
    department,
    room
) {

    const busy =
        Boolean(
            room.currentQueue
        );


    return `

        <div
            class="room-admin-card"
            data-room="${escapeHtml(
                room.number
            )}"
        >

            <div class="room-admin-info">

                <div>

                    <strong class="room-title">
                        ${escapeHtml(
                            room.number
                        )}
                    </strong>


                    <span
                        class="
                            status-badge
                            ${
                                busy
                                    ? "status-busy"
                                    : "status-available"
                            }
                        "
                    >

                        ${
                            busy
                                ? "BUSY"
                                : "AVAILABLE"
                        }

                    </span>

                </div>


                <div class="room-current-patient">

                    ${
                        busy
                            ? `
                                <span>
                                    Current Patient
                                </span>

                                <strong>
                                    ${escapeHtml(
                                        room.currentQueue
                                    )}
                                </strong>
                            `
                            : `
                                <span>
                                    Ready for next patient
                                </span>
                            `
                    }

                </div>

            </div>


            <div class="room-actions">

                <button
                    class="
                        room-action-button
                        call-next-button
                    "

                    ${busy ? "disabled" : ""}
                >
                    Call Next
                </button>


                <button
                    class="
                        room-action-button
                        recall-button
                    "

                    ${!busy ? "disabled" : ""}
                >
                    Recall
                </button>


                <button
                    class="
                        room-action-button
                        complete-button
                    "

                    ${!busy ? "disabled" : ""}
                >
                    Complete
                </button>

            </div>


            <div class="room-customization">

                <input
                    type="text"
                    class="rename-room-input"
                    value="${escapeHtml(
                        room.number
                    )}"
                >


                <button
                    class="small-outline-button rename-room-button"
                >
                    Rename
                </button>


                <button
                    class="small-danger-button delete-room-button"
                    ${busy ? "disabled" : ""}
                >
                    Delete
                </button>

            </div>

        </div>

    `;
}


// ======================================================
// ATTACH DEPARTMENT CONTROLS
// ======================================================

function attachDepartmentControls(
    card,
    department
) {

    const assignButton =
        card.querySelector(
            ".assign-button"
        );


    assignButton.addEventListener(
        "click",
        async () => {

            const queue =
                card.querySelector(
                    ".manual-queue"
                ).value;


            const room =
                card.querySelector(
                    ".manual-room"
                ).value;


            if (
                !queue ||
                !room
            ) {

                showToast(
                    "Select a queue number and room.",
                    "error"
                );

                return;
            }


            await apiRequest(
                "/api/queue/assign",
                "POST",
                {
                    departmentId:
                        department.id,

                    queueNumber:
                        queue,

                    roomNumber:
                        room
                },

                "Patient assigned."
            );

        }
    );


    card
        .querySelector(
            ".add-room-button"
        )
        .addEventListener(
            "click",
            async () => {

                const input =
                    card.querySelector(
                        ".new-room-name"
                    );


                const roomNumber =
                    input.value.trim();


                if (!roomNumber) {

                    showToast(
                        "Enter a room name.",
                        "error"
                    );

                    return;
                }


                await apiRequest(
                    `/api/staff/departments/${department.id}/rooms`,
                    "POST",
                    {
                        roomNumber
                    },

                    "Room added."
                );

            }
        );


    card
        .querySelector(
            ".save-department-button"
        )
        .addEventListener(
            "click",
            async () => {

                const name =
                    card.querySelector(
                        ".setting-name"
                    ).value.trim();


                const prefix =
                    card.querySelector(
                        ".setting-prefix"
                    ).value.trim();


                const open =
                    card.querySelector(
                        ".setting-open"
                    ).checked;


                await apiRequest(
                    `/api/staff/departments/${department.id}`,
                    "PUT",
                    {
                        name,
                        prefix,
                        open
                    },

                    "Department updated."
                );

            }
        );


    card
        .querySelector(
            ".reset-button"
        )
        .addEventListener(
            "click",
            async () => {

                const yes =
                    confirm(

                        `Reset ${department.name}?\n\n` +

                        "This clears all waiting patients, active rooms and resets the queue to 001."

                    );


                if (!yes) {
                    return;
                }


                const finalCheck =
                    confirm(
                        "Final confirmation: reset this queue?"
                    );


                if (!finalCheck) {
                    return;
                }


                await apiRequest(
                    "/api/queue/reset",
                    "POST",
                    {
                        departmentId:
                            department.id,

                        confirmReset:
                            true
                    },

                    "Queue reset."
                );

            }
        );


    card
        .querySelector(
            ".delete-department-button"
        )
        .addEventListener(
            "click",
            async () => {

                const yes =
                    confirm(
                        `Delete ${department.name}?`
                    );


                if (!yes) {
                    return;
                }


                expandedDepartments.delete(
                    department.id
                );


                await apiRequest(
                    `/api/staff/departments/${department.id}`,
                    "DELETE",
                    null,

                    "Department deleted."
                );

            }
        );


    card
        .querySelectorAll(
            ".room-admin-card"
        )
        .forEach(
            roomElement => {

                const roomNumber =
                    roomElement.dataset.room;


                const callButton =
                    roomElement.querySelector(
                        ".call-next-button"
                    );


                const recallButton =
                    roomElement.querySelector(
                        ".recall-button"
                    );


                const completeButton =
                    roomElement.querySelector(
                        ".complete-button"
                    );


                const renameButton =
                    roomElement.querySelector(
                        ".rename-room-button"
                    );


                const deleteButton =
                    roomElement.querySelector(
                        ".delete-room-button"
                    );


                callButton.addEventListener(
                    "click",
                    async () => {

                        await apiRequest(
                            "/api/queue/call-next",
                            "POST",
                            {
                                departmentId:
                                    department.id,

                                roomNumber
                            },

                            "Next patient called."
                        );

                    }
                );


                recallButton.addEventListener(
                    "click",
                    async () => {

                        await apiRequest(
                            "/api/queue/recall",
                            "POST",
                            {
                                departmentId:
                                    department.id,

                                roomNumber
                            },

                            "Patient recalled."
                        );

                    }
                );


                completeButton.addEventListener(
                    "click",
                    async () => {

                        const yes =
                            confirm(
                                `Complete the patient in ${roomNumber}?`
                            );


                        if (!yes) {
                            return;
                        }


                        await apiRequest(
                            "/api/queue/complete",
                            "POST",
                            {
                                departmentId:
                                    department.id,

                                roomNumber
                            },

                            "Patient completed."
                        );

                    }
                );


                renameButton.addEventListener(
                    "click",
                    async () => {

                        const newName =
                            roomElement
                                .querySelector(
                                    ".rename-room-input"
                                )
                                .value
                                .trim();


                        if (!newName) {

                            showToast(
                                "Enter a room name.",
                                "error"
                            );

                            return;
                        }


                        await apiRequest(
                            `/api/staff/departments/${department.id}/rooms/${encodeURIComponent(roomNumber)}`,
                            "PUT",
                            {
                                newRoomNumber:
                                    newName
                            },

                            "Room renamed."
                        );

                    }
                );


                deleteButton.addEventListener(
                    "click",
                    async () => {

                        const yes =
                            confirm(
                                `Delete ${roomNumber}?`
                            );


                        if (!yes) {
                            return;
                        }


                        await apiRequest(
                            `/api/staff/departments/${department.id}/rooms/${encodeURIComponent(roomNumber)}`,
                            "DELETE",
                            null,

                            "Room deleted."
                        );

                    }
                );

            }
        );
}


// ======================================================
// ADD DEPARTMENT FORM
// ======================================================

document
    .getElementById(
        "add-department-form"
    )
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const name =
                document
                    .getElementById(
                        "new-department-name"
                    )
                    .value
                    .trim();


            const prefix =
                document
                    .getElementById(
                        "new-department-prefix"
                    )
                    .value
                    .trim();


            if (
                !name ||
                !prefix
            ) {

                showToast(
                    "Enter department name and prefix.",
                    "error"
                );

                return;
            }


            const success =
                await apiRequest(
                    "/api/staff/departments",
                    "POST",
                    {
                        name,
                        prefix
                    },

                    "Department added."
                );


            if (success) {

                event.target.reset();

            }

        }
    );


// ======================================================
// API REQUEST
// ======================================================

async function apiRequest(
    url,
    method,
    body,
    successMessage
) {

    try {

        const options = {
            method
        };


        if (body !== null) {

            options.headers = {
                "Content-Type":
                    "application/json"
            };


            options.body =
                JSON.stringify(
                    body
                );
        }


        const response =
            await fetch(
                url,
                options
            );


        if (
            response.status ===
            401
        ) {

            window.location.href =
                "/staff-login.html";

            return false;
        }


        const result =
            await response.json();


        if (!response.ok) {

            showToast(
                result.error ||
                "Request failed.",
                "error"
            );

            return false;
        }


        showToast(
            successMessage,
            "success"
        );


        return true;


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "Unable to connect to server.",
            "error"
        );


        return false;
    }
}


// ======================================================
// TOAST
// ======================================================

let toastTimer = null;


function showToast(
    message,
    type = "success"
) {

    const toast =
        document.getElementById(
            "toast"
        );


    toast.textContent =
        message;


    toast.className =
        `toast show ${type}`;


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.className =
                    "toast";

            },
            2600
        );
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
// FALLBACK SYNC
// ======================================================

setInterval(
    loadData,
    15000
);


// ======================================================
// START
// ======================================================

loadData();