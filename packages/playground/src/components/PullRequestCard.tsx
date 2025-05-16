import { Badge } from '@/components/ui/badge.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { type PullRequest, getPullRequests } from '@/lib/github.ts';
import { useAtomValue } from 'jotai';
import { Calendar, Check, CircleAlert, Clock, GitPullRequest, Loader, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { selectedOwnerAtom, selectedRepoAtom } from '../atoms/vcsAtoms.ts';
import { formatDate } from '../lib/utils.ts';

type PullRequestListProps = {
  selectedOwner: string;
  selectedRepo: string;
};

const PullRequestList = React.memo(({ selectedOwner, selectedRepo }: PullRequestListProps) => {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (selectedOwner === '' || selectedRepo === '') return;

      setLoading(true);
      setError('');

      try {
        const fetchedPullRequests = await getPullRequests(selectedOwner, selectedRepo);
        setPullRequests(fetchedPullRequests);
      } catch (err) {
        setError('プルリクエストの読み込みに失敗しました。後でもう一度お試しください。');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedOwner, selectedRepo]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">プルリクエストを読み込み中...</p>
      </div>
    );
  }

  if (error !== '') {
    return (
      <div className="text-center py-8">
        <CircleAlert className="h-8 w-8 text-destructive mx-auto mb-4" />
        <p className="text-destructive mb-2">{error}</p>
        <p className="text-muted-foreground">別のリポジトリを選択するか、後でもう一度お試しください。</p>
      </div>
    );
  }

  if (pullRequests.length === 0) {
    return (
      <div className="text-center py-8">
        <GitPullRequest className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">このリポジトリにはプルリクエストが見つかりませんでした</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pullRequests.map((pr) => (
        <div key={pr.id}>
          <Card className="hover:bg-muted/20 transition-colors py-0">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`mt-1 flex-shrink-0 ${pr.state === 'open' ? 'text-green-500' : 'text-purple-500'}`}>
                  <GitPullRequest size={20} />
                </div>
                <div className="flex-grow min-w-0">
                  <h3 className="text-base font-medium mb-1 truncate">
                    {pr.title} <span className="text-muted-foreground font-normal">#{pr.number}</span>
                  </h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <Badge variant={pr.state === 'open' ? 'success' : 'pending'} className="flex items-center gap-1">
                      {pr.state === 'open' ? <Check className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                      {pr.state}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{pr.user.login}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>作成日: {formatDate(pr.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
});

const PullRequestCard = () => {
  const selectedOwner = useAtomValue(selectedOwnerAtom);
  const selectedRepo = useAtomValue(selectedRepoAtom);

  if (selectedOwner === '' || selectedRepo === '') return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{selectedRepo} のプルリクエスト</CardTitle>
      </CardHeader>
      <CardContent>
        <PullRequestList selectedOwner={selectedOwner} selectedRepo={selectedRepo} />
      </CardContent>
    </Card>
  );
};

export default PullRequestCard;
