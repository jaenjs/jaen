import { useState, useEffect } from "react";

interface GeoPosition {
  latitude: number;
  longitude: number;
}

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation wird nicht unterstützt");
      setLoading(false);
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
        setPosition({ latitude: 46.6247, longitude: 14.3052 });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  return { position, error, loading };
}
