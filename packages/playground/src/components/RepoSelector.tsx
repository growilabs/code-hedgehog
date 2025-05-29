import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { githubTokenAtom, selectedOwnerAtom, selectedRepoAtom } from '../atoms/vcsAtoms.ts';
import { type Repository, getRepositories } from '../lib/github.ts';

const RepoSelector = () => {
  const accessToken = useAtomValue(githubTokenAtom);
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
        const repositories = await getRepositories(accessToken, selectedOwner);
        setRepos(repositories);
      } catch (err) {
        setError('リポジトリの読み込みに失敗しました。後でもう一度お試しください。');
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, [accessToken, selectedOwner]);

  const handleRepoChange = (value: string) => {
    setSelectedRepo(value);
  };

  if (!selectedOwner) {
    return null;
  }

  if (loading && selectedRepo === '') {
    return (
      <div className="flex">
        <p>リポジトリを読み込み中...</p>
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent border-primary mt-1 ml-2" />
      </div>
    );
  }

  return (
    <>
      <Select disabled={loading} value={selectedRepo} onValueChange={handleRepoChange}>
        <SelectTrigger className="w-full" ref={selectTriggerRef}>
          <SelectValue placeholder="リポジトリを選択">{selectedRepo}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-56">
          {repos.map((repo) => (
            <SelectItem key={repo.id} value={repo.name}>
              {repo.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </>
  );
};

export default RepoSelector;
