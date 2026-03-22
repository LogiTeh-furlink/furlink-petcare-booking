import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  ShoppingBag, 
  ArrowLeft, 
  BarChart3,
  Search,
  UserCheck,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/LoggedInNavbar";

const AdminSPInsights = () => {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchProviderInsights();
  }, []);

  const fetchProviderInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_providers')
        .select(`
          id,
          company_name,
          owner_name:profiles(full_name),
          bookings(total_estimated_price, status)
        `);

      if (error) throw error;

      const processedData = data.map(sp => {
        const successfulBookings = sp.bookings?.filter(b => b.status === 'completed') || [];
        const totalRevenue = successfulBookings.reduce((sum, b) => sum + (b.total_estimated_price || 0), 0);
        
        return {
          id: sp.id,
          name: sp.company_name,
          owner: sp.owner_name?.full_name || "Unknown",
          totalBookings: sp.bookings?.length || 0,
          revenue: totalRevenue,
        };
      });

      setProviders(processedData);
    } catch (error) {
      console.error("Error fetching insights:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProviders = providers.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.owner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto pt-24 px-4 pb-12">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <TrendingUp className="text-blue-600" /> Service Provider Insights
                </h1>
                <p className="text-sm text-gray-500">Manage and monitor business performance</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* ⭐ NAVIGATION BUTTON TO PO INSIGHTS */}
            <button 
                onClick={() => navigate("/admin/pet-owner-insights")}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
                <UserCheck size={18} />
                Pet Owner Insights
                <ArrowRight size={18} />
            </button>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                type="text" 
                placeholder="Search providers..." 
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg text-blue-600"><Users /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Providers</p>
              <h3 className="text-2xl font-bold">{providers.length}</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg text-green-600"><ShoppingBag /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Bookings</p>
              <h3 className="text-2xl font-bold">
                {providers.reduce((sum, p) => sum + p.totalBookings, 0)}
              </h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg text-yellow-600"><DollarSign /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Gross Platform GTV</p>
              <h3 className="text-2xl font-bold">
                ₱{providers.reduce((sum, p) => sum + p.revenue, 0).toLocaleString()}
              </h3>
            </div>
          </div>
        </div>

        {/* Insights Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase">Provider</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase">Owner</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase">Bookings</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase">Revenue</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-400">Loading data insights...</td></tr>
              ) : filteredProviders.length > 0 ? (
                filteredProviders.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50 transition-colors group">
                    <td className="px-6 py-4 font-semibold text-gray-800">{p.name}</td>
                    <td className="px-6 py-4 text-gray-600">{p.owner}</td>
                    <td className="px-6 py-4">{p.totalBookings}</td>
                    <td className="px-6 py-4 font-medium text-green-600">₱{p.revenue.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => navigate(`/admin/provider/${p.id}`)}
                        className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        <BarChart3 size={16} /> Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-400">No providers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default AdminSPInsights;