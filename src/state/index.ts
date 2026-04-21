import { EventEmitter } from 'node:events';

export interface SessionState {
	id: string;
	startedAt: Date;
	messageCount: number;
	toolCallCount: number;
	totalTokens: number;
	costEstimate: number;
}

export interface AppState {
	session: SessionState;
	isProcessing: boolean;
	currentModel: string;
	lastError?: string;
}

type StateListener = (state: AppState) => void;

export class StateManager extends EventEmitter {
	private state: AppState;
	private subscribers: Set<StateListener> = new Set();

	constructor() {
		super();
		this.state = this.getInitialState();
	}

	private getInitialState(): AppState {
		return {
			session: {
				id: this.generateSessionId(),
				startedAt: new Date(),
				messageCount: 0,
				toolCallCount: 0,
				totalTokens: 0,
				costEstimate: 0,
			},
			isProcessing: false,
			currentModel: 'claude-sonnet-4-20250514',
		};
	}

	private generateSessionId(): string {
		return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	}

	getState(): AppState {
		return { ...this.state };
	}

	getSession(): SessionState {
		return { ...this.state.session };
	}

	updateSession(updates: Partial<SessionState>): void {
		this.state.session = { ...this.state.session, ...updates };
		this.notify();
	}

	incrementMessageCount(): void {
		this.state.session.messageCount++;
		this.notify();
	}

	incrementToolCallCount(): void {
		this.state.session.toolCallCount++;
		this.notify();
	}

	addTokens(count: number): void {
		this.state.session.totalTokens += count;
		this.notify();
	}

	setProcessing(isProcessing: boolean): void {
		this.state.isProcessing = isProcessing;
		this.notify();
	}

	setError(error?: string): void {
		this.state.lastError = error;
		this.notify();
	}

	setModel(model: string): void {
		this.state.currentModel = model;
		this.notify();
	}

	subscribe(listener: StateListener): () => void {
		this.subscribers.add(listener);
		return () => this.subscribers.delete(listener);
	}

	private notify(): void {
		const currentState = this.getState();
		this.emit('change', currentState);
		for (const listener of this.subscribers) {
			listener(currentState);
		}
	}

	reset(): void {
		this.state = this.getInitialState();
		this.notify();
	}
}

export const globalStateManager = new StateManager();
