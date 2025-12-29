import { useEffect, useState } from 'react';

function useScrollTop(selectedTaskId, activeTab) {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (!selectedTaskId || activeTab !== 1) {
      setShowScrollTop(false);
      return;
    }
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 240);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [selectedTaskId, activeTab]);

  return showScrollTop;
}

export default useScrollTop;
