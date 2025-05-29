import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardContent } from '@/components/ui/card.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { hc } from 'hono/client';
import { useAtomValue } from 'jotai';
import {
  ArrowLeft,
  Calendar,
  CircleAlert,
  CirclePlay,
  ExternalLink,
  FileCode,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Loader,
  MessageSquare,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, Navigate, useParams } from 'react-router-dom';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

import type { AppType } from '../../server.ts';
import { githubTokenAtom, selectedOwnerAtom, selectedRepoAtom } from '../atoms/vcsAtoms.ts';
import { downloadCSV, generatCSV } from '../lib/commentsCSV.ts';
import { type PullRequestDetail as PullRequestDetailType, getPullRequest } from '../lib/github.ts';
import { formatDate } from '../lib/utils.ts';

const client = hc<AppType>('/');

export type Comment = {
  path: string;
  position?: number;
  body: string;
  type: 'inline' | 'file' | 'pr';
  diffId: string;
};

type PullRequestContentProps = {
  pullRequest: PullRequestDetailType;
  githubToken: string;
  owner: string;
  repo: string;
  number: string;
};

const PullRequestContent = ({ pullRequest, githubToken, owner, repo, number }: PullRequestContentProps) => {
  const [reviewExecuted, setReviewExecuted] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [prComments, setPRComments] = useState<Comment[]>([]);
  const [inlineComments, setInlineComments] = useState<Comment[]>([]);
  const [error, setError] = useState('');

  const state = pullRequest.state === 'open' ? 'open' : pullRequest.merged_at != null ? 'merged' : 'closed';

  const executeReview = async () => {
    setReviewLoading(true);

    try {
      const res = await client.api['run-processor'].$post({
        json: { githubToken, owner, repo, number },
      });

      if (res.ok) {
        const { comments } = await res.json();
        setComments(comments);

        const fetchedInlineComments: Comment[] = [];
        const fetchedPRComments: Comment[] = [];

        for (const comment of comments) {
          if (comment.type === 'inline') {
            fetchedInlineComments.push(comment);
          } else if (comment.type === 'pr') {
            fetchedPRComments.push(comment);
          }
        }

        setInlineComments(fetchedInlineComments);
        setPRComments(fetchedPRComments);
        setReviewExecuted(true);
      } else {
        const error = await res.json();
        console.error('Error executing review:', error);
        setError('レビューの実行に失敗しました。もう一度お試しください。');
      }
    } catch (err) {
      console.error('Error executing review:', err);
      setError('レビューの実行に失敗しました。もう一度お試しください。');
    } finally {
      setReviewLoading(false);
    }
  };

  const downloadCommentsCSV = () => {
    try {
      const commentsData = generatCSV(comments);
      const csvFileName = `code_hedgehog_review_result_${owner}_${repo}_${number}.csv`;

      downloadCSV(commentsData, csvFileName);
    } catch (error) {
      console.error('Error download csv:', error);
    }
  };

  return (
    <>
      <div className="flex justify-between">
        <Link to="/" className="inline-flex items-center text-primary hover:text-primary/80 mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          プルリクエスト一覧に戻る
        </Link>
        {reviewExecuted && (
          <Button size="sm" variant="outline" onClick={downloadCommentsCSV}>
            レビュー結果 CSV ダウンロード
          </Button>
        )}
      </div>

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
            <a href={`https://github.com/${owner}/${repo}/pull/${number}`} className="hover:underline" target="_blank" rel="noopener noreferrer">
              {pullRequest.title} <span className="text-muted-foreground font-normal">#{pullRequest.number}</span>
            </a>
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
        <div>
          {prComments.length > 0 && (
            <>
              <h2 className="text-lg font-medium">全体概要</h2>
              {prComments.map((overviewComment) => (
                <Card className="bg-muted/50 mt-4 py-0" key={overviewComment.body}>
                  <CardContent className="markdown-container">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                      {overviewComment.body}
                    </ReactMarkdown>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
          <h2 className="text-lg font-medium mt-6 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            コメント ({inlineComments.length})
          </h2>

          {inlineComments.length === 0 ? (
            <Card className="bg-muted/50 mt-4">
              <CardContent className="flex flex-col items-center justify-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">指摘がありませんでした。</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 mt-4">
              {inlineComments.map((comment) => (
                <Card key={comment.body} className="bg-muted/50 py-0">
                  <CardContent className="p-4">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                      {comment.body}
                    </ReactMarkdown>

                    <div className="flex items-center text-xs text-muted-foreground bg-muted p-2 rounded mt-3">
                      <FileCode className="h-3.5 w-3.5 mr-1" />
                      <span className="mr-2">{comment.path}:</span>
                      <span>差分内で上から {comment.position ?? '-'} 行目の位置</span>
                      <a
                        href={`https://github.com/${owner}/${repo}/pull/${number}/files#diff-${comment.diffId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center text-primary hover:text-primary/80"
                      >
                        GitHubで表示
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8">
          <Card className="w-full max-w-md bg-muted/40">
            <CardContent className="flex flex-col items-center">
              <CirclePlay className="h-12 w-12 text-primary" />
              {githubToken === '' ? (
                <>
                  <h2 className="text-xl font-semibold mt-4">レビュー実行不可</h2>
                  <p className="text-muted-foreground text-sm text-center mt-2">実行するには GitHub のアクセストークンを設定する必要があります。</p>
                </>
              ) : reviewLoading ? (
                <>
                  <h2 className="text-xl font-semibold mt-4">レビュー実行中</h2>
                  <p className="text-muted-foreground text-sm text-center mt-2">実行完了まで3分ほどかかります。</p>
                </>
              ) : (
                <h2 className="text-xl font-semibold mt-4">レビュー実行可能</h2>
              )}
              <Button size="lg" className="w-full mt-4" onClick={executeReview} disabled={reviewLoading || githubToken === ''}>
                {reviewLoading ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    レビュー実行中...
                  </>
                ) : (
                  <>
                    <CirclePlay className="h-4 w-4 mr-2" />
                    レビューを実行する
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
  const githubToken = useAtomValue(githubTokenAtom);
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
        const pullRequest = await getPullRequest(githubToken, selectedOwner, selectedRepo, Number(number));
        setPullRequest(pullRequest);
      } catch {
        setError('プルリクエスト詳細の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [githubToken, selectedOwner, selectedRepo, number]);

  if (selectedOwner === '' || selectedRepo === '') {
    return <Navigate to="/" replace />;
  }

  return (
    <Card>
      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader className="h-8 w-8 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">プルリクエストの詳細を読み込み中...</p>
          </div>
        ) : error !== '' || pullRequest == null || number == null ? (
          <div className="text-center py-8">
            <CircleAlert className="h-8 w-8 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-2">{error || 'プルリクエストが見つかりません'}</p>
            <Link to="/" className="inline-flex items-center text-primary hover:text-primary/80">
              <ArrowLeft className="h-4 w-4 mr-2" />
              プルリクエスト一覧に戻る
            </Link>
          </div>
        ) : (
          <PullRequestContent pullRequest={pullRequest} githubToken={githubToken} owner={selectedOwner} repo={selectedRepo} number={number} />
        )}
      </CardContent>
    </Card>
  );
};

export default PullRequestDetail;
