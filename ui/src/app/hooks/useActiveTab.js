import { useCallback, useState } from 'react';
import { readTabQuery, writeTabQuery } from '../query-state.js';

function useActiveTab() {
  const [activeTab, setActiveTabState] = useState(readTabQuery);

  const setActiveTab = useCallback((value) => {
    setActiveTabState(value);
    writeTabQuery(value);
  }, []);

  return { activeTab, setActiveTab };
}

export default useActiveTab;
