// ======================================================
// MEDIQUEUE STAFF DASHBOARD V4
// Queue + Rooms + Management + Portal Designer
// ======================================================

const socket = typeof io !== "undefined" ? io() : null;

let latestData = {
    departments: [],
    portalSettings: {}
};

// IMAGE CROP EDITOR STATE
let cropImage = null;
let cropZoom = 1;
let cropOffsetX = 0;
let cropOffsetY = 0;
let cropOnSave = null;
function drawCropPreview() {
    const canvas = document.getElementById("image-crop-canvas");
    if (!canvas || !cropImage) return;

    const ctx = canvas.getContext("2d");
    const size = 400;

    canvas.width = size;
    canvas.height = size;

    const baseScale = Math.max(
        size / cropImage.width,
        size / cropImage.height
    );

    const scale = baseScale * cropZoom;
    const width = cropImage.width * scale;
    const height = cropImage.height * scale;

    const maxX = Math.max(0, (width - size) / 2);
    const maxY = Math.max(0, (height - size) / 2);

    cropOffsetX = Math.max(-maxX, Math.min(maxX, cropOffsetX));
    cropOffsetY = Math.max(-maxY, Math.min(maxY, cropOffsetY));

    ctx.clearRect(0, 0, size, size);

    ctx.drawImage(
        cropImage,
        (size - width) / 2 + cropOffsetX,
        (size - height) / 2 + cropOffsetY,
        width,
        height
    );
}
// IMAGE CROP ZOOM CONTROL
document
    .getElementById("image-crop-zoom")
    ?.addEventListener("input", event => {
        cropZoom = Number(event.target.value);
        drawCropPreview();
    });
// IMAGE CROP DRAG CONTROL
const cropCanvas = document.getElementById("image-crop-canvas");

let cropDragging = false;
let cropLastX = 0;
let cropLastY = 0;

cropCanvas?.addEventListener("pointerdown", event => {
    if (!cropImage) return;

    cropDragging = true;
    cropLastX = event.clientX;
    cropLastY = event.clientY;

    cropCanvas.setPointerCapture(event.pointerId);
});

cropCanvas?.addEventListener("pointermove", event => {
    if (!cropDragging || !cropImage) return;

    const scale = cropCanvas.width / cropCanvas.getBoundingClientRect().width;

    cropOffsetX += (event.clientX - cropLastX) * scale;
    cropOffsetY += (event.clientY - cropLastY) * scale;

    cropLastX = event.clientX;
    cropLastY = event.clientY;

    drawCropPreview();
});

function stopCropDragging() {
    cropDragging = false;
}

cropCanvas?.addEventListener("pointerup", stopCropDragging);
cropCanvas?.addEventListener("pointercancel", stopCropDragging);
cropCanvas?.addEventListener("lostpointercapture", stopCropDragging);

function openImageCropEditor(file, onSave) {
    if (!file || !file.type.startsWith("image/")) {
        showToast("Please select an image.", "error");
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {
        const image = new Image();

        image.onload = () => {
            cropImage = image;
            cropZoom = 1;
            cropOffsetX = 0;
            cropOffsetY = 0;
            cropOnSave = onSave;

            document.getElementById("image-crop-zoom").value = 1;
            document.getElementById("image-crop-modal").hidden = false;

            drawCropPreview();
        };

        image.onerror = () => {
            showToast("Unable to open this image.", "error");
        };

        image.src = reader.result;
    };

    reader.onerror = () => {
        showToast("Unable to read this image.", "error");
    };

    reader.readAsDataURL(file);
}
// IMAGE CROP BUTTONS
function closeImageCropEditor() {
    document.getElementById("image-crop-modal").hidden = true;

    cropImage = null;
    cropOnSave = null;
    cropDragging = false;
}

document
    .getElementById("image-crop-cancel")
    ?.addEventListener("click", closeImageCropEditor);

document
    .getElementById("image-crop-save")
    ?.addEventListener("click", () => {
        if (!cropImage || !cropOnSave) return;

        const canvas = document.getElementById("image-crop-canvas");

        // Export the cropped image as a PNG.
        const croppedImage = canvas.toDataURL("image/png");

        const saveCallback = cropOnSave;

        closeImageCropEditor();

        saveCallback(croppedImage);
    });

let selectedLogoDataUrl = "";
let selectedBannerDataUrl = "";
let dashboardLogoDataUrl = "";

let currentView = "staff-home-view";

const expandedDepartments = new Set();


// ======================================================
// BASIC HELPERS
// ======================================================

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


function setValue(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.value = value ?? "";
    }
}


function setChecked(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.checked = value !== false;
    }
}


function getValue(id, fallback = "") {

    const element =
        document.getElementById(id);

    if (!element) {
        return fallback;
    }

    return element.value;
}


function getChecked(id, fallback = true) {

    const element =
        document.getElementById(id);

    if (!element) {
        return fallback;
    }

    return element.checked;
}


function getDepartment(departmentId) {

    return (latestData.departments || []).find(
        department =>
            department.id ===
            Number(departmentId)
    );
}


// ======================================================
// STAFF FETCH
// ======================================================

async function staffFetch(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                ...options,
                credentials: "same-origin"
            }
        );

    if (response.status === 401) {

        window.location.replace(
            "/staff-login.html"
        );

        throw new Error(
            "Staff login required."
        );
    }

    return response;
}


// ======================================================
// TOAST
// ======================================================

function showToast(
    message,
    type = "success"
) {

    const toast =
        document.getElementById("toast");

    if (!toast) {
        console.log(message);
        return;
    }

    toast.textContent = message;

    toast.className =
        `toast show ${type}`;

    clearTimeout(
        showToast.timer
    );

    showToast.timer =
        setTimeout(
            () => {
                toast.className = "toast";
            },
            3000
        );
}


// ======================================================
// LIVE CLOCK
// ======================================================

function updateClock() {

    const now = new Date();

    const time =
        now.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );

    const date =
        now.toLocaleDateString(
            [],
            {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );

    setText(
        "live-time",
        time
    );

    setText(
        "live-date",
        date
    );
}


updateClock();

setInterval(
    updateClock,
    1000
);


// ======================================================
// VIEW NAVIGATION
// ======================================================

function openView(viewId) {

    document
        .querySelectorAll(
            ".staff-view"
        )
        .forEach(
            view => {
                view.classList.remove(
                    "active"
                );
            }
        );


    const selectedView =
        document.getElementById(
            viewId
        );


    if (!selectedView) {
        return;
    }


    selectedView.classList.add(
        "active"
    );


    currentView = viewId;


    document
        .querySelectorAll(
            ".sidebar-nav-item"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.openView ===
                    viewId
                );

            }
        );


    document.body.classList.remove(
        "sidebar-open"
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    renderAll();


    if (
        viewId ===
        "customization-view"
    ) {

        loadPortalSettingsForm();
        loadDashboardCustomization();

    }
    if (
    viewId ===
    "website-settings-view"
) {

    renderWebsiteSettings();

}
}


document.addEventListener(
    "click",
    event => {

        const navigationButton =
            event.target.closest(
                "[data-open-view]"
            );

        if (!navigationButton) {
            return;
        }

        const targetView =
            navigationButton
                .dataset
                .openView;

        openView(
            targetView
        );
    }
);


// ======================================================
// SIDEBAR
// ======================================================

const mobileSidebarButton =
    document.getElementById(
        "mobile-sidebar-button"
    );

const sidebarClose =
    document.getElementById(
        "sidebar-close"
    );

const sidebarOverlay =
    document.getElementById(
        "sidebar-overlay"
    );


mobileSidebarButton
    ?.addEventListener(
        "click",
        () => {

            document.body.classList.add(
                "sidebar-open"
            );

        }
    );


sidebarClose
    ?.addEventListener(
        "click",
        () => {

            document.body.classList.remove(
                "sidebar-open"
            );

        }
    );


sidebarOverlay
    ?.addEventListener(
        "click",
        () => {

            document.body.classList.remove(
                "sidebar-open"
            );

        }
    );


document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Escape") {

            document.body.classList.remove(
                "sidebar-open"
            );

            closeDepartmentEditor();
        }
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
// LOAD SERVER DATA
// ======================================================

async function loadStaffDashboard() {

    try {

        const response =
            await staffFetch(
                "/api/data"
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Unable to load dashboard."
            );
        }


        latestData = data;

renderAll();

// On the first load, wait until the saved custom logo is decoded before revealing.
// Avoid displaying the built-in placeholder while the logo image is still loading.
if (document.documentElement.classList.contains("mq-brand-loading")) {
    const logos = ["dashboard-custom-logo", "sidebar-custom-logo"]
        .map(id => document.getElementById(id))
        .filter(img => img && img.style.display !== "none" && img.getAttribute("src"));
    await Promise.all(logos.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
        });
    }));
}

// Show dashboard after saved branding and logo are applied.
document.body.classList.remove("dashboard-loading");
document.documentElement.classList.remove("mq-brand-loading");
document.documentElement.classList.add("mq-brand-ready");

return data;

    } catch (error) {
        // An expired session redirects to login; never reveal an unbranded dashboard mid-redirect.
        if (String(error.message || "").includes("Staff login required")) return null;
        document.body.classList.remove("dashboard-loading");
        document.documentElement.classList.remove("mq-brand-loading");
        document.documentElement.classList.add("mq-brand-ready");

        console.error(
            "Unable to load MediQueue dashboard:",
            error
        );

        return null;
    }
}


// ======================================================
// RENDER EVERYTHING
// ======================================================

function renderAll() {

    renderBranding();

    applyDashboardCustomization(
        getDashboardSettings()
    );

    renderSummary();

    renderPortalControl();

    renderManagementDepartments();

    renderDepartmentLogoCustomization();

    renderWebsiteSettings();

    updateSidebarInformation();
}


// ======================================================
// BRANDING
// ======================================================

function renderBranding() {

    const settings =
        latestData.portalSettings || {};


    const systemName =
        settings.systemName ||
        "MediQueue";


    setText(
        "staff-system-name",
        systemName
    );


    setText(
        "staff-home-system-name",
        systemName
    );


    setText(
        "sidebar-system-name",
        systemName
    );


    document.title =
        `${systemName} - Staff Dashboard`;


    applyDashboardLogo();
}


// ======================================================
// DASHBOARD LOGO
// ======================================================

function applyDashboardLogo() {

    // ==================================================
    // STAFF TOPBAR LOGO
    // ==================================================

    const customLogo =
        document.getElementById(
            "dashboard-custom-logo"
        );

    const fallback =
        document.getElementById(
            "dashboard-logo-fallback"
        );


    // ==================================================
    // STAFF SIDEBAR LOGO
    // ==================================================

    const sidebarCustomLogo =
        document.getElementById(
            "sidebar-custom-logo"
        );

    const sidebarFallback =
        document.getElementById(
            "sidebar-logo-fallback"
        );


    // ==================================================
    // GLOBAL WEBSITE LOGO
    // ==================================================

    const websiteLogo =
        latestData
            .portalSettings
            ?.logoDataUrl ||
        "";


    // ==================================================
    // APPLY TO STAFF TOPBAR
    // ==================================================

    if (
        customLogo &&
        fallback
    ) {

        if (websiteLogo) {

            customLogo.src =
                websiteLogo;

            customLogo.style.display =
                "block";

            fallback.style.display =
                "none";

        } else {

            customLogo.removeAttribute(
                "src"
            );

            customLogo.style.display =
                "none";

            fallback.style.display =
                "flex";
        }
    }


    // ==================================================
    // APPLY TO STAFF SIDEBAR
    // ==================================================

    if (
        sidebarCustomLogo &&
        sidebarFallback
    ) {

        if (websiteLogo) {

            sidebarCustomLogo.src =
                websiteLogo;

            sidebarCustomLogo.style.display =
                "block";

            sidebarFallback.style.display =
                "none";

        } else {

            sidebarCustomLogo.removeAttribute(
                "src"
            );

            sidebarCustomLogo.style.display =
                "none";

            sidebarFallback.style.display =
                "flex";
        }
    }
}


// ======================================================
// SUMMARY
// ======================================================

function getQueueSummary() {

    const departments =
        latestData.departments || [];


    const totalWaiting =
        departments.reduce(
            (
                total,
                department
            ) =>
                total +
                (
                    department
                        .waiting
                        ?.length ||
                    0
                ),
            0
        );


    let busyRooms = 0;

    let availableRooms = 0;

    let openDepartments = 0;


    departments.forEach(
        department => {

            if (department.open) {
                openDepartments++;
            }


            (
                department.rooms ||
                []
            )
                .forEach(
                    room => {

                        if (
                            room.currentQueue
                        ) {

                            busyRooms++;

                        } else {

                            availableRooms++;
                        }
                    }
                );
        }
    );


    return {
        departments:
            departments.length,

        totalWaiting,

        busyRooms,

        availableRooms,

        openDepartments
    };
}


function renderSummary() {

    const summary =
        getQueueSummary();


    setText(
        "summary-departments",
        summary.departments
    );


    setText(
        "summary-waiting",
        summary.totalWaiting
    );


    setText(
        "summary-busy",
        summary.busyRooms
    );


    setText(
        "summary-available",
        summary.availableRooms
    );


    setText(
        "control-total-waiting",
        summary.totalWaiting
    );


    setText(
        "control-busy-rooms",
        summary.busyRooms
    );


    setText(
        "control-available-rooms",
        summary.availableRooms
    );


    setText(
        "control-open-departments",
        summary.openDepartments
    );
}


// ======================================================
// SIDEBAR LIVE INFORMATION
// ======================================================

function updateSidebarInformation() {

    const summary =
        getQueueSummary();


    setText(
        "sidebar-waiting-badge",
        summary.totalWaiting
    );


    setText(
        "sidebar-system-name",
        latestData
            .portalSettings
            ?.systemName ||
        "MediQueue"
    );
}


// ======================================================
// PATIENT PORTAL CONTROL
// ======================================================

function renderPortalControl() {

    const container =
        document.getElementById(
            "portal-control-departments"
        );


    if (!container) {
        return;
    }


    const departments =
        latestData.departments || [];


    if (!departments.length) {

        container.innerHTML = `
            <div class="empty-state">
                No departments have been created yet.
            </div>
        `;

        return;
    }


    container.innerHTML =
        departments
            .map(
                createPortalControlCard
            )
            .join("");
}


// ======================================================
// LIVE DEPARTMENT CARD
// ======================================================

function createPortalControlCard(
    department
) {

    const waiting =
        department.waiting || [];

    const rooms =
        department.rooms || [];

    const busyRooms =
        rooms.filter(
            room =>
                room.currentQueue
        ).length;

    const estimatedMinutes =
        Number(
            department
                .estimatedMinutes
        ) || 5;


    return `

        <article class="live-department-card">

            <div class="live-department-header">

                <div>

                    <div class="department-title-row">

                        <h3>
                            ${escapeHtml(
                                department.name
                            )}
                        </h3>

                        <span class="status-pill ${
                            department.open
                                ? "open"
                                : "closed"
                        }">

                            ${
                                department.open
                                    ? "OPEN"
                                    : "CLOSED"
                            }

                        </span>

                    </div>

                    <p>
                        Queue
                        ${escapeHtml(
                            department.prefix
                        )}
                        •
                        ${estimatedMinutes}
                        min / patient
                    </p>

                </div>


                <div class="live-department-number">

                    <span>
                        Waiting
                    </span>

                    <strong>
                        ${waiting.length}
                    </strong>

                </div>

            </div>


            <div class="live-operation-stats">

                <div>
                    <span>Waiting</span>
                    <strong>
                        ${waiting.length}
                    </strong>
                </div>

                <div>
                    <span>Busy Rooms</span>
                    <strong>
                        ${busyRooms}
                    </strong>
                </div>

                <div>
                    <span>Available</span>
                    <strong>
                        ${
                            rooms.length -
                            busyRooms
                        }
                    </strong>
                </div>

            </div>


            <div class="live-control-section">

                <div class="live-control-heading">
                    <h4>
                        Waiting Queue
                    </h4>
                </div>

                ${
                    waiting.length
                        ? createWaitingQueue(
                            department
                        )
                        : `
                            <div class="empty-state small-empty-state">
                                No patients waiting.
                            </div>
                        `
                }

            </div>


            <div class="live-control-section">

                <div class="live-control-heading">
                    <h4>
                        Rooms
                    </h4>
                </div>

                ${
                    rooms.length
                        ? createLiveRooms(
                            department
                        )
                        : `
                            <div class="empty-state small-empty-state">
                                No rooms configured.
                                Add rooms from Management.
                            </div>
                        `
                }

            </div>

        </article>
    `;
}


