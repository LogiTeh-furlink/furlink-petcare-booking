import { FaFacebookF, FaInstagram, FaEnvelope } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="bg-slate-50 border-t mt-20">
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-center">
        <p className="text-sm text-slate-600">
          © {new Date().getFullYear()} Furlink. All rights reserved.
        </p>

        <div className="flex gap-5 text-slate-700 text-lg mt-3 md:mt-0">
          <a href="https://facebook.com" target="_blank" rel="noreferrer"><FaFacebookF /></a>
          <a href="https://instagram.com" target="_blank" rel="noreferrer"><FaInstagram /></a>
          <a href="mailto:logiteh045@gmail.com"><FaEnvelope /></a>
        </div>
      </div>
    </footer>
  );
}
