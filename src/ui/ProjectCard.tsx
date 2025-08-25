import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Project, Task } from '../types';
import { createTask, deleteProject, renameProject, reorderTasks } from '../services/firestore';
import { TaskItem } from './TaskItem';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';

type Props = {
	project: Project;
	tasks: Task[];
};

export const ProjectCard: React.FC<Props> = ({ project, tasks }) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.6 : 1,
	};

	const [title, setTitle] = React.useState(project.title);
	React.useEffect(() => setTitle(project.title), [project.title]);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

	const taskIds = tasks.map((t) => t.id);

	return (
		<div className="panel" ref={setNodeRef} style={style}>
			<div className="project-item">
				<div className="handle" {...attributes} {...listeners}>⠿</div>
				<input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => renameProject(project.id, title)} />
				<button onClick={() => deleteProject(project.id)}>Удалить</button>
			</div>
			<div className="spacer" />
			<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={async (evt) => {
				const { active, over } = evt;
				if (!over || active.id === over.id) return;
				const oldIndex = taskIds.indexOf(String(active.id));
				const newIndex = taskIds.indexOf(String(over.id));
				const newOrder = arrayMove(taskIds, oldIndex, newIndex);
				await reorderTasks(project.id, newOrder);
			}}>
				<SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
					<div className="tasks">
						{tasks.map((t) => (
							<TaskItem key={t.id} task={t} />
						))}
					</div>
				</SortableContext>
			</DndContext>
			<div className="spacer" />
			<div className="row new-task-row">
				<input placeholder="Новая задача" onKeyDown={async (e) => {
					if (e.key === 'Enter') {
						const target = e.target as HTMLInputElement;
						const val = target.value.trim();
						if (val) {
							await createTask(project.id, val);
							target.value = '';
						}
					}
				}} />
				<button className="primary" onClick={async (e) => {
					const inp = (e.currentTarget.previousElementSibling as HTMLInputElement | null);
					const val = (inp?.value ?? '').trim();
					if (val) { await createTask(project.id, val); if (inp) inp.value = ''; }
				}}>Добавить задачу</button>
			</div>
		</div>
	);
};

