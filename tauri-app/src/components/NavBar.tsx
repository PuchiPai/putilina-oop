import { NavLink } from "react-router-dom";
import { ImageIcon, Plus } from "lucide-react";

export default function NavBar() {
    return (
        <header className="nav-header">
            <div className="nav-left">
                <div className="logo">
                    <ImageIcon size={20} />
                    <span className="logo-text">MyEditor</span>
                </div>

                <nav className="nav-links">
                    <NavLink to="/" end className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
                        Галерея
                    </NavLink>
                    <NavLink to="/editor/new" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
                        <Plus size={14} />
                        Создать
                    </NavLink>
                </nav>
            </div>
        </header>
    );
}