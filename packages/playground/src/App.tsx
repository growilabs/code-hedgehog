import OwnerSelector from '@/components/OwnerSelector.tsx';
import RepoSelector from '@/components/RepoSelector.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { useContext } from 'react';
import { VCSContext, VCSProvider } from './context/VCSContext.tsx';

const App = () => {
  return (
    <VCSProvider>
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
      </div>
    </VCSProvider>
  );
};

const OwnerRepoSelector = () => {
  const { selectedOwner } = useContext(VCSContext);

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
