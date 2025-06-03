import { Badge } from '@/components/ui/badge.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination.tsx';
import { type DisplayablePullRequest, getPullRequestsWithMaxPage } from '@/lib/github.ts';
import { useAtomValue } from 'jotai';
import { Calendar, CircleAlert, GitMerge, GitPullRequest, GitPullRequestClosed, Loader, Search as SearchIcon, User } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { githubTokenAtom, selectedOwnerAtom, selectedRepoAtom } from '../atoms/vcsAtoms.ts';
import { formatDate } from '../lib/utils.ts';

// カスタムフック：プルリクエストの状態管理とデータ取得
const usePullRequests = (selectedOwner: string, selectedRepo: string) => {
  const accessToken = useAtomValue(githubTokenAtom);
  const [pullRequests, setPullRequests] = useState<DisplayablePullRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeKeyword, setActiveKeyword] = useState('');

  const fetchPullRequests = useCallback(async () => {
    if (!selectedOwner || !selectedRepo) return;

    setLoading(true);
    setError('');

    try {
      const { pullRequests: fetchedPullRequests, maxPage } = await getPullRequestsWithMaxPage(
        accessToken,
        selectedOwner,
        selectedRepo,
        currentPage,
        activeKeyword,
      );
      setPullRequests(fetchedPullRequests);
      setTotalPages(maxPage);
    } catch (err) {
      setError('プルリクエストの読み込みに失敗しました。後でもう一度お試しください。');
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedOwner, selectedRepo, currentPage, activeKeyword]);

  useEffect(() => {
    fetchPullRequests();
  }, [fetchPullRequests]);

  const updateKeyword = useCallback((keyword: string) => {
    setCurrentPage(1);
    setActiveKeyword(keyword);
  }, []);

  return {
    pullRequests,
    loading,
    error,
    currentPage,
    totalPages,
    activeKeyword,
    setCurrentPage,
    updateKeyword,
  };
};

// コンポーネント：検索フィルター
const SearchFilter = React.memo(({ onSearch }: { onSearch: (keyword: string) => void }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(inputValue);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="キーワードでフィルタリングしてEnter..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-full pl-10"
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        キーワードのみの場合、タイトル・本文・コメントから検索します。 GitHubのUIと同様に修飾子も利用可能です (例: <code>author:ユーザー名</code>,{' '}
        <code>label:バグ</code>, <code>is:merged</code>)。
      </p>
    </form>
  );
});

// コンポーネント：プルリクエストアイテム
const PullRequestItem = React.memo(({ pr }: { pr: DisplayablePullRequest }) => {
  const accessToken = useAtomValue(githubTokenAtom);
  const selectedOwner = useAtomValue(selectedOwnerAtom);
  const selectedRepo = useAtomValue(selectedRepoAtom);

  const state = pr.merged_at ? 'merged' : pr.state;

  const getStateIcon = () => {
    switch (state) {
      case 'open':
        return <GitPullRequest size={20} className="text-green-500" />;
      case 'merged':
        return <GitMerge size={20} className="text-purple-500" />;
      case 'closed':
        return <GitPullRequestClosed size={20} className="text-red-500" />;
    }
  };

  const handleItemClick = () => {
    // 画面遷移する直前にアクセストークンを localStorage に保存し、遷移後すぐに削除する
    localStorage.setItem('github_token', accessToken);
  };

  return (
    <Card className="hover:bg-muted/20 transition-colors py-0">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex-shrink-0">{getStateIcon()}</div>
          <div className="flex-grow min-w-0">
            <h3 className="text-base font-medium mb-1 truncate">
              <Link to={`/pulls/${pr.number}?owner=${selectedOwner}&repo=${selectedRepo}`} className="hover:underline" onClick={handleItemClick}>
                {pr.title} <span className="text-muted-foreground font-normal">#{pr.number}</span>
              </Link>
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <Badge variant={state} className="flex items-center gap-1">
                {state}
              </Badge>
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{pr.user?.login}</span>
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
  );
});

// コンポーネント：ページネーション
const PaginationControls = React.memo(
  ({
    currentPage,
    totalPages,
    onPageChange,
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  }) => {
    const getVisiblePageNumbers = useCallback(() => {
      const maxVisiblePages = 7;
      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
    }, [currentPage, totalPages]);

    const handlePageChange = useCallback(
      (page: number) => {
        if (page >= 1 && page <= totalPages) {
          onPageChange(page);
        }
      },
      [totalPages, onPageChange],
    );

    if (totalPages <= 1) return null;

    return (
      <div className="mt-6">
        <Pagination>
          <PaginationContent>
            <PaginationItem className="cursor-pointer">
              <PaginationPrevious onClick={() => handlePageChange(currentPage - 1)} className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''} />
            </PaginationItem>

            {getVisiblePageNumbers().map((pageNumber) => (
              <PaginationItem key={pageNumber} className="cursor-pointer">
                <PaginationLink onClick={() => handlePageChange(pageNumber)} isActive={pageNumber === currentPage}>
                  {pageNumber}
                </PaginationLink>
              </PaginationItem>
            ))}

            <PaginationItem className="cursor-pointer">
              <PaginationNext
                onClick={() => handlePageChange(currentPage + 1)}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        <div className="text-center text-sm text-muted-foreground mt-2">
          {currentPage} / {totalPages}ページ
        </div>
      </div>
    );
  },
);

// コンポーネント：状態別表示
const StateDisplay = ({
  loading,
  error,
  pullRequests,
  activeKeyword,
  children,
}: {
  loading: boolean;
  error: string;
  pullRequests: DisplayablePullRequest[];
  activeKeyword: string;
  children: React.ReactNode;
}) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">プルリクエストを読み込み中...</p>
      </div>
    );
  }

  if (error) {
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
        <p className="text-muted-foreground">
          {activeKeyword ? `「${activeKeyword}」に一致するプルリクエストは見つかりませんでした` : 'このリポジトリにはプルリクエストが見つかりませんでした'}
        </p>
      </div>
    );
  }

  return children;
};

// メインコンポーネント：プルリクエストリスト
const PullRequestList = React.memo(
  ({
    selectedOwner,
    selectedRepo,
  }: {
    selectedOwner: string;
    selectedRepo: string;
  }) => {
    const { pullRequests, loading, error, currentPage, totalPages, activeKeyword, setCurrentPage, updateKeyword } = usePullRequests(
      selectedOwner,
      selectedRepo,
    );

    return (
      <>
        <SearchFilter onSearch={updateKeyword} />
        <StateDisplay loading={loading} error={error} pullRequests={pullRequests} activeKeyword={activeKeyword}>
          <div className="space-y-3">
            {pullRequests.map((pr) => (
              <PullRequestItem key={pr.id} pr={pr} />
            ))}
          </div>
          <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </StateDisplay>
      </>
    );
  },
);

// ルートコンポーネント：プルリクエストカード
const PullRequestCard = () => {
  const selectedOwner = useAtomValue(selectedOwnerAtom);
  const selectedRepo = useAtomValue(selectedRepoAtom);

  if (!selectedOwner || !selectedRepo) return null;

  return (
    <Card className="mt-6">
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
