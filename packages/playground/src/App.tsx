import { useState } from 'react';

const App = () => {
  const [count, setCount] = useState(0);

  return (
    <>
      <img src="/vite-deno.svg" alt="Vite with Deno" />
      <h1>Vite + React</h1>
      <div className="card">
        <button type="button" onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
    </>
  );
};

export default App;
