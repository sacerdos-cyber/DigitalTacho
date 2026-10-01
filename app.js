/* =====================================================
   DIGITALTACHO V1.6
   GPS
   Schnelle Geschwindigkeitsanzeige
   START / STOP / RESET
   Wake Lock
   Strecke
   Fahrzeit
   Durchschnitt
   Maximum
   Absolute Höhe
   Höhenänderung seit START
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
   HÖHENANZEIGE
   ===================================================== */
const statsContainer =
    document.querySelector(".stats");
/*
   Absolute Höhe
*/
let altitudeStat =
    document.getElementById("altitudeStat");
if (!altitudeStat && statsContainer) {
    altitudeStat =
        document.createElement("div");
    altitudeStat.id =
        "altitudeStat";
    altitudeStat.className =
        "stat";
    altitudeStat.innerHTML = `
        <span class="label">
            Höhe
        </span>
        <span id="altitude" class="value">
            — m
        </span>
    `;
    statsContainer.appendChild(
        altitudeStat
    );
}
/*
   Höhenänderung
*/
let altitudeChangeStat =
    document.getElementById(
        "altitudeChangeStat"
    );
if (
    !altitudeChangeStat &&
    statsContainer
) {
    altitudeChangeStat =
        document.createElement("div");
    altitudeChangeStat.id =
        "altitudeChangeStat";
    altitudeChangeStat.className =
        "stat";
    altitudeChangeStat.innerHTML = `
        <span class="label">
            Höhenänderung
        </span>
        <span
            id="altitudeChange"
            class="value"
        >
            —
        </span>
    `;
    statsContainer.appendChild(
        altitudeChangeStat
    );
}
const altitudeElement =
    document.getElementById(
        "altitude"
    );
const altitudeChangeElement =
    document.getElementById(
        "altitudeChange"
    );
/* =====================================================
   EINSTELLUNGEN
   ===================================================== */
const MAX_GPS_ACCURACY = 100;
const MAX_REASONABLE_SPEED = 350;
const MAX_POSITION_JUMP = 0.5;
const MIN_DISTANCE_STEP = 0.003;
/*
   Geschwindigkeit:
   0.70 = sehr schnelle Reaktion
*/
const SPEED_SMOOTHING = 0.85;
/*
   Höhe:
   GPS-Höhe wird stärker geglättet,
   weil sie deutlich stärker schwankt.
*/
const ALTITUDE_SMOOTHING = 0.20;
/* =====================================================
   STATUS
   ===================================================== */
let maximumSpeed = 0;
let totalDistance = 0;
let lastPosition = null;
let startTime = null;
let isDriving = false;
let gpsFixReceived = false;
let wakeLock = null;
/*
   Aktuelle Geschwindigkeit
*/
let displayedSpeed = 0;
/*
   Aktuelle geglättete Höhe
*/
let displayedAltitude = null;
/*
   Höhe beim Start der Fahrt
*/
let startAltitude = null;
/* =====================================================
   GPS STARTEN
   ===================================================== */
