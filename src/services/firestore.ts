import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
	getFirestore,
	collection,
	addDoc,
	setDoc,
	doc,
	serverTimestamp,
	query,
	orderBy,
	onSnapshot,
	updateDoc,
	where,
	getDocs,
	writeBatch,
	deleteDoc,
} from 'firebase/firestore';
import { v4 as uuid } from 'uuid';
import type { Project, Task, ProjectsSnapshot, TasksSnapshot } from '../types';

type Subscriber<T> = (data: T) => void;

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
	appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

function hasAllConfig(): boolean {
	return Object.values(firebaseConfig).every(Boolean);
}

let app: FirebaseApp | null = null;
let db: ReturnType<typeof getFirestore> | null = null;

if (hasAllConfig()) {
	app = initializeApp(firebaseConfig as Record<string, string>);
	db = getFirestore(app);
} else {
	console.warn('[firebase] Конфиг не найден. Использую локальное хранилище. Создайте .env.local на основе .env.example');
}

// ---------- Локальный fallback (LocalStorage) ----------
const LS_KEY = 'todo.projects_tasks.v1';
type LocalState = { projects: Project[]; tasks: Task[] };

function readLocal(): LocalState {
	const raw = localStorage.getItem(LS_KEY);
	if (!raw) return { projects: [], tasks: [] };
	try { return JSON.parse(raw) as LocalState; } catch { return { projects: [], tasks: [] }; }
}

function writeLocal(next: LocalState): void {
	localStorage.setItem(LS_KEY, JSON.stringify(next));
}

const localListeners = new Set<() => void>();
function notifyLocal(): void {
	for (const fn of Array.from(localListeners)) fn();
}

// ---------- Публичный API ----------
export const storageInfo = {
	isFirestore: Boolean(db),
};

export function subscribeProjects(subscriber: Subscriber<ProjectsSnapshot>): () => void {
	if (db) {
		const q = query(collection(db, 'projects'), orderBy('order', 'asc'));
		const unsub = onSnapshot(q, (snap) => {
			const items: Project[] = [];
			snap.forEach((doc) => {
				const d = doc.data() as any;
				items.push({
					id: doc.id,
					title: d.title ?? '',
					order: d.order ?? 0,
					createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
				});
			});
			subscriber(items);
		});
		return unsub;
	}

	// local
	const emit = () => subscriber(readLocal().projects.sort((a, b) => a.order - b.order));
	emit();
	const listener = () => emit();
	localListeners.add(listener);
	return () => { localListeners.delete(listener); };
}

export function subscribeTasks(subscriber: Subscriber<TasksSnapshot>): () => void {
	if (db) {
		const q = query(collection(db, 'tasks'), orderBy('order', 'asc'));
		const unsub = onSnapshot(q, (snap) => {
			const items: Task[] = [];
			snap.forEach((doc) => {
				const d = doc.data() as any;
				items.push({
					id: doc.id,
					projectId: d.projectId,
					title: d.title ?? '',
					comment: d.comment ?? '',
					order: d.order ?? 0,
					createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
				});
			});
			subscriber(items);
		});
		return unsub;
	}

	// local
	const emit = () => subscriber(readLocal().tasks.sort((a, b) => a.order - b.order));
	emit();
	const listener = () => emit();
	localListeners.add(listener);
	return () => { localListeners.delete(listener); };
}

export async function createProject(title: string): Promise<void> {
	const now = Date.now();
	if (db) {
		const q = query(collection(db, 'projects'), orderBy('order', 'desc'));
		const snap = await getDocs(q);
		const maxOrder = snap.docs.length ? (snap.docs[0].data() as any).order ?? 0 : 0;
		await addDoc(collection(db, 'projects'), { title, order: maxOrder + 1000, createdAt: now, createdAtServer: serverTimestamp() });
		return;
	}
	const state = readLocal();
	const maxOrder = state.projects.reduce((m, p) => Math.max(m, p.order), 0);
	state.projects.push({ id: uuid(), title, order: maxOrder + 1000, createdAt: now });
	writeLocal(state); notifyLocal();
}

