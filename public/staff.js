// ==========================================
// MEDIQUEUE - STAFF DASHBOARD
// ==========================================

let latestData = {
    departments: []
};

// Socket.IO is optional here.
// If it is loaded in staff.html, the dashboard becomes real-time.
const socket =
    typeof io !== "undefined"
        ? io()
        : null;


// ==========================================
// STAFF FETCH
// ==========================================

async function staffFetch(url, options = {}) {

    const response = await fetch(url, options);

    if (response.status === 401) {

        window.location.replace(
            "/staff-login.html"
        );

        throw new Error(
            "Staff login required"
        );
    }

    return response;
}


// ==========================================
// LOAD STAFF DASHBOARD
// ==========================================

async function loadStaffDashboard() {

    try {

        const response =
            await staffFetch("/api/data");

        const data =
            await response.json();

        latestData = data;

        renderStaffDashboard(data);

    } catch (error) {

        console.error(
            "Error loading dashboard:",
            error
        );
    }
}


// ==========================================
// RENDER DASHBOARD
// ==========================================

function renderStaffDashboard(data) {

    const container =
        document.getElementById(
            "departments-container"
        );

    if (!container) {
        console.error(
            "departments-container not found"
        );
        return;
    }

    container.innerHTML = "";


    // ======================================
    // ADD DEPARTMENT
    // ======================================

    const addDepartmentButton =
        document.createElement("button");

    addDepartmentButton.className =
        "button";

    addDepartmentButton.textContent =
        "+ Add Department";

    addDepartmentButton.addEventListener(
        "click",
        addDepartment
    );

    container.appendChild(
        addDepartmentButton
    );


    // ======================================
    // NO DEPARTMENTS
    // ======================================

    if (
        !data.departments ||
        data.departments.length === 0
    ) {

        const message =
            document.createElement("p");

        message.textContent =
            "No departments available.";

        container.appendChild(message);

        return;
    }


    // ======================================
    // DISPLAY DEPARTMENTS
    // ======================================

    data.departments.forEach(
        department => {

            const departmentBox =
                document.createElement(
                    "div"
                );

            departmentBox.className =
                "queue-box";

            departmentBox.innerHTML = `
                <h2>
                    ${escapeHtml(department.name)}
                </h2>

                <p>
                    Prefix:
                    <strong>
                        ${escapeHtml(department.prefix)}
                    </strong>
                </p>

                <p>
                    Status:
                    <strong>
                        ${
                            department.open
                                ? "Open"
                                : "Closed"
                        }
                    </strong>
                </p>

                <div class="staff-buttons">

                    <button
                        class="button edit-department">
                        ✏️ Edit / Rename
                    </button>

                    <button
                        class="button toggle-department">
                        ${
                            department.open
                                ? "Close Department"
                                : "Open Department"
                        }
                    </button>

                    <button
                        class="button delete-department">
                        Delete Department
                    </button>

                </div>

                <hr>

                <h3>
                    Waiting Queue
                </h3>

                <div class="waiting-list">
                    ${
                        department.waiting &&
                        department.waiting.length > 0

                            ? department.waiting
                                .map(
                                    queue =>
                                        `<span>${escapeHtml(queue)}</span>`
                                )
                                .join(" ")

                            : "<p>No patients waiting</p>"
                    }
                </div>

                <hr>

                <h3>
                    Manual Queue Assignment
                </h3>

                <div class="manual-assignment">

                    <label>
                        Queue Number
                    </label>

                    <select class="queue-select">

                        <option value="">
                            Select Queue
                        </option>

                        ${
                            (department.waiting || [])
                                .map(
                                    queue => `
                                        <option value="${escapeHtml(queue)}">
                                            ${escapeHtml(queue)}
                                        </option>
                                    `
                                )
                                .join("")
                        }

                    </select>

                    <label>
                        Room
                    </label>

                    <select class="room-select">

                        <option value="">
                            Select Room
                        </option>

                        ${
                            (department.rooms || [])
                                .filter(
                                    room =>
                                        room.status ===
                                        "available"
                                )
                                .map(
                                    room => `
                                        <option value="${escapeHtml(room.number)}">
                                            ${escapeHtml(room.number)}
                                        </option>
                                    `
                                )
                                .join("")
                        }

                    </select>

                    <button
                        class="button manual-assign-button">
                        Assign Queue
                    </button>

                </div>

                <hr>

                <h3>
                    Rooms
                </h3>
            `;


            // ==================================
            // EDIT / RENAME DEPARTMENT
            // ==================================

            const editButton =
                departmentBox.querySelector(
                    ".edit-department"
                );

            editButton.addEventListener(
                "click",
                () => {
                    editDepartment(
                        department
                    );
                }
            );


            // ==================================
            // OPEN / CLOSE
            // ==================================

            departmentBox
                .querySelector(
                    ".toggle-department"
                )
                .addEventListener(
                    "click",
                    () => {
                        toggleDepartment(
                            department
                        );
                    }
                );


            // ==================================
            // DELETE DEPARTMENT
            // ==================================

            departmentBox
                .querySelector(
                    ".delete-department"
                )
                .addEventListener(
                    "click",
                    () => {
                        deleteDepartment(
                            department
                        );
                    }
                );


            // ==================================
            // MANUAL ASSIGNMENT
            // ==================================

            departmentBox
                .querySelector(
                    ".manual-assign-button"
                )
                .addEventListener(
                    "click",
                    async () => {

                        const queueNumber =
                            departmentBox
                                .querySelector(
                                    ".queue-select"
                                )
                                .value;

                        const roomNumber =
                            departmentBox
                                .querySelector(
                                    ".room-select"
                                )
                                .value;

                        if (!queueNumber) {

                            alert(
                                "Please select a queue number."
                            );

                            return;
                        }

                        if (!roomNumber) {

                            alert(
                                "Please select a room."
                            );

                            return;
                        }

                        await assignQueue(
                            department.id,
                            queueNumber,
                            roomNumber
                        );
                    }
                );


            // ==================================
            // DISPLAY ROOMS
            // ==================================

            (department.rooms || [])
                .forEach(room => {

                    const roomBox =
                        document.createElement(
                            "div"
                        );

                    roomBox.style.margin =
                        "15px 0";

                    roomBox.style.padding =
                        "15px";

                    roomBox.style.border =
                        "1px solid #ddd";

                    roomBox.style.borderRadius =
                        "10px";

                    roomBox.innerHTML = `
                        <h3>
                            ${escapeHtml(room.number)}
                        </h3>

                        <p>
                            Status:
                            <strong>
                                ${escapeHtml(room.status)}
                            </strong>
                        </p>

                        <p>
                            Current Queue:
                            <strong>
                                ${
                                    room.currentQueue
                                        ? escapeHtml(
                                            room.currentQueue
                                        )
                                        : "None"
                                }
                            </strong>
                        </p>

                        <div class="staff-buttons">

                            <button
                                class="button call-next-button">
                                Call Next
                            </button>

                            <button
                                class="button complete-patient-button">
                                Complete Patient
                            </button>

                            <button
                                class="button delete-room-button">
                                Delete Room
                            </button>

                        </div>
                    `;


                    // CALL NEXT

                    roomBox
                        .querySelector(
                            ".call-next-button"
                        )
                        .addEventListener(
                            "click",
                            () => {

                                callNext(
                                    department.id,
                                    room.number
                                );
                            }
                        );


                    // COMPLETE PATIENT

                    roomBox
                        .querySelector(
                            ".complete-patient-button"
                        )
                        .addEventListener(
                            "click",
                            () => {

                                completePatient(
                                    department.id,
                                    room.number
                                );
                            }
                        );


                    // DELETE ROOM

                    roomBox
                        .querySelector(
                            ".delete-room-button"
                        )
                        .addEventListener(
                            "click",
                            () => {

                                deleteRoom(
                                    department.id,
                                    room.number
                                );
                            }
                        );

                    departmentBox.appendChild(
                        roomBox
                    );
                });


            // ==================================
            // ADD ROOM
            // ==================================

            const addRoomButton =
                document.createElement(
                    "button"
                );

            addRoomButton.className =
                "button";

            addRoomButton.textContent =
                "+ Add Room";

            addRoomButton.addEventListener(
                "click",
                () => {

                    addRoom(
                        department.id
                    );
                }
            );

            departmentBox.appendChild(
                addRoomButton
            );


            container.appendChild(
                departmentBox
            );
        }
    );
}


