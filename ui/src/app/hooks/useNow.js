import { useEffect, useState } from 'react';

const isTestEnv = Boolean(import.meta.env.VITEST) || import.meta.env.MODE === 'test';

function useNow(enabled) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || isTestEnv) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  return now;
}

export default useNow;
