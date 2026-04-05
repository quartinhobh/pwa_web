import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Placeholder routing shell. Real pages added by feature-builder in Phase 3.
function Placeholder() {
  return <main>Quartinho</main>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder />} />
      </Routes>
    </BrowserRouter>
  );
}
