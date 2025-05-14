import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { useContext } from 'react';
import { VCSContext } from '../context/VCSContext.tsx';

const OwnerSelector = () => {
  const { selectedOwner, setSelectedOwner } = useContext(VCSContext);
  const owners = import.meta.env.VITE_OWNERS?.split(',') ?? [];

  const handleOwnerChange = (value: string) => {
    setSelectedOwner(value);
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
