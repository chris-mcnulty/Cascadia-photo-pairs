import { useEffect } from 'react';

export const useTitle = (title?: string) => {
  useEffect(() => {
    const defaultTitle = 'Cascadia Oceanic | Photo Pairs';
    const fullTitle = title ? `${title} | Cascadia Oceanic` : defaultTitle;
    
    if (document.title !== fullTitle) {
      document.title = fullTitle;
    }
    
    return () => {
      document.title = defaultTitle;
    };
  }, [title]);
};