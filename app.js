/* =====================================================
   DIGITALTACHO V1.7.1
   Grundlage: funktionierende V1.6

   Höhe und Höhenänderung
   Geschwindigkeit mit Nachkommastelle
   START / STOP / RESET
   Fahrzeit ohne Pausen
   Durchschnitt, Maximum und Strecke
   Wake Lock während START
   ===================================================== */

(() => {
    function initializeDigitalTacho() {

        /* =================================================
           DOM
           ================================================= */

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


        /*
           Fehlende HTML-Elemente sichtbar melden,
           statt die Initialisierung unbemerkt abzubrechen.
        */
        const requiredElements = {
            speed: speedElement,
            averageSpeed: averageElement,
            maximumSpeed: maximumElement,
            distance: distanceElement,
            duration: durationElement,
            status: statusElement,
            startButton,
            resetButton
        };

        const missingIds =
            Object.keys(requiredElements).filter(
                id => !requiredElements[id]
            );

        if (missingIds.length > 0) {
            const message =
                "HTML-Element fehlt: " +
                missingIds.join(", ");

            console.error(message);

            if (statusElement) {
                statusElement.textContent = message;
            }

            return;
        }


        /* =================================================
           HÖHENANZEIGE

           Vorhandene Felder verwenden.
           Fehlende Felder automatisch in .stats ergänzen.
           ================================================= */

        const statsContainer =
            document.querySelector(".stats");

        function ensureAltitudeField(
            statId,
            valueId,
            label,
            initialValue
        ) {
            let valueElement =
                document.getElementById(valueId);

            if (valueElement) {
                return valueElement;
            }

            if (!statsContainer) {
                return null;
            }

            let stat =
                document.getElementById(statId);

            if (!stat) {
                stat = document.createElement("div");
                stat.id = statId;
                stat.className = "stat";

                statsContainer.appendChild(stat);
            }

            stat.innerHTML = `
                <span class="label">${label}</span>
                <span id="${valueId}" class="value">
                    ${initialValue}
                </span>
            `;

            return document.getElementById(valueId);
        }

        const altitudeElement = ensureAltitudeField(
            "altitudeStat",
            "altitude",
            "Höhe",
            "— m"
        );

        const altitudeChangeElement = ensureAltitudeField(
            "altitudeChangeStat",
            "altitudeChange",
            "Höhenänderung",
            "—"
        );

        if (!altitudeElement || !altitudeChangeElement) {
            statusElement.textContent =
                "HTML: Statistikbereich .stats fehlt";

            return;
        }


        /* =================================================
           EINSTELLUNGEN
           ================================================= */

        const MAX_GPS_ACCURACY = 100;
        const MAX_REASONABLE_SPEED = 350;

        const MAX_POSITION_JUMP = 0.5;  // km
        const MIN_DISTANCE_STEP = 0.003; // km

        const SPEED_SMOOTHING = 0.70;
        const ALTITUDE_SMOOTHING = 0.20;


        /* =================================================
           MESSWERTE UND STATUS
           ================================================= */

        let maximumSpeed = 0;
        let totalDistance = 0;
        let lastPosition = null;

        /*
           Beginn des aktuell laufenden Abschnitts.
           Abgeschlossene Abschnitte werden separat gespeichert.
        */
        let startTime = null;
        let elapsedBeforeCurrentRun = 0;

        let isDriving = false;
        let gpsFixReceived = false;
        let wakeLock = null;

        let displayedSpeed = 0;
        let displayedAltitude = null;
        let startAltitude = null;


        /* =================================================
           GPS STARTEN
           ================================================= */

        function startGPS() {
            if (!("geolocation" in navigator)) {
                statusElement.textContent =
                    "GPS wird von diesem Gerät nicht unterstützt.";

                return;
            }

            statusElement.textContent =
                "GPS wird gestartet …";

            try {
                navigator.geolocation.watchPosition(
                    gpsUpdate,
                    gpsError,
                    {
                        enableHighAccuracy: true,
                        maximumAge: 500,
                        timeout: 20000
                    }
                );
            } catch (error) {
                console.error(
                    "GPS-Startfehler:",
                    error
                );

                statusElement.textContent =
                    `GPS-Startfehler: ${error.message}`;
            }
        }


        /* =================================================
           GPS UPDATE
           ================================================= */

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


            /* =============================================
               ABSOLUTE HÖHE
               Auch vor START und während STOP aktualisieren.
               ============================================= */

            if (
                coords.altitude !== null &&
                Number.isFinite(coords.altitude)
            ) {
                if (displayedAltitude === null) {
                    displayedAltitude = coords.altitude;
                } else {
                    displayedAltitude +=
                        (
                            coords.altitude -
                            displayedAltitude
                        ) * ALTITUDE_SMOOTHING;
                }

                altitudeElement.textContent =
                    `${Math.round(displayedAltitude)} m`;


                /* =========================================
                   HÖHENÄNDERUNG

                   Referenz bleibt beim Fortsetzen erhalten.
                   Falls beim ersten START noch keine Höhe
                   vorlag, ersten gültigen Höhenwert verwenden.
                   ========================================= */

                if (isDriving) {
                    if (startAltitude === null) {
                        startAltitude = displayedAltitude;
                    }

                    const change = Math.round(
                        displayedAltitude - startAltitude
                    );

                    if (change === 0) {
                        altitudeChangeElement.textContent =
                            "0 m";
                    } else if (change > 0) {
                        altitudeChangeElement.textContent =
                            `+${change} m`;
                    } else {
                        altitudeChangeElement.textContent =
                            `${change} m`;
                    }
                }
            }


            /* Während STOP keine Fahrdaten aufzeichnen */
            if (!isDriving) {
                return;
            }

            if (accuracy > MAX_GPS_ACCURACY) {
                return;
            }


            /* =============================================
               GESCHWINDIGKEIT
               ============================================= */

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
                    (
                        currentTime -
                        lastPosition.timestamp
                    ) / 3600000;

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


            /* Geschwindigkeit glätten */
            displayedSpeed +=
                (
                    currentSpeed -
                    displayedSpeed
                ) * SPEED_SMOOTHING;

            if (displayedSpeed < 0.5) {
                displayedSpeed = 0;
            }

            speedElement.textContent =
                displayedSpeed === 0
                    ? "0"
                    : displayedSpeed.toFixed(1);


            /* =============================================
               MAXIMUM
               ============================================= */

            if (displayedSpeed > maximumSpeed) {
                maximumSpeed = displayedSpeed;

                maximumElement.textContent =
                    `${maximumSpeed.toFixed(1)} km/h`;
            }


            /* =============================================
               STRECKE
               ============================================= */

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


        /* =================================================
           GPS FEHLER
           ================================================= */

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


        /* =================================================
           HAVERSINE DISTANZ
           Ergebnis in Kilometern.
           ================================================= */

        function calculateDistance(
            lat1,
            lon1,
            lat2,
            lon2
        ) {
            const earthRadius = 6371;

            const dLat = degreesToRadians(
                lat2 - lat1
            );

            const dLon = degreesToRadians(
                lon2 - lon1
            );

            const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos(degreesToRadians(lat1)) *
                Math.cos(degreesToRadians(lat2)) *
                Math.sin(dLon / 2) ** 2;

            const c = 2 * Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );

            return earthRadius * c;
        }

        function degreesToRadians(degrees) {
            return degrees * Math.PI / 180;
        }


        /* =================================================
           FAHRZEIT UND DURCHSCHNITT
           ================================================= */

        function getElapsedTime() {
            const currentRunTime =
                isDriving && startTime !== null
                    ? Date.now() - startTime
                    : 0;

            return (
                elapsedBeforeCurrentRun +
                currentRunTime
            );
        }

        function updateAverageSpeed() {
            const elapsedHours =
                getElapsedTime() / 3600000;

            if (
                totalDistance <= 0 ||
                elapsedHours <= 0
            ) {
                return;
            }

            const averageSpeed =
                totalDistance / elapsedHours;

            averageElement.textContent =
                `${averageSpeed.toFixed(1)} km/h`;
        }

        function updateTimer() {
            if (!isDriving) {
                return;
            }

            durationElement.textContent =
                formatDuration(getElapsedTime());

            updateAverageSpeed();
        }

        function formatDuration(milliseconds) {
            const totalSeconds = Math.floor(
                milliseconds / 1000
            );

            const hours = Math.floor(
                totalSeconds / 3600
            );

            const minutes = Math.floor(
                (totalSeconds % 3600) / 60
            );

            const seconds = totalSeconds % 60;

            return [hours, minutes, seconds]
                .map(
                    value =>
                        String(value).padStart(2, "0")
                )
                .join(":");
        }


        /* =================================================
           WAKE LOCK
           ================================================= */

        async function requestWakeLock() {
            if (!("wakeLock" in navigator)) {
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


        /* =================================================
           START / STOP
           ================================================= */

        startButton.addEventListener(
            "click",
            async () => {
                if (!isDriving) {

                    /* START oder Fortsetzen */
                    isDriving = true;
                    startTime = Date.now();

                    /*
                       Keine Strecke zwischen STOP und
                       erneutem START mitzählen.
                    */
                    lastPosition = null;
                    displayedSpeed = 0;


                    /* Höhenreferenz nur erstmals setzen */
                    if (startAltitude === null) {
                        startAltitude =
                            displayedAltitude;

                        altitudeChangeElement.textContent =
                            startAltitude === null
                                ? "—"
                                : "0 m";
                    }

                    statusElement.textContent =
                        "FAHRT LÄUFT";

                    startButton.textContent =
                        "STOP";

                    startButton.classList.add(
                        "stop-button"
                    );

                    await requestWakeLock();

                } else {

                    /*
                       STOP: Zeit zuerst speichern,
                       dann Fahrt pausieren.
                    */
                    elapsedBeforeCurrentRun =
                        getElapsedTime();

                    isDriving = false;
                    startTime = null;
                    displayedSpeed = 0;

                    speedElement.textContent =
                        "0";

                    durationElement.textContent =
                        formatDuration(
                            elapsedBeforeCurrentRun
                        );

                    updateAverageSpeed();

                    statusElement.textContent =
                        "FAHRT BEENDET";

                    startButton.textContent =
                        "START";

                    startButton.classList.remove(
                        "stop-button"
                    );

                    await releaseWakeLock();
                }
            }
        );


        /* =================================================
           RESET
           ================================================= */

        resetButton.addEventListener(
            "click",
            async () => {
                isDriving = false;

                maximumSpeed = 0;
                totalDistance = 0;
                lastPosition = null;

                startTime = null;
                elapsedBeforeCurrentRun = 0;

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

                startButton.classList.remove(
                    "stop-button"
                );

                await releaseWakeLock();
            }
        );


        /* =================================================
           WAKE LOCK BEI RÜCKKEHR ZUM TAB
           ================================================= */

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


        /* =================================================
           TIMER UND GPS STARTEN
           ================================================= */

        setInterval(updateTimer, 1000);
        startGPS();
    }


    /* =====================================================
       ERST INITIALISIEREN, WENN DAS HTML GELADEN IST
       ===================================================== */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeDigitalTacho,
            { once: true }
        );
    } else {
        initializeDigitalTacho();
    }
})();