// ======================================================
// WAITING QUEUE
// ======================================================

function createWaitingQueue(
    department
) {

    const availableRooms =
        (
            department.rooms ||
            []
        )
            .filter(
                room =>
                    !room.currentQueue
            );


    return `

        <div class="live-waiting-list">

            ${
                (
                    department.waiting ||
                    []
                )
                    .map(
                        (
                            queueNumber,
                            index
                        ) => `

                    <div class="live-waiting-row">

                        <div class="waiting-patient-info">

                            <span class="waiting-position">
                                ${index + 1}
                            </span>

                            <strong>
                                ${escapeHtml(
                                    queueNumber
                                )}
                            </strong>

                            ${
                                index === 0
                                    ? `
                                        <span class="next-badge">
                                            NEXT
                                        </span>
                                    `
                                    : ""
                            }

                        </div>


                        <div class="waiting-patient-action">

                            <select
                                class="portal-room-select"
                                data-department-id="${department.id}"
                                data-queue-number="${escapeHtml(
                                    queueNumber
                                )}"
                            >

                                <option value="">
                                    Select Room
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
                                type="button"
                                class="button compact-button portal-assign-button"
                                data-department-id="${department.id}"
                                data-queue-number="${escapeHtml(
                                    queueNumber
                                )}"
                            >
                                Assign
                            </button>

                        </div>

                    </div>

                `
                    )
                    .join("")
            }

        </div>
    `;
}


// ======================================================
// LIVE ROOMS
// ======================================================

function createLiveRooms(
    department
) {

    return `

        <div class="live-room-grid">

            ${
                (
                    department.rooms ||
                    []
                )
                    .map(
                        room => `

                    <div class="live-room-card ${
                        room.currentQueue
                            ? "room-busy"
                            : "room-available"
                    }">

                        <div class="live-room-header">

                            <div>

                                <span>
                                    ROOM
                                </span>

                                <strong>
                                    ${escapeHtml(
                                        room.number
                                    )}
                                </strong>

                            </div>


                            <span class="status-pill ${
                                room.currentQueue
                                    ? "busy"
                                    : "available"
                            }">

                                ${
                                    room.currentQueue
                                        ? "BUSY"
                                        : "AVAILABLE"
                                }

                            </span>

                        </div>


                        ${
                            room.currentQueue
                                ? `

                                <div class="live-current-patient">

                                    <span>
                                        NOW SERVING
                                    </span>

                                    <strong>
                                        ${escapeHtml(
                                            room.currentQueue
                                        )}
                                    </strong>

                                </div>


                                <div class="live-room-actions">

                                    <button
                                        type="button"
                                        class="button secondary-button compact-button portal-recall-button"
                                        data-department-id="${department.id}"
                                        data-room="${escapeHtml(
                                            room.number
                                        )}"
                                    >
                                        🔔 Recall
                                    </button>


                                    <button
                                        type="button"
                                        class="button compact-button portal-complete-button"
                                        data-department-id="${department.id}"
                                        data-room="${escapeHtml(
                                            room.number
                                        )}"
                                    >
                                        ✓ Complete
                                    </button>

                                </div>

                            `
                                : `

                                <div class="live-room-ready">

                                    <span>
                                        Ready for next patient
                                    </span>


                                    <button
                                        type="button"
                                        class="button compact-button portal-call-next-button"
                                        data-department-id="${department.id}"
                                        data-room="${escapeHtml(
                                            room.number
                                        )}"
                                        ${
                                            department
                                                .waiting
                                                ?.length
                                                ? ""
                                                : "disabled"
                                        }
                                    >
                                        Call Next
                                    </button>

                                </div>

                            `
                        }

                    </div>

                `
                    )
                    .join("")
            }

        </div>
    `;
}


// ======================================================
// LIVE QUEUE BUTTON EVENTS
// ======================================================

document.addEventListener(
    "click",
    async event => {

        const assignButton =
            event.target.closest(
                ".portal-assign-button"
            );


        if (assignButton) {

            const departmentId =
                Number(
                    assignButton
                        .dataset
                        .departmentId
                );


            const queueNumber =
                assignButton
                    .dataset
                    .queueNumber;


            const row =
                assignButton.closest(
                    ".live-waiting-row"
                );


            const select =
                row?.querySelector(
                    ".portal-room-select"
                );


            const roomNumber =
                select?.value || "";


            if (!roomNumber) {

                showToast(
    "Please select an available room.",
    "warning"
);

                return;
            }


            await assignQueue(
                departmentId,
                queueNumber,
                roomNumber
            );

            return;
        }


        const callButton =
            event.target.closest(
                ".portal-call-next-button"
            );


        if (callButton) {

            await callNext(
                Number(
                    callButton
                        .dataset
                        .departmentId
                ),
                callButton.dataset.room
            );

            return;
        }


        const recallButton =
            event.target.closest(
                ".portal-recall-button"
            );


        if (recallButton) {

            await recallPatient(
                Number(
                    recallButton
                        .dataset
                        .departmentId
                ),
                recallButton.dataset.room
            );

            return;
        }


        const completeButton =
            event.target.closest(
                ".portal-complete-button"
            );


        if (completeButton) {

            await completePatient(
                Number(
                    completeButton
                        .dataset
                        .departmentId
                ),
                completeButton.dataset.room
            );

        }
    }
);


// ======================================================
// CALL NEXT
// ======================================================

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

            showToast(
    result.error || "Unable to call next patient.",
    "error"
);
            return;
        }


        showToast(
            `${result.queueNumber} called to ${result.room}.`
        );


        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        showToast(
    "Unable to call next patient.",
    "error"
);
    }
}


// ======================================================
// MANUAL ASSIGN
// ======================================================

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

            showToast(
    result.error || "Unable to assign patient.",
    "error"
);

            return;
        }


        showToast(
            `${result.queueNumber} → ${result.room}`
        );


        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        showToast(
    "Unable to assign patient.",
    "error"
);
    }
}


// ======================================================
// RECALL PATIENT
// ======================================================

async function recallPatient(
    departmentId,
    roomNumber
) {

    try {

        const response =
            await staffFetch(
                "/api/queue/recall",
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

            showToast(
    result.error || "Unable to recall patient.",
    "error"
);

            return;
        }


        showToast(
            `${result.queueNumber} recalled to ${result.room}.`
        );

    } catch (error) {

        console.error(error);

        showToast(
    "Unable to recall patient.",
    "error"
);
    }
}


// ======================================================
// COMPLETE PATIENT
// ======================================================

async function completePatient(
    departmentId,
    roomNumber
) {

    const confirmed = await mqConfirm(
    `Are you sure you want to complete the patient in Room ${roomNumber}?`,
    {
        title: "Complete Patient?",
        confirmText: "Complete Patient",
        icon: "✓",
        danger: false
    }
);


    if (!confirmed) {
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

            showToast(
    result.error || "Unable to complete patient.",
    "error"
);

            return;
        }


        showToast(
            `${result.completedQueue} completed.`
        );


        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        showToast(
    "Unable to complete patient.",
    "error"
);
    }
}
// ======================================================
// PART 2
// MANAGEMENT — DEPARTMENTS + ROOMS
// ======================================================


// ======================================================
// RENDER MANAGEMENT DEPARTMENTS
// ======================================================

function renderManagementDepartments() {

    const container =
        document.getElementById(
            "departments-container"
        );

    if (!container) {
        return;
    }

    const departments =
        latestData.departments || [];

    if (!departments.length) {

        container.innerHTML = `
            <div class="empty-state">
                No departments have been created yet.
            </div>
        `;

        return;
    }

    container.innerHTML =
        departments
            .map(
                createManagementDepartmentCard
            )
            .join("");
}


// ======================================================
// MANAGEMENT DEPARTMENT CARD
// ======================================================

function createManagementDepartmentCard(
    department
) {

    const waiting =
        department.waiting || [];

    const rooms =
        department.rooms || [];

    const estimatedMinutes =
        Number(
            department.estimatedMinutes
        ) || 5;

    const expanded =
        expandedDepartments.has(
            department.id
        );

    return `

        <article
            class="management-department-card"
            data-department-id="${department.id}"
        >

            <div class="management-department-header">

                <div class="management-department-title">

                    <div>

                        <div class="department-title-row">

                            <h3>
                                ${escapeHtml(
                                    department.name
                                )}
                            </h3>

                            <span
                                class="status-pill ${
                                    department.open
                                        ? "open"
                                        : "closed"
                                }"
                            >
                                ${
                                    department.open
                                        ? "OPEN"
                                        : "CLOSED"
                                }
                            </span>

                        </div>

                        <p>
                            Queue Prefix:
                            <strong>
                                ${escapeHtml(
                                    department.prefix
                                )}
                            </strong>
                            •
                            ${estimatedMinutes}
                            min / patient
                        </p>

                    </div>

                </div>


                <div class="management-header-actions">

                    <button
                        type="button"
                        class="button secondary-button compact-button edit-department-button"
                        data-department-id="${department.id}"
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        class="button danger-button compact-button delete-department-button"
                        data-department-id="${department.id}"
                    >
                        Delete
                    </button>

                    <button
                        type="button"
                        class="button secondary-button compact-button expand-department-button"
                        data-department-id="${department.id}"
                    >
                        ${expanded ? "Hide" : "Manage"}
                    </button>

                </div>

            </div>


            <div class="management-mini-stats">

                <div>
                    <span>Waiting</span>
                    <strong>
                        ${waiting.length}
                    </strong>
                </div>

                <div>
                    <span>Rooms</span>
                    <strong>
                        ${rooms.length}
                    </strong>
                </div>

                <div>
                    <span>Next Number</span>
                    <strong>
                        ${escapeHtml(
                            department.nextNumber || 1
                        )}
                    </strong>
                </div>

            </div>


            ${
                expanded
                    ? createExpandedDepartmentManagement(
                        department
                    )
                    : ""
            }

        </article>
    `;
}


// ======================================================
// EXPANDED MANAGEMENT
// ======================================================

function createExpandedDepartmentManagement(
    department
) {

    const rooms =
        department.rooms || [];

    return `

        <div class="management-expanded-area">

            <div class="management-expanded-section">

                <div class="management-subheading">

                    <div>
                        <h4>
                            Rooms
                        </h4>

                        <p>
                            Add, rename or delete
                            department rooms.
                        </p>
                    </div>

                </div>


                <form
                    class="add-room-form"
                    data-department-id="${department.id}"
                >

                    <input
                        type="text"
                        class="new-room-number"
                        placeholder="Example: Room 203"
                        maxlength="50"
                        required
                    >

                    <button
                        type="submit"
                        class="button compact-button"
                    >
                        + Add Room
                    </button>

                </form>


                <div class="management-room-list">

                    ${
                        rooms.length
                            ? rooms
                                .map(
                                    room =>
                                        createManagementRoomRow(
                                            department,
                                            room
                                        )
                                )
                                .join("")
                            : `
                                <div class="empty-state small-empty-state">
                                    No rooms configured.
                                </div>
                            `
                    }

                </div>

            </div>


            <div class="management-expanded-section danger-management-section">

                <div class="management-subheading">

                    <div>
                        <h4>
                            Queue Reset
                        </h4>

                        <p>
                            Clear the waiting queue,
                            completed numbers and
                            free every room.
                        </p>
                    </div>

                    <button
                        type="button"
                        class="button danger-button reset-queue-button"
                        data-department-id="${department.id}"
                    >
                        Reset Queue
                    </button>

                </div>

            </div>

        </div>
    `;
}


// ======================================================
// MANAGEMENT ROOM ROW
// ======================================================

function createManagementRoomRow(
    department,
    room
) {

    return `

        <div class="management-room-row">

            <div class="management-room-info">

                <span class="management-room-icon">
                    ▣
                </span>

                <div>

                    <strong>
                        ${escapeHtml(
                            room.number
                        )}
                    </strong>

                    <small>
                        ${
                            room.currentQueue
                                ? `Serving ${escapeHtml(
                                    room.currentQueue
                                )}`
                                : "Available"
                        }
                    </small>

                </div>

            </div>


            <div class="management-room-actions">

                <button
                    type="button"
                    class="button secondary-button compact-button rename-room-button"
                    data-department-id="${department.id}"
                    data-room="${escapeHtml(
                        room.number
                    )}"
                >
                    Rename
                </button>


                <button
                    type="button"
                    class="button danger-button compact-button delete-room-button"
                    data-department-id="${department.id}"
                    data-room="${escapeHtml(
                        room.number
                    )}"
                    ${
                        room.currentQueue
                            ? "disabled"
                            : ""
                    }
                >
                    Delete
                </button>

            </div>

        </div>
    `;
}


// ======================================================
// ADD DEPARTMENT
// ======================================================

document
    .getElementById(
        "add-department-form"
    )
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const name =
                getValue(
                    "new-department-name"
                )
                    .trim();

            const prefix =
                getValue(
                    "new-department-prefix"
                )
                    .trim()
                    .toUpperCase();

            const estimatedMinutes =
                Number(
                    getValue(
                        "new-department-minutes",
                        5
                    )
                );


            if (!name) {
    showToast(
        "Please enter a department name.",
        "warning"
    );
    return;
}



            if (!prefix) {

                showToast(
    "Please enter a queue prefix.",
    "warning"
);

                return;
            }

const confirmed = await mqConfirm(
    `Add "${name}" as a new department with queue prefix "${prefix}"?`,
    {
        title: "Add New Department?",
        confirmText: "Add Department",
        icon: "+",
        danger: false
    }
);

if (!confirmed) {
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
                                    prefix,
                                    estimatedMinutes
                                })
                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    showToast(
    result.error || "Unable to add department.",
    "error"
);

                    return;
                }


                event.target.reset();

                setValue(
                    "new-department-minutes",
                    5
                );


                showToast(
                    `${name} department added.`
                );


                await loadStaffDashboard();

            } catch (error) {

                console.error(error);

                showToast(
    "Unable to add department.",
    "error"
);
        }
    }
    );


// ======================================================
// MANAGEMENT CLICK EVENTS
// ======================================================

document.addEventListener(
    "click",
    async event => {

        const expandButton =
            event.target.closest(
                ".expand-department-button"
            );

        if (expandButton) {

            const departmentId =
                Number(
                    expandButton
                        .dataset
                        .departmentId
                );


            if (
                expandedDepartments.has(
                    departmentId
                )
            ) {

                expandedDepartments.delete(
                    departmentId
                );

            } else {

                expandedDepartments.add(
                    departmentId
                );
            }


            renderManagementDepartments();

            return;
        }


        const editButton =
            event.target.closest(
                ".edit-department-button"
            );

        if (editButton) {

            openDepartmentEditor(
                Number(
                    editButton
                        .dataset
                        .departmentId
                )
            );

            return;
        }


        const deleteDepartmentButton =
            event.target.closest(
                ".delete-department-button"
            );

        if (deleteDepartmentButton) {

            await deleteDepartment(
                Number(
                    deleteDepartmentButton
                        .dataset
                        .departmentId
                )
            );

            return;
        }


        const renameRoomButton =
            event.target.closest(
                ".rename-room-button"
            );

        if (renameRoomButton) {

            await renameRoom(
                Number(
                    renameRoomButton
                        .dataset
                        .departmentId
                ),
                renameRoomButton.dataset.room
            );

            return;
        }


        const deleteRoomButton =
            event.target.closest(
                ".delete-room-button"
            );

        if (deleteRoomButton) {

            await deleteRoom(
                Number(
                    deleteRoomButton
                        .dataset
                        .departmentId
                ),
                deleteRoomButton.dataset.room
            );

            return;
        }


        const resetQueueButton =
            event.target.closest(
                ".reset-queue-button"
            );

        if (resetQueueButton) {

            await resetQueue(
                Number(
                    resetQueueButton
                        .dataset
                        .departmentId
                )
            );

        }
    }
);


// ======================================================
// ADD ROOM
// ======================================================

