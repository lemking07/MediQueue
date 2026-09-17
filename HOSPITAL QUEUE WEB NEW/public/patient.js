// ======================================================
// MEDIQUEUE PATIENT PORTAL V4
// Premium Real-Time Patient Queue System
// ======================================================


// ======================================================
// SOCKET.IO
// ======================================================

const socket =
    typeof io !== "undefined"
        ? io()
        : null;


// ======================================================
// STATE
// ======================================================

let latestData = {
    departments: [],
    portalSettings: {}
};

let currentTicket =
    loadSavedTicket();

let notificationEnabled =
    false;

let audioContext =
    null;

let lastCalledSignature =
    "";


// ======================================================
// DEFAULT PORTAL SETTINGS
// ======================================================

const DEFAULT_PORTAL_SETTINGS = {

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
// ELEMENTS
// ======================================================

const patientPage =
    document.getElementById(
        "patient-page"
    );

const patientSections =
    document.getElementById(
        "patient-sections"
    );

const welcomeSection =
    document.getElementById(
        "patient-welcome-section"
    );

const announcementSection =
    document.getElementById(
        "patient-announcement-section"
    );

const departmentSection =
    document.getElementById(
        "department-section"
    );

const departmentList =
    document.getElementById(
        "department-list"
    ) ||
    document.querySelector(
        ".department-list"
    );

const ticketSection =
    document.getElementById(
        "ticket-section"
    );

const ticketDepartment =
    document.getElementById(
        "ticket-department"
    );

const ticketNumber =
    document.getElementById(
        "ticket-number"
    );

const ticketStatus =
    document.getElementById(
        "ticket-status"
    );

const peopleBefore =
    document.getElementById(
        "people-before"
    );

const queuePositionLabel =
    document.getElementById(
        "queue-position-label"
    );

const queuePositionCard =
    document.getElementById(
        "queue-position-card"
    );

const estimatedWaitPanel =
    document.getElementById(
        "estimated-wait-panel"
    );

const estimatedWaitTime =
    document.getElementById(
        "estimated-wait-time"
    );

const estimatedWaitDescription =
    document.getElementById(
        "estimated-wait-description"
    );

const nextPatientPanel =
    document.getElementById(
        "next-patient-panel"
    );

const nextPatientMessage =
    document.getElementById(
        "next-patient-message"
    );

const roomMessage =
    document.getElementById(
        "room-message"
    );

const assignedRoom =
    document.getElementById(
        "assigned-room"
    );

const completedPanel =
    document.getElementById(
        "completed-panel"
    );

const enableSoundButton =
    document.getElementById(
        "enable-sound-button"
    );

const newQueueButton =
    document.getElementById(
        "new-queue-button"
    );

const connectionBadge =
    document.getElementById(
        "patient-connection"
    );

const connectionText =
    document.getElementById(
        "patient-connection-text"
    );

const patientFooter =
    document.getElementById(
        "patient-footer"
    );

const callOverlay =
    document.getElementById(
        "patient-call-overlay"
    );

const callOverlayNumber =
    document.getElementById(
        "patient-call-overlay-number"
    );

const callOverlayRoom =
    document.getElementById(
        "patient-call-overlay-room"
    );

const callOverlayClose =
    document.getElementById(
        "patient-call-overlay-close"
    );


// ======================================================
// HELPERS
// ======================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {

        element.textContent =
            value ?? "";
    }
}


function setDisplay(
    element,
    display
) {

    if (!element) {
        return;
    }

    element.style.display =
        display;
}


