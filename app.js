/* =====================================================
   DIGITALTACHO V1.7

   GPS, START / STOP / RESET, Wake Lock
   Strecke, Fahrzeit, Durchschnitt, Maximum
   Absolute Höhe und Höhenänderung seit dem ersten START
   Fahrzeit und Messung laufen nach STOP weiter
   ===================================================== */


/* =====================================================
   DOM
   ===================================================== */

const speedElement = document.getElementById("speed");
const averageElement = document.getElementById("averageSpeed");
const maximumElement = document.getElementById("maximumSpeed");
const distanceElement = document.getElementById("distance");
const durationElement = document.getElementById("duration");
const statusElement = document.getElementById("status");
const startButton = document.getElementById("startButton");
const resetButton = document.getElementById("resetButton");


/* =====================================================
   HÖHENANZEIGE
   ===================================================== */

const statsContainer = document.querySelector(".stats");

/* Absolute Höhe */
let altitudeStat = document.getElementById("altitudeStat");

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

/* Höhenänderung seit dem ersten START */
let altitudeChangeStat =
    document.getElementById("altitudeChangeStat");

if (!altitudeChangeStat && statsContainer) {
    altitudeChangeStat = document.createElement("div");
    altitudeChangeStat.id = "altitudeChangeStat";
    altitudeChangeStat.className = "stat";
    altitudeChangeStat.innerHTML = `
        <span class="label">Höhenänderung</span>
        <span id="altitudeChange" class="value">—</span>
    `;
    statsContainer.appendChild(altitudeChangeStat);
}

const altitudeElement = document.getElementById("altitude");
const altitudeChangeElement =
    document.getElementById("altitudeChange");


/* =====================================================
   EINSTELLUNGEN
   ===================================================== */

const MAX_GPS_ACCURACY = 100;
const MAX_REASONABLE_SPEED = 350;
const MAX_POSITION_JUMP = 0.5; // km
const MIN_DISTANCE_STEP = 0.003; // km

/* 0.70 = schnelle Reaktion, 1.00 = ungefiltert */
const SPEED_SMOOTHING = 0.70;

/* GPS-Höhe stärker glätten, da sie stärker schwankt */
const ALTITUDE_SMOOTHING = 0.20;


/* =====================================================
   STATUS UND MESSWERTE
   ===================================================== */

let maximumSpeed = 0;
let totalDistance = 0;
let lastPosition = null;

/*
   startTime enthält nur den Beginn des aktuell laufenden
   Abschnitts. Pausenzeit wird dadurch nicht mitgezählt.
*/
let startTime = null;
let elapsedBeforeCurrentRun = 0;

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

    statusElement.textContent = "GPS wird gestartet …";
}


/* =====================================================
   GPS UPDATE
   ===================================================== */

function gpsUpdate(position) {
    gpsFixReceived = true;

    const coords = position.coords;
    const latitude = coords.latitude;
    const longitude = coords.longitude;
    const accuracy = coords.accuracy;
    const currentTime = position.timestamp;

    /* GPS-Status */
    if (accuracy <= MAX_GPS_ACCURACY) {
        statusElement.textContent =
            `GPS AKTIV · ±${Math.round(accuracy)} m`;
    } else {
        statusElement.textContent =
            `GPS SCHWACH · ±${Math.round(accuracy)} m`;
    }

    /* Absolute GPS-Höhe glätten und anzeigen */
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

        /*
           Beim ersten gültigen Höhenwert während der Fahrt
           die Referenz setzen, falls beim START noch keine
           GPS-Höhe vorlag.
        */
        if (isDriving && startAltitude === null) {
            startAltitude = displayedAltitude;
            altitudeChangeElement.textContent = "0 m";
        }

        /* Höhenänderung immer zum ersten Fahrtstart berechnen */
        if (isDriving && startAltitude !== null) {
            const roundedChange =
                Math.round(displayedAltitude - startAltitude);

            if (roundedChange === 0) {
                altitudeChangeElement.textContent = "0 m";
            } else if (roundedChange > 0) {
                altitudeChangeElement.textContent =
                    `+${roundedChange} m`;
            } else {
                altitudeChangeElement.textContent =
                    `${roundedChange} m`;
            }
        }
    }

    /* Während STOP keine Fahrdaten aufzeichnen */
    if (!isDriving) {
        return;
    }

    /* Ungenaue GPS-Positionen nicht für Fahrtwerte verwenden */
    if (accuracy > MAX_GPS_ACCURACY) {
        return;
    }

    /* Geschwindigkeit: GPS-Wert, sonst Positions-Fallback */
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
            (currentTime - lastPosition.timestamp) / 3600000;

        if (
            timeDifference > 0 &&
            distance <= MAX_POSITION_JUMP
        ) {
            currentSpeed = distance / timeDifference;
        }
    }

    if (currentSpeed > MAX_REASONABLE_SPEED) {
        return;
    }

    /* Geschwindigkeit glätten */
    displayedSpeed +=
        (currentSpeed - displayedSpeed) * SPEED_SMOOTHING;

    if (displayedSpeed < 0.5) {
        displayedSpeed = 0;
    }

    speedElement.textContent = displayedSpeed.toFixed(0);

    /* Höchstgeschwindigkeit */
    if (displayedSpeed > maximumSpeed) {
        maximumSpeed = displayedSpeed;
        maximumElement.textContent =
            `${maximumSpeed.toFixed(1)} km/h`;
    }

    /* Strecke */
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
   
