import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { selectedOwnerAtom, selectedRepoAtom } from '../atoms/vcsAtoms.ts';
import { type Repository, getRepositories } from '../lib/github.ts';

const RepoSelector = () => {
  const selectedOwner = useAtomValue(selectedOwnerAtom);
  const [selectedRepo, setSelectedRepo] = useAtom(selectedRepoAtom);

  const selectTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRepos = async () => {
      if (selectedOwner === '') {
        setRepos([]);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const repositories = await getRepositories(selectedOwner);
        setRepos(repositories);
        setTimeout(() => selectTriggerRef.current?.click(), 10);
      } catch (err) {
        setError('リポジトリの読み込みに失敗しました。後でもう一度お試しください。');
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, [selectedOwner]);

  const handleRepoChange = (value: string) => {
    setSelectedRepo(value);
  };

  if (!selectedOwner) {
    return null;
  }

  return (
    <div className="relative">
      <Select disabled={loading} value={selectedRepo} onValueChange={handleRepoChange}>
        <SelectTrigger className="w-full" ref={selectTriggerRef}>
          <SelectValue placeholder={loading ? 'リポジトリを読み込み中...' : 'リポジトリを選択'}>{selectedRepo}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {repos.map((repo) => (
            <SelectItem key={repo.id} value={repo.name}>
              {repo.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default RepoSelector;
