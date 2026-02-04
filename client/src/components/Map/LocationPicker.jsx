// src/components/Map/LocationPicker.jsx
import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Search } from "lucide-react";

// Fix marker icons for React/Vite environments
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png"; 

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to handle map re-centering when coordinates change
function ChangeView({ center }) {
    const map = useMap();
    map.setView(center, 16); // Standard zoom level for specific addresses
    return null;
}

// Sub-component to handle map click events
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
            // Using OpenStreetMap's Nominatim API for geocoding
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
            );
            const data = await response.json();

            if (data.length > 0) {
                const { lat: newLat, lon: newLng } = data[0];
                onLocationChange(parseFloat(newLat), parseFloat(newLng));
            } else {
                alert("Location not found. Please try a more specific address.");
            }
        } catch (error) {
            console.error("Search error:", error);
            alert("An error occurred while searching for the location.");
        }
    };

    // Default to Manila coordinates if no location is provided
    const center = [parseFloat(lat) || 14.5995, parseFloat(lng) || 120.9842];

    return (
  <div className="location-picker-container" style={{ height: "100%", width: "100%" }}>
    {/* Search Bar */}
    {!previewOnly && (
      <div className="map-search-bar" style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
        {/* ... input and button ... */}
      </div>
    )}

    {/* Map Container */}
    <div className="map-wrapper" style={{ height: previewOnly ? "100%" : "calc(100% - 50px)", width: "100%" }}>
      <MapContainer 
        center={center} 
        zoom={15} 
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={!previewOnly}
        dragging={!previewOnly}
        zoomControl={!previewOnly}
      >
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