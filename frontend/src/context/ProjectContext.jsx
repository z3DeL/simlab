import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const ProjectContext = createContext();

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider = ({ children }) => {
  const [project, setProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [simResults, setSimResults] = useState(null);
  const [rlResults, setRlResults] = useState(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [liveLogs, setLiveLogs] = useState('');
  const [rlCode, setRlCode] = useState('');
  const [error, setError] = useState(null);

  // Load projects list
  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/projects/');
      if (data.length > 0) {
        setProjects(data);
        if (!project) {
          setProject(data[0]);
          // Restore saved state from first project
          const { data: full } = await api.get(`/projects/${data[0].id}`);
          setProject(full);
          setGeneratedCode(full.generated_code || '');
          setSimResults(full.sim_results_json || null);
          setRlResults(full.rl_results_json || null);
          setRlCode(full.rl_code || '');
        }
      } else {
        // Нет проектов — создаём первый автоматически
        const { data: newProject } = await api.post('/projects/', { name: 'Новый проект' });
        setProjects([newProject]);
        setProject(newProject);
      }
    } catch (err) {
      console.error('Failed to load projects', err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const switchProject = async (proj) => {
    // Сохраняем текущие результаты в текущий проект перед переключением
    if (project) {
      try {
        const updates = {};
        if (generatedCode) updates.generated_code = generatedCode;
        if (simResults) updates.sim_results_json = simResults;
        if (rlResults) updates.rl_results_json = rlResults;
        if (Object.keys(updates).length > 0) {
          await api.put(`/projects/${project.id}`, updates);
        }
      } catch (err) { /* ignore */ }
    }
    // Загружаем полные данные нового проекта
    try {
      const { data } = await api.get(`/projects/${proj.id}`);
      setProject(data);
      setSimResults(data.sim_results_json || null);
      setRlResults(data.rl_results_json || null);
      setGeneratedCode(data.generated_code || '');
      setRlCode(data.rl_code || '');
      setLiveLogs('');
      setError(null);
    } catch (err) {
      console.error('Failed to load project', err);
    }
  };

  const createProject = async (name) => {
    try {
      const { data } = await api.post('/projects/', { name });
      setProjects([data, ...projects]);
      setProject(data);
      setSimResults(null);
      setRlResults(null);
      setGeneratedCode('');
      setRlCode('');
      setLiveLogs('');
      setError(null);
    } catch (err) {
      console.error(err);
    }
  };

  const createProjectFromLab = async () => {
    try {
      // Загружаем первую лабораторную и её схему
      const { data: labs } = await api.get('/lab_works/');
      const lab = labs[0];
      if (!lab?.default_schema_json) return;
      const { data } = await api.post('/projects/', {
        name: lab.title || 'Лабораторная',
        schema_json: lab.default_schema_json,
      });
      setProjects([data, ...projects]);
      setProject(data);
      setSimResults(null);
      setRlResults(null);
      setGeneratedCode('');
      setRlCode('');
      setLiveLogs('');
      setError(null);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteProject = async (id) => {
    try {
      await api.delete(`/projects/${id}`);
      const remaining = projects.filter(p => p.id !== id);
      if (remaining.length > 0) {
        setProjects(remaining);
        if (project?.id === id) setProject(remaining[0]);
      } else {
        // Создаём новый проект если удалили последний
        const { data: newProject } = await api.post('/projects/', { name: 'Новый проект' });
        setProjects([newProject]);
        setProject(newProject);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to delete project');
    }
  };

  const updateProject = React.useCallback(async (updates) => {
    if (!project) return;
    try {
      // Optimistic update
      setProject(prev => ({ ...prev, ...updates }));
      if (updates.name !== undefined) {
        setProjects(prev => prev.map(p => p.id === project.id ? { ...p, name: updates.name } : p));
      }
      await api.put(`/projects/${project.id}`, updates);
    } catch (err) {
      console.error(err);
      setError('Failed to save project');
    }
  }, [project]);

  const generateCode = async () => {
    if (!project) return;
    setIsLoading(true);
    try {
      const { data } = await api.post(`/projects/${project.id}/generate_code`);
      setGeneratedCode(data.code);
      if (data.rl_code) {
        await api.put(`/projects/${project.id}`, { rl_code: data.rl_code });
        setProject(prev => ({ ...prev, rl_code: data.rl_code, generated_code: data.code }));
        setRlCode(data.rl_code);
      } else {
        setProject(prev => ({ ...prev, generated_code: data.code }));
      }
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      setError(detail || 'Ошибка генерации кода');
    } finally {
      setIsLoading(false);
    }
  };

  const runSimulation = async (simTime = 480) => {
    if (!project) return;
    setIsLoading(true);
    try {
      const { data } = await api.post(`/projects/${project.id}/run_simulation`, {
        sim_time: simTime
      });
      setSimResults(data);
      setProject(prev => ({ ...prev, sim_results_json: data }));
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      setError(detail || 'Ошибка симуляции');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRlTemplate = async (algorithm = 'dqn') => {
    if (!project) return;
    try {
      const { data } = await api.get(`/projects/${project.id}/rl_template`, {
        params: { algorithm },
      });
      setRlCode(data.code);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      setError(detail || 'Ошибка загрузки шаблона');
    }
  };

  const runRL = async () => {
    if (!project) return;
    setLiveLogs('');
    setIsTraining(true);
    setRlResults(null);

    // Авто-сохранение RL-кода перед обучением
    if (rlCode && rlCode.trim()) {
      try {
        await api.put(`/projects/${project.id}`, { rl_code: rlCode });
      } catch (e) { /* ignore */ }
    }

    return new Promise((resolve, reject) => {
      const wsHost = import.meta.env.DEV
        ? `${window.location.hostname}:8000`
        : window.location.host;
      const wsUrl = `ws://${wsHost}/api/projects/${project.id}/train_ws`;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('Training WebSocket connected');
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'log') {
          setLiveLogs(prev => prev + message.data);
        } else if (message.type === 'result') {
          setRlResults(message.data);
          setProject(prev => ({ ...prev, rl_results_json: message.data }));
          setIsTraining(false);
          resolve(message.data);
        } else if (message.type === 'error') {
          setError(message.data);
          setIsTraining(false);
          reject(message.data);
        }
      };

      socket.onclose = () => {
        console.log('Training WebSocket closed');
        setIsTraining(false);
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('Connection error during training');
        setIsTraining(false);
        reject(err);
      };
    });
  };

  return (
    <ProjectContext.Provider
      value={{
        project,
        setProject,
        switchProject,
        projects,
        createProject,
        createProjectFromLab,
        deleteProject,
        updateProject,
        simResults,
        rlResults,
        generatedCode,
        isLoading,
        isTraining,
        liveLogs,
        rlCode,
        setRlCode,
        loadRlTemplate,
        error,
        setError,
        generateCode,
        runSimulation,
        runRL,
        fetchProjects
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};
