import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../types';
import { deleteTask, updateTask } from '../services/firestore';

type Props = { task: Task };

export const TaskItem: React.FC<Props> = ({ task }) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.6 : 1,
	};

	const [title, setTitle] = React.useState(task.title);
	const [comment, setComment] = React.useState(task.comment ?? '');
	React.useEffect(() => { setTitle(task.title); setComment(task.comment ?? ''); }, [task.title, task.comment]);

	return (
		<div className="task-item" ref={setNodeRef} style={style}>
			<div className="handle" {...attributes} {...listeners}>⠿</div>
			<div style={{ flex: 1 }}>
				<input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => updateTask(task.id, { title })} />
				<div className="spacer" />
				<textarea placeholder="Комментарий" value={comment} onChange={(e) => setComment(e.target.value)} onBlur={() => updateTask(task.id, { comment })} />
			</div>
			<div>
				<button onClick={() => deleteTask(task.id)}>Удалить</button>
			</div>
		</div>
	);
};

