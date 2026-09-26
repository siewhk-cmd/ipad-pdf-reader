import * as pdfjsLib from "./pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "./pdfjs/pdf.worker.mjs";

const pdfFileInput =
    document.getElementById("pdfFile");

const openAnotherButton =
    document.getElementById("openAnother");

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

let pdfDocument = null;
let currentPage = 1;
let currentFileName = "";
let rendering = false;
let pendingPage = null;


// OPEN PDF

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

        pdfDocument =
            await pdfjsLib.getDocument({
                data: arrayBuffer
            }).promise;

        currentFileName =
            file.name;

        const savedPage =
            localStorage.getItem(
                "pdf-page-" +
                currentFileName
            );

        if (savedPage) {

            currentPage =
                parseInt(savedPage, 10);

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

        startScreen.classList.add(
            "hidden"
        );

        reader.classList.remove(
            "hidden"
        );

        await renderPage(
            currentPage
        );

        pdfFileInput.value = "";

    } catch (error) {

        console.error(error);

        alert(
            "Unable to open PDF: " +
            error.message
        );
    }
}


// RENDER PAGE

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


// PAGE NAVIGATION

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


// TWO-FINGER SWIPE

let gestureActive = false;

let startX = 0;
let startY = 0;

let latestX = 0;
let latestY = 0;

const SWIPE_DISTANCE = 70;
const HORIZONTAL_RATIO = 1.4;

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
            event.touches.length !== 2
        ) {

            gestureActive = false;

            return;
        }

        gestureActive = true;

        const point =
            centreOfTwoFingers(
                event.touches
            );

        startX = point.x;
        startY = point.y;

        latestX = point.x;
        latestY = point.y;

        event.preventDefault();
    },

    {
        passive: false
    }
);


pdfArea.addEventListener(
    "touchmove",

    event => {

        if (!gestureActive) {
            return;
        }

        if (
            event.touches.length !== 2
        ) {

            gestureActive = false;

            return;
        }

        const point =
            centreOfTwoFingers(
                event.touches
            );

        latestX = point.x;
        latestY = point.y;

        event.preventDefault();
    },

    {
        passive: false
    }
);


pdfArea.addEventListener(
    "touchend",

    event => {

        if (!gestureActive) {
            return;
        }

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
            Math.abs(deltaX);

        const vertical =
            Math.abs(deltaY);

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

        event.preventDefault();
    },

    {
        passive: false
    }
);


pdfArea.addEventListener(
    "touchcancel",

    () => {

        gestureActive = false;
    }
);


// SCREEN ROTATION / RESIZE

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


// SERVICE WORKER

if ("serviceWorker" in navigator) {

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
