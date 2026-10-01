const speedDisplay =
    document.getElementById("speed");
const averageDisplay =
    document.getElementById("average");
const maximumDisplay =
    document.getElementById("maximum");
const distanceDisplay =
    document.getElementById("distance");
const durationDisplay =
    document.getElementById("duration");
const statusDisplay =
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
   FAHRDATEN
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
   GPS STATUS
   ===================================================== */
function setStatus(message) {
    statusDisplay.textContent =
        message;
}
/* =====================================================
   GPS STARTEN
   ===================================================== */
function startGPS() {
    if (!navigator.geolocation) {
        setStatus(
            "GPS: NICHT UNTERSTÜTZT"
        );
        return;
    }
    setStatus(
        "GPS: WARTE AUF POSITION …"
    );
    navigator.geolocation.watchPosition(
        gpsUpdate,
        gpsError,
        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 20000
        }
    );
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
    let speedKmh = 0;
    if (
        coords.speed !== null &&
        Number.isFinite(coords.speed) &&
        coords.speed >= 0
    ) {
        speedKmh =
            coords.speed * 3.6;
    }
    if (
        speedKmh < 1.5
    ) {
        speedKmh = 0;
    }
    if (
        speedKmh >
        MAX_REASONABLE_SPEED
    ) {
        speedKmh = 0;
    }
    /* =================================================
       STATUS
       ================================================= */
    if (
        accuracy <= MAX_GPS_ACCURACY
    ) {
        setStatus(
            `GPS AKTIV · ±${Math.round(accuracy)} m`
        );
    } else {
        setStatus(
            `GPS SCHWACH · ±${Math.round(accuracy)} m`
        );
    }
    /* =================================================
       GESCHWINDIGKEIT
       ================================================= */
    if (
        isDriving
    ) {
        addSpeedSample(
            speedKmh
        );
    }
    /* =================================================
       STRECKE
       ================================================= */
    if (
        isDriving &&
        lastPosition !== null &&
        accuracy <= MAX_GPS_ACCURACY
    ) {
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
            distanceDisplay.textContent =
                totalDistance.toFixed(1);
        }
    }
    lastPosition = {
        latitude:
            latitude,
        longitude:
            longitude
    };
    /* =================================================
       DURCHSCHNITT
       ================================================= */
    updateAverage();
    /* =================================================
       DIAGNOSE
       ================================================= */
    updateDiagnostics({
        latitude,
        longitude,
        accuracy,
        speedKmh
    });
}
/* =====================================================
   GPS FEHLER
   ===================================================== */
function gpsError(error) {
    gpsFixReceived = false;
    switch (
        error.code
    ) {
        case 1:
            setStatus(
                "GPS FEHLER 1 · ZUGRIFF VERWEIGERT"
            );
            break;
        case 2:
            setStatus(
                "GPS FEHLER 2 · POSITION NICHT VERFÜGBAR"
            );
            break;
        case 3:
            setStatus(
                "GPS FEHLER 3 · TIMEOUT"
            );
            break;
        default:
            setStatus(
                "GPS FEHLER"
            );
    }
    console.log(
        "GPS Fehler:",
        error
    );
}
/* =====================================================
   GESCHWINDIGKEIT GLÄTTEN
   ===================================================== */
function addSpeedSample(
    speed
) {
    speedHistory.push(
        speed
    );
    if (
        speedHistory.length >
        SPEED_HISTORY_SIZE
    ) {
        speedHistory.shift();
    }
    const sum =
        speedHistory.reduce(
            (
                total,
                value
            ) =>
                total + value,
            0
        );
    const average =
        sum /
        speedHistory.length;
    const smoothSpeed =
        Math.round(
            average
        );
    speedDisplay.textContent =
        smoothSpeed;
    if (
        smoothSpeed >
        maximumSpeed
    ) {
        maximumSpeed =
            smoothSpeed;
        maximumDisplay.textContent =
            maximumSpeed;
    }
}
/* =====================================================
   DURCHSCHNITT
   ===================================================== */
function updateAverage() {
    if (
        !isDriving ||
        startTime === null ||
        totalDistance <= 0
    ) {
        averageDisplay.textContent =
            "0";
        return;
    }
    const elapsedHours =
        (
            Date.now() -
            startTime
        ) / 3600000;
    if (
        elapsedHours <= 0
    ) {
        return;
    }
    const average =
        totalDistance /
        elapsedHours;
    averageDisplay.textContent =
        Math.round(
            average
        );
}
/* =====================================================
   ENTFERNUNG
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
        toRadians(
            lat2 - lat1
        );
    const dLon =
        toRadians(
            lon2 - lon1
        );
    const a =
        Math.sin(
            dLat / 2
        ) ** 2
        +
        Math.cos(
            toRadians(lat1)
        )
        *
        Math.cos(
            toRadians(lat2)
        )
        *
        Math.sin(
            dLon / 2
        ) ** 2;
    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(
                1 - a
            )
        );
    return (
        earthRadius *
        c
    );
}
function toRadians(
    degrees
) {
    return (
        degrees *
        Math.PI /
        180
    );
}
/* =====================================================
   FAHRZEIT
   ===================================================== */