document.addEventListener(
    "submit",
    async event => {

        const form =
            event.target.closest(
                ".add-room-form"
            );

        if (!form) {
            return;
        }


        event.preventDefault();


        const departmentId =
            Number(
                form.dataset.departmentId
            );


        const input =
            form.querySelector(
                ".new-room-number"
            );


        const roomNumber =
            input?.value.trim();


        if (!roomNumber) {

            showToast(
    "Please enter a room number.",
    "warning"
);

            return;
        }


        const confirmed = await mqConfirm(
    `Add Room ${roomNumber} to this department?`,
    {
        title: "Add New Room?",
        confirmText: "Add Room",
        icon: "+",
        danger: false
    }
);

if (!confirmed) {
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

                showToast(
    result.error || "Unable to add room.",
    "error"
);

                return;
            }


            input.value = "";


            expandedDepartments.add(
                departmentId
            );


            showToast(
                `${roomNumber} added.`
            );


            await loadStaffDashboard();

        } catch (error) {

            console.error(error);

            showToast(
    "Unable to add room.",
    "error"
);
        }
    }
);


// ======================================================
// OPEN DEPARTMENT EDITOR
// ======================================================

function openDepartmentEditor(
    departmentId
) {

    const department =
        getDepartment(
            departmentId
        );


    if (!department) {

        showToast(
    "Department not found.",
    "error"
);
        return;
    }


    setValue(
        "edit-department-id",
        department.id
    );


    setValue(
        "edit-department-name",
        department.name
    );


    setValue(
        "edit-department-prefix",
        department.prefix
    );


    setValue(
        "edit-department-minutes",
        department.estimatedMinutes || 5
    );


    setValue(
        "edit-department-status",
        department.open
            ? "open"
            : "closed"
    );


    const modal =
        document.getElementById(
            "department-edit-modal"
        );


    if (modal) {

        modal.style.display =
            "flex";

        document.body.classList.add(
            "modal-open"
        );
    }
}


// ======================================================
// CLOSE DEPARTMENT EDITOR
// ======================================================

function closeDepartmentEditor() {

    const modal =
        document.getElementById(
            "department-edit-modal"
        );


    if (modal) {

        modal.style.display =
            "none";
    }


    document.body.classList.remove(
        "modal-open"
    );
}


document
    .getElementById(
        "close-department-modal"
    )
    ?.addEventListener(
        "click",
        closeDepartmentEditor
    );


document
    .getElementById(
        "cancel-department-edit"
    )
    ?.addEventListener(
        "click",
        closeDepartmentEditor
    );


document
    .getElementById(
        "department-edit-modal"
    )
    ?.addEventListener(
        "click",
        event => {

            if (
                event.target.id ===
                "department-edit-modal"
            ) {

                closeDepartmentEditor();
            }
        }
    );


// ======================================================
// SAVE DEPARTMENT EDIT
// ======================================================

document
    .getElementById(
        "department-edit-form"
    )
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const departmentId =
                Number(
                    getValue(
                        "edit-department-id"
                    )
                );


            const name =
                getValue(
                    "edit-department-name"
                )
                    .trim();


            const prefix =
                getValue(
                    "edit-department-prefix"
                )
                    .trim()
                    .toUpperCase();


            const estimatedMinutes =
                Number(
                    getValue(
                        "edit-department-minutes",
                        5
                    )
                );


            const open =
                getValue(
                    "edit-department-status"
                ) === "open";


            if (
                !departmentId ||
                !name ||
                !prefix
            ) {

                showToast(
    "Please complete all department information.",
    "warning"
);

                return;
            }

            
            const confirmed = await mqConfirm(
    `Save changes to "${name}" with queue prefix "${prefix}"?`,
    {
        title: "Save Department Changes?",
        confirmText: "Save Changes",
        icon: "✎",
        danger: false
    }
);

if (!confirmed) {
    return;
}

            try {

                const response =
                    await staffFetch(
                        `/api/staff/departments/${departmentId}`,
                        {
                            method: "PUT",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    name,
                                    prefix,
                                    estimatedMinutes,
                                    open
                                })
                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    showToast(
    result.error || "Unable to update department.",
    "error"
);

                    return;
                }


                closeDepartmentEditor();


                showToast(
                    "Department updated."
                );


                await loadStaffDashboard();

            } catch (error) {

                console.error(error);

                showToast(
    "Unable to update department.",
    "error"
);
            }
        }
    );


// ======================================================
// DELETE DEPARTMENT
// ======================================================

async function deleteDepartment(
    departmentId
) {

    const department =
        getDepartment(
            departmentId
        );


    if (!department) {
        return;
    }


    const confirmed = await mqConfirm(
    `Delete "${department.name}"? This action cannot be undone.`,
    {
        title: "Delete Department?",
        confirmText: "Delete Department",
        icon: "!",
        danger: true
    }
);


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await staffFetch(
                `/api/staff/departments/${departmentId}`,
                {
                    method: "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            showToast(
    result.error || "Unable to delete department.",
    "error"
);

            return;
        }


        expandedDepartments.delete(
            departmentId
        );


        showToast(
            `${department.name} deleted.`
        );


        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        showToast(
    "Unable to delete department.",
    "error"
);
    }
}


// ======================================================
// RENAME ROOM
// ======================================================

