import { Button } from '@/components/ui/button.tsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Input } from '@/components/ui/input.tsx';
import { useAtom, useSetAtom } from 'jotai';
import { Check, CircleAlert, Github, Key } from 'lucide-react';
import { useEffect, useState } from 'react';
import { githubTokenAtom, isTokenValidAtom } from '../atoms/vcsAtoms.ts';

const AccessTokenCard = () => {
  const setToken = useSetAtom(githubTokenAtom);
  const [isValid, setIsValid] = useAtom(isTokenValidAtom);
  const [inputToken, setInputToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const savedToken = sessionStorage.getItem('github_token');
    if (savedToken != null) {
      setInputToken(savedToken);
      validateAndSetToken(savedToken);
    }
  }, []);

  const validateAndSetToken = async (token: string) => {
    if (token.trim() === '') {
      setError('アクセストークンを入力してください');
      setIsValid(false);
      return;
    }

    // Check GitHub Personal Access Token format
    const isValidFormat = /^ghp_[a-zA-Z0-9]{36}$/.test(token) || /^github_pat_[a-zA-Z0-9_]{22,82}$/.test(token);

    if (isValidFormat) {
      setError('');
      setToken(token);
      setIsValid(true);
      sessionStorage.setItem('github_token', token);
    } else {
      setError('無効なアクセストークン形式です。');
      setIsValid(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateAndSetToken(inputToken);
  };

  const handleClear = () => {
    setInputToken('');
    setToken('');
    setIsValid(false);
    sessionStorage.removeItem('github_token');
    setError('');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          GitHub アクセストークン
        </CardTitle>
        <CardDescription className="mt-4">
          <p>プライベートリポジトリにアクセスするには GitHub のアクセストークンが必要です。</p>
          <p>パブリックリポジトリにアクセスする場合はアクセストークンは不要です。</p>
          <p>入力したアクセストークンは Session Storage に保持されます。</p>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Input
                type="password"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder="GitHub アクセストークンを入力"
                className="pr-10"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Key className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            {error !== '' && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <CircleAlert className="h-4 w-4" />
                {error}
              </div>
            )}
            {isValid && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                <Check className="h-4 w-4" />
                トークンが有効です
              </div>
            )}
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleClear}>
          クリア
        </Button>
        <Button onClick={handleSubmit} disabled={inputToken.trim() === ''}>
          有効化
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AccessTokenCard;
