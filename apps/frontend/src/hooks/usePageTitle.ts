import { useEffect } from 'react';

export function usePageTitle(section: string) {
  useEffect(() => {
    document.title = `${section} - Family Budget`;
    return () => {
      document.title = 'Family Budget';
    };
  }, [section]);
}
