import React from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { ProjectCard } from './ProjectCard';
import { storageInfo, subscribeProjects, subscribeTasks, createProject, reorderProjects } from '../services/firestore';
import type { Project, Task } from '../types';

export const ProjectsBoard: React.FC = () => {
	const [projects, setProjects] = React.useState<Project[]>([]);
	const [tasks, setTasks] = React.useState<Task[]>([]);
	const [newTitle, setNewTitle] = React.useState('');

	React.useEffect(() => {
		const unsubP = subscribeProjects(setProjects);
		const unsubT = subscribeTasks(setTasks);
		return () => { unsubP(); unsubT(); };
	}, []);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

	const handleAddProject = async () => {
		if (!newTitle.trim()) return;
		await createProject(newTitle.trim());
		setNewTitle('');
	};

	const ids = projects.map((p) => p.id);

	return (
		<div className="panel">
			<div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
				<div className="muted">Хранилище: {storageInfo.isFirestore ? 'Firestore' : 'LocalStorage (без синхронизации)'}</div>
				<div className="row">
					<input type="text" placeholder="Новый проект" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={async (e) => { if (e.key === 'Enter') { await handleAddProject(); } }} />
					<button className="success" onClick={handleAddProject}>Добавить проект</button>
				</div>
			</div>
			<div className="spacer" />
			<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={async (evt) => {
				const { active, over } = evt;
				if (!over || active.id === over.id) return;
				const oldIndex = ids.indexOf(String(active.id));
				const newIndex = ids.indexOf(String(over.id));
				const newOrder = arrayMove(ids, oldIndex, newIndex);
				await reorderProjects(newOrder);
			}}>
				<SortableContext items={ids} strategy={verticalListSortingStrategy}>
					<div className="projects">
						{projects.map((p) => (
							<ProjectCard key={p.id} project={p} tasks={tasks.filter(t => t.projectId === p.id).sort((a,b)=>a.order-b.order)} />
						))}
					</div>
				</SortableContext>
			</DndContext>
		</div>
	);
};

