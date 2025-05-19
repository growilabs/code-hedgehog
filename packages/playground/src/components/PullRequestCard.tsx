import { Badge } from '@/components/ui/badge.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination.tsx';
import { type PullRequest, getPullRequestsWithMaxPage } from '@/lib/github.ts';
import { useAtomValue } from 'jotai';
import { Calendar, Check, CircleAlert, Clock, GitMerge, GitPullRequest, GitPullRequestClosed, Loader, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    (async () => {
      if (selectedOwner === '' || selectedRepo === '') return;

      setLoading(true);
      setError('');

      try {
        const { pullRequests: fetchedPullRequests, maxPage } = await getPullRequestsWithMaxPage(selectedOwner, selectedRepo, currentPage);
        setPullRequests(fetchedPullRequests);
        setTotalPages(maxPage);
      } catch (err) {
        setError('プルリクエストの読み込みに失敗しました。後でもう一度お試しください。');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedOwner, selectedRepo, currentPage]);

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 7;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return pageNumbers;
  };

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
    <>
      <div className="space-y-3">
        {pullRequests.map((pr) => {
          const state = pr.state === 'open' ? 'open' : pr.merged_at != null ? 'merged' : 'closed';

          return (
            <div key={pr.id}>
              <Card className="hover:bg-muted/20 transition-colors py-0">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
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
                    <div className="flex-grow min-w-0">
                      <h3 className="text-base font-medium mb-1 truncate">
                        <Link to={`/pulls/${pr.number}`} className="hover:underline">
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
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination>
            <PaginationContent>
              <PaginationItem className="cursor-pointer">
                <PaginationPrevious onClick={goToPreviousPage} className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''} />
              </PaginationItem>

              {getPageNumbers().map((pageNumber) => (
                <PaginationItem key={pageNumber} className="cursor-pointer">
                  <PaginationLink onClick={() => goToPage(pageNumber)} isActive={pageNumber === currentPage}>
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem className="cursor-pointer">
                <PaginationNext onClick={goToNextPage} className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <div className="text-center text-sm text-muted-foreground mt-2">
            {currentPage} / {totalPages}ページ
          </div>
        </div>
      )}
    </>
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
