/* =====================================================
   DIGITALTACHO V1.5
   GPS
   Schnelle Geschwindigkeitsanzeige
   START / STOP / RESET
   Wake Lock
   Strecke
   Fahrzeit
   Durchschnitt
   Maximum
   Höhenmesser
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
   HÖHENANZEIGE ERZEUGEN
   ===================================================== */
const statsContainer =
    document.querySelector(".stats");
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
const altitudeElement =
    document.getElementById("altitude");
/* =====================================================
   EINSTELLUNGEN
   ===================================================== */
/*
   GPS-Genauigkeit:
   Positionen mit schlechterer Genauigkeit
   werden für die Fahrt verworfen.
*/
const MAX_GPS_ACCURACY = 100;
/*
   Sicherheitsgrenze gegen GPS-Ausreißer.
*/
const MAX_REASONABLE_SPEED = 350;
/*
   Maximal zulässiger Positionssprung
   zwischen zwei GPS-Messungen.
   0.5 km = 500 Meter
*/
const MAX_POSITION_JUMP = 0.5;
/*
   Kleinste Distanz für eine
   relevante Positionsänderung.
   0.003 km = 3 Meter
*/
const MIN_DISTANCE_STEP = 0.003;
/*
   Geschwindigkeit:
   Je höher der Wert, desto schneller
   folgt die Anzeige der aktuellen GPS-Geschwindigkeit.
   0.70 = sehr direkte Reaktion.
*/
const SPEED_SMOOTHING = 0.70;
/*
   Höhe wird stärker geglättet,
   da GPS-Höhenwerte deutlich stärker schwanken.
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
   Geglättete Geschwindigkeit.
*/
let displayedSpeed = 0;
/*
   Geglättete Höhe.
*/
let displayedAltitude = null;
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
            /*
               Möglichst aktuelle GPS-Daten.
            */
            maximumAge: 500,
            /*
               GPS darf sich bis zu 20 Sekunden
               Zeit für einen Fix nehmen.
            */
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
    /* =================================================
       GPS STATUS
       ================================================= */
    if (accuracy <= MAX_GPS_ACCURACY) {
        statusElement.textContent =
            `GPS AKTIV · ±${Math.round(accuracy)} m`;
    } else {
        statusElement.textContent =
            `GPS SCHWACH · ±${Math.round(accuracy)} m`;
    }
    /* =================================================
       HÖHE
       Die Höhe wird unabhängig von START
       angezeigt.
       ================================================= */
    if (
        coords.altitude !== null &&
        Number.isFinite(coords.altitude)
    ) {
        const gpsAltitude =
            coords.altitude;
        if (displayedAltitude === null) {
            /*
               Erster Höhenwert.
            */
            displayedAltitude =
                gpsAltitude;
        } else {
            /*
               Starke Glättung gegen
               typische GPS-Höhenschwankungen.
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
    }
    /* =================================================
       SCHLECHTE GPS-GENAUIGKEIT
       Höhenanzeige bleibt trotzdem erhalten.
       Für die Fahrt wird der Messpunkt verworfen.
       ================================================= */
    if (!isDriving) {
        return;
    }
    if (
        accuracy >
        MAX_GPS_ACCURACY
    ) {
        return;
    }
    /* =================================================
       ZEITPUNKT DER GPS-MESSUNG
       ================================================= */
    const currentTime =
        position.timestamp;
    /* =================================================
       GESCHWINDIGKEIT
       ================================================= */
    let currentSpeed = 0;
    /*
       Primär verwenden wir die von iOS
       gemeldete GPS-Geschwindigkeit.
    */
    if (
        coords.speed !== null &&
        Number.isFinite(coords.speed) &&
        coords.speed >= 0
    ) {
        currentSpeed =
            coords.speed * 3.6;
    } else if (lastPosition) {
        /*
           Falls iOS keine Geschwindigkeit liefert,
           berechnen wir sie aus der Positionsänderung.
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
       SCHNELLE GESCHWINDIGKEITSGLÄTTUNG
       ================================================= */
    displayedSpeed =
        displayedSpeed +
        (
            currentSpeed -
            displayedSpeed
        ) *
        SPEED_SMOOTHING;
    /*
       Kleine Werte auf 0 setzen,
       damit der Tacho nicht bei 0.1–0.5 km/h
       hängen bleibt.
    */
    if (
        displayedSpeed < 0.5
    ) {
        displayedSpeed = 0;
    }
    speedElement.textContent =
        displayedSpeed.toFixed(0);
    /* =================================================
       MAXIMALGESCHWINDIGKEIT
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
        /*
           Nur plausible Bewegungen übernehmen.
        */
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
       LETZTE POSITION SPEICHERN
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
            /* -----------------------------------------
               START
               ----------------------------------------- */
            isDriving = true;
            startTime =
                Date.now();
            lastPosition = null;
            displayedSpeed = 0;
            statusElement.textContent =
                "FAHRT LÄUFT";
            startButton.textContent =
                "STOP";
            await requestWakeLock();
        } else {
            /* -----------------------------------------
               STOP
               ----------------------------------------- */
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
   WAKE LOCK NACH RÜCKKEHR ZU SAFARI
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
