import * as pdfjsLib from "./pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "./pdfjs/pdf.worker.mjs";

const pdfFileInput =
    document.getElementById("pdfFile");

const openAnotherButton =
    document.getElementById("openAnother");

const libraryButton =
    document.getElementById("libraryButton");

const startScreen =
    document.getElementById("startScreen");

const reader =
    document.getElementById("reader");

const pdfArea =
    document.getElementById("pdfArea");

const canvas =
    document.getElementById("pdfCanvas");

const context =
    canvas.getContext("2d");

const pageNumDisplay =
    document.getElementById("pageNum");

const pageCountDisplay =
    document.getElementById("pageCount");

const fileNameDisplay =
    document.getElementById("fileName");

const savedSection =
    document.getElementById("savedSection");

const savedPdfList =
    document.getElementById("savedPdfList");

let pdfDocument = null;
let currentPage = 1;
let currentFileName = "";
let rendering = false;
let pendingPage = null;

const DB_NAME = "ipad-pdf-reader";
const DB_VERSION = 1;
const STORE_NAME = "pdfs";

let db = null;


/* =========================================================
   INDEXEDDB
========================================================= */

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request =
            indexedDB.open(
                DB_NAME,
                DB_VERSION
            );

        request.onupgradeneeded =
            event => {

                const database =
                    event.target.result;

                if (
                    !database.objectStoreNames.contains(
                        STORE_NAME
                    )
                ) {
                    database.createObjectStore(
                        STORE_NAME,
                        {
                            keyPath: "name"
                        }
                    );
                }
            };

        request.onsuccess =
            event => {
                db = event.target.result;
                resolve(db);
            };

        request.onerror =
            () => {
                reject(request.error);
            };
    });
}


function savePdfToDatabase(name, arrayBuffer) {
    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                STORE_NAME,
                "readwrite"
            );

        const store =
            transaction.objectStore(
                STORE_NAME
            );

        const request =
            store.put({
                name: name,
                data: arrayBuffer,
                savedAt: Date.now()
            });

        request.onsuccess =
            () => resolve();

        request.onerror =
            () => reject(request.error);
    });
}


function getPdfFromDatabase(name) {
    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                STORE_NAME,
                "readonly"
            );

        const store =
            transaction.objectStore(
                STORE_NAME
            );

        const request =
            store.get(name);

        request.onsuccess =
            () => resolve(request.result);

        request.onerror =
            () => reject(request.error);
    });
}


function getAllSavedPdfs() {
    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                STORE_NAME,
                "readonly"
            );

        const store =
            transaction.objectStore(
                STORE_NAME
            );

        const request =
            store.getAll();

        request.onsuccess =
            () => resolve(request.result || []);

        request.onerror =
            () => reject(request.error);
    });
}


function deletePdfFromDatabase(name) {
    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                STORE_NAME,
                "readwrite"
            );

        const store =
            transaction.objectStore(
                STORE_NAME
            );

        const request =
            store.delete(name);

        request.onsuccess =
            () => resolve();

        request.onerror =
            () => reject(request.error);
    });
}


/* =========================================================
   LIBRARY
========================================================= */

async function refreshSavedPdfList() {

    const items =
        await getAllSavedPdfs();

    items.sort(
        (a, b) =>
            (b.savedAt || 0) -
            (a.savedAt || 0)
    );

    savedPdfList.innerHTML = "";

    if (items.length === 0) {
        savedSection.classList.add("hidden");
        return;
    }

    savedSection.classList.remove("hidden");

    for (const item of items) {

        const row =
            document.createElement("div");

        row.className =
            "savedPdfRow";


        const openButton =
            document.createElement("button");

        openButton.className =
            "savedPdfOpen";

        openButton.textContent =
            item.name;

        openButton.addEventListener(
            "click",
            async () => {
                await openSavedPdf(
                    item.name
                );
            }
        );


        const deleteButton =
            document.createElement("button");

        deleteButton.className =
            "savedPdfDelete";

        deleteButton.textContent =
            "Delete";

        deleteButton.addEventListener(
            "click",
            async () => {

                const confirmed =
                    confirm(
                        `Delete "${item.name}" from this device?`
                    );

                if (!confirmed) {
                    return;
                }

                await deletePdfFromDatabase(
                    item.name
                );

                localStorage.removeItem(
                    "pdf-page-" +
                    item.name
                );

                if (
                    localStorage.getItem(
                        "last-opened-pdf"
                    ) === item.name
                ) {
                    localStorage.removeItem(
                        "last-opened-pdf"
                    );
                }

                await refreshSavedPdfList();
            }
        );

        row.appendChild(
            openButton
        );

        row.appendChild(
            deleteButton
        );

        savedPdfList.appendChild(
            row
        );
    }
}


async function showLibrary() {

    reader.classList.add(
        "hidden"
    );

    startScreen.classList.remove(
        "hidden"
    );

    await refreshSavedPdfList();
}


libraryButton.addEventListener(
    "click",
    showLibrary
);


