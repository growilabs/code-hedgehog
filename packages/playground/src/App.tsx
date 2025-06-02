import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { useAtomValue } from 'jotai';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { selectedOwnerAtom } from './atoms/vcsAtoms.ts';
import AccessTokenCard from './components/AccessTokenCard.tsx';
import CodeHedgehogLogo from './components/CodeHedgehogLogo.tsx';
import OwnerSelector from './components/OwnerSelector.tsx';
import PullRequestCard from './components/PullRequestCard.tsx';
import PullRequestDetail from './components/PullRequestDetail.tsx';
import RepoSelector from './components/RepoSelector.tsx';

const App = () => {
  return (
    <BrowserRouter>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-6">
          <CodeHedgehogLogo width={240} />
        </header>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <AccessTokenCard />
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="text-lg">組織・リポジトリを選択</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <OwnerRepoSelector />
                  </CardContent>
                </Card>
                <PullRequestCard />
              </>
            }
          />
          <Route path="/pulls/:number" element={<PullRequestDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

const OwnerRepoSelector = () => {
  const selectedOwner = useAtomValue(selectedOwnerAtom);

  return (
    <>
      <div>
        <p className="text-sm text-muted-foreground mb-2">組織を選択</p>
        <OwnerSelector />
      </div>
      {selectedOwner !== '' && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-2">リポジトリを選択</p>
          <RepoSelector />
        </div>
      )}
    </>
  );
};

export default App;
