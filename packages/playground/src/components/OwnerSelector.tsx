import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { useAtom, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { selectedOwnerAtom, selectedRepoAtom } from '../atoms/vcsAtoms.ts';

const OwnerSelector = () => {
  const [selectedOwner, setSelectedOwner] = useAtom(selectedOwnerAtom);
  const setSelectedRepo = useSetAtom(selectedRepoAtom);
  const [owners, setOwners] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true; // コンポーネントがマウントされているかを追跡

    const fetchOwners = async () => {
      try {
        const response = await fetch('/api/config/owners');

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        // コンポーネントがまだマウントされている場合のみ状態を更新
        if (isMounted) {
          setOwners(data.owners || []);
        }
      } catch (error) {
        console.error('Failed to fetch owners:', error);

        // エラー時はフォールバック値を使用（コンポーネントがマウントされている場合のみ）
        if (isMounted) {
          const fallbackOwners = import.meta.env.VITE_OWNERS?.split(',') || [];
          setOwners(fallbackOwners);
        }
      }
    };

    fetchOwners();

    // クリーンアップ関数：コンポーネントのアンマウント時に実行
    return () => {
      isMounted = false;
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