function escapeHtml(value) {

    return String(
        value ?? ""
    )
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


function getPortalSettings() {

    return {
        ...DEFAULT_PORTAL_SETTINGS,
        ...(latestData.portalSettings || {})
    };
}


// ======================================================
// LOAD SERVER DATA
// ======================================================

async function loadData() {

    try {

        const response =
            await fetch(
                "/api/data",
                {
                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Unable to load queue data."
            );
        }


        const data =
            await response.json();


        latestData =
            data;


        renderPortalSettings(
            data.portalSettings || {}
        );


        renderDepartments(
            data.departments || []
        );


        updateCurrentTicket(
    data
);

// Show patient page after branding has loaded
document.body.classList.remove("dashboard-loading");

return data;

    } catch (error) {
    // Show the page even if loading fails
    document.body.classList.remove("dashboard-loading");

        console.error(
            "Unable to load MediQueue:",
            error
        );


        setConnectionStatus(
            false
        );


        return null;
    }
}


// ======================================================
// APPLY PATIENT PORTAL CUSTOMIZATION
// ======================================================

function renderPortalSettings(
    incomingSettings
) {

    const settings = {
        ...DEFAULT_PORTAL_SETTINGS,
        ...(incomingSettings || {})
    };

    const faviconLink = document.getElementById("website-favicon");

if (faviconLink) {
    const favicon = settings.faviconDataUrl || "";

    if (favicon) {
        faviconLink.href = favicon;
        faviconLink.type = favicon.substring(5, favicon.indexOf(";"));
    }
}


    const root =
        document.documentElement;

    const body =
        document.body;



// --------------------------------------------------
// WEBSITE AUTO THEME
// --------------------------------------------------

body.classList.toggle(
    "website-auto-theme-enabled",
    settings.autoThemeFromLogo === true
);


body.dataset.websiteAutoTheme =
    settings.autoThemeFromLogo === true
        ? "true"
        : "false";


    // --------------------------------------------------
    // TEXT
    // --------------------------------------------------

    setText(
        "patient-system-name",
        settings.systemName
    );


    setText(
        "patient-welcome-system-name",
        settings.systemName
    );


    setText(
        "patient-footer-name",
        settings.systemName
    );


    setText(
        "completed-system-name",
        settings.systemName
    );


    setText(
        "patient-welcome-text",
        settings.welcomeText
    );


    document.title =
        `${settings.systemName} - Patient Portal`;


    // --------------------------------------------------
    // THEME COLOR
    // --------------------------------------------------

    const themeMeta =
        document.querySelector(
            'meta[name="theme-color"]'
        );


    if (themeMeta) {

        themeMeta.setAttribute(
            "content",
            settings.primaryColor
        );
    }


    // --------------------------------------------------
    // CSS VARIABLES
    // --------------------------------------------------

    root.style.setProperty(
        "--portal-primary",
        settings.primaryColor
    );


    root.style.setProperty(
        "--teal",
        settings.primaryColor
    );


    root.style.setProperty(
        "--portal-secondary",
        settings.secondaryColor
    );


    root.style.setProperty(
        "--portal-background",
        settings.backgroundColor
    );


    root.style.setProperty(
        "--portal-card",
        settings.cardColor
    );


    root.style.setProperty(
        "--portal-text",
        settings.textColor
    );


    root.style.setProperty(
        "--portal-button-text",
        settings.buttonTextColor
    );


    // --------------------------------------------------
    // DATA ATTRIBUTES FOR CSS
    // --------------------------------------------------

    body.dataset.portalTheme =
        settings.theme;


    body.dataset.backgroundStyle =
        settings.backgroundStyle;


    body.dataset.cardStyle =
        settings.cardStyle;


    body.dataset.buttonStyle =
        settings.buttonStyle;


    body.dataset.portalWidth =
        settings.portalWidth;


    body.dataset.departmentLayout =
        settings.departmentLayout;


    body.dataset.queueButtonPosition =
        settings.queueButtonPosition;


    body.dataset.textAlignment =
        settings.textAlignment;


    // --------------------------------------------------
    // ANIMATIONS
    // --------------------------------------------------

    body.classList.toggle(
        "portal-button-animation",
        settings.buttonAnimation
    );


    body.classList.toggle(
        "portal-card-animation",
        settings.cardAnimation
    );


    body.classList.toggle(
        "portal-called-animation",
        settings.calledAnimation
    );


    // --------------------------------------------------
    // BACKGROUND
    // --------------------------------------------------

    body.style.backgroundColor =
        settings.backgroundColor;


    // --------------------------------------------------
    // LOGO
    // --------------------------------------------------

    applyPatientLogo(
        settings.logoDataUrl
    );


    // --------------------------------------------------
    // BANNER
    // --------------------------------------------------

    applyPatientBanner(
        settings.bannerDataUrl
    );


    // --------------------------------------------------
    // ANNOUNCEMENT
    // --------------------------------------------------

    applyAnnouncement(
        settings
    );


    // --------------------------------------------------
    // SECTION VISIBILITY
    // --------------------------------------------------

    if (welcomeSection) {

        welcomeSection.hidden =
            !settings.showWelcome;
    }


    if (announcementSection) {

        announcementSection.hidden =
            !settings.showAnnouncement;
    }


    if (connectionBadge) {

        connectionBadge.hidden =
            !settings.showConnectionStatus;
    }


    if (patientFooter) {

        patientFooter.hidden =
            !settings.showFooter;
    }


    // --------------------------------------------------
    // QUEUE INFORMATION VISIBILITY
    // --------------------------------------------------

    if (queuePositionCard) {

        queuePositionCard.dataset
            .portalVisible =
            settings.showWaitingCount
                ? "true"
                : "false";
    }


    if (estimatedWaitPanel) {

        estimatedWaitPanel.dataset
            .portalVisible =
            settings.showEstimatedTime
                ? "true"
                : "false";
    }


    // --------------------------------------------------
    // SECTION ORDER
    // --------------------------------------------------

    applySectionOrder(
        settings.sectionOrder
    );
}


// ======================================================
// GLOBAL WEBSITE LOGO
// ======================================================

function applyPatientLogo(
    logoDataUrl
) {

    const hasCustomLogo =
        typeof logoDataUrl === "string" &&
        logoDataUrl.startsWith(
            "data:image/"
        );


    // --------------------------------------------------
    // HEADER LOGO
    // --------------------------------------------------

    updatePatientWebsiteLogoPair(
        "patient-custom-logo",
        "patient-default-logo",
        logoDataUrl,
        hasCustomLogo,
        "block",
        "flex"
    );


    // --------------------------------------------------
    // WELCOME / HERO LOGO
    // --------------------------------------------------

    updatePatientWebsiteLogoPair(
        "welcome-custom-logo",
        "welcome-default-logo",
        logoDataUrl,
        hasCustomLogo,
        "block",
        "flex"
    );


    // --------------------------------------------------
    // DEPARTMENT HEADING LOGO
    // --------------------------------------------------

    updatePatientWebsiteLogoPair(
        "department-heading-custom-logo",
        "department-heading-default-logo",
        logoDataUrl,
        hasCustomLogo,
        "block",
        "flex"
    );


    // --------------------------------------------------
    // FOOTER LOGO
    // --------------------------------------------------

    updatePatientWebsiteLogoPair(
        "footer-custom-logo",
        "footer-default-logo",
        logoDataUrl,
        hasCustomLogo,
        "block",
        "flex"
    );


    document.body.classList.toggle(
        "patient-has-custom-website-logo",
        hasCustomLogo
    );
}



// ======================================================
// UPDATE ONE GLOBAL LOGO LOCATION
// ======================================================

function updatePatientWebsiteLogoPair(
    customLogoId,
    defaultLogoId,
    logoDataUrl,
    hasCustomLogo,
    customDisplay = "block",
    defaultDisplay = "flex"
) {

    const customLogo =
        document.getElementById(
            customLogoId
        );


    const defaultLogo =
        document.getElementById(
            defaultLogoId
        );


    if (
        !customLogo ||
        !defaultLogo
    ) {

        return;
    }


    if (hasCustomLogo) {

        customLogo.src =
            logoDataUrl;


        customLogo.style.display =
            customDisplay;


        defaultLogo.style.display =
            "none";


    } else {

        customLogo.removeAttribute(
            "src"
        );


        customLogo.style.display =
            "none";


        defaultLogo.style.display =
            defaultDisplay;
    }
}


// ======================================================
// BANNER
// ======================================================

function applyPatientBanner(
    bannerDataUrl
) {

    const banner =
        document.getElementById(
            "patient-banner"
        );


    const image =
        document.getElementById(
            "patient-banner-image"
        );


    if (
        !banner ||
        !image
    ) {
        return;
    }


    if (bannerDataUrl) {

        image.src =
            bannerDataUrl;


        banner.style.display =
            "block";

    } else {

        image.removeAttribute(
            "src"
        );


        banner.style.display =
            "none";
    }
}


// ======================================================
// ANNOUNCEMENT
// ======================================================

function applyAnnouncement(
    settings
) {

    const box =
        document.getElementById(
            "patient-announcement"
        );


    const text =
        document.getElementById(
            "patient-announcement-text"
        );


    if (
        !box ||
        !text
    ) {
        return;
    }


    const announcement =
        String(
            settings.announcement || ""
        ).trim();


    if (
        settings.showAnnouncement &&
        announcement
    ) {

        text.textContent =
            announcement;


        box.style.display =
            "flex";

    } else {

        text.textContent =
            "";


        box.style.display =
            "none";
    }
}


// ======================================================
// SECTION ORDER
// ======================================================

function applySectionOrder(
    requestedOrder
) {

    if (!patientSections) {
        return;
    }


    const validSections = [
        "welcome",
        "announcement",
        "departments",
        "ticket"
    ];


    const requested =
        Array.isArray(requestedOrder)
            ? requestedOrder
            : [];


    const safeOrder = [];


    requested.forEach(
        section => {

            if (
                validSections.includes(
                    section
                ) &&
                !safeOrder.includes(
                    section
                )
            ) {

                safeOrder.push(
                    section
                );
            }
        }
    );


    validSections.forEach(
        section => {

            if (
                !safeOrder.includes(
                    section
                )
            ) {

                safeOrder.push(
                    section
                );
            }
        }
    );


    safeOrder.forEach(
        section => {

            const element =
                patientSections.querySelector(
                    `[data-portal-section="${section}"]`
                );


            if (element) {

                patientSections.appendChild(
                    element
                );
            }
        }
    );
}

// ======================================================
// SMART AUTOMATIC DEPARTMENT ICONS
// ======================================================

function getDepartmentIcon(departmentName) {

    const name = String(departmentName || "")
        .toLowerCase()
        .trim();

    const icons = [

        // CARDIOLOGY
        {
            keywords: ["cardiology", "cardiac", "heart", "chest", "heartbeat"],
            type: "cardiology",
            svg: `
                <svg viewBox="0 0 24 24">
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>
                    <path d="M5.5 12h3l1.4-2.7 2.2 5.2 1.5-3h4.8"/>
                </svg>
            `
        },

        // EYE
        {
            keywords: [
                "eye",
                "ophthalmology",
                "ophthalmologist",
                "optometry",
                "vision"
            ],
            type: "eye",
            svg: `
                <svg viewBox="0 0 24 24">
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
            `
        },

        // DERMATOLOGY / SKIN
        {
            keywords: [
                "dermatology",
                "dermatologist",
                "skin",
                "derma"
            ],
            type: "dermatology",
            svg: `
                <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="8"/>
                    <path d="M9 10h.01M15 10h.01"/>
                    <path d="M9 15c1.8 1.2 4.2 1.2 6 0"/>
                    <path d="M6.5 7.5c1.2-2 3.2-3.3 5.5-3.3 2.4 0 4.4 1.3 5.5 3.3"/>
                </svg>
            `
        },

        // DENTAL
        {
            keywords: [
                "dental",
                "dentist",
                "dentistry",
                "tooth"
            ],
            type: "dental",
            svg: `
                <svg viewBox="0 0 24 24">
                    <path d="M8.2 3.2c1.3 0 2.4.7 3.8.7s2.5-.7 3.8-.7c2.7 0 4.4 2.1 4.2 5-.2 2.5-1.3 4.2-2 6.4-.7 2.3-.9 5.8-2.8 6.1-1.6.2-1.7-4.6-3.2-4.6s-1.6 4.8-3.2 4.6c-1.9-.3-2.1-3.8-2.8-6.1-.7-2.2-1.8-3.9-2-6.4-.2-2.9 1.5-5 4.2-5Z"/>
                </svg>
            `
        },

        // PEDIATRICS
        {
            keywords: [
                "pediatrics",
                "pediatric",
                "paediatrics",
                "paediatric",
                "children",
                "child"
            ],
            type: "pediatrics",
            svg: `
                <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="13" r="7"/>
                    <path d="M9 11h.01M15 11h.01"/>
                    <path d="M9.5 15c1.5 1.3 3.5 1.3 5 0"/>
                    <path d="M10 6c0-2 1.5-3 3-3"/>
                </svg>
            `
        },

        // ORTHOPEDICS
        {
            keywords: [
                "orthopedic",
"orthopedics",
"orthopaedic",
"orthopaedics",
"bone",
"leg",
"hand",
"arm",
"foot",
"feet",
"knee",
"ankle",
"elbow",
"wrist",
"shoulder",
"hip",
"fracture"
            ],
            type: "orthopedics",
            svg: `
                <svg viewBox="0 0 24 24">
                    <path d="M8 8l8 8"/>
                    <path d="M7 9a3 3 0 1 1-4-4 3 3 0 1 1 4-4c1.4 1.4 1.5 3.6.3 5"/>
                    <path d="M17 15a3 3 0 1 1 4 4 3 3 0 1 1-4 4c-1.4-1.4-1.5-3.6-.3-5"/>
                </svg>
            `
        },

        // NEUROLOGY
        {
            keywords: [
                "neurology",
                "neurologist",
                "brain",
                "neuro"
            ],
            type: "neurology",
            svg: `
                <svg viewBox="0 0 24 24">
                    <path d="M9.5 4.5A3 3 0 0 0 5 7a3 3 0 0 0-1 5.5A3.5 3.5 0 0 0 7.5 18H10V5.5a2 2 0 0 0-.5-1Z"/>
                    <path d="M14.5 4.5A3 3 0 0 1 19 7a3 3 0 0 1 1 5.5 3.5 3.5 0 0 1-3.5 5.5H14V5.5a2 2 0 0 1 .5-1Z"/>
                    <path d="M7 9h3M14 9h3M7 14h3M14 14h3"/>
                </svg>
            `
        },

        // ENT / EAR
        {
            keywords: [
                "ent",
                "ear",
                "nose",
                "throat",
                "otolaryngology"
            ],
            type: "ent",
            svg: `
                <svg viewBox="0 0 24 24">
                    <path d="M9 18c0-3 4-3.5 4-7a3 3 0 1 0-6 0"/>
                    <path d="M9 18c0 2 1 3 3 3 2.5 0 4-1.5 4-4"/>
                    <path d="M10 11c0-1.2.8-2 2-2s2 .8 2 2c0 1.8-2 2-2 4"/>
                </svg>
            `
        },

        // LUNGS
        {
            keywords: [
                "pulmonology",
                "respiratory",
                "lung",
                "lungs",
                
            ],
            type: "pulmonology",
            svg: `
                <svg viewBox="0 0 24 24">
                    <path d="M11 4v7"/>
                    <path d="M13 4v7"/>
                    <path d="M11 9c-2-1-3-4-5-3-2.5 1-3.5 7-2.5 11 1 3.5 5.5 3 7.5 1V9Z"/>
                    <path d="M13 9c2-1 3-4 5-3 2.5 1 3.5 7 2.5 11-1 3.5-5.5 3-7.5 1V9Z"/>
                </svg>
            `
        },
        // BLOOD BANK / HEMATOLOGY
{
    keywords: [
        "blood",
        "blood bank",
        "hematology",
        "haematology",
        "transfusion",
        "donor"
    ],
    type: "blood",
    svg: `
        <svg viewBox="0 0 24 24">
            <path d="M12 2.5S6.5 9 6.5 14a5.5 5.5 0 0 0 11 0C17.5 9 12 2.5 12 2.5Z"/>
            <path d="M9.5 15.5c.6 1.2 1.5 1.8 2.8 1.9"/>
        </svg>
    `
},
// PREGNANCY / MATERNITY / OBSTETRICS
{
    keywords: [
        "pregnant",
        "pregnancy",
        "maternity",
        "obstetric",
        "obstetrics",
        "antenatal",
        "prenatal",
        "mother",
        "maternity ward"
    ],
    type: "maternity",
    svg: `
        <svg viewBox="0 0 24 24">
            <circle cx="10" cy="5" r="2.2"/>
            <path d="M10 7.5v5"/>
            <path d="M10 9c4 0 6.5 2.3 6.5 5.5S14.5 20 11.5 20"/>
            <path d="M10 12.5 7.5 20"/>
            <path d="M10 12.5 13 20"/>
            <path d="M7 10.5c1.5 1.2 3.5 1.5 5 .8"/>
        </svg>
    `
},

// GASTROENTEROLOGY / STOMACH
{
    keywords: [
        "gastroenterology",
        "gastro",
        "stomach",
        "abdomen",
        "abdominal",
        "digestive",
        "intestine",
        "bowel",
        "colon",
        "liver",
        "pancreas"
    ],
    type: "gastroenterology",
    svg: `
        <svg viewBox="0 0 24 24">
            <path d="M11 3v7c0 2-2 3-4 3-2.5 0-4 2-4 4a4 4 0 0 0 4 4h6c4 0 8-3 8-8 0-4-2-6-5-6-2 0-3 1-3 3V3"/>
        </svg>
    `
},

// ONCOLOGY / CANCER
{
    keywords: [
        "oncology",
        "oncologist",
        "cancer",
        "chemotherapy",
        "radiotherapy"
    ],
    type: "oncology",
    svg: `
        <svg viewBox="0 0 24 24">
            <path d="M12 3c-2 3-4 5-4 9s2 7 4 9"/>
            <path d="M12 3c2 3 4 5 4 9s-2 7-4 9"/>
            <path d="M8 8h8M8 16h8"/>
            <circle cx="12" cy="12" r="2"/>
        </svg>
    `
},

// PHYSIOTHERAPY / REHABILITATION
{
    keywords: [
        "physiotherapy",
        "physiotherapist",
        "physical therapy",
        "rehabilitation",
        "rehab"
    ],
    type: "physiotherapy",
    svg: `
        <svg viewBox="0 0 24 24">
            <circle cx="12" cy="4" r="2"/>
            <path d="M12 7v7"/>
            <path d="M7 10l5-3 5 3"/>
            <path d="M12 14l-5 7"/>
            <path d="M12 14l5 7"/>
        </svg>
    `
},


// ALLERGY / IMMUNOLOGY
{
    keywords: [
        "allergy",
        "allergies",
        "allergic",
        "immunology",
        "immunologist"
    ],
    type: "allergy",
    svg: `
        <svg viewBox="0 0 24 24">
            <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-4Z"/>
            <path d="M12 7v10M7 12h10"/>
        </svg>
    `
},

        // UROLOGY / KIDNEY
        {
            keywords: [
    "urology",
    "urologist",
    "kidney",
    "renal",
    "dialysis"
],
            type: "urology",
            svg: `
                <svg viewBox="0 0 24 24">
                    <path d="M9.5 4C6 3 3.5 6 4 10c.5 4 3 6 6 5V8"/>
                    <path d="M14.5 4c3.5-1 6 2 5.5 6-.5 4-3 6-6 5V8"/>
                    <path d="M10 14v5M14 14v5"/>
                    <path d="M10 19c1 2 3 2 4 0"/>
                </svg>
            `
        },

        // GYNECOLOGY
        {
            keywords: [
                "gynecology",
                "gynaecology",
                "obgyn",
                "ob/gyn",
                "maternity",
                "women"
            ],
            type: "gynecology",
            svg: `
                <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="9" r="5"/>
                    <path d="M12 14v7M9 18h6"/>
                </svg>
            `
        },

        // LAB
        {
            keywords: [
                "laboratory",
                "lab",
                "pathology",
                "blood test"
            ],
            type: "laboratory",
            svg: `
                <svg viewBox="0 0 24 24">
                    <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/>
                    <path d="M7.5 16h9"/>
                </svg>
            `
        },

        // RADIOLOGY
        {
            keywords: [
                "radiology",
                "radiologist",
                "x-ray",
                "xray",
                "imaging",
                "mri",
                "ct scan"
            ],
            type: "radiology",
            svg: `
                <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="8"/>
                    <path d="M12 4v16M4 12h16"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
            `
        },

        // PHARMACY
        {
            keywords: [
                "pharmacy",
                "pharmacist",
                "medicine",
                "medication"
            ],
            type: "pharmacy",
            svg: `
                <svg viewBox="0 0 24 24">
                    <path d="M8 4h8v4l-8 8a4 4 0 0 1-5.7-5.7L8 4Z"/>
                    <path d="m7 9 8 8"/>
                </svg>
            `
        },

        // EMERGENCY
        {
            keywords: [
                "emergency",
                "trauma",
                "accident",
                "a&e"
            ],
            type: "emergency",
            svg: `
                <svg viewBox="0 0 24 24">
                    <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>
                </svg>
            `
        },

        // SURGERY
        {
            keywords: [
                "surgery",
                "surgical",
                "operation",
                "operating theatre"
            ],
            type: "surgery",
            svg: `
                <svg viewBox="0 0 24 24">
                    <path d="m4 20 5-5"/>
                    <path d="m8 16 8-8"/>
                    <path d="m14 6 2-2 4 4-2 2"/>
                    <path d="M3 21h6"/>
                </svg>
            `
        },

        // PSYCHIATRY / MENTAL HEALTH
        {
            keywords: [
                "psychiatry",
                "psychiatric",
                "mental health",
                "psychology",
                "psychologist"
            ],
            type: "psychiatry",
            svg: `
                <svg viewBox="0 0 24 24">
                    <path d="M12 3a8 8 0 0 0-4 15v3"/>
                    <path d="M12 3a7 7 0 0 1 7 7c0 3-1.5 4-3 5v3h-4"/>
                    <path d="M9 9c1-2 5-2 6 0"/>
                    <path d="M10 13h4"/>
                </svg>
            `
        },

        // GENERAL MEDICINE
        {
            keywords: [
                "general medicine",
                "general",
                "medical",
                "clinic",
                "outpatient"
            ],
            type: "general",
            svg: `
                <svg viewBox="0 0 24 24">
                    <circle cx="9" cy="8" r="3"/>
                    <circle cx="17" cy="9" r="2"/>
                    <path d="M3.5 20v-2c0-3 2.4-5 5.5-5s5.5 2 5.5 5v2"/>
                    <path d="M15 14c3 0 5.5 1.7 5.5 4.5V20"/>
                </svg>
            `
        }

    ];


    const matchedIcon =
        icons.find(item =>
            item.keywords.some(keyword =>
                name.includes(keyword)
            )
        );


    if (matchedIcon) {

        return {
            type: matchedIcon.type,
            svg: matchedIcon.svg
        };
    }


    // Unknown/new department
    return {
        type: "default",
        svg: `
            <svg viewBox="0 0 24 24">
                <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>
            </svg>
        `
    };
}
// ======================================================
// RENDER DEPARTMENTS
// ======================================================

function renderDepartments(
    departments
) {

    if (!departmentList) {
        return;
    }


    departmentList.innerHTML =
        "";


    const openDepartments =
        departments.filter(
            department =>
                department.open
        );


    if (
        openDepartments.length === 0
    ) {

        departmentList.innerHTML = `

            <div class="patient-empty-state">

                <div class="patient-empty-icon">
                    +
                </div>

                <strong>
                    No departments are currently open
                </strong>

                <p>
                    Please check again later or speak
                    to hospital staff for assistance.
                </p>

            </div>

        `;

        return;
    }


    openDepartments.forEach(
        (department, index) => {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "department-button";


            button.dataset
                .departmentId =
                department.id;


            button.style
                .setProperty(
                    "--department-index",
                    index
                );


            const waitingCount =
                department.waiting
                    ?.length || 0;


            const estimatedMinutes =
                Number(
                    department.estimatedMinutes
                ) || 5;


            const roomCount =
                department.rooms
                    ?.length || 0;


            const availableRooms =
                (
                    department.rooms || []
                )
                    .filter(
                        room =>
                            !room.currentQueue
                    )
                    .length;

const departmentIcon =
    getDepartmentIcon(
        department.name
    );
    // --------------------------------------------------
// CUSTOM DEPARTMENT LOGO
// Priority:
// 1. Custom uploaded logo
// 2. Automatic medical icon
// 3. Default medical cross
// --------------------------------------------------

const hasCustomDepartmentLogo =
    typeof department.logoDataUrl === "string" &&
    department.logoDataUrl.startsWith("data:image/");


const departmentLogoMarkup =
    hasCustomDepartmentLogo

        ? `
            <div class="department-symbol department-custom-logo-wrapper">

                <img
                    src="${escapeHtml(
                        department.logoDataUrl
                    )}"
                    alt="${escapeHtml(
                        department.name
                    )} logo"
                    class="department-custom-logo"
                >

            </div>
        `

        : `
            <div class="department-symbol department-medical-icon ${departmentIcon.type}">
                ${departmentIcon.svg}
            </div>
        `;
            button.innerHTML = `

                ${departmentLogoMarkup}

                    <div class="department-open-badge">
                        OPEN
                    </div>

                </div>


                <div class="department-button-main">

                    <strong>
                        ${escapeHtml(
                            department.name
                        )}
                    </strong>

                    <span>
                        Queue prefix
                        ${escapeHtml(
                            department.prefix
                        )}
                    </span>

                </div>


                <div class="department-button-info">

                    <div class="department-info-item">

                        <span>
                            Waiting
                        </span>

                        <strong>
                            ${waitingCount}
                        </strong>

                    </div>


                    <div class="department-info-item">

                        <span>
                            Est. service
                        </span>

                        <strong>
                            ~${estimatedMinutes} min
                        </strong>

                    </div>


                    <div class="department-info-item">

                        <span>
                            Rooms
                        </span>

                        <strong>
                            ${availableRooms}/${roomCount}
                        </strong>

                    </div>

                </div>


                <div class="department-select-action">

                    <span>
                        Select Department
                    </span>

                    <span class="department-arrow">
                        →
                    </span>

                </div>

            `;


            button.addEventListener(
                "click",
                () => {

                    takeQueueNumber(
                        department.id
                    );
                }
            );


            departmentList.appendChild(
                button
            );
        }
    );
}


// ======================================================
// DISABLE DEPARTMENT BUTTONS
// ======================================================

function disableDepartmentButtons(
    disabled
) {

    document
        .querySelectorAll(
            ".department-button"
        )
        .forEach(
            button => {

                button.disabled =
                    disabled;
            }
        );
}


// ======================================================
// TAKE QUEUE NUMBER
// ======================================================

async function takeQueueNumber(
    departmentId
) {

    if (currentTicket) {

        const confirmed =
    await mqConfirm(
        "You already have a queue number on this device. Take a new queue number?"
    );


        if (!confirmed) {
            return;
        }
    }


    try {

        disableDepartmentButtons(
            true
        );


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

            showToast(
    result.error || "Unable to take queue number.",
    "error"
);

            return;
        }


        currentTicket = {

            queueNumber:
                result.queueNumber,

            departmentId:
                Number(
                    departmentId
                ),

            departmentName:
                result.department,

            createdAt:
                Date.now()
        };


        saveTicket(
            currentTicket
        );


        showTicket();


        await loadData();


        scrollToTicket();

    } catch (error) {

        console.error(
            "Take queue error:",
            error
        );


        showToast(
    "Unable to connect to MediQueue. Please try again.",
    "error"
);

    } finally {

        disableDepartmentButtons(
            false
        );
    }
}


