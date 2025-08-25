export type Project = {
	id: string;
	title: string;
	order: number;
	createdAt: number;
};

export type Task = {
	id: string;
	projectId: string;
	title: string;
	comment: string;
	order: number;
	createdAt: number;
};

export type ProjectsSnapshot = ReadonlyArray<Project>;
export type TasksSnapshot = ReadonlyArray<Task>;

