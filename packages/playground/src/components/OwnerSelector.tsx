import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { useAtom, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { selectedOwnerAtom, selectedRepoAtom } from '../atoms/vcsAtoms.ts';

const OwnerSelector = () => {
  const [selectedOwner, setSelectedOwner] = useAtom(selectedOwnerAtom);
  const setSelectedRepo = useSetAtom(selectedRepoAtom);
  const [owners, setOwners] = useState<string[]>([]);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchOwners = async () => {
      try {
        const response = await fetch('/api/config/owners', { signal });
        if (!response.ok) {
          // Check if the request was aborted, which might result in status 0 or an AbortError
          if (signal.aborted) {
            console.log('Fetch owners request was aborted before completion.');
            return;
          }
          throw new Error(`Failed to fetch owners: ${response.statusText} (status: ${response.status})`);
        }
        const data = await response.json();
        if (!signal.aborted) {
          // Ensure component is still mounted
          setOwners(data.owners || []);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Fetch owners request was aborted by cleanup or navigation.');
        } else {
          console.error('Error fetching owners:', error);
          // Fallback to VITE_OWNERS for local dev if API fails or not available
          // and if the error was not an abort.
          const viteOwners = import.meta.env.VITE_OWNERS?.split(',') ?? [];
          setOwners(viteOwners);
        }
      }
    };
    fetchOwners();

    return () => {
      abortController.abort();
    };
  }, []);

  const handleOwnerChange = (value: string) => {
    setSelectedOwner(value);
    setSelectedRepo('');
  };

  return (
    <div className="relative">
      <Select value={selectedOwner} onValueChange={handleOwnerChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="組織を選択">{selectedOwner}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {owners.map((owner) => (
            <SelectItem key={owner} value={owner}>
              {owner}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default OwnerSelector;