function startGPS() {
    if (
        !("geolocation" in navigator)
    ) {
        statusElement.textContent =
            "GPS wird von diesem Gerät nicht unterstützt.";
        return;
    }
    navigator.geolocation.watchPosition(
        gpsUpdate,
        gpsError,
        {
            enableHighAccuracy: true,
            maximumAge: 500,
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
    const currentTime =
        position.timestamp;
    /* =================================================
       GPS STATUS
       ================================================= */
    if (
        accuracy <= MAX_GPS_ACCURACY
    ) {
        statusElement.textContent =
            `GPS AKTIV · ±${Math.round(accuracy)} m`;
    } else {
        statusElement.textContent =
            `GPS SCHWACH · ±${Math.round(accuracy)} m`;
    }
    /* =================================================
       ABSOLUTE HÖHE
       ================================================= */
    if (
        coords.altitude !== null &&
        Number.isFinite(
            coords.altitude
        )
    ) {
        const gpsAltitude =
            coords.altitude;
        /*
           Erster Höhenwert
        */
        if (
            displayedAltitude === null
        ) {
            displayedAltitude =
                gpsAltitude;
        } else {
            /*
               Höhenwerte glätten
            */
            displayedAltitude =
                displayedAltitude +
                (
                    gpsAltitude -
                    displayedAltitude
                ) *
                ALTITUDE_SMOOTHING;
        }
        altitudeElement.textContent =
            `${Math.round(displayedAltitude)} m`;
        /* =============================================
           HÖHENÄNDERUNG
           Erst berechnen, wenn START gedrückt wurde.
           ============================================= */
        if (
            isDriving &&
            startAltitude !== null
        ) {
            const altitudeChange =
                displayedAltitude -
                startAltitude;
            /*
               Kleine GPS-Schwankungen unter
               1 Meter nicht anzeigen.
            */
            const roundedChange =
                Math.round(
                    altitudeChange
                );
            if (
                Math.abs(
                    roundedChange
                ) < 1
            ) {
                altitudeChangeElement.textContent =
                    "0 m";
            } else if (
                roundedChange > 0
            ) {
                altitudeChangeElement.textContent =
                    `+${roundedChange} m`;
            } else {
                altitudeChangeElement.textContent =
                    `${roundedChange} m`;
            }
        }
    }
    /* =================================================
       NICHT WÄHREND DER FAHRT
       ================================================= */
    if (!isDriving) {
        return;
    }
    /* =================================================
       SCHLECHTE GPS-GENAUIGKEIT
       ================================================= */
    if (
        accuracy >
        MAX_GPS_ACCURACY
    ) {
        return;
    }
    /* =================================================
       GESCHWINDIGKEIT
       ================================================= */
    let currentSpeed = 0;
    /*
       Primär die Geschwindigkeit von iOS verwenden.
    */
    if (
        coords.speed !== null &&
        Number.isFinite(
            coords.speed
        ) &&
        coords.speed >= 0
    ) {
        currentSpeed =
            coords.speed * 3.6;
    } else if (
        lastPosition
    ) {
        /*
           Fallback:
           Geschwindigkeit aus der
           Positionsänderung berechnen.
        */
        const distance =
            calculateDistance(
                lastPosition.latitude,
                lastPosition.longitude,
                latitude,
                longitude
            );
        const timeDifference =
            (
                currentTime -
                lastPosition.timestamp
            ) / 3600000;
        if (
            timeDifference > 0 &&
            distance <= MAX_POSITION_JUMP
        ) {
            currentSpeed =
                distance /
                timeDifference;
        }
    }
    /* =================================================
       GESCHWINDIGKEITS-CHECK
       ================================================= */
    if (
        currentSpeed >
        MAX_REASONABLE_SPEED
    ) {
        return;
    }
    /* =================================================
       GESCHWINDIGKEIT GLÄTTEN
       ================================================= */
    displayedSpeed =
        displayedSpeed +
        (
            currentSpeed -
            displayedSpeed
        ) *
        SPEED_SMOOTHING;
    if (
        displayedSpeed < 0.5
    ) {
        displayedSpeed = 0;
    }
    speedElement.textContent =
        displayedSpeed.toFixed(0);
    /* =================================================
       MAXIMUM
       ================================================= */
    if (
        displayedSpeed >
        maximumSpeed
    ) {
        maximumSpeed =
            displayedSpeed;
        maximumElement.textContent =
            `${maximumSpeed.toFixed(1)} km/h`;
    }
    /* =================================================
       STRECKE
       ================================================= */
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
    /* =================================================
       LETZTE POSITION
       ================================================= */
    lastPosition = {
        latitude,
        longitude,
        timestamp:
            currentTime
    };
    /* =================================================
       DURCHSCHNITT
       ================================================= */
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
   DURCHSCHNITTSGESCHWINDIGKEIT
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

    /*
       Timer nur während einer laufenden
       Fahrt aktualisieren.

       Bei STOP bleibt die zuletzt angezeigte
       Zeit stehen.
    */

    if (
        !startTime ||
        !isDriving
    ) {

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
            /* =========================================
               START
               ========================================= */
            isDriving = true;
            startTime =
                Date.now();
            lastPosition = null;
            displayedSpeed = 0;
            /*
               Aktuelle Höhe als
               Startreferenz speichern.
            */
            if (
                displayedAltitude !== null
            ) {
                startAltitude =
                    displayedAltitude;
                altitudeChangeElement.textContent =
                    "0 m";
            } else {
                startAltitude = null;
                altitudeChangeElement.textContent =
                    "—";
            }
            statusElement.textContent =
                "FAHRT LÄUFT";
            startButton.textContent =
                "STOP";
            await requestWakeLock();
        } else {
            /* =========================================
               STOP
               ========================================= */
            isDriving = false;
            displayedSpeed = 0;
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
        displayedSpeed = 0;
        displayedAltitude = null;
        startAltitude = null;
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
        altitudeElement.textContent =
            "— m";
        altitudeChangeElement.textContent =
            "—";
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
   WAKE LOCK BEI RÜCKKEHR ZU SAFARI
   ===================================================== */
document.addEventListener(
    "visibilitychange",
    async () => {
        if (
            document.visibilityState ===
            "visible" &&
            isDriving
        ) {
            await requestWakeLock();
        }
    }
);
/* =====================================================
   GPS BEIM LADEN STARTEN
   ===================================================== */
startGPS();
