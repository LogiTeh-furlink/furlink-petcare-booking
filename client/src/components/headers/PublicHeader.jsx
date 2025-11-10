import { Link } from "react-router-dom";
import Logo from "../../assets/react.svg"; // replace with your actual logo

export default function PublicHeader() {
  return (
    <header className="bg-white shadow-md fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={Logo} alt="Furlink Logo" className="h-8 w-8" />
          <span className="text-xl font-semibold text-slate-800">Furlink</span>
        </Link>

        {/* Nav Links */}
        <nav className="hidden md:flex gap-6 text-slate-700 font-medium">
          <Link to="/about" className="hover:text-indigo-600">About</Link>
          <Link to="/signup" className="hover:text-indigo-600">Sign Up</Link>
          <Link to="/login" className="hover:text-indigo-600">Login</Link>
        </nav>

        {/* Mobile Button */}
        <Link
          to="/signup"
          className="md:hidden px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm"
        >
          Get Started
        </Link>
      </div>
    </header>
  );
}
