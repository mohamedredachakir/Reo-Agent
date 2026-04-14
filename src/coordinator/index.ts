import { QueryEngine } from '../QueryEngine.js';
import { Tool } from '../Tool.js';

export interface Agent {
  id: string;
  name: string;
  role: string;
  tools: Tool[];
  engine: QueryEngine;
}

export interface Task {
  id: string;
  description: string;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export interface Team {
  id: string;
  name: string;
  agents: Agent[];
  tasks: Task[];
  createdAt: Date;
}

export class Coordinator {
  private teams: Map<string, Team> = new Map();

  createTeam(name: string): Team {
    const team: Team = {
      id: `team-${Date.now()}`,
      name,
      agents: [],
      tasks: [],
      createdAt: new Date(),
    };
    this.teams.set(team.id, team);
    return team;
  }

  getTeam(teamId: string): Team | undefined {
    return this.teams.get(teamId);
  }

  addAgent(teamId: string, agent: Omit<Agent, 'engine'>): Agent | null {
    const team = this.teams.get(teamId);
    if (!team) return null;

    const newAgent: Agent = {
      ...agent,
      engine: new QueryEngine({
        systemPrompt: agent.role,
      }),
    };

    team.agents.push(newAgent);
    return newAgent;
  }

  removeAgent(teamId: string, agentId: string): boolean {
    const team = this.teams.get(teamId);
    if (!team) return false;

    const index = team.agents.findIndex(a => a.id === agentId);
    if (index === -1) return false;

    team.agents.splice(index, 1);
    return true;
  }

  addTask(teamId: string, description: string): Task | null {
    const team = this.teams.get(teamId);
    if (!team) return null;

    const task: Task = {
      id: `task-${Date.now()}`,
      description,
      status: 'pending',
    };

    team.tasks.push(task);
    return task;
  }

  assignTask(teamId: string, taskId: string, agentId: string): boolean {
    const team = this.teams.get(teamId);
    if (!team) return false;

    const task = team.tasks.find(t => t.id === taskId);
    if (!task) return false;

    task.assignedTo = agentId;
    return true;
  }

  async executeTask(teamId: string, taskId: string): Promise<string> {
    const team = this.teams.get(teamId);
    if (!team) throw new Error('Team not found');

    const task = team.tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');

    const agent = team.agents.find(a => a.id === task.assignedTo);
    if (!agent) throw new Error('Agent not assigned to task');

    task.status = 'in_progress';

    try {
      const result = await agent.engine.query(task.description, {
        tools: agent.tools,
      });
      task.result = result;
      task.status = 'completed';
      return result;
    } catch (error) {
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.status = 'failed';
      throw error;
    }
  }

  async executeTeamTasks(teamId: string): Promise<Map<string, string>> {
    const team = this.teams.get(teamId);
    if (!team) throw new Error('Team not found');

    const results = new Map<string, string>();

    for (const task of team.tasks.filter(t => t.status === 'pending')) {
      try {
        const result = await this.executeTask(teamId, task.id);
        results.set(task.id, result);
      } catch (error) {
        results.set(task.id, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    return results;
  }

  getTeamStatus(teamId: string): { total: number; completed: number; failed: number; pending: number } | null {
    const team = this.teams.get(teamId);
    if (!team) return null;

    const tasks = team.tasks;
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      pending: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
    };
  }

  deleteTeam(teamId: string): boolean {
    return this.teams.delete(teamId);
  }

  listTeams(): Team[] {
    return Array.from(this.teams.values());
  }
}

export const globalCoordinator = new Coordinator();
