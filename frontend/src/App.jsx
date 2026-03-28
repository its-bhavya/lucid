import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Watchlist from "./pages/Watchlist";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Watchlist />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App
