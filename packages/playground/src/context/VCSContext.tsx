import { type ReactNode, createContext, useState } from 'react';

interface VCSContextType {
  selectedOwner: string;
  setSelectedOwner: (owner: string) => void;
  selectedRepo: string;
  setSelectedRepo: (repo: string) => void;
}

export const VCSContext = createContext<VCSContextType>({
  selectedOwner: '',
  setSelectedOwner: () => {},
  selectedRepo: '',
  setSelectedRepo: () => {},
});

interface VCSProviderProps {
  children: ReactNode;
}

export const VCSProvider = ({ children }: VCSProviderProps) => {
  const [selectedOwner, setSelectedOwner] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');

  return <VCSContext.Provider value={{ selectedOwner, setSelectedOwner, selectedRepo, setSelectedRepo }}>{children}</VCSContext.Provider>;
};
