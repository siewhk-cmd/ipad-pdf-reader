const CACHE_NAME =
    "pdf-reader-v2";

const APP_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./pdfjs/pdf.mjs",
    "./pdfjs/pdf.worker.mjs"
];

self.addEventListener(
    "install",
    event => {

        event.waitUntil(
            caches
                .open(CACHE_NAME)
                .then(
                    cache =>
                        cache.addAll(
                            APP_FILES
                        )
                )
        );

        self.skipWaiting();
    }
);

self.addEventListener(
    "activate",
    event => {

        event.waitUntil(
            caches
                .keys()
                .then(
                    names =>
                        Promise.all(
                            names
                                .filter(
                                    name =>
                                        name !==
                                        CACHE_NAME
                                )
                                .map(
                                    name =>
                                        caches.delete(
                                            name
                                        )
                                )
                        )
                )
        );

        self.clients.claim();
    }
);

self.addEventListener(
    "fetch",
    event => {

        if (
            event.request.method !== "GET"
        ) {
            return;
        }

        event.respondWith(
            caches
                .match(
                    event.request
                )
                .then(
                    cached =>
                        cached ||
                        fetch(
                            event.request
                        )
                )
        );
    }
);
