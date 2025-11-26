// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../config/supabase";
import LoggedInAdmin from "../../components/Header/LoggedInAdmin";
import { FaStore, FaCheckCircle, FaUsers, FaClock } from "react-icons/fa";
import "./AdminViewProvider.css";