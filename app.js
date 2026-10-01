/* =====================================================
   DIGITALTACHO V1.4
   GPS + START / STOP / RESET + WAKE LOCK
   ===================================================== */
/* =====================================================
   DOM
   ===================================================== */
const speedElement =
    document.getElementById("speed");
const averageElement =
    document.getElementById("averageSpeed");
const maximumElement =
    document.getElementById("maximumSpeed");
const distanceElement =
    document.getElementById("distance");
const durationElement =
    document.getElementById("duration");
const statusElement =
    document.getElementById("status");
const startButton =
    document.getElementById("startButton");
const resetButton =
    document.getElementById("resetButton");
/* =====================================================
   EINSTELLUNGEN
   ===================================================== */
const MAX_GPS_ACCURACY = 100;
const MAX_REASONABLE_SPEED = 350;
const MAX_POSITION_JUMP = 0.5;
const MIN_DISTANCE_STEP = 0.003;
const SPEED_HISTORY_SIZE = 5;
/* =====================================================
   STATUS
   ===================================================== */
let maximumSpeed = 0;
let totalDistance = 0;
let lastPosition = null;
let startTime = null;
let speedHistory = [];
let isDriving = false;
let gpsFixReceived = false;
let wakeLock = null;
/* =====================================================
   GPS STARTEN
   ===================================================== */
function startGPS() {
    if (!("geolocation" in navigator)) {
        statusElement.textContent =
            "GPS wird von diesem Gerät nicht unterstützt.";
        return;
    }
    navigator.geolocation.watchPosition(
        gpsUpdate,
        gpsError,
        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 20000
        }
    );
    statusElement.textContent =
        "GPS wird gestartet …";
}
/* =====================================================
   GPS UPDATE
   ===================================================== */
function gpsUpdate(position) {
    gpsFixReceived = true;
    const coords =
        position.coords;
    const latitude =
        coords.latitude;
    const longitude =
        coords.longitude;
    const accuracy =
        coords.accuracy;
    /* -------------------------------------------------
       GPS STATUS
       ------------------------------------------------- */
    if (accuracy <= MAX_GPS_ACCURACY) {
        statusElement.textContent =
            `GPS AKTIV · ±${Math.round(accuracy)} m`;
    } else {
        statusElement.textContent =
            `GPS SCHWACH · ±${Math.round(accuracy)} m`;
    }
    /* -------------------------------------------------
       Nur während einer Fahrt aufzeichnen
       ------------------------------------------------- */
    if (!isDriving) {
        return;
    }
    /* -------------------------------------------------
       Schlechte GPS-Genauigkeit ignorieren
       ------------------------------------------------- */
    if (accuracy > MAX_GPS_ACCURACY) {
        return;
    }
    /* -------------------------------------------------
       Geschwindigkeit
       ------------------------------------------------- */
    let currentSpeed = 0;
    if (
        coords.speed !== null &&
        coords.speed >= 0
    ) {
        currentSpeed =
            coords.speed * 3.6;
    }
    if (
        currentSpeed >
        MAX_REASONABLE_SPEED
    ) {
        return;
    }
    /* -------------------------------------------------
       Geschwindigkeit glätten
       ------------------------------------------------- */
    speedHistory.push(currentSpeed);
    if (
        speedHistory.length >
        SPEED_HISTORY_SIZE
    ) {
        speedHistory.shift();
    }
    const averageGPS =
        speedHistory.reduce(
            (sum, value) =>
                sum + value,
            0
        ) /
        speedHistory.length;
    speedElement.textContent =
        averageGPS.toFixed(0);
    /* -------------------------------------------------
       MAXIMALGESCHWINDIGKEIT
       ------------------------------------------------- */
    if (
        averageGPS >
        maximumSpeed
    ) {
        maximumSpeed =
            averageGPS;
        maximumElement.textContent =
            `${maximumSpeed.toFixed(1)} km/h`;
    }
    /* -------------------------------------------------
       STRECKE
       ------------------------------------------------- */
    if (lastPosition) {
        const distance =
            calculateDistance(
                lastPosition.latitude,
                lastPosition.longitude,
                latitude,
                longitude
            );
        if (
            distance >= MIN_DISTANCE_STEP &&
            distance <= MAX_POSITION_JUMP
        ) {
            totalDistance +=
                distance;
            distanceElement.textContent =
                `${totalDistance.toFixed(2)} km`;
        }
    }
    lastPosition = {
        latitude,
        longitude
    };
    /* -------------------------------------------------
       DURCHSCHNITTSGESCHWINDIGKEIT
       ------------------------------------------------- */
    updateAverageSpeed();
}
/* =====================================================
   GPS FEHLER
   ===================================================== */
