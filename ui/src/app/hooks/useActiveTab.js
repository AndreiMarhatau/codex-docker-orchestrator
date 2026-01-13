import { useState } from 'react';

function useActiveTab() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') {
      return 1;
    }
    const params = new URLSearchParams(window.location.search);
    const rawTab = (params.get('tab') || window.location.hash || '').replace('#', '');
    const tab = rawTab.toLowerCase();
    if (tab === 'environments') {
      return 0;
    }
    if (tab === 'tasks') {
      return 1;
    }
    if (tab === 'accounts') {
      return 2;
    }
    if (tab === 'settings') {
      return 3;
    }
    return 1;
  });
  return { activeTab, setActiveTab };
}

export default useActiveTab;
