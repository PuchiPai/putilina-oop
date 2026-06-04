import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProjectCard from "../components/ProjectCard";
import { loadProjectIndex, saveProjectIndex, saveProject } from "../lib/projectStorage";

export default function Gallery() {
    const [projects, setProjects] = useState<any[]>([]);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const fetch = async () => {
            const index = await loadProjectIndex();
            setProjects(index);
        };
        fetch();
    }, [location.key]);

    const handleCreateProject = async () => {
        try {
            const newId = Date.now().toString();
            const now = new Date().toISOString();

            const newProject = {
                id: newId,
                name: `Проект ${newId}`,
                lastModified: now,
                shapeCount: 0,
            };

            await saveProject(newId, {
                id: newId,
                name: newProject.name,
                createdAt: now,
                modifiedAt: now,
                lineAlgorithm: "bresenham",
                shapes: [],
            });

            const index = await loadProjectIndex();
            index.push(newProject);
            await saveProjectIndex(index);

            navigate(`/editor/${newId}`);
        } catch (err) {
            console.error("Создание проекта не удалось:", err);
            alert(`Не удалось создать проект: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    return (
        <div className="gallery-root">
            <div className="gallery-header">
                <h1 className="page-title">Галерея</h1>
                <button onClick={handleCreateProject} className="btn">
                    Создать проект
                </button>
            </div>

            {projects.length === 0 ? (
                <div className="empty-note">Нет сохранённых проектов</div>
            ) : (
                <div className="projects-grid">
                    {projects.map((p) => (
                        <ProjectCard key={p.id} id={p.id} name={p.name} date={p.lastModified} />
                    ))}
                </div>
            )}
        </div>
    );
}