// ======================================================
// SHOW TICKET
// ======================================================

function showTicket() {

    if (!currentTicket) {
        return;
    }


    if (departmentSection) {

        departmentSection.style.display =
            "none";
    }


    if (ticketSection) {

        ticketSection.style.display =
            "block";
    }


    if (ticketNumber) {

        ticketNumber.textContent =
            currentTicket.queueNumber;
    }


    if (ticketDepartment) {

        ticketDepartment.textContent =
            currentTicket.departmentName ||
            "Department";
    }
}


// ======================================================
// SHOW DEPARTMENT SELECTION
// ======================================================

function showDepartmentSelection() {

    if (departmentSection) {

        departmentSection.style.display =
            "";
    }


    if (ticketSection) {

        ticketSection.style.display =
            "none";
    }


    hideCallOverlay();
}


// ======================================================
// SCROLL TO TICKET
// ======================================================

function scrollToTicket() {

    try {

        ticketSection?.scrollIntoView({
            behavior:
                "smooth",

            block:
                "start"
        });

    } catch (error) {

        window.scrollTo(
            0,
            0
        );
    }
}
// ======================================================
// PATIENT.JS — PART 2
// QUEUE STATUS + TICKET STATES
// ======================================================


// ======================================================
// UPDATE CURRENT TICKET
// ======================================================

