import { Link } from "react-router-dom";
import { motion } from "framer-motion";

type Props = {
    id: number;
    name: string;
    date: string;
};

export default function ProjectCard({ id, name, date }: Props) {
    return (
        <motion.article
            layout
            whileHover={{ y: -6, scale: 1.01 }}
            className="project-card"
        >
            <Link to={`/editor/${id}`} className="project-card-link">
                <h3 className="project-title">{name}</h3>
                <p className="project-meta">ID: {id} • {date}</p>
            </Link>
        </motion.article>
    );
}