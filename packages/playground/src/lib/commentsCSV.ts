import type { Comment } from '../components/PullRequestDetail.tsx';

const COMMENTS_CSV_HEADER = ['Type', 'Path', 'Position', 'Body'];

const generateCSVString = (csvHeader: string[], csvBody: string[][]) => {
  return [csvHeader, ...csvBody].map((row) => row.join(',')).join('\n');
};

export const generatCSV = (comments: Comment[]) => {
  const csvBody = comments.map((comment) => {
    return [
      comment.type,
      comment.path,
      String(comment.position ?? '-'),
      // CSV内のダブルクオートをエスケープして、全体をダブルクオートで囲む
      `"${comment.body.replace(/"/g, '""')}"`,
    ];
  });

  return generateCSVString(COMMENTS_CSV_HEADER, csvBody);
};

// string型で渡された第一引数をCSVファイルとして第二引数で渡された名前で保存する
export const downloadCSV = (csvContent: string, csvFileName: string) => {
  // aタグを作成してCSVをダウンロードする
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = globalThis.URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = csvFileName;
  a.click();
  a.remove();
};
