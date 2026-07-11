import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import EventEditor from './pages/EventEditor';
import Bookings from './pages/Bookings';
import Customers from './pages/Customers';
import Organizers from './pages/Organizers';
import OrganizerDetail from './pages/OrganizerDetail';
import AddOrganizer from './pages/AddOrganizer';
import { AddVenue, VenueDetail, Venues } from './pages/Venues';
import Payments from './pages/Payments';
import Promos from './pages/Promos';
import Reports from './pages/Reports';
import { Banners, Blogs, Categories, Pages, Staff } from './pages/Content';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventEditor />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/organizers" element={<Organizers />} />
        <Route path="/organizers/new" element={<AddOrganizer />} />
        <Route path="/organizers/:id" element={<OrganizerDetail />} />
        <Route path="/venues" element={<Venues />} />
        <Route path="/venues/new" element={<AddVenue />} />
        <Route path="/venues/:id" element={<VenueDetail />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/promos" element={<Promos />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/banners" element={<Banners />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/blogs" element={<Blogs />} />
        <Route path="/pages" element={<Pages />} />
        <Route path="/staff" element={<Staff />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