function updateDuration() {
    if (
        !isDriving ||
        startTime === null
    ) {
        return;
    }
    const elapsed =
        Date.now() -
        startTime;
    const totalSeconds =
        Math.floor(
            elapsed / 1000
        );
    const hours =
        Math.floor(
            totalSeconds / 3600
        );
    const minutes =
        Math.floor(
            (
                totalSeconds % 3600
            ) / 60
        );
    const seconds =
        totalSeconds % 60;
    if (
        hours > 0
    ) {
        durationDisplay.textContent =
            `${pad(hours)}:` +
            `${pad(minutes)}:` +
            `${pad(seconds)}`;
    } else {
        durationDisplay.textContent =
            `${pad(minutes)}:` +
            `${pad(seconds)}`;
    }
    updateAverage();
}
function pad(
    number
) {
    return String(
        number
    ).padStart(
        2,
        "0"
    );
}
/* =====================================================
   WAKE LOCK
   ===================================================== */
async function requestWakeLock() {
    if (
        !("wakeLock" in navigator)
    ) {
        updateWakeStatus(
            "NICHT UNTERSTÜTZT"
        );
        return;
    }
    try {
        wakeLock =
            await navigator.wakeLock.request(
                "screen"
            );
        updateWakeStatus(
            "AKTIV"
        );
        wakeLock.addEventListener(
            "release",
            () => {
                wakeLock = null;
                updateWakeStatus(
                    "FREIGEGEBEN"
                );
            }
        );
    } catch (error) {
        updateWakeStatus(
            "FEHLER"
        );
        console.log(
            "Wake Lock Fehler:",
            error
        );
    }
}
async function releaseWakeLock() {
    if (
        wakeLock !== null
    ) {
        try {
            await wakeLock.release();
        } catch (error) {
            console.log(
                error
            );
        }
        wakeLock = null;
    }
    updateWakeStatus(
        "AUS"
    );
}
function updateWakeStatus(
    status
) {
    const element =
        document.getElementById(
            "wakeStatus"
        );
    if (element) {
        element.textContent =
            `Wake Lock: ${status}`;
    }
}
/* =====================================================
   START / STOP
   ===================================================== */
async function toggleDriving() {
    if (
        !isDriving
    ) {
        isDriving = true;
        startTime =
            Date.now();
        lastPosition =
            null;
        speedHistory =
            [];
        startButton.textContent =
            "STOP";
        setStatus(
            "FAHRT LÄUFT"
        );
        await requestWakeLock();
    } else {
        isDriving = false;
        speedHistory = [];
        speedDisplay.textContent =
            "0";
        startButton.textContent =
            "START";
        setStatus(
            "FAHRT BEENDET"
        );
        await releaseWakeLock();
    }
}
startButton.addEventListener(
    "click",
    toggleDriving
);
/* =====================================================
   RESET
   ===================================================== */
async function resetTacho() {
    isDriving = false;
    maximumSpeed = 0;
    totalDistance = 0;
    lastPosition = null;
    startTime = null;
    speedHistory = [];
    speedDisplay.textContent =
        "0";
    averageDisplay.textContent =
        "0";
    maximumDisplay.textContent =
        "0";
    distanceDisplay.textContent =
        "0.0";
    durationDisplay.textContent =
        "00:00";
    startButton.textContent =
        "START";
    setStatus(
        "GPS ZURÜCKGESETZT"
    );
    await releaseWakeLock();
}
resetButton.addEventListener(
    "click",
    resetTacho
);
/* =====================================================
   DIAGNOSE
   ===================================================== */
function updateDiagnostics(data) {
    const gpsStatus =
        document.getElementById(
            "gpsStatus"
        );
    const gpsAccuracy =
        document.getElementById(
            "gpsAccuracy"
        );
    const gpsLatitude =
        document.getElementById(
            "gpsLatitude"
        );
    const gpsLongitude =
        document.getElementById(
            "gpsLongitude"
        );
    const gpsSpeed =
        document.getElementById(
            "gpsSpeed"
        );
    if (gpsStatus) {
        gpsStatus.textContent =
            gpsFixReceived
                ? "GPS: FIX"
                : "GPS: KEIN FIX";
    }
    if (gpsAccuracy) {
        gpsAccuracy.textContent =
            `Genauigkeit: ±${Math.round(
                data.accuracy
            )} m`;
    }
    if (gpsLatitude) {
        gpsLatitude.textContent =
            `Lat: ${data.latitude.toFixed(6)}`;
    }
    if (gpsLongitude) {
        gpsLongitude.textContent =
            `Lon: ${data.longitude.toFixed(6)}`;
    }
    if (gpsSpeed) {
        gpsSpeed.textContent =
            `GPS-Speed: ${data.speedKmh.toFixed(1)} km/h`;
    }
}
/* =====================================================
   TIMER
   ===================================================== */
setInterval(
    updateDuration,
    1000
);
/* =====================================================
   GPS START
   ===================================================== */
startGPS();