async function renameRoom(
    departmentId,
    currentRoomNumber
) {

    const newRoomNumber = await mqPrompt(
    "Enter the new room name or number:",
    currentRoomNumber,
    {
        title: "Rename Room",
        confirmText: "Continue",
        placeholder: "Room name or number"
    }
);


    if (newRoomNumber === null) {
        return;
    }


    const cleanedRoomNumber =
        newRoomNumber.trim();


    if (!cleanedRoomNumber) {

        showToast(
    "Room name cannot be empty.",
    "warning"
);

        return;
    }


    if (
        cleanedRoomNumber ===
        currentRoomNumber
    ) {
        return;
    }


    try {

        const confirmed = await mqConfirm(
    `Rename Room "${currentRoomNumber}" to "${cleanedRoomNumber}"?`,
    {
        title: "Confirm Room Rename",
        confirmText: "Rename Room",
        icon: "✎",
        danger: false
    }
);

if (!confirmed) {
    return;
}


        const response =
            await staffFetch(
                `/api/staff/departments/${departmentId}/rooms/${encodeURIComponent(
                    currentRoomNumber
                )}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            newRoomNumber:
                                cleanedRoomNumber
                        })
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            showToast(
    result.error || "Unable to rename room.",
    "error"
);

            return;
        }


        expandedDepartments.add(
            departmentId
        );


        showToast(
            `${currentRoomNumber} renamed to ${cleanedRoomNumber}.`
        );


        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        showToast(
    "Unable to rename room.",
    "error"
);
    }
}


// ======================================================
// DELETE ROOM
// ======================================================

async function deleteRoom(
    departmentId,
    roomNumber
) {

    const confirmed = await mqConfirm(
    `Are you sure you want to delete Room ${roomNumber}?`,
    {
        title: "Delete Room?",
        confirmText: "Delete Room",
        icon: "!",
        danger: true
    }
);

    if (!confirmed) {
        return;
    }


    try {

        const response =
            await staffFetch(
                `/api/staff/departments/${departmentId}/rooms/${encodeURIComponent(
                    roomNumber
                )}`,
                {
                    method: "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            showToast(
    result.error || "Unable to delete room.",
    "error"
);

            return;
        }


        expandedDepartments.add(
            departmentId
        );


        showToast(
            `${roomNumber} deleted.`
        );


        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        showToast(
    "Unable to delete room.",
    "error"
);
    }
}


// ======================================================
// RESET QUEUE
// ======================================================

async function resetQueue(
    departmentId
) {

    const department =
        getDepartment(
            departmentId
        );


    if (!department) {
        return;
    }


    const confirmed = await mqConfirm(
    `Reset the entire "${department.name}" queue? Waiting patients will be cleared, completed numbers will be removed, and all rooms will become available.`,
    {
        title: "Reset Entire Queue?",
        confirmText: "Reset Queue",
        icon: "!",
        danger: true
    }
);


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await staffFetch(
                "/api/queue/reset",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            departmentId,
                            confirmReset: true
                        })
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            showToast(
    result.error || "Unable to reset queue.",
    "error"
);

            return;
        }


        expandedDepartments.add(
            departmentId
        );


        showToast(
            `${department.name} queue reset.`
        );


        await loadStaffDashboard();

    } catch (error) {

        console.error(error);

        showToast(
    "Unable to reset queue.",
    "error"
);
    }
}


// ======================================================
// PORTAL DESIGN DEFAULTS
// ======================================================

const DEFAULT_PORTAL_DESIGN = {

    systemName:
        "MediQueue",

    welcomeText:
        "Smart Hospital Queue Management System",

    announcement:
        "",

    logoDataUrl:
    "",

// Website Settings
autoThemeFromLogo:
    false,

bannerDataUrl:
    "",

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

    theme:
        "light",

    backgroundStyle:
        "medical",

    cardStyle:
        "soft",

    buttonStyle:
        "rounded",

    portalWidth:
        "normal",

    departmentLayout:
        "grid",

    queueButtonPosition:
        "bottom",

    textAlignment:
        "left",

    sectionOrder: [
        "welcome",
        "announcement",
        "departments",
        "ticket"
    ],

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

    buttonAnimation:
        true,

    cardAnimation:
        true,

    calledAnimation:
        true,

    patientCallSound:
        true,

    recallSound:
        true,

    notificationSoundStyle:
        "medical"
};


// ======================================================
// PORTAL FORM HELPERS
// ======================================================

function getPortalSettings() {

    return {
        ...DEFAULT_PORTAL_DESIGN,
        ...(latestData.portalSettings || {})
    };
}


function updateColorLabel(
    inputId,
    labelId
) {

    const input =
        document.getElementById(
            inputId
        );


    const label =
        document.getElementById(
            labelId
        );


    if (
        !input ||
        !label
    ) {
        return;
    }


    label.textContent =
        input.value.toUpperCase();
}


// ======================================================
// LOAD PORTAL DESIGNER
// ======================================================

function loadPortalSettingsForm() {

    const settings =
        getPortalSettings();


    setValue(
        "portal-system-name",
        settings.systemName
    );


    setValue(
        "portal-welcome-text",
        settings.welcomeText
    );


    setValue(
        "portal-announcement",
        settings.announcement
    );


    setValue(
        "portal-primary-color",
        settings.primaryColor
    );


    setValue(
        "portal-secondary-color",
        settings.secondaryColor
    );


    setValue(
        "portal-background-color",
        settings.backgroundColor
    );


    setValue(
        "portal-card-color",
        settings.cardColor
    );


    setValue(
        "portal-text-color",
        settings.textColor
    );


    setValue(
        "portal-button-text-color",
        settings.buttonTextColor
    );


    setValue(
        "portal-theme",
        settings.theme
    );


    setValue(
        "portal-background-style",
        settings.backgroundStyle
    );


    setValue(
        "portal-card-style",
        settings.cardStyle
    );


    setValue(
        "portal-button-style",
        settings.buttonStyle
    );


    setValue(
        "portal-width",
        settings.portalWidth
    );


    setValue(
        "portal-department-layout",
        settings.departmentLayout
    );


    setValue(
        "portal-queue-button-position",
        settings.queueButtonPosition
    );


    setValue(
        "portal-text-alignment",
        settings.textAlignment
    );


    setValue(
        "portal-notification-sound",
        settings.notificationSoundStyle
    );


    setChecked(
        "portal-show-welcome",
        settings.showWelcome
    );


    setChecked(
        "portal-show-announcement",
        settings.showAnnouncement
    );


    setChecked(
        "portal-show-connection",
        settings.showConnectionStatus
    );


    setChecked(
        "portal-show-waiting",
        settings.showWaitingCount
    );


    setChecked(
        "portal-show-estimated",
        settings.showEstimatedTime
    );


    setChecked(
        "portal-show-footer",
        settings.showFooter
    );


    setChecked(
        "portal-button-animation",
        settings.buttonAnimation
    );


    setChecked(
        "portal-card-animation",
        settings.cardAnimation
    );


    setChecked(
        "portal-called-animation",
        settings.calledAnimation
    );


    setChecked(
        "portal-patient-call-sound",
        settings.patientCallSound
    );


    setChecked(
        "portal-recall-sound",
        settings.recallSound
    );


    selectedLogoDataUrl =
        settings.logoDataUrl || "";


    selectedBannerDataUrl =
        settings.bannerDataUrl || "";


    updatePortalLogoPreview();

    updatePortalBannerPreview();


    updateColorLabel(
        "portal-primary-color",
        "primary-color-value"
    );


    updateColorLabel(
        "portal-secondary-color",
        "secondary-color-value"
    );


    updateColorLabel(
        "portal-background-color",
        "background-color-value"
    );


    updateColorLabel(
        "portal-card-color",
        "card-color-value"
    );


    updateColorLabel(
        "portal-text-color",
        "text-color-value"
    );


    updateColorLabel(
        "portal-button-text-color",
        "button-text-color-value"
    );


    setPortalSectionOrder(
        settings.sectionOrder
    );
}


// ======================================================
// PORTAL LOGO PREVIEW
// ======================================================

function updatePortalLogoPreview() {

    const container =
        document.getElementById(
            "portal-logo-preview-container"
        );


    const image =
        document.getElementById(
            "portal-logo-preview"
        );


    if (
        !container ||
        !image
    ) {
        return;
    }


    if (selectedLogoDataUrl) {

        image.src =
            selectedLogoDataUrl;

        container.style.display =
            "flex";

    } else {

        image.removeAttribute(
            "src"
        );

        container.style.display =
            "none";
    }
}


// ======================================================
// PORTAL BANNER PREVIEW
// ======================================================

function updatePortalBannerPreview() {

    const container =
        document.getElementById(
            "portal-banner-preview-container"
        );


    const image =
        document.getElementById(
            "portal-banner-preview"
        );


    if (
        !container ||
        !image
    ) {
        return;
    }


    if (selectedBannerDataUrl) {

        image.src =
            selectedBannerDataUrl;

        container.style.display =
            "flex";

    } else {

        image.removeAttribute(
            "src"
        );

        container.style.display =
            "none";
    }
}


// ======================================================
// COLOR LIVE VALUES
// ======================================================

[
    [
        "portal-primary-color",
        "primary-color-value"
    ],

    [
        "portal-secondary-color",
        "secondary-color-value"
    ],

    [
        "portal-background-color",
        "background-color-value"
    ],

    [
        "portal-card-color",
        "card-color-value"
    ],

    [
        "portal-text-color",
        "text-color-value"
    ],

    [
        "portal-button-text-color",
        "button-text-color-value"
    ]

].forEach(
    ([inputId, labelId]) => {

        document
            .getElementById(
                inputId
            )
            ?.addEventListener(
                "input",
                () => {

                    updateColorLabel(
                        inputId,
                        labelId
                    );
                }
            );
    }
);


// ======================================================
// IMAGE FILE READER
// ======================================================

function readImageFile(
    file,
    maxSize,
    callback
) {

    if (!file) {
        return;
    }


    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        showToast(
    "Please select an image file.",
    "warning"
);

        return;
    }


    if (
        file.size >
        maxSize
    ) {

        const sizeMb =
            (
                maxSize /
                1000000
            )
                .toFixed(1);


        showToast(
    `Please choose an image smaller than ${sizeMb} MB.`,
    "warning"
);

        return;
    }


    const reader =
        new FileReader();


    reader.onload =
        () => {

            callback(
                reader.result
            );
        };


    reader.readAsDataURL(
        file
    );
}


// ======================================================
// PORTAL LOGO UPLOAD
// ======================================================

document
    .getElementById(
        "portal-logo-input"
    )
    ?.addEventListener(
        "change",
        event => {

            const file =
                event.target
                    .files?.[0];


            readImageFile(
                file,
                1000000,
                result => {

                    selectedLogoDataUrl =
                        result;

                    updatePortalLogoPreview();
                }
            );
        }
    );


document
    .getElementById(
        "remove-logo-button"
    )
    ?.addEventListener(
        "click",
        () => {

            selectedLogoDataUrl = "";


            const input =
                document.getElementById(
                    "portal-logo-input"
                );


            if (input) {
                input.value = "";
            }


            updatePortalLogoPreview();
        }
    );


// ======================================================
// PORTAL BANNER UPLOAD
// ======================================================

document
    .getElementById(
        "portal-banner-input"
    )
    ?.addEventListener(
        "change",
        event => {

            const file =
                event.target
                    .files?.[0];


            readImageFile(
                file,
                1800000,
                result => {

                    selectedBannerDataUrl =
                        result;

                    updatePortalBannerPreview();
                }
            );
        }
    );


document
    .getElementById(
        "remove-banner-button"
    )
    ?.addEventListener(
        "click",
        () => {

            selectedBannerDataUrl = "";


            const input =
                document.getElementById(
                    "portal-banner-input"
                );


            if (input) {
                input.value = "";
            }


            updatePortalBannerPreview();
        }
    );


// ======================================================
// SECTION ORDER
// ======================================================

function getPortalSectionOrder() {

    const sorter =
        document.getElementById(
            "portal-section-sorter"
        );


    if (!sorter) {

        return [
            ...DEFAULT_PORTAL_DESIGN
                .sectionOrder
        ];
    }


    return [
        ...sorter.querySelectorAll(
            ".portal-sortable-item"
        )
    ]
        .map(
            item =>
                item.dataset.section
        )
        .filter(Boolean);
}


function setPortalSectionOrder(
    order
) {

    const sorter =
        document.getElementById(
            "portal-section-sorter"
        );


    if (!sorter) {
        return;
    }


    const safeOrder =
        Array.isArray(order)
            ? order
            : [
                ...DEFAULT_PORTAL_DESIGN
                    .sectionOrder
            ];


    const items =
        new Map();


    sorter
        .querySelectorAll(
            ".portal-sortable-item"
        )
        .forEach(
            item => {

                items.set(
                    item.dataset.section,
                    item
                );
            }
        );


    safeOrder.forEach(
        section => {

            const item =
                items.get(section);

            if (item) {

                sorter.appendChild(
                    item
                );

                items.delete(
                    section
                );
            }
        }
    );


    items.forEach(
        item => {

            sorter.appendChild(
                item
            );
        }
    );


    updateSectionOrderNumbers();
}


function updateSectionOrderNumbers() {

    document
        .querySelectorAll(
            "#portal-section-sorter .portal-sortable-item"
        )
        .forEach(
            (item, index) => {

                const number =
                    item.querySelector(
                        ".sort-order-number"
                    );


                if (number) {

                    number.textContent =
                        index + 1;
                }
            }
        );
}
// ======================================================
// PART 3
// PORTAL DESIGNER — DRAG & DROP + SAVE + RESET
// ======================================================


// ======================================================
// DRAG AND DROP SECTION ORDER
// ======================================================

let draggedPortalSection = null;


function initializePortalSectionDragDrop() {

    const sorter =
        document.getElementById(
            "portal-section-sorter"
        );

    if (!sorter) {
        return;
    }


    sorter
        .querySelectorAll(
            ".portal-sortable-item"
        )
        .forEach(
            item => {

                item.addEventListener(
                    "dragstart",
                    event => {

                        draggedPortalSection =
                            item;

                        item.classList.add(
                            "dragging"
                        );

                        if (
                            event.dataTransfer
                        ) {

                            event.dataTransfer
                                .effectAllowed =
                                "move";

                            event.dataTransfer
                                .setData(
                                    "text/plain",
                                    item.dataset
                                        .section ||
                                    ""
                                );
                        }
                    }
                );


                item.addEventListener(
                    "dragend",
                    () => {

                        item.classList.remove(
                            "dragging"
                        );

                        draggedPortalSection =
                            null;

                        updateSectionOrderNumbers();
                    }
                );


                item.addEventListener(
                    "dragover",
                    event => {

                        event.preventDefault();

                        if (
                            !draggedPortalSection ||
                            draggedPortalSection ===
                            item
                        ) {
                            return;
                        }


                        const rect =
                            item.getBoundingClientRect();


                        const middle =
                            rect.top +
                            rect.height / 2;


                        if (
                            event.clientY <
                            middle
                        ) {

                            sorter.insertBefore(
                                draggedPortalSection,
                                item
                            );

                        } else {

                            sorter.insertBefore(
                                draggedPortalSection,
                                item.nextSibling
                            );
                        }


                        updateSectionOrderNumbers();
                    }
                );
            }
        );


    sorter.addEventListener(
        "dragover",
        event => {

            event.preventDefault();
        }
    );


    sorter.addEventListener(
        "drop",
        event => {

            event.preventDefault();

            updateSectionOrderNumbers();
        }
    );
}


// ======================================================
// COLLECT PORTAL DESIGN SETTINGS
// ======================================================

function collectPortalDesignSettings() {

    return {

        systemName:
            getValue(
                "portal-system-name",
                "MediQueue"
            )
                .trim(),

        welcomeText:
            getValue(
                "portal-welcome-text",
                ""
            )
                .trim(),

        announcement:
            getValue(
                "portal-announcement",
                ""
            )
                .trim(),

        logoDataUrl:
            selectedLogoDataUrl,

        bannerDataUrl:
            selectedBannerDataUrl,

        primaryColor:
            getValue(
                "portal-primary-color",
                "#0F9D8A"
            ),

        secondaryColor:
            getValue(
                "portal-secondary-color",
                "#17324D"
            ),

        backgroundColor:
            getValue(
                "portal-background-color",
                "#F4FBF9"
            ),

        cardColor:
            getValue(
                "portal-card-color",
                "#FFFFFF"
            ),

        textColor:
            getValue(
                "portal-text-color",
                "#17324D"
            ),

        buttonTextColor:
            getValue(
                "portal-button-text-color",
                "#FFFFFF"
            ),

        theme:
            getValue(
                "portal-theme",
                "light"
            ),

        backgroundStyle:
            getValue(
                "portal-background-style",
                "medical"
            ),

        cardStyle:
            getValue(
                "portal-card-style",
                "soft"
            ),

        buttonStyle:
            getValue(
                "portal-button-style",
                "rounded"
            ),

        portalWidth:
            getValue(
                "portal-width",
                "normal"
            ),

        departmentLayout:
            getValue(
                "portal-department-layout",
                "grid"
            ),

        queueButtonPosition:
            getValue(
                "portal-queue-button-position",
                "bottom"
            ),

        textAlignment:
            getValue(
                "portal-text-alignment",
                "left"
            ),

        sectionOrder:
            getPortalSectionOrder(),

        showWelcome:
            getChecked(
                "portal-show-welcome",
                true
            ),

        showAnnouncement:
            getChecked(
                "portal-show-announcement",
                true
            ),

        showConnectionStatus:
            getChecked(
                "portal-show-connection",
                true
            ),

        showWaitingCount:
            getChecked(
                "portal-show-waiting",
                true
            ),

        showEstimatedTime:
            getChecked(
                "portal-show-estimated",
                true
            ),

        showFooter:
            getChecked(
                "portal-show-footer",
                true
            ),

        buttonAnimation:
            getChecked(
                "portal-button-animation",
                true
            ),

        cardAnimation:
            getChecked(
                "portal-card-animation",
                true
            ),

        calledAnimation:
            getChecked(
                "portal-called-animation",
                true
            ),

        patientCallSound:
            getChecked(
                "portal-patient-call-sound",
                true
            ),

        recallSound:
            getChecked(
                "portal-recall-sound",
                true
            ),

        notificationSoundStyle:
            getValue(
                "portal-notification-sound",
                "medical"
            )
    };
}


// ======================================================
// SAVE PATIENT PORTAL DESIGN
// ======================================================

document
    .getElementById(
        "portal-settings-form"
    )
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const settings =
                collectPortalDesignSettings();


            if (!settings.systemName) {

                showToast(
    "Please enter the System / Hospital Name.",
    "warning"
);

                return;
            }


            try {

                const response =
                    await staffFetch(
                        "/api/staff/portal-settings",
                        {
                            method: "PUT",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify(
                                    settings
                                )
                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    showToast(
    result.error || "Unable to save Patient Portal design.",
    "error"
);

                    return;
                }


                if (
                    result.portalSettings
                ) {

                    latestData.portalSettings =
                        result.portalSettings;

                } else {

                    latestData.portalSettings =
                        settings;
                }


                renderBranding();


                showToast(
                    "Patient Portal design saved."
                );


                await loadStaffDashboard();


                loadPortalSettingsForm();

            } catch (error) {

                console.error(
                    "Portal design save error:",
                    error
                );


                showToast(
    "Unable to save Patient Portal design.",
    "error"
);
            }
        }
    );


// ======================================================
// RESET PATIENT PORTAL DESIGN
// ======================================================

document
    .getElementById(
        "reset-portal-design-button"
    )
    ?.addEventListener(
        "click",
        async () => {

            const confirmed = await mqConfirm(
    "Reset the Patient Portal to the default MediQueue design? Your current design settings will be replaced.",
    {
        title: "Reset Patient Portal Design?",
        confirmText: "Reset Design",
        icon: "!",
        danger: true
    }
);


            if (!confirmed) {
                return;
            }


            try {

                const response =
                    await staffFetch(
                        "/api/staff/portal-settings/reset",
                        {
                            method: "POST"
                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    showToast(
    result.error || "Unable to reset Patient Portal design.",
    "error"
);
                    return;
                }


                selectedLogoDataUrl = "";

                selectedBannerDataUrl = "";


                const logoInput =
                    document.getElementById(
                        "portal-logo-input"
                    );


                const bannerInput =
                    document.getElementById(
                        "portal-banner-input"
                    );


                if (logoInput) {
                    logoInput.value = "";
                }


                if (bannerInput) {
                    bannerInput.value = "";
                }


                if (
                    result.portalSettings
                ) {

                    latestData.portalSettings =
                        result.portalSettings;

                } else {

                    latestData.portalSettings = {
                        ...DEFAULT_PORTAL_DESIGN
                    };
                }


                loadPortalSettingsForm();

                renderAll();


                showToast(
                    "Patient Portal design reset."
                );


                await loadStaffDashboard();

            } catch (error) {

                console.error(
                    "Portal reset error:",
                    error
                );


                showToast(
    "Unable to reset Patient Portal design.",
    "error"
);
            }
        }
    );


// ======================================================
// PORTAL DESIGNER LIVE FORM FEEDBACK
// ======================================================

function updatePortalDesignerPreviewVariables() {

    const root =
        document.documentElement;


    root.style.setProperty(
        "--portal-preview-primary",
        getValue(
            "portal-primary-color",
            "#0F9D8A"
        )
    );


    root.style.setProperty(
        "--portal-preview-secondary",
        getValue(
            "portal-secondary-color",
            "#17324D"
        )
    );


    root.style.setProperty(
        "--portal-preview-background",
        getValue(
            "portal-background-color",
            "#F4FBF9"
        )
    );


    root.style.setProperty(
        "--portal-preview-card",
        getValue(
            "portal-card-color",
            "#FFFFFF"
        )
    );


    root.style.setProperty(
        "--portal-preview-text",
        getValue(
            "portal-text-color",
            "#17324D"
        )
    );
}


[
    "portal-primary-color",
    "portal-secondary-color",
    "portal-background-color",
    "portal-card-color",
    "portal-text-color",
    "portal-button-text-color"

].forEach(
    id => {

        document
            .getElementById(id)
            ?.addEventListener(
                "input",
                updatePortalDesignerPreviewVariables
            );
    }
);


// ======================================================
// DASHBOARD CUSTOMIZATION
// ======================================================

const DASHBOARD_SETTINGS_KEY =
    "mediqueue_dashboard_customization";


function getDashboardSettings() {

    try {

        const saved =
            localStorage.getItem(
                DASHBOARD_SETTINGS_KEY
            );


        if (!saved) {
            return {};
        }


        return JSON.parse(
            saved
        );

    } catch (error) {

        console.error(
            "Dashboard settings error:",
            error
        );

        return {};
    }
}


function saveDashboardSettings(
    settings
) {

    try {

        localStorage.setItem(
            DASHBOARD_SETTINGS_KEY,
            JSON.stringify(
                settings
            )
        );

    } catch (error) {

        console.error(
            "Unable to save dashboard settings:",
            error
        );
    }
}


// ======================================================
// LOAD DASHBOARD CUSTOMIZATION
// ======================================================

function loadDashboardCustomization() {

    const settings =
        getDashboardSettings();


    setValue(
        "dashboard-theme",
        settings.theme ||
        "light"
    );


    setValue(
        "dashboard-primary-color",
        settings.primaryColor ||
        "#0F9D8A"
    );


    setValue(
        "dashboard-background-color",
        settings.backgroundColor ||
        "#F3F8F8"
    );


    setText(
        "dashboard-primary-color-value",
        settings.primaryColor ||
        "#0F9D8A"
    );


    setText(
        "dashboard-background-color-value",
        settings.backgroundColor ||
        "#F3F8F8"
    );


    setChecked(
        "button-animation-toggle",
        settings.buttonAnimation !==
        false
    );


    setChecked(
        "card-animation-toggle",
        settings.cardAnimation !==
        false
    );


    setValue(
        "button-style",
        settings.buttonStyle ||
        "rounded"
    );


    setChecked(
        "patient-call-sound-toggle",
        settings.patientCallSound !==
        false
    );


    setChecked(
        "recall-sound-toggle",
        settings.recallSound !==
        false
    );


    setValue(
        "notification-sound-style",
        settings.soundStyle ||
        "medical"
    );


    dashboardLogoDataUrl =
        settings.dashboardLogo ||
        "";


    applyDashboardCustomization(
        settings
    );
}


// ======================================================
// APPLY DASHBOARD CUSTOMIZATION
// ======================================================

function applyDashboardCustomization(
    settings
) {

    const root =
        document.documentElement;

    const body =
        document.body;


    // ==========================================
    // GLOBAL WEBSITE SETTINGS
    // ==========================================

    const websiteSettings =
        getPortalSettings();

    const automaticWebsiteTheme =
        websiteSettings.autoThemeFromLogo === true;


    // ==========================================
    // CHOOSE COLORS
    // ==========================================

    const primaryColor =
        automaticWebsiteTheme
            ? (
                websiteSettings.primaryColor ||
                "#0F9D8A"
            )
            : (
                settings.primaryColor ||
                "#0F9D8A"
            );


    const secondaryColor =
        automaticWebsiteTheme
            ? (
                websiteSettings.secondaryColor ||
                "#17324D"
            )
            : "#17324D";


    const backgroundColor =
        settings.backgroundColor ||
        "#F3F8F8";


    // ==========================================
    // APPLY STAFF DASHBOARD COLORS
    // ==========================================

    root.style.setProperty(
        "--dashboard-primary",
        primaryColor
    );

    root.style.setProperty(
        "--teal",
        primaryColor
    );

    root.style.setProperty(
        "--mq-primary",
        primaryColor
    );

    root.style.setProperty(
        "--mq-navy",
        secondaryColor
    );

    root.style.setProperty(
        "--dashboard-secondary",
        secondaryColor
    );

    root.style.setProperty(
        "--dashboard-background",
        backgroundColor
    );


    // ==========================================
    // AUTO THEME STATE
    // ==========================================

    body.classList.toggle(
        "website-auto-theme-enabled",
        automaticWebsiteTheme
    );

    body.dataset.websiteAutoTheme =
        automaticWebsiteTheme
            ? "true"
            : "false";


    // ==========================================
    // KEEP EXISTING DASHBOARD CUSTOMIZATION
    // ==========================================

    body.style.background =
        backgroundColor;


    body.dataset.dashboardTheme =
        settings.theme ||
        "light";


    body.dataset.buttonStyle =
        settings.buttonStyle ||
        "rounded";


    body.classList.toggle(
        "disable-button-animation",
        settings.buttonAnimation === false
    );


    body.classList.toggle(
        "disable-card-animation",
        settings.cardAnimation === false
    );


    // ==========================================
    // GLOBAL WEBSITE LOGO
    // ==========================================

    applyDashboardLogo();
}


// ======================================================
// DASHBOARD COLOR LIVE PREVIEW
// ======================================================

document
    .getElementById(
        "dashboard-primary-color"
    )
    ?.addEventListener(
        "input",
        event => {

            setText(
                "dashboard-primary-color-value",
                event.target.value
                    .toUpperCase()
            );


            document
                .documentElement
                .style
                .setProperty(
                    "--dashboard-primary",
                    event.target.value
                );


            document
                .documentElement
                .style
                .setProperty(
                    "--teal",
                    event.target.value
                );
        }
    );


document
    .getElementById(
        "dashboard-background-color"
    )
    ?.addEventListener(
        "input",
        event => {

            setText(
                "dashboard-background-color-value",
                event.target.value
                    .toUpperCase()
            );


            document.body.style.background =
                event.target.value;
        }
    );


// ======================================================
// DASHBOARD THEME LIVE PREVIEW
// ======================================================

document
    .getElementById(
        "dashboard-theme"
    )
    ?.addEventListener(
        "change",
        event => {

            document.body.dataset
                .dashboardTheme =
                event.target.value;
        }
    );


document
    .getElementById(
        "button-style"
    )
    ?.addEventListener(
        "change",
        event => {

            document.body.dataset
                .buttonStyle =
                event.target.value;
        }
    );


document
    .getElementById(
        "button-animation-toggle"
    )
    ?.addEventListener(
        "change",
        event => {

            document.body.classList.toggle(
                "disable-button-animation",
                !event.target.checked
            );
        }
    );


document
    .getElementById(
        "card-animation-toggle"
    )
    ?.addEventListener(
        "change",
        event => {

            document.body.classList.toggle(
                "disable-card-animation",
                !event.target.checked
            );
        }
    );


// ======================================================
// DASHBOARD LOGO UPLOAD
// ======================================================

document
    .getElementById(
        "dashboard-logo-input"
    )
    ?.addEventListener(
        "change",
        event => {

            const file =
                event.target
                    .files?.[0];


            readImageFile(
                file,
                1000000,
                result => {

                    dashboardLogoDataUrl =
                        result;


                    const customLogo =
                        document.getElementById(
                            "dashboard-custom-logo"
                        );


                    const fallback =
                        document.getElementById(
                            "dashboard-logo-fallback"
                        );


                    if (
                        customLogo &&
                        fallback
                    ) {

                        customLogo.src =
                            dashboardLogoDataUrl;

                        customLogo.style.display =
                            "block";

                        fallback.style.display =
                            "none";
                    }
                }
            );
        }
    );


// ======================================================
// SAVE DASHBOARD CUSTOMIZATION
// ======================================================

document
    .getElementById(
        "save-dashboard-customization"
    )
    ?.addEventListener(
        "click",
        () => {

            const previous =
                getDashboardSettings();


            const settings = {

                theme:
                    getValue(
                        "dashboard-theme",
                        "light"
                    ),

                primaryColor:
                    getValue(
                        "dashboard-primary-color",
                        "#0F9D8A"
                    ),

                backgroundColor:
                    getValue(
                        "dashboard-background-color",
                        "#F3F8F8"
                    ),

                buttonAnimation:
                    getChecked(
                        "button-animation-toggle",
                        true
                    ),

                cardAnimation:
                    getChecked(
                        "card-animation-toggle",
                        true
                    ),

                buttonStyle:
                    getValue(
                        "button-style",
                        "rounded"
                    ),

                patientCallSound:
                    getChecked(
                        "patient-call-sound-toggle",
                        true
                    ),

                recallSound:
                    getChecked(
                        "recall-sound-toggle",
                        true
                    ),

                soundStyle:
                    getValue(
                        "notification-sound-style",
                        "medical"
                    ),

                dashboardLogo:
                    dashboardLogoDataUrl ||
                    previous.dashboardLogo ||
                    ""
            };


            saveDashboardSettings(
                settings
            );


            applyDashboardCustomization(
                settings
            );


            showToast(
                "Dashboard customization saved."
            );
        }
    );


// ======================================================
// RESET DASHBOARD CUSTOMIZATION
// ======================================================

document
    .getElementById(
        "reset-customization-button"
    )
    ?.addEventListener(
        "click",
        async () => {

            const confirmed = await mqConfirm(
    "Reset the Staff Dashboard appearance to the default MediQueue design? Your current appearance settings will be removed.",
    {
        title: "Reset Dashboard Appearance?",
        confirmText: "Reset Appearance",
        icon: "!",
        danger: true
    }
);


            if (!confirmed) {
                return;
            }


            localStorage.removeItem(
                DASHBOARD_SETTINGS_KEY
            );


            dashboardLogoDataUrl = "";


            document.body.removeAttribute(
                "data-dashboard-theme"
            );


            document.body.removeAttribute(
                "data-button-style"
            );


            document.body.classList.remove(
                "disable-button-animation",
                "disable-card-animation"
            );


            document.body.style.background =
                "";


            document
                .documentElement
                .style
                .removeProperty(
                    "--dashboard-primary"
                );


            document
                .documentElement
                .style
                .removeProperty(
                    "--dashboard-background"
                );


            document
                .documentElement
                .style
                .removeProperty(
                    "--teal"
                );


            const customLogo =
                document.getElementById(
                    "dashboard-custom-logo"
                );


            if (customLogo) {

                customLogo.removeAttribute(
                    "src"
                );

                customLogo.style.display =
                    "none";
            }


            const dashboardLogoInput =
                document.getElementById(
                    "dashboard-logo-input"
                );


            if (dashboardLogoInput) {

                dashboardLogoInput.value =
                    "";
            }


            loadDashboardCustomization();

            renderBranding();


            showToast(
                "Dashboard appearance reset."
            );
        }
    );
    // ======================================================
// PART 4 — FINAL
// SOUNDS + SOCKET.IO + INITIALIZATION
// ======================================================


// ======================================================
// SOUND SYSTEM
// ======================================================

let staffAudioContext = null;


function getStaffAudioContext() {

    if (staffAudioContext) {
        return staffAudioContext;
    }


    const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;


    if (!AudioContextClass) {
        return null;
    }


    staffAudioContext =
        new AudioContextClass();


    return staffAudioContext;
}


// ======================================================
// CREATE TONE
// ======================================================

function createStaffTone(
    frequency,
    startTime,
    duration,
    volume = 0.08,
    type = "sine"
) {

    const context =
        getStaffAudioContext();


    if (!context) {
        return;
    }


    const oscillator =
        context.createOscillator();


    const gain =
        context.createGain();


    oscillator.type =
        type;


    oscillator.frequency.setValueAtTime(
        frequency,
        startTime
    );


    gain.gain.setValueAtTime(
        0.0001,
        startTime
    );


    gain.gain.exponentialRampToValueAtTime(
        Math.max(
            volume,
            0.001
        ),
        startTime + 0.02
    );


    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + duration
    );


    oscillator.connect(
        gain
    );


    gain.connect(
        context.destination
    );


    oscillator.start(
        startTime
    );


    oscillator.stop(
        startTime + duration + 0.05
    );
}


// ======================================================
// PLAY STAFF NOTIFICATION SOUND
// ======================================================

async function playStaffNotificationSound(
    style = "medical",
    stronger = false
) {

    try {

        const context =
            getStaffAudioContext();


        if (!context) {
            return;
        }


        if (
            context.state ===
            "suspended"
        ) {

            await context.resume();
        }


        const now =
            context.currentTime +
            0.02;


        if (style === "soft") {

            createStaffTone(
                523.25,
                now,
                0.18,
                stronger
                    ? 0.11
                    : 0.07
            );


            createStaffTone(
                659.25,
                now + 0.20,
                0.25,
                stronger
                    ? 0.11
                    : 0.07
            );


            return;
        }


        if (style === "digital") {

            createStaffTone(
                880,
                now,
                0.10,
                stronger
                    ? 0.10
                    : 0.07,
                "square"
            );


            createStaffTone(
                1174.66,
                now + 0.13,
                0.10,
                stronger
                    ? 0.10
                    : 0.07,
                "square"
            );


            if (stronger) {

                createStaffTone(
                    880,
                    now + 0.28,
                    0.12,
                    0.10,
                    "square"
                );
            }


            return;
        }


        // Medical chime

        createStaffTone(
            659.25,
            now,
            0.18,
            stronger
                ? 0.11
                : 0.075
        );


        createStaffTone(
            783.99,
            now + 0.18,
            0.18,
            stronger
                ? 0.11
                : 0.075
        );


        createStaffTone(
            1046.50,
            now + 0.36,
            0.28,
            stronger
                ? 0.11
                : 0.075
        );


        if (stronger) {

            createStaffTone(
                783.99,
                now + 0.72,
                0.18,
                0.09
            );


            createStaffTone(
                1046.50,
                now + 0.90,
                0.28,
                0.09
            );
        }

    } catch (error) {

        console.warn(
            "Unable to play sound:",
            error
        );
    }
}


// ======================================================
// PREVIEW DASHBOARD SOUND
// ======================================================

document
    .getElementById(
        "preview-notification-sound"
    )
    ?.addEventListener(
        "click",
        async () => {

            const style =
                getValue(
                    "notification-sound-style",
                    "medical"
                );


            await playStaffNotificationSound(
                style,
                false
            );
        }
    );


// ======================================================
// STAFF SOUND SETTINGS
// ======================================================

function getStaffSoundSettings() {

    const settings =
        getDashboardSettings();


    return {

        patientCallSound:
            settings.patientCallSound !==
            false,

        recallSound:
            settings.recallSound !==
            false,

        soundStyle:
            settings.soundStyle ||
            "medical"
    };
}


// ======================================================
// SOCKET.IO
// ======================================================

if (socket) {

    socket.on(
        "connect",
        () => {

            console.log(
                "MediQueue Socket.IO connected."
            );


            setConnectionStatus(
                true
            );
        }
    );


    socket.on(
        "disconnect",
        () => {

            console.log(
                "MediQueue Socket.IO disconnected."
            );


            setConnectionStatus(
                false
            );
        }
    );


    socket.on(
        "connect_error",
        error => {

            console.warn(
                "Socket.IO connection error:",
                error
            );


            setConnectionStatus(
                false
            );
        }
    );


    // --------------------------------------------------
    // SERVER QUEUE UPDATE
    // --------------------------------------------------

    socket.on(
        "queue:update",
        data => {

            if (!data) {
                return;
            }


            latestData = data;


            renderAll();


            if (
                currentView ===
                "customization-view"
            ) {

                loadPortalSettingsForm();
            }
        }
    );


    // --------------------------------------------------
    // PATIENT CALLED / RECALLED
    // --------------------------------------------------

    socket.on(
        "patient:called",
        async payload => {

            if (!payload) {
                return;
            }


            const settings =
                getStaffSoundSettings();


            const type =
                payload.type ||
                "call";


            if (
                type === "recall"
            ) {

                if (
                    settings.recallSound
                ) {

                    await playStaffNotificationSound(
                        settings.soundStyle,
                        true
                    );
                }


                showToast(
                    `${payload.queueNumber || "Patient"} recalled${
                        payload.room
                            ? ` to ${payload.room}`
                            : ""
                    }.`,
                    "success"
                );


                return;
            }


            if (
                settings.patientCallSound
            ) {

                await playStaffNotificationSound(
                    settings.soundStyle,
                    false
                );
            }


            showToast(
                `${payload.queueNumber || "Patient"} called${
                    payload.room
                        ? ` to ${payload.room}`
                        : ""
                }.`,
                "success"
            );
        }
    );
}


// ======================================================
// FALLBACK DATA REFRESH
// ======================================================

setInterval(
    async () => {

        if (
            socket &&
            socket.connected
        ) {
            return;
        }


        await loadStaffDashboard();

    },
    15000
);


// ======================================================
// INITIALIZE AUDIO AFTER USER INTERACTION
// ======================================================

function unlockStaffAudio() {

    try {

        const context =
            getStaffAudioContext();


        if (
            context &&
            context.state ===
            "suspended"
        ) {

            context.resume();
        }

    } catch (error) {

        console.warn(
            "Audio unlock failed:",
            error
        );
    }


    document.removeEventListener(
        "click",
        unlockStaffAudio
    );


    document.removeEventListener(
        "touchstart",
        unlockStaffAudio
    );
}


document.addEventListener(
    "click",
    unlockStaffAudio
);


document.addEventListener(
    "touchstart",
    unlockStaffAudio
);


// ======================================================
// INITIALIZE PORTAL DESIGNER
// ======================================================

function initializePortalDesigner() {

    initializePortalSectionDragDrop();


    updatePortalDesignerPreviewVariables();


    updateSectionOrderNumbers();
}


// ======================================================
// INITIALIZE DASHBOARD
// ======================================================

async function initializeMediQueueStaff() {

    console.log(
        "Starting MediQueue Staff Dashboard V4..."
    );


    setConnectionStatus(
        socket
            ? socket.connected
            : false
    );


    loadDashboardCustomization();


    initializePortalDesigner();


    const data =
        await loadStaffDashboard();


    if (data) {

        loadPortalSettingsForm();

        updatePortalDesignerPreviewVariables();
    }


    openView(
        "staff-home-view"
    );


    console.log(
        "MediQueue Staff Dashboard V4 ready."
    );
}


// ======================================================
// START
// ======================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeMediQueueStaff
    );

} else {

    initializeMediQueueStaff();
}






// ======================================================
// DEPARTMENT LOGO CUSTOMIZATION
// ======================================================

function renderDepartmentLogoCustomization() {

    const container =
        document.getElementById(
            "department-logo-customization-container"
        );

    if (!container) {
        return;
    }


    const departments =
        latestData.departments || [];


    if (!departments.length) {

        container.innerHTML = `
            <div class="empty-state">
                No departments have been created yet.
            </div>
        `;

        return;
    }


    container.innerHTML =
        departments
            .map(
                department =>
                    createDepartmentLogoCard(
                        department
                    )
            )
            .join("");
}



// ======================================================
// CREATE DEPARTMENT LOGO CARD
// ======================================================

function createDepartmentLogoCard(
    department
) {

    const hasCustomLogo =
        typeof department.logoDataUrl ===
            "string" &&
        department.logoDataUrl.startsWith(
            "data:image/"
        );


    const preview =
        hasCustomLogo

            ? `
                <img
                    src="${department.logoDataUrl}"
                    alt="${escapeHtml(
                        department.name
                    )} Logo"
                    class="department-logo-preview-image"
                >
            `

            : `
                <div class="department-logo-auto-preview">
                    ${getStaffDepartmentIcon(
                        department.name
                    )}
                </div>
            `;


    return `

        <article
            class="department-logo-card"
            data-department-id="${department.id}"
        >

            <div class="department-logo-card-top">

                <div class="department-logo-preview">

                    ${preview}

                </div>


                <div class="department-logo-card-info">

                    <h3>
                        ${escapeHtml(
                            department.name
                        )}
                    </h3>

                    <p>
                        Queue ${escapeHtml(
                            department.prefix
                        )}
                    </p>


                    <span
                        class="department-logo-status ${
                            hasCustomLogo
                                ? "custom"
                                : "automatic"
                        }"
                    >

                        ${
                            hasCustomLogo
                                ? "Custom Logo"
                                : "Automatic Icon"
                        }

                    </span>

                </div>

            </div>


            <div class="department-logo-card-actions">

                <input
                    type="file"
                    class="department-logo-file-input"
                    data-department-id="${department.id}"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    hidden
                >


                <button
                    type="button"
                    class="button department-logo-upload-button"
                    data-department-id="${department.id}"
                >
                    ${
                        hasCustomLogo
                            ? "Change Logo"
                            : "Upload Logo"
                    }
                </button>


                ${
                    hasCustomLogo

                        ? `
                            <button
                                type="button"
                                class="button secondary-button department-logo-reset-button"
                                data-department-id="${department.id}"
                            >
                                Reset to Automatic
                            </button>
                        `

                        : ""
                }

            </div>

        </article>
    `;
}



// ======================================================
// AUTOMATIC ICON PREVIEW FOR STAFF
// ======================================================

function getStaffDepartmentIcon(
    departmentName
) {

    const name =
        String(
            departmentName || ""
        ).toLowerCase();


// NORMAL BODY-PART NAMES → EXISTING DEPARTMENT ICONS
// Keep this above the original department checks.

const bodyPartAliases = [
    {
        words: ["leg", "hand", "arm", "foot", "feet", "knee",
                "ankle", "elbow", "wrist", "shoulder", "hip",
                "bone", "joint", "fracture"],
        department: "orthopedics"
    },
    {
        words: ["stomach", "abdomen", "abdominal", "intestine",
                "bowel", "colon", "digestive", "liver", "pancreas"],
        department: "gastroenterology"
    },
    {
        words: ["chest", "heartbeat", "cardiac"],
        department: "cardiology"
    },
    {
        words: ["head", "brain", "migraine", "nerve"],
        department: "neurology"
    },
    {
        words: ["vision", "eyesight", "retina"],
        department: "ophthalmology"
    },
    {
        words: ["nose", "throat", "hearing", "sinus"],
        department: "ent"
    },
    {
        words: ["teeth", "mouth", "gum", "gums"],
        department: "dental"
    },
    {
        words: ["bladder", "urinary"],
        department: "urology"
    },
    {
        words: ["rash", "acne", "eczema"],
        department: "dermatology"
    },
    {
        words: ["breathing", "asthma"],
        department: "respiratory"
    }
];

for (const alias of bodyPartAliases) {
    if (
        alias.words.some(word =>
            new RegExp(
                `(^|[^a-z])${word}([^a-z]|$)`
            ).test(name)
        )
    ) {
        return getStaffDepartmentIcon(alias.department);
    }
}

    // CARDIOLOGY / HEART

    if (
        name.includes("cardio") ||
        name.includes("heart")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path
                    d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"
                />
                <path
                    d="M4.5 12h4l1.5-3 3 6 1.5-3h5"
                />
            </svg>
        `;
    }


    // BLOOD BANK / HEMATOLOGY

    if (
        name.includes("blood") ||
        name.includes("hematology") ||
        name.includes("haematology") ||
        name.includes("transfusion") ||
        name.includes("donor")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path
                    d="M12 2.5S6.5 9 6.5 14a5.5 5.5 0 0 0 11 0C17.5 9 12 2.5 12 2.5Z"
                />
                <path
                    d="M9.5 15.5c.6 1.2 1.5 1.8 2.8 1.9"
                />
            </svg>
        `;
    }


    // PREGNANCY / MATERNITY

    if (
        name.includes("pregnan") ||
        name.includes("maternity") ||
        name.includes("obstetric") ||
        name.includes("antenatal") ||
        name.includes("prenatal")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <circle
                    cx="10"
                    cy="5"
                    r="2.2"
                />
                <path d="M10 7.5v5"/>
                <path
                    d="M10 9c4 0 6.5 2.3 6.5 5.5S14.5 20 11.5 20"
                />
                <path d="M10 12.5 7.5 20"/>
                <path d="M10 12.5 13 20"/>
            </svg>
        `;
    }


    // EYE / OPHTHALMOLOGY

    if (
        name.includes("eye") ||
        name.includes("ophthalm")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path
                    d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                />
                <circle
                    cx="12"
                    cy="12"
                    r="2.5"
                />
            </svg>
        `;
    }


    // DERMATOLOGY / SKIN

    if (
        name.includes("dermat") ||
        name.includes("skin")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <circle
                    cx="12"
                    cy="12"
                    r="8"
                />
                <path d="M9 10h.01"/>
                <path d="M15 10h.01"/>
                <path d="M9 15c2 1.5 4 1.5 6 0"/>
            </svg>
        `;
    }


    // DENTAL

    if (
        name.includes("dental") ||
        name.includes("dentist") ||
        name.includes("dentistry") ||
        name.includes("tooth")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path
                    d="M8.5 3c-3 0-5 2.4-4.5 5.4.4 2.5 1.8 4 2.5 6.3.7 2.2.8 5.3 2.5 5.3 1.5 0 1.5-4 3-4s1.5 4 3 4c1.7 0 1.8-3.1 2.5-5.3.7-2.3 2.1-3.8 2.5-6.3C20.5 5.4 18.5 3 15.5 3c-1.5 0-2.3.8-3.5.8S10 3 8.5 3Z"
                />
            </svg>
        `;
    }


    // ORTHOPEDICS / BONE

    if (
        name.includes("ortho") ||
        name.includes("bone")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path
                    d="M7.5 8.5 15.5 16.5"
                />
                <path
                    d="M6 10a2.5 2.5 0 1 1-2-4 2.5 2.5 0 1 1 4-2"
                />
                <path
                    d="M18 14a2.5 2.5 0 1 1 2 4 2.5 2.5 0 1 1-4 2"
                />
            </svg>
        `;
    }


    // NEUROLOGY / BRAIN / PSYCHIATRY

    if (
        name.includes("neuro") ||
        name.includes("brain") ||
        name.includes("psychi") ||
        name.includes("mental")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path
                    d="M9.5 4.5A3 3 0 0 0 6 7.4 3.5 3.5 0 0 0 5.5 14 3.5 3.5 0 0 0 9 18.5"
                />
                <path
                    d="M14.5 4.5A3 3 0 0 1 18 7.4a3.5 3.5 0 0 1 .5 6.6 3.5 3.5 0 0 1-3.5 4.5"
                />
                <path d="M12 4v16"/>
                <path d="M9 9c2 0 3 1 3 3"/>
                <path d="M15 14c-2 0-3 1-3 3"/>
            </svg>
        `;
    }


    // ENT / EAR

    if (
        name === "ent" ||
        /\bear\b/.test(name) ||
        name.includes("otolaryng")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path
                    d="M7 10a5 5 0 1 1 9 3c-1.5 1.8-2 2.3-2 4a3 3 0 0 1-6 0"
                />
                <path
                    d="M10 10a2 2 0 1 1 3 1.7c-1 .6-1 1.3-1 2.3"
                />
            </svg>
        `;
    }


    // LUNGS / RESPIRATORY

    if (
        name.includes("pulmon") ||
        name.includes("respirat") ||
        name.includes("lung")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path d="M12 3v9"/>
                <path
                    d="M10 7c-2 1-3 3-4 5l-2 5c-.5 1.5.5 3 2 3 3 0 5-2 5-5V9"
                />
                <path
                    d="M14 7c2 1 3 3 4 5l2 5c.5 1.5-.5 3-2 3-3 0-5-2-5-5V9"
                />
            </svg>
        `;
    }

// DIALYSIS — CHECK BEFORE GENERAL KIDNEY

if (
    name.includes("dialysis") ||
    name.includes("dialysi")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0C19 10 12 2 12 2Z"/>
            <path d="M8 15h8M12 11v8"/>
        </svg>
    `;
}

    // KIDNEY / UROLOGY

    if (
        name.includes("urolog") ||
        name.includes("kidney") ||
        name.includes("renal")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path
                    d="M9 4C5 4 4 8 5 11c1 3 4 3 4 6v3"
                />
                <path
                    d="M15 4c4 0 5 4 4 7-1 3-4 3-4 6v3"
                />
            </svg>
        `;
    }


    // GYNECOLOGY / WOMEN'S HEALTH

    if (
        name.includes("gyn") ||
        name.includes("women")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <circle
                    cx="12"
                    cy="9"
                    r="5"
                />
                <path d="M12 14v7"/>
                <path d="M9 18h6"/>
            </svg>
        `;
    }


    // PEDIATRICS / CHILDREN

    if (
        name.includes("pediatric") ||
        name.includes("paediatric") ||
        name.includes("child")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <circle
                    cx="12"
                    cy="8"
                    r="4"
                />
                <path
                    d="M5 21c.5-5 3-8 7-8s6.5 3 7 8"
                />
                <path d="M9 8h.01"/>
                <path d="M15 8h.01"/>
            </svg>
        `;
    }


    // LABORATORY

    if (
        name.includes("laboratory") ||
        name.includes("lab")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path d="M9 3h6"/>
                <path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>
                <path d="M8 15h8"/>
            </svg>
        `;
    }


    // RADIOLOGY / X-RAY

    if (
        name.includes("radiology") ||
        name.includes("x-ray") ||
        name.includes("xray") ||
        name.includes("imaging")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <rect
                    x="4"
                    y="3"
                    width="16"
                    height="18"
                    rx="2"
                />
                <path d="M9 8c2 2 4 2 6 0"/>
                <path d="M9 16c2-2 4-2 6 0"/>
                <path d="M12 6v12"/>
            </svg>
        `;
    }


    // PHARMACY

    if (
        name.includes("pharmacy") ||
        name.includes("pharmacist") ||
        name.includes("medication")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path
                    d="M7 17 17 7"
                />
                <path
                    d="M6 8a4 4 0 0 1 6-5l6 6a4 4 0 0 1-5 6l-7-7Z"
                />
            </svg>
        `;
    }


    // EMERGENCY

    if (
        name.includes("emergency") ||
        name.includes("accident") ||
        name === "er" ||
        name === "a&e"
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>
            </svg>
        `;
    }


    // SURGERY

    if (
        name.includes("surgery") ||
        name.includes("surgical") ||
        name.includes("operation")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path d="M4 20 18 6"/>
                <path d="m15 4 5 5"/>
                <path d="M4 16v4h4"/>
            </svg>
        `;
    }


    // GENERAL MEDICINE / CLINIC

    if (
        name.includes("general") ||
        name.includes("clinic") ||
        name.includes("medicine")
    ) {

        return `
            <svg viewBox="0 0 24 24">
                <path
                    d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"
                />
            </svg>
        `;
    }

    
