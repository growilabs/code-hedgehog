import OwnerSelector from '@/components/OwnerSelector.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { VCSProvider } from './context/VCSContext.tsx';

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
            <div>
              <p className="text-sm text-muted-foreground mb-2">組織を選択</p>
              <OwnerSelector />
            </div>
          </CardContent>
        </Card>
      </div>
    </VCSProvider>
  );
};

export default App;
