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
const resetButton =
    document.getElementById("resetButton");
const startButton =
    document.getElementById("startButton");
/* =====================================================
   EINSTELLUNGEN
   ===================================================== */
const MIN_MOVEMENT_SPEED = 1.5;   // km/h
const MAX_REASONABLE_SPEED = 350; // km/h
const MAX_GPS_ACCURACY = 50;      // Meter
const MAX_POSITION_JUMP = 0.5;    // km
const MIN_DISTANCE_STEP = 0.003;  // 3 Meter
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
/* =====================================================
   GPS STARTEN
   ===================================================== */
function startGPS() {
    if (!navigator.geolocation) {
        statusDisplay.textContent =
            "GPS wird nicht unterstützt";
        return;
    }
    statusDisplay.textContent =
        "GPS wird gestartet …";
    navigator.geolocation.watchPosition(
        gpsUpdate,
        gpsError,
        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 15000
        }
    );
}
/* =====================================================
   GPS UPDATE
   ===================================================== */
function gpsUpdate(position) {
    const coords =
        position.coords;
    if (!isDriving) {

    statusDisplay.textContent =
        `GPS bereit · ±${Math.round(coords.accuracy)} m`;

    return;
    }
    const latitude =
        coords.latitude;
    const longitude =
        coords.longitude;
    const accuracy =
        coords.accuracy;
    /* =================================================
       GPS-GENAUIGKEIT
       ================================================= */
    if (
        !Number.isFinite(accuracy) ||
        accuracy > MAX_GPS_ACCURACY
    ) {
        statusDisplay.textContent =
            `GPS schwach · ±${Math.round(accuracy)} m`;
    } else {
        statusDisplay.textContent =
            `GPS aktiv · ±${Math.round(accuracy)} m`;
    }
    /* =================================================
       FAHRT STARTEN
       ================================================= */
    if (startTime === null) {
        startTime =
            Date.now();
    }
    /* =================================================
       GESCHWINDIGKEIT
       ================================================= */
    if (
        coords.speed !== null &&
        Number.isFinite(coords.speed) &&
        coords.speed >= 0
    ) {
        let speedKmh =
            coords.speed * 3.6;
        /*
         * Unplausible Werte ignorieren.
         */
        if (
            speedKmh <=
            MAX_REASONABLE_SPEED
        ) {
            /*
             * Unter 1,5 km/h
             * behandeln wir als Stillstand.
             */
            if (
                speedKmh <
                MIN_MOVEMENT_SPEED
            ) {
                speedKmh = 0;
            }
            addSpeedSample(
                speedKmh
            );
        }
    }
    /* =================================================
       STRECKE
       ================================================= */
    if (lastPosition !== null) {
        const distance =
            calculateDistance(
                lastPosition.latitude,
                lastPosition.longitude,
                latitude,
                longitude
            );
        /*
         * GPS-Sprung prüfen.
         */
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
    /*
     * Nur die letzten
     * Werte behalten.
     */
    if (
        speedHistory.length >
        SPEED_HISTORY_SIZE
    ) {
        speedHistory.shift();
    }
    /*
     * Durchschnitt der letzten
     * GPS-Werte.
     */
    const sum =
        speedHistory.reduce(
            (total, value) =>
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
    /* =================================================
       MAXIMUM
       ================================================= */
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
        ) /
        3600000;
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
   ENTFERNUNG BERECHNEN
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
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2)
        +
        Math.cos(
            toRadians(lat1)
        )
        *
        Math.cos(
            toRadians(lat2)
        )
        *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
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
            totalSeconds /
            3600
        );
    const minutes =
        Math.floor(
            (
                totalSeconds %
                3600
            ) / 60
        );
    const seconds =
        totalSeconds %
        60;
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
    /*
     * Durchschnitt regelmäßig
     * aktualisieren.
     */
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
   GPS FEHLER
   ===================================================== */
function gpsError(
    error
) {
    switch (
        error.code
    ) {
        case 1:
            statusDisplay.textContent =
                "Standortzugriff verweigert";
            break;
        case 2:
            statusDisplay.textContent =
                "GPS nicht verfügbar";
            break;
        case 3:
            statusDisplay.textContent =
                "GPS Timeout";
            break;
        default:
            statusDisplay.textContent =
                "GPS Fehler";
    }
}
/* =====================================================
   RESET
   ===================================================== */
function resetTacho() {
    maximumSpeed = 0;
    totalDistance = 0;
    lastPosition = null;
    startTime =
        Date.now();
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
    statusDisplay.textContent =
        "GPS wird gestartet …";
}
resetButton.addEventListener(
    "click",
    resetTacho
);
/* =====================================================
   TIMER
   ===================================================== */
setInterval(
    updateDuration,
    1000
);
/* =====================================================
   START
   ===================================================== */
startGPS();