// ==========================================
// ADD DEPARTMENT
// ==========================================

async function addDepartment() {

    let name = prompt(
        "Enter department name:"
    );

    if (name === null) {
        return;
    }

    name = name.trim();

    if (!name) {

        alert(
            "Department name cannot be empty."
        );

        return;
    }


    let prefix = prompt(
        "Enter queue prefix.\nExample: C"
    );

    if (prefix === null) {
        return;
    }

    prefix =
        prefix.trim().toUpperCase();

    if (!prefix) {

        alert(
            "Queue prefix cannot be empty."
        );

        return;
    }


    try {

        const response =
            await staffFetch(
                "/api/staff/departments",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            name,
                            prefix
                        })
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            alert(
                result.error ||
                "Unable to add department."
            );

            return;
        }

        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        alert(
            "Unable to add department."
        );
    }
}


// ==========================================
// EDIT / RENAME DEPARTMENT
// ==========================================

async function editDepartment(
    department
) {

    let newName = prompt(
        "Rename Department\n\nEnter department name:",
        department.name
    );

    // User clicked Cancel
    if (newName === null) {
        return;
    }

    newName = newName.trim();

    if (!newName) {

        alert(
            "Department name cannot be empty."
        );

        return;
    }


    let newPrefix = prompt(
        "Queue Prefix\n\nEnter queue prefix:",
        department.prefix
    );

    // User clicked Cancel
    if (newPrefix === null) {
        return;
    }

    newPrefix =
        newPrefix.trim().toUpperCase();

    if (!newPrefix) {

        alert(
            "Queue prefix cannot be empty."
        );

        return;
    }


    try {

        const response =
            await staffFetch(
                `/api/staff/departments/${department.id}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            name: newName,
                            prefix: newPrefix
                        })
                }
            );


        let result;

        try {
            result =
                await response.json();
        } catch {
            result = {};
        }


        if (!response.ok) {

            alert(
                result.error ||
                "Unable to edit department."
            );

            return;
        }


        alert(
            `Department updated successfully.\n\n` +
            `${department.name} → ${newName}\n` +
            `Prefix: ${newPrefix}`
        );


        await loadStaffDashboard();

    } catch (error) {

        console.error(
            "Edit department error:",
            error
        );

        alert(
            "Unable to edit department. Please try again."
        );
    }
}


// ==========================================
// OPEN / CLOSE DEPARTMENT
// ==========================================

async function toggleDepartment(
    department
) {

    try {

        const response =
            await staffFetch(
                `/api/staff/departments/${department.id}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            open:
                                !department.open
                        })
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            alert(
                result.error ||
                "Unable to update department."
            );

            return;
        }

        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        alert(
            "Unable to update department."
        );
    }
}