function gpsError(error) {
    switch (error.code) {
        case 1:
            statusElement.textContent =
                "GPS-Zugriff verweigert";
            break;
        case 2:
            statusElement.textContent =
                "GPS nicht verfügbar";
            break;
        case 3:
            statusElement.textContent =
                "GPS-Zeitüberschreitung";
            break;
        default:
            statusElement.textContent =
                "GPS-Fehler";
    }
}
/* =====================================================
   HAVERSINE DISTANZ
   ===================================================== */
function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {
    const earthRadius =
        6371;
    const dLat =
        degreesToRadians(
            lat2 - lat1
        );
    const dLon =
        degreesToRadians(
            lon2 - lon1
        );
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(
            degreesToRadians(lat1)
        ) *
        Math.cos(
            degreesToRadians(lat2)
        ) *
        Math.sin(dLon / 2) ** 2;
    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );
    return earthRadius * c;
}
/* =====================================================
   GRAD → RAD
   ===================================================== */
function degreesToRadians(
    degrees
) {
    return degrees *
        Math.PI /
        180;
}
/* =====================================================
   DURCHSCHNITT
   ===================================================== */
function updateAverageSpeed() {
    if (
        !startTime ||
        totalDistance <= 0
    ) {
        return;
    }
    const elapsedHours =
        (
            Date.now() -
            startTime
        ) /
        3600000;
    if (
        elapsedHours <= 0
    ) {
        return;
    }
    const averageSpeed =
        totalDistance /
        elapsedHours;
    averageElement.textContent =
        `${averageSpeed.toFixed(1)} km/h`;
}
/* =====================================================
   TIMER
   ===================================================== */
setInterval(
    updateTimer,
    1000
);
function updateTimer() {
    if (!startTime) {
        return;
    }
    const elapsed =
        Date.now() -
        startTime;
    durationElement.textContent =
        formatDuration(
            elapsed
        );
    updateAverageSpeed();
}
/* =====================================================
   ZEIT FORMATIEREN
   ===================================================== */
function formatDuration(
    milliseconds
) {
    const totalSeconds =
        Math.floor(
            milliseconds / 1000
        );
    const hours =
        Math.floor(
            totalSeconds / 3600
        );
    const minutes =
        Math.floor(
            (totalSeconds % 3600) /
            60
        );
    const seconds =
        totalSeconds % 60;
    return [
        hours,
        minutes,
        seconds
    ]
        .map(
            value =>
                String(value)
                    .padStart(2, "0")
        )
        .join(":");
}
/* =====================================================
   WAKE LOCK
   ===================================================== */
async function requestWakeLock() {
    if (
        !("wakeLock" in navigator)
    ) {
        return;
    }
    try {
        wakeLock =
            await navigator.wakeLock.request(
                "screen"
            );
    } catch (error) {
        console.log(
            "Wake Lock konnte nicht aktiviert werden:",
            error
        );
    }
}
async function releaseWakeLock() {
    if (!wakeLock) {
        return;
    }
    try {
        await wakeLock.release();
    } catch (error) {
        console.log(
            "Wake Lock konnte nicht freigegeben werden:",
            error
        );
    }
    wakeLock = null;
}
/* =====================================================
   START / STOP
   ===================================================== */
startButton.addEventListener(
    "click",
    async () => {
        if (!isDriving) {
            /* START */
            isDriving = true;
            startTime =
                Date.now();
            lastPosition = null;
            speedHistory = [];
            statusElement.textContent =
                "FAHRT LÄUFT";
            startButton.textContent =
                "STOP";
            await requestWakeLock();
        } else {
            /* STOP */
            isDriving = false;
            speedHistory = [];
            speedElement.textContent =
                "0";
            statusElement.textContent =
                "FAHRT BEENDET";
            startButton.textContent =
                "START";
            await releaseWakeLock();
        }
    }
);
/* =====================================================
   RESET
   ===================================================== */
resetButton.addEventListener(
    "click",
    async () => {
        isDriving = false;
        maximumSpeed = 0;
        totalDistance = 0;
        lastPosition = null;
        startTime = null;
        speedHistory = [];
        speedElement.textContent =
            "0";
        averageElement.textContent =
            "0.0 km/h";
        maximumElement.textContent =
            "0.0 km/h";
        distanceElement.textContent =
            "0.00 km";
        durationElement.textContent =
            "00:00:00";
        statusElement.textContent =
            gpsFixReceived
                ? "GPS AKTIV"
                : "GPS wird gestartet …";
        startButton.textContent =
            "START";
        await releaseWakeLock();
    }
);
/* =====================================================
   GPS BEIM LADEN STARTEN
   ===================================================== */
startGPS();
