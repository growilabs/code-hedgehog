import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { hc } from 'hono/client';
import { useAtom, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import type { AppGetType } from '../../server.ts';
import { selectedOwnerAtom, selectedRepoAtom } from '../atoms/vcsAtoms.ts';

const client = hc<AppGetType>('/');

const OwnerSelector = () => {
  const [selectedOwner, setSelectedOwner] = useAtom(selectedOwnerAtom);
  const setSelectedRepo = useSetAtom(selectedRepoAtom);
  const [owners, setOwners] = useState<string[]>([]);

  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const response = await client.api.config.owners.$get(); // client を apiClient に変更
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        const data = await response.json();

        if (data && Array.isArray(data.owners)) {
          setOwners(data.owners);
        }
      } catch (error) {
        console.error('Failed to fetch owners:', error);
      }
    };

    fetchOwners();
  }, []);

  const handleOwnerChange = (value: string) => {
    setSelectedOwner(value);
    setSelectedRepo('');
  };

  return (
    <div className="relative">
      <Select value={selectedOwner} onValueChange={handleOwnerChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="組織を選択">{selectedOwner || '組織を選択'}</SelectValue>
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