// ==========================================
// DELETE DEPARTMENT
// ==========================================

async function deleteDepartment(
    department
) {

    const confirmDelete =
        confirm(
            `Delete department "${department.name}"?\n\n` +
            `This cannot be undone.`
        );

    if (!confirmDelete) {
        return;
    }


    try {

        const response =
            await staffFetch(
                `/api/staff/departments/${department.id}`,
                {
                    method: "DELETE"
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            alert(
                result.error ||
                "Unable to delete department."
            );

            return;
        }

        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        alert(
            "Unable to delete department."
        );
    }
}


// ==========================================
// ADD ROOM
// ==========================================

async function addRoom(
    departmentId
) {

    let roomNumber = prompt(
        "Enter room name or number:\nExample: Room 3"
    );

    if (roomNumber === null) {
        return;
    }

    roomNumber =
        roomNumber.trim();

    if (!roomNumber) {

        alert(
            "Room name cannot be empty."
        );

        return;
    }


    try {

        const response =
            await staffFetch(
                `/api/staff/departments/${departmentId}/rooms`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            roomNumber
                        })
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            alert(
                result.error ||
                "Unable to add room."
            );

            return;
        }

        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        alert(
            "Unable to add room."
        );
    }
}


// ==========================================
// DELETE ROOM
// ==========================================

