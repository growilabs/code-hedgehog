import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { useAtom, useSetAtom } from 'jotai';
import { selectedOwnerAtom, selectedRepoAtom } from '../atoms/vcsAtoms.ts';

const OwnerSelector = () => {
  const [selectedOwner, setSelectedOwner] = useAtom(selectedOwnerAtom);
  const setSelectedRepo = useSetAtom(selectedRepoAtom);
  const owners = import.meta.env.VITE_OWNERS?.split(',') ?? [];

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