/* =========================================================
   OPEN PDF
========================================================= */

pdfFileInput.addEventListener(
    "change",
    openSelectedPDF
);

openAnotherButton.addEventListener(
    "click",
    () => {
        pdfFileInput.click();
    }
);


async function openSelectedPDF(event) {

    const file =
        event.target.files[0];

    if (!file) {
        return;
    }

    try {

        const arrayBuffer =
            await file.arrayBuffer();

        await savePdfToDatabase(
            file.name,
            arrayBuffer
        );

        await loadPdfData(
            file.name,
            arrayBuffer
        );

        await refreshSavedPdfList();

        pdfFileInput.value = "";

    } catch (error) {

        console.error(error);

        alert(
            "Unable to open PDF: " +
            error.message
        );
    }
}


async function openSavedPdf(name) {

    try {

        const item =
            await getPdfFromDatabase(
                name
            );

        if (!item) {

            alert(
                "The saved PDF could not be found."
            );

            await refreshSavedPdfList();

            return;
        }

        await loadPdfData(
            item.name,
            item.data
        );

    } catch (error) {

        console.error(error);

        alert(
            "Unable to open saved PDF: " +
            error.message
        );
    }
}


async function loadPdfData(name, data) {

    const pdfData =
        data instanceof ArrayBuffer
            ? data.slice(0)
            : data;

    pdfDocument =
        await pdfjsLib.getDocument({
            data: pdfData
        }).promise;

    currentFileName =
        name;

    const savedPage =
        localStorage.getItem(
            "pdf-page-" +
            currentFileName
        );

    if (savedPage) {

        currentPage =
            parseInt(
                savedPage,
                10
            );

    } else {

        currentPage = 1;
    }

    if (
        currentPage < 1 ||
        currentPage >
        pdfDocument.numPages
    ) {
        currentPage = 1;
    }

    pageCountDisplay.textContent =
        pdfDocument.numPages;

    fileNameDisplay.textContent =
        currentFileName;

    localStorage.setItem(
        "last-opened-pdf",
        currentFileName
    );

    startScreen.classList.add(
        "hidden"
    );

    reader.classList.remove(
        "hidden"
    );

    await renderPage(
        currentPage
    );
}


/* =========================================================
   RENDER PAGE
========================================================= */

async function renderPage(pageNumber) {

    if (!pdfDocument) {
        return;
    }

    if (rendering) {

        pendingPage =
            pageNumber;

        return;
    }

    rendering = true;

    try {

        const page =
            await pdfDocument.getPage(
                pageNumber
            );

        const baseViewport =
            page.getViewport({
                scale: 1
            });

        const widthScale =
            pdfArea.clientWidth /
            baseViewport.width;

        const heightScale =
            pdfArea.clientHeight /
            baseViewport.height;

        const scale =
            Math.min(
                widthScale,
                heightScale
            );

        const pixelRatio =
            window.devicePixelRatio || 1;

        const viewport =
            page.getViewport({
                scale:
                    scale *
                    pixelRatio
            });

        canvas.width =
            Math.floor(
                viewport.width
            );

        canvas.height =
            Math.floor(
                viewport.height
            );

        canvas.style.width =
            (
                viewport.width /
                pixelRatio
            ) + "px";

        canvas.style.height =
            (
                viewport.height /
                pixelRatio
            ) + "px";

        await page.render({

            canvasContext:
                context,

            viewport:
                viewport

        }).promise;

        currentPage =
            pageNumber;

        pageNumDisplay.textContent =
            currentPage;

        localStorage.setItem(
            "pdf-page-" +
            currentFileName,
            currentPage
        );

    } catch (error) {

        console.error(error);

    } finally {

        rendering = false;

        if (pendingPage !== null) {

            const nextPageNumber =
                pendingPage;

            pendingPage =
                null;

            renderPage(
                nextPageNumber
            );
        }
    }
}


function nextPage() {

    if (!pdfDocument) {
        return;
    }

    if (
        currentPage >=
        pdfDocument.numPages
    ) {
        return;
    }

    renderPage(
        currentPage + 1
    );
}


function previousPage() {

    if (!pdfDocument) {
        return;
    }

    if (currentPage <= 1) {
        return;
    }

    renderPage(
        currentPage - 1
    );
}


/* =========================================================
   TOUCH HANDLING
========================================================= */

let gestureActive = false;
let singleTapActive = false;

let startX = 0;
let startY = 0;
let latestX = 0;
let latestY = 0;

let tapStartX = 0;
let tapStartY = 0;
let tapStartTime = 0;

let ignoreClickUntil = 0;

const SWIPE_DISTANCE = 70;
const HORIZONTAL_RATIO = 1.4;

const TAP_MAX_MOVEMENT = 15;
const TAP_MAX_DURATION = 400;


function centreOfTwoFingers(touches) {

    return {

        x:
            (
                touches[0].clientX +
                touches[1].clientX
            ) / 2,

        y:
            (
                touches[0].clientY +
                touches[1].clientY
            ) / 2
    };
}