async function deleteRoom(
    departmentId,
    roomNumber
) {

    const confirmDelete =
        confirm(
            `Delete ${roomNumber}?`
        );

    if (!confirmDelete) {
        return;
    }


    try {

        const response =
            await staffFetch(
                `/api/staff/departments/${departmentId}/rooms/${encodeURIComponent(roomNumber)}`,
                {
                    method: "DELETE"
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            alert(
                result.error ||
                "Unable to delete room."
            );

            return;
        }

        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        alert(
            "Unable to delete room."
        );
    }
}


// ==========================================
// CALL NEXT
// ==========================================

async function callNext(
    departmentId,
    roomNumber
) {

    try {

        const response =
            await staffFetch(
                "/api/queue/call-next",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            departmentId,
                            roomNumber
                        })
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            alert(
                result.error ||
                "Unable to call next patient."
            );

            return;
        }


        alert(
            `Queue ${result.queueNumber} called.\n\n` +
            `Department: ${result.department}\n` +
            `Room: ${result.room}`
        );


        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        alert(
            "Unable to call next patient."
        );
    }
}


// ==========================================
// MANUAL ASSIGN QUEUE
// ==========================================

async function assignQueue(
    departmentId,
    queueNumber,
    roomNumber
) {

    try {

        const response =
            await staffFetch(
                "/api/queue/assign",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            departmentId,
                            queueNumber,
                            roomNumber
                        })
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            alert(
                result.error ||
                "Unable to assign queue."
            );

            return;
        }


        alert(
            `Queue ${result.queueNumber} assigned.\n\n` +
            `Department: ${result.department}\n` +
            `Room: ${result.room}`
        );


        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        alert(
            "Unable to assign queue."
        );
    }
}


// ==========================================
// COMPLETE PATIENT
// ==========================================

async function completePatient(
    departmentId,
    roomNumber
) {

    const confirmComplete =
        confirm(
            `Complete patient in ${roomNumber}?`
        );

    if (!confirmComplete) {
        return;
    }


    try {

        const response =
            await staffFetch(
                "/api/queue/complete",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            departmentId,
                            roomNumber
                        })
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            alert(
                result.error ||
                "Unable to complete patient."
            );

            return;
        }


        alert(
            `Completed: ${result.completedQueue}\n\n` +
            `${result.room} is now available.`
        );


        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        alert(
            "Unable to complete patient."
        );
    }
}


// ==========================================
// REAL-TIME SOCKET.IO
// ==========================================

if (socket) {

    socket.on(
        "connect",
        () => {

            console.log(
                "MediQueue real-time connected."
            );
        }
    );


    socket.on(
        "queue:update",
        data => {

            latestData = data;

            renderStaffDashboard(data);
        }
    );


    socket.on(
        "disconnect",
        () => {

            console.log(
                "MediQueue real-time disconnected."
            );
        }
    );
}


// ==========================================
// FALLBACK REFRESH
// ==========================================

// Socket.IO normally updates instantly.
// This keeps the dashboard updated if
// the socket temporarily disconnects.

setInterval(
    () => {

        if (
            !socket ||
            !socket.connected
        ) {

            loadStaffDashboard();
        }

    },
    15000
);


// ==========================================
// LOGOUT
// ==========================================

const logoutButton =
    document.getElementById(
        "logout-button"
    );

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            try {

                await staffFetch(
                    "/api/staff/logout",
                    {
                        method: "POST"
                    }
                );

            } catch (error) {

                console.error(error);

            } finally {

                window.location.replace(
                    "/staff-login.html"
                );
            }
        }
    );
}


// ==========================================
// BASIC HTML SAFETY
// ==========================================

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ==========================================
// START
// ==========================================

loadStaffDashboard();