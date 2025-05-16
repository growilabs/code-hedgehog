import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { useAtom, useAtomValue } from 'jotai';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { selectedOwnerAtom, selectedRepoAtom } from '../atoms/vcsAtoms.ts';

const RepoSelector = () => {
  const selectedOwner = useAtomValue(selectedOwnerAtom);
  const [selectedRepo, setSelectedRepo] = useAtom(selectedRepoAtom);

  const [repos, setRepos] = useState<string[]>([]);
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
        // TODO: Github API を叩いてリポジトリ一覧を取得する
        // setRepos(fetchedRepos);
      } catch (err) {
        // setError('リポジトリの読み込みに失敗しました。後でもう一度お試しください。');
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
        <SelectTrigger className="w-full">
          <SelectValue placeholder="リポジトリを選択">
            {loading ? (
              <div className="flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                <span>リポジトリを読み込み中...</span>
              </div>
            ) : (
              selectedRepo
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {repos.map((repo) => (
            <SelectItem key={repo} value={repo}>
              {repo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default RepoSelector;
