import { type ReactNode, createContext, useState } from 'react';

interface VCSContextType {
  selectedOwner: string;
  setSelectedOwner: (owner: string) => void;
  selectedRepository: string;
  setSelectedRepository: (repository: string) => void;
}

export const VCSContext = createContext<VCSContextType>({
  selectedOwner: '',
  setSelectedOwner: () => {},
  selectedRepository: '',
  setSelectedRepository: () => {},
});

interface VCSProviderProps {
  children: ReactNode;
}

export const VCSProvider = ({ children }: VCSProviderProps) => {
  const [selectedOwner, setSelectedOwner] = useState('');
  const [selectedRepository, setSelectedRepository] = useState('');

  return <VCSContext.Provider value={{ selectedOwner, setSelectedOwner, selectedRepository, setSelectedRepository }}>{children}</VCSContext.Provider>;
};
