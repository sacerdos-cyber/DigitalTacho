/* =====================================================
   DIGITALTACHO V1.6
   MIT EXPERIMENTELLER SCHRÄGLAGENANZEIGE
   ===================================================== */


/* =====================================================
   ELEMENTE
   ===================================================== */

const speedElement = document.getElementById("speed");

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

const zeroButton =
    document.getElementById("zeroButton");

const leanLeftElement =
    document.getElementById("leanLeft");

const leanRightElement =
    document.getElementById("leanRight");

const leanStatusElement =
    document.getElementById("leanStatus");

const statsContainer =
    document.querySelector(".stats");


/* =====================================================
   HÖHENANZEIGEN
   ===================================================== */

let altitudeStat =
    document.getElementById("altitudeStat");

if (!altitudeStat && statsContainer) {

    altitudeStat = document.createElement("div");

    altitudeStat.id = "altitudeStat";
    altitudeStat.className = "stat";

    altitudeStat.innerHTML = `
        <span class="label">Höhe</span>
        <span id="altitude" class="value">— m</span>
    `;

    statsContainer.appendChild(altitudeStat);
}

let altitudeChangeStat =
    document.getElementById("altitudeChangeStat");

if (!altitudeChangeStat && statsContainer) {

    altitudeChangeStat =
        document.createElement("div");

    altitudeChangeStat.id = "altitudeChangeStat";
    altitudeChangeStat.className = "stat";

    altitudeChangeStat.innerHTML = `
        <span class="label">Höhenänderung</span>
        <span id="altitudeChange" class="value">—</span>
    `;

    statsContainer.appendChild(altitudeChangeStat);
}

const altitudeElement =
    document.getElementById("altitude");

const altitudeChangeElement =
    document.getElementById("altitudeChange");


/* =====================================================
   EINSTELLUNGEN
   ===================================================== */

const MAX_GPS_ACCURACY = 100;
const MAX_REASONABLE_SPEED = 350;

const MAX_POSITION_JUMP = 0.5;
const MIN_DISTANCE_STEP = 0.003;

const SPEED_SMOOTHING = 0.70;
const ALTITUDE_SMOOTHING = 0.20;


/* =====================================================
   FAHRTVARIABLEN
   ===================================================== */

let maximumSpeed = 0;
let totalDistance = 0;

let lastPosition = null;
let startTime = null;

let isDriving = false;
let gpsFixReceived = false;

let wakeLock = null;

let displayedSpeed = 0;
let displayedAltitude = null;
let startAltitude = null;


/* =====================================================
   GPS STARTEN
   ===================================================== */