pdfArea.addEventListener(
    "touchstart",

    event => {

        if (
            event.touches.length === 2
        ) {

            gestureActive = true;
            singleTapActive = false;

            const point =
                centreOfTwoFingers(
                    event.touches
                );

            startX = point.x;
            startY = point.y;

            latestX = point.x;
            latestY = point.y;

            event.preventDefault();
            return;
        }


        if (
            event.touches.length === 1
        ) {

            gestureActive = false;
            singleTapActive = true;

            const touch =
                event.touches[0];

            tapStartX =
                touch.clientX;

            tapStartY =
                touch.clientY;

            tapStartTime =
                Date.now();

            return;
        }


        gestureActive = false;
        singleTapActive = false;
    },

    {
        passive: false
    }
);


pdfArea.addEventListener(
    "touchmove",

    event => {

        if (
            gestureActive &&
            event.touches.length === 2
        ) {

            const point =
                centreOfTwoFingers(
                    event.touches
                );

            latestX = point.x;
            latestY = point.y;

            event.preventDefault();
            return;
        }


        if (
            singleTapActive &&
            event.touches.length === 1
        ) {

            const touch =
                event.touches[0];

            const moveX =
                Math.abs(
                    touch.clientX -
                    tapStartX
                );

            const moveY =
                Math.abs(
                    touch.clientY -
                    tapStartY
                );

            if (
                moveX >
                    TAP_MAX_MOVEMENT ||
                moveY >
                    TAP_MAX_MOVEMENT
            ) {
                singleTapActive = false;
            }

            return;
        }


        if (
            event.touches.length !== 1
        ) {
            singleTapActive = false;
        }
    },

    {
        passive: false
    }
);


pdfArea.addEventListener(
    "touchend",

    event => {

        ignoreClickUntil =
            Date.now() + 700;


        if (gestureActive) {

            if (
                event.touches.length >= 2
            ) {
                return;
            }

            const deltaX =
                latestX - startX;

            const deltaY =
                latestY - startY;

            const horizontal =
                Math.abs(
                    deltaX
                );

            const vertical =
                Math.abs(
                    deltaY
                );

            if (
                horizontal >=
                    SWIPE_DISTANCE &&
                horizontal >
                    vertical *
                    HORIZONTAL_RATIO
            ) {

                if (deltaX < 0) {
                    nextPage();
                } else {
                    previousPage();
                }
            }

            gestureActive = false;
            singleTapActive = false;

            event.preventDefault();
            return;
        }


        if (singleTapActive) {

            const duration =
                Date.now() -
                tapStartTime;

            singleTapActive = false;

            if (
                duration >
                TAP_MAX_DURATION
            ) {
                return;
            }

            const rect =
                pdfArea.getBoundingClientRect();

            const relativeX =
                tapStartX -
                rect.left;

            const width =
                rect.width;

            if (
                relativeX <=
                width * 0.30
            ) {

                previousPage();

            } else if (
                relativeX >=
                width * 0.70
            ) {

                nextPage();
            }
        }
    },

    {
        passive: false
    }
);


pdfArea.addEventListener(
    "touchcancel",

    () => {
        gestureActive = false;
        singleTapActive = false;
    }
);


/* =========================================================
   MOUSE / TRACKPAD CLICK SUPPORT
========================================================= */

pdfArea.addEventListener(
    "click",

    event => {

        if (!pdfDocument) {
            return;
        }

        if (
            Date.now() <
            ignoreClickUntil
        ) {
            return;
        }

        const rect =
            pdfArea.getBoundingClientRect();

        const relativeX =
            event.clientX -
            rect.left;

        const width =
            rect.width;

        if (
            relativeX <=
            width * 0.30
        ) {

            previousPage();

        } else if (
            relativeX >=
            width * 0.70
        ) {

            nextPage();
        }
    }
);


/* =========================================================
   SCREEN ROTATION / RESIZE
========================================================= */

let resizeTimer = null;

window.addEventListener(
    "resize",

    () => {

        if (!pdfDocument) {
            return;
        }

        clearTimeout(
            resizeTimer
        );

        resizeTimer =
            setTimeout(
                () => {

                    renderPage(
                        currentPage
                    );

                },

                200
            );
    }
);


/* =========================================================
   STARTUP
========================================================= */

async function startApp() {

    try {

        await openDatabase();

        await refreshSavedPdfList();

        const lastOpened =
            localStorage.getItem(
                "last-opened-pdf"
            );

        if (lastOpened) {

            const item =
                await getPdfFromDatabase(
                    lastOpened
                );

            if (item) {

                await loadPdfData(
                    item.name,
                    item.data
                );

                return;
            }
        }

    } catch (error) {

        console.error(
            "Startup error:",
            error
        );
    }
}

startApp();


/* =========================================================
   SERVICE WORKER
========================================================= */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator
                .serviceWorker
                .register(
                    "./service-worker.js"
                )
                .catch(
                    error => {

                        console.error(
                            "Service worker:",
                            error
                        );
                    }
                );
        }
    );
}
