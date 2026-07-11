import { useEffect, useRef, useState, useCallback } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { AppState } from 'react-native';
import { saveSession, todayLabel } from '../services/db';

const MOTION_THRESH  = 0.15;  // net accel above baseline to count as moving
const STILL_TIMEOUT  = 4000;  // ms of stillness before saving
const MIN_DURATION   = 5;     // minimum seconds to save
const SAMPLE_RATE    = 100;   // ms between samples (10Hz)

export function useGaitSensor({ onSessionSaved } = {}) {
  const [isActive,   setIsActive]   = useState(false);
  const [isMoving,   setIsMoving]   = useState(false);
  const [score,      setScore]      = useState(null);
  const [grade,      setGrade]      = useState(null);
  const [gamma,      setGamma]      = useState(0);   // left/right tilt
  const [sway,       setSway]       = useState(0);
  const [elapsed,    setElapsed]    = useState(0);

  // Internal refs (avoid stale closures)
  const gammaArr    = useRef([]);
  const accelSmooth = useRef(0);
  const sessionStart = useRef(null);
  const sessionTimer = useRef(null);
  const stillTimer   = useRef(null);
  const gyroSub      = useRef(null);
  const accelSub     = useRef(null);
  const smoothGamma  = useRef(0);
  const maxSwayRef   = useRef(0);
  const isMovingRef  = useRef(false);
  const isSessionRef = useRef(false);

  // ── Accelerometer: motion detection ──
  const startAccel = useCallback(() => {
    Accelerometer.setUpdateInterval(SAMPLE_RATE);
    accelSub.current = Accelerometer.addListener(({ x, y, z }) => {
      // Net acceleration above gravity
      const mag = Math.abs(Math.sqrt(x * x + y * y + z * z) - 1.0); // 1g in expo units
      accelSmooth.current = accelSmooth.current * 0.8 + mag * 0.2;
      const moving = accelSmooth.current > MOTION_THRESH;

      if (moving && !isMovingRef.current) {
        // Just started moving
        isMovingRef.current = true;
        setIsMoving(true);
        if (stillTimer.current) { clearTimeout(stillTimer.current); stillTimer.current = null; }
        if (!isSessionRef.current) startWalkSession();
      } else if (!moving && isMovingRef.current && isSessionRef.current) {
        // Possibly stopping — start still timer
        if (!stillTimer.current) {
          stillTimer.current = setTimeout(async () => {
            stillTimer.current = null;
            isMovingRef.current = false;
            setIsMoving(false);
            await endWalkSession();
          }, STILL_TIMEOUT);
        }
      } else if (moving && stillTimer.current) {
        // Moving again — cancel still timer
        clearTimeout(stillTimer.current);
        stillTimer.current = null;
      }
    });
  }, []);

  // ── Gyroscope: tilt/balance detection ──
  const startGyro = useCallback(() => {
    Gyroscope.setUpdateInterval(SAMPLE_RATE);
    gyroSub.current = Gyroscope.addListener(({ x, y, z }) => {
      // x = roll rate (left/right tilt rate in rad/s)
      // Integrate to get approximate angle (simplified)
      smoothGamma.current = smoothGamma.current * 0.85 + (x * 57.3) * 0.15; // rad to deg
      if (isSessionRef.current) {
        gammaArr.current.push(smoothGamma.current);
        const sway60 = gammaArr.current.slice(-60);
        const swayVal = sway60.length > 1
          ? Math.max(...sway60) - Math.min(...sway60) : 0;
        if (swayVal > maxSwayRef.current) maxSwayRef.current = swayVal;

        const sc = calcScore(smoothGamma.current, swayVal);
        setGamma(smoothGamma.current);
        setSway(swayVal);
        setScore(sc);
        setGrade(toGrade(sc));
      }
    });
  }, []);

  // ── Session lifecycle ──
  function startWalkSession() {
    if (isSessionRef.current) return;
    isSessionRef.current = true;
    setIsActive(true);
    gammaArr.current = [];
    maxSwayRef.current = 0;
    sessionStart.current = Date.now();
    let sec = 0;
    sessionTimer.current = setInterval(() => { sec++; setElapsed(sec); }, 1000);
  }

  async function endWalkSession() {
    if (!isSessionRef.current) return;
    isSessionRef.current = false;
    setIsActive(false);
    clearInterval(sessionTimer.current);
    setElapsed(0);

    const dur = Math.round((Date.now() - sessionStart.current) / 1000);
    const arr = gammaArr.current;
    if (arr.length === 0 || dur < MIN_DURATION) return;

    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sc  = calcScore(avg, maxSwayRef.current);
    const gr  = toGrade(sc);

    await saveSession({
      date:      new Date().toISOString(),
      dateLabel: todayLabel(),
      type:      'walk',
      score:     sc,
      grade:     gr,
      sway:      parseFloat(maxSwayRef.current.toFixed(1)),
      duration:  dur,
      avgGamma:  parseFloat(avg.toFixed(1)),
    });

    setScore(sc);
    setGrade(gr);
    onSessionSaved?.({ score: sc, grade: gr, dur });
  }

  // ── AppState: keep sensor alive in background ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        // Re-attach listeners if needed
        if (!accelSub.current) startAccel();
        if (!gyroSub.current)  startGyro();
      }
      // Note: on iOS with Expo Go, sensors may be throttled in background.
      // With a proper Expo build (EAS), background processing works fully.
    });
    return () => sub.remove();
  }, [startAccel, startGyro]);

  // ── Init ──
  useEffect(() => {
    startAccel();
    startGyro();
    return () => {
      accelSub.current?.remove();
      gyroSub.current?.remove();
      clearInterval(sessionTimer.current);
      clearTimeout(stillTimer.current);
    };
  }, [startAccel, startGyro]);

  return { isActive, isMoving, score, grade, gamma, sway, elapsed };
}

// ── Helpers ──
function calcScore(gamma, sway) {
  return Math.max(0, Math.min(100,
    Math.round(100 - Math.abs(gamma) * 1.5 - sway * 2.5)
  ));
}

function toGrade(score) {
  if (score >= 85) return '優秀';
  if (score >= 70) return '良好';
  if (score >= 55) return '普通';
  return '需加強';
}
