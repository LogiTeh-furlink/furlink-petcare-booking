import React, { useEffect, useState } from "react";
import Header from "../../components/Header/LoggedInNavbar";
import Footer from "../../components/Footer/Footer";
import { supabase } from "../../config/supabase";
import { Plus, Trash2, PawPrint } from "lucide-react";

const MyPets = () => {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPets();
  }, []);

  const fetchPets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("registered_pets") // Ensure this matches your actual table name
        .select("*")
        .eq("owner_id", user.id);

      if (error) throw error;
      setPets(data || []);
    } catch (err) {
      console.error("Error fetching pets:", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-pets-page">
      <Header />
      <main style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>Manage My Pets</h1>
          <button 
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", backgroundColor: "#0E2679", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
            onClick={() => {/* Navigate to add pet page */}}
          >
            <Plus size={18} /> Register New Pet
          </button>
        </div>

        {loading ? (
          <p>Loading pets...</p>
        ) : pets.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px", marginTop: "2rem" }}>
            {pets.map((pet) => (
              <div key={pet.id} style={{ border: "1px solid #ddd", padding: "20px", borderRadius: "12px", background: "white" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <PawPrint size={24} color="#0E2679" />
                  <h3 style={{ margin: 0 }}>{pet.name}</h3>
                </div>
                <p>Breed: {pet.breed}</p>
                <p>Type: {pet.pet_type}</p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", marginTop: "4rem", color: "#64748b" }}>
            <p>No pets registered yet.</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

// This line is what fixes the "Export named default" error
export default MyPets;