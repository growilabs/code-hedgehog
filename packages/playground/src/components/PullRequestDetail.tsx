import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardContent } from '@/components/ui/card.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { useAtomValue } from 'jotai';
import { ArrowLeft, Calendar, CircleAlert, CirclePlay, GitMerge, GitPullRequest, GitPullRequestClosed, Loader, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { selectedOwnerAtom, selectedRepoAtom } from '../atoms/vcsAtoms.ts';
import { type PullRequestDetail as PullRequestDetailType, getPullRequest } from '../lib/github.ts';
import { formatDate } from '../lib/utils.ts';

type PullRequestContentProps = {
  pullRequest: PullRequestDetailType;
};

const PullRequestContent = ({ pullRequest }: PullRequestContentProps) => {
  const [reviewExecuted, setReviewExecuted] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState('');

  const state = pullRequest.state === 'open' ? 'open' : pullRequest.merged_at != null ? 'merged' : 'closed';

  const executeReview = async () => {
    setReviewLoading(true);

    try {
      // TODO: レビューを実施する
      setReviewExecuted(true);
    } catch (err) {
      console.error('Error executing review:', err);
      setError('レビューの実行に失敗しました。もう一度お試しください。');
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <>
      <Link to="/" className="inline-flex items-center text-primary hover:text-primary/80 mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        プルリクエスト一覧に戻る
      </Link>

      <div className="flex items-start gap-3 mb-8">
        {state === 'open' ? (
          <div className="mt-1 flex-shrink-0 text-green-500">
            <GitPullRequest size={20} />
          </div>
        ) : state === 'merged' ? (
          <div className="mt-1 flex-shrink-0 text-purple-500">
            <GitMerge size={20} />
          </div>
        ) : (
          <div className="mt-1 flex-shrink-0 text-red-500">
            <GitPullRequestClosed size={20} />
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold mb-2">
            {pullRequest.title} <span className="text-muted-foreground font-normal">#{pullRequest.number}</span>
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <Badge variant={state} className="flex items-center gap-1">
              {state}
            </Badge>
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{pullRequest.user.login}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>作成日: {formatDate(pullRequest.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {reviewExecuted ? (
        // TODO: コメント一覧を表示する
        <div>TBD</div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8">
          <Card className="w-full max-w-md bg-muted/40">
            <CardContent className="flex flex-col items-center">
              <CirclePlay className="h-12 w-12 text-primary" />
              <h2 className="text-xl font-semibold mt-4">レビュー準備完了</h2>
              <Button size="lg" className="w-full mt-4" onClick={executeReview} disabled={reviewLoading}>
                {reviewLoading ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    レビュー実行中...
                  </>
                ) : (
                  <>
                    <CirclePlay className="h-4 w-4 mr-2" />
                    レビューを実行
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

const PullRequestDetail = () => {
  const { number } = useParams<{ number: string }>();
  const selectedOwner = useAtomValue(selectedOwnerAtom);
  const selectedRepo = useAtomValue(selectedRepoAtom);
  const [pullRequest, setPullRequest] = useState<PullRequestDetailType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (selectedOwner === '' || selectedRepo === '' || number == null) return;

      setLoading(true);
      setError('');

      try {
        const pullRequest = await getPullRequest(selectedOwner, selectedRepo, Number(number));
        setPullRequest(pullRequest);
      } catch {
        setError('プルリクエスト詳細の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedOwner, selectedRepo, number]);

  return (
    <Card>
      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader className="h-8 w-8 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">プルリクエストの詳細を読み込み中...</p>
          </div>
        ) : error !== '' || pullRequest == null ? (
          <div className="text-center py-8">
            <CircleAlert className="h-8 w-8 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-2">{error || 'プルリクエストが見つかりません'}</p>
            <Link to="/" className="inline-flex items-center text-primary hover:text-primary/80">
              <ArrowLeft className="h-4 w-4 mr-2" />
              プルリクエスト一覧に戻る
            </Link>
          </div>
        ) : (
          <PullRequestContent pullRequest={pullRequest} />
        )}
      </CardContent>
    </Card>
  );
};

export default PullRequestDetail;