function updateCurrentTicket(
    data
) {

    if (!currentTicket) {

        showDepartmentSelection();

        return;
    }


    showTicket();


    const departments =
        data.departments || [];


    const department =
        departments.find(
            dept =>
                Number(dept.id) ===
                Number(
                    currentTicket.departmentId
                )
        );


    if (!department) {

        showTicketUnavailable();

        return;
    }


    // Keep department name updated if staff renamed it.

    currentTicket.departmentName =
        department.name;


    saveTicket(
        currentTicket
    );


    if (ticketDepartment) {

        ticketDepartment.textContent =
            department.name;
    }


    if (ticketNumber) {

        ticketNumber.textContent =
            currentTicket.queueNumber;
    }


    resetTicketPanels();


    // --------------------------------------------------
    // CHECK IF PATIENT IS CURRENTLY IN A ROOM
    // --------------------------------------------------

    const activeRoom =
        (
            department.rooms || []
        ).find(
            room =>
                room.currentQueue ===
                currentTicket.queueNumber
        );


    if (activeRoom) {

        showCalledStatus(
            activeRoom
        );

        return;
    }


    // --------------------------------------------------
    // CHECK IF VISIT IS COMPLETED
    // --------------------------------------------------

    const completed =
        (
            department.completed || []
        ).includes(
            currentTicket.queueNumber
        );


    if (completed) {

        showCompletedStatus();

        return;
    }


    // --------------------------------------------------
    // CHECK WAITING POSITION
    // --------------------------------------------------

    const waitingIndex =
        (
            department.waiting || []
        ).indexOf(
            currentTicket.queueNumber
        );


    if (
        waitingIndex !== -1
    ) {

        showWaitingStatus(
            department,
            waitingIndex
        );

        return;
    }


    // --------------------------------------------------
    // TICKET IS NO LONGER IN SERVER QUEUE
    // --------------------------------------------------

    showTicketUnavailable();
}