export async function renameProject(id: string, title: string): Promise<void> {
	if (db) {
		await updateDoc(doc(db, 'projects', id), { title });
		return;
	}
	const state = readLocal();
	const p = state.projects.find((x) => x.id === id);
	if (p) p.title = title;
	writeLocal(state); notifyLocal();
}

export async function deleteProject(projectId: string): Promise<void> {
	if (db) {
		const batch = writeBatch(db);
		batch.delete(doc(db, 'projects', projectId));
		const tasksQ = query(collection(db, 'tasks'), where('projectId', '==', projectId));
		const tasksSnap = await getDocs(tasksQ);
		tasksSnap.forEach((d) => batch.delete(d.ref));
		await batch.commit();
		return;
	}
	const state = readLocal();
	state.projects = state.projects.filter((p) => p.id !== projectId);
	state.tasks = state.tasks.filter((t) => t.projectId !== projectId);
	writeLocal(state); notifyLocal();
}

export async function reorderProjects(idsInOrder: string[]): Promise<void> {
	if (db) {
		const batch = writeBatch(db);
		idsInOrder.forEach((id, index) => {
			batch.set(doc(db!, 'projects', id), { order: (index + 1) * 1000 }, { merge: true });
		});
		await batch.commit();
		return;
	}
	const state = readLocal();
	const orderMap = new Map(idsInOrder.map((id, i) => [id, (i + 1) * 1000] as const));
	state.projects.forEach((p) => { const o = orderMap.get(p.id); if (o) p.order = o; });
	writeLocal(state); notifyLocal();
}

export async function createTask(projectId: string, title: string): Promise<void> {
	const now = Date.now();
	if (db) {
		const q = query(collection(db, 'tasks'), where('projectId', '==', projectId), orderBy('order', 'desc'));
		const snap = await getDocs(q);
		const maxOrder = snap.docs.length ? (snap.docs[0].data() as any).order ?? 0 : 0;
		await addDoc(collection(db, 'tasks'), { projectId, title, comment: '', order: maxOrder + 1000, createdAt: now, createdAtServer: serverTimestamp() });
		return;
	}
	const state = readLocal();
	const maxOrder = state.tasks.filter(t => t.projectId === projectId).reduce((m, t) => Math.max(m, t.order), 0);
	state.tasks.push({ id: uuid(), projectId, title, comment: '', order: maxOrder + 1000, createdAt: now });
	writeLocal(state); notifyLocal();
}

export async function updateTask(taskId: string, patch: Partial<Pick<Task, 'title' | 'comment'>>): Promise<void> {
	if (db) {
		await updateDoc(doc(db, 'tasks', taskId), patch as any);
		return;
	}
	const state = readLocal();
	const t = state.tasks.find((x) => x.id === taskId);
	if (t) Object.assign(t, patch);
	writeLocal(state); notifyLocal();
}

export async function deleteTask(taskId: string): Promise<void> {
	if (db) {
		await deleteDoc(doc(db, 'tasks', taskId));
		return;
	}
	const state = readLocal();
	state.tasks = state.tasks.filter((t) => t.id !== taskId);
	writeLocal(state); notifyLocal();
}

export async function reorderTasks(projectId: string, idsInOrder: string[]): Promise<void> {
	if (db) {
		const batch = writeBatch(db);
		idsInOrder.forEach((id, index) => {
			batch.set(doc(db!, 'tasks', id), { order: (index + 1) * 1000 }, { merge: true });
		});
		await batch.commit();
		return;
	}
	const state = readLocal();
	const orderMap = new Map(idsInOrder.map((id, i) => [id, (i + 1) * 1000] as const));
	state.tasks.forEach((t) => { if (t.projectId === projectId) { const o = orderMap.get(t.id); if (o) t.order = o; } });
	writeLocal(state); notifyLocal();
}