// ======================================================
// ADDITIONAL AUTOMATIC HOSPITAL DEPARTMENT ICONS
// ======================================================

// ICU / CRITICAL CARE
if (
    name.includes("intensive care") ||
    name.includes("critical care") ||
    /\bicu\b/.test(name) ||
    /\bccu\b/.test(name)
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M2 12h4l3-6 4 12 3-6h6"/>
        </svg>
    `;
}

// ONCOLOGY / CANCER
if (
    name.includes("oncolog") ||
    name.includes("cancer") ||
    name.includes("chemotherap")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M12 3c-3 0-5 2-5 5 0 2 2 4 5 7 3-3 5-5 5-7 0-3-2-5-5-5Z"/>
            <path d="M12 15v6M8 18h8"/>
        </svg>
    `;
}

// GASTROENTEROLOGY / DIGESTIVE HEALTH
if (
    name.includes("gastro") ||
    name.includes("digestive") ||
    name.includes("stomach")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M10 2v6c0 2 2 3 4 3s3 2 3 4a6 6 0 0 1-12 0c0-3 2-5 5-5"/>
            <path d="M10 8c-2 0-3 1-3 3"/>
        </svg>
    `;
}

// ENDOCRINOLOGY / DIABETES
if (
    name.includes("endocrin") ||
    name.includes("diabet") ||
    name.includes("hormon")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M12 2 5 13a7 7 0 0 0 14 0L12 2Z"/>
            <path d="M9 14h6M12 11v6"/>
        </svg>
    `;
}