function startGPS() {

    if (!("geolocation" in navigator)) {

        statusElement.textContent =
            "GPS wird nicht unterstützt";

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
   GPS AKTUALISIEREN
   ===================================================== */

function gpsUpdate(position) {

    gpsFixReceived = true;

    const coords = position.coords;

    const latitude = coords.latitude;
    const longitude = coords.longitude;
    const accuracy = coords.accuracy;

    const currentTime = position.timestamp;


    /* GPS-STATUS */

    if (accuracy <= MAX_GPS_ACCURACY) {

        statusElement.textContent =
            `GPS AKTIV · ±${Math.round(accuracy)} m`;

    } else {

        statusElement.textContent =
            `GPS SCHWACH · ±${Math.round(accuracy)} m`;
    }


    /* =================================================
       HÖHENMESSER
       ================================================= */

    if (
        coords.altitude !== null &&
        Number.isFinite(coords.altitude)
    ) {

        const gpsAltitude = coords.altitude;

        if (displayedAltitude === null) {

            displayedAltitude = gpsAltitude;

        } else {

            displayedAltitude +=
                (gpsAltitude - displayedAltitude) *
                ALTITUDE_SMOOTHING;
        }

        altitudeElement.textContent =
            `${Math.round(displayedAltitude)} m`;


        if (
            isDriving &&
            startAltitude !== null
        ) {

            const change = Math.round(
                displayedAltitude - startAltitude
            );

            if (change > 0) {

                altitudeChangeElement.textContent =
                    `+${change} m`;

            } else {

                altitudeChangeElement.textContent =
                    `${change} m`;
            }
        }
    }


    /* KEINE FAHRT AKTIV */

    if (!isDriving) return;

    if (accuracy > MAX_GPS_ACCURACY) return;


    /* =================================================
       GESCHWINDIGKEIT
       ================================================= */

    let currentSpeed = 0;

    if (
        coords.speed !== null &&
        Number.isFinite(coords.speed) &&
        coords.speed >= 0
    ) {

        currentSpeed = coords.speed * 3.6;

    } else if (lastPosition) {

        const distance = calculateDistance(
            lastPosition.latitude,
            lastPosition.longitude,
            latitude,
            longitude
        );

        const timeDifference =
            (currentTime - lastPosition.timestamp) /
            3600000;

        if (
            timeDifference > 0 &&
            distance <= MAX_POSITION_JUMP
        ) {

            currentSpeed =
                distance / timeDifference;
        }
    }

    if (currentSpeed > MAX_REASONABLE_SPEED) {
        return;
    }


    /* GLÄTTUNG */

    displayedSpeed +=
        (currentSpeed - displayedSpeed) *
        SPEED_SMOOTHING;

    if (displayedSpeed < 0.5) {
        displayedSpeed = 0;
    }

    speedElement.textContent =
        displayedSpeed === 0
            ? "0"
            : displayedSpeed.toFixed(1);


    /* MAXIMUM */

    if (displayedSpeed > maximumSpeed) {

        maximumSpeed = displayedSpeed;

        maximumElement.textContent =
            `${maximumSpeed.toFixed(1)} km/h`;
    }


    /* STRECKE */

    if (lastPosition) {

        const distance = calculateDistance(
            lastPosition.latitude,
            lastPosition.longitude,
            latitude,
            longitude
        );

        if (
            distance >= MIN_DISTANCE_STEP &&
            distance <= MAX_POSITION_JUMP
        ) {

            totalDistance += distance;

            distanceElement.textContent =
                `${totalDistance.toFixed(2)} km`;
        }
    }

    lastPosition = {
        latitude,
        longitude,
        timestamp: currentTime
    };

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
   HAVERSINE
   ===================================================== */

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const earthRadius = 6371;

    const dLat = degreesToRadians(lat2 - lat1);
    const dLon = degreesToRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(degreesToRadians(lat1)) *
        Math.cos(degreesToRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return earthRadius * c;
}

function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}


/* =====================================================
   DURCHSCHNITT
   ===================================================== */

function updateAverageSpeed() {

    if (!startTime || totalDistance <= 0) {
        return;
    }

    const elapsedHours =
        (Date.now() - startTime) / 3600000;

    if (elapsedHours <= 0) return;

    const averageSpeed =
        totalDistance / elapsedHours;

    averageElement.textContent =
        `${averageSpeed.toFixed(1)} km/h`;
}


/* =====================================================
   FAHRZEIT
   ===================================================== */

setInterval(updateTimer, 1000);

function updateTimer() {

    if (!startTime || !isDriving) return;

    const elapsed =
        Date.now() - startTime;

    durationElement.textContent =
        formatDuration(elapsed);

    updateAverageSpeed();
}

function formatDuration(milliseconds) {

    const totalSeconds =
        Math.floor(milliseconds / 1000);

    const hours =
        Math.floor(totalSeconds / 3600);

    const minutes =
        Math.floor((totalSeconds % 3600) / 60);

    const seconds =
        totalSeconds % 60;

    return [hours, minutes, seconds]
        .map(value =>
            String(value).padStart(2, "0")
        )
        .join(":");
}


/* =====================================================
   WAKE LOCK
   ===================================================== */

async function requestWakeLock() {

    if (!("wakeLock" in navigator)) return;

    try {

        wakeLock =
            await navigator.wakeLock.request("screen");

    } catch (error) {

        console.log(
            "Wake Lock nicht verfügbar:",
            error
        );
    }
}

async function releaseWakeLock() {

    if (!wakeLock) return;

    try {

        await wakeLock.release();

    } catch (error) {

        console.log(
            "Wake Lock Fehler:",
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

            isDriving = true;

            startTime = Date.now();

            lastPosition = null;
            displayedSpeed = 0;

            if (displayedAltitude !== null) {

                startAltitude = displayedAltitude;

                altitudeChangeElement.textContent =
                    "0 m";

            } else {

                startAltitude = null;

                altitudeChangeElement.textContent =
                    "—";
            }

            statusElement.textContent =
                "FAHRT LÄUFT";

            startButton.textContent = "STOP";

            startButton.classList.add(
                "stop-button"
            );

            await requestWakeLock();

        } else {

            isDriving = false;
            displayedSpeed = 0;

            speedElement.textContent = "0";

            statusElement.textContent =
                "FAHRT BEENDET";

            startButton.textContent = "START";

            startButton.classList.remove(
                "stop-button"
            );

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

        speedElement.textContent = "0";

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

        startButton.textContent = "START";

        startButton.classList.remove(
            "stop-button"
        );

        await releaseWakeLock();
    }
);


/* =====================================================
   WAKE LOCK BEI RÜCKKEHR
   ===================================================== */

document.addEventListener(
    "visibilitychange",
    async () => {

        if (
            document.visibilityState === "visible" &&
            isDriving
        ) {

            await requestWakeLock();
        }
    }
);


/* =====================================================
   EXPERIMENTELLE NEIGUNGSMESSUNG
   ===================================================== */

/*
   Montage:
   iPhone im Querformat, nahezu senkrecht,
   Display zum Fahrer.

   Die Beta-Achse wird als Ausgangspunkt
   für die Neigungsmessung verwendet.

   Achtung:
   Kein verlässlicher Motorrad-
   Schräglagenmesser während Kurvenfahrt.
*/

let sensorActive = false;
let sensorReceived = false;

let currentTilt = null;
let zeroTilt = null;

let displayedTilt = 0;

const TILT_SMOOTHING = 0.25;


/* =====================================================
   BILDSCHIRMAUSRICHTUNG
   ===================================================== */

function getScreenAngle() {

    if (
        screen.orientation &&
        Number.isFinite(screen.orientation.angle)
    ) {

        return screen.orientation.angle;
    }

    if (typeof window.orientation === "number") {
        return window.orientation;
    }

    return 90;
}


/* =====================================================
   WINKELDIFFERENZ
   ===================================================== */

function angleDifference(a, b) {

    return ((a - b + 540) % 360) - 180;
}


/* =====================================================
   SENSORWERTE
   ===================================================== */

function updateTilt(event) {

    if (
        event.beta === null ||
        !Number.isFinite(event.beta)
    ) {

        return;
    }

    sensorReceived = true;

    /*
       Querformat:
       Beta als experimenteller
       Neigungsindikator.

       Bei 270° Bildschirmdrehung
       wird die Richtung umgekehrt.
    */

    const screenAngle = getScreenAngle();

    const direction =
        screenAngle === 270 ||
        screenAngle === -90
            ? -1
            : 1;

    currentTilt = event.beta * direction;


    /* AUF KALIBRIERUNG WARTEN */

    if (zeroTilt === null) {

        leanStatusElement.textContent =
            "Motorrad aufrecht stellen und ZERO drücken";

        return;
    }


    /* RELATIVER NEIGUNGSWINKEL */

    const relativeTilt =
        angleDifference(currentTilt, zeroTilt);


    /* GLÄTTUNG */

    displayedTilt +=
        (relativeTilt - displayedTilt) *
        TILT_SMOOTHING;


    /* ANZEIGE */

    const tilt = Math.round(displayedTilt);

    if (Math.abs(tilt) < 1) {

        leanLeftElement.textContent = "0°";
        leanRightElement.textContent = "0°";

        return;
    }

    if (tilt < 0) {

        leanLeftElement.textContent =
            `${Math.abs(tilt)}°`;

        leanRightElement.textContent = "0°";

    } else {

        leanLeftElement.textContent = "0°";

        leanRightElement.textContent =
            `${tilt}°`;
    }
}


/* =====================================================
   SENSOR AKTIVIEREN
   ===================================================== */

async function activateTiltSensor() {

    if (!("DeviceOrientationEvent" in window)) {

        leanStatusElement.textContent =
            "Neigungssensor nicht verfügbar";

        return false;
    }

    try {

        /*
           iOS verlangt gegebenenfalls
           eine ausdrückliche Freigabe
           nach einem Tastendruck.
        */

        if (
            typeof DeviceOrientationEvent.requestPermission
            === "function"
        ) {

            const permission =
                await DeviceOrientationEvent.requestPermission();

            if (permission !== "granted") {

                leanStatusElement.textContent =
                    "Sensorzugriff nicht erlaubt";

                return false;
            }
        }

        if (!sensorActive) {

            window.addEventListener(
                "deviceorientation",
                updateTilt
            );

            sensorActive = true;
        }

        leanStatusElement.textContent =
            "Warte auf Neigungssensor …";

        return true;

    } catch (error) {

        console.log(
            "Neigungssensor Fehler:",
            error
        );

        leanStatusElement.textContent =
            "Sensorfreigabe fehlgeschlagen";

        return false;
    }
}


/* =====================================================
   ZERO-KALIBRIERUNG
   ===================================================== */

zeroButton.addEventListener(
    "click",
    async () => {

        if (!sensorActive) {

            const activated =
                await activateTiltSensor();

            if (!activated) return;
        }

        /*
           Die Kalibrierung erfolgt erst,
           wenn tatsächlich ein gültiger
           Sensorwert eingetroffen ist.
        */

        if (
            !sensorReceived ||
            currentTilt === null
        ) {

            leanStatusElement.textContent =
                "Sensor startet – ZERO erneut drücken";

            return;
        }

        zeroTilt = currentTilt;
        displayedTilt = 0;

        leanLeftElement.textContent = "0°";
        leanRightElement.textContent = "0°";

        leanStatusElement.textContent =
            "Neigung kalibriert · experimentell";
    }
);


/* =====================================================
   INITIALISIERUNG
   ===================================================== */

startGPS();
