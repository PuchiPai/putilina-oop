import { BaseDirectory, mkdir, readTextFile, writeTextFile, exists } from "@tauri-apps/plugin-fs";

const BASE_DIR = BaseDirectory.Document;
const ROOT_DIR = "VectorEngine";
const PROJECTS_DIR = `${ROOT_DIR}/projects`;
const INDEX_FILE = `${ROOT_DIR}/index.json`;

export interface ProjectIndexItem {
    id: string;
    name: string;
    lastModified: string;
    shapeCount: number;
}

export interface ProjectData {
    id: string;
    name: string;
    createdAt: string;
    modifiedAt: string;
    lineAlgorithm: "bresenham" | "wu";
    shapes: any[];
}

function projectPath(projectId: string): string {
    return `${PROJECTS_DIR}/${projectId}.json`;
}

async function ensureDirs(): Promise<void> {
    const rootExists = await exists(ROOT_DIR, { baseDir: BASE_DIR });
    if (!rootExists) {
        await mkdir(ROOT_DIR, { baseDir: BASE_DIR, recursive: true });
    }

    const projectsExists = await exists(PROJECTS_DIR, { baseDir: BASE_DIR });
    if (!projectsExists) {
        await mkdir(PROJECTS_DIR, { baseDir: BASE_DIR, recursive: true });
    }
}

export async function saveProject(projectId: string, data: ProjectData): Promise<void> {
    await ensureDirs();
    await writeTextFile(projectPath(projectId), JSON.stringify(data, null, 2), {
        baseDir: BASE_DIR,
    });
}

export async function loadProject(projectId: string): Promise<ProjectData | null> {
    await ensureDirs();
    const path = projectPath(projectId);
    const fileExists = await exists(path, { baseDir: BASE_DIR });
    if (!fileExists) return null;

    const content = await readTextFile(path, { baseDir: BASE_DIR });
    return JSON.parse(content) as ProjectData;
}

export async function loadProjectIndex(): Promise<ProjectIndexItem[]> {
    await ensureDirs();
    const fileExists = await exists(INDEX_FILE, { baseDir: BASE_DIR });
    if (!fileExists) return [];

    const content = await readTextFile(INDEX_FILE, { baseDir: BASE_DIR });
    return JSON.parse(content) as ProjectIndexItem[];
}

export async function saveProjectIndex(index: ProjectIndexItem[]): Promise<void> {
    await ensureDirs();
    await writeTextFile(INDEX_FILE, JSON.stringify(index, null, 2), {
        baseDir: BASE_DIR,
    });
}