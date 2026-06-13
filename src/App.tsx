import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Apply from '@/pages/Apply';
import MyCases from '@/pages/MyCases';
import Review from '@/pages/Review';
import Schedule from '@/pages/Schedule';
import Supervisor from '@/pages/Supervisor';
import Fees from '@/pages/Fees';
import Deadline from '@/pages/Deadline';
import AuditLog from '@/pages/AuditLog';
import Experts from '@/pages/Experts';
import Institutions from '@/pages/Institutions';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route element={<Layout />}>
          <Route path="/apply" element={<Apply />} />
          <Route path="/my-cases" element={<MyCases />} />
          <Route path="/review" element={<Review />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/supervisor" element={<Supervisor />} />
          <Route path="/fees" element={<Fees />} />
          <Route path="/deadline" element={<Deadline />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/experts" element={<Experts />} />
          <Route path="/institutions" element={<Institutions />} />
        </Route>
      </Routes>
    </Router>
  );
}
