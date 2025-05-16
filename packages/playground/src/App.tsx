import OwnerSelector from '@/components/OwnerSelector.tsx';
import PullRequestCard from '@/components/PullRequestCard.tsx';
import RepoSelector from '@/components/RepoSelector.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { useAtomValue } from 'jotai';
import { selectedOwnerAtom } from './atoms/vcsAtoms.ts';

const App = () => {
  return (
    <>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">CodeHedgehog</h1>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">組織・リポジトリを選択</CardTitle>
          </CardHeader>
          <CardContent>
            <OwnerRepoSelector />
          </CardContent>
        </Card>
        <PullRequestCard />
      </div>
    </>
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
          <p className="text-sm text-muted-foreground mb-2">リポジトリを選択:</p>
          <RepoSelector />
        </div>
      )}
    </>
  );
};

export default App;
