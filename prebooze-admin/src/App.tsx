import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EventsReal from './pages/EventsReal';
import EventEditorReal from './pages/EventEditorReal';
import Bookings from './pages/Bookings';
import BookingDetail from './pages/BookingDetail';
import AbandonedCarts from './pages/AbandonedCarts';
import Featured from './pages/Featured';
import Referrals from './pages/Referrals';
import Locations from './pages/Locations';
import CareersAdmin from './pages/CareersAdmin';
import Reels from './pages/Reels';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Verifications from './pages/Verifications';
import VerificationDetail from './pages/VerificationDetail';
import Leads from './pages/Leads';
import Organizers from './pages/Organizers';
import OrganizerDetail from './pages/OrganizerDetail';
import AddOrganizer from './pages/AddOrganizer';
import { AddVenue, VenueDetail, Venues, VenueHostingRequests } from './pages/Venues';
import Payments from './pages/Payments';
import PaymentDetails from './pages/PaymentDetails';
import PromoterPayouts from './pages/PromoterPayouts';
import Promos from './pages/Promos';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import { Banners, Blogs, Pages } from './pages/Content';
import Categories from './pages/Categories';
import TrendingSearches from './pages/TrendingSearches';
import VenueTypes from './pages/VenueTypes';
import StaffRoles from './pages/StaffRoles';
import LiveMonitor from './pages/LiveMonitor';
import LiveMonitorOverview from './pages/LiveMonitorOverview';
import OrganizerEdit from './pages/OrganizerEdit';
import { EditVenue } from './pages/Venues';
import RunPayoutBatch from './pages/RunPayoutBatch';
import PromoEdit from './pages/PromoEdit';
import Profile from './pages/Profile';
import AddCustomer from './pages/AddCustomer';
import PageEdit from './pages/PageEdit';
import CategoryEdit from './pages/CategoryEdit';
import BannerEdit from './pages/BannerEdit';
import { BlogEditor, BlogCategories } from './pages/BlogEditor';
import Finance from './pages/Finance';
import Settlements from './pages/Settlements';
import SettlementDetail from './pages/SettlementDetail';
import ManualBooking from './pages/ManualBooking';
import GuestList from './pages/GuestList';
import { Lineups, LineupEdit } from './pages/Lineups';
import Reviews from './pages/Reviews';
import { Promoters, PromoterDetail } from './pages/Promoters';
import SettingsLive from './pages/SettingsLive';
import AddPromoter from './pages/AddPromoter';
import PromoterEdit from './pages/PromoterEdit';
import Testimonials from './pages/Testimonials';
import Faqs from './pages/Faqs';
import Policies from './pages/Policies';
import Menus from './pages/Menus';
import EmailTemplates from './pages/EmailTemplates';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/events" element={<EventsReal />} />
        <Route path="/events/create" element={<EventEditorReal />} />
        <Route path="/events/:id" element={<EventEditorReal />} />
        <Route path="/live-monitor" element={<LiveMonitorOverview />} />
        <Route path="/events/:id/live" element={<LiveMonitor />} />
        <Route path="/events/:id/guestlist" element={<GuestList />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/bookings/new" element={<ManualBooking />} />
        <Route path="/bookings/event/:eventId" element={<Bookings />} />
        <Route path="/bookings/:id" element={<BookingDetail />} />
        <Route path="/abandoned" element={<AbandonedCarts />} />
        <Route path="/featured" element={<Featured />} />
        <Route path="/referrals" element={<Referrals />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/new" element={<AddCustomer />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/verifications" element={<Verifications />} />
        <Route path="/verifications/:id" element={<VerificationDetail />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/organizers" element={<Organizers />} />
        <Route path="/organizers/new" element={<AddOrganizer />} />
        <Route path="/organizers/:id" element={<OrganizerDetail />} />
        <Route path="/organizers/:id/edit" element={<OrganizerEdit />} />
        <Route path="/lineups" element={<Lineups />} />
        <Route path="/lineups/new" element={<LineupEdit />} />
        <Route path="/lineups/:id/edit" element={<LineupEdit />} />
        <Route path="/promoters" element={<Promoters />} />
        <Route path="/promoters/new" element={<AddPromoter />} />
        <Route path="/promoters/:id" element={<PromoterDetail />} />
        <Route path="/promoters/:id/edit" element={<PromoterEdit />} />
        <Route path="/locations" element={<Locations />} />
        <Route path="/careers" element={<CareersAdmin />} />
        <Route path="/reels" element={<Reels />} />
        <Route path="/venues" element={<Venues />} />
        <Route path="/venue-hosting" element={<VenueHostingRequests />} />
        <Route path="/venues/new" element={<AddVenue />} />
        <Route path="/venues/:id" element={<VenueDetail />} />
        <Route path="/venues/:id/edit" element={<EditVenue />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/payments/details" element={<PaymentDetails />} />
        <Route path="/promoter-payouts" element={<PromoterPayouts />} />
        <Route path="/payments/run" element={<RunPayoutBatch />} />
        <Route path="/promos" element={<Promos />} />
        <Route path="/promos/:code/edit" element={<PromoEdit />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/settlements" element={<Settlements />} />
        <Route path="/settlements/:id" element={<SettlementDetail />} />
        <Route path="/testimonials" element={<Testimonials />} />
        <Route path="/faqs" element={<Faqs />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/menus" element={<Menus />} />
        <Route path="/banners" element={<Banners />} />
        <Route path="/banners/new" element={<BannerEdit />} />
        <Route path="/banners/:id/edit" element={<BannerEdit />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/categories/new" element={<CategoryEdit />} />
        <Route path="/categories/:name/edit" element={<CategoryEdit />} />
        <Route path="/trending" element={<TrendingSearches />} />
        <Route path="/venue-types" element={<VenueTypes />} />
        <Route path="/blogs" element={<Blogs />} />
        <Route path="/blogs/new" element={<BlogEditor />} />
        <Route path="/blogs/categories" element={<BlogCategories />} />
        <Route path="/blogs/:id/edit" element={<BlogEditor />} />
        <Route path="/pages" element={<Pages />} />
        <Route path="/pages/:pid/edit" element={<PageEdit />} />
        <Route path="/staff" element={<StaffRoles />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<SettingsLive />} />
        <Route path="/email-templates" element={<EmailTemplates />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
