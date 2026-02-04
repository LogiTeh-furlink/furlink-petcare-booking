// src/components/Map/LocationPicker.jsx
import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Search } from "lucide-react";

// Fix for default marker icon
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
let DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// Helper to move map view when props change
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 16);
  }, [center, map]);
  return null;
}

function MapEvents({ onLocationChange }) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const LocationPicker = ({ lat, lng, onLocationChange, previewOnly = false }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.length > 0) {
        onLocationChange(parseFloat(data[0].lat), parseFloat(data[0].lon));
      } else {
        alert("Location not found.");
      }
    } catch (error) { console.error(error); }
  };

  const center = [parseFloat(lat) || 14.5995, parseFloat(lng) || 120.9842];

  return (
    <div className="location-picker-container" style={{ height: '100%', width: '100%' }}>
      {!previewOnly && (
        <div className="map-search-bar" style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
          <input 
            type="text" 
            placeholder="Search address..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="button" onClick={handleSearch} style={{ padding: '8px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            <Search size={16} />
          </button>
        </div>
      )}

      <div className="map-wrapper" style={{ height: previewOnly ? "100%" : "calc(100% - 50px)", width: "100%" }}>
        <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ChangeView center={center} />
          {!previewOnly && <MapEvents onLocationChange={onLocationChange} />}
          {lat && lng && <Marker position={[lat, lng]} />}
        </MapContainer>
      </div>
    </div>
  );
};

export default LocationPicker;