// PHYSIOTHERAPY / REHABILITATION
if (
    name.includes("physio") ||
    name.includes("rehabilitation") ||
    name.includes("physical therapy")
) {
    return `
        <svg viewBox="0 0 24 24">
            <circle cx="12" cy="4" r="2"/>
            <path d="M12 6v6l-4 4M12 12l5 3M8 16l-3 5M17 15l3 6"/>
        </svg>
    `;
}

// DIALYSIS
if (
    name.includes("dialysis") ||
    name.includes("dialysi") ||
    name.includes("hemodialysis") ||
    name.includes("haemodialysis")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0C19 10 12 2 12 2Z"/>
            <path d="M8 15h8M12 11v8"/>
        </svg>
    `;
}

// INFECTIOUS DISEASES
if (
    name.includes("infectious") ||
    name.includes("infection") ||
    name.includes("tropical disease")
) {
    return `
        <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M19 5l-3.5 3.5M8.5 15.5 5 19"/>
        </svg>
    `;
}

// RHEUMATOLOGY / JOINTS
if (
    name.includes("rheumat") ||
    name.includes("arthritis") ||
    name.includes("joint")
) {
    return `
        <svg viewBox="0 0 24 24">
            <circle cx="8" cy="8" r="4"/>
            <circle cx="16" cy="16" r="4"/>
            <path d="M10 10l4 4"/>
        </svg>
    `;
}

// ALLERGY / IMMUNOLOGY
if (
    name.includes("allerg") ||
    name.includes("immunolog")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M12 2 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6l-8-4Z"/>
            <path d="M9 12l2 2 4-4"/>
        </svg>
    `;
}

// PATHOLOGY
if (
    name.includes("patholog") ||
    name.includes("histolog") ||
    name.includes("cytolog")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M6 21h13M10 18h7M8 3l5 5M13 8l-3 3M10 11l4 4M14 15a5 5 0 0 1-5 5"/>
            <path d="M6 3l3-1 5 5-2 3Z"/>
        </svg>
    `;
}

// NUTRITION / DIETETICS
if (
    name.includes("nutrition") ||
    name.includes("dietetic") ||
    name.includes("dietitian")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M12 7c-5-5-10-1-9 5 1 5 5 9 9 9s8-4 9-9c1-6-4-10-9-5Z"/>
            <path d="M12 7c0-3 1-4 3-5M12 7c-2-2-4-2-6-1"/>
        </svg>
    `;
}

// AUDIOLOGY / HEARING
if (
    name.includes("audiolog") ||
    name.includes("hearing")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M7 10a5 5 0 1 1 9 3c-2 2-2 3-2 5a3 3 0 0 1-6 0"/>
            <path d="M10 10a2 2 0 1 1 3 2"/>
        </svg>
    `;
}

// SPEECH THERAPY
if (
    name.includes("speech") ||
    name.includes("language therapy")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M4 4h16v12H9l-5 4V4Z"/>
            <path d="M8 9h8M8 12h5"/>
        </svg>
    `;
}

// OCCUPATIONAL THERAPY
if (
    name.includes("occupational therap")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M7 12V7a1 1 0 0 1 2 0v4-6a1 1 0 0 1 2 0v6-7a1 1 0 0 1 2 0v7-5a1 1 0 0 1 2 0v8l2-3a2 2 0 0 1 3 2l-4 7H9l-4-6a2 2 0 0 1 2-2Z"/>
        </svg>
    `;
}

// PALLIATIVE CARE / HOSPICE
if (
    name.includes("palliative") ||
    name.includes("hospice")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M12 21 4 13a5 5 0 0 1 7-7l1 1 1-1a5 5 0 0 1 7 7l-8 8Z"/>
            <path d="M9 12h6M12 9v6"/>
        </svg>
    `;
}

// GERIATRICS / ELDERLY CARE
if (
    name.includes("geriatric") ||
    name.includes("elderly") ||
    name.includes("senior care")
) {
    return `
        <svg viewBox="0 0 24 24">
            <circle cx="10" cy="5" r="2"/>
            <path d="M10 7v7l-3 7M10 14l4 7M14 10l4 4M19 10v11"/>
        </svg>
    `;
}

// NEONATAL / NEWBORN CARE
if (
    name.includes("neonatal") ||
    name.includes("newborn") ||
    /\bnicu\b/.test(name)
) {
    return `
        <svg viewBox="0 0 24 24">
            <circle cx="12" cy="7" r="3"/>
            <path d="M5 14c2-3 5-4 7-4s5 1 7 4l-3 6H8l-3-6Z"/>
        </svg>
    `;
}

// PLASTIC / RECONSTRUCTIVE SURGERY
if (
    name.includes("plastic surgery") ||
    name.includes("reconstructive") ||
    name.includes("cosmetic surgery")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M12 3c-5 0-8 4-8 9s3 9 8 9 8-4 8-9-3-9-8-9Z"/>
            <path d="M8 10h.01M16 10h.01M9 15c2 2 4 2 6 0"/>
        </svg>
    `;
}

// VASCULAR / VEIN CLINIC
if (
    name.includes("vascular") ||
    name.includes("vein") ||
    name.includes("artery")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M12 2v20M12 8 6 4M12 12l6-5M12 17l-5 4M12 19l6 3"/>
        </svg>
    `;
}

// TRANSPLANT UNIT
if (
    name.includes("transplant")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M12 21 4 13a5 5 0 0 1 7-7l1 1 1-1a5 5 0 0 1 7 7l-8 8Z"/>
            <path d="M12 8v8M8 12h8"/>
        </svg>
    `;
}

// WOUND CARE
if (
    name.includes("wound") ||
    name.includes("dressing")
) {
    return `
        <svg viewBox="0 0 24 24">
            <rect x="4" y="8" width="16" height="8" rx="3" transform="rotate(-45 12 12)"/>
            <path d="M10 10h4M10 14h4"/>
        </svg>
    `;
}

// AMBULANCE / PARAMEDIC
if (
    name.includes("ambulance") ||
    name.includes("paramedic")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M3 7h12v11H3V7ZM15 11h4l3 4v3h-7"/>
            <circle cx="7" cy="19" r="2"/>
            <circle cx="18" cy="19" r="2"/>
            <path d="M8 10v5M5.5 12.5h5"/>
        </svg>
    `;
}

// OUTPATIENT DEPARTMENT
if (
    name.includes("outpatient") ||
    /\bopd\b/.test(name)
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M4 21V5l8-3 8 3v16M2 21h20"/>
            <path d="M12 8v8M8 12h8"/>
        </svg>
    `;
}

// INPATIENT / WARD
if (
    name.includes("inpatient") ||
    name.includes("ward")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M3 20V7M3 15h18v5M7 15v-5h14v5M7 10h6"/>
            <path d="M3 20h18"/>
        </svg>
    `;
}

