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
const MIN_MOVEMENT_SPEED = 1.5;
const MAX_REASONABLE_SPEED = 350;
const MAX_GPS_ACCURACY = 50;
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
    const latitude =
        coords.latitude;
    const longitude =
        coords.longitude;
    const accuracy =
        coords.accuracy;
    /* =================================================
       GPS-STATUS
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
       WENN KEINE FAHRT LÄUFT
       ================================================= */
    if (!isDriving) {
        return;
    }
    /* =================================================
       GÜLTIGE GPS-GENAUIGKEIT PRÜFEN
       ================================================= */
    if (
        Number.isFinite(accuracy) &&
        accuracy > MAX_GPS_ACCURACY
    ) {
        return;
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
        if (
            speedKmh <=
            MAX_REASONABLE_SPEED
        ) {
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
         * GPS-Sprünge ignorieren.
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
    if (
        speedHistory.length >
        SPEED_HISTORY_SIZE
    ) {
        speedHistory.shift();
    }
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
   START / STOP
   ===================================================== */
function toggleDriving() {
    if (!isDriving) {
        /* =============================
           START
           ============================= */
        isDriving = true;
        startTime =
            Date.now();
        lastPosition =
            null;
        speedHistory =
            [];
        startButton.textContent =
            "STOP";
        statusDisplay.textContent =
            "Fahrt läuft";
    } else {
        /* =============================
           STOP
           ============================= */
        isDriving = false;
        speedHistory =
            [];
        speedDisplay.textContent =
            "0";
        startButton.textContent =
            "START";
        statusDisplay.textContent =
            "Fahrt beendet";
    }
}
startButton.addEventListener(
    "click",
    toggleDriving
);
/* =====================================================
   RESET
   ===================================================== */
function resetTacho() {
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
    statusDisplay.textContent =
        "GPS bereit";
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
