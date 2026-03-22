import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { 
  Users, 
  Dog, 
  CalendarCheck, 
  ArrowLeft, 
  Search,
  UserCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/LoggedInNavbar";

const AdminPOInsights = () => {
  const navigate = useNavigate();
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchOwnerInsights();
  }, []);

  const fetchOwnerInsights = async () => {
    setLoading(true);
    try {
      // Fetches users with their pet count and booking count
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          registered_pets(id),
          bookings(id)
        `)
        .eq('role', 'pet_owner'); // Adjust based on your role column name

      if (error) throw error;

      const processedData = data.map(owner => ({
        id: owner.id,
        name: owner.full_name || "Unknown User",
        email: owner.email,
        petCount: owner.registered_pets?.length || 0,
        bookingCount: owner.bookings?.length || 0,
      }));

      setOwners(processedData);
    } catch (error) {
      console.error("Error fetching PO insights:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredOwners = owners.filter(o => 
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto pt-24 px-4 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 rounded-full">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <UserCheck className="text-purple-600" /> Pet Owner Insights
            </h1>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search owners..." 
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg text-purple-600"><Users /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Pet Owners</p>
              <h3 className="text-2xl font-bold">{owners.length}</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg text-orange-600"><Dog /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Pets Registered</p>
              <h3 className="text-2xl font-bold">
                {owners.reduce((sum, o) => sum + o.petCount, 0)}
              </h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg text-blue-600"><CalendarCheck /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Bookings Made</p>
              <h3 className="text-2xl font-bold">
                {owners.reduce((sum, o) => sum + o.bookingCount, 0)}
              </h3>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">Owner Name</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">Email</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">Pets</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600">Bookings</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan="4" className="px-6 py-10 text-center text-gray-400">Loading...</td></tr>
              ) : filteredOwners.map((o) => (
                <tr key={o.id} className="hover:bg-purple-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-gray-800">{o.name}</td>
                  <td className="px-6 py-4 text-gray-600">{o.email}</td>
                  <td className="px-6 py-4">{o.petCount}</td>
                  <td className="px-6 py-4">{o.bookingCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default AdminPOInsights;