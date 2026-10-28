import { AuthResponse, Program, RunResult, InstructorProgram } from '../types';

const API_BASE = '';

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem('grasplab_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    localStorage.removeItem('grasplab_token');
    localStorage.removeItem('grasplab_user');
    window.dispatchEvent(new Event('grasplab_auth_change'));
    throw new Error('Session expired or unauthorized. Please log in.');
  }

  if (!response.ok) {
    let errorDetail = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data && data.detail) {
        errorDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // Non-JSON response
    }
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse<AuthResponse>(res);
    localStorage.setItem('grasplab_token', data.access_token);
    localStorage.setItem('grasplab_user', JSON.stringify(data.user));
    window.dispatchEvent(new Event('grasplab_auth_change'));
    return data;
  },

  async signup(
    email: string,
    password: string,
    company_name: string,
    role: string = 'Student'
  ): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, company_name, role }),
    });
    const data = await handleResponse<AuthResponse>(res);
    localStorage.setItem('grasplab_token', data.access_token);
    localStorage.setItem('grasplab_user', JSON.stringify(data.user));
    window.dispatchEvent(new Event('grasplab_auth_change'));
    return data;
  },

  async verify(): Promise<{ valid: boolean; user: any }> {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse<{ valid: boolean; user: any }>(res);
  },

  logout() {
    localStorage.removeItem('grasplab_token');
    localStorage.removeItem('grasplab_user');
    window.dispatchEvent(new Event('grasplab_auth_change'));
  },

  // Programs CRUD
  async getPrograms(): Promise<Program[]> {
    const res = await fetch(`${API_BASE}/programs`, {
      headers: getHeaders(),
    });
    return handleResponse<Program[]>(res);
  },

  async seedSamplePrograms(): Promise<Program[]> {
    const res = await fetch(`${API_BASE}/programs/seed-samples`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<Program[]>(res);
  },

  async createProgram(name: string, assembly_source: string, isa_preset: string): Promise<Program> {
    const res = await fetch(`${API_BASE}/programs`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, assembly_source, isa_preset }),
    });
    return handleResponse<Program>(res);
  },

  async getProgram(id: number): Promise<Program> {
    const res = await fetch(`${API_BASE}/programs/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse<Program>(res);
  },

  async updateProgram(id: number, data: Partial<Program>): Promise<Program> {
    const res = await fetch(`${API_BASE}/programs/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<Program>(res);
  },

  async deleteProgram(id: number): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/programs/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse<{ message: string }>(res);
  },

  // Execution
  async stepProgram(
    programId: number | null,
    payload: {
      assembly_source?: string;
      isa_preset?: string;
      step_index?: number;
      forwarding_enabled?: boolean;
    }
  ): Promise<any> {
    const url = programId ? `${API_BASE}/programs/${programId}/step` : `${API_BASE}/simulate/step`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<any>(res);
  },

  async runProgram(
    programId: number | null,
    payload: {
      assembly_source?: string;
      isa_preset?: string;
      forwarding_enabled?: boolean;
      max_cycles?: number;
      record_run?: boolean;
    }
  ): Promise<RunResult> {
    const url = programId ? `${API_BASE}/programs/${programId}/run` : `${API_BASE}/simulate/run`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<RunResult>(res);
  },

  // Tools & Performance
  async calculateAmdahl(parallel_fraction: number, speedup_factor: number): Promise<any> {
    const res = await fetch(
      `${API_BASE}/performance/amdahl?parallel_fraction=${parallel_fraction}&speedup_factor=${speedup_factor}`
    );
    return handleResponse<any>(res);
  },

  async getTwosComplement(value: number, bits: number = 8): Promise<any> {
    const res = await fetch(`${API_BASE}/tools/twos-complement?value=${value}&bits=${bits}`);
    return handleResponse<any>(res);
  },

  async getBitwise(op: string, val1: number, val2: number = 0, bits: number = 8): Promise<any> {
    const res = await fetch(
      `${API_BASE}/tools/bitwise?op=${op}&val1=${val1}&val2=${val2}&bits=${bits}`
    );
    return handleResponse<any>(res);
  },

  // Instructor
  async getInstructorPrograms(): Promise<InstructorProgram[]> {
    const res = await fetch(`${API_BASE}/instructor/programs`, {
      headers: getHeaders(),
    });
    return handleResponse<InstructorProgram[]>(res);
  },
};
