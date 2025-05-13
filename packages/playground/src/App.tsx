import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';

const App = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">CodeHedgehog</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Select a repository</CardTitle>
        </CardHeader>
        <CardContent>
          <Select>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a repository" />
            </SelectTrigger>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