// ======================================================
// RESET TICKET PANELS
// ======================================================

function resetTicketPanels() {

    if (estimatedWaitPanel) {

        estimatedWaitPanel.style.display =
            "none";
    }


    if (nextPatientPanel) {

        nextPatientPanel.style.display =
            "none";
    }


    if (roomMessage) {

        roomMessage.style.display =
            "none";
    }


    if (completedPanel) {

        completedPanel.style.display =
            "none";
    }


    if (queuePositionCard) {

        const settings =
            getPortalSettings();


        queuePositionCard.style.display =
            settings.showWaitingCount
                ? ""
                : "none";
    }


    if (enableSoundButton) {

        enableSoundButton.style.display =
            "";
    }
}


// ======================================================
// WAITING STATUS
// ======================================================

function showWaitingStatus(
    department,
    peopleAhead
) {

    const settings =
        getPortalSettings();


    if (ticketStatus) {

        ticketStatus.textContent =
            "WAITING";


        ticketStatus.dataset.status =
            "waiting";
    }


    if (roomMessage) {

        roomMessage.style.display =
            "none";
    }


    if (completedPanel) {

        completedPanel.style.display =
            "none";
    }


    // --------------------------------------------------
    // WAITING COUNT VISIBILITY
    // --------------------------------------------------

    if (queuePositionCard) {

        queuePositionCard.style.display =
            settings.showWaitingCount
                ? ""
                : "none";
    }


    // --------------------------------------------------
    // PATIENT IS NEXT
    // --------------------------------------------------

    if (
        peopleAhead === 0
    ) {

        if (queuePositionLabel) {

            queuePositionLabel.textContent =
                "Queue Position";
        }


        if (peopleBefore) {

            peopleBefore.textContent =
                "NEXT";
        }


        if (nextPatientPanel) {

            nextPatientPanel.style.display =
                "flex";
        }


        if (nextPatientMessage) {

            nextPatientMessage.textContent =
                "Please stay nearby. You will be called when a room is available.";
        }


        if (estimatedWaitPanel) {

            estimatedWaitPanel.style.display =
                "none";
        }


        return;
    }


    // --------------------------------------------------
    // PATIENTS ARE AHEAD
    // --------------------------------------------------

    if (queuePositionLabel) {

        queuePositionLabel.textContent =
            peopleAhead === 1
                ? "Person Before You"
                : "People Before You";
    }


    if (peopleBefore) {

        peopleBefore.textContent =
            peopleAhead;
    }


    const minutesPerPatient =
        Number(
            department.estimatedMinutes
        ) || 5;


    const estimatedMinutes =
        peopleAhead *
        minutesPerPatient;


    if (estimatedWaitTime) {

        estimatedWaitTime.textContent =
            formatEstimatedTime(
                estimatedMinutes
            );
    }


    if (estimatedWaitDescription) {

        estimatedWaitDescription.textContent =
            `${peopleAhead} ${
                peopleAhead === 1
                    ? "patient is"
                    : "patients are"
            } currently ahead of you. Estimated at about ${minutesPerPatient} minutes per patient.`;
    }


    if (estimatedWaitPanel) {

        estimatedWaitPanel.style.display =
            settings.showEstimatedTime
                ? "flex"
                : "none";
    }
}


// ======================================================
// FORMAT ESTIMATED WAITING TIME
// ======================================================

function formatEstimatedTime(
    totalMinutes
) {

    const minutesNumber =
        Math.max(
            0,
            Number(totalMinutes) || 0
        );


    if (
        minutesNumber < 60
    ) {

        return `About ${minutesNumber} ${
            minutesNumber === 1
                ? "minute"
                : "minutes"
        }`;
    }


    const hours =
        Math.floor(
            minutesNumber / 60
        );


    const minutes =
        minutesNumber % 60;


    if (
        minutes === 0
    ) {

        return `About ${hours} ${
            hours === 1
                ? "hour"
                : "hours"
        }`;
    }


    return (
        `About ${hours} ` +
        `${hours === 1 ? "hour" : "hours"} ` +
        `${minutes} minutes`
    );
}


// ======================================================
// CALLED STATUS
// ======================================================

