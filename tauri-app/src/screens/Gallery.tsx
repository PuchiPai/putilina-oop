import { useState } from "react";
import ProjectCard from "../components/ProjectCard";

type Project = { id: number; name: string; date: string; };

export default function Gallery() {
    const [projects, setProjects] = useState<Project[]>([
        { id: 1, name: "Мой первый проект", date: new Date().toLocaleString() }
    ]);
    const [nextId, setNextId] = useState<number>(2);

    const addProject = () => {
        const newProject: Project = {
            id: nextId,
            name: `Проект ${nextId}`,
            date: new Date().toLocaleString(),
        };
        setProjects(prev => [newProject, ...prev]);
        setNextId(prev => prev + 1);
    };

    return (
        <div className="gallery-root">
            <div className="gallery-header">
                <h1 className="page-title">Галерея</h1>
                <div>
                    <button onClick={addProject} className="btn">Создать проект</button>
                </div>
            </div>

            {projects.length === 0 ? (
                <div className="empty-note">Список проектов пуст. Создайте новый проект.</div>
            ) : (
                <div className="projects-grid">
                    {projects.map(p => <ProjectCard key={p.id} id={p.id} name={p.name} date={p.date} />)}
                </div>
            )}
        </div>
    );
}