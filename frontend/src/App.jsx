import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";

function Home() {
  return <p className="text-text-muted">Lucid frontend running</p>;
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App