function showCalledStatus(
    room
) {

    if (ticketStatus) {

        ticketStatus.textContent =
            "CALLED";


        ticketStatus.dataset.status =
            "called";
    }


    if (queuePositionLabel) {

        queuePositionLabel.textContent =
            "Queue Status";
    }


    if (peopleBefore) {

        peopleBefore.textContent =
            "CALLED";
    }


    if (estimatedWaitPanel) {

        estimatedWaitPanel.style.display =
            "none";
    }


    if (nextPatientPanel) {

        nextPatientPanel.style.display =
            "none";
    }


    if (assignedRoom) {

        assignedRoom.textContent =
            formatRoomName(
                room.number
            );
    }


    if (roomMessage) {

        roomMessage.style.display =
            "block";
    }


    const settings =
        getPortalSettings();


    if (
        settings.calledAnimation &&
        roomMessage
    ) {

        roomMessage.classList.remove(
            "called-panel-active"
        );


        void roomMessage.offsetWidth;


        roomMessage.classList.add(
            "called-panel-active"
        );
    }
}


// ======================================================
// COMPLETED STATUS
// ======================================================

function showCompletedStatus() {

    if (ticketStatus) {

        ticketStatus.textContent =
            "COMPLETED";


        ticketStatus.dataset.status =
            "completed";
    }


    if (queuePositionLabel) {

        queuePositionLabel.textContent =
            "Queue Status";
    }


    if (peopleBefore) {

        peopleBefore.textContent =
            "DONE";
    }


    if (estimatedWaitPanel) {

        estimatedWaitPanel.style.display =
            "none";
    }


    if (nextPatientPanel) {

        nextPatientPanel.style.display =
            "none";
    }


    if (roomMessage) {

        roomMessage.style.display =
            "none";
    }


    if (completedPanel) {

        completedPanel.style.display =
            "flex";
    }


    if (enableSoundButton) {

        enableSoundButton.style.display =
            "none";
    }


    hideCallOverlay();
}


// ======================================================
// TICKET UNAVAILABLE
// ======================================================

function showTicketUnavailable() {

    if (ticketStatus) {

        ticketStatus.textContent =
            "NO LONGER ACTIVE";


        ticketStatus.dataset.status =
            "inactive";
    }


    if (queuePositionLabel) {

        queuePositionLabel.textContent =
            "Queue Status";
    }


    if (peopleBefore) {

        peopleBefore.textContent =
            "-";
    }


    if (estimatedWaitPanel) {

        estimatedWaitPanel.style.display =
            "none";
    }


    if (nextPatientPanel) {

        nextPatientPanel.style.display =
            "none";
    }


    if (roomMessage) {

        roomMessage.style.display =
            "none";
    }


    if (completedPanel) {

        completedPanel.style.display =
            "none";
    }


    hideCallOverlay();
}


// ======================================================
// ROOM NAME FORMAT
// ======================================================

function formatRoomName(
    roomNumber
) {

    const value =
        String(
            roomNumber ?? ""
        ).trim();


    if (!value) {

        return "Room";
    }


    if (
        /^room\b/i.test(
            value
        )
    ) {

        return value;
    }


    return `Room ${value}`;
}


// ======================================================
// NEW QUEUE NUMBER
// ======================================================

if (newQueueButton) {

    newQueueButton.addEventListener(
        "click",
        async () => {

            const confirmed =
    await mqConfirm(
        "Return to department selection? Your saved queue ticket on this device will be cleared."
    );


            if (!confirmed) {
                return;
            }


            clearSavedTicket();


            currentTicket =
                null;


            lastCalledSignature =
                "";


            if (enableSoundButton) {

                enableSoundButton.style.display =
                    "";
            }


            showDepartmentSelection();


            renderDepartments(
                latestData.departments || []
            );


            try {

                departmentSection
                    ?.scrollIntoView({
                        behavior:
                            "smooth",

                        block:
                            "start"
                    });

            } catch (error) {

                window.scrollTo(
                    0,
                    0
                );
            }
        }
    );
}


// ======================================================
// LOCAL STORAGE
// ======================================================

function saveTicket(
    ticket
) {

    try {

        localStorage.setItem(
            "mediqueue_patient_ticket",
            JSON.stringify(
                ticket
            )
        );

    } catch (error) {

        console.error(
            "Unable to save patient ticket:",
            error
        );
    }
}


function loadSavedTicket() {

    try {

        const saved =
            localStorage.getItem(
                "mediqueue_patient_ticket"
            );


        if (!saved) {

            return null;
        }


        const parsed =
            JSON.parse(
                saved
            );


        if (
            !parsed ||
            !parsed.queueNumber ||
            !parsed.departmentId
        ) {

            return null;
        }


        return parsed;

    } catch (error) {

        console.error(
            "Unable to load saved ticket:",
            error
        );


        return null;
    }
}


function clearSavedTicket() {

    try {

        localStorage.removeItem(
            "mediqueue_patient_ticket"
        );

    } catch (error) {

        console.error(
            "Unable to clear ticket:",
            error
        );
    }
}


// ======================================================
// CALL OVERLAY
// ======================================================

function showCallOverlay(
    queueNumber,
    room
) {

    if (!callOverlay) {
        return;
    }


    if (callOverlayNumber) {

        callOverlayNumber.textContent =
            queueNumber ||
            currentTicket?.queueNumber ||
            "";
    }


    if (callOverlayRoom) {

        callOverlayRoom.textContent =
            formatRoomName(
                room
            );
    }


    callOverlay.style.display =
        "flex";


    document.body.classList.add(
        "patient-call-overlay-open"
    );


    const settings =
        getPortalSettings();


    if (
        settings.calledAnimation
    ) {

        callOverlay.classList.remove(
            "patient-call-overlay-active"
        );


        void callOverlay.offsetWidth;


        callOverlay.classList.add(
            "patient-call-overlay-active"
        );
    }
}


function hideCallOverlay() {

    if (!callOverlay) {
        return;
    }


    callOverlay.style.display =
        "none";


    callOverlay.classList.remove(
        "patient-call-overlay-active"
    );


    document.body.classList.remove(
        "patient-call-overlay-open"
    );
}


if (callOverlayClose) {

    callOverlayClose.addEventListener(
        "click",
        hideCallOverlay
    );
}


// ======================================================
// CONNECTION STATUS
// ======================================================

function setConnectionStatus(
    connected
) {

    if (!connectionBadge) {
        return;
    }


    if (connected) {

        connectionBadge.className =
            "connection-badge online";


        if (connectionText) {

            connectionText.textContent =
                "Live";

        } else {

            connectionBadge.textContent =
                "● Live";
        }

    } else {

        connectionBadge.className =
            "connection-badge offline";


        if (connectionText) {

            connectionText.textContent =
                "Reconnecting...";

        } else {

            connectionBadge.textContent =
                "● Reconnecting";
        }
    }


    const settings =
        getPortalSettings();


    connectionBadge.hidden =
        !settings.showConnectionStatus;
}
// ======================================================
// PATIENT.JS — PART 3 FINAL
// SOUND + NOTIFICATIONS + REAL-TIME + STARTUP
// ======================================================


// ======================================================
// ENABLE SOUND & NOTIFICATIONS
// ======================================================

if (enableSoundButton) {

    enableSoundButton.addEventListener(
        "click",
        async () => {

            try {

                await enableAudio();


                if (
                    "Notification" in window
                ) {

                    if (
                        Notification.permission ===
                        "default"
                    ) {

                        const permission =
                            await Notification
                                .requestPermission();


                        notificationEnabled =
                            permission ===
                            "granted";

                    } else {

                        notificationEnabled =
                            Notification.permission ===
                            "granted";
                    }
                }


                enableSoundButton.innerHTML = `
                    <span class="button-icon">✓</span>
                    <span>Sound & Notifications Enabled</span>
                `;


                enableSoundButton.disabled =
                    true;


                await playNotificationSound(
                    false,
                    "call"
                );


                if (
                    navigator.vibrate
                ) {

                    navigator.vibrate(
                        100
                    );
                }

            } catch (error) {

                console.error(
                    "Notification setup error:",
                    error
                );


                enableSoundButton.innerHTML = `
                    <span class="button-icon">✓</span>
                    <span>Sound Enabled</span>
                `;


                enableSoundButton.disabled =
                    true;
            }
        }
    );
}


