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
/* =========================
   FAHRDATEN
   ========================= */
let maximumSpeed = 0;
let speedSum = 0;
let speedSamples = 0;
let totalDistance = 0;
let lastPosition = null;
let startTime = null;
/* =========================
   GPS
   ========================= */
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
/* =========================
   GPS UPDATE
   ========================= */
function gpsUpdate(position) {
    const coords =
        position.coords;
    const latitude =
        coords.latitude;
    const longitude =
        coords.longitude;
    /* =====================
       FAHRT STARTEN
       ===================== */
    if (startTime === null) {
        startTime =
            Date.now();
    }
    /* =====================
       GESCHWINDIGKEIT
       ===================== */
    if (
        coords.speed !== null &&
        Number.isFinite(coords.speed) &&
        coords.speed >= 0
    ) {
        let speedKmh =
            coords.speed * 3.6;
        speedKmh =
            Math.round(speedKmh);
        if (speedKmh < 1) {
            speedKmh = 0;
        }
        speedDisplay.textContent =
            speedKmh;
        /* Maximum */
        if (
            speedKmh >
            maximumSpeed
        ) {
            maximumSpeed =
                speedKmh;
            maximumDisplay.textContent =
                maximumSpeed;
        }
        /* Durchschnitt */
        speedSum += speedKmh;
        speedSamples++;
        const average =
            speedSum /
            speedSamples;
        averageDisplay.textContent =
            Math.round(average);
    }
    /* =====================
       STRECKE
       ===================== */
    if (lastPosition !== null) {
        const distance =
            calculateDistance(
                lastPosition.latitude,
                lastPosition.longitude,
                latitude,
                longitude
            );
        /*
         * GPS-Sprünge unter
         * 3 Metern ignorieren.
         */
        if (distance >= 0.003) {
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
    /* =====================
       GPS STATUS
       ===================== */
    const accuracy =
        Math.round(
            coords.accuracy
        );
    statusDisplay.textContent =
        `GPS aktiv · ±${accuracy} m`;
}
/* =========================
   ENTFERNUNG
   ========================= */
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
        earthRadius * c
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
/* =========================
   FAHRZEIT
   ========================= */
function updateDuration() {
    if (startTime === null) {
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
            (totalSeconds % 3600) /
            60
        );
    const seconds =
        totalSeconds % 60;
    if (hours > 0) {
        durationDisplay.textContent =
            `${pad(hours)}:` +
            `${pad(minutes)}:` +
            `${pad(seconds)}`;
    } else {
        durationDisplay.textContent =
            `${pad(minutes)}:` +
            `${pad(seconds)}`;
    }
}
function pad(number) {
    return String(number)
        .padStart(2, "0");
}
/* =========================
   GPS FEHLER
   ========================= */
function gpsError(error) {
    switch (error.code) {
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
/* =========================
   RESET
   ========================= */
function resetTacho() {
    maximumSpeed = 0;
    speedSum = 0;
    speedSamples = 0;
    totalDistance = 0;
    lastPosition = null;
    startTime = Date.now();
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
}
resetButton.addEventListener(
    "click",
    resetTacho
);
/* =========================
   ZEIT
   ========================= */
setInterval(
    updateDuration,
    1000
);
/* =========================
   START
   ========================= */
startGPS();
