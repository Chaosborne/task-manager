import React from 'react';
import { ProjectsBoard } from './ProjectsBoard';

export const App: React.FC = () => {
	return (
		<div className="app">
			<header className="header">
				<div className="title">Проекты и задачи</div>
				<div className="muted">Перетаскивайте проекты и задачи мышью</div>
			</header>
			<ProjectsBoard />
		</div>
	);
};