// ======================================================
// AUDIO CONTEXT
// ======================================================

async function enableAudio() {

    if (!audioContext) {

        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;


        if (
            !AudioContextClass
        ) {

            return null;
        }


        audioContext =
            new AudioContextClass();
    }


    if (
        audioContext.state ===
        "suspended"
    ) {

        try {

            await audioContext.resume();

        } catch (error) {

            console.warn(
                "Unable to resume audio:",
                error
            );
        }
    }


    return audioContext;
}


// ======================================================
// CREATE AUDIO TONE
// ======================================================

function createPatientTone(
    frequency,
    startTime,
    duration,
    volume = 0.10,
    type = "sine"
) {

    if (!audioContext) {
        return;
    }


    const oscillator =
        audioContext.createOscillator();


    const gain =
        audioContext.createGain();


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
        audioContext.destination
    );


    oscillator.start(
        startTime
    );


    oscillator.stop(
        startTime + duration + 0.05
    );
}


// ======================================================
// NOTIFICATION SOUND
// ======================================================

async function playNotificationSound(
    strong = true,
    eventType = "call"
) {

    const settings =
        getPortalSettings();


    if (
        eventType === "call" &&
        settings.patientCallSound === false
    ) {

        return;
    }


    if (
        eventType === "recall" &&
        settings.recallSound === false
    ) {

        return;
    }


    await enableAudio();


    if (!audioContext) {
        return;
    }


    try {

        const now =
            audioContext.currentTime +
            0.02;


        const style =
            settings.notificationSoundStyle ||
            "medical";


        // --------------------------------------------------
        // SOFT SOUND
        // --------------------------------------------------

        if (
            style === "soft"
        ) {

            createPatientTone(
                523.25,
                now,
                0.22,
                strong
                    ? 0.12
                    : 0.07
            );


            createPatientTone(
                659.25,
                now + 0.23,
                0.30,
                strong
                    ? 0.12
                    : 0.07
            );


            if (strong) {

                createPatientTone(
                    783.99,
                    now + 0.55,
                    0.35,
                    0.10
                );
            }


            return;
        }


        // --------------------------------------------------
        // DIGITAL SOUND
        // --------------------------------------------------

        if (
            style === "digital"
        ) {

            createPatientTone(
                880,
                now,
                0.12,
                strong
                    ? 0.10
                    : 0.06,
                "square"
            );


            createPatientTone(
                1174.66,
                now + 0.15,
                0.12,
                strong
                    ? 0.10
                    : 0.06,
                "square"
            );


            if (strong) {

                createPatientTone(
                    880,
                    now + 0.34,
                    0.12,
                    0.10,
                    "square"
                );


                createPatientTone(
                    1318.51,
                    now + 0.50,
                    0.20,
                    0.10,
                    "square"
                );
            }


            return;
        }


        // --------------------------------------------------
        // MEDICAL SOUND
        // --------------------------------------------------

        createPatientTone(
            659.25,
            now,
            0.18,
            strong
                ? 0.13
                : 0.07
        );


        createPatientTone(
            783.99,
            now + 0.19,
            0.18,
            strong
                ? 0.13
                : 0.07
        );


        createPatientTone(
            1046.50,
            now + 0.38,
            0.30,
            strong
                ? 0.13
                : 0.07
        );


        if (strong) {

            createPatientTone(
                783.99,
                now + 0.78,
                0.18,
                0.10
            );


            createPatientTone(
                1046.50,
                now + 0.98,
                0.32,
                0.11
            );
        }

    } catch (error) {

        console.error(
            "Unable to play patient notification sound:",
            error
        );
    }
}


// ======================================================
// PATIENT CALLED / RECALLED
// ======================================================

async function notifyPatientCalled(
    callData
) {

    if (
        !currentTicket ||
        !callData ||
        callData.queueNumber !==
            currentTicket.queueNumber
    ) {

        return;
    }


    const eventType =
        callData.type === "recall"
            ? "recall"
            : "call";


    const signature =
        [
            callData.queueNumber,
            callData.room || "",
            eventType,
            Date.now()
        ].join("-");


    lastCalledSignature =
        signature;


    // --------------------------------------------------
    // SOUND
    // --------------------------------------------------

    await playNotificationSound(
        true,
        eventType
    );


    // --------------------------------------------------
    // VIBRATION
    // --------------------------------------------------

    if (
        navigator.vibrate
    ) {

        try {

            navigator.vibrate(
                eventType === "recall"
                    ? [
                        350,
                        150,
                        350,
                        150,
                        550
                    ]
                    : [
                        300,
                        150,
                        300,
                        150,
                        500
                    ]
            );

        } catch (error) {

            console.warn(
                "Vibration unavailable:",
                error
            );
        }
    }


    // --------------------------------------------------
    // BROWSER NOTIFICATION
    // --------------------------------------------------

    if (
        notificationEnabled &&
        "Notification" in window &&
        Notification.permission ===
            "granted"
    ) {

        try {

            const settings =
                getPortalSettings();


            new Notification(
                eventType === "recall"
                    ? `${settings.systemName} - Please Return`
                    : `${settings.systemName} - Your Number Has Been Called`,
                {
                    body:
                        `${callData.queueNumber} → ${
                            formatRoomName(
                                callData.room
                            )
                        }`
                }
            );

        } catch (error) {

            console.error(
                "Browser notification error:",
                error
            );
        }
    }


    // --------------------------------------------------
    // UPDATE TICKET
    // --------------------------------------------------

    if (ticketStatus) {

        ticketStatus.textContent =
            eventType === "recall"
                ? "RECALLED"
                : "CALLED";


        ticketStatus.dataset.status =
            "called";
    }


    if (assignedRoom) {

        assignedRoom.textContent =
            formatRoomName(
                callData.room
            );
    }


    resetTicketPanels();


    if (roomMessage) {

        roomMessage.style.display =
            "block";
    }


    // --------------------------------------------------
    // BIG CALL OVERLAY
    // --------------------------------------------------

    showCallOverlay(
        callData.queueNumber,
        callData.room
    );
}


// ======================================================
// SOCKET.IO REAL-TIME CONNECTION
// ======================================================

if (socket) {

    socket.on(
        "connect",
        () => {

            console.log(
                "MediQueue patient real-time connected."
            );


            setConnectionStatus(
                true
            );


            loadData();
        }
    );


    socket.on(
        "disconnect",
        () => {

            console.log(
                "MediQueue patient real-time disconnected."
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
                "Patient Socket.IO connection error:",
                error
            );


            setConnectionStatus(
                false
            );
        }
    );


    // --------------------------------------------------
    // LIVE QUEUE / DESIGN UPDATE
    // --------------------------------------------------

    socket.on(
        "queue:update",
        data => {

            if (!data) {
                return;
            }


            latestData =
                data;


            renderPortalSettings(
                data.portalSettings || {}
            );


            renderDepartments(
                data.departments || []
            );


            updateCurrentTicket(
                data
            );
        }
    );


    // --------------------------------------------------
    // PATIENT CALLED / RECALLED
    // --------------------------------------------------

    socket.on(
        "patient:called",
        callData => {

            notifyPatientCalled(
                callData
            );
        }
    );
}


// ======================================================
// FALLBACK REFRESH
// ======================================================

setInterval(
    () => {

        if (
            !socket ||
            !socket.connected
        ) {

            loadData();
        }
    },
    15000
);