// HEALTH SCREENING / PREVENTIVE MEDICINE
if (
    name.includes("screening") ||
    name.includes("preventive") ||
    name.includes("health check")
) {
    return `
        <svg viewBox="0 0 24 24">
            <rect x="5" y="3" width="14" height="18" rx="2"/>
            <path d="M9 3V2h6v1M8 12l3 3 5-6"/>
        </svg>
    `;
}

// VACCINATION / IMMUNIZATION
if (
    name.includes("vaccin") ||
    name.includes("immunization") ||
    name.includes("immunisation")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="m5 19 10-10M13 5l6 6M15 3l6 6M3 21l4-1-3-3-1 4Z"/>
        </svg>
    `;
}

// SOCIAL WORK / PATIENT SUPPORT
if (
    name.includes("social work") ||
    name.includes("patient support") ||
    name.includes("counselling") ||
    name.includes("counseling")
) {
    return `
        <svg viewBox="0 0 24 24">
            <path d="M12 21 4 13a5 5 0 0 1 7-7l1 1 1-1a5 5 0 0 1 7 7l-8 8Z"/>
        </svg>
    `;
}

// REGISTRATION / ADMISSION
if (
    name.includes("registration") ||
    name.includes("admission") ||
    name.includes("reception")
) {
    return `
        <svg viewBox="0 0 24 24">
            <rect x="5" y="3" width="14" height="18" rx="2"/>
            <path d="M9 8h6M9 12h6M9 16h4"/>
        </svg>
    `;
}


    // DEFAULT MEDICAL CROSS

    return `
        <svg viewBox="0 0 24 24">
            <path
                d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"
            />
        </svg>
    `;
}



// ======================================================
// OPEN FILE PICKER
// ======================================================

document.addEventListener(
    "click",
    event => {

        const uploadButton =
            event.target.closest(
                ".department-logo-upload-button"
            );


        if (uploadButton) {

            const departmentId =
                Number(
                    uploadButton
                        .dataset
                        .departmentId
                );


            const input =
                document.querySelector(
                    `.department-logo-file-input[data-department-id="${departmentId}"]`
                );


            if (input) {
                input.click();
            }


            return;
        }


        const resetButton =
            event.target.closest(
                ".department-logo-reset-button"
            );


        if (resetButton) {

            const departmentId =
                Number(
                    resetButton
                        .dataset
                        .departmentId
                );


            resetDepartmentLogo(
                departmentId
            );
        }
    }
);



// ======================================================
// IMAGE SELECTED
// ======================================================

document.addEventListener(
    "change",
    async event => {

        const input =
            event.target.closest(
                ".department-logo-file-input"
            );


        if (!input) {
            return;
        }


        const file =
            input.files?.[0];


        if (!file) {
            return;
        }


        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif"
        ];


        if (
            !allowedTypes.includes(
                file.type
            )
        ) {

            showToast(
    "Please select a PNG, JPG, WebP or GIF image.",
    "warning"
);
            input.value = "";

            return;
        }


        // Keep the upload reasonably small.
        // Base64 makes the image larger than the
        // original file, so 900 KB is a safe limit.

        if (
    file.size >
    3 * 1024 * 1024
) {

    showToast(
    "The logo is too large. Please choose an image smaller than 3 MB.",
    "warning"
);

    input.value = "";

    return;
}


        const departmentId =
            Number(
                input
                    .dataset
                    .departmentId
            );


        try {

            const dataUrl =
                await readDepartmentLogoFile(
                    file
                );


            await saveDepartmentLogo(
                departmentId,
                dataUrl
            );

        } catch (error) {

            console.error(
                "Department logo upload error:",
                error
            );


            showToast(
    "Unable to upload the department logo.",
    "error"
);

        } finally {

            input.value = "";
        }
    }
);



// ======================================================
// READ IMAGE FILE
// ======================================================

function readDepartmentLogoFile(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const reader =
                new FileReader();


            reader.onload =
                () => {

                    resolve(
                        String(
                            reader.result || ""
                        )
                    );

                };


            reader.onerror =
                () => {

                    reject(
                        new Error(
                            "Unable to read image."
                        )
                    );

                };


            reader.readAsDataURL(
                file
            );

        }
    );
}



// ======================================================
// SAVE CUSTOM DEPARTMENT LOGO
// ======================================================

async function saveDepartmentLogo(
    departmentId,
    logoDataUrl
) {

    const department =
        getDepartment(
            departmentId
        );


    if (!department) {

        showToast(
    "Department not found.",
    "error"
);

        return;
    }


    try {

        const response =
            await staffFetch(
                `/api/staff/departments/${departmentId}/logo`,
                {
                    method:
                        "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            logoDataUrl
                        })
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            showToast(
    result.error || "Unable to save department logo.",
    "error"
);

            return;
        }


        showToast(
            `${department.name} logo updated.`
        );


        await loadStaffDashboard();


    } catch (error) {

        console.error(
            "Unable to save department logo:",
            error
        );


        showToast(
    "Unable to save department logo.",
    "error"
);
    }
}



// ======================================================
// RESET CUSTOM LOGO
// ======================================================

async function resetDepartmentLogo(
    departmentId
) {

    const department =
        getDepartment(
            departmentId
        );


    if (!department) {
        return;
    }


    const confirmed = await mqConfirm(
    `Reset "${department.name}" to its automatic medical icon? The custom icon will be removed.`,
    {
        title: "Reset Department Icon?",
        confirmText: "Reset Icon",
        icon: "!",
        danger: true
    }
);

    if (!confirmed) {
        return;
    }


    try {

        const response =
            await staffFetch(
                `/api/staff/departments/${departmentId}/logo`,
                {
                    method:
                        "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            logoDataUrl:
                                ""
                        })
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            showToast(
    result.error || "Unable to reset department logo.",
    "error"
);

            return;
        }


        showToast(
            `${department.name} restored to automatic icon.`
        );


        await loadStaffDashboard();


    } catch (error) {

        console.error(
            "Unable to reset department logo:",
            error
        );


        showToast(
    "Unable to reset department logo.",
    "error"
);
    }
}
// ======================================================
// WEBSITE SETTINGS
// Global MediQueue Logo + Automatic Logo Theme
// ======================================================


const DEFAULT_WEBSITE_PRIMARY_COLOR =
    "#0F9D8A";

const DEFAULT_WEBSITE_SECONDARY_COLOR =
    "#17324D";

let pendingWebsiteLogoDataUrl = "";
let pendingWebsiteFaviconDataUrl = "";



// ======================================================
// RENDER WEBSITE SETTINGS
// ======================================================

function updateBrowserFavicon() {
    const faviconLink =
        document.getElementById("website-favicon");

    if (!faviconLink) return;

    const settings = getPortalSettings();

    const favicon =
        settings.faviconDataUrl || "";

    const defaultIcon =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230F9D8A'/%3E%3Cpath d='M27 12h10v15h15v10H37v15H27V37H12V27h15z' fill='white'/%3E%3C/svg%3E";

    faviconLink.href = favicon || defaultIcon;

    faviconLink.type = favicon
        ? favicon.substring(5, favicon.indexOf(";"))
        : "image/svg+xml";
}

function renderWebsiteSettings() {

        updateBrowserFavicon();

        

    const settings =
        getPortalSettings();
            setValue(
        "website-name-input",
        settings.systemName || "MediQueue"
    );


    const logo =
        pendingWebsiteLogoDataUrl ||
        settings.logoDataUrl ||
        "";


    const customPreview =
        document.getElementById(
            "website-logo-preview"
        );


    const defaultPreview =
        document.getElementById(
            "website-logo-default-preview"
        );


    const status =
        document.getElementById(
            "website-logo-status"
        );


    if (
        customPreview &&
        defaultPreview
    ) {

        if (logo) {

            customPreview.src =
                logo;

            customPreview.style.display =
                "block";

            defaultPreview.style.display =
                "none";


            if (status) {

                status.textContent =
                    "Custom Website Logo";

            }

        } else {

            customPreview.removeAttribute(
                "src"
            );

            customPreview.style.display =
                "none";

            defaultPreview.style.display =
                "flex";


            if (status) {

                status.textContent =
                    "Default MediQueue Logo";

            }
        }
    }



    const automaticTheme =
        settings.autoThemeFromLogo === true;


    const toggle =
        document.getElementById(
            "website-auto-theme-toggle"
        );


    if (toggle) {

        toggle.checked =
            automaticTheme;

    }



    updateWebsiteThemeColorPreview(
        settings.primaryColor ||
        DEFAULT_WEBSITE_PRIMARY_COLOR,

        settings.secondaryColor ||
        DEFAULT_WEBSITE_SECONDARY_COLOR,

        automaticTheme
    );

        const favicon =
        pendingWebsiteFaviconDataUrl ||
        settings.faviconDataUrl ||
        "";

    const faviconPreview =
        document.getElementById("website-favicon-preview");

    const faviconDefault =
        document.getElementById("website-favicon-default-preview");

    const faviconStatus =
        document.getElementById("website-favicon-status");

    if (faviconPreview && faviconDefault) {
        if (favicon) {
            faviconPreview.src = favicon;
            faviconPreview.style.display = "block";
            faviconDefault.style.display = "none";

            if (faviconStatus) {
                faviconStatus.textContent = "Custom Browser Icon";
            }
        } else {
            faviconPreview.removeAttribute("src");
            faviconPreview.style.display = "none";
            faviconDefault.style.display = "flex";

            if (faviconStatus) {
                faviconStatus.textContent = "Default Icon";
            }
        }
    }
}



// ======================================================
// WEBSITE LOGO UPLOAD BUTTON
// ======================================================

document
    .getElementById(
        "website-logo-upload-button"
    )
    ?.addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "website-logo-input"
                )
                ?.click();

        }
    );



// ======================================================
// WEBSITE LOGO FILE
// ======================================================

document
    .getElementById(
        "website-logo-input"
    )
    ?.addEventListener(
        "change",
        async event => {

            const input =
                event.target;


            const file =
                input.files?.[0];


            if (!file) {
                return;
            }


            const allowedTypes = [
                "image/png",
                "image/jpeg",
                "image/webp"
            ];


            if (
                !allowedTypes.includes(
                    file.type
                )
            ) {

                showToast(
    "Please choose a PNG, JPG or WebP image.",
    "warning"
);

                input.value = "";

                return;
            }


            if (
                file.size >
                3 * 1024 * 1024
            ) {

                showToast(
    "The website logo is too large. Please choose an image smaller than 3 MB.",
    "warning"
);

                input.value = "";

                return;
            }


            try {

                const logoDataUrl = await new Promise(resolve => {
    const cancelButton =
        document.getElementById("image-crop-cancel");

    const handleCancel = () => {
        cancelButton.removeEventListener("click", handleCancel);
        resolve(null);
    };

    cancelButton.addEventListener("click", handleCancel);

    openImageCropEditor(file, croppedImage => {
        cancelButton.removeEventListener("click", handleCancel);
        resolve(croppedImage);
    });
});

if (!logoDataUrl) {
    return;
}


                pendingWebsiteLogoDataUrl =
                    logoDataUrl;


                showWebsiteLogoPreview(
                    logoDataUrl
                );


                const settings =
                    getPortalSettings();


                let primaryColor =
                    settings.primaryColor ||
                    DEFAULT_WEBSITE_PRIMARY_COLOR;


                let secondaryColor =
                    settings.secondaryColor ||
                    DEFAULT_WEBSITE_SECONDARY_COLOR;


                if (
                    settings.autoThemeFromLogo ===
                    true
                ) {

                    const colors =
                        await extractWebsiteLogoColors(
                            logoDataUrl
                        );


                    primaryColor =
                        colors.primaryColor;

                    secondaryColor =
                        colors.secondaryColor;

                }


                await saveWebsiteSettings({
                    logoDataUrl,
                    primaryColor,
                    secondaryColor,
                    autoThemeFromLogo:
                        settings.autoThemeFromLogo ===
                        true
                });


                pendingWebsiteLogoDataUrl =
                    "";


                showToast(
                    "Website logo updated."
                );


                await loadStaffDashboard();


            } catch (error) {

                console.error(
                    "Unable to update website logo:",
                    error
                );


                showToast(
    error.message || "Unable to update website logo.",
    "error"
);

            } finally {

                input.value = "";

            }
        }
    );



// ======================================================
// RESET WEBSITE LOGO
// ======================================================

document
    .getElementById(
        "website-logo-reset-button"
    )
    ?.addEventListener(
        "click",
        async () => {

            const confirmed = await mqConfirm(
    "Reset the global MediQueue website logo to its default? Your current custom logo will be removed.",
    {
        title: "Reset Website Logo?",
        confirmText: "Reset Logo",
        icon: "!",
        danger: true
    }
);


            if (!confirmed) {
                return;
            }


            try {

                const settings =
                    getPortalSettings();


                pendingWebsiteLogoDataUrl =
                    "";


                await saveWebsiteSettings({

                    logoDataUrl:
                        "",

                    primaryColor:
                        settings.autoThemeFromLogo
                            ? DEFAULT_WEBSITE_PRIMARY_COLOR
                            : settings.primaryColor,

                    secondaryColor:
                        settings.autoThemeFromLogo
                            ? DEFAULT_WEBSITE_SECONDARY_COLOR
                            : settings.secondaryColor,

                    autoThemeFromLogo:
                        settings.autoThemeFromLogo ===
                        true

                });


                showToast(
                    "Website logo reset to default."
                );


                await loadStaffDashboard();


            } catch (error) {

                console.error(error);


                showToast(
    "Unable to reset the website logo.",
    "error"
);

            }
        }
    );



// ======================================================
// AUTOMATIC THEME TOGGLE
// ======================================================

document
    .getElementById(
        "website-auto-theme-toggle"
    )
    ?.addEventListener(
        "change",
        async event => {

            const enabled =
                event.target.checked;

            const settings =
                getPortalSettings();

            const logo =
                pendingWebsiteLogoDataUrl ||
                settings.logoDataUrl ||
                "";

            try {

                let primaryColor;
                let secondaryColor;


                // ==========================================
                // AUTO THEME ON
                // ==========================================

                if (enabled) {

                    if (!logo) {

                        showToast(
    "Please upload a Website Logo before enabling Automatic Theme From Logo.",
    "warning"
);

                        event.target.checked =
                            false;

                        return;
                    }


                    const colors =
                        await extractWebsiteLogoColors(
                            logo
                        );


                    primaryColor =
                        colors.primaryColor;

                    secondaryColor =
                        colors.secondaryColor;

                }

                // ==========================================
                // AUTO THEME OFF
                // RESTORE ORIGINAL MEDIQUEUE COLORS
                // ==========================================

                else {

                    primaryColor =
                        DEFAULT_WEBSITE_PRIMARY_COLOR;

                    secondaryColor =
                        DEFAULT_WEBSITE_SECONDARY_COLOR;
                }


                await saveWebsiteSettings({

                    logoDataUrl:
                        logo,

                    primaryColor:
                        primaryColor,

                    secondaryColor:
                        secondaryColor,

                    autoThemeFromLogo:
                        enabled
                });


                // Apply immediately
                document.documentElement.style.setProperty(
                    "--portal-primary",
                    primaryColor
                );

                document.documentElement.style.setProperty(
                    "--portal-secondary",
                    secondaryColor
                );


                if (enabled) {

                    showToast(
                        "Automatic logo theme enabled."
                    );

                } else {

                    showToast(
                        "Original MediQueue theme restored."
                    );
                }


                await loadStaffDashboard();

            } catch (error) {

                console.error(
                    "Automatic theme error:",
                    error
                );

                event.target.checked =
                    !enabled;

                showToast(
    "Unable to update Automatic Theme From Logo.",
    "error"
);
            }
        }
    );



// ======================================================
// SHOW WEBSITE LOGO PREVIEW
// ======================================================

function showWebsiteLogoPreview(
    logoDataUrl
) {

    const preview =
        document.getElementById(
            "website-logo-preview"
        );


    const fallback =
        document.getElementById(
            "website-logo-default-preview"
        );


    const status =
        document.getElementById(
            "website-logo-status"
        );


    if (preview) {

        preview.src =
            logoDataUrl;

        preview.style.display =
            "block";

    }


    if (fallback) {

        fallback.style.display =
            "none";

    }


    if (status) {

        status.textContent =
            "Custom Website Logo";

    }
}



// ======================================================
// READ WEBSITE LOGO
// ======================================================

function readWebsiteLogoFile(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const reader =
                new FileReader();


            reader.onload =
                () => {

                    resolve(
                        reader.result
                    );

                };


            reader.onerror =
                () => {

                    reject(
                        new Error(
                            "Unable to read the selected logo."
                        )
                    );

                };


            reader.readAsDataURL(
                file
            );

        }
    );
}



// ======================================================
// EXTRACT BRAND COLORS FROM LOGO
// ======================================================

function extractWebsiteLogoColors(
    logoDataUrl
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const image =
                new Image();


            image.onload =
                () => {

                    try {

                        const canvas =
                            document.createElement(
                                "canvas"
                            );


                        const size =
                            120;


                        canvas.width =
                            size;

                        canvas.height =
                            size;


                        const context =
                            canvas.getContext(
                                "2d",
                                {
                                    willReadFrequently:
                                        true
                                }
                            );


                        if (!context) {

                            throw new Error(
                                "Color analysis is not supported."
                            );

                        }


                        context.clearRect(
                            0,
                            0,
                            size,
                            size
                        );


                        const scale =
                            Math.min(
                                size / image.width,
                                size / image.height
                            );


                        const width =
                            image.width *
                            scale;


                        const height =
                            image.height *
                            scale;


                        const x =
                            (
                                size -
                                width
                            ) / 2;


                        const y =
                            (
                                size -
                                height
                            ) / 2;


                        context.drawImage(
                            image,
                            x,
                            y,
                            width,
                            height
                        );


                        const pixels =
                            context.getImageData(
                                0,
                                0,
                                size,
                                size
                            ).data;


                        const colorBuckets =
                            new Map();


                        for (
                            let index = 0;
                            index < pixels.length;
                            index += 16
                        ) {

                            const red =
                                pixels[index];

                            const green =
                                pixels[
                                    index + 1
                                ];

                            const blue =
                                pixels[
                                    index + 2
                                ];

                            const alpha =
                                pixels[
                                    index + 3
                                ];


                            if (
                                alpha < 150
                            ) {
                                continue;
                            }


                            const maximum =
                                Math.max(
                                    red,
                                    green,
                                    blue
                                );


                            const minimum =
                                Math.min(
                                    red,
                                    green,
                                    blue
                                );


                            const brightness =
                                (
                                    red +
                                    green +
                                    blue
                                ) / 3;


                            const saturation =
                                maximum -
                                minimum;


                            // Ignore white / black /
                            // very gray pixels.

                            if (
                                brightness > 238 ||
                                brightness < 25 ||
                                saturation < 22
                            ) {
                                continue;
                            }


                            const bucketRed =
                                Math.round(
                                    red / 24
                                ) * 24;


                            const bucketGreen =
                                Math.round(
                                    green / 24
                                ) * 24;


                            const bucketBlue =
                                Math.round(
                                    blue / 24
                                ) * 24;


                            const key =
                                `${bucketRed},${bucketGreen},${bucketBlue}`;


                            const current =
                                colorBuckets.get(
                                    key
                                ) || {
                                    count: 0,
                                    red: 0,
                                    green: 0,
                                    blue: 0
                                };


                            current.count++;

                            current.red +=
                                red;

                            current.green +=
                                green;

                            current.blue +=
                                blue;


                            colorBuckets.set(
                                key,
                                current
                            );
                        }


                        const colors =
                            Array.from(
                                colorBuckets.values()
                            )
                                .sort(
                                    (
                                        first,
                                        second
                                    ) =>
                                        second.count -
                                        first.count
                                )
                                .map(
                                    color => ({

                                        red:
                                            Math.round(
                                                color.red /
                                                color.count
                                            ),

                                        green:
                                            Math.round(
                                                color.green /
                                                color.count
                                            ),

                                        blue:
                                            Math.round(
                                                color.blue /
                                                color.count
                                            ),

                                        count:
                                            color.count

                                    })
                                );


                        if (!colors.length) {

                            resolve({

                                primaryColor:
                                    DEFAULT_WEBSITE_PRIMARY_COLOR,

                                secondaryColor:
                                    DEFAULT_WEBSITE_SECONDARY_COLOR

                            });

                            return;
                        }


                        const primary =
                            colors[0];


                        let secondary =
                            colors.find(
                                color => {

                                    const distance =
                                        Math.sqrt(

                                            Math.pow(
                                                color.red -
                                                primary.red,
                                                2
                                            ) +

                                            Math.pow(
                                                color.green -
                                                primary.green,
                                                2
                                            ) +

                                            Math.pow(
                                                color.blue -
                                                primary.blue,
                                                2
                                            )

                                        );


                                    return (
                                        distance > 75
                                    );

                                }
                            );


                        if (!secondary) {

                            secondary =
                                createDarkerWebsiteColor(
                                    primary
                                );

                        }


                        resolve({

                            primaryColor:
                                rgbToWebsiteHex(
                                    primary.red,
                                    primary.green,
                                    primary.blue
                                ),

                            secondaryColor:
                                rgbToWebsiteHex(
                                    secondary.red,
                                    secondary.green,
                                    secondary.blue
                                )

                        });


                    } catch (error) {

                        reject(
                            error
                        );

                    }
                };


            image.onerror =
                () => {

                    reject(
                        new Error(
                            "Unable to analyze the selected logo."
                        )
                    );

                };


            image.src =
                logoDataUrl;

        }
    );
}



// ======================================================
// CREATE DARKER SECONDARY COLOR
// ======================================================

function createDarkerWebsiteColor(
    color
) {

    return {

        red:
            Math.max(
                20,
                Math.round(
                    color.red * .48
                )
            ),

        green:
            Math.max(
                25,
                Math.round(
                    color.green * .48
                )
            ),

        blue:
            Math.max(
                30,
                Math.round(
                    color.blue * .48
                )
            )

    };
}



// ======================================================
// RGB TO HEX
// ======================================================

function rgbToWebsiteHex(
    red,
    green,
    blue
) {

    const convert =
        value =>
            Math.max(
                0,
                Math.min(
                    255,
                    value
                )
            )
                .toString(16)
                .padStart(
                    2,
                    "0"
                );


    return (
        "#" +
        convert(red) +
        convert(green) +
        convert(blue)
    ).toUpperCase();
}



// ======================================================
// WEBSITE COLOR PREVIEW
// ======================================================

function updateWebsiteThemeColorPreview(
    primaryColor,
    secondaryColor,
    enabled
) {

    const container =
        document.getElementById(
            "website-theme-colors"
        );


    if (container) {

        container.style.display =
            enabled
                ? "flex"
                : "none";

    }


    const primaryPreview =
        document.getElementById(
            "website-primary-color-preview"
        );


    const secondaryPreview =
        document.getElementById(
            "website-secondary-color-preview"
        );


    if (primaryPreview) {

        primaryPreview.style.backgroundColor =
            primaryColor;

    }


    if (secondaryPreview) {

        secondaryPreview.style.backgroundColor =
            secondaryColor;

    }


    setText(
        "website-primary-color-value",
        String(
            primaryColor
        ).toUpperCase()
    );


    setText(
        "website-secondary-color-value",
        String(
            secondaryColor
        ).toUpperCase()
    );
}



// ======================================================
// SAVE GLOBAL WEBSITE SETTINGS
// ======================================================

async function saveWebsiteSettings(
    changes
) {

    const currentSettings =
        getPortalSettings();


    const updatedSettings = {
        ...currentSettings,
        ...changes
    };


    const response =
        await staffFetch(
            "/api/staff/portal-settings",
            {
                method:
                    "PUT",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        updatedSettings
                    )
            }
        );


    const result =
        await response.json();


    if (!response.ok) {

        throw new Error(
            result.error ||
            "Unable to save Website Settings."
        );

    }


    if (result.portalSettings) {

        latestData.portalSettings =
            result.portalSettings;

    } else {

        latestData.portalSettings =
            updatedSettings;

    }


    renderWebsiteSettings();

    renderBranding();

    updateBrowserFavicon();


    return result;
}
// ======================================================
// STAFF BRAND / LOGO CLICK -> REFRESH DASHBOARD
// ======================================================

document
    .querySelector(
        ".staff-brand"
    )
    ?.addEventListener(
        "click",
        () => {

            window.location.reload();

        }
    );
    // ======================================================
// STAFF BRAND CLICK -> REFRESH DASHBOARD
// ======================================================

const staffBrandHome =
    document.getElementById(
        "staff-brand-home"
    );


staffBrandHome?.addEventListener("click", () => {
    window.location.reload();
});


// Keyboard support
staffBrandHome?.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" ||
            event.key === " "
        ) {

            event.preventDefault();

            window.location.reload();
        }
    }
);
// ======================================================
// WEBSITE NAME SETTINGS
// ======================================================

document
    .getElementById("website-name-form")
    ?.addEventListener("submit", async event => {

        event.preventDefault();

        const input =
            document.getElementById("website-name-input");

        const button =
            document.getElementById("website-name-save-button");

        const feedback =
            document.getElementById("website-name-feedback");

        const websiteName =
            input?.value.trim() || "";

        if (!websiteName || websiteName.length > 80) {
            if (feedback) {
                feedback.textContent =
                    "Enter a website name (maximum 80 characters).";
            }
            return;
        }

        if (button) {
            button.disabled = true;
            button.textContent = "Saving...";
        }

        if (feedback) {
            feedback.textContent = "";
        }

        try {
            await saveWebsiteSettings({
                systemName: websiteName
            });

            setValue("portal-system-name", websiteName);

            if (feedback) {
                feedback.textContent =
                    "Website name saved successfully.";
            }

            showToast("Website name updated.");

        } catch (error) {
            console.error(error);

            if (feedback) {
                feedback.textContent =
                    error.message || "Unable to save website name.";
            }

        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Save Website Name";
            }
        }
    });

    // ======================================================
// WEBSITE FAVICON SETTINGS
// ======================================================

document
    .getElementById("website-favicon-upload-button")
    ?.addEventListener("click", () => {
        document
            .getElementById("website-favicon-input")
            ?.click();
    });

document
    .getElementById("website-favicon-input")
    ?.addEventListener("change", async event => {

        const input = event.target;
        const file = input.files?.[0];

        if (!file) return;

        const feedback =
            document.getElementById("website-favicon-feedback");

        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {
            if (feedback) {
                feedback.textContent =
                    "Choose a PNG, JPG or WebP image.";
            }

            input.value = "";
            return;
        }

        if (file.size > 1024 * 1024) {
            if (feedback) {
                feedback.textContent =
                    "The browser icon must be smaller than 1 MB.";
            }

            input.value = "";
            return;
        }

        try {
            const faviconDataUrl =
                await new Promise((resolve, reject) => {

                    const reader = new FileReader();

                    reader.onload = () => {
                        resolve(reader.result);
                    };

                    reader.onerror = () => {
                        reject(
                            new Error("Unable to read the image.")
                        );
                    };

                    reader.readAsDataURL(file);
                });

            pendingWebsiteFaviconDataUrl =
                faviconDataUrl;

            renderWebsiteSettings();

            if (feedback) {
                feedback.textContent = "Saving browser icon...";
            }

            await saveWebsiteSettings({
                faviconDataUrl
            });

            pendingWebsiteFaviconDataUrl = "";

            if (feedback) {
                feedback.textContent =
                    "Browser icon saved successfully.";
            }

            showToast("Browser icon updated.");

        } catch (error) {

            pendingWebsiteFaviconDataUrl = "";

            renderWebsiteSettings();

            console.error(error);

            if (feedback) {
                feedback.textContent =
                    error.message || "Unable to save browser icon.";
            }

        } finally {
            input.value = "";
        }
    });

document
    .getElementById("website-favicon-reset-button")
    ?.addEventListener("click", async () => {

        const confirmed = await mqConfirm(
    "Reset the browser icon to its default? Your current custom favicon will be removed.",
    {
        title: "Reset Browser Icon?",
        confirmText: "Reset Icon",
        icon: "!",
        danger: true
    }
);

        if (!confirmed) return;

        const feedback =
            document.getElementById("website-favicon-feedback");

        try {
            pendingWebsiteFaviconDataUrl = "";

            await saveWebsiteSettings({
                faviconDataUrl: ""
            });

            if (feedback) {
                feedback.textContent =
                    "Default browser icon restored.";
            }

            showToast("Browser icon reset.");

        } catch (error) {
            console.error(error);

            if (feedback) {
                feedback.textContent =
                    error.message || "Unable to reset browser icon.";
            }
        }
    });

    // =========================================
// MEDIQUEUE CUSTOM CONFIRMATION POPUP
// =========================================

function mqConfirm(message, options = {}) {
    return new Promise(resolve => {
        const modal = document.getElementById("mq-confirm-modal");
        const title = document.getElementById("mq-confirm-title");
        const messageElement = document.getElementById("mq-confirm-message");
        const icon = document.getElementById("mq-confirm-icon");
        const cancelButton = document.getElementById("mq-confirm-cancel");
        const acceptButton = document.getElementById("mq-confirm-accept");

        if (!modal || !title || !messageElement ||
            !icon || !cancelButton || !acceptButton) {
            console.error("MediQueue confirmation popup elements are missing.");
            resolve(false);
            return;
        }

        // Prevent multiple confirmation windows opening together.
        if (!modal.hidden) {
            resolve(false);
            return;
        }

        const previousFocus = document.activeElement;

        title.textContent = options.title || "Are you sure?";
        messageElement.textContent = message;
        icon.textContent = options.icon || "!";
        acceptButton.textContent = options.confirmText || "Confirm";
        cancelButton.textContent = "Cancel";

        acceptButton.style.background =
            options.danger ? "#dc2626" : "#7c3aed";

        icon.style.background =
            options.danger ? "#fee2e2" : "#ede9fe";

        icon.style.color =
            options.danger ? "#dc2626" : "#7c3aed";

        function finish(confirmed) {
            modal.hidden = true;

            acceptButton.removeEventListener("click", onConfirm);
            cancelButton.removeEventListener("click", onCancel);
            document.removeEventListener("keydown", onKeyDown);

            if (previousFocus?.focus) {
                previousFocus.focus();
            }

            resolve(confirmed);
        }

        function onConfirm() {
            finish(true);
        }

        function onCancel() {
            finish(false);
        }

        function onKeyDown(event) {
            if (event.key === "Escape") {
                finish(false);
            }
        }

        acceptButton.addEventListener("click", onConfirm);
        cancelButton.addEventListener("click", onCancel);
        document.addEventListener("keydown", onKeyDown);

        modal.hidden = false;
        cancelButton.focus();
    });
}

// =========================================
// MEDIQUEUE CUSTOM INPUT POPUP
// =========================================

function mqPrompt(message, defaultValue = "", options = {}) {
    return new Promise(resolve => {
        const modal = document.getElementById("mq-confirm-modal");
        const title = document.getElementById("mq-confirm-title");
        const messageElement = document.getElementById("mq-confirm-message");
        const icon = document.getElementById("mq-confirm-icon");
        const input = document.getElementById("mq-confirm-input");
        const cancelButton = document.getElementById("mq-confirm-cancel");
        const acceptButton = document.getElementById("mq-confirm-accept");

        if (!modal || !title || !messageElement || !icon ||
            !input || !cancelButton || !acceptButton || !modal.hidden) {
            resolve(null);
            return;
        }

        const previousFocus = document.activeElement;

        title.textContent = options.title || "Enter Details";
        messageElement.textContent = message;
        icon.textContent = "✎";

        icon.style.background = "#ede9fe";
        icon.style.color = "#7c3aed";

        input.value = defaultValue;
        input.placeholder = options.placeholder || "Enter a value";
        input.hidden = false;

        acceptButton.textContent = options.confirmText || "Continue";
        acceptButton.style.background = "#7c3aed";
        cancelButton.textContent = "Cancel";

        function finish(value) {
            modal.hidden = true;
            input.hidden = true;

            acceptButton.removeEventListener("click", onConfirm);
            cancelButton.removeEventListener("click", onCancel);
            document.removeEventListener("keydown", onKeyDown);

            if (previousFocus?.focus) {
                previousFocus.focus();
            }

            resolve(value);
        }

        function onConfirm() {
            finish(input.value);
        }

        function onCancel() {
            finish(null);
        }

        function onKeyDown(event) {
            if (event.key === "Escape") {
                event.preventDefault();
                finish(null);
            } else if (event.key === "Enter" &&
                       document.activeElement === input) {
                event.preventDefault();
                finish(input.value);
            }
        }

        acceptButton.addEventListener("click", onConfirm);
        cancelButton.addEventListener("click", onCancel);
        document.addEventListener("keydown", onKeyDown);

        modal.hidden = false;
        input.focus();
        input.select();
    });
}