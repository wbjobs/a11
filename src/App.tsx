import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import RoomPage from "@/pages/RoomPage";
import WorkspacePage from "@/pages/WorkspacePage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RoomPage />} />
        <Route path="/room/:roomId" element={<WorkspacePage />} />
      </Routes>
    </Router>
  );
}
