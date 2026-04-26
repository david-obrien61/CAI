/**
 * FILE: usePowerSense.js
 * PLATFORM: Web (React DOM)
 * PURPOSE: Hook that monitors device battery API and wake locks to toggle between Toolbox and Floor modes.
 * DEPENDENCIES: react
 */

import { useState, useEffect, useRef } from 'react';

export const usePowerSense = () => {
  const [powerState, setPowerState] = useState({
    isToolboxMode: false,
    voiceMode: 'TAP_TO_TALK',
    autoLockEnabled: true
  });
  const wakeLockRef = useRef(null);

  useEffect(() => {
    if (!('getBattery' in navigator)) {
      console.warn("Battery API not supported. Defaulting to standard mode.");
      return;
    }

    let batteryInstance = null;

    const handleBatteryChange = async (e) => {
      const battery = e.target || e;
      const isCharging = battery.charging;
      
      console.log(`[PowerSense] Device Charging: ${isCharging}`);
      
      setPowerState({
        isToolboxMode: isCharging,
        voiceMode: isCharging ? 'CONTINUOUS' : 'TAP_TO_TALK',
        autoLockEnabled: !isCharging // false means disabled (Toolbox Mode), true means 5-min auto-lock (Floor Mode)
      });

      // Wake Lock API implementation to prevent screen dimming in Toolbox Mode
      if (isCharging && 'wakeLock' in navigator) {
        try {
          if (!wakeLockRef.current) {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            console.log("Wake Lock active: Screen dimming natively prevented.");
          }
        } catch (err) {
          console.warn(`Wake Lock error: ${err.name}, ${err.message}`);
        }
      } else {
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
          console.log("Wake Lock released: OS now managing screen timeout normally.");
        }
      }
    };

    navigator.getBattery().then(battery => {
      batteryInstance = battery;
      handleBatteryChange(battery);
      battery.addEventListener('chargingchange', handleBatteryChange);
    });

    const handleVisibilityChange = async () => {
      // Re-request wake lock if tab becomes visible again and charging is active
      if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
         try {
             wakeLockRef.current = await navigator.wakeLock.request('screen');
         } catch(e) {
             console.warn(e);
         }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (batteryInstance) {
        batteryInstance.removeEventListener('chargingchange', handleBatteryChange);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.warn);
      }
    };
  }, []);

  return powerState;
};
