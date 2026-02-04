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

const LocationPicker = ({ lat, lng, onLocationChange }) => {
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
    const center = lat && lng ? [lat, lng] : [14.5995, 120.9842];

    return (
        <div className="location-picker-container">
            {/* Map Search Bar */}
            <div className="map-search-bar" style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input 
                    type="text" 
                    placeholder="Search for a place (e.g. Asia Pacific College)" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch(e)}
                />
                <button 
                    type="button" 
                    onClick={handleSearch} 
                    style={{ 
                        padding: '10px 15px', 
                        background: '#3b82f6', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <Search size={18} />
                </button>
            </div>

            {/* Leaflet Map Group */}
            <div className="map-wrapper" style={{ height: "350px", width: "100%", borderRadius: "10px", overflow: "hidden", border: "1px solid #ddd" }}>
                <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
                    <TileLayer 
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    
                    {/* Updates map view when searching or clicking */}
                    <ChangeView center={center} />
                    
                    {/* Handles map clicks */}
                    <MapEvents onLocationChange={onLocationChange} />

                    {/* Displays pin with coordinate details if selected */}
                    {lat && lng && (
                        <Marker position={[lat, lng]}>
                            <Popup>
                                <div style={{ fontSize: '12px' }}>
                                    <strong>Pinned Location</strong><br />
                                    Lat: {lat.toFixed(6)}<br />
                                    Lng: {lng.toFixed(6)}
                                </div>
                            </Popup>
                        </Marker>
                    )}
                </MapContainer>
            </div>
        </div>
    );
};

export default LocationPicker;