import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const replaceOverview = (text: string) => {
  return text
    .replace('## Overall Summary', '## PR全体の概要')
    .replace('## Reviewed Changes', '## 各ファイル毎の概要')
    .replace('Comments suppressed due to low severity', '重要度の低いコメント');
};
