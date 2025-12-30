import { useState } from 'react';

function useActiveTab() {
  const [activeTab, setActiveTab] = useState(1);
  return { activeTab, setActiveTab };
}

export default useActiveTab;