// ======================================================
// REFRESH WHEN PATIENT RETURNS TO PAGE
// ======================================================

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            loadData();
        }
    }
);


// ======================================================
// UNLOCK AUDIO AFTER USER INTERACTION
// ======================================================

async function unlockPatientAudio() {

    try {

        await enableAudio();

    } catch (error) {

        console.warn(
            "Patient audio unlock failed:",
            error
        );
    }


    document.removeEventListener(
        "pointerdown",
        unlockPatientAudio
    );
}


document.addEventListener(
    "pointerdown",
    unlockPatientAudio,
    {
        once:
            true
    }
);


// ======================================================
// INITIAL PATIENT PORTAL
// ======================================================

async function initializePatientPortal() {

    showPatientLanguageScreen();
    // PATIENT LANGUAGE BUTTONS
let patientLanguage = sessionStorage.getItem("mediqueue_patient_language") || "en";
// PATIENT PORTAL TRANSLATIONS
const patientTranslations = {
    en: {
    welcome: "Welcome to MediQueue",
    chooseLanguage: "Please select your language",
    changeLanguage: "Change Language",
    getStarted: "GET STARTED",
    selectDepartment: "Select Your Department",
    departmentInstruction: "Choose the department you are visiting to receive your queue number.",
yourQueueTicket: "YOUR QUEUE TICKET",
yourQueueNumber: "Your Queue Number"
},

    ms: {
    welcome: "Selamat Datang ke MediQueue",
    chooseLanguage: "Sila pilih bahasa anda",
    changeLanguage: "Tukar Bahasa",
    getStarted: "MULA DI SINI",
    selectDepartment: "Pilih Jabatan Anda",
    departmentInstruction: "Pilih jabatan yang ingin anda kunjungi untuk mendapatkan nombor giliran.",
yourQueueTicket: "TIKET GILIRAN ANDA",
yourQueueNumber: "Nombor Giliran Anda"
},

    zh: {
    welcome: "欢迎使用 MediQueue",
    chooseLanguage: "请选择您的语言",
    changeLanguage: "切换语言",
    getStarted: "开始使用",
    selectDepartment: "选择您要就诊的科室",
    departmentInstruction: "请选择您要就诊的科室，以获取排队号码。",
yourQueueTicket: "您的排队票",
yourQueueNumber: "您的排队号码"
},

    ta: {
    welcome: "MediQueue-க்கு வரவேற்கிறோம்",
    chooseLanguage: "உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்",
    changeLanguage: "மொழியை மாற்று",
    getStarted: "தொடங்குங்கள்",
    selectDepartment: "உங்கள் பிரிவைத் தேர்ந்தெடுக்கவும்",
    departmentInstruction: "உங்கள் வரிசை எண்ணைப் பெற, நீங்கள் செல்ல விரும்பும் மருத்துவப் பிரிவைத் தேர்ந்தெடுக்கவும்.",
yourQueueTicket: "உங்கள் வரிசைச் சீட்டு",
yourQueueNumber: "உங்கள் வரிசை எண்"
}
};

// Get translated text using the selected language
function patientText(key) {
    return patientTranslations[patientLanguage]?.[key]
        || patientTranslations.en[key]
        || key;
}

// UPDATE PATIENT LANGUAGE SCREEN TEXT
function updatePatientLanguageScreen() {
    const screen = document.getElementById(
        "patient-language-screen"
    );

    if (!screen) return;

    const title = screen.querySelector("h1");
    const description = screen.querySelector("p");

    if (title) {
        title.textContent = patientText("welcome");
    }

    if (description) {
        description.textContent = patientText("chooseLanguage");
    }
}

// TRANSLATE PATIENT PORTAL LABELS
function translatePatientPortal() {
    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.dataset.i18n;
        element.textContent = patientText(key);
    });
}

document.querySelectorAll("[data-language]").forEach(button => {
    button.addEventListener("click", () => {
        patientLanguage = button.dataset.language;
        sessionStorage.setItem("mediqueue_patient_language", patientLanguage);
        window.MediQueueI18n?.setLanguage(patientLanguage);

        document.documentElement.lang = patientLanguage;

        updatePatientLanguageScreen();
        translatePatientPortal();

        const screen = document.getElementById(
            "patient-language-screen"
        );

        if (screen) {
            screen.hidden = true;
        }

        console.log("Patient language selected:", patientLanguage);
    });
});

    console.log(
        "Starting MediQueue Patient Portal V4..."
    );


    setConnectionStatus(
        socket
            ? socket.connected
            : false
    );


    if (currentTicket) {

        showTicket();

    } else {

        showDepartmentSelection();
    }


    await loadData();


    console.log(
        "MediQueue Patient Portal V4 ready."
    );
}


// ======================================================
// START
// ======================================================

// PATIENT LANGUAGE SELECTION — SHOW ON EVERY VISIT
function showPatientLanguageScreen() {
    const screen = document.getElementById(
        "patient-language-screen"
    );

    if (!screen) return;

    const savedLanguage = sessionStorage.getItem("mediqueue_patient_language");
    screen.hidden = Boolean(savedLanguage);
    if (savedLanguage) {
        document.documentElement.lang = savedLanguage;
        translatePatientPortal();
    }
    document.body.classList.remove("dashboard-loading");
}
if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializePatientPortal
    );

} else {

    initializePatientPortal();
}
/* ============================================================
   MEDIQUEUE HEADER — HOME / REFRESH
   ============================================================ */

const patientSystemNameButton =
    document.getElementById("patient-system-name");

if (patientSystemNameButton) {

    patientSystemNameButton.style.cursor = "pointer";
    patientSystemNameButton.title = "Refresh MediQueue";

    patientSystemNameButton.addEventListener("click", () => {

        window.location.reload();

    });
}
/* ============================================================
   REAL LIVE TIME & DATE
   ============================================================ */

function updatePatientLiveDateTime() {

    const now = new Date();

    const timeElement =
        document.getElementById("patient-live-time");

    const dateElement =
        document.getElementById("patient-live-date");

    if (timeElement) {

        timeElement.textContent =
            now.toLocaleTimeString("en-MY", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            });
    }

    if (dateElement) {

        dateElement.textContent =
            now.toLocaleDateString("en-MY", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });
    }
}

updatePatientLiveDateTime();

setInterval(
    updatePatientLiveDateTime,
    1000
);
/* ============================================================
   MEDIQUEUE LIVE CLOCK & DATE
   ============================================================ */

function updatePatientLiveDateTime() {

    const timeElement =
        document.getElementById("patient-live-time");

    const dateElement =
        document.getElementById("patient-live-date");

    if (!timeElement || !dateElement) {
        return;
    }

    const now = new Date();

    timeElement.textContent =
        now.toLocaleTimeString("en-MY", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        });

    dateElement.textContent =
        now.toLocaleDateString("en-MY", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
}

updatePatientLiveDateTime();

setInterval(updatePatientLiveDateTime, 1000);

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    clearTimeout(showToast.timeout);

    showToast.timeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function mqConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById("mq-confirm-modal");
        const messageElement = document.getElementById("mq-confirm-message");
        const cancelButton = document.getElementById("mq-confirm-cancel");
        const acceptButton = document.getElementById("mq-confirm-accept");

        if (!modal || !messageElement || !cancelButton || !acceptButton) {
            resolve(false);
            return;
        }

        messageElement.textContent = message;

        function finish(confirmed) {
            modal.hidden = true;
modal.style.display = "none";
            cancelButton.removeEventListener("click", onCancel);
            acceptButton.removeEventListener("click", onAccept);
            resolve(confirmed);
        }

        function onCancel() {
            finish(false);
        }

        function onAccept() {
            finish(true);
        }

        cancelButton.addEventListener("click", onCancel);
        acceptButton.addEventListener("click", onAccept);

        modal.hidden = false;
modal.style.display = "flex";
        cancelButton.focus();
    });
}